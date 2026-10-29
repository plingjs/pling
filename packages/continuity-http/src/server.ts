import type {
  ContinuityAuthorityErrorCode,
  ContinuityChange,
  ResidencyEnvelope,
} from "@plingjs/agent";
import { ContinuityBackendError } from "./errors";
import type {
  ContinuityBackend,
  ContinuityClaimInput,
  ContinuityHandler,
  ContinuityHandlerOptions,
  ContinuityReleaseInput,
} from "./types";

const encoder = new TextEncoder();
const KNOWN_ERROR_CODES = new Set<ContinuityAuthorityErrorCode>([
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

function normalizeBasePath(value: string | undefined): string {
  const trimmed = (value ?? "/pling/continuity").trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function json(body: unknown, status: number, cookies: readonly string[] = []): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function statusOf(code: ContinuityAuthorityErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "OWNER_MISMATCH":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "TASK_EXISTS":
    case "REVISION_CONFLICT":
    case "LEASE_HELD":
    case "LEASE_REVOKED":
      return 409;
    case "LEASE_EXPIRED":
      return 410;
    case "INVALID_STATE":
      return 422;
    default:
      return 500;
  }
}

function knownBackendError(error: unknown): ContinuityBackendError | null {
  if (error instanceof ContinuityBackendError) return error;
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string" || !KNOWN_ERROR_CODES.has(code as ContinuityAuthorityErrorCode)) {
    return null;
  }
  const message = (error as { message?: unknown }).message;
  return new ContinuityBackendError(
    code as ContinuityAuthorityErrorCode,
    typeof message === "string" && message ? message : "共享任务服务拒绝了本次操作",
  );
}

function errorResponse(error: unknown, cookies: readonly string[]): Response {
  const known = knownBackendError(error);
  if (known) {
    return json(
      { ok: false, error: { code: known.code, message: known.message } },
      statusOf(known.code),
      cookies,
    );
  }
  return json(
    { ok: false, error: { code: "STORE_UNAVAILABLE", message: "共享任务服务暂时不可用" } },
    500,
    cookies,
  );
}

async function readJson(request: Request, maxBodyBytes: number): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBodyBytes) {
    throw new ContinuityBackendError("INVALID_STATE", "请求体过大");
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBodyBytes) {
    throw new ContinuityBackendError("INVALID_STATE", "请求体过大");
  }
  if (bytes.byteLength === 0) return {};
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value as Record<string, unknown>;
  } catch {
    throw new ContinuityBackendError("INVALID_STATE", "请求体必须是 JSON 对象");
  }
}

function leaseOf(body: Record<string, unknown>): ContinuityReleaseInput {
  return {
    ownerId: body.ownerId as string,
    leaseId: body.leaseId as string,
  };
}

function eventStream(
  request: Request,
  backend: ContinuityBackend,
  userId: string,
  now: () => number,
  heartbeatMs: number,
  cookies: readonly string[],
): Response {
  let cleanup = (): void => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe = (): void => {};
      let heartbeat: ReturnType<typeof setInterval> | undefined;

      const write = (event: string, data: unknown): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          return true;
        } catch {
          return false;
        }
      };

      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (heartbeat !== undefined) clearInterval(heartbeat);
        request.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          // 浏览器 / 代理可能已经取消流。
        }
      };

      write("ready", { userId, at: now() });
      if (backend.subscribe) {
        try {
          unsubscribe = backend.subscribe(userId, (change) => {
            // SSE 只携带可路由的元数据；检查点正文永远走 read / compareAndSwap。
            const metadata: ContinuityChange = {
              type: change.type,
              sessionId: change.sessionId,
              revision: change.revision,
              status: change.status,
              ...(change.ownerId ? { ownerId: change.ownerId } : {}),
              ...(change.leaseId ? { leaseId: change.leaseId } : {}),
              ...(change.leaseExpiresAt ? { leaseExpiresAt: change.leaseExpiresAt } : {}),
              at: change.at,
            };
            if (!write("continuity", metadata)) cleanup();
          });
        } catch {
          // 通知只是加速器；订阅不可用不影响 HTTP 事实来源。
          unsubscribe = () => {};
        }
      }
      if (heartbeatMs > 0) {
        heartbeat = setInterval(() => {
          if (!write("ping", { at: now() })) cleanup();
        }, heartbeatMs);
      }
      if (request.signal.aborted) cleanup();
      else request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  const headers = new Headers({
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store, no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(stream, { status: 200, headers });
}

/**
 * Web 标准 `Request → Response` 参考 handler。
 *
 * 身份只能来自已经验证的 Cookie / JWT / 会话；请求体里的 `userId` 永远不会被读取。
 * 这里不复制业务权限：检查点只保存脱敏上下文与租约，执行仍发生在页面自己的 executor。
 */
export function createContinuityHandler(options: ContinuityHandlerOptions): ContinuityHandler {
  if (!options?.backend) throw new Error("continuity handler 需要 backend");
  if (!options?.identity) throw new Error("continuity handler 需要 identity");
  const base = normalizeBasePath(options.basePath);
  const now = options.now ?? (() => Date.now());
  const heartbeatMs = Math.max(0, options.heartbeatMs ?? 15_000);
  const maxBodyBytes = options.maxBodyBytes ?? 256 * 1024;

  return {
    async handle(request: Request): Promise<Response> {
      const cookies: string[] = [];
      try {
        const url = new URL(request.url);
        const path = url.pathname;

        if (request.method === "GET" && path === `${base}/health`) {
          return json({ ok: true, at: now() }, 200, cookies);
        }

        const identity = await options.identity.resolve({
          request,
          setCookie: (value) => cookies.push(value),
        });
        if (!identity || typeof identity.userId !== "string" || !identity.userId) {
          throw new ContinuityBackendError("UNAUTHORIZED", "请先登录后再使用共享任务");
        }
        const userId = identity.userId;

        if (request.method === "GET" && path === `${base}/session`) {
          return json(
            {
              ok: true,
              userId,
              ...(identity.expiresAt !== undefined ? { expiresAt: identity.expiresAt } : {}),
            },
            200,
            cookies,
          );
        }

        if (request.method === "GET" && path === `${base}/events`) {
          return eventStream(request, options.backend, userId, now, heartbeatMs, cookies);
        }

        if (request.method === "GET" && path === `${base}/tasks`) {
          return json({ ok: true, tasks: await options.backend.list(userId) }, 200, cookies);
        }

        if (request.method === "POST" && path === `${base}/tasks`) {
          const body = await readJson(request, maxBodyBytes);
          const grant = await options.backend.create(userId, {
            envelope: body.envelope as ResidencyEnvelope,
            ownerId: body.ownerId as string,
            ttlMs: body.ttlMs as number,
          });
          return json({ ok: true, grant }, 200, cookies);
        }

        const prefix = `${base}/tasks/`;
        const rest = path.startsWith(prefix) ? path.slice(prefix.length) : "";
        const slash = rest.indexOf("/");
        let sessionId = slash < 0 ? rest : rest.slice(0, slash);
        const action = slash < 0 ? "" : rest.slice(slash + 1);
        try {
          sessionId = decodeURIComponent(sessionId);
        } catch {
          throw new ContinuityBackendError("NOT_FOUND", "接口不存在");
        }

        if (sessionId && !action && request.method === "GET") {
          return json({ ok: true, task: await options.backend.read(userId, sessionId) }, 200, cookies);
        }

        if (sessionId && !action && request.method === "PUT") {
          const body = await readJson(request, maxBodyBytes);
          const envelope = await options.backend.compareAndSwap(userId, sessionId, {
            expectedRevision: body.expectedRevision as number,
            ownerId: body.ownerId as string,
            leaseId: body.leaseId as string,
            next: body.next as ResidencyEnvelope,
          });
          return json({ ok: true, envelope }, 200, cookies);
        }

        if (sessionId && !action && request.method === "DELETE") {
          const body = await readJson(request, maxBodyBytes);
          const removed = await options.backend.remove(userId, sessionId, leaseOf(body));
          return json({ ok: true, removed }, 200, cookies);
        }

        if (sessionId && action === "claim" && request.method === "POST") {
          const body = await readJson(request, maxBodyBytes);
          const input: ContinuityClaimInput = {
            expectedRevision: body.expectedRevision as number,
            ownerId: body.ownerId as string,
            ttlMs: body.ttlMs as number,
            preempt: body.preempt === true,
          };
          return json({ ok: true, grant: await options.backend.claim(userId, sessionId, input) }, 200, cookies);
        }

        if (sessionId && action === "renew" && request.method === "POST") {
          const body = await readJson(request, maxBodyBytes);
          const grant = await options.backend.renew(userId, sessionId, {
            ownerId: body.ownerId as string,
            leaseId: body.leaseId as string,
            ttlMs: body.ttlMs as number,
          });
          return json({ ok: true, grant }, 200, cookies);
        }

        if (sessionId && action === "release" && request.method === "POST") {
          const body = await readJson(request, maxBodyBytes);
          const released = await options.backend.release(userId, sessionId, leaseOf(body));
          return json({ ok: true, released }, 200, cookies);
        }

        return json({ ok: false, error: { code: "NOT_FOUND", message: "接口不存在" } }, 404, cookies);
      } catch (error) {
        return errorResponse(error, cookies);
      }
    },
  };
}
