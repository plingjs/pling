export const DELEGATION_ERRORS = Object.freeze({
  DELEGATION_INVALID_REQUEST: { status: 400, message: "委托请求格式不正确" },
  DELEGATION_INVALID_CREDENTIAL: { status: 401, message: "委托凭证无效" },
  DELEGATION_BINDING_MISMATCH: { status: 403, message: "凭证与当前用户或会话不匹配" },
  DELEGATION_NOT_FOUND: { status: 404, message: "未知委托凭证端点" },
  DELEGATION_REVOKED: { status: 409, message: "委托凭证已撤销或已轮换" },
  DELEGATION_EXPIRED: { status: 410, message: "委托凭证已过期" },
  DELEGATION_INTERNAL_ERROR: { status: 500, message: "委托凭证后端内部错误" },
} as const);

export type DelegationErrorCode = keyof typeof DELEGATION_ERRORS;

export class DelegationError extends Error {
  readonly code: DelegationErrorCode;
  readonly status: number;

  constructor(code: DelegationErrorCode, message?: string) {
    super(message ?? DELEGATION_ERRORS[code].message);
    this.name = "DelegationError";
    this.code = code;
    this.status = DELEGATION_ERRORS[code].status;
  }
}

/** 浏览器客户端的错误；保留 HTTP 状态与后端错误码，便于页面做精确降级。 */
export class DelegationClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = "DelegationClientError";
  }
}

export interface DelegationErrorBody {
  ok: false;
  error: { code: string; message: string };
}

export function isDelegationError(
  error: unknown,
): error is { code: DelegationErrorCode; status: number; message: string } {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; status?: unknown; message?: unknown };
  if (typeof candidate.code !== "string" || !(candidate.code in DELEGATION_ERRORS)) return false;
  return typeof candidate.message === "string";
}

export function toDelegationErrorBody(error: unknown): DelegationErrorBody {
  if (isDelegationError(error)) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  return {
    ok: false,
    error: { code: "DELEGATION_INTERNAL_ERROR", message: DELEGATION_ERRORS.DELEGATION_INTERNAL_ERROR.message },
  };
}

export function delegationErrorStatus(error: unknown): number {
  if (!isDelegationError(error)) return 500;
  return DELEGATION_ERRORS[error.code].status;
}
