import type {
  ExecResult,
  FeedbackView,
  Fidelity,
  JsonSchema,
  PageView,
  RecordView,
  ScopeInfo,
  UnavailableView,
} from "@plingjs/core";

/** Agent Surface 协议版本：不兼容变更必须升主版本 */
export const SURFACE_PROTOCOL = "pling.surface/0.1" as const;

/** 当前协议只实现最小闭环；传输层与委托凭证生命周期在后续版本再加 */
export type SurfaceMethod = "describe" | "invoke";

/**
 * 本次会话允许暴露的能力范围。
 *
 * - 数组：精确 id allowlist；也接受折叠模板 id（如 `approve@order`），
 *   表示允许这一族的行内能力；
 * - 函数：按能力 id 判断，适合 `approve@order:*` 这类动态行内能力。
 *
 * 无论哪种写法，describe 与 invoke 使用同一套判断；省略 = 当前全部能力。
 */
export type SurfaceExpose = readonly string[] | ((id: string) => boolean);

/**
 * 一个**已经由传输层 / 后端验证**的 Agent 会话。
 *
 * 协议内核不接收也不解析 Cookie、JWT、OAuth token 或委托凭证；这些只应存在于
 * 宿主与身份服务之间。这里只放验证后的身份、有效期与能力范围，供 Surface 做
 * 会话绑定、作用域交集和过期 / 撤销检查。
 *
 * `scope` 必须显式给出，并与 `createSurface({ expose })` 取交集：
 * 全局 expose 是站点上限，session.scope 是这一次委托的上限。
 * 会话作用域变化时应换新的 `sessionId`，避免增量能力缓存跨授权状态复用。
 */
export interface SurfaceSession {
  /** 发起调用的 Agent 标识 */
  agentId: string;
  /** 本次委托会话的稳定 id；同一会话的多次请求应保持一致 */
  sessionId: string;
  /** 业务页面当前登录用户 */
  userId: string;
  /** 会话失效时间（Unix ms） */
  expiresAt: number;
  /** 本次会话允许的能力范围；与站点级 expose 取交集 */
  scope: SurfaceExpose;
  /** 可选的委托 / 授权记录 id，便于宿主做审计关联 */
  delegationId?: string;
  /** 撤销时间（Unix ms）；到达该时间后立即拒绝 */
  revokedAt?: number;
}

/** 可以传静态会话，也可以传 getter；getter 会在每次 describe / handle 时重新读取。 */
export type SurfaceSessionSource = SurfaceSession | (() => SurfaceSession | null | undefined);

export type SurfaceAwaitable<T> = T | Promise<T>;

/** 闸门适配器只需要已验证会话的稳定绑定，不需要 scope、有效期或原始凭证。 */
export interface SurfaceGuardSession {
  agentId: string;
  sessionId: string;
  userId: string;
}

export interface SurfaceRateLimitInput {
  /** 已验证会话；开放模式下为 null。适配器应在 key 中保留 null 与真实会话的区别。 */
  session: SurfaceGuardSession | null;
  maxRequests: number;
  windowMs: number;
  /** 服务端时间（Unix ms）；不要改用客户端时间 */
  now: number;
}

export type SurfaceRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/**
 * 分布式限流 port。
 *
 * 默认实现是实例内滑动窗口；多副本部署时注入 Redis 等共享实现。适配器抛错或返回非法值时，
 * Surface 会 fail-closed，不会静默放行。
 */
export interface SurfaceRateLimiter {
  consume(input: SurfaceRateLimitInput): SurfaceAwaitable<SurfaceRateLimitDecision>;
}

/** 每个已验证会话（开放模式下是全局）在滑动窗口内允许的协议请求数。 */
export interface SurfaceRateLimit {
  /** 窗口内最多允许多少次 handle 调用；必须是正整数 */
  maxRequests: number;
  /** 滑动窗口长度（毫秒）；必须是正整数 */
  windowMs: number;
  /** 自定义共享限流器；省略 = 实例内滑动窗口 */
  limiter?: SurfaceRateLimiter;
}

export interface SurfaceReplayInput {
  /** 已验证会话；开放模式下为 null。适配器应在 key 中保留 null 与真实会话的区别。 */
  session: SurfaceGuardSession | null;
  requestId: string;
  windowMs: number;
  /** 服务端时间（Unix ms）；不要改用客户端时间 */
  now: number;
}

/**
 * 分布式防重放 port。
 *
 * `reserve()` 必须原子地占用 `(session, requestId)`：第一次返回 true，窗口内重复返回 false。
 * Redis 可用 `SET NX PX` + Lua 实现；适配器抛错时 Surface fail-closed。
 */
export interface SurfaceReplayGuard {
  reserve(input: SurfaceReplayInput): SurfaceAwaitable<boolean>;
}

/** 重复 request.id 的防护窗口。只影响 invoke；describe 的重复读取由限流约束。 */
export interface SurfaceReplayOptions {
  /** 去重窗口（毫秒），默认 5 分钟 */
  windowMs?: number;
  /** 自定义共享防重放守卫；省略 = 实例内窗口 */
  guard?: SurfaceReplayGuard;
}

export type SurfaceAuditOutcome = "completed" | "business_error" | "denied" | "failed";

/**
 * Surface 的审计事件：只含关联与结果元数据，不含 input 参数、响应正文、Cookie / token。
 *
 * 业务参数可能包含客户信息或敏感值，因此默认不落审计；需要参数级证据时，由宿主在
 * executor / 业务后端里按自己的合规规则记录。
 */
export interface SurfaceAuditEvent {
  protocol: typeof SURFACE_PROTOCOL;
  /** ISO 时间 */
  at: string;
  requestId: string;
  method: SurfaceMethod | "unknown";
  agentId?: string;
  sessionId?: string;
  userId?: string;
  delegationId?: string;
  /**
   * 后端审批挑战 / 回执的公开关联 id（不是 token，也不是 token hash）。
   *
   * 由宿主的执行适配器通过 `execute(..., context)` 返回；协议内核只把它带进审计，
   * 不会透传进 Agent 看到的响应。
   */
  approvalId?: string;
  capability?: string;
  /** 折叠动作解析出的目标记录；非行内动作省略 */
  record?: string;
  outcome: SurfaceAuditOutcome;
  /** 协议错误码或业务 ActionErrorCode */
  code?: string;
  durationMs: number;
}

export type SurfaceAuditSink = (event: SurfaceAuditEvent) => void | Promise<void>;

/**
 * 审计写入失败的通知口。
 *
 * 审计失败不能改变协议结果；但也不能静默。宿主应在这里接错误日志 / 指标 / 告警。
 * 这个回调自身抛错或 reject 同样不会影响业务调用。
 */
export type SurfaceAuditErrorHandler = (
  error: unknown,
  event: SurfaceAuditEvent,
) => void | Promise<void>;

/** 宿主提供的审批关联证据；只允许公开 id，不允许 token / hash。 */
export interface SurfaceApprovalEvidence {
  /** 审批 challenge 或 receipt 的公开 id；具体含义由企业审批后端定义 */
  id: string;
}

/** Surface 传给宿主执行器的调用上下文；宿主可据此关联审批记录。 */
export interface SurfaceExecutionContext {
  /** 本次 invoke 的 request.id */
  requestId: string;
  /** 请求中的能力 id；折叠动作仍是模板 id */
  capability: string;
  /** 折叠动作解析出的目标记录 */
  record?: string;
  /** 已验证会话；开放模式为 null */
  session: SurfaceGuardSession | null;
}

/**
 * 执行结果可以附带审批证据。它只用于审计关联，不改变 executor 的权限判断；
 * Surface 会在返回协议响应前剥离，Agent 不会看到审批 id。
 */
export type SurfaceExecutionResult = ExecResult & { approval?: SurfaceApprovalEvidence };

export interface SurfaceDescribeRequest {
  protocol: typeof SURFACE_PROTOCOL;
  id: string;
  method: "describe";
  /** 可选的行数据窗口；省略时使用宿主配置的默认页大小 */
  input?: SurfaceDescribeInput;
}

/**
 * describe 的读取选项。
 *
 * 默认只给「一页」行数据：Surface 的能力清单可以完整，但长列表字段是 token 的主要成本。
 * `record` 用于精读某几行；`offset / limit` 用于翻页。动作执行不受窗口影响，
 * `context.recordIds` 仍保留当前活跃区域里全部可引用记录。
 */
export interface SurfaceDescribeInput {
  /** 只返回这些记录 id 的字段（1 条或一个数组） */
  record?: string | readonly string[];
  /** 从第几条记录开始，默认 0 */
  offset?: number;
  /** 最多返回多少条记录；最高受宿主上限约束 */
  limit?: number;
  /**
   * 能力清单的返回方式。
   *
   * - `full`（默认）：返回当前完整清单，适合首次连接或无状态调用；
   * - `changed`：与上一次 describe 相同则返回空数组，并标记 `capabilitiesUnchanged`。
   *
   * 这是给有会话记忆的 Agent 的省 token 选项；能力变化时仍会返回完整清单。
   */
  capabilities?: "full" | "changed";
}

export interface SurfaceInvokeRequest {
  protocol: typeof SURFACE_PROTOCOL;
  id: string;
  method: "invoke";
  /** 能力 id（来自 describe 的 capabilities） */
  capability: string;
  /** 能力输入；必须是对象，具体字段由 inputSchema 描述 */
  input?: Record<string, unknown>;
}

export type SurfaceRequest = SurfaceDescribeRequest | SurfaceInvokeRequest;

export type SurfaceEffect = "read" | "write" | "destructive";
export type SurfaceApproval = "none" | "ask" | "always";

/**
 * 一次审批回执要绑定的不可变字段。
 *
 * 这是传输无关的类型：页面可以把同一份 binding 交给自己的审批后端，
 * 后端签发 receipt 时保存它，消费时逐字段比对。**receipt token 不在这个类型里**，
 * 它只应存在于用户页面与审批后端之间，绝不能进入 Surface 响应或 Agent 上下文。
 */
export interface SurfaceApprovalBinding {
  /** 本次审批挑战的随机 id；同一次挑战只能签发一次回执 */
  challengeId: string;
  /** Surface invoke 的 requestId；用于把回执与具体调用关联起来 */
  requestId: string;
  /** describe 中暴露的能力 id（可能是折叠模板，例如 approve@order） */
  capability: string;
  /** 折叠动作的目标记录；非行内动作是 null */
  record: string | null;
  /** 调用参数的规范化 hash（由宿主定义 canonical JSON；不含 token） */
  argsHash: string;
  /** 业务页面当前登录用户 */
  userId: string;
  /** 发起调用的 Agent 标识 */
  agentId: string;
  /** 本次 Agent 会话标识 */
  sessionId: string;
  /** 挑战失效时间（Unix ms） */
  expiresAt: number;
}

/**
 * 展示给页面真人的审批挑战。
 *
 * `args` 只应是 wire-safe 参数（例如记录 id、`{{p:…}}` 代号），不能把 executor
 * 还原后的敏感真值塞进来。`canApproveFromAgent` 固定为 false：Agent 只能看到
 * pending 状态，没有代批准工具。
 */
export interface SurfaceApprovalChallenge extends SurfaceApprovalBinding {
  description: string;
  args: Record<string, unknown>;
  canApproveFromAgent: false;
}

/**
 * 对外能力描述。
 *
 * 这是稳定 wire type，不直接把 core 的 `ActionView` 倒出去：内部字段可以演进，
 * 第三方实现只依赖这里的协议语义。
 */
export interface SurfaceCapability {
  id: string;
  description: string;
  /** 省略 = 这个能力没有输入参数 */
  inputSchema?: JsonSchema;
  effect: SurfaceEffect;
  /** 省略 = `none`（不需要额外确认） */
  approval?: SurfaceApproval;
  /** 与页面执行目标的保真度一致；`auto` / `low` 表示不是开发者直接背书 */
  fidelity?: Fidelity;
  /** 省略 = `declared`（开发者直接声明） */
  source?: "declared" | "derived";
  scopePath?: string[];
  /** 有它表示这一步必须由人完成 */
  handoff?: { reason: string };
  /** 复合动作的步数；模型据此知道一次调用可能包含多步 */
  flowSteps?: number;
  /** 目标此刻不在视口，但可按记录 id 引用并在执行前自动滚动 */
  offscreen?: true;
  /**
   * 这是一条「同类行内动作折叠后的模板」：调用时用 `input.record` 指定哪一行。
   *
   * `id` 是稳定模板 id（例如 `approve@order`），真实执行 id 由模板 + record 拼回，
   * 仍然经过同一套 executor、权限与可用性检查。
   */
  record?: {
    param: "record";
    /** 当前这一模板覆盖多少条可引用记录 */
    total: number;
    /** 其中多少条当前不在视口（执行前会自动滚动）；省略 = 0 */
    offscreen?: number;
  };
}

/** 页面上下文：只读、有界、可审计；不是 DOM，也不是整个 store */
export interface SurfaceContext {
  page?: PageView;
  regions: ScopeInfo[];
  records: SurfaceRecord[];
  /** 当前这一页行数据的窗口信息；只有分页 / 截断时出现 */
  recordWindow?: SurfaceRecordWindow;
  recordIds: string[];
  recordIdsTotal: number;
  state: Record<string, unknown>;
  feedback: SurfaceFeedback[];
  unavailable: UnavailableView[];
  recordsTotal: number;
  feedbackTotal: number;
  unavailableTotal: number;
}

/** 省略 `source` = 开发者直接声明；只有框架派生时才需要让模型知道。 */
export type SurfaceRecord = Omit<RecordView, "source"> & { source?: RecordView["source"] };
export type SurfaceFeedback = Omit<FeedbackView, "source"> & { source?: FeedbackView["source"] };

export interface SurfaceRecordWindow {
  offset: number;
  limit: number;
  returned: number;
  /** 当前活跃区域里的记录总数 */
  total: number;
  /** 下一页的 offset；没有更多时为 undefined */
  next?: number;
}

export interface SurfaceDescription {
  protocol: typeof SURFACE_PROTOCOL;
  /** 应用 / 站点标识（可选，由宿主提供） */
  app?: string;
  capabilities: SurfaceCapability[];
  /** true 表示能力清单与上一次 describe 相同，本次没有重复返回 */
  capabilitiesUnchanged?: true;
  /** 仅在 `capabilitiesUnchanged` 时出现，方便 Agent 知道清单总数 */
  capabilitiesTotal?: number;
  context: SurfaceContext;
}

export type SurfaceSessionErrorCode =
  | "SESSION_REQUIRED"
  | "SESSION_INVALID"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED";

export type SurfaceErrorCode =
  | "INVALID_REQUEST"
  | "PROTOCOL_VERSION_UNSUPPORTED"
  | "METHOD_NOT_SUPPORTED"
  | "CAPABILITY_NOT_EXPOSED"
  | "RATE_LIMITED"
  | "RATE_LIMIT_UNAVAILABLE"
  | "REPLAY_DETECTED"
  | "REPLAY_GUARD_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | SurfaceSessionErrorCode;

export interface SurfaceFailure {
  protocol: typeof SURFACE_PROTOCOL;
  /** 无法解析请求 id 时为空字符串；调用方仍可关联本地请求 */
  id: string;
  ok: false;
  error: {
    code: SurfaceErrorCode;
    message: string;
    /** 仅 RATE_LIMITED：建议等待多久再重试（毫秒） */
    retryAfterMs?: number;
  };
}

export interface SurfaceDescribeSuccess {
  protocol: typeof SURFACE_PROTOCOL;
  id: string;
  ok: true;
  result: SurfaceDescription;
}

export interface SurfaceInvokeSuccess {
  protocol: typeof SURFACE_PROTOCOL;
  id: string;
  ok: true;
  /** 业务执行结果：成功或结构化 ActionError 都从这里返回 */
  result: ExecResult;
  /**
   * 本次调用后的增量观察。
   *
   * 只在确有变化时出现：新出现的可调用能力、变更记录、状态视图。
   * Agent 不需要为了验证一次普通动作而重新 describe 整页。
   */
  after?: SurfaceObservation;
}

export interface SurfaceObservation {
  /** 本次新出现的可调用能力（已裁剪到 8 条；省略 = 没有新能力） */
  capabilities?: SurfaceCapability[];
  /** 因上限没有列出的新能力数量 */
  capabilitiesOmitted?: number;
  /** 本次新增 / 修改后的记录（最多 12 条） */
  records?: SurfaceRecord[];
  /** 因上限没有列出的记录数量 */
  recordsOmitted?: number;
  /** 状态视图确有变化时的当前值 */
  state?: Record<string, unknown>;
}

export type SurfaceResponse = SurfaceDescribeSuccess | SurfaceInvokeSuccess | SurfaceFailure;
