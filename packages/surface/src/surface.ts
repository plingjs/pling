import {
  foldedParams,
  modelActions,
  type ActionView,
  type Approval,
  type ExecResult,
  type FoldedAction,
  type Kind,
  type Registry,
  type Snapshot,
} from "@plingjs/core";
import {
  SURFACE_PROTOCOL,
  type SurfaceAuditEvent,
  type SurfaceAuditErrorHandler,
  type SurfaceAuditSink,
  type SurfaceCapability,
  type SurfaceDescribeInput,
  type SurfaceDescription,
  type SurfaceExecutionContext,
  type SurfaceExecutionResult,
  type SurfaceExpose,
  type SurfaceFailure,
  type SurfaceGuardSession,
  type SurfaceRateLimit,
  type SurfaceRateLimitDecision,
  type SurfaceRecord,
  type SurfaceRecordWindow,
  type SurfaceReplayOptions,
  type SurfaceResponse,
  type SurfaceSession,
  type SurfaceSessionErrorCode,
  type SurfaceSessionSource,
} from "./types";

/** 默认一页行数据。能力清单仍完整；字段数据按窗口读取，避免长列表每轮重复进入上下文。 */
export const DEFAULT_SURFACE_RECORD_LIMIT = 8;
/** 单次 describe 最多返回多少条带字段的记录（防止外部客户端用 limit 把桥撑爆）。 */
export const MAX_SURFACE_RECORD_LIMIT = 100;
const MAX_AFTER_CAPABILITIES = 8;
const MAX_AFTER_RECORDS = 12;

export interface SurfaceOptions {
  /** 页面能力注册表：与页面内 Agent 共用同一份声明 */
  registry: Registry;
  /**
   * 执行入口：必须传现有 executor（或等价实现）。
   *
   * Surface 不复制权限、确认、人工接力、期望与证据逻辑；它只负责协议边界。
   */
  execute(
    id: string,
    argsJson?: string,
    context?: SurfaceExecutionContext,
  ): Promise<SurfaceExecutionResult>;
  /** 应用 / 站点标识，可选 */
  app?: string;
  /**
   * 本次会话允许暴露的能力 id。
   *
   * 省略 = 暴露当前 registry 全部可用能力。接第三方 Agent 时应显式收敛；
   * 未列入的能力在 describe 中不可见，invoke 也会被协议层拒绝。
   */
  expose?: SurfaceExpose;
  /**
   * 已验证的 Agent 会话。
   *
   * 传函数时每次 describe / handle 都重新读取，适合处理过期与撤销。一旦提供此选项，
   * 解析不到会话或会话非法就 fail-closed；省略 = 开放模式，仅适合本地调试与向后兼容。
   * 身份验证必须发生在传输层 / 后端，这里的值不能来自未验证的客户端输入。
   */
  session?: SurfaceSessionSource;
  /** describe 默认返回多少条带字段的记录，默认 8；可用 describe({ limit }) 覆盖 */
  recordLimit?: number;
  /** 单次 describe 的记录上限，默认 100 */
  maxRecordLimit?: number;
  /**
   * 滑动窗口限流，按已验证会话隔离；省略 = 不限流。
   * 只约束 `handle()`，直接调用 `describe()` 不经过网络入口。
   */
  rateLimit?: SurfaceRateLimit;
  /**
   * 重复 request.id 防护；只作用于 invoke，默认关闭。
   * 同一会话内重复使用一个 id 会被拒绝，避免网络重放造成第二次业务副作用。
   */
  replay?: boolean | SurfaceReplayOptions;
  /** 审计出口：只接收身份 / 能力 / 结果元数据，不含参数与响应正文。 */
  onAudit?: SurfaceAuditSink;
  /**
   * 审计写入失败的通知口；省略时保持向后兼容，失败仍不影响协议结果。
   *
   * 生产环境应接日志 / 指标 / 告警，避免审计静默丢失。
   */
  onAuditError?: SurfaceAuditErrorHandler;
}

export interface AgentSurface {
  readonly protocol: typeof SURFACE_PROTOCOL;
  /**
   * 当前能力与上下文（只读；每次调用重新读取 registry 快照）。
   *
   * 配置了 `session` 时，会话无效会抛 `SurfaceSessionError`；生产传输应统一走 `handle`。
   */
  describe(input?: SurfaceDescribeInput): SurfaceDescription;
  /** 协议入口：永不抛异常，未知输入一律 fail-closed */
  handle(request: unknown): Promise<SurfaceResponse>;
}

/** 会话失败的结构化错误；`describe()` 直接调用时抛出，`handle()` 会转成协议失败。 */
export class SurfaceSessionError extends Error {
  constructor(
    readonly code: SurfaceSessionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SurfaceSessionError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function effectOf(kind: Kind): SurfaceCapability["effect"] {
  return kind === "danger" ? "destructive" : kind;
}

function approvalOf(approval: Approval): SurfaceCapability["approval"] {
  if (approval === "ask-always") return "always";
  return approval;
}

function capabilityOf(action: ActionView): SurfaceCapability {
  const inputSchema = hasInputSchema(action.params) ? action.params : undefined;
  return {
    id: action.id,
    description: action.description,
    ...(inputSchema ? { inputSchema } : {}),
    effect: effectOf(action.kind),
    ...(action.approval === "ask" || action.approval === "ask-always"
      ? { approval: approvalOf(action.approval) }
      : {}),
    ...(action.fidelity === "high" ? {} : { fidelity: action.fidelity }),
    ...(action.source === "derived" ? { source: action.source } : {}),
    ...(action.scopePath ? { scopePath: [...action.scopePath] } : {}),
    ...(action.handoff ? { handoff: { reason: action.handoff.reason } } : {}),
    ...(action.flowSteps === undefined ? {} : { flowSteps: action.flowSteps }),
    ...(action.offscreen ? { offscreen: true as const } : {}),
  };
}

function foldedCapabilityOf(id: string, folded: FoldedAction): SurfaceCapability {
  const inputSchema = foldedInputSchema(folded);
  return {
    id,
    description: folded.description,
    ...(inputSchema ? { inputSchema } : {}),
    effect: effectOf(folded.kind),
    ...(folded.approval === "ask" || folded.approval === "ask-always"
      ? { approval: approvalOf(folded.approval) }
      : {}),
    ...(folded.fidelity === "high" ? {} : { fidelity: folded.fidelity }),
    ...(folded.source === "derived" ? { source: folded.source } : {}),
    ...(folded.scopePath ? { scopePath: [...folded.scopePath] } : {}),
    ...(folded.handoff ? { handoff: { reason: folded.handoff.reason } } : {}),
    ...(folded.flowSteps === undefined ? {} : { flowSteps: folded.flowSteps }),
    record: {
      param: "record",
      total: folded.records.length,
      ...(folded.offscreen > 0 ? { offscreen: folded.offscreen } : {}),
    },
  };
}

function foldedInputSchema(folded: FoldedAction): SurfaceCapability["inputSchema"] {
  const base = foldedParams(folded);
  const { record: _record, ...properties } = base.properties ?? {};
  const required = (base.required ?? []).filter((key) => key !== "record");
  const schema = {
    ...base,
    ...(Object.keys(properties).length > 0 ? { properties } : { properties: undefined }),
    ...(required.length > 0 ? { required } : { required: undefined }),
  };
  return hasInputSchema(schema) ? schema : undefined;
}

function hasInputSchema(schema: SurfaceCapability["inputSchema"]): boolean {
  if (!schema) return false;
  if (schema.required?.length) return true;
  return Object.keys(schema.properties ?? {}).length > 0;
}

function surfaceRecordOf(record: Snapshot["records"][number]): SurfaceRecord {
  const { source, ...value } = record;
  return {
    ...value,
    fields: { ...value.fields },
    ...(source === "derived" ? { source } : {}),
  };
}

function contextOf(snapshot: Snapshot, recordWindow?: SurfaceRecordWindow): SurfaceDescription["context"] {
  return {
    ...(snapshot.page ? { page: snapshot.page } : {}),
    regions: snapshot.scopes.map((scope) => ({ ...scope, explore: [...scope.explore] })),
    records: snapshot.records.map(surfaceRecordOf),
    ...(recordWindow ? { recordWindow } : {}),
    recordIds: [...snapshot.recordIds],
    recordIdsTotal: snapshot.recordIdsTotal,
    state: { ...snapshot.state },
    feedback: snapshot.feedback.map(({ source, ...item }) => ({
      ...item,
      ...(source === "aria" ? { source } : {}),
    })),
    unavailable: snapshot.unavailable.map((item) => ({ ...item })),
    recordsTotal: snapshot.recordsTotal,
    feedbackTotal: snapshot.feedbackTotal,
    unavailableTotal: snapshot.unavailableTotal,
  };
}

function failure(
  id: string,
  code: SurfaceFailure["error"]["code"],
  message: string,
  extra?: { retryAfterMs?: number },
): SurfaceFailure {
  return {
    protocol: SURFACE_PROTOCOL,
    id,
    ok: false,
    error: { code, message, ...extra },
  };
}

function clampLimit(value: number, min: number, max: number): number {
  const normalized = Number.isFinite(value) ? Math.floor(value) : min;
  return Math.min(max, Math.max(min, normalized));
}

function parseDescribeInput(
  raw: unknown,
  maxRecordLimit: number,
): { value: SurfaceDescribeInput; error?: never } | { error: string; value?: never } {
  if (raw === undefined) return { value: {} };
  if (!isRecord(raw)) return { error: "describe.input 必须是对象" };
  const unknown = Object.keys(raw).filter((key) => !["record", "offset", "limit", "capabilities"].includes(key));
  if (unknown.length > 0) return { error: `describe.input 不支持的字段：${unknown.join("、")}` };

  let record: string | readonly string[] | undefined;
  if (raw.record !== undefined) {
    if (typeof raw.record === "string") {
      const id = raw.record.trim();
      if (!id) return { error: "describe.input.record 必须是非空字符串或非空数组" };
      record = id;
    } else if (Array.isArray(raw.record)) {
      if (raw.record.length === 0 || raw.record.length > 20) {
        return { error: "describe.input.record 数组必须包含 1–20 个记录 id" };
      }
      const ids: string[] = [];
      for (const item of raw.record) {
        if (typeof item !== "string" || !item.trim()) {
          return { error: "describe.input.record 数组里的每一项都必须是非空字符串" };
        }
        ids.push(item.trim());
      }
      record = ids;
    } else {
      return { error: "describe.input.record 必须是字符串或字符串数组" };
    }
  }

  const readCount = (key: "offset" | "limit"): number | undefined | string => {
    const value = raw[key];
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return `describe.input.${key} 必须是非负整数`;
    }
    return value;
  };
  const offset = readCount("offset");
  if (typeof offset === "string") return { error: offset };
  const limit = readCount("limit");
  if (typeof limit === "string") return { error: limit };
  if (record && (offset !== undefined || limit !== undefined)) {
    return { error: "describe.input.record 不能与 offset / limit 同时使用" };
  }

  if (raw.capabilities !== undefined && raw.capabilities !== "full" && raw.capabilities !== "changed") {
    return { error: "describe.input.capabilities 必须是 full 或 changed" };
  }

  return {
    value: {
      ...(record === undefined ? {} : { record }),
      ...(offset === undefined ? {} : { offset }),
      ...(limit === undefined ? {} : { limit: clampLimit(limit, 0, maxRecordLimit) }),
      ...(raw.capabilities === undefined ? {} : { capabilities: raw.capabilities }),
    },
  };
}

function stateHint(state: Record<string, unknown>): string {
  if (Object.keys(state).length === 0) return "";
  const text = JSON.stringify(state);
  return `当前状态：${text.length > 240 ? `${text.slice(0, 240)}…` : text}。`;
}

function unavailableFor(
  capability: string,
  projections: readonly { capability: SurfaceCapability }[],
  state: Record<string, unknown>,
): string {
  const colon = capability.lastIndexOf(":");
  const family = colon > 0 ? capability.slice(0, colon) : capability;
  const available = projections
    .map((entry) => entry.capability.id)
    .filter((id) => id !== capability && (id.startsWith(`${family}:`) || id.startsWith(`${family}@`)))
    .slice(0, 6);
  const alternatives = available.length > 0 ? `当前可用同族能力：${available.join("、")}。` : "";
  return (
    `能力不在当前暴露范围：${capability}。` +
    `${stateHint(state)}${alternatives}` +
    "先 describe 查看当前清单；如果目标被筛选或弹窗挡住，先恢复正常状态或完成前置步骤。"
  );
}

function changedRecordIds(result: ExecResult): string[] {
  if (!("result" in result)) return [];
  const changed = (result.result as {
    changed?: { records?: { added?: string[]; updated?: Array<{ id?: string }> } };
  })?.changed;
  const ids = [
    ...(changed?.records?.added ?? []),
    ...(changed?.records?.updated ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)),
  ];
  return [...new Set(ids)];
}

function capabilitySignature(capabilities: readonly SurfaceCapability[]): string {
  return JSON.stringify(
    capabilities.map(({ record, inputSchema, ...capability }) => ({
      ...capability,
      ...(inputSchema ? { inputSchema } : {}),
      ...(record ? { record: { param: record.param } } : {}),
    })),
  );
}

type CompiledScope =
  | null
  | { kind: "ids"; exact: ReadonlySet<string>; prefixes: readonly string[] }
  | { kind: "check"; check: (id: string) => boolean };

function compileScope(scope: SurfaceExpose | undefined): CompiledScope {
  if (scope === undefined) return null;
  if (typeof scope === "function") return { kind: "check", check: scope };

  const exact = new Set<string>();
  const prefixes = new Set<string>();
  for (const raw of scope) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const id = raw.trim();
    exact.add(id);
    // `approve@order` 是折叠模板的公开 id；数组里写它时，允许这一族的具体行内 id。
    if (id.endsWith(":") || id.endsWith("@")) {
      prefixes.add(id);
    } else {
      prefixes.add(`${id}:`);
      prefixes.add(`${id}@`);
    }
  }
  return { kind: "ids", exact, prefixes: [...prefixes] };
}

function scopeAllows(scope: CompiledScope, id: string): boolean {
  if (scope === null) return true;
  if (scope.kind === "check") {
    try {
      return scope.check(id) === true;
    } catch {
      return false;
    }
  }
  if (scope.exact.has(id)) return true;
  return scope.prefixes.some((prefix) => id.startsWith(prefix) && id.length > prefix.length);
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function validateSession(raw: unknown, now: number): SurfaceSession {
  if (!isRecord(raw)) {
    throw new SurfaceSessionError("SESSION_INVALID", "会话格式无效");
  }

  const agentId = nonEmpty(raw.agentId);
  const sessionId = nonEmpty(raw.sessionId);
  const userId = nonEmpty(raw.userId);
  if (!agentId || !sessionId || !userId) {
    throw new SurfaceSessionError("SESSION_INVALID", "会话缺少 agentId / sessionId / userId");
  }
  if (typeof raw.expiresAt !== "number" || !Number.isFinite(raw.expiresAt)) {
    throw new SurfaceSessionError("SESSION_INVALID", "会话缺少有效的 expiresAt");
  }
  if (raw.revokedAt !== undefined && (typeof raw.revokedAt !== "number" || !Number.isFinite(raw.revokedAt))) {
    throw new SurfaceSessionError("SESSION_INVALID", "会话的 revokedAt 无效");
  }
  if (raw.expiresAt <= now) {
    throw new SurfaceSessionError("SESSION_EXPIRED", "会话已过期");
  }
  if (typeof raw.revokedAt === "number" && raw.revokedAt <= now) {
    throw new SurfaceSessionError("SESSION_REVOKED", "会话已撤销");
  }

  let scope: SurfaceExpose;
  if (typeof raw.scope === "function") {
    scope = raw.scope as (id: string) => boolean;
  } else if (Array.isArray(raw.scope)) {
    const ids: string[] = [];
    for (const item of raw.scope) {
      const id = nonEmpty(item);
      if (!id) throw new SurfaceSessionError("SESSION_INVALID", "会话 scope 必须是能力 id 数组");
      ids.push(id);
    }
    scope = ids;
  } else {
    throw new SurfaceSessionError("SESSION_INVALID", "会话缺少明确的 scope");
  }

  const delegationId = raw.delegationId === undefined ? undefined : nonEmpty(raw.delegationId);
  if (raw.delegationId !== undefined && !delegationId) {
    throw new SurfaceSessionError("SESSION_INVALID", "会话的 delegationId 无效");
  }

  return {
    agentId,
    sessionId,
    userId,
    expiresAt: raw.expiresAt,
    scope,
    ...(delegationId ? { delegationId } : {}),
    ...(typeof raw.revokedAt === "number" ? { revokedAt: raw.revokedAt } : {}),
  };
}

let nextScopeIdentity = 0;
const scopeIdentities = new WeakMap<(id: string) => boolean, number>();

function scopeIdentity(scope: SurfaceExpose): string {
  if (Array.isArray(scope)) return `ids:${JSON.stringify(scope)}`;
  let id = scopeIdentities.get(scope as (id: string) => boolean);
  if (id === undefined) {
    nextScopeIdentity += 1;
    id = nextScopeIdentity;
    scopeIdentities.set(scope as (id: string) => boolean, id);
  }
  return `fn:${id}`;
}

function sessionCacheKey(session: SurfaceSession | null): string {
  if (!session) return "\u0000open";
  // 不只看 sessionId：同一 id 换了用户、scope、有效期或委托记录时，增量缓存也必须重置。
  return [
    session.agentId,
    session.sessionId,
    session.userId,
    session.expiresAt,
    session.revokedAt ?? "",
    session.delegationId ?? "",
    scopeIdentity(session.scope),
  ].join("\u0000");
}

const DEFAULT_REPLAY_WINDOW_MS = 5 * 60_000;
const MAX_REPLAY_ENTRIES = 1_000;

/** 闸门只拿稳定绑定：token 刷新导致 expiresAt 变化时，仍属于同一委托会话。 */
function guardSessionOf(session: SurfaceSession | null): SurfaceGuardSession | null {
  return session
    ? {
        agentId: session.agentId,
        sessionId: session.sessionId,
        userId: session.userId,
      }
    : null;
}

function sessionBindingKey(session: SurfaceGuardSession | null): string {
  return session ? [session.agentId, session.sessionId, session.userId].join("\u0000") : "\u0000open";
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`createSurface: ${name} 必须是正整数`);
  }
  return value;
}

function normalizeRateLimit(options: SurfaceRateLimit | undefined): SurfaceRateLimit | null {
  if (!options) return null;
  return {
    maxRequests: positiveInteger(options.maxRequests, "rateLimit.maxRequests"),
    windowMs: positiveInteger(options.windowMs, "rateLimit.windowMs"),
    ...(options.limiter === undefined ? {} : { limiter: options.limiter }),
  };
}

function normalizeReplayWindow(options: SurfaceOptions["replay"]): number | null {
  if (options === undefined || options === false) return null;
  if (options === true) return DEFAULT_REPLAY_WINDOW_MS;
  return positiveInteger(options.windowMs ?? DEFAULT_REPLAY_WINDOW_MS, "replay.windowMs");
}

function safeAudit(
  sink: SurfaceAuditSink | undefined,
  onError: SurfaceAuditErrorHandler | undefined,
  event: SurfaceAuditEvent,
): void {
  if (!sink) return;
  const report = (error: unknown): void => {
    if (!onError) return;
    try {
      void Promise.resolve(onError(error, event)).catch(() => undefined);
    } catch {
      // 错误处理本身失败也不能改变协议结果。
    }
  };
  try {
    void Promise.resolve(sink(event)).catch(report);
  } catch (error) {
    report(error);
  }
}

interface AuditDraft {
  requestId: string;
  method: SurfaceAuditEvent["method"];
  agentId?: string;
  sessionId?: string;
  userId?: string;
  delegationId?: string;
  approvalId?: string;
  capability?: string;
  record?: string;
}

function auditResult(response: SurfaceResponse): Pick<SurfaceAuditEvent, "outcome" | "code"> {
  if (!response.ok) {
    return {
      outcome: response.error.code === "INTERNAL_ERROR" ? "failed" : "denied",
      code: response.error.code,
    };
  }
  if (isRecord(response.result) && isRecord(response.result.error)) {
    const code = response.result.error.code;
    return { outcome: "business_error", ...(typeof code === "string" ? { code } : {}) };
  }
  return { outcome: "completed" };
}

export function createSurface(options: SurfaceOptions): AgentSurface {
  const { registry, execute } = options;
  const defaultRecordLimit = clampLimit(
    options.recordLimit ?? DEFAULT_SURFACE_RECORD_LIMIT,
    0,
    MAX_SURFACE_RECORD_LIMIT,
  );
  const maxRecordLimit = clampLimit(options.maxRecordLimit ?? MAX_SURFACE_RECORD_LIMIT, 1, MAX_SURFACE_RECORD_LIMIT);
  const rateLimit = normalizeRateLimit(options.rateLimit);
  const replayOptions = options.replay && options.replay !== true ? options.replay : null;
  const replayWindowMs = normalizeReplayWindow(options.replay);
  const rateHits = new Map<string, number[]>();
  const replaySeen = new Map<string, number>();
  /** 这一页会话里已经告诉过 Agent 的能力；invoke 只补“新出现的”，不重复整张菜单。 */
  let seenCapabilities = new Set<string>();
  /** 上一次返回给这个会话的能力清单；`changed` 模式据此只发增量信号。 */
  let lastCapabilitySignature: string | null = null;
  let stateSessionKey = sessionCacheKey(null);
  const globalScope = compileScope(options.expose);
  const hasSessionSource = options.session !== undefined;

  const resolveSession = (): SurfaceSession | null => {
    if (!hasSessionSource) return null;
    let raw: unknown;
    try {
      raw = typeof options.session === "function" ? options.session() : options.session;
    } catch {
      throw new SurfaceSessionError("SESSION_INVALID", "无法解析会话");
    }
    if (raw === null || raw === undefined) {
      throw new SurfaceSessionError("SESSION_REQUIRED", "本能力面要求已验证会话");
    }
    return validateSession(raw, Date.now());
  };

  const alignSessionState = (session: SurfaceSession | null): void => {
    const key = sessionCacheKey(session);
    if (key === stateSessionKey) return;
    stateSessionKey = key;
    seenCapabilities = new Set<string>();
    lastCapabilitySignature = null;
  };

  const takeRateLimit = async (
    session: SurfaceSession | null,
    now: number,
  ): Promise<
    | { state: "allowed" }
    | { state: "limited"; retryAfterMs: number }
    | { state: "unavailable" }
  > => {
    if (!rateLimit) return { state: "allowed" };
    const binding = guardSessionOf(session);

    if (rateLimit.limiter) {
      let decision: SurfaceRateLimitDecision;
      try {
        decision = await rateLimit.limiter.consume({
          session: binding,
          maxRequests: rateLimit.maxRequests,
          windowMs: rateLimit.windowMs,
          now,
        });
      } catch {
        return { state: "unavailable" };
      }
      if (!decision || typeof decision.allowed !== "boolean") return { state: "unavailable" };
      if (decision.allowed) return { state: "allowed" };
      if (typeof decision.retryAfterMs !== "number" || !Number.isFinite(decision.retryAfterMs) || decision.retryAfterMs < 0) {
        return { state: "unavailable" };
      }
      return { state: "limited", retryAfterMs: Math.ceil(decision.retryAfterMs) };
    }

    const key = sessionBindingKey(binding);
    const recent = (rateHits.get(key) ?? []).filter((at) => now - at < rateLimit.windowMs);
    if (recent.length >= rateLimit.maxRequests) {
      rateHits.set(key, recent);
      return {
        state: "limited",
        retryAfterMs: Math.max(0, rateLimit.windowMs - (now - recent[0]!)),
      };
    }
    recent.push(now);
    rateHits.set(key, recent);
    return { state: "allowed" };
  };

  const reserveReplay = async (
    session: SurfaceSession | null,
    requestId: string,
    now: number,
  ): Promise<"allowed" | "replayed" | "unavailable"> => {
    if (replayWindowMs === null) return "allowed";
    const binding = guardSessionOf(session);

    if (replayOptions?.guard) {
      try {
        const reserved = await replayOptions.guard.reserve({
          session: binding,
          requestId,
          windowMs: replayWindowMs,
          now,
        });
        return typeof reserved === "boolean" ? (reserved ? "allowed" : "replayed") : "unavailable";
      } catch {
        return "unavailable";
      }
    }

    for (const [key, at] of replaySeen) {
      if (now - at >= replayWindowMs) replaySeen.delete(key);
    }
    const key = `${sessionBindingKey(binding)}\u0000${requestId}`;
    const seenAt = replaySeen.get(key);
    if (seenAt !== undefined && now - seenAt < replayWindowMs) return "replayed";
    replaySeen.delete(key);
    replaySeen.set(key, now);
    while (replaySeen.size > MAX_REPLAY_ENTRIES) {
      const oldest = replaySeen.keys().next().value;
      if (oldest === undefined) break;
      replaySeen.delete(oldest);
    }
    return "allowed";
  };

  const isExposed = (id: string, sessionScope: CompiledScope): boolean =>
    scopeAllows(globalScope, id) && scopeAllows(sessionScope, id);

  interface Projection {
    capability: SurfaceCapability;
    folded?: FoldedAction;
  }

  const project = (snapshot: Snapshot, sessionScope: CompiledScope): Projection[] => {
    // 先按暴露范围裁掉元素级动作，再折叠。否则 allowlist 会先被模板收走，
    // 出现「只暴露了一行，却把整类动作都带出去」的越界。
    const visible: Snapshot = {
      ...snapshot,
      actions: snapshot.actions.filter((action) => isExposed(action.id, sessionScope)),
      offscreenRecordActions: snapshot.offscreenRecordActions.filter((action) => isExposed(action.id, sessionScope)),
    };
    const used = new Set<string>();
    const out: Projection[] = [];
    for (const item of modelActions(visible)) {
      if (item.type === "fold") {
        const folded = item.folded;
        let id = folded.template.replace(/[:@]$/, "");
        if (used.has(id)) id = folded.template;
        used.add(id);
        out.push({ capability: foldedCapabilityOf(id, folded), folded });
        continue;
      }
      const action = item.action;
      if (used.has(action.id)) continue;
      used.add(action.id);
      out.push({ capability: capabilityOf(action) });
    }
    return out;
  };

  const describeValue = (
    input: SurfaceDescribeInput,
    session: SurfaceSession | null,
  ): SurfaceDescription => {
    alignSessionState(session);
    const sessionScope = session ? compileScope(session.scope) : null;
    const requestedLimit = clampLimit(input.limit ?? defaultRecordLimit, 0, maxRecordLimit);
    const recordIds = typeof input.record === "string" ? [input.record] : input.record ? [...input.record] : undefined;
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const snapshot = recordIds
      ? registry.snapshot({ recordIds })
      : registry.snapshot({ recordOffset: offset, recordLimit: requestedLimit });
    const next = recordIds ? undefined : offset + snapshot.records.length < snapshot.recordsTotal
      ? offset + snapshot.records.length
      : undefined;
    const recordWindow: SurfaceRecordWindow | undefined =
      recordIds || offset > 0 || next !== undefined
        ? {
            offset: recordIds ? 0 : offset,
            limit: recordIds ? recordIds.length : requestedLimit,
            returned: snapshot.records.length,
            total: snapshot.recordsTotal,
            ...(next === undefined ? {} : { next }),
          }
        : undefined;
    const capabilities = project(snapshot, sessionScope).map((entry) => entry.capability);
    for (const capability of capabilities) seenCapabilities.add(capability.id);
    const capabilitiesUnchanged =
      input.capabilities === "changed" && lastCapabilitySignature === capabilitySignature(capabilities);
    if (!capabilitiesUnchanged) lastCapabilitySignature = capabilitySignature(capabilities);
    return {
      protocol: SURFACE_PROTOCOL,
      ...(options.app?.trim() ? { app: options.app.trim() } : {}),
      capabilities: capabilitiesUnchanged ? [] : capabilities,
      ...(capabilitiesUnchanged
        ? { capabilitiesUnchanged: true as const, capabilitiesTotal: capabilities.length }
        : {}),
      context: contextOf(snapshot, recordWindow),
    };
  };

  const describe = (input: SurfaceDescribeInput = {}): SurfaceDescription =>
    describeValue(input, resolveSession());

  const handleCore = async (request: unknown, audit: AuditDraft): Promise<SurfaceResponse> => {
    if (!isRecord(request)) {
      return failure("", "INVALID_REQUEST", "请求必须是对象");
    }

    const id = typeof request.id === "string" ? request.id : "";
    audit.requestId = id;
    audit.method = request.method === "describe" || request.method === "invoke" ? request.method : "unknown";
    if (typeof request.id !== "string" || !request.id.trim()) {
      return failure(id, "INVALID_REQUEST", "请求缺少非空 id");
    }
    if (typeof request.protocol !== "string") {
      return failure(id, "INVALID_REQUEST", "请求缺少 protocol");
    }
    if (request.protocol !== SURFACE_PROTOCOL) {
      return failure(
        id,
        "PROTOCOL_VERSION_UNSUPPORTED",
        `不支持的协议版本：${request.protocol}；当前为 ${SURFACE_PROTOCOL}`,
      );
    }
    let session: SurfaceSession | null;
    try {
      session = resolveSession();
    } catch (error) {
      if (error instanceof SurfaceSessionError) return failure(id, error.code, error.message);
      return failure(id, "SESSION_INVALID", "会话校验失败");
    }
    if (session) {
      audit.agentId = session.agentId;
      audit.sessionId = session.sessionId;
      audit.userId = session.userId;
      if (session.delegationId) audit.delegationId = session.delegationId;
    }
    const limit = await takeRateLimit(session, Date.now());
    if (limit.state === "unavailable") {
      return failure(
        id,
        "RATE_LIMIT_UNAVAILABLE",
        "本会话限流服务暂时不可用；写操作已按 fail-closed 拒绝，请稍后重试",
      );
    }
    if (limit.state === "limited") {
      return failure(
        id,
        "RATE_LIMITED",
        `本会话请求过于频繁；请在约 ${limit.retryAfterMs}ms 后重试`,
        { retryAfterMs: limit.retryAfterMs },
      );
    }
    alignSessionState(session);
    const sessionScope = session ? compileScope(session.scope) : null;
    if (request.method === "describe") {
      const parsed = parseDescribeInput(request.input, maxRecordLimit);
      if (parsed.error) return failure(id, "INVALID_REQUEST", parsed.error);
      return { protocol: SURFACE_PROTOCOL, id, ok: true, result: describeValue(parsed.value ?? {}, session) };
    }
    if (request.method !== "invoke") {
      return failure(id, "METHOD_NOT_SUPPORTED", `不支持的方法：${String(request.method)}`);
    }
    if (typeof request.capability !== "string" || !request.capability.trim()) {
      return failure(id, "INVALID_REQUEST", "invoke 缺少非空 capability");
    }
    if (request.input !== undefined && !isRecord(request.input)) {
      return failure(id, "INVALID_REQUEST", "invoke.input 必须是对象");
    }

    const capability = request.capability.trim();
    audit.capability = capability;
    const currentSnapshot = registry.snapshot({ recordLimit: 0 });
    const projections = project(currentSnapshot, sessionScope);
    const beforeCapabilities = new Set(projections.map((entry) => entry.capability.id));
    const projection = projections.find((entry) => entry.capability.id === capability);
    if (!projection) {
      return failure(
        id,
        "CAPABILITY_NOT_EXPOSED",
        unavailableFor(capability, projections, currentSnapshot.state),
      );
    }

    let actionId = capability;
    const input = { ...(request.input ?? {}) };
    if (projection.folded) {
      const record = typeof input.record === "string" ? input.record.trim() : "";
      if (!record || !projection.folded.records.includes(record)) {
        return failure(
          id,
          "INVALID_REQUEST",
          `invoke.input.record 必须是当前可引用记录 id。${capability} 当前可用记录：${
            projection.folded.records.slice(0, 8).join("、") || "（无）"
          }${projection.folded.records.length > 8 ? ` 等 ${projection.folded.records.length} 条` : ""}。${stateHint(
            currentSnapshot.state,
          )}如果目标被筛选掉，请先把状态筛选恢复为 all 并清空搜索，再重试；不要用其他记录代替，也不要停在反问。`,
        );
      }
      actionId = `${projection.folded.template}${record}`;
      audit.record = record;
      if (!isExposed(actionId, sessionScope)) {
        return failure(id, "CAPABILITY_NOT_EXPOSED", `目标记录不在本次暴露范围：${actionId}`);
      }
      delete input.record;
    }

    const replay = await reserveReplay(session, id, Date.now());
    if (replay === "unavailable") {
      return failure(
        id,
        "REPLAY_GUARD_UNAVAILABLE",
        "防重放服务暂时不可用；本次操作已按 fail-closed 拒绝，请稍后重试",
      );
    }
    if (replay === "replayed") {
      return failure(
        id,
        "REPLAY_DETECTED",
        "同一会话的 request.id 已使用过；请为新调用生成新的 id，不要重放旧请求",
      );
    }

    try {
      const execution = await execute(actionId, JSON.stringify(input), {
        requestId: id,
        capability,
        ...(audit.record ? { record: audit.record } : {}),
        session: guardSessionOf(session),
      });
      const approvalId = execution.approval?.id?.trim();
      if (approvalId) audit.approvalId = approvalId;
      /** 审批证据只给审计；外部 Agent 的响应里不出现 challenge / receipt id。 */
      const result: ExecResult = approvalId
        ? "result" in execution
          ? { result: execution.result }
          : { error: execution.error }
        : execution;
      const afterSnapshot = registry.snapshot({ recordLimit: 0 });
      const afterProjections = project(afterSnapshot, sessionScope);
      const addedCapabilities = afterProjections
        .filter((entry) => !beforeCapabilities.has(entry.capability.id) && !seenCapabilities.has(entry.capability.id))
        .map((entry) => entry.capability);
      for (const entry of afterProjections) seenCapabilities.add(entry.capability.id);

      const ids = changedRecordIds(result);
      const shownIds = ids.slice(0, MAX_AFTER_RECORDS);
      const records = shownIds.length > 0
        ? registry.snapshot({ recordIds: shownIds }).records.map(surfaceRecordOf)
        : [];
      const stateChanged = JSON.stringify(currentSnapshot.state) !== JSON.stringify(afterSnapshot.state);
      const shownCapabilities = addedCapabilities.slice(0, MAX_AFTER_CAPABILITIES);
      const after = {
        ...(shownCapabilities.length > 0 ? { capabilities: shownCapabilities } : {}),
        ...(addedCapabilities.length > shownCapabilities.length
          ? { capabilitiesOmitted: addedCapabilities.length - shownCapabilities.length }
          : {}),
        ...(records.length > 0 ? { records } : {}),
        ...(ids.length > records.length ? { recordsOmitted: ids.length - records.length } : {}),
        ...(stateChanged ? { state: { ...afterSnapshot.state } } : {}),
      };
      return {
        protocol: SURFACE_PROTOCOL,
        id,
        ok: true,
        result,
        ...(Object.keys(after).length > 0 ? { after } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failure(id, "INTERNAL_ERROR", `Surface 执行异常：${message}`);
    }
  };

  const handle = async (request: unknown): Promise<SurfaceResponse> => {
    const started = Date.now();
    const audit: AuditDraft = { requestId: "", method: "unknown" };
    let response: SurfaceResponse;
    try {
      response = await handleCore(request, audit);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      response = failure(audit.requestId, "INTERNAL_ERROR", `Surface 处理异常：${message}`);
    }

    const result = auditResult(response);
    safeAudit(options.onAudit, options.onAuditError, {
      protocol: SURFACE_PROTOCOL,
      at: new Date().toISOString(),
      requestId: audit.requestId,
      method: audit.method,
      ...(audit.agentId ? { agentId: audit.agentId } : {}),
      ...(audit.sessionId ? { sessionId: audit.sessionId } : {}),
      ...(audit.userId ? { userId: audit.userId } : {}),
      ...(audit.delegationId ? { delegationId: audit.delegationId } : {}),
      ...(audit.approvalId ? { approvalId: audit.approvalId } : {}),
      ...(audit.capability ? { capability: audit.capability } : {}),
      ...(audit.record ? { record: audit.record } : {}),
      ...result,
      durationMs: Date.now() - started,
    });

    return response;
  };

  return { protocol: SURFACE_PROTOCOL, describe, handle };
}
