import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { WebSocket } from "ws";
import { normalizeConfig } from "../src/config.mjs";
import { createSurfaceServer } from "../src/server.mjs";

const ORIGIN = "https://demo.example";
const ADMIN = "transport-admin-token";

async function startServer() {
  const server = createSurfaceServer({
    config: normalizeConfig({
      tenants: [{ id: "demo", displayName: "Demo", origins: [ORIGIN] }],
    }),
    adminToken: ADMIN,
    port: 0,
    host: "127.0.0.1",
    logger: () => {},
    gateway: { requestTimeoutMs: 500, approvalTimeoutMs: 2_000 },
  });
  return { server, ...(await server.start()) };
}

async function call(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

function jsonHeaders(token, origin) {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(origin ? { origin } : {}),
  };
}

function createInbox(ws) {
  const messages = [];
  const waiters = [];
  ws.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    const waiterIndex = waiters.findIndex((waiter) => waiter.predicate(message));
    if (waiterIndex >= 0) {
      const [waiter] = waiters.splice(waiterIndex, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
      return;
    }
    messages.push(message);
  });
  return {
    waitFor(predicate, timeoutMs = 2_000) {
      const index = messages.findIndex(predicate);
      if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, timer: null };
        waiter.timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error("timed out waiting for WebSocket message"));
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
  };
}

test("HTTP + WebSocket + remote MCP complete a describe/invoke/approval loop", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(async () => {
    await server.stop();
  });

  const health = await call(`${baseUrl}/health`);
  assert.equal(health.response.status, 200);
  assert.equal(health.body.ok, true);

  const created = await call(`${baseUrl}/v1/page-sessions`, {
    method: "POST",
    headers: jsonHeaders(ADMIN),
    body: JSON.stringify({ tenantId: "demo", userId: "user-1", scope: ["add_task", "delete@task"] }),
  });
  assert.equal(created.response.status, 201);

  const ws = new WebSocket(`${baseUrl.replace(/^http/, "ws")}/surface?token=${created.body.token}`, { origin: ORIGIN });
  const inbox = createInbox(ws);
  await once(ws, "open");
  ws.send(JSON.stringify({ type: "hello", protocol: "pling.bridge/0.1", app: "transport-test" }));
  assert.equal((await inbox.waitFor((message) => message.type === "hello_ack")).protocol, "pling.bridge/0.1");

  const pairing = await call(`${baseUrl}/v1/pairings`, {
    method: "POST",
    headers: jsonHeaders(null, ORIGIN),
    body: JSON.stringify({ pageToken: created.body.token }),
  });
  assert.equal(pairing.response.status, 201);
  assert.equal(pairing.body.tenantId, "demo");

  const claimed = await call(`${baseUrl}/v1/agent-sessions`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ code: pairing.body.code, agentId: "codex-transport-test", scope: ["add_task"] }),
  });
  assert.equal(claimed.response.status, 201);
  const opened = await inbox.waitFor((message) => message.type === "agent_session" && message.action === "opened");
  assert.deepEqual(opened.session.scope, ["add_task"]);

  const unauthorized = await call(`${baseUrl}/mcp`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
  });
  assert.equal(unauthorized.response.status, 401);

  const mcpHeaders = jsonHeaders(claimed.body.token);
  const describeCall = call(`${baseUrl}/mcp`, {
    method: "POST",
    headers: mcpHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "pling_surface_describe", arguments: {} },
    }),
  });
  const describeEnvelope = await inbox.waitFor((message) => message.type === "request");
  assert.equal(describeEnvelope.request.method, "describe");
  ws.send(
    JSON.stringify({
      type: "response",
      requestId: describeEnvelope.requestId,
      response: {
        protocol: "pling.surface/0.1",
        id: describeEnvelope.requestId,
        ok: true,
        result: { app: "transport-test", capabilities: [], context: { records: [] } },
      },
    }),
  );
  const described = await describeCall;
  assert.equal(described.response.status, 200);
  assert.match(described.body.result.content[0].text, /transport-test/);

  const invokeCall = call(`${baseUrl}/mcp`, {
    method: "POST",
    headers: mcpHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "pling_surface_invoke", arguments: { capability: "add_task", input: { text: "Test" } } },
    }),
  });
  const invokeEnvelope = await inbox.waitFor((message) => message.type === "request");
  ws.send(
    JSON.stringify({
      type: "approval_pending",
      requestId: invokeEnvelope.requestId,
      approval: { description: "Add one task", kind: "write" },
    }),
  );
  const pending = await invokeCall;
  assert.match(pending.body.result.content[0].text, /pending|Waiting for user confirmation/);
  assert.match(pending.body.result.content[0].text, new RegExp(invokeEnvelope.requestId));

  const statusCall = call(`${baseUrl}/mcp`, {
    method: "POST",
    headers: mcpHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "pling_surface_approval_status", arguments: { requestId: invokeEnvelope.requestId } },
    }),
  });
  const pendingStatus = await statusCall;
  assert.match(pendingStatus.body.result.content[0].text, /pending_approval/);

  ws.send(
    JSON.stringify({
      type: "response",
      requestId: invokeEnvelope.requestId,
      response: {
        protocol: "pling.surface/0.1",
        id: invokeEnvelope.requestId,
        ok: true,
        result: { result: { ok: true } },
      },
    }),
  );
  const finalStatus = await call(`${baseUrl}/mcp`, {
    method: "POST",
    headers: mcpHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "pling_surface_approval_status", arguments: { requestId: invokeEnvelope.requestId } },
    }),
  });
  assert.match(finalStatus.body.result.content[0].text, /"state": "done"/);

  const sessions = await call(`${baseUrl}/admin/sessions`, { headers: { authorization: `Bearer ${ADMIN}` } });
  assert.equal(sessions.body.pageSessions.length, 1);
  assert.equal(sessions.body.agentSessions.length, 1);

  const revoke = await call(`${baseUrl}/admin/agent-sessions/${claimed.body.agentSessionId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${ADMIN}` },
  });
  assert.equal(revoke.body.revokedAt >= 0, true);

  ws.close();
  if (ws.readyState !== WebSocket.CLOSED) await once(ws, "close");
});

test("page pairing requires the page Origin and an open WebSocket", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(async () => {
    await server.stop();
  });

  const created = await call(`${baseUrl}/v1/page-sessions`, {
    method: "POST",
    headers: jsonHeaders(ADMIN),
    body: JSON.stringify({ tenantId: "demo", userId: "user-1", scope: ["add_task"] }),
  });
  const noOrigin = await call(`${baseUrl}/v1/pairings`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ pageToken: created.body.token }),
  });
  assert.equal(noOrigin.response.status, 403);

  const wrongOrigin = await call(`${baseUrl}/v1/pairings`, {
    method: "POST",
    headers: jsonHeaders(null, "https://evil.example"),
    body: JSON.stringify({ pageToken: created.body.token }),
  });
  assert.equal(wrongOrigin.response.status, 403);

  const notConnected = await call(`${baseUrl}/v1/pairings`, {
    method: "POST",
    headers: jsonHeaders(null, ORIGIN),
    body: JSON.stringify({ pageToken: created.body.token }),
  });
  assert.equal(notConnected.response.status, 409);
});
