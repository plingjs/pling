import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { GatewayError, asGatewayError } from "./errors.mjs";
import { createSurfaceGateway } from "./gateway.mjs";
import { createMcpHandler } from "./mcp.mjs";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_WS_PAYLOAD_BYTES = 512 * 1024;
const HELLO_TIMEOUT_MS = 5_000;
const HEARTBEAT_MS = 30_000;

/**
 * HTTP + WebSocket transport for the Surface gateway.
 *
 * The gateway core owns sessions and capability forwarding. This module only
 * authenticates transport requests, applies Origin policy, and maps errors to
 * HTTP / JSON-RPC responses. It never executes a page capability itself.
 */
export function createSurfaceServer(options) {
  if (!options?.config) throw new Error("config is required");
  if (!options?.adminToken) throw new Error("adminToken is required");

  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? 5219;
  const allowedOrigins = new Set(options.config.tenants.flatMap((tenant) => tenant.origins));
  const logger = options.logger ?? ((message) => process.stderr.write(`${message}\n`));
  const demoTenantId = options.demoTenantId?.trim() || "demo";
  let gateway = null;
  let mcp = null;
  let baseUrl = null;
  let heartbeat = null;

  const server = createServer((request, response) => {
    void route(request, response).catch((error) => {
      const failure = asGatewayError(error);
      if (!response.headersSent) sendError(response, failure);
      else response.destroy();
    });
  });

  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD_BYTES });

  server.on("upgrade", (request, socket, head) => {
    void upgrade(request, socket, head).catch(() => {
      writeUpgradeFailure(socket, 400, "Bad Request");
    });
  });

  async function upgrade(request, socket, head) {
    if (!gateway) return writeUpgradeFailure(socket, 503, "Service Unavailable");
    const url = requestUrl(request);
    if (url.pathname !== "/surface") return writeUpgradeFailure(socket, 404, "Not Found");

    let page;
    try {
      page = gateway.authenticatePage(url.searchParams.get("token"), request.headers.origin);
    } catch (error) {
      const failure = asGatewayError(error);
      return writeUpgradeFailure(socket, failure.status, failure.message);
    }

    sockets.handleUpgrade(request, socket, head, (ws) => {
      acceptPage(ws, page, request.headers.origin);
    });
  }

  function acceptPage(ws, page, origin) {
    let attached = false;
    let closed = false;
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const helloTimer = setTimeout(() => {
      if (!attached) ws.close(4008, "hello timeout");
    }, HELLO_TIMEOUT_MS);

    ws.on("message", (raw, isBinary) => {
      if (closed) return;
      if (isBinary) return ws.close(1003, "text messages only");
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return ws.close(1003, "invalid json");
      }
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        return ws.close(1003, "invalid message");
      }

      if (!attached) {
        if (message.type !== "hello" || message.protocol !== "pling.bridge/0.1") {
          return ws.close(1002, "bridge hello required");
        }
        clearTimeout(helloTimer);
        try {
          gateway.attachPage(page, ws, origin);
        } catch {
          return ws.close(1008, "page rejected");
        }
        attached = true;
        ws.send(JSON.stringify({ type: "hello_ack", protocol: "pling.bridge/0.1" }));
        return;
      }

      if (message.type === "hello") return ws.close(1002, "duplicate hello");
      gateway.notePageMessage(page, message);
    });

    ws.on("close", (code, reason) => {
      closed = true;
      clearTimeout(helloTimer);
      if (!attached) return;
      gateway.disconnectPage(page, reason?.toString() || `page closed (${code})`, ws);
    });
    ws.on("error", () => {});
  }

  async function route(request, response) {
    setCommonHeaders(response);
    const url = requestUrl(request);
    const origin = request.headers.origin;
    const cors = origin && allowedOrigins.has(origin);
    if (origin && cors) {
      response.setHeader("access-control-allow-origin", origin);
      response.setHeader("vary", "Origin");
      response.setHeader("access-control-allow-headers", "authorization, content-type");
      response.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
    }

    if (request.method === "OPTIONS") {
      if (!cors) return sendJson(response, 403, { error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin not allowed" } });
      response.writeHead(204);
      return response.end();
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { ok: true, service: "pling-surface-gateway", now: new Date().toISOString() });
    }

    if (request.method === "GET") {
      const discovery = url.pathname.match(/^\/v1\/discovery\/([^/]+)$/);
      if (discovery) {
        return sendJson(response, 200, gateway.discover(decodeURIComponent(discovery[1])));
      }
    }

    if (request.method === "POST" && url.pathname === "/v1/page-sessions") {
      requireAdmin(request);
      return sendJson(response, 201, gateway.createPageSession(await readJson(request)));
    }

    if (request.method === "POST" && url.pathname === "/v1/demo/page-sessions") {
      if (!origin) throw new GatewayError("ORIGIN_REQUIRED", "公开案例请求必须携带 Origin", 403);
      await readJson(request);
      return sendJson(
        response,
        201,
        gateway.createPublicDemoPageSession({
          tenantId: demoTenantId,
          origin,
          clientKey: clientKeyOf(request),
        }),
      );
    }

    if (request.method === "POST" && url.pathname === "/v1/pairings") {
      const body = await readJson(request);
      if (!origin) throw new GatewayError("ORIGIN_REQUIRED", "页面请求必须携带 Origin", 403);
      gateway.authenticatePage(body.pageToken, origin);
      return sendJson(response, 201, gateway.createPairing(body));
    }

    if (request.method === "POST" && url.pathname === "/v1/agent-sessions") {
      return sendJson(response, 201, gateway.claimPairing(await readJson(request)));
    }

    if (request.method === "POST" && url.pathname === "/v1/agent-sessions/revoke") {
      const body = await readJson(request);
      if (!origin) throw new GatewayError("ORIGIN_REQUIRED", "页面请求必须携带 Origin", 403);
      const page = gateway.authenticatePage(body.pageToken, origin);
      const sessions = gateway.listSessions().agentSessions;
      const agent = sessions.find((item) => item.id === body.agentSessionId);
      if (!agent || agent.pageSessionId !== page.id) {
        throw new GatewayError("AGENT_SESSION_NOT_FOUND", "Agent 会话不存在或不属于当前页面", 404);
      }
      return sendJson(response, 200, gateway.revokeAgentSession(agent.id, "page owner revoked"));
    }

    if (request.method === "GET" && url.pathname === "/admin/sessions") {
      requireAdmin(request);
      return sendJson(response, 200, gateway.listSessions());
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/admin/page-sessions/")) {
      requireAdmin(request);
      return sendJson(response, 200, gateway.revokePageSession(decodeURIComponent(url.pathname.slice(21)), "admin revoked"));
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/admin/agent-sessions/")) {
      requireAdmin(request);
      return sendJson(response, 200, gateway.revokeAgentSession(decodeURIComponent(url.pathname.slice(22)), "admin revoked"));
    }

    if (request.method === "POST" && url.pathname === "/mcp") {
      const agentToken = requireBearer(request);
      gateway.authenticateAgent(agentToken);
      const body = await readJson(request, 1024 * 1024);
      const result = await mcp.handle(body, { agentToken });
      if (result === null) {
        response.writeHead(202);
        return response.end();
      }
      return sendJson(response, 200, result);
    }

    throw new GatewayError("NOT_FOUND", `No route for ${request.method} ${url.pathname}`, 404);
  }

  function requireAdmin(request) {
    const token = requireBearer(request);
    if (!constantEqual(token, options.adminToken)) {
      throw new GatewayError("ADMIN_UNAUTHORIZED", "Admin token 无效", 401);
    }
  }

  async function start() {
    if (gateway) throw new Error("server already started");
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(requestedPort, host);
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : requestedPort;
    baseUrl = (options.publicBaseUrl ?? `http://${displayHost(host)}:${port}`).replace(/\/$/, "");
    gateway = createSurfaceGateway({
      config: options.config,
      adminToken: options.adminToken,
      publicBaseUrl: baseUrl,
      ...options.gateway,
    });
    mcp = createMcpHandler(gateway);
    heartbeat = setInterval(() => {
      for (const ws of sockets.clients) {
        if (ws.isAlive === false) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch {
          ws.terminate();
        }
      }
    }, HEARTBEAT_MS);
    heartbeat.unref?.();
    logger(`[surface-gateway] listening on ${baseUrl}`);
    return { baseUrl, port };
  }

  async function stop() {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    for (const ws of sockets.clients) ws.terminate();
    await new Promise((resolve) => sockets.close(() => resolve()));
    if (!server.listening) return;
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }

  return {
    get gateway() {
      return gateway;
    },
    get baseUrl() {
      return baseUrl;
    },
    start,
    stop,
  };
}

function clientKeyOf(request) {
  const forwarded = request.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const address = first?.split(",")[0]?.trim() || request.socket.remoteAddress || "unknown";
  return address;
}

function requestUrl(request) {
  try {
    return new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  } catch {
    throw new GatewayError("BAD_REQUEST", "无效的请求 URL", 400);
  }
}

async function readJson(request, limit = MAX_BODY_BYTES) {
  const type = String(request.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
  if (type !== "application/json") throw new GatewayError("UNSUPPORTED_MEDIA_TYPE", "Content-Type 必须是 application/json", 415);
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new GatewayError("BODY_TOO_LARGE", "请求体超过限制", 413);
    chunks.push(chunk);
  }
  if (size === 0) throw new GatewayError("INVALID_JSON", "请求体不能为空", 400);
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value;
  } catch {
    throw new GatewayError("INVALID_JSON", "请求体必须是 JSON 对象", 400);
  }
}

function requireBearer(request) {
  const header = String(request.headers.authorization ?? "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1].trim()) throw new GatewayError("UNAUTHORIZED", "缺少 Bearer token", 401);
  return match[1].trim();
}

function setCommonHeaders(response) {
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
}

function sendJson(response, status, value) {
  if (response.writableEnded) return;
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendError(response, error) {
  sendJson(response, error.status ?? 500, { error: { code: error.code ?? "INTERNAL_ERROR", message: error.message } });
}

function writeUpgradeFailure(socket, status, message) {
  if (socket.destroyed) return;
  const statusText = status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : status === 404 ? "Not Found" : "Bad Request";
  socket.end(`HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
}

function constantEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function displayHost(host) {
  return host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
}
