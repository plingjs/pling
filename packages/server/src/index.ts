/**
 * @plingjs/server —— Pling 的薄 Node 层。
 *
 * 只做四件事：
 *   1. 把浏览器的 OpenAI 兼容请求转发到真正的模型服务；
 *   2. 密钥只从服务端读取，永远不回传浏览器；
 *   3. 鉴权钩子 + 上游地址固定（客户端不能改目标，避免 SSRF）；
 *   4. 审计钩子 + 请求限额 + 超时。
 *
 * **不搬 agent 循环**：v1 仍由浏览器按页面快照决策，这一层不接触 DOM，
 * 也不理解 `v-tool`。这样延迟最低，权限与页面状态也只有一份真相。
 *
 * 入口刻意用 Web 标准 `Request → Response`：Node / Bun / Deno / 各家 Serverless
 * 都能直接接；`toNodeHandler()` 只是给 `node:http` 的一个薄适配。
 */

export interface GatewayUpstream {
  /** OpenAI 兼容接口的根地址，例：`https://api.deepseek.com/v1` */
  baseUrl: string;
  /** 服务端模型密钥；只发给上游，不进入任何响应 */
  apiKey?: string;
  /** 额外上游请求头 */
  headers?: Record<string, string>;
}

export interface GatewayAuthContext {
  request: Request;
  headers: Headers;
  /** 请求路径，例：`/api/llm/v1/chat/completions` */
  path: string;
}

export type GatewayAuthDecision =
  | boolean
  | { ok: true; user?: unknown; headers?: Record<string, string> }
  | { ok: false; status?: number; message?: string };

export interface GatewayAuditEvent {
  requestId: string;
  at: string;
  method: string;
  path: string;
  model?: string;
  stream: boolean;
  /** 返回给浏览器的状态码 */
  status: number;
  /** 上游状态码（连上了才有） */
  upstreamStatus?: number;
  /** 本次请求实际访问上游的次数；健康检查 / 鉴权失败时为缺省 */
  attempts?: number;
  durationMs: number;
  bytesIn: number;
  bytesOut?: number;
  /** 由 authorize 返回；默认不记录 prompt / 回复正文 */
  user?: unknown;
  error?: string;
  /** 最终失败是否属于瞬时故障（仅 error 时出现） */
  retryable?: boolean;
  /** 网关已经用完重试预算；客户端不应再自动重试同一请求（仅重试耗尽时出现） */
  retryExhausted?: boolean;
}

export interface GatewayRetryOptions {
  /** 最多重试次数，不含首次请求；0 = 关闭。默认 2，最多 5 */
  maxRetries?: number;
  /** 指数退避的基数，默认 500ms */
  baseDelayMs?: number;
  /** 单次退避上限，默认 4000ms */
  maxDelayMs?: number;
}

export interface PlingGatewayOptions {
  upstream: string | GatewayUpstream;
  /**
   * 强制使用的模型名。不写则沿用客户端请求里的 `model`。
   * 生产环境建议写死，避免浏览器随意指定昂贵模型。
   */
  model?: string;
  /** 允许的模型白名单；与 `model` 同时存在时，最终模型必须在名单里 */
  allowedModels?: readonly string[];
  /**
   * 鉴权钩子。返回 false / `{ ok: false }` 一律拒绝。
   *
   * 没配 `authorize` 且没显式 `allowAnonymous: true` 时，网关会以 503 拒绝 ——
   * 这是 fail-closed：忘记配置不能等于「谁都能用」。
   */
  authorize?: (ctx: GatewayAuthContext) => GatewayAuthDecision | Promise<GatewayAuthDecision>;
  /** 仅本地演示 / 内网无鉴权场景显式打开 */
  allowAnonymous?: boolean;
  /** 审计出口；异常会被吞掉，不影响请求 */
  onAudit?: (event: GatewayAuditEvent) => void | Promise<void>;
  /** 注入 fetch（测试 / 自定义传输） */
  fetch?: typeof fetch;
  /** 等待上游响应头的超时，默认 60000ms；0 = 关闭 */
  timeoutMs?: number;
  /**
   * 上游瞬时故障重试。默认重试 2 次；`false` 完全关闭。
   *
   * 只重试「还没向浏览器输出任何内容」的请求：408 / 425 / 429 / 5xx，
   * 以及网络失败或等待响应头超时。401 / 400 之类不重试。
   */
  retry?: false | GatewayRetryOptions;
  /** 请求体上限，默认 1MB */
  maxBodyBytes?: number;
}

export interface PlingGateway {
  handle(request: Request): Promise<Response>;
}

export interface NodeRequestLike {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array | string>;
  destroy?(error?: Error): void;
}

export interface NodeResponseLike {
  statusCode: number;
  setHeader(name: string, value: string | number | readonly string[]): void;
  write(chunk: Uint8Array): boolean;
  end(chunk?: Uint8Array | string): void;
  once?(event: "drain" | "close", listener: () => void): void;
}

export type PlingNodeHandler = (req: NodeRequestLike, res: NodeResponseLike) => Promise<void>;

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_BODY_BYTES = 1_000_000;
const DEFAULT_RETRY: Required<GatewayRetryOptions> = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 4_000,
};
const MAX_RETRIES = 5;
let requestCounter = 0;

function retryableUpstreamStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

class GatewayError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly retryExhausted: boolean;
  readonly attempts?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { retryable?: boolean; retryExhausted?: boolean; attempts?: number } = {},
  ) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.retryExhausted = options.retryExhausted ?? false;
    this.attempts = options.attempts;
  }
}

interface NormalizedUpstream {
  endpoint: string;
  apiKey?: string;
  headers: Record<string, string>;
}

interface AuthResult {
  user?: unknown;
  headers: Record<string, string>;
}

interface AuditState {
  model?: string;
  stream: boolean;
  status: number;
  upstreamStatus?: number;
  attempts?: number;
  bytesIn: number;
  bytesOut?: number;
  user?: unknown;
  error?: string;
  retryable?: boolean;
  retryExhausted?: boolean;
}

function normalizeUpstream(input: string | GatewayUpstream): NormalizedUpstream {
  const baseUrl = (typeof input === "string" ? input : input.baseUrl).trim();
  if (!baseUrl) throw new Error("createPlingGateway: upstream.baseUrl 不能为空");

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`createPlingGateway: upstream.baseUrl 不是合法 URL：${baseUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`createPlingGateway: upstream 只支持 http/https，收到 ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error("createPlingGateway: upstream 不允许内嵌用户名 / 密码");
  }
  if (url.search || url.hash) {
    throw new Error("createPlingGateway: upstream.baseUrl 不允许带 query / hash");
  }

  const root = baseUrl.replace(/\/+$/, "");
  return {
    endpoint: root.endsWith("/chat/completions") ? root : `${root}/chat/completions`,
    ...(typeof input === "string" ? {} : input.apiKey ? { apiKey: input.apiKey } : {}),
    headers: typeof input === "string" ? {} : { ...input.headers },
  };
}

function newRequestId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  requestCounter += 1;
  return `pling_${Date.now().toString(36)}_${requestCounter.toString(36)}`;
}

function jsonResponse(
  data: unknown,
  status: number,
  requestId: string,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers(extraHeaders);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-pling-request-id", requestId);
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(error: GatewayError, requestId: string): Response {
  return jsonResponse(
    {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        retryable: error.retryable,
        ...(error.attempts === undefined ? {} : { attempts: error.attempts }),
        ...(error.retryExhausted ? { retryExhausted: true } : {}),
      },
    },
    error.status,
    requestId,
  );
}

function toGatewayError(error: unknown): GatewayError {
  if (error instanceof GatewayError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new GatewayError(500, "GATEWAY_INTERNAL", message || "网关内部错误");
}

function normalizeRetry(input: false | GatewayRetryOptions | undefined): Required<GatewayRetryOptions> {
  if (input === false) return { ...DEFAULT_RETRY, maxRetries: 0 };

  const maxRetries = input?.maxRetries ?? DEFAULT_RETRY.maxRetries;
  const baseDelayMs = input?.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs;
  const maxDelayMs = input?.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs;

  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > MAX_RETRIES) {
    throw new Error(`createPlingGateway: retry.maxRetries 必须是 0–${MAX_RETRIES} 的整数`);
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new Error("createPlingGateway: retry.baseDelayMs 必须是非负数");
  }
  if (!Number.isFinite(maxDelayMs) || maxDelayMs < 0) {
    throw new Error("createPlingGateway: retry.maxDelayMs 必须是非负数");
  }
  if (maxDelayMs < baseDelayMs) {
    throw new Error("createPlingGateway: retry.maxDelayMs 不能小于 baseDelayMs");
  }

  return { maxRetries, baseDelayMs, maxDelayMs };
}

function backoffDelay(retry: number, retryOptions: Required<GatewayRetryOptions>): number {
  const exponential = retryOptions.baseDelayMs * 2 ** (retry - 1);
  const jittered = Math.round(exponential * (0.5 + Math.random() * 0.5));
  return Math.min(retryOptions.maxDelayMs, Math.max(0, jittered));
}

function retryAfterMs(value: string | null): number {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : 0;
}

function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) {
    if (signal.aborted) {
      return Promise.reject(new GatewayError(499, "CLIENT_ABORTED", "客户端已取消"));
    }
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new GatewayError(499, "CLIENT_ABORTED", "客户端已取消"));
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new GatewayError(499, "CLIENT_ABORTED", "客户端已取消"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function upstreamStatusError(
  status: number,
  attempts: number,
  retryable: boolean,
  retryExhausted: boolean,
): GatewayError {
  const suffix = `（已尝试 ${attempts} 次）`;
  const options = { retryable, retryExhausted: retryable && retryExhausted, attempts };
  if (status === 429) {
    return new GatewayError(503, "UPSTREAM_RATE_LIMITED", `上游限流${suffix}`, options);
  }
  if (status === 408 || status === 504) {
    return new GatewayError(504, "UPSTREAM_TIMEOUT", `上游超时（状态码 ${status}）${suffix}`, options);
  }
  return new GatewayError(502, "UPSTREAM_ERROR", `上游返回 ${status}${suffix}`, options);
}

async function readLimitedBody(request: Request, maxBytes: number): Promise<{ bytes: number; text: string }> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new GatewayError(413, "PAYLOAD_TOO_LARGE", `请求体超过上限（${maxBytes} 字节）`);
  }

  const reader = request.body?.getReader();
  if (!reader) return { bytes: 0, text: "" };

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new GatewayError(413, "PAYLOAD_TOO_LARGE", `请求体超过上限（${maxBytes} 字节）`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes: total, text: new TextDecoder().decode(merged) };
}

function parseJsonBody(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GatewayError(400, "INVALID_JSON", "请求体不是合法 JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new GatewayError(400, "INVALID_BODY", "请求体必须是一个 JSON 对象");
  }
  return parsed as Record<string, unknown>;
}

function resolveModel(
  requested: unknown,
  forced: string | undefined,
  allowed: readonly string[] | undefined,
): string {
  const model = forced ?? (typeof requested === "string" ? requested.trim() : "");
  if (!model) throw new GatewayError(400, "MODEL_REQUIRED", "请求里缺少 model，网关也没有配置固定模型");
  if (allowed && !allowed.includes(model)) {
    throw new GatewayError(400, "MODEL_NOT_ALLOWED", `不允许使用模型「${model}」`);
  }
  return model;
}

function resolveAuthHeaders(headers: Record<string, string>): Headers {
  const out = new Headers();
  for (const [name, value] of Object.entries(headers)) out.set(name, value);
  return out;
}

function safeAudit(
  sink: PlingGatewayOptions["onAudit"],
  event: GatewayAuditEvent,
): void {
  if (!sink) return;
  try {
    void Promise.resolve(sink(event)).catch(() => undefined);
  } catch {
    // 审计失败不能影响请求本身
  }
}

async function resolveAuth(
  options: PlingGatewayOptions,
  ctx: GatewayAuthContext,
): Promise<AuthResult> {
  if (!options.authorize) {
    if (options.allowAnonymous === true) return { headers: {} };
    throw new GatewayError(
      503,
      "GATEWAY_MISCONFIGURED",
      "未配置 authorize；本地演示请显式设置 allowAnonymous: true",
    );
  }

  let decision: GatewayAuthDecision;
  try {
    decision = await options.authorize(ctx);
  } catch {
    throw new GatewayError(500, "AUTHORIZE_FAILED", "鉴权钩子执行失败");
  }

  if (decision === true) return { headers: {} };
  if (decision === false) throw new GatewayError(401, "UNAUTHORIZED", "未通过鉴权");
  if (!decision.ok) {
    throw new GatewayError(
      decision.status ?? 403,
      "UNAUTHORIZED",
      decision.message ?? "未通过鉴权",
    );
  }
  return {
    ...(decision.user === undefined ? {} : { user: decision.user }),
    headers: { ...decision.headers },
  };
}

export function createPlingGateway(options: PlingGatewayOptions): PlingGateway {
  const upstream = normalizeUpstream(options.upstream);
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function") {
    throw new Error("createPlingGateway: 当前环境没有 fetch，请通过 options.fetch 注入");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryOptions = normalizeRetry(options.retry);
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new Error("createPlingGateway: timeoutMs 必须是非负数");
  }
  if (!Number.isFinite(maxBodyBytes) || maxBodyBytes <= 0) {
    throw new Error("createPlingGateway: maxBodyBytes 必须是正数");
  }

  async function handle(request: Request): Promise<Response> {
    const started = Date.now();
    const requestId = newRequestId();
    const url = new URL(request.url);
    const audit: AuditState = { stream: false, status: 500, bytesIn: 0 };

    try {
      if (request.method === "GET" && url.pathname.endsWith("/health")) {
        audit.status = 200;
        return jsonResponse({ ok: true, service: "pling-gateway" }, 200, requestId);
      }
      if (!url.pathname.endsWith("/chat/completions")) {
        throw new GatewayError(404, "NOT_FOUND", "只支持 /chat/completions");
      }
      if (request.method !== "POST") {
        throw new GatewayError(405, "METHOD_NOT_ALLOWED", "只支持 POST");
      }

      const auth = await resolveAuth(options, {
        request,
        headers: request.headers,
        path: url.pathname,
      });
      if (auth.user !== undefined) audit.user = auth.user;

      const contentType = request.headers.get("content-type") ?? "";
      if (contentType && !contentType.toLowerCase().includes("application/json")) {
        throw new GatewayError(415, "UNSUPPORTED_MEDIA_TYPE", "请求体必须是 application/json");
      }

      const bodyResult = await readLimitedBody(request, maxBodyBytes);
      audit.bytesIn = bodyResult.bytes;
      const body = parseJsonBody(bodyResult.text);
      const model = resolveModel(body.model, options.model, options.allowedModels);
      const stream = body.stream === true;
      audit.model = model;
      audit.stream = stream;

      const upstreamBody = { ...body, model, ...(stream ? { stream: true } : {}) };
      const headers = resolveAuthHeaders(upstream.headers);
      if (upstream.apiKey) headers.set("authorization", `Bearer ${upstream.apiKey}`);
      for (const [name, value] of Object.entries(auth.headers)) headers.set(name, value);
      // 协议头最后落定：鉴权钩子可以覆盖 authorization，但不能改坏 content-type / accept。
      headers.set("content-type", "application/json");
      headers.set("accept", stream ? "text/event-stream" : "application/json");

      const maxAttempts = retryOptions.maxRetries + 1;
      let response: Response | null = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (request.signal.aborted) {
          throw new GatewayError(499, "CLIENT_ABORTED", "客户端已取消");
        }

        audit.attempts = attempt;
        const controller = new AbortController();
        let timedOut = false;
        const timer =
          timeoutMs > 0
            ? setTimeout(() => {
                timedOut = true;
                controller.abort();
              }, timeoutMs)
            : undefined;
        const onClientAbort = (): void => controller.abort();
        request.signal.addEventListener("abort", onClientAbort, { once: true });

        try {
          response = await doFetch(upstream.endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(upstreamBody),
            signal: controller.signal,
          });
        } catch (error) {
          if (request.signal.aborted) {
            throw new GatewayError(499, "CLIENT_ABORTED", "客户端已取消");
          }

          const retryable = true;
          if (attempt >= maxAttempts) {
            const retryExhausted = maxAttempts > 1;
            if (timedOut) {
              throw new GatewayError(
                504,
                "UPSTREAM_TIMEOUT",
                `上游超时（${timeoutMs}ms/次，已尝试 ${attempt} 次）`,
                { retryable, retryExhausted, attempts: attempt },
              );
            }
            throw new GatewayError(502, "UPSTREAM_UNAVAILABLE", `上游请求失败（已尝试 ${attempt} 次）`, {
              retryable,
              retryExhausted,
              attempts: attempt,
            });
          }
        } finally {
          if (timer) clearTimeout(timer);
          request.signal.removeEventListener("abort", onClientAbort);
        }

        if (!response) {
          const delayMs = Math.min(retryOptions.maxDelayMs, backoffDelay(attempt, retryOptions));
          await waitForRetry(delayMs, request.signal);
          continue;
        }

        audit.upstreamStatus = response.status;
        if (response.ok) break;

        const retryable = retryableUpstreamStatus(response.status);
        const retryAfter = retryAfterMs(response.headers.get("retry-after"));
        // 上游错误正文不回传，也不把它读进内存；直接取消 body。
        if (response.body) await response.body.cancel().catch(() => undefined);
        if (!retryable || attempt >= maxAttempts) {
          throw upstreamStatusError(
            response.status,
            attempt,
            retryable,
            retryable && attempt >= maxAttempts && maxAttempts > 1,
          );
        }

        const delayMs = Math.min(
          retryOptions.maxDelayMs,
          Math.max(backoffDelay(attempt, retryOptions), retryAfter),
        );
        await waitForRetry(delayMs, request.signal);
        response = null;
      }

      if (!response) {
        throw new GatewayError(502, "UPSTREAM_UNAVAILABLE", "上游请求失败");
      }

      const upstreamType = response.headers.get("content-type") ?? "";
      if (stream || upstreamType.toLowerCase().includes("text/event-stream")) {
        audit.status = 200;
        if (!response.body) {
          const text = await response.text();
          audit.bytesOut = text.length;
          return new Response(text, {
            status: 200,
            headers: {
              "content-type": upstreamType || "application/json; charset=utf-8",
              "cache-control": "no-store",
              "x-pling-request-id": requestId,
            },
          });
        }
        const headersOut = new Headers({
          "content-type": upstreamType || "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
          "x-accel-buffering": "no",
          "x-pling-request-id": requestId,
        });
        return new Response(response.body, { status: 200, headers: headersOut });
      }

      const text = await response.text();
      audit.bytesOut = text.length;
      audit.status = 200;
      const headersOut = new Headers({
        "content-type": upstreamType || "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-pling-request-id": requestId,
      });
      return new Response(text, { status: 200, headers: headersOut });
    } catch (error) {
      const gatewayError = toGatewayError(error);
      audit.status = gatewayError.status;
      audit.error = gatewayError.code;
      audit.retryable = gatewayError.retryable;
      audit.retryExhausted = gatewayError.retryExhausted;
      return errorResponse(gatewayError, requestId);
    } finally {
      safeAudit(options.onAudit, {
        requestId,
        at: new Date(started).toISOString(),
        method: request.method,
        path: url.pathname,
        ...(audit.model ? { model: audit.model } : {}),
        stream: audit.stream,
        status: audit.status,
        ...(audit.upstreamStatus === undefined ? {} : { upstreamStatus: audit.upstreamStatus }),
        ...(audit.attempts === undefined ? {} : { attempts: audit.attempts }),
        durationMs: Date.now() - started,
        bytesIn: audit.bytesIn,
        ...(audit.bytesOut === undefined ? {} : { bytesOut: audit.bytesOut }),
        ...(audit.user === undefined ? {} : { user: audit.user }),
        ...(audit.error ? { error: audit.error } : {}),
        ...(audit.retryable === undefined ? {} : { retryable: audit.retryable }),
        ...(audit.retryExhausted ? { retryExhausted: true } : {}),
      });
    }
  }

  return { handle };
}

function requestBodyStream(req: NodeRequestLike): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of req) {
          controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      req.destroy?.();
    },
  });
}

function headersFromNode(headers: NodeRequestLike["headers"]): Headers {
  const out = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  return out;
}

function drain(res: NodeResponseLike): Promise<void> {
  if (!res.once) return Promise.resolve();
  return new Promise((resolve) => res.once?.("drain", resolve));
}

/**
 * `node:http` 适配器。demo 用它起一个独立进程；生产也可以把它挂在现有 Express / Fastify
 * 的底层，或直接把 `gateway.handle()` 接到其他运行时。
 */
export function toNodeHandler(gateway: PlingGateway): PlingNodeHandler {
  return async (req, res) => {
    try {
      const host = req.headers.host ?? "localhost";
      const proto = req.headers["x-forwarded-proto"] ?? "http";
      const url = new URL(req.url ?? "/", `${proto}://${host}`);
      const method = (req.method ?? "GET").toUpperCase();
      const hasBody = method !== "GET" && method !== "HEAD";
      const init = {
        method,
        headers: headersFromNode(req.headers),
        ...(hasBody ? { body: requestBodyStream(req), duplex: "half" } : {}),
      } as RequestInit & { duplex?: "half" };

      const response = await gateway.handle(new Request(url, init));
      res.statusCode = response.status;
      response.headers.forEach((value, name) => res.setHeader(name, value));

      if (!response.body || method === "HEAD") {
        res.end();
        return;
      }

      const reader = response.body.getReader();
      let closed = false;
      res.once?.("close", () => {
        closed = true;
        void reader.cancel().catch(() => undefined);
      });
      try {
        for (;;) {
          if (closed) break;
          const { done, value } = await reader.read();
          if (done) break;
          if (!res.write(value)) await drain(res);
        }
      } finally {
        reader.releaseLock();
      }
      res.end();
    } catch {
      if (!res.statusCode || res.statusCode < 400) res.statusCode = 500;
      res.end(JSON.stringify({ error: { code: "GATEWAY_INTERNAL", message: "网关内部错误" } }));
    }
  };
}
