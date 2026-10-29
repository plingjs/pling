import { randomBytes, randomUUID } from "node:crypto";
import { GatewayError } from "./errors.mjs";

export const BRIDGE_PROTOCOL = "pling.bridge/0.1";
export const SURFACE_PROTOCOL = "pling.surface/0.1";

const OPEN = 1;

/**
 * Multi-tenant Surface transport/control plane.
 *
 * This object deliberately knows nothing about page DOM or business actions.
 * It authenticates a page connection, binds an Agent session to that page, and
 * forwards opaque `describe` / `invoke` envelopes. Permission remains in the
 * page's Surface session and the business backend.
 */
export function createSurfaceGateway(options) {
  if (!options?.adminToken) throw new Error("adminToken is required");
  if (!options?.publicBaseUrl) throw new Error("publicBaseUrl is required");

  const config = options.config;
  const now = options.now ?? Date.now;
  const requestTimeoutMs = positive(options.requestTimeoutMs, 20_000);
  const approvalTimeoutMs = positive(options.approvalTimeoutMs, 15 * 60_000);
  const pageSessionTtlMs = positive(options.pageSessionTtlMs, 8 * 60 * 60_000);
  const pairingTtlMs = positive(options.pairingTtlMs, 2 * 60_000);
  const agentSessionTtlMs = positive(options.agentSessionTtlMs, 2 * 60 * 60_000);
  const resultTtlMs = positive(options.resultTtlMs, 10 * 60_000);
  const publicBaseUrl = options.publicBaseUrl.replace(/\/$/, "");
  const onAudit = options.onAudit ?? (() => {});

  const tenants = new Map(config.tenants.map((tenant) => [tenant.id, tenant]));
  const pageSessions = new Map();
  const pageByToken = new Map();
  const agentSessions = new Map();
  const agentByToken = new Map();
  const pairings = new Map();
  const requests = new Map();

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
    if (!tenant) throw new GatewayError("UNKNOWN_TENANT", `未知租户：${id}`, 404);
    return tenant;
  }

  function createPageSession(input = {}) {
    expire();
    const tenant = tenantOf(requiredString(input.tenantId, "tenantId"));
    const userId = requiredString(input.userId, "userId");
    const scope = normalizeScope(input.scope);
    if (scope.length === 0) throw new GatewayError("SCOPE_REQUIRED", "page session 必须显式声明 scope");
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
    };
  }

  function authenticatePage(token, origin) {
    expire();
    const sessionId = pageByToken.get(String(token ?? ""));
    const session = sessionId ? pageSessions.get(sessionId) : null;
    if (!session || session.expiresAt <= now()) {
      throw new GatewayError("PAGE_SESSION_INVALID", "页面会话无效或已过期", 401);
    }
    const tenant = tenantOf(session.tenantId);
    if (!origin || !tenant.origins.includes(origin)) {
      throw new GatewayError("ORIGIN_NOT_ALLOWED", "页面 Origin 不在该租户的允许列表中", 403);
    }
    return session;
  }

  function attachPage(session, socket, origin) {
    const tenant = tenantOf(session.tenantId);
    if (!tenant.origins.includes(origin)) {
      throw new GatewayError("ORIGIN_NOT_ALLOWED", "页面 Origin 不在该租户的允许列表中", 403);
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
    expire();
    const pageToken = requiredString(input.pageToken, "pageToken");
    const sessionId = pageByToken.get(pageToken);
    const session = sessionId ? pageSessions.get(sessionId) : null;
    if (!session || session.expiresAt <= now()) {
      throw new GatewayError("PAGE_SESSION_INVALID", "页面会话无效或已过期", 401);
    }
    if (!isSocketOpen(session.socket)) {
      throw new GatewayError("PAGE_NOT_CONNECTED", "业务页面尚未连接 Surface Gateway", 409);
    }
    const tenant = tenantOf(session.tenantId);
    const ttlMs = clampTtl(input.ttlMs, pairingTtlMs, pairingTtlMs);
    const code = randomBytes(5).toString("hex").toUpperCase();
    const pairing = {
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
      pairingCode: code,
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
    expire();
    const code = requiredString(input.code, "code").toUpperCase();
    const agentId = requiredString(input.agentId, "agentId");
    const pairing = pairings.get(code);
    if (!pairing || pairing.expiresAt <= now() || pairing.claimedAt) {
      throw new GatewayError("PAIRING_INVALID", "配对码无效、已过期或已使用", 404);
    }
    const page = pageSessions.get(pairing.pageSessionId);
    if (!page || page.expiresAt <= now() || !isSocketOpen(page.socket)) {
      throw new GatewayError("PAGE_NOT_CONNECTED", "业务页面已断开，请重新打开页面后配对", 409);
    }
    const active = page.activeAgentSessionId ? agentSessions.get(page.activeAgentSessionId) : null;
    if (active && isValidAgent(active)) {
      throw new GatewayError("AGENT_SESSION_ACTIVE", "当前页面已经绑定了一个 Agent；请先撤销或等待其过期", 409);
    }
    const tenant = tenantOf(page.tenantId);
    const requested = input.scope === undefined ? [...page.allowedScope] : normalizeScope(input.scope);
    if (!scopeSubset(requested, page.allowedScope)) {
      throw new GatewayError("SCOPE_NOT_ALLOWED", "请求的 scope 超出租户页面会话允许范围", 403);
    }
    if (requested.length === 0) throw new GatewayError("SCOPE_REQUIRED", "scope 不能为空");
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
      createdAt: now(),
      expiresAt: now() + ttlMs,
      revokedAt: null,
    };
    pairing.claimedAt = now();
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
  }

  function authenticateAgent(token) {
    expire();
    const id = agentByToken.get(String(token ?? ""));
    const agent = id ? agentSessions.get(id) : null;
    if (!agent || !isValidAgent(agent)) {
      throw new GatewayError("AGENT_SESSION_INVALID", "Agent 会话无效、已撤销或已过期", 401);
    }
    return agent;
  }

  function isValidAgent(agent) {
    return Boolean(agent) && !agent.revokedAt && agent.expiresAt > now();
  }

  function revokeAgentSession(id, reason = "revoked") {
    const agent = agentSessions.get(id);
    if (!agent) throw new GatewayError("AGENT_SESSION_NOT_FOUND", "Agent 会话不存在", 404);
    if (agent.revokedAt) return publicAgent(agent);
    agent.revokedAt = now();
    agentByToken.delete(agent.token);
    const page = pageSessions.get(agent.pageSessionId);
    if (page?.activeAgentSessionId === agent.id) page.activeAgentSessionId = null;
    if (page) sendAgentSession(page, "closed", agent);
    failPendingForAgent(agent.id, "SESSION_REVOKED", "Agent 会话已撤销");
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
    if (!page) throw new GatewayError("PAGE_SESSION_NOT_FOUND", "页面会话不存在", 404);
    const agents = [...agentSessions.values()].filter((agent) => agent.pageSessionId === page.id && !agent.revokedAt);
    for (const agent of agents) revokeAgentSession(agent.id, `page ${reason}`);
    page.expiresAt = now();
    if (page.socket) page.socket.close(4002, "page session revoked");
    pageByToken.delete(page.token);
    pageSessions.delete(page.id);
    failPendingForPage(page.id, "PAGE_SESSION_REVOKED", "页面会话已撤销");
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
    if (typeof capability !== "string" || !capability.trim()) {
      throw new GatewayError("INVALID_REQUEST", "capability 必须是非空字符串", 400);
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new GatewayError("INVALID_REQUEST", "input 必须是对象", 400);
    }
    return requestPage(agent, { method: "invoke", capability: capability.trim(), input });
  }

  function status(agentToken, requestId) {
    const agent = authenticateAgent(agentToken);
    const entry = requests.get(String(requestId ?? ""));
    if (!entry || entry.agentSessionId !== agent.id) return { state: "not_found", requestId: String(requestId ?? "") };
    if (entry.response) return doneView(entry);
    if (entry.approval) return pendingView(entry);
    return { state: "waiting", requestId: entry.id, capability: entry.capability };
  }

  function requestPage(agent, payload) {
    const page = pageSessions.get(agent.pageSessionId);
    if (!page || page.expiresAt <= now()) {
      throw new GatewayError("PAGE_SESSION_INVALID", "页面会话已失效", 410);
    }
    if (!isSocketOpen(page.socket)) {
      throw new GatewayError("PAGE_NOT_CONNECTED", "业务页面尚未连接 Surface Gateway", 409);
    }
    const requestId = `plg_req_${randomUUID()}`;
    const entry = {
      id: requestId,
      tenantId: agent.tenantId,
      pageSessionId: page.id,
      agentSessionId: agent.id,
      capability: payload.capability,
      createdAt: now(),
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
        entry.response = failure(requestId, "GATEWAY_TIMEOUT", "等待页面响应超时");
      }
      entry.approval = null;
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
      entry.response = failure(requestId, "PAGE_SEND_FAILED", error instanceof Error ? error.message : String(error));
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
      clearEntryTimer(entry);
      // Approval is a first response, but the operation can still finish later.
      // Keep the entry alive long enough for status polling after confirmation.
      entry.timer = setTimeout(() => {
        if (!entry.response) {
          entry.response = failure(entry.id, "GATEWAY_APPROVAL_TIMEOUT", "等待用户确认或最终结果超时");
        }
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
      entry.response = message.response ?? failure(entry.id, "INVALID_PAGE_RESPONSE", "页面返回了空响应");
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
      clearEntryTimer(entry);
      resolveFirst(entry);
    }
  }

  function failPendingForAgent(agentSessionId, code, message) {
    for (const entry of requests.values()) {
      if (entry.agentSessionId !== agentSessionId || entry.response) continue;
      entry.response = failure(entry.id, code, message);
      clearEntryTimer(entry);
      resolveFirst(entry);
    }
  }

  function discover(tenantId) {
    const tenant = tenantOf(requiredString(tenantId, "tenantId"));
    return {
      protocol: SURFACE_PROTOCOL,
      bridge: BRIDGE_PROTOCOL,
      service: "pling-surface-gateway/0.1",
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

  function expire() {
    const current = now();
    for (const pairing of pairings.values()) {
      if (pairing.expiresAt <= current) pairings.delete(pairing.code);
    }
    for (const page of pageSessions.values()) {
      if (page.expiresAt <= current) {
        pageByToken.delete(page.token);
        pageSessions.delete(page.id);
        if (page.socket) page.socket.close(4003, "page session expired");
        failPendingForPage(page.id, "PAGE_SESSION_EXPIRED", "页面会话已过期");
      }
    }
    for (const agent of agentSessions.values()) {
      if (agent.expiresAt <= current && !agent.revokedAt) {
        agent.revokedAt = current;
        agentByToken.delete(agent.token);
        const page = pageSessions.get(agent.pageSessionId);
        if (page?.activeAgentSessionId === agent.id) page.activeAgentSessionId = null;
        if (page) sendAgentSession(page, "closed", agent);
        failPendingForAgent(agent.id, "SESSION_EXPIRED", "Agent 会话已过期");
        audit("agent_session.expired", {
          tenantId: agent.tenantId,
          pageSessionId: agent.pageSessionId,
          agentSessionId: agent.id,
          agentId: agent.agentId,
        });
      }
    }
    for (const [id, entry] of requests) {
      if (entry.createdAt + resultTtlMs < current) {
        clearEntryTimer(entry);
        requests.delete(id);
      }
    }
  }

  return {
    config,
    createPageSession,
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
  };
}

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new GatewayError("INVALID_REQUEST", `${field} 必须是非空字符串`, 400);
  return value.trim();
}

function normalizeScope(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new GatewayError("INVALID_SCOPE", "scope 必须是字符串数组", 400);
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) throw new GatewayError("INVALID_SCOPE", "scope 必须是非空字符串数组", 400);
    seen.add(item.trim());
  }
  return [...seen];
}

function scopeSubset(requested, allowed) {
  if (allowed.includes("*")) return true;
  const set = new Set(allowed);
  return requested.every((item) => item !== "*" && set.has(item));
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

function clampTtl(value, maximum, fallback) {
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return Math.min(value, maximum);
}

function positive(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function websocketUrl(base) {
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/surface`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function emailNoop(value) {
  void value;
}
