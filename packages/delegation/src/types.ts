/** 委托 token 的公开前缀。便于日志 / 代理识别，不代表 token 可被解码。 */
export const DELEGATION_TOKEN_PREFIX = "plg_dlg_" as const;

/** 已由企业身份服务验证的当前用户；只包含构造 Session 所需的最小信息。 */
export interface DelegationSessionView {
  userId: string;
  expiresAt: number;
}

/**
 * 委托凭证的安全视图。
 *
 * 这张对象可以进入浏览器、审计元数据和 `SurfaceSession`，但**永远不包含 token**。
 */
export interface DelegationCredentialView {
  credentialId: string;
  delegationId: string;
  sessionId: string;
  userId: string;
  agentId: string;
  scope: string[];
  issuedAt: number;
  expiresAt: number;
  revokedAt?: number;
}

/** 签发 / 轮换时唯一一次返回 token 的结果。 */
export interface IssuedDelegation extends DelegationCredentialView {
  token: string;
}

export type DelegationEventReason = "revoked" | "rotated";

/** 失效广播只含关联 id、原因与时间，不含 token、哈希或业务参数。 */
export interface DelegationInvalidationEvent {
  type: "credential_revoked";
  reason: DelegationEventReason;
  at: number;
  credentialId: string;
  delegationId: string;
  sessionId: string;
  userId: string;
  agentId: string;
  replacedBy?: string;
}

export type DelegationEventState = "connecting" | "open" | "reconnecting" | "closed" | "unavailable";

export interface DelegationEventConnection {
  close(): void;
}

export interface IssueDelegationInput {
  userId: string;
  agentId: string;
  /** 能力 id；实现必须去重并保持首次出现顺序后再持久化。 */
  scope: readonly string[];
  ttlMs?: number;
}

export interface IntrospectDelegationInput {
  token: string;
}

export interface RefreshDelegationInput {
  token: string;
  userId: string;
}

export interface RevokeDelegationInput {
  token: string;
  userId: string;
}

export type DelegationAwaitable<T> = T | Promise<T>;

/**
 * 凭证生命周期 port。
 *
 * 生产实现应把 token 哈希、scope、过期与撤销状态放进数据库事务存储。接口刻意保持
 * 很小，企业可以用 Postgres / MySQL / Redis 替换内存适配器，而不改页面或 Surface。
 */
export interface DelegationStore {
  issue(input: IssueDelegationInput): DelegationAwaitable<IssuedDelegation>;
  introspect(input: IntrospectDelegationInput): DelegationAwaitable<DelegationCredentialView>;
  refresh(input: RefreshDelegationInput): DelegationAwaitable<IssuedDelegation>;
  revoke(input: RevokeDelegationInput): DelegationAwaitable<DelegationCredentialView>;
}

/**
 * 撤销广播 port。
 *
 * 单实例可用内存实现；多实例应换成 Redis Pub/Sub、NATS、Kafka 或数据库 outbox。
 * `subscribe` 必须按 userId 隔离，`publish` 必须先做事件字段白名单规整。
 */
export interface DelegationEventBus {
  subscribe(userId: string, listener: (event: DelegationInvalidationEvent) => void): () => void;
  /** 允许同步或异步实现；生产 outbox / Redis 适配器通常返回 Promise。 */
  publish(event: DelegationInvalidationEvent): DelegationAwaitable<void>;
  close(): void;
}

/** 身份适配器写入响应 Cookie 的出口；框架不拥有企业的登录 / SSO 实现。 */
export interface DelegationIdentityContext {
  readonly request: Request;
  setCookie(value: string): void;
}

/**
 * 身份 port。
 *
 * 企业在这里接真实 Cookie / JWT / SSO / session service。`resolve` 返回 `null`
 * 表示未登录；不要返回伪造的演示用户。
 */
export interface DelegationIdentity {
  resolve(context: DelegationIdentityContext): Promise<DelegationSessionView | null>;
}

export interface DelegationHandlerOptions {
  store: DelegationStore;
  events: DelegationEventBus;
  identity: DelegationIdentity;
  /** 端点根路径，默认 `/delegation` */
  basePath?: string;
  /** 健康检查与响应里的实例标识，默认 `local` */
  instanceId?: string;
  now?: () => number;
  /** SSE 心跳间隔，默认 15000ms；0 关闭 */
  heartbeatMs?: number;
  /** POST JSON 请求体上限，默认 32KB */
  maxBodyBytes?: number;
}

export interface DelegationHandler {
  handle(request: Request): Promise<Response>;
}

