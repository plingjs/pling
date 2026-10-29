import {
  createPolicy,
  createExecutor,
  RESUME_FLOW_ACTION_ID,
  type ExecResult,
  type Llm,
  type LlmMessage,
  type ConfirmGate,
  type HandoffDecision,
  type HandoffGate,
  type HandoffRequest,
  type LlmResult,
  type Registry,
  type Snapshot,
  whenIdle,
} from "@plingjs/core";
import { History, truncateToolResult, type HistoryOptions, type HistorySnapshot } from "./history";
import { HookRegistry } from "./hooks";
import {
  DEFAULT_CHAT_SYSTEM_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  listActionIds,
  renderPageContext,
  renderResponseLanguage,
  type ContextOptions,
} from "./prompt";
import { buildProtocol, toolNameOf, type ToolProtocol } from "./protocol";
import type { FoldedAction } from "./prompt";
import { isAborted } from "./retry";
import { Telemetry } from "./telemetry";
import type { AgentTraceRecorder } from "./trace";
import type { SessionEvent, SessionEventListener } from "./types";

export const DEFAULT_MAX_TURNS = 10;
export const DEFAULT_LOOP_THRESHOLD = 3;
export const DEFAULT_ERROR_BUDGET = 4;
export const DEFAULT_MAX_NUDGES = 2;

/** 没有页面时的空快照：循环的其余部分（协议、错误提示）不用为「无页面」写特例 */
const EMPTY_SNAPSHOT: Snapshot = {
  actions: [],
  records: [],
  recordsTotal: 0,
  recordIds: [],
  recordIdsTotal: 0,
  offscreenRecordActions: [],
  feedback: [],
  feedbackTotal: 0,
  state: {},
  stateViews: [],
  total: 0,
  unavailable: [],
  unavailableTotal: 0,
  scopes: [],
};

const NUDGE = "Give your final answer now without calling any more actions.";
const MAX_TURNS_NOTICE = "(Maximum turns reached; the task was not completed within the step limit.)";

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface LoopOptions {
  /**
   * 页面注册表。**不传就是纯聊天**：不组装页面上下文、不注入动作、也不等页面落定。
   * 这是同一套循环的两种用法 —— 聊天的那些能力（历史压缩、重试、事件流）完全复用。
   */
  registry?: Registry;
  /**
   * 权限策略。不给默认 `createPolicy(null)`（fail-closed：没有确认通道就一律拒绝），
   * 所以「不小心忘了传」不会变成「悄悄放行」。
   */
  policy?: ConfirmGate;
  /**
   * 人工接力通道（S5）。页面动作声明了 `handoff` 时，执行器会调用它并等待用户完成。
   * 不传时，这类动作会按 fail-closed 失败（不会偷偷模拟点击）。
   */
  handoff?: HandoffGate;
  llm: Llm;
  systemPrompt?: string;
  /**
   * 应用界面当前使用的语言。传回调时每轮重新读取，用户切换语言后下一条消息即生效。
   * 中文界面会在系统提示末尾追加「用中文回答」的明确约束。
   */
  responseLocale?: string | (() => string);
  context?: ContextOptions;
  history?: HistoryOptions;
  /** 从检查点恢复的对话（M4.7）；`system` 不在这里，下一轮会按新页面重建。 */
  historyState?: HistorySnapshot;
  hooks?: HookRegistry;
  telemetry?: Telemetry;
  /** Optional bounded request trace. The built-in debug inspector enables it explicitly. */
  trace?: AgentTraceRecorder;
  maxTurns?: number;
  /** 同一个「工具名 + 参数」重复多少次算死循环 */
  loopThreshold?: number;
  /** 累计多少次动作失败后，催模型直接回答 */
  errorBudget?: number;
  /** 模型连续空回复几次后放弃 */
  maxNudges?: number;
  /**
   * 每轮取快照前调用，等页面「落定」（默认一轮宏任务 + 一帧）。测试里传 `async () => {}` 关掉。
   * 见 `defaultSettle` 的注释：这是浏览器实测出来的竞态。
   */
  settle?: () => Promise<void>;
  /**
   * 两次动作之间至少隔多久（毫秒，默认 0 = 不等）—— 「人性化延迟」。
   *
   * 步 = **一次动作调用**。跨轮之间本来就有模型往返的延迟，但**同一批**里的动作
   * （一次模型响应里的多个调用）只隔了一帧 —— 弹窗会「唰」地开完又关，人根本看不清
   * （015 的真实反馈）。这里补上那点「别快得不像人」的时间。
   *
   * 本次 run 的第一个动作**不等**：点了按钮立刻有反应，否则会觉得「没点动」。
   */
  minActionIntervalMs?: number;
  /** 睡眠实现（测试注入假实现，避免真的等） */
  sleep?: (ms: number) => Promise<void>;
  /** 返回 true 表示请求取消（在下一个安全点退出）。要打断**在飞**的请求用 `loop.abort()` */
  shouldStop?: () => boolean;
  observe?: (id: string, args: Record<string, unknown>) => void | Promise<void>;
  /**
   * 变更证据（S3，默认开）：每次动作执行前后各取一份快照做 diff，`changed` 跟着成功回执走。
   * 关掉可省掉每个动作两次快照组装（大页面 / 高频动作的性能开关）。
   */
  evidence?: boolean;
  onEvent?: SessionEventListener;
  now?: () => number;
}

export interface AgentLoop {
  run(input: string): Promise<string>;
  reset(): void;
  /**
   * 立刻打断：正在飞的那次模型调用会被中止（AbortSignal 一路透到 fetch），
   * 循环在下一个安全点退出。下一次 `run()` 重新开始（和 `session.send()` 的语义一致）。
   */
  abort(): void;
  /** 直接发起一次人工接力（会话 / 业务侧的可编程入口；正常路径由执行器触发） */
  handoff(request: HandoffRequest): Promise<HandoffDecision>;
  readonly history: History;
  readonly hooks: HookRegistry;
  readonly telemetry: Telemetry;
  /** Request trace when debugging is enabled; `undefined` keeps production on the zero-overhead path. */
  readonly trace?: AgentTraceRecorder;
  /**
   * 本次（或最近一次）`run()` 用掉的**模型轮数**；`reset()` 归零。
   *
   * 和 `telemetry.summary().llmCalls` 不是一个口径：那个是整段会话的累计次数
   * （重试、压缩都算），这个是「这一条指令花了预算里的几轮」——
   * 面板要显示「用了几轮 / 最多几轮」时就读它，不然两个数字对不上。
   */
  readonly turnsUsed: number;
}

/**
 * `settle` 等「页面还在动」的最长时间（ms）。
 * 600ms 的取舍：够覆盖一次平滑滚动（300–500ms + 静默窗口），又不会被一个卡住的动画拖死每一步。
 */
export const SETTLE_IDLE_TIMEOUT = 600;
/** `settle` 检查「还在动」的间隔（ms）—— 越小越灵敏，代价是空转 */
export const SETTLE_IDLE_INTERVAL = 20;

/**
 * 让页面落定：执行完动作后，DOM 才刚要被改，快照不能在**同一个 tick** 里重建。
 *
 * 浏览器实测（009 案例）：模型先搜索、再操作搜出来的那一行时，
 * 上一版实现会在「Vue 还没重渲染」时取快照 —— 新行根本不在 DOM 里，
 * 于是动作被判成 `ACTION_NOT_FOUND`。
 *
 * 现在只需要保证「DOM 更新已经落地」：
 *   - Vue 的更新在微任务里 flush → 让出一轮宏任务就够；
 *   - 再等一帧，给浏览器做布局（可见性现在是几何判定，读的就是布局结果）。
 *
 * 可见性本身不再依赖异步观察者回调（见 `@plingjs/vue` 的 `scope.ts`），
 * 所以这里不是「等观察器」，只是「等渲染」。
 */
export async function defaultSettle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  // 再等「页面自己停下来」：平滑滚动 300–500ms、弹窗动画、惯性滚动都算（S4b）。
  // 少了这一步，几何可见性读到的是**滚动途中**的位置 —— 明明滚过去了，
  // 那一行的动作还是不进快照，变更证据也会说「没有观察到变化」。
  await whenIdle({ timeout: SETTLE_IDLE_TIMEOUT, interval: SETTLE_IDLE_INTERVAL, confirmTicks: 2 });

  const raf = (globalThis as { requestAnimationFrame?: (callback: () => void) => number }).requestAnimationFrame;
  if (typeof raf === "function") await new Promise<void>((resolve) => raf(() => resolve()));
}

export function createAgentLoop(options: LoopOptions): AgentLoop {
  const {
    registry,
    policy,
    handoff,
    llm,
    systemPrompt = registry ? DEFAULT_SYSTEM_PROMPT : DEFAULT_CHAT_SYSTEM_PROMPT,
    responseLocale,
    context,
    maxTurns = DEFAULT_MAX_TURNS,
    loopThreshold = DEFAULT_LOOP_THRESHOLD,
    errorBudget = DEFAULT_ERROR_BUDGET,
    maxNudges = DEFAULT_MAX_NUDGES,
    settle = defaultSettle,
    minActionIntervalMs = 0,
    sleep = defaultSleep,
    shouldStop,
    observe,
    evidence,
    onEvent,
    trace,
    now = () => Date.now(),
  } = options;

  const responseLanguage = (): string =>
    renderResponseLanguage(typeof responseLocale === "function" ? responseLocale() : responseLocale);

  const emit = (event: SessionEvent): void => {
    onEvent?.(event);
  };

  /**
   * 接力事件包在通道外面（而不是放在 UI 队列里）：会话 / 审计 / 评测都只消费
   * `SessionEvent` 一条流，这样「请求接管 / 完成 / 取消 / 超时」在 Local 与 Remote
   * 两种拓扑下看到的东西一致。
   */
  const handoffGate: HandoffGate | undefined = handoff
    ? async (request) => {
        emit({ type: "handoff", id: request.id, tool: request.id, status: "requested", reason: request.reason });
        const decision = await handoff(request);
        emit({
          type: "handoff",
          id: request.id,
          tool: request.id,
          status: decision === "done" ? "completed" : decision,
          reason: request.reason,
        });
        return decision;
      }
    : undefined;

  const hooks = options.hooks ?? new HookRegistry();
  const telemetry = options.telemetry ?? new Telemetry({ now });
  const history = new History(options.history);
  if (options.historyState) history.restore(options.historyState);
  const executor = registry
    ? createExecutor({
        registry,
        policy: policy ?? createPolicy(null),
        ...(handoffGate ? { handoff: handoffGate } : {}),
        observe,
        // 证据要用**同一套**落定：after 快照必须在 DOM 更新之后取，否则「删了一行」
        // 在快照里还看得见，diff 会说「无变化」——那是假证据。
        settle,
        // 复合动作（S6a）的步与步之间也走同一条「人性化延迟」——
        // 一条流程内部同样是「一步一步做的」，两帧里把弹窗开完又关掉，人看不见发生了什么。
        betweenSteps: async () => {
          lastActionAt = now();
          await pace(controller?.signal ?? new AbortController().signal);
        },
        ...(evidence === undefined ? {} : { evidence }),
      })
    : null;
  /** 跨轮累积的 name → id：页面变了以后，用旧名字调用时能给出更好的错误 */
  const knownNames = new Map<string, string>();
  let running = false;
  let aborted = false;
  /** 最近一次 run 的轮数（面板读数用；`reset()` 归零） */
  let turnsUsed = 0;
  /** 本次 run 的取消信号：`abort()` 时中止正在飞的模型调用 */
  let controller: AbortController | null = null;

  /** 该停了吗：外部要求（shouldStop）或本实例被 abort() */
  const stopped = (): boolean => aborted || (shouldStop?.() ?? false);

  /**
   * 「人性化延迟」的状态：上一次动作**结束**的时刻（本次 run 内）。
   * `null` = 这次 run 还没做过动作 —— 第一个动作不等，点了立刻有反应。
   */
  let lastActionAt: number | null = null;

  /**
   * 等够最小间隔再执行下一个动作。
   * 取消（`abort()`）时立刻放行：用户都说停了，没必要再等完这点时间。
   */
  async function pace(signal: AbortSignal): Promise<void> {
    if (minActionIntervalMs <= 0 || lastActionAt === null) return;
    const wait = lastActionAt + minActionIntervalMs - now();
    if (wait <= 0) return;
    await Promise.race([
      sleep(wait),
      new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true })),
    ]);
  }

  interface CallState {
    errors: number;
    budgetNotified: boolean;
    /** 当前这一批（一次模型响应）里已经执行过的签名：批内完全重复不再执行 */
    batch: Set<string>;
    /** 上一次执行的签名 + 连续次数：跨轮只统计「中间没做别的事」的连续重复 */
    lastSignature: string | null;
    streak: number;
  }

  async function performCall(
    call: { id: string; name: string; arguments: string },
    turn: number,
    snapshot: Snapshot,
    protocol: ToolProtocol,
    state: CallState,
  ): Promise<ExecResult> {
    const args = safeParse(call.arguments);
    let id = protocol.nameToId.get(call.name) ?? knownNames.get(call.name);
    /** 命中折叠模板时记下它：`record` 拼回真实 id，错误提示也要说清 record 该填什么 */
    let template: FoldedAction | undefined = protocol.templates.get(call.name);
    /** 错误提示 / 可用清单用哪份快照：解析过程中可能被换成更新的一份 */
    let current = snapshot;

    // 本轮开头的快照里没有这个名字 —— 多半不是「模型臆造 id」，而是
    // **上一步动作生效后它才出现**（最常见的连续操作：先把内容填进输入框，
    // 「提交」才从 disabled 变成可用）。这时先把页面落定，再拿一份新快照重新解析；
    // 还是解析不出来，才按「未知动作」如实报错。
    //
    // 只接受 name 的「正统归属」（`toolNameOf(id) === name`）：别名是去重临时产物，
    // 换一份快照后可能落到另一个动作上 —— 宁可报错，也不能点错东西。
    if (!id && !template && registry) {
      await settle();
      const live = registry.snapshot();
      const liveProtocol = buildProtocol(live);
      const found = liveProtocol.nameToId.get(call.name);
      const liveTemplate = liveProtocol.templates.get(call.name);
      if (found && toolNameOf(found) === call.name) {
        id = found;
        current = live;
        for (const [name, actionId] of liveProtocol.nameToId) knownNames.set(name, actionId);
      } else if (liveTemplate) {
        template = liveTemplate;
        current = live;
      }
    }

    // 折叠模板的调用：模型给的是 `{ record: "t4" }`，这里拼回元素级的真实 id（`remove@t4`）。
    // 折叠只改「给模型看的那份清单」，执行仍然按 id 精确匹配 —— 所以 id 必须拼得出来、且真的存在。
    if (template) {
      const record = typeof args.record === "string" ? args.record.trim() : "";
      const known = template.records.join(" / ");
      const problem = !record
        ? `Missing required parameter "record" (the row to operate on: a record id from page data). Available ids this turn: ${known}`
        : registry && !registry.get(`${template.template}${record}`)
          ? `Action ${template.template}${record} does not exist. For ${template.name}, "record" must be a record id from the **active region** (available this turn: ${known}). Rows outside the viewport are valid: the framework will scroll to them first. Do not guess ids outside the active region or record table.`
          : "";
      if (problem) {
        state.errors += 1;
        const result: ExecResult = { error: { code: "INVALID_PARAMS", message: problem } };
        // 和「未知动作」同一条路：记一笔（模型猜错了行是提示工程质量的核心指标），并发一条结果事件，
        // 否则面板与业务审计里这一步是**静默**的。
        telemetry.toolCall({ id: call.name, tool: call.name, status: "unknown", durationMs: 0 });
        emit({ type: "tool_result", id: call.name, tool: call.name, result });
        return result;
      }
      id = `${template.template}${record}`;
    }

    // ── 防失控：只拦「原地打转」，不拦「天生要重复的流程」──
    //
    // 这里踩过坑：原来按「同一个名字+参数在这次 run 里出现过几次」判死循环，
    // 于是「填一条 → 提交」重复三次就被误伤（`composer_submit{}` 的参数永远是空对象），
    // 而且一判就把本轮剩下的调用**全部**跳过，任务停在半路（浏览器实测）。
    //
    // 现在的语义分两种：
    //   ① 批内重复：模型在**同一次响应**里把同一个调用发了多遍 —— 它看不到第一条的结果，
    //      重复基本是幻觉/笔误；对 kind: danger 的动作更是「连点确认」的事故来源。
    //      只执行第一条，其余跳过（不真执行，也不计错 —— 它本来就不会产生第二次副作用）。
    //   ② 跨轮连续重复：中间做了别的事就重新计数。「填内容 → 提交 → 填内容 → 提交」
    //      天生要重复提交；只有连着三次同样的调用、中间什么都没做，才算原地打转。
    const signature = `${call.name}|${call.arguments}`;

    if (state.batch.has(signature)) {
      const message =
        `Duplicate call in the same batch was skipped: ${call.name} (identical arguments). ` +
        "To perform it again, wait for this result and call it separately. To do multiple things, vary the arguments each time.";
      return { error: { code: "LOOP_DETECTED", message } };
    }
    state.batch.add(signature);

    const streak = signature === state.lastSignature ? state.streak + 1 : 1;
    state.lastSignature = signature;
    state.streak = streak;

    if (streak >= loopThreshold) {
      const message =
        `Called ${call.name} ${streak} times in a row with identical arguments and no other action in between; treating this as a loop. ` +
        "Try a different approach or give the final answer now.";
      emit({ type: "notice", text: message });
      state.errors += 1;
      return { error: { code: "LOOP_DETECTED", message } };
    }

    if (!id || !executor) {
      // 没传 registry（纯聊天）时不会有动作；真发生也走同一条「可行动」的错误路径。
      //
      // 注意「上一轮见过、这一轮不可用」的动作**不走这里**：它在 knownNames 里，
      // 会被解析出 id，于是走执行流水线，由 core 报 ACTION_UNAVAILABLE + 原因（见 executor.ts）。
      const message = registry
        ? `Unknown action: ${call.name}. It is not in the current page action list. Available actions: ${listActionIds(current)}`
        : `This session has no page capability (pure chat) and cannot call action ${call.name}. Answer in text instead.`;
      const result: ExecResult = { error: { code: "ACTION_NOT_FOUND", message } };
      state.errors += 1;
      // 记一条：模型猜 id 的频率是提示工程质量的核心指标
      telemetry.toolCall({ id: call.name, tool: call.name, status: "unknown", durationMs: 0 });
      // 也要发事件：否则面板与业务审计里这一步是**静默**的（浏览器实测发现的问题），
      // 用户只会看到「模型说了句话但什么都没发生」。这里不发 tool_call（动作并不存在），只发结果。
      emit({ type: "tool_result", id: call.name, tool: call.name, result });
      return result;
    }

    const startedAt = now();
    emit({ type: "tool_call", id, tool: call.name, args });

    const pre = await hooks.firePreToolUse({ id, tool: call.name, args, turn });
    if (pre.blocked) {
      const reason = pre.reason ?? "Blocked by a hook";
      emit({ type: "blocked", id, tool: call.name, reason });
      telemetry.toolCall({ id, tool: call.name, status: "blocked", durationMs: now() - startedAt });
      state.errors += 1;
      return { error: { code: "HOOK_BLOCKED", message: `Action ${id} was blocked: ${reason}` } };
    }

    // 「人性化延迟」：同一批里的第二个动作不要贴着上一个的尾巴执行（见 LoopOptions.minActionIntervalMs）
    await pace(controller?.signal ?? new AbortController().signal);

    let result = withActionableHint(await executor.execute(id, call.arguments), current);
    lastActionAt = now();
    // 钩子可以返回一份新结果（脱敏 / 补充上下文）：后面的 ok / 事件 / 回填都必须用**最终**那份。
    result = await hooks.firePostToolUse({ id, tool: call.name, args, turn, result });

    const ok = !("error" in result);
    if (!ok) state.errors += 1;
    telemetry.toolCall({ id, tool: call.name, status: ok ? "ok" : "error", durationMs: now() - startedAt });
    emit({ type: "tool_result", id, tool: call.name, result });
    return result;
  }

  async function run(input: string): Promise<string> {
    if (running) {
      throw new Error("pling: the same loop instance cannot run() concurrently. Use createLocalSession to serialize calls, or create one loop per session.");
    }
    running = true;
    // 每次 run 都是新的开始：上一次的 abort 不该影响这一次（和 session.send 的语义对齐）
    aborted = false;
    controller = new AbortController();
    lastActionAt = null; // 新的一次 run：第一个动作不等
    const signal = controller.signal;

    try {
      // 存一份用于预算估算（真正发出去的 system 每轮重建，见下面的 history.build(turnSystem)）
      const initialLanguage = responseLanguage();
      history.setSystem([
        { role: "system", content: initialLanguage ? `${systemPrompt}\n\n${initialLanguage}` : systemPrompt },
      ]);
      // 用户自己也可能把敏感值打进输入框（「打给 138…」）—— 已知值同样换成代号再出站。
      // 事件里仍是原话，所以用户看到的还是自己打的字；执行动作时执行器会还原。
      history.append({ role: "user", content: registry ? registry.redactText(input) : input });
      emit({ type: "user", text: input });

      const state: CallState = {
        errors: 0,
        budgetNotified: false,
        batch: new Set<string>(),
        lastSignature: null,
        streak: 0,
      };
      let nudges = 0;

      for (let turn = 0; turn < maxTurns; turn++) {
        turnsUsed = turn + 1;
        if (stopped()) {
          emit({ type: "cancelled" });
          return "(Cancelled)";
        }

        if (history.needsCompaction()) {
          await history.compact(llm, { signal });
          emit({ type: "notice", text: "Context is near its budget; history was compacted" });
        }

        // 先等页面落定，再取快照：上一步动作刚带出来的元素，这一步才看得到（见 defaultSettle）。
        // 纯聊天没有页面，也就没有「落定」要等 —— 省掉每轮一次宏任务 + 一帧。
        if (registry) await settle();
        const snapshot = registry?.snapshot() ?? EMPTY_SNAPSHOT;
        const protocol = buildProtocol(snapshot);
        for (const [name, id] of protocol.nameToId) knownNames.set(name, id);

        // system 每轮重建：页面可能已经被上一步操作改变了
        const pagePrompt = registry ? systemPrompt + renderPageContext(snapshot, context) : systemPrompt;
        const language = responseLanguage();
        const turnSystem: LlmMessage = {
          role: "system",
          content: language ? `${pagePrompt}\n\n${language}` : pagePrompt,
        };

        let result: LlmResult;
        const turnMessages = history.build([turnSystem]);
        const llmStartedAt = now();
        try {
          // `signal` 让「停止」真的能停住；`onDelta` 让模型边生成边吐字
          result = await llm(turnMessages, protocol.tools, {
            signal,
            onDelta: (text) => emit({ type: "assistant_delta", text }),
          });
          trace?.record({
            turn: turn + 1,
            startedAt: llmStartedAt,
            durationMs: now() - llmStartedAt,
            status: "ok",
            messages: turnMessages,
            tools: protocol.tools,
            snapshot,
            result,
          });
        } catch (error) {
          // 取消不是失败：不发 error（面板会渲染成红色故障），发 cancelled
          if (isAborted(error) || signal.aborted) {
            trace?.record({
              turn: turn + 1,
              startedAt: llmStartedAt,
              durationMs: now() - llmStartedAt,
              status: "cancelled",
              messages: turnMessages,
              tools: protocol.tools,
              snapshot,
              error: { code: "CANCELLED", message: "Model request cancelled" },
            });
            emit({ type: "cancelled" });
            return "(Cancelled)";
          }
          const message = error instanceof Error ? error.message : String(error);
          trace?.record({
            turn: turn + 1,
            startedAt: llmStartedAt,
            durationMs: now() - llmStartedAt,
            status: "error",
            messages: turnMessages,
            tools: protocol.tools,
            snapshot,
            error: { code: "LLM_FAILED", message },
          });
          emit({ type: "error", code: "LLM_FAILED", message });
          return `(Model call failed: ${message})`;
        }

        const content = (result.content ?? "").trim();
        const toolCalls = result.toolCalls ?? [];
        // 有动作的轮次里，这句话是「动手前的说明」，单独发一条 assistant；
        // 没有动作的轮次，它就是最终回答，只发 final —— 同一句话不发两遍
        // （聊天面板上重复的那行特别扎眼，因为它没有任何附加信息）。
        if (content && toolCalls.length > 0) emit({ type: "assistant", text: content });

        if (toolCalls.length === 0) {
          if (content) {
            // 自己的回答也要进历史：否则下一轮（聊天里的追问）看不到自己刚说过什么
            history.append({ role: "assistant", content });
            emit({ type: "final", text: content });
            return content;
          }
          if (nudges >= maxNudges) {
            emit({ type: "notice", text: "The model returned empty responses repeatedly; stopped" });
            return "(The model did not produce an answer)";
          }
          nudges += 1;
          history.append({ role: "user", content: NUDGE });
          emit({ type: "notice", text: NUDGE });
          continue;
        }

        // 一次响应里的多个调用必须**逐条**回填 role="tool"，少一条配对就断，服务端会 400
        history.append({ role: "assistant", content: result.content ?? "", toolCalls });

        state.batch.clear();
        for (const call of toolCalls) {
          if (stopped()) {
            emit({ type: "cancelled" });
            return "(Cancelled)";
          }

          let outcome: ExecResult;
          try {
            outcome = await performCall(call, turn, snapshot, protocol, state);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            state.errors += 1;
            outcome = { error: { code: "EXECUTION_FAILED", message: `Action ${call.name} threw while executing: ${message}` } };
          }

          const serialized = JSON.stringify(outcome);
          history.append({
            role: "tool",
            // 出站最后一道闸：回执里出现过的敏感真值换回 token（S14）。
            // 放在这里而不是各条路径上，是因为这是**所有**工具结果进上下文的唯一入口。
            content: truncateToolResult(
              registry ? registry.redactText(serialized) : serialized,
              history.maxToolResultTokens,
            ),
            toolCallId: call.id,
            name: call.name,
          });
        }

        if (state.errors >= errorBudget && !state.budgetNotified) {
          state.budgetNotified = true;
          history.append({ role: "user", content: `${state.errors} actions have failed. Do not retry the same action. ${NUDGE}` });
          emit({ type: "notice", text: `Error budget exhausted (${state.errors} failures)` });
        }
      }

      emit({ type: "notice", text: MAX_TURNS_NOTICE });
      return MAX_TURNS_NOTICE;
    } finally {
      running = false;
      controller = null;
    }
  }

  return {
    run,
    reset() {
      history.clear();
      knownNames.clear();
      turnsUsed = 0;
      trace?.clear();
    },
    abort() {
      aborted = true;
      controller?.abort();
    },
    async handoff(request: HandoffRequest): Promise<HandoffDecision> {
      if (!handoffGate) {
        throw new Error("No handoff channel is configured; pass one to createAgentLoop / createAgentRuntime.");
      }
      return handoffGate(request);
    },
    history,
    hooks,
    telemetry,
    ...(trace ? { trace } : {}),
    get turnsUsed() {
      return turnsUsed;
    },
  };
}

/**
 * 错误要「可行动」：模型看不到 DOM，只能靠错误信息自救。
 * 只说「未知动作」等于让它瞎猜；告诉它「现在有哪些动作」它才有下一步。
 */
function withActionableHint(result: ExecResult, snapshot: Snapshot): ExecResult {
  if (!("error" in result)) return result;
  const { code, message } = result.error;

  if (code === "ACTION_NOT_FOUND") {
    return { error: { code, message: `${message}. Available actions: ${listActionIds(snapshot)}` } };
  }
  // 「已经执行，但没等到期望的结果」：最容易被误读的一档 —— 直接重试会重复提交。
  // 这里把该做的事写死：先看页面变成了什么样。
  if (code === "EXPECTATION_FAILED") {
    return {
      error: {
        code,
        message: `${message}. Inspect the current page state (read records / use discovery actions) before retrying; do not repeat the same action immediately. Available actions: ${listActionIds(snapshot)}`,
      },
    };
  }
  // 复合动作走到一半失败了（S6a）：这条错误最容易把模型带沟里 ——
  // 「失败」两个字会让它从头再来一遍，而前面几步是真的生效了（重复录单就是这么来的）。
  // 所以这里不是补充信息，而是**把动作方向定死**：接着做完。
  if (code === "STEP_FAILED") {
    const resume = result.error.resume;
    return {
      error: {
        ...result.error,
        code,
        message: resume
          ? `${message}. The result includes resume: call ${RESUME_FLOW_ACTION_ID} { runId: "${resume.runId}" } to continue from step ${resume.from}; completed steps will not run again. Do not restart from step one. Available actions: ${listActionIds(snapshot)}`
          : `${message}. This step may have produced side effects, so the framework will not retry automatically. Inspect the page, then call only the remaining steps; do not restart the whole flow because earlier steps would run again. Available actions: ${listActionIds(snapshot)}`,
      },
    };
  }
  if (code === "ACTION_UNAVAILABLE") {
    // 已经带了确切原因（元素被禁用 / 声明的前置条件不满足，见 core 的 executor）时不要再猜：
    // 猜「被裁剪了」会把模型支使去做无用功（滚动、搜索），而真正该做的是「先选中一行」。
    if (message.includes("reason:")) {
      return { error: { code, message: `${message}. Available actions: ${listActionIds(snapshot)}` } };
    }
    return {
      error: {
        code,
        message: `${message}. It may be clipped by visibility / scope: call a discovery action (pling_reveal_* / pling_scroll_*) to bring it into view, or narrow the list with search / filters first. Available actions: ${listActionIds(snapshot)}`,
      },
    };
  }
  return result;
}

function safeParse(json: string): Record<string, unknown> {
  try {
    return json ? (JSON.parse(json) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
