import {
  ContinuityAuthorityError,
  type ClaimTaskInput,
  type CompareAndSwapInput,
  type ContinuityAuthority,
  type ContinuityAuthorityErrorCode,
  type ContinuityChange,
  type ContinuityTaskSummary,
  type CreateTaskInput,
  type LeaseGrant,
  type ReleaseLeaseInput,
  type RenewLeaseInput,
  type ResidencyEnvelope,
} from "@plingjs/agent";

export interface ContinuityEventSource {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

export type ContinuityEventSourceFactory = (
  url: string,
  options: { withCredentials: boolean },
) => ContinuityEventSource;

export interface HttpContinuityAuthorityOptions {
  /** 例如 `/pling/continuity`。同源相对路径最安全，浏览器会自动带 Cookie。 */
  baseUrl?: string;
  /** 测试 / 自定义网关可替换；默认使用全局 fetch。 */
  fetch?: typeof fetch;
  /** JWT、追踪头等由宿主注入。函数形式会在每次请求时重新读取。 */
  headers?: HeadersInit | (() => HeadersInit);
  credentials?: RequestCredentials;
  /** 默认 true，浏览器原生 EventSource 会携带同源 Cookie。 */
  withCredentials?: boolean;
  /** 测试可注入；传 false 可完全关闭 SSE 通知，所有操作前仍会走 HTTP 租约校验。 */
  createEventSource?: ContinuityEventSourceFactory | false;
}

const ERROR_CODES = new Set<ContinuityAuthorityErrorCode>([
  "TASK_EXISTS",
  "NOT_FOUND",
  "REVISION_CONFLICT",
  "LEASE_HELD",
  "LEASE_EXPIRED",
  "OWNER_MISMATCH",
  "LEASE_REVOKED",
  "UNAUTHORIZED",
  "STORE_UNAVAILABLE",
  "INVALID_STATE",
]);

function errorCode(value: unknown): ContinuityAuthorityErrorCode {
  return typeof value === "string" && ERROR_CODES.has(value as ContinuityAuthorityErrorCode)
    ? (value as ContinuityAuthorityErrorCode)
    : "STORE_UNAVAILABLE";
}

function nativeEventSourceFactory(): ContinuityEventSourceFactory | null {
  if (typeof EventSource !== "function") return null;
  return (url, options) => new EventSource(url, options);
}

/**
 * 浏览器侧 HTTP authority。
 *
 * 它只实现 `ContinuityAuthority` 契约，不复制任何 agent / UI 逻辑：
 * 任务检查点与租约由宿主后端裁决，页面仍然用自己的 registry 与 executor 执行动作。
 */
export function createHttpContinuityAuthority(
  options: HttpContinuityAuthorityOptions = {},
): ContinuityAuthority {
  const base = (options.baseUrl ?? "/pling/continuity").replace(/\/+$/, "");
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const credentials = options.credentials ?? "same-origin";
  const withCredentials = options.withCredentials !== false;
  let disposed = false;
  let eventSource: ContinuityEventSource | null = null;

  const endpoint = (path: string): string => `${base}${path}`;

  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(typeof options.headers === "function" ? options.headers() : options.headers);
    const incoming = new Headers(init.headers);
    incoming.forEach((value, key) => headers.set(key, value));
    if (init.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    let response: Response;
    try {
      response = await fetchImpl(endpoint(path), {
        ...init,
        headers,
        credentials,
      });
    } catch {
      throw new ContinuityAuthorityError(
        "STORE_UNAVAILABLE",
        "无法连接共享任务服务；本页不会在没有租约证明时继续执行",
      );
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const envelope = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    if (!response.ok || envelope.ok === false) {
      const error = envelope.error && typeof envelope.error === "object"
        ? (envelope.error as Record<string, unknown>)
        : {};
      const code = response.status === 401 ? "UNAUTHORIZED" : errorCode(error.code);
      const message = typeof error.message === "string"
        ? error.message
        : `共享任务服务返回 ${response.status}`;
      throw new ContinuityAuthorityError(code, message);
    }
    return envelope as T;
  };

  return {
    async list(): Promise<ContinuityTaskSummary[]> {
      const body = await request<{ tasks: ContinuityTaskSummary[] }>("/tasks");
      return body.tasks;
    },
    async read(sessionId: string): Promise<ResidencyEnvelope | null> {
      const body = await request<{ task: ResidencyEnvelope | null }>(
        `/tasks/${encodeURIComponent(sessionId)}`,
      );
      return body.task;
    },
    async create(input: CreateTaskInput): Promise<LeaseGrant> {
      const body = await request<{ grant: LeaseGrant }>("/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return body.grant;
    },
    async claim(input: ClaimTaskInput): Promise<LeaseGrant> {
      const body = await request<{ grant: LeaseGrant }>(
        `/tasks/${encodeURIComponent(input.sessionId)}/claim`,
        { method: "POST", body: JSON.stringify(input) },
      );
      return body.grant;
    },
    async renew(input: RenewLeaseInput): Promise<LeaseGrant> {
      const body = await request<{ grant: LeaseGrant }>(
        `/tasks/${encodeURIComponent(input.sessionId)}/renew`,
        { method: "POST", body: JSON.stringify(input) },
      );
      return body.grant;
    },
    async release(input: ReleaseLeaseInput): Promise<void> {
      await request<{ released: boolean }>(
        `/tasks/${encodeURIComponent(input.sessionId)}/release`,
        { method: "POST", body: JSON.stringify(input) },
      );
    },
    async compareAndSwap(input: CompareAndSwapInput): Promise<ResidencyEnvelope> {
      const body = await request<{ envelope: ResidencyEnvelope }>(
        `/tasks/${encodeURIComponent(input.sessionId)}`,
        { method: "PUT", body: JSON.stringify(input) },
      );
      return body.envelope;
    },
    async remove(input: ReleaseLeaseInput): Promise<void> {
      await request<{ removed: boolean }>(
        `/tasks/${encodeURIComponent(input.sessionId)}`,
        { method: "DELETE", body: JSON.stringify(input) },
      );
    },
    subscribe(listener: (change: ContinuityChange) => void): () => void {
      if (disposed || options.createEventSource === false) return () => {};
      const factory = options.createEventSource ?? nativeEventSourceFactory();
      if (!factory) return () => {};
      try {
        eventSource = factory(endpoint("/events"), { withCredentials });
      } catch {
        return () => {};
      }
      const onMessage = (event: MessageEvent<string>): void => {
        try {
          const change = JSON.parse(event.data) as ContinuityChange;
          if (change && typeof change.sessionId === "string" && typeof change.type === "string") {
            listener(change);
          }
        } catch {
          // 通知只是加速器；坏消息不能影响事实来源（每次操作仍会走 HTTP 校验）。
        }
      };
      eventSource.addEventListener("continuity", onMessage);
      return () => {
        eventSource?.close();
        eventSource = null;
      };
    },
    dispose(): void {
      disposed = true;
      eventSource?.close();
      eventSource = null;
    },
  };
}
