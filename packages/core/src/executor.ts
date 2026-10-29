import { diffSnapshots } from "./diff";
import { ActionError, type ActionErrorCode, type ExecResult } from "./errors";
import {
  MAX_FLOW_DEPTH,
  RESUME_FLOW_ACTION_ID,
  describeFlow,
  renderTemplate,
  resolveStepArgs,
  type FlowReport,
  type FlowResumeInfo,
  type FlowStep,
  type FlowStepReport,
} from "./flow";
import { normalizeDeclaredArgs } from "./params";
import { DEFAULT_HANDOFF_TIMEOUT, type ConfirmGate, type HandoffDecision, type HandoffGate } from "./policy";
import { validateArgs } from "./primitives";
import type { Registry } from "./registry";
import { sanitizeState, type StateLimits } from "./state";
import {
  KIND_ORDER,
  readAvailability,
  resolveApproval,
  resolveKind,
  type Binding,
  type Expectation,
  type Kind,
} from "./types";
import { DEFAULT_WAIT_TIMEOUT, waitFor } from "./wait";

/**
 * 失败流程的续跑句柄（S6c）。
 *
 * 句柄按 **registry（页面会话）** 共享，而不是按 executor 实例：测试里经常
 * 对同一个 registry 反复 `createExecutor`，而真实页面也只有一个「这一页现在停在哪」。
 * 放在 WeakMap 里，registry 被回收后句柄自然消失，不会泄漏到别的页面。
 */
interface PendingFlowRun {
  runId: string;
  flowId: string;
  params: Record<string, unknown>;
  steps: readonly FlowStep[];
  /** 失败步骤的 0-based 下标：续跑从这里开始（失败那一步会重试） */
  nextIndex: number;
  /** 原流程确认时用的风险等级（续跑沿用，不重复打扰用户） */
  level: { kind: Kind; approved: Kind; description: string };
  /** 原流程开始前的快照：续跑成功后仍用它算「这次业务操作改了什么」 */
  before: ReturnType<Registry["snapshot"]> | null;
  /** 已经发生的逐步账本（含失败那一步） */
  report: FlowStepReport[];
}

interface FlowRunStore {
  seq: number;
  pending: Map<string, PendingFlowRun>;
  /** 我们自己挂上去的那次绑定；有失败流程才挂，续跑成功后摘掉 */
  unbindResume?: () => void;
}

/** 最多留多少条失败流程；超了就丢最旧的（页面会话里很少会同时挂这么多） */
const MAX_PENDING_FLOW_RUNS = 20;

/**
 * 函数级动作（S15）返回值的边界。
 *
 * 开发者的实现可能返回一个分页对象、甚至一个第三方 SDK 的响应 —— 和页面状态一样
 * 长度不可控。这里和快照同一条原则：**裁剪 + 明说**（超长数组 / 字段会留一条说明），
 * 而不是把整个对象原样塞进上下文。
 */
const TOOL_DATA_LIMITS: StateLimits = { maxDepth: 3, maxArray: 20, maxKeys: 20, maxString: 300 };

/** 「执行前就失败」的错误码：还没产生副作用，可以直接从失败那一步重试 */
const PRE_EXECUTION_CODES: ReadonlySet<ActionErrorCode> = new Set<ActionErrorCode>([
  "ACTION_NOT_FOUND",
  "INVALID_ARGS",
  "INVALID_PARAMS",
  "ACTION_UNAVAILABLE",
  "PERMISSION_DENIED",
]);

const FLOW_RUN_STORES = new WeakMap<Registry, FlowRunStore>();

function flowRunStore(registry: Registry): FlowRunStore {
  let store = FLOW_RUN_STORES.get(registry);
  if (!store) {
    store = { seq: 0, pending: new Map() };
    FLOW_RUN_STORES.set(registry, store);
  }
  return store;
}

/** 续跑动作的声明：这里只负责「可见性 / 参数 schema」 */
function resumeBinding(): Binding {
  return {
    descriptor: {
      id: RESUME_FLOW_ACTION_ID,
      primitive: "flow",
      kind: "write",
      description: "Resume the failed flow from the step that failed; completed steps will not run again",
      // 续跑的不是「一次新的业务操作」，而是用户已经批准过的那条流程的剩余部分；
      // 具体步骤仍会各自过闸门（比原批准更严的会当场再问）。
      confirm: false,
      params: {
        type: "object",
        properties: {
          runId: { type: "string", description: "The error.resume.runId value from the failed result" },
        },
        required: ["runId"],
      },
    },
    // 只有存在失败流程时才挂进注册表，所以这里永远是可用状态。
    // （如果常驻绑定 + 返回不可用，快照里会一直多一条「不可用动作」，是噪音。）
    isAvailable: () => true,
    // 执行器在查找绑定之前就拦截了这个 id；这里的 run 只是类型上的兜底。
    run: async () => {
      throw new ActionError("EXECUTION_FAILED", "pling_resume_flow 由执行器接管，不应直接调用");
    },
  };
}

/**
 * 让 `pling_resume_flow` 在注册表里的存在性跟着失败流程走：
 * 有句柄 → 挂上去（模型下一轮就能看见）；句柄用完 → 摘掉（快照里不留噪音）。
 *
 * 真正的执行在 `executeInternal` 顶部拦截，因为续跑要返回和普通流程一样的结构化回执
 * （`Binding.run` 只返回 void）。`registry.bind/解绑` 会触发 onChange，面板也会跟着刷新。
 */
function syncResumeBinding(registry: Registry, store: FlowRunStore): void {
  if (store.pending.size > 0) {
    // 业务自己占了同一个 id 时不抢 —— 保留开发者的声明，执行器仍然能接管这个 id。
    if (!store.unbindResume && !registry.get(RESUME_FLOW_ACTION_ID)) {
      store.unbindResume = registry.bind(resumeBinding());
    }
    return;
  }
  if (store.unbindResume) {
    store.unbindResume();
    store.unbindResume = undefined;
  }
}

/** 登记一条可续跑的失败流程；同一 flowId 的旧句柄先清掉，避免用户拿错句柄重来 */
function rememberFailedRun(registry: Registry, store: FlowRunStore, run: PendingFlowRun): void {
  for (const [key, existing] of store.pending) {
    if (existing.flowId === run.flowId) store.pending.delete(key);
  }
  store.pending.set(run.runId, run);
  while (store.pending.size > MAX_PENDING_FLOW_RUNS) {
    const oldest = store.pending.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    store.pending.delete(oldest);
  }
  syncResumeBinding(registry, store);
}

/**
 * 单个动作的执行流水线（7 步），**永不抛异常**，一律返回结构化结果。
 *
 *  1 查绑定 → 2 解析参数 → 3 权限决策（fail-closed）→ 4 参数校验
 *  → 5 元素可用性 → 6 执行原语 → 6.5 等期望（可选）→ 7 观察（刷新世界）
 *
 * 复合动作（`Binding.steps`，S6a）走的是同一条流水线，只是第 6 步换成「按顺序走完这些步骤」：
 * 前面五步（查绑定 / 参数 / 权限 / 可用性）一条都不少 —— 流程不是后门，它和别的动作
 * 一样过闸门，只是**一次业务操作只问一次**（风险取步骤里最严的那一档）。
 *
 * 从 `runtime.ts` 抽出来，让循环（runtime 的简单版 / `@plingjs/agent` 的生产版）
 * 各自只负责「怎么编排」，不重复实现「怎么执行」。
 */
export interface ExecutorOptions {
  registry: Registry;
  policy: ConfirmGate;
  /**
   * 人工接力通道（S5）。声明了 `handoff` 的动作会走它，而不是模拟点击。
   * 不给时按 fail-closed 处理：声明了 handoff 的动作会直接失败（不会偷偷替用户点）。
   */
  handoff?: HandoffGate;
  /** 动作执行后的观察窗口：等路由跳转、等异步渲染、等动画收敛 */
  observe?: (id: string, args: Record<string, unknown>) => void | Promise<void>;
  /**
   * 变更证据（S3，默认开）：取执行前后的两份快照做 diff，把 `changed` 放进成功回执。
   * 关掉可以省掉每个动作两次快照组装（大页面 / 高频动作时的性能开关）。
   */
  evidence?: boolean;
  /**
   * 证据用的「落定」：取 after 快照前等 DOM 更新落地（agent 会把循环自己的 settle 传进来）。
   * 不给就立刻取 —— 此时快照可能还停在动作之前的样子，diff 会说「无变化」。
   */
  settle?: () => Promise<void>;
  /**
   * 复合动作**两步之间**停一下（可选）。循环把它自己的 `minActionIntervalMs` 接进来
   * （见 `@plingjs/agent` 的 loop）：一条流程内部的步骤也是「一步一步做的」，
   * 不该在两帧里把弹窗开完又关掉 —— 人看不见发生了什么，也就无法验收。
   */
  betweenSteps?: () => Promise<void>;
}

export interface Executor {
  execute(id: string, argsJson?: string): Promise<ExecResult>;
}

export function createExecutor(options: ExecutorOptions): Executor {
  const { registry, policy, handoff, observe, evidence = true, settle, betweenSteps } = options;
  const store = flowRunStore(registry);
  syncResumeBinding(registry, store);

  /**
   * 流程内部的上下文（一次复合动作的执行 = 一个）。
   *
   * `inner` 的作用是**收敛**，不是放行：流程里的每一步不再单独取变更证据
   * （用户关心的是「这次业务操作改了什么」，取 N 份 diff 是 N 倍的快照组装成本），
   * 也不再单独弹确认 —— 除非它比整体批准过的更严（见下面的 `mustAsk`）。
   */
  interface FlowContext {
    depth: number;
    /** 外层那一次确认覆盖到的最严风险等级 */
    approvedKind: Kind;
    /** 这是流程内部的步骤（证据 / 确认走收敛路径） */
    inner: boolean;
  }

  /**
   * 这条流程「此刻能看出最严到哪一档」。
   *
   * 为什么是「此刻」：步骤引用的 id 可能还没注册（弹窗里的保存按钮要等弹窗打开），
   * 所以静态解析不出全部风险 —— 解析得到的先用，解析不到的执行到那一步时再兜底（见 `mustAsk`）。
   * 带占位符的 id（`edit@order:{{orderId}}`）也一样解析不了，跳过。
   */
  function reachableKind(steps: readonly FlowStep[], base: Kind): Kind {
    let result = base;
    for (const step of steps) {
      if (step.action.includes("{{")) continue;
      const stepBinding = registry.get(step.action);
      if (!stepBinding) continue;
      const stepKind = resolveKind(stepBinding.descriptor.primitive, stepBinding.descriptor.kind);
      if (KIND_ORDER[stepKind] > KIND_ORDER[result]) result = stepKind;
    }
    return result;
  }

  async function executeInternal(
    id: string,
    argsJson: string | undefined,
    flow: FlowContext | null,
    expectOverride?: Expectation,
  ): Promise<ExecResult> {
    // 续跑句柄（S6c）：它不是页面上的元素，而是「一条失败流程的剩余部分」。
    // 必须在查绑定之前拦截 —— 否则会被当成普通 flow 动作执行（没有 steps），
    // 也拿不到 `resume` 这种只有执行器知道的上下文。
    if (id === RESUME_FLOW_ACTION_ID) {
      if (flow) {
        return new ActionError(
          "EXECUTION_FAILED",
          "pling_resume_flow cannot be used as a step inside another flow; resume is only for a top-level business operation.",
        ).toResult();
      }
      return resumeFlow(argsJson);
    }

    // 1. 查找绑定
    const binding = registry.get(id);
    if (!binding) return new ActionError("ACTION_NOT_FOUND", `Unknown action: ${id}`).toResult();

    // 2. 解析参数（模型输出，容错）
    let args: Record<string, unknown>;
    try {
      args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
    } catch {
      return new ActionError("INVALID_ARGS", `Arguments are not valid JSON: ${argsJson}`).toResult();
    }

    // 2.5 敏感值还原（S14）：模型拿到的是 {{p:…}} 代号，这里是它**唯一**变回真值的地方。
    // 放在参数校验之前 —— 校验（正则 / 枚举）应该看到真值，而不是代号。
    try {
      args = registry.resolveSensitiveArgs(args);
    } catch (error) {
      if (error instanceof ActionError) return error.toResult();
      throw error;
    }

    const { primitive, description } = binding.descriptor;
    const steps = binding.steps ?? null;
    /** 人工接管（S5）：有它时这一步不模拟点击，改为请用户亲自完成 */
    const handoffSpec = binding.handoff;
    /** 分步指引（S17）：有步骤时，由适配器切页签，执行器只负责把高亮挪到当前步 */
    const handoffSteps = handoffSpec?.steps?.length ? handoffSpec.steps : null;
    const kind = resolveKind(primitive, binding.descriptor.kind);
    // 要不要问人：由「声明里的 confirm + 风险等级」解析而来，policy 只认这个字段
    const approval = resolveApproval(kind, binding.descriptor.confirm, registry.defaultApproval);
    /**
     * 这一次确认要按哪一档风险来问。
     *
     * 流程的风险**不能只看它自己声明的那个值**：`kind: "write"` 的「录单流程」里
     * 可能某一步是删除。所以取「声明值」与「此刻解析得到的步骤风险」的最大值 ——
     * 人看到的确认是「这条流程最坏能到什么程度」。
     */
    const effectiveKind = steps ? reachableKind(steps, kind) : kind;
    const effectiveApproval = steps
      ? resolveApproval(effectiveKind, binding.descriptor.confirm, registry.defaultApproval)
      : approval;

    // 3. 参数校验：原语的必填键 + **声明里的自定义参数**（缺必填 / 不在枚举里 / 类型不对）
    //
    // 放在「权限决策」**前面**：参数都不全就别去打扰用户了 ——
    // 让人点一次「批准」再告诉他「少了 position」，那次确认就白问了。
    // 顺带把「数字写成了字符串」这类小毛病规整掉：`run` 与 observe 拿到的都是规整后的参数。
    try {
      validateArgs(primitive, args);
      args = normalizeDeclaredArgs(binding.resolveParams ? binding.resolveParams() : binding.descriptor.params, args);
    } catch (error) {
      if (error instanceof ActionError) return error.toResult();
      throw error;
    }

    // 4. 权限决策（fail-closed）
    //
    // 流程内部**不再逐步打扰用户**：那一次确认覆盖的就是「整条流程」。
    // 唯一的例外是「这一步比整体批准过的更严」—— 比如批准时只能解析到 write，
    // 实际执行到那一步才发现是个 danger 动作（弹窗里的保存按钮）：那一步**当场再问一次**。
    // 宁可多问一句，也不能让一条流程把没被批准过的危险动作夹带执行。
    // 接力是「人来做」，不是「人来批」：用户亲手完成这一步本身就是批准。
    // 再叠一次 approval 会让用户先点「批准」再点「我已完成」，既重复又容易误解。
    const mustAsk = !handoffSpec && (flow === null || KIND_ORDER[kind] > KIND_ORDER[flow.approvedKind]);
    if (mustAsk) {
      try {
        await policy.check({
          id,
          kind: effectiveKind,
          approval: effectiveApproval,
          description,
          args,
          ...(steps ? { flow: { steps: steps.map((step) => step.action) } } : {}),
        });
      } catch (error) {
        if (error instanceof ActionError) return error.toResult();
        throw error;
      }
    }

    // 5. 可见性与可用性检查
    //
    // 长列表里，模型能拿到「活跃区域内的全部记录 id」，其中一些行此刻滚在
    // 容器 / 视口外。它们仍然是可以操作的真实动作 —— 先像人一样把目标带到眼前，
    // 等滚动落定，再重新判断它是否真的可用。不能把「不在视口」等同于「不存在」，
    // 也不能不滚就点：那会让行为与真人操作不一致，变更证据也会读在半路上。
    if (binding.isVisible && !binding.isVisible()) {
      if (!binding.reveal) {
        return new ActionError(
          "ACTION_UNAVAILABLE",
          `The element is outside the visible area and this action has no reveal handler: ${id}. ` +
            "Call a discovery action (pling_reveal_* / pling_scroll_*) to bring it into view, or narrow the list with search / filters first.",
        ).toResult();
      }
      try {
        await binding.reveal();
        await settle?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return new ActionError("ACTION_UNAVAILABLE", `Could not scroll the action target into view: ${id}; reason: ${message}`).toResult();
      }
      // 滚动落定后重新取可见性：滚动可能触发了懒加载 / 观察器回调，
      // 也可能目标行在滚动过程中被替换。这里必须读「新的」状态。
      if (!binding.isVisible()) {
        return new ActionError(
          "ACTION_UNAVAILABLE",
          `Tried to scroll the action target into view, but it is still not visible: ${id}. ` +
            "Check whether the region is collapsed or covered by a dialog, or narrow the list with search / filters first.",
        ).toResult();
      }
    }

    const availability = readAvailability(binding.isAvailable());
    if (!availability.available) {
      // 原因要原样带出来：模型只有「动作清单」一个世界观，
      // 光说「不可用」它只会换个法子乱试；说了原因，它才知道先去做哪一步。
      const reason = availability.reason ? `; reason: ${availability.reason}` : "";
      return new ActionError("ACTION_UNAVAILABLE", `Action is currently unavailable: ${id}${reason}`).toResult();
    }

    // 6-7. 执行原语（复合动作是「按顺序走完步骤」）+ 观察
    // 函数级动作（S15）的返回值先留在这里；它只有在顶层正常结束、要组装成功回执时才用得上。
    let injectedResult: unknown;
    try {
      /**
       * 「变更证据」的前半截：执行**之前**的样子（放在这里是为了不在错误路径上白取快照）。
       * 流程内部的步骤不取：一次业务操作给**一份**证据（整条流程的前后 diff），
       * 5 步各取一份既是 5 倍成本，也答非所问（用户想知道的是「这次改了什么」）。
       */
      const ownsEvidence = evidence && !flow?.inner;
      const before = ownsEvidence ? registry.snapshot() : null;

      if (handoffSpec) {
        if (!handoff) {
          return new ActionError(
            "HANDOFF_FAILED",
            `Action ${id} requires a human handoff, but the app has no handoff channel configured ` +
              "(check the AgentDock / createAgentRuntime handoff option). The framework will not simulate this step.",
          ).toResult();
        }
        const timeout = handoffSpec.timeout ?? DEFAULT_HANDOFF_TIMEOUT;
        // 存在感（S13 / S17）：把「这一步要你看 / 点的就是它」画出来。
        // 有 steps 时目标可以是 `v-guide-target`（只负责被高亮，不是动作），
        // 也可以是一个已注册动作的 id；省略则落到发起接力的动作本身。
        let activeGuideId: string | undefined;
        let acceptingSteps = handoffSteps !== null;
        const markGuide = (targetId: string, state: "waiting" | "idle"): boolean => {
          if (registry.markGuideTarget(targetId, state)) return true;
          const target = registry.get(targetId);
          if (!target?.presence) return false;
          target.presence(state);
          return true;
        };
        const showStep = (index: number): void => {
          if (!acceptingSteps || !handoffSteps) return;
          const step = handoffSteps[index];
          if (!step) return;
          const targetId = step.highlight ?? id;
          if (activeGuideId === targetId) return;
          if (activeGuideId) markGuide(activeGuideId, "idle");
          activeGuideId = markGuide(targetId, "waiting") ? targetId : undefined;
        };
        if (handoffSteps) showStep(0);
        else binding.presence?.("waiting");
        let decision: HandoffDecision;
        try {
          decision = await handoff({
            id,
            description,
            reason: handoffSpec.reason,
            args,
            kind,
            timeout,
            ...(handoffSteps
              ? {
                  steps: handoffSteps,
                  onStep: showStep,
                }
              : {}),
          });
        } finally {
          acceptingSteps = false;
          if (activeGuideId) markGuide(activeGuideId, "idle");
          else if (!handoffSteps) binding.presence?.("idle");
        }
        if (decision !== "done") {
          const label = decision === "timeout" ? "Timed out waiting for the user to complete the step" : "The user cancelled the human step";
          return new ActionError(
            decision === "timeout" ? "HANDOFF_TIMEOUT" : "HANDOFF_CANCELLED",
            `${label}: ${id} (${handoffSpec.reason}). This step did not complete; do not trigger it again without asking the user what to do next.`,
          ).toResult();
        }
      } else if (steps) {
        return await runFlow(id, steps, args, before, { kind, approved: effectiveKind, description }, flow);
      } else {
        if (!binding.run) {
          return new ActionError(
            "EXECUTION_FAILED",
            `Action ${id} has neither run nor steps: flows must declare steps, and element actions must declare run`,
          ).toResult();
        }
        binding.presence?.("acting");
        try {
          injectedResult = await binding.run(args);
        } finally {
          binding.presence?.("idle");
        }
      }
      await observe?.(id, args);

      // 6.5 期望（S4）：等「页面该变成的样子」真的发生。
      //
      // 异步动作（提交订单 / 删除带淡出 / 弹窗动画）的成败只能从这里看出来：
      // 事件发出去 ≠ 事情发生了。不等的话，「还在处理」会被当成「什么都没变」，
      // 于是「无变化」的告警和 `changed` 都是假的。
      const expectation = expectOverride ?? handoffSpec?.expect ?? binding.expect;
      let verified: string | undefined;
      if (expectation) {
        const timeout = expectation.timeout ?? DEFAULT_WAIT_TIMEOUT;
        const reached = await waitFor(expectation.check, { timeout });
        if (!reached) {
          // 注意措辞：动作**执行了**（点击真的发出去了），只是没等到期望的结果。
          // 说成「失败」会把模型引向「重试同一个动作」，重复提交比报错更糟。
          return new ActionError(
            handoffSpec ? "HANDOFF_FAILED" : "EXPECTATION_FAILED",
            handoffSpec
              ? `The user marked human step ${id} complete, but the expected result was not observed: ${expectation.desc ?? "expected condition"} (timeout ${timeout}ms). ` +
                "Clicking 'done' does not prove the action succeeded; ask the user where they got stuck and do not trigger the same handoff again."
              : `Action ${id} ran, but the expected result was not observed: ${expectation.desc ?? "expected condition"} (timeout ${timeout}ms). ` +
                "This does not mean the action had no effect: the page may still be processing, or the change may not be exposed. Inspect the current page state before retrying.",
          ).toResult();
        }
        verified = expectation.desc;
      }

      // 等 DOM / 布局落地再取 after：Vue 的 v-for / v-if 是下一帧才生效的，
      // 不等的话「删了一行」在快照里还看得见 —— diff 会说「无变化」，那是假证据。
      if (before) await settle?.();
      const changed = before ? diffSnapshots(before, registry.snapshot()) : undefined;
      const fidelity = binding.descriptor.fidelity ?? "high";
      /**
       * 回执里带上「这次执行的是哪个动作、它是干什么的」。
       *
       * 为什么必须有（浏览器实测）：一个删除动作做完之后，被删的那一行**从快照里消失了** ——
       * 记录没了、`remove@t2` 这个动作也没了。模型如果只看到 `{ok:true}`，下一轮回头一看
       * 「列表里没有这条待办」，就会认真地说「没找到目标，所以没有删除」（实测原话）。
       * 动作执行成功这件事本身也需要证据，而开发者写的 `desc` 正是这个证据。
       */
      const action = { id, description: binding.descriptor.description };
      const warnings: string[] = [];
      if (fidelity === "low") warnings.push("DOM simulation only; the effect was not verified");
      // 「执行成功但什么都没变」要显式说出来：这正是企业场景最需要发现的一类问题
      // （点了禁用按钮 / 前置条件不满足 / 只改了没暴露的数据）。read 类动作不算 ——
      // 滚动 / 导航本来就可能什么都不改，报了只是噪音。
      if (changed && before && !changed.observed && kind !== "read") {
        warnings.push(
          `No change was observed between snapshots (this page exposes ${before.records.length} records / ${before.actions.length} actions; ` +
            "if the action changed data that is not exposed, the change cannot be seen here)",
        );
      }
      const data =
        injectedResult === undefined
          ? undefined
          : sanitizeState(injectedResult, TOOL_DATA_LIMITS, { vault: registry.tokens });
      return {
        result: {
          ok: true,
          action,
          // 函数级动作的业务结果（S15）：不是「动作成功」，而是「这件事返回了什么」。
          // 没有返回值时整个字段不出现 —— 模型不会看到无意义的 `data: null`。
          ...(data === undefined ? {} : { data }),
          // 「我确认过这件事发生了」—— 期望成立才有的读数。只放一句人话（说明本身），
          // 不放判据代码：模型要的是结果，不是判定过程。
          ...(verified ? { expect: verified } : {}),
          ...(fidelity === "high" ? {} : { fidelity }),
          ...(changed ? { changed } : {}),
          ...(handoffSpec ? { handoff: { reason: handoffSpec.reason, actor: "user" } } : {}),
          ...(warnings.length ? { warning: warnings.join("; ") } : {}),
        },
      };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      // 业务抛错里可能带着真值（「客户 138… 已存在」）—— 出站前反向脱敏
      const message = registry.redactText(raw);
      return new ActionError("EXECUTION_FAILED", `Action ${id} failed: ${message}`).toResult();
    }
  }

  /**
   * 续跑一条失败流程（S6c）：只执行**失败那一步及之后**，不重放前面已成功的步骤。
   *
   * 句柄是执行器内部的东西，模型只通过 `pling_resume_flow { runId }` 引用它。
   * 续跑成功后回执与普通流程一致（`flow` 是完整账本，`changed` 是整次业务操作的前后 diff）。
   */
  async function resumeFlow(argsJson?: string): Promise<ExecResult> {
    let args: Record<string, unknown>;
    try {
      args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
    } catch {
      return new ActionError("INVALID_ARGS", `Arguments are not valid JSON: ${argsJson}`).toResult();
    }
    const runId = typeof args.runId === "string" ? args.runId.trim() : "";
    if (!runId) {
      return new ActionError(
        "INVALID_PARAMS",
        "Missing required parameter runId. Copy it exactly from error.resume.runId in the failed result.",
      ).toResult();
    }

    const run = store.pending.get(runId);
    if (!run) {
      const known = [...store.pending.keys()];
      return new ActionError(
        "ACTION_NOT_FOUND",
        `No resumable flow found: ${runId}. ` +
          (known.length
            ? `Resumable runIds: ${known.join(" / ")}. Use a runId from a failed result; do not invent one.`
            : "The failed result has expired (page reloaded or flow ended); operate again from the current page state."),
      ).toResult();
    }

    // 先取走，避免并发两次续跑同一条流程；如果这次又失败，runFlow 会重新登记同一个 runId。
    store.pending.delete(runId);
    try {
      return await runFlow(run.flowId, run.steps, run.params, run.before, run.level, null, {
        runId,
        startIndex: run.nextIndex,
        report: run.report,
      });
    } catch (error) {
      // 执行器契约是「永不抛异常」。正常情况下 runFlow 只返回结构化结果；
      // 这里兜的是注册表竞争之类的意外 —— 把句柄放回去，别让用户丢掉这次业务操作。
      store.pending.set(runId, run);
      syncResumeBinding(registry, store);
      const message = error instanceof Error ? error.message : String(error);
      return new ActionError("EXECUTION_FAILED", `Failed while resuming flow ${run.flowId}: ${message}`).toResult();
    }
  }

  /**
   * 走一条复合动作（S6a）。
   *
   * 三条规则，每条都来自实测会疼的地方：
   *
   *   · **逐步解析 id**：弹窗里的按钮在弹窗打开之前不存在，只能执行到那一步再找；
   *   · **每步之后落定**：`search_enter` 之后要等列表刷新完，下一步的
   *     `edit@order:X` 才找得到（S4b 的 settle 在这里复用，一个字都不用新写）；
   *   · **失败即中断，且如实说做到第几步**：`STEP_FAILED` 里带上「2/5 步已完成、
   *     前两步的改动已经生效」—— 少了这句话，模型的第一反应就是从头再来一遍。
   */
  async function runFlow(
    id: string,
    steps: readonly FlowStep[],
    params: Record<string, unknown>,
    before: ReturnType<Registry["snapshot"]> | null,
    level: { kind: Kind; approved: Kind; description: string },
    outer: FlowContext | null,
    resume?: { runId: string; startIndex: number; report: FlowStepReport[] },
  ): Promise<ExecResult> {
    // 空流程：一步都不走却回 `ok` 是最坏的一种「成功」—— 模型会以为事情做完了。
    // 声明错了（steps: []）要当场说出来。
    if (steps.length === 0) {
      return new ActionError(
        "EXECUTION_FAILED",
        `Flow ${id} has an empty steps array and nothing to execute. ` +
          "Add steps that reference registered action ids, or remove steps from the declaration.",
      ).toResult();
    }

    const depth = (outer?.depth ?? 0) + 1;
    if (depth > MAX_FLOW_DEPTH) {
      return new ActionError(
        "STEP_FAILED",
        `Flow ${id} is nested too deeply (limit: ${MAX_FLOW_DEPTH}). Check whether its steps reference itself or form a cycle.`,
      ).toResult();
    }

    // 内层步骤不再问的「红线」：外层那次确认覆盖到的最严等级（嵌套时取更严的那个）
    const approvedKind: Kind =
      KIND_ORDER[level.approved] >= KIND_ORDER[outer?.approvedKind ?? "read"]
        ? level.approved
        : (outer?.approvedKind ?? level.approved);
    const context: FlowContext = { depth, approvedKind, inner: true };
    /**
     * 顶层流程才有续跑句柄。嵌套流程失败时外层还有自己的剩余步骤，
     * 单独续跑内层会让外层「看起来成功了、其实没做完」—— 这一版先不提供，
     * 错误信息里仍然要求手动补做。
     */
    const isRoot = outer === null;
    const runId = resume?.runId ?? `run-${++store.seq}`;
    // 续跑时保留失败之前的账本，丢掉失败那一步的旧记录（马上会重试并重新记账）
    const report: FlowStepReport[] = resume
      ? resume.report.filter((entry) => entry.index <= resume.startIndex)
      : [];
    const startAt = resume?.startIndex ?? 0;
    let failed: { index: number; report: FlowStepReport; detail: string; code: ActionErrorCode } | null = null;

    for (let index = startAt; index < steps.length; index += 1) {
      const step = steps[index]!;
      const position = index + 1;
      let stepId: string;
      let stepArgs: Record<string, unknown>;
      /** 失败发生在哪一档：解析参数 = 执行前；执行回执带回来的是动作自己的错误码 */
      let failureCode: ActionErrorCode = "INVALID_PARAMS";
      try {
        stepId = renderTemplate(step.action, params, `step ${position} action id`);
        stepArgs = resolveStepArgs(step, params);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const entry: FlowStepReport = { index: position, id: step.action, ok: false, ...(step.desc ? { desc: step.desc } : {}), error: message };
        report.push(entry);
        if (!step.optional) {
          failed = { index: position, report: entry, detail: message, code: "INVALID_PARAMS" };
          break;
        }
        continue;
      }

      const result = await executeInternal(stepId, JSON.stringify(stepArgs), context, step.expect);
      const ok = !("error" in result);
      if (!ok) failureCode = (result as { error: { code: ActionErrorCode } }).error.code;
      const entry: FlowStepReport = {
        index: position,
        id: stepId,
        ok,
        ...(step.desc ? { desc: step.desc } : {}),
        ...(ok && "result" in result && (result.result as { expect?: string }).expect
          ? { expect: (result.result as { expect?: string }).expect! }
          : {}),
        ...(ok && "result" in result && (result.result as { handoff?: { reason?: string } }).handoff?.reason
          ? { handoff: (result.result as { handoff: { reason: string } }).handoff.reason }
          : {}),
        ...(ok
          ? {}
          : { error: (result as { error: { code: string; message: string } }).error.code + ": " + (result as { error: { code: string; message: string } }).error.message, ...(step.optional ? { skipped: true } : {}) }),
      };
      report.push(entry);

      if (!ok && !step.optional) {
        failed = { index: position, report: entry, detail: entry.error ?? "Unknown reason", code: failureCode };
        break;
      }

      // 每一步之后：等 DOM 落地 + 等页面停下（滚动 / 动画），再走下一步
      await settle?.();
      if (position < steps.length) await betweenSteps?.();
    }

    const summary: FlowReport = {
      steps: report,
      completed: report.filter((step) => step.ok).length,
      total: steps.length,
    };

    if (failed) {
      // 能不能从这一���续跑，取决于「失败时有没有已经产生副作用」：
      //   · 执行前失败（找不到动作 / 参数错 / 不可用 / 权限拒绝）→ 可以安全重试；
      //   · 执行后失败（执行抛错 / 期望没成立）→ 默认不重试（fail-closed），
      //     除非开发者给这一步标了 `idempotent: true`。
      const failedStep = steps[failed.index - 1]!;
      const resumable = isRoot && (PRE_EXECUTION_CODES.has(failed.code) || failedStep.idempotent === true);
      let resumeInfo: FlowResumeInfo | undefined;
      if (resumable) {
        resumeInfo = {
          runId,
          flowId: id,
          failedAt: failed.index,
          total: steps.length,
          from: failed.index,
          remaining: steps.slice(failed.index - 1).map((step) => step.action),
        };
        rememberFailedRun(registry, store, {
          runId,
          flowId: id,
          params: { ...params },
          steps,
          nextIndex: failed.index - 1,
          level,
          before,
          report: [...summary.steps],
        });
      }
      // 措辞是刻意的：**已经做了一部分**。说成「失败」，模型会从头再来一遍，
      // 而前面几步是真的生效了（重复录单 / 重复提交就是这么来的）。
      const next = resumeInfo
        ? `Call ${RESUME_FLOW_ACTION_ID} to resume from step ${resumeInfo.from} (runId: ${resumeInfo.runId}); completed steps will not run again.`
        : "This step may have produced side effects before failing, so the framework will not retry it automatically. Inspect the page first, then perform only the remaining steps; do not restart the entire flow.";
      const progress =
        summary.completed > 0
          ? `Progress: ${describeFlow(summary)}. Changes from completed steps have already taken effect. `
          : `Progress: ${describeFlow(summary)}. No step completed successfully. `;
      return {
        error: {
          code: "STEP_FAILED",
          message:
            `Flow ${id} failed at step ${failed.index}/${steps.length} (${failed.report.id}): ${failed.detail}. ` +
            progress +
            next,
          ...(resumeInfo ? { resume: resumeInfo } : {}),
        },
      };
    }

    if (isRoot) {
      store.pending.delete(runId);
      syncResumeBinding(registry, store);
    }

    // 整条流程一份证据（`before` 是流程开始前的样子，最后一步的 settle 已经等过了）
    const changed = before ? diffSnapshots(before, registry.snapshot()) : undefined;
    const warnings: string[] = [];
    if (changed && before && !changed.observed && level.kind !== "read") {
      warnings.push(
        `No change was observed between snapshots (this page exposes ${before.records.length} records / ${before.actions.length} actions; ` +
          "if the action changed data that is not exposed, the change cannot be seen here)",
      );
    }
    const skipped = report.filter((step) => step.skipped).length;
    if (skipped) warnings.push(`${skipped} optional step(s) were skipped after failing; the rest of the flow continued`);

    return {
      result: {
        ok: true,
        action: { id, description: level.description },
        flow: summary,
        ...(changed ? { changed } : {}),
        ...(warnings.length ? { warning: warnings.join("; ") } : {}),
      },
    };
  }

  return { execute: (id: string, argsJson?: string) => executeInternal(id, argsJson, null) };
}
