import { SurfaceClientError } from "./errors";
import type {
  SurfaceAgentAccess,
  SurfaceClaimInput,
  SurfaceGatewayClient,
  SurfaceGatewayClientOptions,
  SurfacePageSession,
  SurfacePairing,
  SurfacePublicPageSessionInput,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}

function pageSessionOf(value: unknown): SurfacePageSession {
  if (!isRecord(value)) throw new SurfaceClientError("SURFACE_BAD_RESPONSE", "页面会话响应不是对象");
  const pageSessionId = text(value.pageSessionId);
  const token = text(value.token);
  const expiresAt = number(value.expiresAt);
  const tenantId = text(value.tenantId);
  const surfaceUrl = text(value.surfaceUrl);
  const pairingUrl = text(value.pairingUrl);
  const agentSessionsUrl = text(value.agentSessionsUrl);
  const mcpUrl = text(value.mcpUrl);
  const scope = stringArray(value.scope);
  if (!pageSessionId || !token || !expiresAt || !tenantId || !surfaceUrl || !pairingUrl || !agentSessionsUrl || !mcpUrl || !scope) {
    throw new SurfaceClientError("SURFACE_BAD_RESPONSE", "页面会话响应缺少必要字段");
  }
  const socketUrl = new URL(surfaceUrl);
  socketUrl.searchParams.set("token", token);
  if (socketUrl.protocol !== "ws:" && socketUrl.protocol !== "wss:") {
    throw new SurfaceClientError("SURFACE_BAD_RESPONSE", "页面 WebSocket 地址必须使用 ws 或 wss");
  }
  return {
    pageSessionId,
    pageToken: token,
    expiresAt,
    tenantId,
    surfaceUrl: socketUrl.toString(),
    pairingUrl,
    agentSessionsUrl,
    mcpUrl,
    scope,
  };
}

function pairingOf(value: unknown): SurfacePairing {
  if (!isRecord(value)) throw new SurfaceClientError("SURFACE_BAD_RESPONSE", "配对响应不是对象");
  const code = text(value.code);
  const tenantId = text(value.tenantId);
  const tenantName = text(value.tenantName);
  const mcpUrl = text(value.mcpUrl);
  const expiresAt = number(value.expiresAt);
  const scope = stringArray(value.scope);
  if (!code || !tenantId || !tenantName || !mcpUrl || !expiresAt || !scope) {
    throw new SurfaceClientError("SURFACE_BAD_RESPONSE", "配对响应缺少必要字段");
  }
  return { code, tenantId, tenantName, mcpUrl, expiresAt, scope };
}

function accessOf(value: unknown): SurfaceAgentAccess {
  if (!isRecord(value)) throw new SurfaceClientError("SURFACE_BAD_RESPONSE", "Agent 会话响应不是对象");
  const agentSessionId = text(value.agentSessionId);
  const token = text(value.token);
  const tenantId = text(value.tenantId);
  const pageSessionId = text(value.pageSessionId);
  const agentId = text(value.agentId);
  const expiresAt = number(value.expiresAt);
  const mcpUrl = text(value.mcpUrl);
  const scope = stringArray(value.scope);
  if (!agentSessionId || !token || !tenantId || !pageSessionId || !agentId || !expiresAt || !mcpUrl || !scope) {
    throw new SurfaceClientError("SURFACE_BAD_RESPONSE", "Agent 会话响应缺少必要字段");
  }
  return { agentSessionId, token, tenantId, pageSessionId, agentId, scope, expiresAt, mcpUrl };
}

/**
 * HTTP client for the reference Surface Gateway.
 *
 * `createPublicPageSession` is intentionally a separate, explicit method. A
 * production BFF should use the admin API and hand the page a short-lived page
 * session; it must not expose an admin token through this client.
 */
export function createSurfaceGatewayClient(options: SurfaceGatewayClientOptions = {}): SurfaceGatewayClient {
  const baseUrl = (options.baseUrl ?? "").replace(/\/$/, "");
  const fetchImpl = options.fetch ?? fetch;
  const credentials = options.credentials ?? "same-origin";

  const request = async (url: string, init: RequestInit = {}): Promise<Record<string, unknown>> => {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");
    const response = await fetchImpl(url, { ...init, credentials, headers });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(body)) {
      const error = isRecord(body) && isRecord(body.error) ? body.error : null;
      throw new SurfaceClientError(
        typeof error?.code === "string" ? error.code : "SURFACE_HTTP_ERROR",
        typeof error?.message === "string" ? error.message : `Surface Gateway returned HTTP ${response.status}`,
        response.status,
      );
    }
    return body;
  };

  const post = (url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> =>
    request(url, { method: "POST", body: JSON.stringify(body) });

  const createPairingFor = async (page: SurfacePageSession): Promise<SurfacePairing> =>
    pairingOf(await post(page.pairingUrl, { pageToken: page.pageToken }));

  return {
    async createPublicPageSession(input = {}) {
      if (!baseUrl) throw new SurfaceClientError("SURFACE_GATEWAY_URL_REQUIRED", "public-demo 模式需要 gatewayUrl");
      const payload = await post(`${baseUrl}/v1/demo/page-sessions`, {
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        ...(input.origin ? { origin: input.origin } : {}),
        ...(input.clientKey ? { clientKey: input.clientKey } : {}),
      });
      return pageSessionOf(payload);
    },

    async createPairing(page: SurfacePageSession) {
      return createPairingFor(page);
    },

    async claimAgent(page: SurfacePageSession, input: SurfaceClaimInput = {}) {
      const pairing = input.pairing ?? (await createPairingFor(page));
      const ttlMs = input.ttlMs ?? Math.max(1, page.expiresAt - Date.now());
      return accessOf(await post(page.agentSessionsUrl, {
        code: pairing.code,
        agentId: input.agentId ?? "external-agent",
        ttlMs,
      }));
    },

    async revokeAgent(page: SurfacePageSession, agentSessionId: string) {
      await post(`${page.agentSessionsUrl.replace(/\/$/, "")}/revoke`, {
        pageToken: page.pageToken,
        agentSessionId,
      });
    },
  };
}
