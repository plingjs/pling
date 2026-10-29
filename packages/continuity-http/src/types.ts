import type {
  ClaimTaskInput,
  CompareAndSwapInput,
  ContinuityChange,
  ContinuityTaskSummary,
  CreateTaskInput,
  LeaseGrant,
  ReleaseLeaseInput,
  RenewLeaseInput,
  ResidencyEnvelope,
} from "@plingjs/agent";

export type Awaitable<T> = T | Promise<T>;

export type ContinuityCreateInput = CreateTaskInput;
export type ContinuityClaimInput = Omit<ClaimTaskInput, "sessionId">;
export type ContinuityRenewInput = Omit<RenewLeaseInput, "sessionId">;
export type ContinuityReleaseInput = Omit<ReleaseLeaseInput, "sessionId">;
export type ContinuityCasInput = Omit<CompareAndSwapInput, "sessionId">;

/**
 * 服务端 continuity port。
 *
 * `userId` 必须来自已经验证的登录会话；它不是客户端请求参数。
 * 实现可以使用同步内存结构，也可以返回 Promise（Postgres / D1 / 其他事务存储）。
 */
export interface ContinuityBackend {
  list(userId: string): Awaitable<ContinuityTaskSummary[]>;
  read(userId: string, sessionId: string): Awaitable<ResidencyEnvelope | null>;
  create(userId: string, input: ContinuityCreateInput): Awaitable<LeaseGrant>;
  claim(userId: string, sessionId: string, input: ContinuityClaimInput): Awaitable<LeaseGrant>;
  renew(userId: string, sessionId: string, input: ContinuityRenewInput): Awaitable<LeaseGrant>;
  release(userId: string, sessionId: string, input: ContinuityReleaseInput): Awaitable<boolean>;
  compareAndSwap(
    userId: string,
    sessionId: string,
    input: ContinuityCasInput,
  ): Awaitable<ResidencyEnvelope>;
  remove(userId: string, sessionId: string, input: ContinuityReleaseInput): Awaitable<boolean>;
  /** 通知只是加速器；权限判断永远来自 read / renew / compareAndSwap。 */
  subscribe?(userId: string, listener: (change: ContinuityChange) => void): () => void;
}

export interface ContinuityRequestIdentity {
  userId: string;
  expiresAt?: number;
}

export interface ContinuityIdentityInput {
  request: Request;
  /** 在响应上追加 Set-Cookie。 */
  setCookie(value: string): void;
}

export interface ContinuityIdentity {
  resolve(
    input: ContinuityIdentityInput,
  ): Awaitable<ContinuityRequestIdentity | null>;
}

export interface ContinuityHandlerOptions {
  backend: ContinuityBackend;
  identity: ContinuityIdentity;
  basePath?: string;
  heartbeatMs?: number;
  maxBodyBytes?: number;
  now?: () => number;
}

export interface ContinuityHandler {
  handle(request: Request): Promise<Response>;
}
