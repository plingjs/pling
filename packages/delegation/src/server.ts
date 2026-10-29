import { DelegationError, delegationErrorStatus, toDelegationErrorBody } from "./errors";
import type {
  DelegationHandler,
  DelegationHandlerOptions,
  DelegationSessionView,
} from "./types";

const encoder = new TextEncoder();

function json(body: unknown, status: number, cookies: readonly string[] = []): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(error: unknown, cookies: readonly string[]): Response {
  const body = toDelegationErrorBody(error);
  const status = delegationErrorStatus(error);
  return json(body, status, cookies);
}

function normalizeBasePath(value: string | undefined): string {
  const trimmed = (value ?? "/delegation").trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function bearerToken(request: Request): string {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match?.[1]) throw new DelegationError("DELEGATION_INVALID_CREDENTIAL");
  return match[1].trim();
}

async function readJson(request: Request, maxBodyBytes: number): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBodyBytes) {
    throw new DelegationError("DELEGATION_INVALID_REQUEST", "请求体过大");
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBodyBytes) {
    throw new DelegationError("DELEGATION_INVALID_REQUEST", "请求体过大");
  }
  if (bytes.byteLength === 0) return {};
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value as Record<string, unknown>;
  } catch {
    throw new DelegationError("DELEGATION_INVALID_REQUEST", "请求体必须是 JSON 对象");
  }
}

function sseResponse(
  session: DelegationSessionView,
  options: DelegationHandlerOptions,
  cookies: readonly string[],
  now: () => number,
  signal: AbortSignal,
): Response {
  const heartbeatMs = Math.max(0, options.heartbeatMs ?? 15_000);
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
        signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          // 浏览器 / 代理可能已经取消流。
        }
      };

      write("ready", { userId: session.userId, at: now() });
      unsubscribe = options.events.subscribe(session.userId, (event) => {
        if (!write("credential_revoked", event)) cleanup();
      });
      if (heartbeatMs > 0) {
        heartbeat = setInterval(() => {
          if (!write("ping", { at: now() })) cleanup();
        }, heartbeatMs);
      }
      if (signal.aborted) {
        cleanup();
      } else {
        signal.addEventListener("abort", cleanup, { once: true });
      }
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
 * 它只负责委托凭证的 HTTP / SSE 语义；身份、存储与广播都从 port 注入。Node、Bun、
 * Deno 与 Serverless 都可以在各自适配器里调用同一个 handler。
 */
export function createDelegationHandler(options: DelegationHandlerOptions): DelegationHandler {
  const base = normalizeBasePath(options.basePath);
  const now = options.now ?? (() => Date.now());
  const instanceId = options.instanceId ?? "local";
  const maxBodyBytes = options.maxBodyBytes ?? 32 * 1024;

  // 凭证状态已经由 store 提交；SSE / outbox 通知是加速器，不是事实来源。
  // 发布失败不能把一次成功的撤销伪装成 500，下一次 introspect 仍会 fail-closed。
  const publish = async (event: Parameters<typeof options.events.publish>[0]): Promise<void> => {
    try {
      await options.events.publish(event);
    } catch {
      // 传输故障由 outbox 重试 / SSE 重连 / 调用前 introspect 兜底。
    }
  };

  const sessionOf = async (request: Request, cookies: string[]): Promise<DelegationSessionView> => {
    const session = await options.identity.resolve({ request, setCookie: (value) => cookies.push(value) });
    if (!session || typeof session.userId !== "string" || !session.userId || typeof session.expiresAt !== "number") {
      throw new DelegationError("DELEGATION_INVALID_CREDENTIAL", "缺少有效用户会话");
    }
    return session;
  };

  const handle = async (request: Request): Promise<Response> => {
    const cookies: string[] = [];
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === "GET" && path === `${base}/health`) {
        return json({ ok: true, instance: instanceId }, 200, cookies);
      }

      if (request.method === "GET" && path === `${base}/session`) {
        const session = await sessionOf(request, cookies);
        return json({ ok: true, userId: session.userId, expiresAt: session.expiresAt, instance: instanceId }, 200, cookies);
      }

      if (request.method === "GET" && path === `${base}/events`) {
        const session = await sessionOf(request, cookies);
        return sseResponse(session, options, cookies, now, request.signal);
      }

      if (request.method === "POST" && path === `${base}/issue`) {
        const session = await sessionOf(request, cookies);
        const body = await readJson(request, maxBodyBytes);
        const credential = await options.store.issue({
          userId: session.userId,
          agentId: body.agentId as string,
          scope: body.scope as string[],
          ...(body.ttlMs === undefined ? {} : { ttlMs: body.ttlMs as number }),
        });
        return json({ ok: true, credential }, 200, cookies);
      }

      if (request.method === "POST" && path === `${base}/introspect`) {
        const credential = await options.store.introspect({ token: bearerToken(request) });
        return json({ ok: true, credential }, 200, cookies);
      }

      if (request.method === "POST" && path === `${base}/refresh`) {
        const session = await sessionOf(request, cookies);
        const token = bearerToken(request);
        const before = await options.store.introspect({ token });
        const credential = await options.store.refresh({ token, userId: session.userId });
        await publish({
          type: "credential_revoked",
          reason: "rotated",
          at: now(),
          credentialId: before.credentialId,
          delegationId: before.delegationId,
          sessionId: before.sessionId,
          userId: before.userId,
          agentId: before.agentId,
          replacedBy: credential.credentialId,
        });
        return json({ ok: true, credential }, 200, cookies);
      }

      if (request.method === "POST" && path === `${base}/revoke`) {
        const session = await sessionOf(request, cookies);
        const credential = await options.store.revoke({ token: bearerToken(request), userId: session.userId });
        await publish({
          type: "credential_revoked",
          reason: "revoked",
          at: now(),
          credentialId: credential.credentialId,
          delegationId: credential.delegationId,
          sessionId: credential.sessionId,
          userId: credential.userId,
          agentId: credential.agentId,
        });
        return json({ ok: true, credential }, 200, cookies);
      }

      throw new DelegationError("DELEGATION_NOT_FOUND");
    } catch (error) {
      return errorResponse(error, cookies);
    }
  };

  return { handle };
}
