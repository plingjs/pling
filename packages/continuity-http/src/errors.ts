import type { ContinuityAuthorityErrorCode } from "@plingjs/agent";

export type ContinuityBackendErrorCode = ContinuityAuthorityErrorCode;

/**
 * 后端 port 与参考 handler 共用的稳定错误。
 *
 * 生产存储适配器可以抛这个类；handler 会把错误码映射成 HTTP 状态，
 * 不会把数据库错误正文或用户隐私写回浏览器。
 */
export class ContinuityBackendError extends Error {
  readonly code: ContinuityBackendErrorCode;

  constructor(code: ContinuityBackendErrorCode, message: string) {
    super(message);
    this.name = "ContinuityBackendError";
    this.code = code;
  }
}
