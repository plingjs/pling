/**
 * 会话接线：**从一份配置到一条能用的会话**。
 *
 * 这一段以前是每个案例各自抄一遍的（012 / 013 的 `createChat` / `createPageAgent`）。
 * 它没有任何应用特征 —— 谁来都是这四件事：建模型调用链、接确认闸门、拼系统提示、起会话。
 * 所以它属于框架。应用那边就剩「给一份配置」和「放一个入口」。
 *
 * 同构：浏览器里 `session` 是 LocalSession（循环在页面里）；
 * 将来 M4 的薄 Node 层换成 RemoteSession，对外的 send / events 完全一样，业务代码不用改。
 */
import { createPolicy, type ConfirmGate, type HandoffGate, type Llm, type Registry } from "@plingjs/core";
import { createLlmChain } from "./chain";
import { createOpenAiLlm } from "./llm/openai";
import { Telemetry } from "./telemetry";
import { autoApprove } from "./approval";
import { createApprovalQueue, type ApprovalQueue, type PendingApproval } from "./approval-queue";
import { createHandoffQueue, type HandoffQueue, type PendingHandoff } from "./handoff";
import { createLocalSession, type AgentSession } from "./session";
import type { ContinuityController, ContinuitySetting } from "./continuity";
import {
  composeSystemPrompt,
  describeAgentConfig,
  type AgentConfig,
  type AgentLimits,
  type AgentRetryConfig,
  type ConfigReadiness,
} from "./config";
import { DEFAULT_CHAT_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT } from "./prompt";
import { HookRegistry } from "./hooks";
import { createAgentTrace, type AgentTraceOptions, type AgentTraceRecorder } from "./trace";
import type { SessionEventListener } from "./types";

export interface AgentRuntimeOptions {
  config: AgentConfig;
  /**
   * 页面能力注册表。**不传就是纯聊天**：不组装页面上下文、不注入动作，也不需要确认通道。
   * 传了它，同一个循环就从「能聊」变成「能操作这个页面」。
   */
  registry?: Registry;
  /** 注入模型：测试用脚本模型；上线换成走薄 Node 层的实现，其余不用动 */
  llm?: Llm;
  /** 应用界面当前语言；回调会在每轮请求前重新读取。 */
  responseLocale?: string | (() => string);
  telemetry?: Telemetry;
  /** Keep bounded model-request traces for the built-in inspector. Disabled by default. */
  trace?: boolean | AgentTraceOptions;
  /** Override the page-settle wait, mainly for deterministic tests and non-browser runtimes. */
  settle?: () => Promise<void>;
  /**
   * 工具生命周期钩子（插件扩展点）：执行前可拦截，执行后可返回一份新结果。
   *
   * 这里是**应用级**接线：`createPling({ agent: { hooks } })` 之后，所有
   * `<AgentDock>` / `runtime.session` 都共用同一组钩子；组件里也可以单独传。
   */
  hooks?: HookRegistry;
  onEvent?: SessionEventListener;
  /** 确认请求的变化（面板据此弹确认条） */
  onApproval?: (pending: PendingApproval | null) => void;
  /** 人工接力请求的变化（面板据此弹「请你接管」） */
  onHandoff?: (pending: PendingHandoff | null) => void;
  /**
   * 确认通道开关：返回 false 时**所有**动作直接执行（危险动作也不问）。
   * 默认开 —— **要不要问由动作声明决定**（`kind` + `confirm`，解析成 `approval`），
   * 这个开关只回答「这个应用要不要提供人工确认通道」；要接自己的审批流就传 `policy`。
   */
  gate?: () => boolean;
  /** 整段接管权限（传了它就没有默认闸门了） */
  policy?: ConfirmGate;
  /** 确认超时（毫秒），默认 60s：超时按拒绝处理 */
  approvalTimeoutMs?: number;
  /**
   * 人工接力的默认超时（毫秒），默认 5 分钟。
   * 单个动作可以在 `v-tool` 的 `handoff.timeout` 里覆盖。
   */
  handoffTimeoutMs?: number;
  /** 整段接管人工接力通道（给了它就不再用内置队列；一般不用传） */
  handoff?: HandoffGate;
  /** 会话 id（多会话场景用） */
  id?: string;
  /** 共享任务被另一个标签页 / 上下文接管后调用；确认与人工接力会先被清掉。 */
  onLeaseLost?: () => void;
  /**
   * 跨整页导航的会话连续性（M4.7）。`"tab"` = 同标签页 / 同 origin 用 sessionStorage 恢复。
   * 不传 = 关闭。它只保存有界对话检查点，不保存 DOM、待确认审批或敏感真值。
   */
  continuity?: ContinuitySetting;
}

export interface AgentRuntime {
  session: AgentSession;
  approvals: ApprovalQueue;
  handoffs: HandoffQueue;
  /** 工具生命周期钩子（不传也会有一份空的；运行时可继续 `addPreToolUse` / `addPostToolUse`） */
  hooks: HookRegistry;
  telemetry: Telemetry;
  /** Inspectable model requests when tracing is enabled; `null` otherwise. */
  trace: AgentTraceRecorder | null;
  /** 连续性检查点（未配置 continuity 时 `enabled=false`）。 */
  continuity: ContinuityController;
  config: AgentConfig;
  model: string;
  /** 配置是否可用；不可用时 `hint` 里写着缺什么、怎么补 */
  readiness: ConfigReadiness;
  limits: AgentLimits;
  retry: AgentRetryConfig;
}

export function createAgentRuntime(options: AgentRuntimeOptions): AgentRuntime {
  const { config } = options;
  const telemetry = options.telemetry ?? new Telemetry();
  const hooks = options.hooks ?? new HookRegistry();
  const trace = options.trace
    ? createAgentTrace(typeof options.trace === "object" ? options.trace : undefined)
    : null;
  const base = options.llm ?? createOpenAiLlm(config);
  const { llm } = createLlmChain({
    base,
    model: config.model,
    telemetry,
    maxRetries: config.retry.maxRetries,
    baseDelayMs: config.retry.baseDelayMs,
    maxDelayMs: config.retry.maxDelayMs,
  });

  const approvals = createApprovalQueue({ timeoutMs: options.approvalTimeoutMs ?? 60_000 });
  if (options.onApproval) {
    const notify = options.onApproval;
    approvals.onChange(() => notify(approvals.current()));
  }

  const handoffs = createHandoffQueue({ timeoutMs: options.handoffTimeoutMs });
  if (options.onHandoff) {
    const notify = options.onHandoff;
    handoffs.onChange(() => notify(handoffs.current()));
  }

  const policy =
    options.policy ??
    createPolicy((request) => ((options.gate?.() ?? true) ? approvals.channel(request) : autoApprove(request)));

  /**
   * 系统提示分两种底稿：绑了页面用「操作规则」，纯聊天用「聊天规则」。
   * 应用自己的角色说明一律**追加**在底稿之后；一个字都没写就别传，
   * 让循环去用它自己的默认值（少一层覆盖，行为和不传时完全一样）。
   */
  const basePrompt = options.registry ? DEFAULT_SYSTEM_PROMPT : DEFAULT_CHAT_SYSTEM_PROMPT;
  const role = config.systemPrompt.trim();

  const session = createLocalSession({
    ...options,
    ...(options.id ? { id: options.id } : {}),
    llm,
    telemetry,
    hooks,
    trace: trace ?? undefined,
    policy,
    handoff: options.handoff ?? handoffs.channel,
    onLeaseLost: () => {
      approvals.clear();
      handoffs.clear();
      options.onLeaseLost?.();
    },
    ...(options.registry ? { registry: options.registry } : {}),
    ...(role ? { systemPrompt: composeSystemPrompt(role, basePrompt) } : {}),
    maxTurns: config.limits.maxTurns,
    minActionIntervalMs: config.minActionIntervalMs,
    history: {
      maxTokens: config.limits.contextTokens,
      reserveForOutput: config.limits.reserveForOutput,
      compactRatio: config.limits.compactRatio,
      keepRecent: config.limits.keepRecent,
    },
    ...(options.onEvent ? { onEvent: options.onEvent } : {}),
  });

  return {
    approvals,
    handoffs,
    hooks,
    telemetry,
    trace,
    config,
    model: config.model,
    // 注入了模型就不要求 baseUrl / apiKey：没有「连哪儿」这回事（脚本模型 / 自己的薄 Node 层 / 无网络演示）
    readiness: describeAgentConfig(config, { hasLlm: Boolean(options.llm) }),
    limits: config.limits,
    retry: config.retry,
    continuity: session.continuity,
    session,
  };
}
