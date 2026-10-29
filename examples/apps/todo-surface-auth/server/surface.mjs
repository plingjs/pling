export const TODO_SURFACE_SCOPES = Object.freeze(["add_task", "toggle@", "delete@", "clear_completed"]);

export class SurfaceConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SurfaceConfigurationError";
  }
}

/** Parse the deployment-level allowlist. An invalid entry fails closed. */
export function parseSurfaceScopes(value) {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
    return [...TODO_SURFACE_SCOPES];
  }
  if (typeof value !== "string") {
    throw new SurfaceConfigurationError("TODO_SURFACE_SCOPES must be a comma-separated string.");
  }
  const scopes = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  if (scopes.length === 0) {
    throw new SurfaceConfigurationError("TODO_SURFACE_SCOPES must contain at least one capability.");
  }
  const supported = new Set(TODO_SURFACE_SCOPES);
  const unknown = scopes.filter((scope) => !supported.has(scope));
  if (unknown.length > 0) {
    throw new SurfaceConfigurationError(
      `TODO_SURFACE_SCOPES contains unsupported capabilities: ${unknown.join(", ")}. ` +
        `Supported values: ${TODO_SURFACE_SCOPES.join(", ")}.`,
    );
  }
  return scopes;
}

export class SurfaceProvisionError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.name = "SurfaceProvisionError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Server-to-server page-session creation.
 *
 * The browser never receives the admin token. It receives only a short-lived
 * page token after this BFF has authenticated its own HttpOnly session cookie.
 */
export async function provisionPageSession(options) {
  const gatewayUrl = requiredUrl(options?.gatewayUrl, "surface gateway URL");
  const adminToken = typeof options?.adminToken === "string" ? options.adminToken.trim() : "";
  if (!adminToken) {
    throw new SurfaceProvisionError(
      "SURFACE_NOT_CONFIGURED",
      "Third-party Agent access is not configured. Set SURFACE_ADMIN_TOKEN on this demo server.",
      503,
    );
  }
  const body = {
    tenantId: options.tenantId ?? "demo",
    userId: options.userId,
    scope: options.scope ?? TODO_SURFACE_SCOPES,
    ...(options.ttlMs ? { ttlMs: options.ttlMs } : {}),
  };
  let response;
  try {
    response = await (options.fetchImpl ?? fetch)(`${gatewayUrl.replace(/\/$/, "")}/v1/page-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
    });
  } catch (error) {
    throw new SurfaceProvisionError(
      "SURFACE_UNAVAILABLE",
      `The Surface Gateway is unreachable: ${error instanceof Error ? error.message : String(error)}`,
      503,
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new SurfaceProvisionError(
      payload?.error?.code ?? "SURFACE_PROVISION_FAILED",
      payload?.error?.message ?? `Surface Gateway returned HTTP ${response.status}`,
      response.status === 401 || response.status === 403 ? 503 : response.status,
    );
  }
  if (!payload || typeof payload.token !== "string" || typeof payload.surfaceUrl !== "string") {
    throw new SurfaceProvisionError("SURFACE_BAD_RESPONSE", "Surface Gateway returned an invalid page session", 502);
  }
  return {
    pageSessionId: payload.pageSessionId,
    pageToken: payload.token,
    expiresAt: payload.expiresAt,
    tenantId: payload.tenantId,
    surfaceUrl: withPageToken(payload.surfaceUrl, payload.token),
    pairingUrl: payload.pairingUrl,
    agentSessionsUrl: payload.agentSessionsUrl,
    mcpUrl: payload.mcpUrl,
    scope: body.scope,
  };
}

function withPageToken(surfaceUrl, token) {
  let url;
  try {
    url = new URL(surfaceUrl);
  } catch {
    throw new SurfaceProvisionError("SURFACE_BAD_RESPONSE", "Surface Gateway returned an invalid WebSocket URL", 502);
  }
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new SurfaceProvisionError("SURFACE_BAD_RESPONSE", "Surface Gateway WebSocket URL must use ws or wss", 502);
  }
  url.searchParams.set("token", token);
  return url.toString();
}

function requiredUrl(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new SurfaceProvisionError("SURFACE_NOT_CONFIGURED", `${label} is missing`);
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported protocol");
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new SurfaceProvisionError("SURFACE_NOT_CONFIGURED", `${label} must be an absolute http(s) URL`);
  }
}
