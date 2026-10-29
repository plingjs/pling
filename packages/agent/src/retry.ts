/**
 * LLM 调用的可靠性三件套：**分类重试 + 指数退避 + 熔断**。
 *
 * 分类是重点：429 限流 / 5xx / 网络超时应重试；
 * 400 参数错、401 鉴权错重试一万次也是同一个结果，只会把钱烧掉。
 */

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

/** 常见确定性错误：把「下一步该查哪里」直接写进错误，而不是只丢一个状态码。 */
const STATUS_HINT: Record<number, string> = {
  400: "请求格式或参数不被接受：检查模型名、工具 schema 与请求体",
  401: "鉴权失败：检查 API key、登录会话或网关的 Authorization",
  403: "请求被拒绝：检查网关来源白名单、账号权限与模型访问权限",
  404: "接口或模型不存在：检查 baseUrl 是否以 /v1 结尾、模型名是否拼对",
  408: "上游等待超时：可稍后重试",
  413: "请求体过大：减少上下文或压缩历史",
  429: "触发限流：稍后重试或降低请求频率",
};

export class LlmError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;
  /** 上游 / 网关或本层已经用完重试预算；不应再自动重试 */
  retryExhausted: boolean;
  /** 用户主动取消（不是服务出错）。取消既不重试，也不该算熔断器的失败 */
  readonly aborted: boolean;

  constructor(
    message: string,
    options: {
      status?: number | null;
      retryable?: boolean;
      retryExhausted?: boolean;
      aborted?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "LlmError";
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
    this.retryExhausted = options.retryExhausted ?? false;
    this.aborted = options.aborted ?? false;
    this.cause = options.cause;
  }
}

/** 这次失败是不是「被取消」。各家的 abort 表现不一（DOMException / TypeError / 自己的错误类型），统一在这里认。 */
export function isAborted(error: unknown): boolean {
  if (error instanceof LlmError) return error.aborted;
  return (error as { name?: string } | null)?.name === "AbortError";
}

export function errorFromStatus(status: number, body: string): LlmError {
  const hint = retryHint(body);
  const retryable = hint.retryable === false ? false : retryableStatus(status) && !hint.retryExhausted;
  const action = STATUS_HINT[status] ? `：${STATUS_HINT[status]}` : "";
  return new LlmError(`模型接口返回 ${status}${action}（${body.slice(0, 300)}）`, {
    status,
    retryable,
    retryExhausted: hint.retryExhausted,
  });
}

interface RetryHint {
  retryable?: boolean;
  retryExhausted: boolean;
}

/**
 * 兼容普通上游与 Pling 网关的统一错误体。
 *
 * 只采纳「降级」信号：显式 `retryable:false` 或 `retryExhausted:true` 会停止重试；
 * 一个 400 即使写了 `retryable:true` 也不会被升级成可重试，避免错误体反向放宽策略。
 */
function retryHint(body: string): RetryHint {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { retryExhausted: false };
    }
    const record = parsed as Record<string, unknown>;
    const nested = record.error;
    const source =
      nested && typeof nested === "object" && !Array.isArray(nested)
        ? (nested as Record<string, unknown>)
        : record;
    return {
      ...(typeof source.retryable === "boolean" ? { retryable: source.retryable } : {}),
      retryExhausted: source.retryExhausted === true,
    };
  } catch {
    return { retryExhausted: false };
  }
}

export function isRetryable(error: unknown): boolean {
  // 取消永远不重试：重试一次就会被立刻再取消一次，只是白等
  if (isAborted(error)) return false;
  if ((error as { retryExhausted?: boolean } | null)?.retryExhausted === true) return false;
  if (error instanceof LlmError) return error.retryable;
  // 网络层错误（fetch failed / 连接重置 / 超时）
  if (error instanceof TypeError) return true;
  const code = (error as { code?: string } | null)?.code;
  return code === "ETIMEDOUT" || code === "ECONNRESET";
}

function markRetryExhausted(error: unknown): void {
  if (!error || (typeof error !== "object" && typeof error !== "function")) return;
  try {
    (error as { retryExhausted?: boolean }).retryExhausted = true;
  } catch {
    // 只读错误对象：保持原错误，不为了观测破坏调用方契约
  }
}

/** 熔断器三态：closed（正常）→ open（短路）→ half_open（试探）→ closed */
export class CircuitBreaker {
  state: "closed" | "open" | "half_open" = "closed";
  private failures = 0;
  private openedAt = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(options: { failureThreshold?: number; cooldownMs?: number; now?: () => number } = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.now = options.now ?? (() => Date.now());
  }

  /** 调用前检查：返回 false 表示「短路，不要发请求」 */
  beforeCall(): boolean {
    if (this.state !== "open") return true;
    if (this.now() - this.openedAt >= this.cooldownMs) {
      this.state = "half_open";
      return true;
    }
    return false;
  }

  onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  onFailure(): void {
    this.failures += 1;
    if (this.state === "half_open" || this.failures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = this.now();
      this.failures = 0;
    }
  }
}

export interface RetryInfo {
  attempt: number;
  delayMs: number;
  reason: string;
  status: number | null;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  /** 单次退避上限；默认 30s，避免调用方把 maxRetries 调大后无限拉长 */
  maxDelayMs?: number;
  breaker?: CircuitBreaker;
  onRetry?: (info: RetryInfo) => void;
  /** 注入时钟/睡眠，测试里不必真的等 */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** 指数退避 + jitter（防止多客户端同时重试造成惊群） */
export function backoffDelay(attempt: number, baseDelayMs: number, random: () => number = Math.random): number {
  const exponential = baseDelayMs * 2 ** (attempt - 1);
  return Math.round(exponential * (0.5 + random() * 0.5));
}

export function withRetry<A extends unknown[], R>(
  base: (...args: A) => Promise<R>,
  options: RetryOptions = {},
): (...args: A) => Promise<R> {
  const { maxRetries = 3, baseDelayMs = 500, maxDelayMs = 30_000, breaker, onRetry } = options;
  const sleep = options.sleep ?? defaultSleep;

  return async (...args: A): Promise<R> => {
    if (breaker && !breaker.beforeCall()) {
      throw new LlmError("熔断器已打开，本次调用被短路", { retryable: false });
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await base(...args);
        breaker?.onSuccess();
        return result;
      } catch (error) {
        lastError = error;
        // 取消：直接抛出去，不重试、也不算一次「服务失败」
        if (isAborted(error)) throw error;
        const status = error instanceof LlmError ? error.status : null;
        if (!isRetryable(error) || attempt > maxRetries) {
          breaker?.onFailure();
          if (isRetryable(error)) markRetryExhausted(error);
          throw error;
        }
        const delayMs = Math.min(maxDelayMs, backoffDelay(attempt, baseDelayMs));
        const reason = error instanceof Error ? error.message : String(error);
        onRetry?.({ attempt, delayMs, reason, status });
        await sleep(delayMs);
      }
    }
    throw lastError;
  };
}
