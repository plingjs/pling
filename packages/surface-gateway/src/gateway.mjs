import { randomBytes, randomUUID } from "node:crypto";
import { normalizeConfig } from "./config.mjs";
import { GatewayError } from "./errors.mjs";
import { PACKAGE_VERSION } from "./version.mjs";

export const BRIDGE_PROTOCOL = "pling.bridge/0.1";
export const SURFACE_PROTOCOL = "pling.surface/0.1";

const OPEN = 1;
const MAX_ID_LENGTH = 256;
const MAX_SCOPE_ENTRIES = 256;

/**
 * Multi-tenant Surface transport/control plane.
 *
 * This object deliberately knows nothing about page DOM or business actions.
 * It authenticates a page connection, binds an Agent session to that page, and
 * forwards opaque `describe` / `invoke` envelopes. Permission remains in the
 * page's Surface session and the business backend.
 */
export function createSurfaceGateway(options = {}) {
  const config = normalizeConfig(options.config);
  const now = options.now ?? Date.now;
  const requestTimeoutMs = positiveOption(options.requestTimeoutMs, 20_000, "requestTimeoutMs");
  const approvalTimeoutMs = positiveOption(options.approvalTimeoutMs, 15 * 60_000, "approvalTimeoutMs");
  const pageSessionTtlMs = positiveOption(options.pageSessionTtlMs, 24 * 60 * 60_000, "pageSessionTtlMs");
  const pairingTtlMs = positiveOption(options.pairingTtlMs, 2 * 60_000, "pairingTtlMs");
  const agentSessionTtlMs = positiveOption(options.agentSessionTtlMs, 24 * 60 * 60_000, "agentSessionTtlMs");
  const resultTtlMs = positiveOption(options.resultTtlMs, 10 * 60_000, "resultTtlMs");
  const revokedSessionRetentionMs = positiveOption(
    options.revokedSessionRetentionMs,
    Math.max(resultTtlMs, 10 * 60_000),
    "revokedSessionRetentionMs",
  );
  const maxPairingClaimsPerWindow = positiveOption(
    options.maxPairingClaimsPerWindow,
    30,
    "maxPairingClaimsPerWindow",
  );
  const pairingClaimWindowMs = positiveOption(
    options.pairingClaimWindowMs,
    10 * 60_000,
    "pairingClaimWindowMs",
  );
  const publicBaseUrl = normalizePublicBaseUrl(options.publicBaseUrl);
  const onAudit = options.onAudit ?? (() => {});

  const tenants = new Map(config.tenants.map((tenant) => [tenant.id, tenant]));
  const maxDemoWindowMs = Math.max(
    0,
    ...config.tenants.map((tenant) => tenant.publicDemo?.windowMs ?? 0),
  );
  const pageSessions = new Map();
  const pageByToken = new Map();
  const agentSessions = new Map();
  const agentByToken = new Map();
  const pairings = new Map();
  const requests = new Map();
  const demoWindows = new Map();
  const claimWindows = new Map();
  let shuttingDown = false;

  function audit(type, data = {}) {
    try {
      Promise.resolve(
        onAudit({
          type,
          at: new Date(now()).toISOString(),
          ...data,
        }),
      ).catch(() => {});
    } catch {
      // Audit must not change the outcome of a protocol call.
    }
  }

  function tenantOf(id) {
    const tenant = tenants.get(id);
    if (!tenant) throw new GatewayError("UNKNOWN_TENANT", `Unknown tenant: ${id}`, 404);
    return tenant;
  }

  function createPageSession(input = {}) {
    assertRunning();
    expire();
    const tenant = tenantOf(requiredString(input.tenantId, "tenantId", 128));
    const userId = requiredString(input.userId, "userId", MAX_ID_LENGTH);
    const scope = normalizeScope(input.scope);
    if (scope.length === 0) {
      throw new GatewayError("SCOPE_REQUIRED", "A page session must declare at least one scope entry.", 400);
    }
    const ttlMs = clampTtl(input.ttlMs, tenant.maxPageSessionTtlMs, pageSessionTtlMs);
    const token = `plg_page_${randomBytes(24).toString("base64url")}`;
    const session = {
      id: `ps_${randomUUID()}`,
      tenantId: tenant.id,
      userId,
      allowedScope: scope,
      token,
      createdAt: now(),
      expiresAt: now() + ttlMs,
      connectedAt: null,
      socket: null,
      app: null,
      activeAgentSessionId: null,
    };
    pageSessions.set(session.id, session);
    pageByToken.set(token, session.id);
    audit("page_session.created", {
      tenantId: tenant.id,
      pageSessionId: session.id,
      userId,
      scope,
      expiresAt: session.expiresAt,
    });
    return {
      pageSessionId: session.id,
      token: session.token,
      expiresAt: session.expiresAt,
      tenantId: tenant.id,
      surfaceUrl: websocketUrl(publicBaseUrl),
      pairingUrl: `${publicBaseUrl}/v1/pairings`,
      agentSessionsUrl: `${publicBaseUrl}/v1/agent-sessions`,
      mcpUrl: `${publicBaseUrl}/mcp`,
      scope: [...scope],
    };
  }

  /**
   * Create a page session for a configured public demo.
   *
   * The browser never receives the admin token. The tenant config owns the
   * scope, Origin allowlist, TTL, and rate limit, so a caller cannot widen its
   * own access or create a session for another tenant.
   */
  function createPublicDemoPageSession(input = {}) {
    assertRunning();
    expire();
    const tenant = tenantOf(requiredString(input.tenantId, "tenantId", 128));
    const demo = tenant.publicDemo;
    if (!demo) throw new GatewayError("PUBLIC_DEMO_DISABLED", "Public demo sessions are not enabled for this tenant.", 404);
    const origin = requiredString(input.origin, "origin", MAX_ID_LENGTH);
    if (!demo.origins.includes(origin)) {
      throw new GatewayError("ORIGIN_NOT_ALLOWED", "This Origin is not allowed for the public demo.", 403);
    }
    const clientKey = optionalString(input.clientKey, 128) ?? "unknown";
    const windowKey = `${tenant.id}:${clientKey}`;
    const current = now();
    const recent = activeWindow(demoWindows.get(windowKey), demo.windowMs, current);
    if (recent.length >= demo.maxSessionsPerWindow) {
      throw new GatewayError("RATE_LIMITED", "Too many public demo sessions. Try again later.", 429);
    }
    const active = [...pageSessions.values()].filter(
      (page) => page.tenantId === tenant.id && page.expiresAt > current && page.userId.startsWith(`${demo.userIdPrefix}:`),
    );
    if (active.length >= demo.maxActiveSessions) {
      throw new GatewayError("DEMO_CAPACITY", "The public demo is at capacity. Try again later.", 429);
    }
    const session = createPageSession({
      tenantId: tenant.id,
      userId: `${demo.userIdPrefix}:${randomUUID()}`,
      scope: demo.scope,
      ttlMs: demo.pageSessionTtlMs,
    });
    demoWindows.set(windowKey, [...recent, current]);
    audit("page_session.public_demo_created", {
      tenantId: tenant.id,
      pageSessionId: session.pageSessionId,
      origin,
      scope: demo.scope,
      expiresAt: session.expiresAt,
    });
    return session;
  }

  function authenticatePage(token, origin) {
    expire();
    const sessionId = pageByToken.get(String(token ?? ""));
    const session = sessionId ? pageSessions.get(sessionId) : null;
    if (!session || session.expiresAt <= now()) {
      throw new GatewayError("PAGE_SESSION_INVALID", "Page session is invalid or expired.", 401);
    }
    const tenant = tenantOf(session.tenantId);
    if (!origin || !tenant.origins.includes(origin)) {
      throw new GatewayError("ORIGIN_NOT_ALLOWED", "The page Origin is not allowed for this tenant.", 403);
    }
    return session;
  }

  function attachPage(session, socket, origin) {
    if (!session || session.expiresAt <= now() || !pageSessions.has(session.id)) {
      throw new GatewayError("PAGE_SESSION_INVALID", "Page session is invalid or expired.", 401);
    }
    const tenant = tenantOf(session.tenantId);
    if (!origin || !tenant.origins.includes(origin)) {
      throw new GatewayError("ORIGIN_NOT_ALLOWED", "The page Origin is not allowed for this tenant.", 403);
    }
    if (session.socket && session.socket !== socket && session.socket.readyState === OPEN) {
      session.socket.close(4001, "replaced by a newer page connection");
    }
    session.socket = socket;
    session.connectedAt = now();
    audit("page.connected", {
      tenantId: session.tenantId,
      pageSessionId: session.id,
      userId: session.userId,
    });
    const agent = session.activeAgentSessionId ? agentSessions.get(session.activeAgentSessionId) : null;
    if (agent && isValidAgent(agent)) sendAgentSession(session, "opened", agent);
  }

  function disconnectPage(session, reason = "page disconnected", socket = session?.socket) {
    if (!session) return;
    // A replaced socket can close after the new one is attached. Never let the
    // stale close event tear down the live connection.
    if (session.socket && session.socket !== socket) return;
    session.socket = null;
    session.connectedAt = null;
    failPendingForPage(session.id, "PAGE_DISCONNECTED", reason);
    audit("page.disconnected", {
      tenantId: session.tenantId,
      pageSessionId: session.id,
      reason,
    });
  }

  function createPairing(input = {}) {
    assertRunning();
    expire();
    const pageToken = requiredString(input.pageToken, "pageToken", 512);
    const sessionId = pageByToken.get(pageToken);
    const session = sessionId ? pageSessions.get(sessionId) : null;
    if (!session || session.expiresAt <= now()) {
      throw new GatewayError("PAGE_SESSION_INVALID", "Page session is invalid or expired.", 401);
    }
    if (!isSocketOpen(session.socket)) {
      throw new GatewayError("PAGE_NOT_CONNECTED", "The business page is not connected to the Surface Gateway.", 409);
    }
    const tenant = tenantOf(session.tenantId);
    const ttlMs = clampTtl(input.ttlMs, pairingTtlMs, pairingTtlMs);
    const code = uniquePairingCode();
    const pairing = {
      id: `pr_${randomUUID()}`,
      code,
      tenantId: session.tenantId,
      pageSessionId: session.id,
      createdAt: now(),
      expiresAt: now() + ttlMs,
      claimedAt: null,
    };
    pairings.set(code, pairing);
    audit("pairing.created", {
      tenantId: session.tenantId,
      pageSessionId: session.id,
      pairingId: pairing.id,
      expiresAt: pairing.expiresAt,
    });
    return {
      code,
      tenantId: session.tenantId,
      tenantName: tenant.displayName,
      mcpUrl: `${publicBaseUrl}/mcp`,
      expiresAt: pairing.expiresAt,
      scope: [...session.allowedScope],
    };
  }

  function claimPairing(input = {}) {
    assertRunning();
    expire();
    const clientKey = optionalString(input.clientKey, 128) ?? "unknown";
    const current = now();
    const recent = activeWindow(claimWindows.get(clientKey), pairingClaimWindowMs, current);
    if (recent.length >= maxPairingClaimsPerWindow) {
      audit("pairing.claim_rate_limited", { clientKey });
      throw new GatewayError("RATE_LIMITED", "Too many pairing attempts. Try again later.", 429);
    }
    claimWindows.set(clientKey, [...recent, current]);

    try {
      const code = requiredString(input.code, "code", 128).toUpperCase();
      const agentId = requiredString(input.agentId, "agentId", MAX_ID_LENGTH);
      const pairing = pairings.get(code);
      if (!pairing || pairing.expiresAt <= current || pairing.claimedAt) {
        throw new GatewayError("PAIRING_INVALID", "Pairing code is invalid, expired, or already used.", 404);
      }
      const page = pageSessions.get(pairing.pageSessionId);
      if (!page || page.expiresAt <= current || !isSocketOpen(page.socket)) {
        throw new GatewayError("PAGE_NOT_CONNECTED", "The business page is disconnected. Reopen it and pair again.", 409);
      }
      const active = page.activeAgentSessionId ? agentSessions.get(page.activeAgentSessionId) : null;
      if (active && isValidAgent(active, current)) {
        throw new GatewayError("AGENT_SESSION_ACTIVE", "This page already has an active Agent session.", 409);
      }
      const tenant = tenantOf(page.tenantId);
      const requested = input.scope === undefined ? [...page.allowedScope] : normalizeScope(input.scope);
      if (requested.length === 0) {
        throw new GatewayError("SCOPE_REQUIRED", "At least one Agent scope entry is required.", 400);
      }
      if (!scopeSubset(requested, page.allowedScope)) {
        throw new GatewayError("SCOPE_NOT_ALLOWED", "The requested scope exceeds the page session scope.", 403);
      }
      const ttlMs = clampTtl(input.ttlMs, tenant.maxAgentSessionTtlMs, agentSessionTtlMs);
      const token = `plg_agent_${randomBytes(24).toString("base64url")}`;
      const agent = {
        id: `as_${randomUUID()}`,
        token,
        tenantId: page.tenantId,
        pageSessionId: page.id,
        agentId,
        userId: page.userId,
        scope: requested,
        createdAt: current,
        expiresAt: current + ttlMs,
        revokedAt: null,
      };
      pairing.claimedAt = current;
      pairings.delete(code);
      agentSessions.set(agent.id, agent);
      agentByToken.set(token, agent.id);
      page.activeAgentSessionId = agent.id;
      sendAgentSession(page, "opened", agent);
      audit("agent_session.opened", {
        tenantId: agent.tenantId,
        pageSessionId: page.id,
        agentSessionId: agent.id,
        agentId,
        userId: agent.userId,
        scope: requested,
        expiresAt: agent.expiresAt,
      });
      return {
        agentSessionId: agent.id,
        token,
        tenantId: agent.tenantId,
        pageSessionId: page.id,
        agentId,
        scope: agent.scope,
        expiresAt: agent.expiresAt,
        mcpUrl: `${publicBaseUrl}/mcp`,
      };
    } catch (error) {
      if (error instanceof GatewayError) {
        audit("pairing.claim_failed", {
          clientKey,
          code: error.code,
          status: error.status,
        });
      }
      throw error;
    }
  }

  function authenticateAgent(token) {
    expire();
    const id = agentByToken.get(String(token ?? ""));
    const agent = id ? agentSessions.get(id) : null;
    if (!agent || !isValidAgent(agent)) {
      throw new GatewayError("AGENT_SESSION_INVALID", "Agent session is invalid, revoked, or expired.", 401);
    }
    return agent;
  }

  function isValidAgent(agent, current = now()) {
    if (!agent || agent.revokedAt || agent.expiresAt <= current) return false;
    const page = pageSessions.get(agent.pageSessionId);
    return Boolean(page && page.expiresAt > current && page.tenantId === agent.tenantId);
  }

  function revokeAgentSession(id, reason = "revoked") {
    const agent = agentSessions.get(id);
    if (!agent) throw new GatewayError("AGENT_SESSION_NOT_FOUND", "Agent session not found.", 404);
    if (agent.revokedAt) return publicAgent(agent);
    agent.revokedAt = now();
    agentByToken.delete(agent.token);
    const page = pageSessions.get(agent.pageSessionId);
    if (page?.activeAgentSessionId === agent.id) page.activeAgentSessionId = null;
    if (page) sendAgentSession(page, "closed", agent);
    failPendingForAgent(agent.id, "SESSION_REVOKED", "Agent session was revoked.");
    audit("agent_session.revoked", {
      tenantId: agent.tenantId,
      pageSessionId: agent.pageSessionId,
      agentSessionId: agent.id,
      agentId: agent.agentId,
      reason,
    });
    return publicAgent(agent);
  }

  function revokePageSession(id, reason = "revoked") {
    const page = pageSessions.get(id);
    if (!page) throw new GatewayError("PAGE_SESSION_NOT_FOUND", "Page session not found.", 404);
    const agents = agentsForPage(page.id);
    for (const agent of agents) revokeAgentSession(agent.id, `page ${reason}`);
    removePairingsForPage(page.id);
    page.expiresAt = now();
    if (page.socket) page.socket.close(4002, "page session revoked");
    pageByToken.delete(page.token);
    pageSessions.delete(page.id);
    failPendingForPage(page.id, "PAGE_SESSION_REVOKED", "Page session was revoked.");
    audit("page_session.revoked", {
      tenantId: page.tenantId,
      pageSessionId: page.id,
      reason,
    });
    return { pageSessionId: page.id, revoked: true };
  }

  async function describe(agentToken) {
    const agent = authenticateAgent(agentToken);
    const result = await requestPage(agent, { method: "describe" });
    return result.response;
  }

  async function invoke(agentToken, capability, input = {}) {
    const agent = authenticateAgent(agentToken);
    const capabilityId = requiredString(capability, "capability", MAX_ID_LENGTH);
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new GatewayError("INVALID_REQUEST", "input must be an object.", 400);
    }
    if (!scopeAllowsCapability(agent.scope, capabilityId)) {
      throw new GatewayError("SCOPE_NOT_ALLOWED", "Capability is outside this Agent session scope.", 403);
    }
    return requestPage(agent, { method: "invoke", capability: capabilityId, input });
  }

  function status(agentToken, requestId) {
    const agent = authenticateAgent(agentToken);
    const entry = requests.get(String(requestId ?? ""));
    if (!entry || entry.agentSessionId !== agent.id) {
      return { state: "not_found", requestId: String(requestId ?? "") };
    }
    if (entry.response) return doneView(entry);
    if (entry.approval) return pendingView(entry);
    return { state: "waiting", requestId: entry.id, capability: entry.capability };
  }

  function requestPage(agent, payload) {
    const page = pageSessions.get(agent.pageSessionId);
    if (!page || page.expiresAt <= now()) {
      throw new GatewayError("PAGE_SESSION_INVALID", "Page session is no longer available.", 410);
    }
    if (!isSocketOpen(page.socket)) {
      throw new GatewayError("PAGE_NOT_CONNECTED", "The business page is not connected to the Surface Gateway.", 409);
    }
    const requestId = `plg_req_${randomUUID()}`;
    const current = now();
    const entry = {
      id: requestId,
      tenantId: agent.tenantId,
      pageSessionId: page.id,
      agentSessionId: agent.id,
      capability: payload.capability,
      createdAt: current,
      updatedAt: current,
      response: null,
      approval: null,
      resolveFirst: null,
      timer: null,
    };
    requests.set(requestId, entry);
    const promise = new Promise((resolve) => {
      entry.resolveFirst = resolve;
    });
    entry.timer = setTimeout(() => {
      if (!entry.response) {
        entry.response = failure(requestId, "GATEWAY_TIMEOUT", "Timed out waiting for the page response.");
        entry.updatedAt = now();
      }
      entry.approval = null;
      entry.timer = null;
      resolveFirst(entry);
    }, requestTimeoutMs);
    const envelope = {
      protocol: SURFACE_PROTOCOL,
      id: requestId,
      method: payload.method,
      ...(payload.capability ? { capability: payload.capability } : {}),
      ...(payload.input === undefined ? {} : { input: payload.input }),
    };
    try {
      page.socket.send(JSON.stringify({ type: "request", requestId, request: envelope }));
    } catch (error) {
      entry.response = failure(
        requestId,
        "PAGE_SEND_FAILED",
        error instanceof Error ? error.message : String(error),
      );
      entry.updatedAt = now();
      clearEntryTimer(entry);
      resolveFirst(entry);
    }
    audit("surface.request", {
      tenantId: agent.tenantId,
      pageSessionId: page.id,
      agentSessionId: agent.id,
      requestId,
      method: payload.method,
      capability: payload.capability,
    });
    return promise;
  }

  function notePageMessage(page, message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "approval_pending" && typeof message.requestId === "string") {
      const entry = requests.get(message.requestId);
      if (!entry || entry.pageSessionId !== page.id || entry.response) return;
      entry.approval = normalizeApproval(message.approval, now);
      entry.updatedAt = now();
      clearEntryTimer(entry);
      // Approval is a first response, but the operation can still finish later.
      // Keep the entry alive long enough for status polling after confirmation.
      entry.timer = setTimeout(() => {
        if (!entry.response) {
          entry.response = failure(entry.id, "GATEWAY_APPROVAL_TIMEOUT", "Timed out waiting for approval or a final result.");
          entry.updatedAt = now();
        }
        entry.timer = null;
      }, approvalTimeoutMs);
      audit("surface.pending_approval", {
        tenantId: entry.tenantId,
        pageSessionId: entry.pageSessionId,
        agentSessionId: entry.agentSessionId,
        requestId: entry.id,
        capability: entry.capability,
      });
      resolveFirst(entry);
      return;
    }
    if (message.type === "response" && typeof message.requestId === "string") {
      const entry = requests.get(message.requestId);
      if (!entry || entry.pageSessionId !== page.id) return;
      entry.response = message.response ?? failure(entry.id, "INVALID_PAGE_RESPONSE", "The page returned an empty response.");
      entry.updatedAt = now();
      clearEntryTimer(entry);
      audit("surface.response", {
        tenantId: entry.tenantId,
        pageSessionId: entry.pageSessionId,
        agentSessionId: entry.agentSessionId,
        requestId: entry.id,
        capability: entry.capability,
        ok: entry.response?.ok === true,
      });
      resolveFirst(entry);
    }
  }

  function resolveFirst(entry) {
    if (!entry.resolveFirst) return;
    const resolve = entry.resolveFirst;
    entry.resolveFirst = null;
    resolve(doneView(entry));
  }

  function doneView(entry) {
    const base = {
      state: entry.response ? "done" : entry.approval ? "pending_approval" : "waiting",
      requestId: entry.id,
      capability: entry.capability,
    };
    if (entry.response) return { ...base, response: entry.response };
    if (entry.approval) return { ...base, approval: entry.approval };
    return base;
  }

  function pendingView(entry) {
    return {
      state: "pending_approval",
      requestId: entry.id,
      capability: entry.capability,
      approval: entry.approval,
    };
  }

  function failPendingForPage(pageSessionId, code, message) {
    for (const entry of requests.values()) {
      if (entry.pageSessionId !== pageSessionId || entry.response) continue;
      entry.response = failure(entry.id, code, message);
      entry.updatedAt = now();
      clearEntryTimer(entry);
      resolveFirst(entry);
    }
  }

  function failPendingForAgent(agentSessionId, code, message) {
    for (const entry of requests.values()) {
      if (entry.agentSessionId !== agentSessionId || entry.response) continue;
      entry.response = failure(entry.id, code, message);
      entry.updatedAt = now();
      clearEntryTimer(entry);
      resolveFirst(entry);
    }
  }

  function discover(tenantId) {
    const tenant = tenantOf(requiredString(tenantId, "tenantId", 128));
    return {
      protocol: SURFACE_PROTOCOL,
      bridge: BRIDGE_PROTOCOL,
      service: `pling-surface-gateway/${PACKAGE_VERSION}`,
      tenant: { id: tenant.id, displayName: tenant.displayName },
      endpoints: {
        surface: websocketUrl(publicBaseUrl),
        mcp: `${publicBaseUrl}/mcp`,
        pairing: `${publicBaseUrl}/v1/pairings`,
      },
      note: "Discovery metadata is a local draft; pairing and authorization remain site-specific.",
    };
  }

  function listSessions() {
    expire();
    return {
      tenants: [...tenants.values()].map(({ id, displayName, origins }) => ({ id, displayName, origins })),
      pageSessions: [...pageSessions.values()].map((page) => ({
        id: page.id,
        tenantId: page.tenantId,
        userId: page.userId,
        connected: isSocketOpen(page.socket),
        scope: [...page.allowedScope],
        expiresAt: page.expiresAt,
        activeAgentSessionId: page.activeAgentSessionId,
      })),
      agentSessions: [...agentSessions.values()].map(publicAgent),
    };
  }

  function publicAgent(agent) {
    return {
      id: agent.id,
      tenantId: agent.tenantId,
      pageSessionId: agent.pageSessionId,
      agentId: agent.agentId,
      userId: agent.userId,
      scope: [...agent.scope],
      expiresAt: agent.expiresAt,
      revokedAt: agent.revokedAt,
    };
  }

  function sendAgentSession(page, action, agent) {
    if (!isSocketOpen(page.socket)) return;
    page.socket.send(
      JSON.stringify({
        type: "agent_session",
        action,
        session: {
          sessionId: agent.id,
          agentId: agent.agentId,
          userId: agent.userId,
          scope: [...agent.scope],
          expiresAt: agent.expiresAt,
          ...(agent.revokedAt ? { revokedAt: agent.revokedAt } : {}),
        },
      }),
    );
  }

  function agentsForPage(pageSessionId) {
    return [...agentSessions.values()].filter(
      (agent) => agent.pageSessionId === pageSessionId && !agent.revokedAt,
    );
  }

  function removePairingsForPage(pageSessionId) {
    for (const pairing of pairings.values()) {
      if (pairing.pageSessionId === pageSessionId) pairings.delete(pairing.code);
    }
  }

  function retirePage(page, code, message, reason) {
    const current = now();
    for (const agent of agentsForPage(page.id)) revokeAgentSession(agent.id, `page ${reason}`);
    removePairingsForPage(page.id);
    page.expiresAt = current;
    if (page.socket) page.socket.close(4003, "page session expired");
    pageByToken.delete(page.token);
    pageSessions.delete(page.id);
    failPendingForPage(page.id, code, message);
    audit("page_session.expired", {
      tenantId: page.tenantId,
      pageSessionId: page.id,
    });
  }

  function expireAgent(agent, current) {
    agent.revokedAt = current;
    agentByToken.delete(agent.token);
    const page = pageSessions.get(agent.pageSessionId);
    if (page?.activeAgentSessionId === agent.id) page.activeAgentSessionId = null;
    if (page) sendAgentSession(page, "closed", agent);
    failPendingForAgent(agent.id, "SESSION_EXPIRED", "Agent session expired.");
    audit("agent_session.expired", {
      tenantId: agent.tenantId,
      pageSessionId: agent.pageSessionId,
      agentSessionId: agent.id,
      agentId: agent.agentId,
    });
  }

  function expire() {
    if (shuttingDown) return;
    const current = now();
    for (const pairing of pairings.values()) {
      if (pairing.expiresAt <= current) pairings.delete(pairing.code);
    }
    for (const page of [...pageSessions.values()]) {
      if (page.expiresAt <= current) {
        retirePage(page, "PAGE_SESSION_EXPIRED", "Page session expired.", "expired");
      }
    }
    for (const agent of [...agentSessions.values()]) {
      if (!agent.revokedAt && agent.expiresAt <= current) expireAgent(agent, current);
      if (agent.revokedAt && agent.revokedAt + revokedSessionRetentionMs < current) {
        agentSessions.delete(agent.id);
      }
    }
    for (const [id, entry] of requests) {
      if (entry.response && entry.updatedAt + resultTtlMs < current) {
        clearEntryTimer(entry);
        requests.delete(id);
      }
    }
    pruneWindows(demoWindows, maxDemoWindowMs, current);
    pruneWindows(claimWindows, pairingClaimWindowMs, current);
  }

  function uniquePairingCode() {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const code = randomBytes(6).toString("hex").toUpperCase();
      if (!pairings.has(code)) return code;
    }
    throw new GatewayError("PAIRING_CODE_UNAVAILABLE", "Could not allocate a unique pairing code.", 503);
  }

  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    const current = now();
    for (const entry of requests.values()) {
      clearEntryTimer(entry);
      if (!entry.response) {
        entry.response = failure(entry.id, "GATEWAY_SHUTDOWN", "Surface Gateway is shutting down.");
        entry.updatedAt = current;
      }
      resolveFirst(entry);
    }
    for (const page of pageSessions.values()) {
      if (page.socket) page.socket.close(1001, "gateway shutting down");
    }
    pageSessions.clear();
    pageByToken.clear();
    agentSessions.clear();
    agentByToken.clear();
    pairings.clear();
    demoWindows.clear();
    claimWindows.clear();
    audit("gateway.shutdown");
  }

  function assertRunning() {
    if (shuttingDown) {
      throw new GatewayError("GATEWAY_CLOSED", "Surface Gateway has shut down.", 503);
    }
  }

  return {
    version: PACKAGE_VERSION,
    config,
    createPageSession,
    createPublicDemoPageSession,
    authenticatePage,
    attachPage,
    disconnectPage,
    createPairing,
    claimPairing,
    authenticateAgent,
    revokeAgentSession,
    revokePageSession,
    describe,
    invoke,
    status,
    notePageMessage,
    discover,
    listSessions,
    expire,
    shutdown,
  };
}

function requiredString(value, field, maxLength = MAX_ID_LENGTH) {
  if (typeof value !== "string" || !value.trim()) {
    throw new GatewayError("INVALID_REQUEST", `${field} must be a non-empty string.`, 400);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new GatewayError("INVALID_REQUEST", `${field} is too long.`, 400);
  }
  return text;
}

function optionalString(value, maxLength) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function normalizeScope(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new GatewayError("INVALID_SCOPE", "scope must be an array of strings.", 400);
  }
  if (value.length > MAX_SCOPE_ENTRIES) {
    throw new GatewayError("INVALID_SCOPE", `scope must contain at most ${MAX_SCOPE_ENTRIES} entries.`, 400);
  }
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || !item.trim() || item.trim().length > MAX_ID_LENGTH) {
      throw new GatewayError("INVALID_SCOPE", "scope entries must be non-empty strings of bounded length.", 400);
    }
    seen.add(item.trim());
  }
  return [...seen];
}

function scopeSubset(requested, allowed) {
  if (allowed.includes("*")) return true;
  return requested.every(
    (item) => item !== "*" && allowed.some((entry) => scopeEntryAllows(entry, item)),
  );
}

function scopeAllowsCapability(allowed, capability) {
  if (allowed.includes("*")) return true;
  return allowed.some((entry) => scopeEntryAllows(entry, capability));
}

/**
 * Match the prefix semantics used by @plingjs/surface:
 * - an exact id also covers its `:` and `@` families;
 * - an id ending in `:` or `@` is already a family prefix;
 * - `*` is only a Gateway-level full-scope marker.
 */
function scopeEntryAllows(allowed, requested) {
  if (allowed === "*") return true;
  if (requested === "*") return false;
  if (allowed === requested) return true;
  if (allowed.endsWith(":") || allowed.endsWith("@")) {
    return requested.startsWith(allowed) && requested.length > allowed.length;
  }
  return requested.startsWith(`${allowed}:`) || requested.startsWith(`${allowed}@`);
}

function normalizeApproval(value, now) {
  const approval = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    description: typeof approval.description === "string" ? approval.description : "Operation requires confirmation",
    args: approval.args && typeof approval.args === "object" && !Array.isArray(approval.args) ? approval.args : {},
    kind: typeof approval.kind === "string" ? approval.kind : "write",
    expiresAt: Number.isFinite(approval.expiresAt) ? approval.expiresAt : now() + 120_000,
    ...(approval.flow && typeof approval.flow === "object" ? { flow: approval.flow } : {}),
  };
}

function failure(id, code, message) {
  return { protocol: SURFACE_PROTOCOL, id, ok: false, error: { code, message } };
}

function isSocketOpen(socket) {
  return Boolean(socket) && socket.readyState === OPEN;
}

function clearEntryTimer(entry) {
  if (!entry.timer) return;
  clearTimeout(entry.timer);
  entry.timer = null;
}

function activeWindow(value, windowMs, current) {
  return (value ?? []).filter((at) => at + windowMs > current);
}

function pruneWindows(map, windowMs, current) {
  if (windowMs <= 0) {
    map.clear();
    return;
  }
  for (const [key, values] of map) {
    const active = activeWindow(values, windowMs, current);
    if (active.length === 0) map.delete(key);
    else if (active.length !== values.length) map.set(key, active);
  }
}

function clampTtl(value, maximum, fallback) {
  const requested = Number.isInteger(value) && value > 0 ? value : fallback;
  return Math.max(1, Math.min(requested, maximum));
}

function positiveOption(value, fallback, name) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer.`);
  }
  return value;
}

function normalizePublicBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("publicBaseUrl is required.");
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("publicBaseUrl must be an absolute http(s) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("publicBaseUrl must use http or https.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("publicBaseUrl must not contain credentials, a query, or a fragment.");
  }
  return url.toString().replace(/\/$/, "");
}

function websocketUrl(base) {
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/surface`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
