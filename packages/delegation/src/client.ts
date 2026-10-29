import { DelegationClientError } from "./errors";
import { normalizeDelegationEvent } from "./events";
import { hasTokenPrefix } from "./tokens";
import type {
  DelegationCredentialView,
  DelegationEventConnection,
  DelegationEventState,
  DelegationInvalidationEvent,
  DelegationSessionView,
  IssuedDelegation,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCredentialView(value: unknown): value is DelegationCredentialView {
  if (!isRecord(value)) return false;
  return (
    typeof value.credentialId === "string" &&
    typeof value.delegationId === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.agentId === "string" &&
    typeof value.userId === "string" &&
    Array.isArray(value.scope) &&
    value.scope.every((item) => typeof item === "string") &&
    typeof value.issuedAt === "number" &&
    typeof value.expiresAt === "number" &&
    (value.revokedAt === undefined || typeof value.revokedAt === "number")
  );
}

function isIssued(value: unknown): value is IssuedDelegation {
  return isRecord(value) && hasTokenPrefix(value.token) && isCredentialView(value);
}

export type DelegationEventSourceConstructor = new (
  url: string | URL,
  init?: EventSourceInit,
) => EventSource;

export interface DelegationClientOptions {
  /** 默认 `/delegation`；开发时由同源代理到凭证后端。 */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** 默认 same-origin；跨域部署时由宿主显式改为 include。 */
  credentials?: RequestCredentials;
  /** 测试或宿主自定义实现；默认使用浏览器 EventSource。 */
  eventSource?: DelegationEventSourceConstructor;
}

export interface DelegationClient {
  ensureSession(): Promise<DelegationSessionView>;
  issue(input: { agentId: string; scope: readonly string[]; ttlMs?: number }): Promise<IssuedDelegation>;
  introspect(token: string): Promise<DelegationCredentialView>;
  refresh(token: string): Promise<IssuedDelegation>;
  revoke(token: string): Promise<DelegationCredentialView>;
  openEvents(
    onEvent: (event: DelegationInvalidationEvent) => void,
    onState?: (state: DelegationEventState) => void,
  ): DelegationEventConnection;
}

/**
 * 浏览器 / 宿主侧客户端。
 *
 * 只认后端返回的安全视图与白名单事件；不会把 token 写进 SurfaceSession，也不会把
 * SSE 里的未知字段透传给业务代码。
 */
export function createDelegationClient(options: DelegationClientOptions = {}): DelegationClient {
  const baseUrl = (options.baseUrl ?? "/delegation").replace(/\/$/, "");
  const request = options.fetch ?? fetch;
  const credentials = options.credentials ?? "same-origin";
  let sessionPromise: Promise<DelegationSessionView> | null = null;

  const requestJson = async (path: string, init: RequestInit = {}): Promise<Record<string, unknown>> => {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");
    const response = await request(`${baseUrl}${path}`, { ...init, credentials, headers });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(body) || body.ok === false) {
      const error = isRecord(body) && isRecord(body.error) ? body.error : null;
      throw new DelegationClientError(
        typeof error?.code === "string" ? error.code : "DELEGATION_BACKEND_ERROR",
        typeof error?.message === "string" ? error.message : `凭证后端返回 HTTP ${response.status}`,
        response.status,
      );
    }
    return body;
  };

  const credentialOf = (body: Record<string, unknown>): DelegationCredentialView => {
    if (!isCredentialView(body.credential)) {
      throw new DelegationClientError("DELEGATION_BACKEND_ERROR", "凭证后端返回了无效的安全视图");
    }
    return body.credential;
  };

  const issuedOf = (body: Record<string, unknown>): IssuedDelegation => {
    if (!isIssued(body.credential)) {
      throw new DelegationClientError("DELEGATION_BACKEND_ERROR", "凭证后端返回了无效的签发结果");
    }
    return body.credential;
  };

  const ensureSession = (): Promise<DelegationSessionView> => {
    if (!sessionPromise) {
      sessionPromise = requestJson("/session")
        .then((body) => {
          if (typeof body.userId !== "string" || !body.userId || typeof body.expiresAt !== "number") {
            throw new DelegationClientError("DELEGATION_BACKEND_ERROR", "凭证后端没有返回有效用户会话");
          }
          return { userId: body.userId, expiresAt: body.expiresAt };
        })
        .catch((reason) => {
          sessionPromise = null;
          throw reason;
        });
    }
    return sessionPromise;
  };

  const issue = async (input: {
    agentId: string;
    scope: readonly string[];
    ttlMs?: number;
  }): Promise<IssuedDelegation> => {
    const body = await requestJson("/issue", { method: "POST", body: JSON.stringify(input) });
    return issuedOf(body);
  };

  const introspect = async (token: string): Promise<DelegationCredentialView> => {
    const body = await requestJson("/introspect", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    return credentialOf(body);
  };

  const refresh = async (token: string): Promise<IssuedDelegation> => {
    const body = await requestJson("/refresh", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    return issuedOf(body);
  };

  const revoke = async (token: string): Promise<DelegationCredentialView> => {
    const body = await requestJson("/revoke", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    return credentialOf(body);
  };

  const openEvents = (
    onEvent: (event: DelegationInvalidationEvent) => void,
    onState?: (state: DelegationEventState) => void,
  ): DelegationEventConnection => {
    const Source = options.eventSource ?? (typeof EventSource === "undefined" ? undefined : EventSource);
    if (!Source) {
      onState?.("unavailable");
      throw new DelegationClientError(
        "DELEGATION_EVENT_SOURCE_UNAVAILABLE",
        "当前环境没有 EventSource，无法订阅撤销广播",
      );
    }

    onState?.("connecting");
    const source = new Source(`${baseUrl}/events`, { withCredentials: true });
    const handle = (event: Event) => {
      const message = event as MessageEvent<unknown>;
      if (typeof message.data !== "string") return;
      try {
        const normalized = normalizeDelegationEvent(JSON.parse(message.data));
        if (normalized) onEvent(normalized);
      } catch {
        // 坏事件不能打断 EventSource 的自动重连。
      }
    };
    source.addEventListener("credential_revoked", handle);
    source.onopen = () => onState?.("open");
    source.onerror = () => onState?.("reconnecting");

    return {
      close: () => {
        source.removeEventListener("credential_revoked", handle);
        source.close();
        onState?.("closed");
      },
    };
  };

  return { ensureSession, issue, introspect, refresh, revoke, openEvents };
}
