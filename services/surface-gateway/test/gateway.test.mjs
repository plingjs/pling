import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConfig } from "../src/config.mjs";
import { createSurfaceGateway } from "../src/gateway.mjs";

const ORIGIN = "https://demo.example";
const PUBLIC_DEMO_ORIGIN = "https://plingjs.dev";
const ADMIN = "admin-token-for-tests";

class MockSocket {
  readyState = 1;
  messages = [];
  closed = null;

  send(value) {
    this.messages.push(JSON.parse(value));
  }

  close(code, reason) {
    this.readyState = 3;
    this.closed = { code, reason };
  }
}

function setup(overrides = {}) {
  let clock = 1_000_000;
  const gateway = createSurfaceGateway({
    adminToken: ADMIN,
    publicBaseUrl: "https://surface.example",
    config: normalizeConfig({
      tenants: [
        {
          id: "demo",
          displayName: "Demo",
          origins: [ORIGIN, PUBLIC_DEMO_ORIGIN],
          maxPageSessionTtlMs: 60_000,
          maxAgentSessionTtlMs: 60_000,
          publicDemo: {
            origins: [PUBLIC_DEMO_ORIGIN],
            scope: ["todo.overview", "todo.add"],
            pageSessionTtlMs: 30_000,
            maxSessionsPerWindow: 2,
            windowMs: 60_000,
            maxActiveSessions: 2,
          },
        },
      ],
    }),
    now: () => clock,
    requestTimeoutMs: 20,
    approvalTimeoutMs: 500,
    ...overrides,
  });
  return {
    gateway,
    advance(ms) {
      clock += ms;
    },
  };
}

function connectedPage(gateway, scope = ["add_task", "delete@task"]) {
  const created = gateway.createPageSession({ tenantId: "demo", userId: "user-1", scope });
  const session = gateway.authenticatePage(created.token, ORIGIN);
  const socket = new MockSocket();
  gateway.attachPage(session, socket, ORIGIN);
  return { created, session, socket };
}

async function pairedAgent(gateway, page, scope) {
  const pairing = gateway.createPairing({ pageToken: page.created.token });
  return gateway.claimPairing({ code: pairing.code, agentId: "codex-test", ...(scope ? { scope } : {}) });
}

function takeRequest(socket) {
  const message = socket.messages.find((item) => item.type === "request");
  assert.ok(message, "page should receive a request envelope");
  socket.messages = socket.messages.filter((item) => item !== message);
  return message;
}

test("page sessions require an allowed Origin and explicit scope", () => {
  const { gateway } = setup();
  assert.throws(
    () => gateway.createPageSession({ tenantId: "demo", userId: "u" }),
    (error) => error.code === "SCOPE_REQUIRED",
  );
  const created = gateway.createPageSession({ tenantId: "demo", userId: "u", scope: ["add_task"] });
  assert.throws(
    () => gateway.authenticatePage(created.token, "https://evil.example"),
    (error) => error.code === "ORIGIN_NOT_ALLOWED",
  );
});

test("public demo sessions are origin-bound, fixed-scope, and rate limited", () => {
  const { gateway, advance } = setup();

  const created = gateway.createPublicDemoPageSession({ tenantId: "demo", origin: PUBLIC_DEMO_ORIGIN, clientKey: "203.0.113.10" });
  assert.deepEqual(gateway.authenticatePage(created.token, PUBLIC_DEMO_ORIGIN).allowedScope, ["todo.overview", "todo.add"]);
  assert.equal(created.expiresAt - 1_000_000, 30_000);

  assert.throws(
    () => gateway.createPublicDemoPageSession({ tenantId: "demo", origin: ORIGIN, clientKey: "203.0.113.10" }),
    (error) => error.code === "ORIGIN_NOT_ALLOWED",
  );

  gateway.createPublicDemoPageSession({ tenantId: "demo", origin: PUBLIC_DEMO_ORIGIN, clientKey: "203.0.113.10" });
  assert.throws(
    () => gateway.createPublicDemoPageSession({ tenantId: "demo", origin: PUBLIC_DEMO_ORIGIN, clientKey: "203.0.113.10" }),
    (error) => error.code === "RATE_LIMITED",
  );

  advance(61_000);
  const next = gateway.createPublicDemoPageSession({ tenantId: "demo", origin: PUBLIC_DEMO_ORIGIN, clientKey: "203.0.113.10" });
  assert.ok(next.pageSessionId);
});

test("pairing is single-use and an Agent scope cannot exceed the page session", async () => {
  const { gateway } = setup();
  const page = connectedPage(gateway, ["add_task"]);
  const pairing = gateway.createPairing({ pageToken: page.created.token });

  assert.throws(
    () => gateway.claimPairing({ code: pairing.code, agentId: "agent", scope: ["delete@task"] }),
    (error) => error.code === "SCOPE_NOT_ALLOWED",
  );

  const agent = gateway.claimPairing({ code: pairing.code, agentId: "agent", scope: ["add_task"] });
  assert.deepEqual(agent.scope, ["add_task"]);
  assert.ok(page.socket.messages.some((item) => item.type === "agent_session" && item.action === "opened"));
  assert.throws(() => gateway.claimPairing({ code: pairing.code, agentId: "second" }), (error) => error.code === "PAIRING_INVALID");
});

test("describe and invoke forward opaque Surface envelopes and keep the final response", async () => {
  const { gateway } = setup();
  const page = connectedPage(gateway);
  const agent = await pairedAgent(gateway, page, ["add_task"]);

  const describe = gateway.describe(agent.token);
  const describeEnvelope = takeRequest(page.socket);
  assert.equal(describeEnvelope.request.method, "describe");
  gateway.notePageMessage(page.session, {
    type: "response",
    requestId: describeEnvelope.requestId,
    response: {
      protocol: "pling.surface/0.1",
      id: describeEnvelope.requestId,
      ok: true,
      result: { app: "demo", capabilities: [], context: { records: [] } },
    },
  });
  assert.equal((await describe).ok, true);

  const invoke = gateway.invoke(agent.token, "add_task", { text: "Ship the gateway" });
  const invokeEnvelope = takeRequest(page.socket);
  assert.deepEqual(invokeEnvelope.request, {
    protocol: "pling.surface/0.1",
    id: invokeEnvelope.requestId,
    method: "invoke",
    capability: "add_task",
    input: { text: "Ship the gateway" },
  });
  gateway.notePageMessage(page.session, {
    type: "response",
    requestId: invokeEnvelope.requestId,
    response: {
      protocol: "pling.surface/0.1",
      id: invokeEnvelope.requestId,
      ok: true,
      result: { result: { ok: true } },
    },
  });
  assert.equal((await invoke).state, "done");
  assert.equal(gateway.status(agent.token, invokeEnvelope.requestId).response.ok, true);
});

test("pending approval is not killed by the ordinary request timeout and can finish later", async () => {
  const { gateway } = setup({ requestTimeoutMs: 10, approvalTimeoutMs: 500 });
  const page = connectedPage(gateway);
  const agent = await pairedAgent(gateway, page, ["delete@task"]);

  const invocation = gateway.invoke(agent.token, "delete@task", { record: "t1" });
  const envelope = takeRequest(page.socket);
  gateway.notePageMessage(page.session, {
    type: "approval_pending",
    requestId: envelope.requestId,
    approval: { description: "Delete task", kind: "destructive", args: { record: "t1" } },
  });

  const first = await invocation;
  assert.equal(first.state, "pending_approval");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(gateway.status(agent.token, envelope.requestId).state, "pending_approval");

  gateway.notePageMessage(page.session, {
    type: "response",
    requestId: envelope.requestId,
    response: {
      protocol: "pling.surface/0.1",
      id: envelope.requestId,
      ok: true,
      result: { result: { ok: true } },
    },
  });
  const final = gateway.status(agent.token, envelope.requestId);
  assert.equal(final.state, "done");
  assert.equal(final.response.ok, true);
});

test("an ordinary page timeout is reported once and remains queryable", async () => {
  const { gateway } = setup({ requestTimeoutMs: 10 });
  const page = connectedPage(gateway);
  const agent = await pairedAgent(gateway, page, ["add_task"]);

  const invocation = gateway.invoke(agent.token, "add_task", { text: "late" });
  const envelope = takeRequest(page.socket);
  const result = await invocation;
  assert.equal(result.state, "done");
  assert.equal(result.response.error.code, "GATEWAY_TIMEOUT");
  assert.equal(gateway.status(agent.token, envelope.requestId).response.error.code, "GATEWAY_TIMEOUT");
});

test("a stale socket close cannot detach the replacement page connection", () => {
  const { gateway } = setup();
  const page = connectedPage(gateway);
  const oldSocket = page.socket;
  const newSocket = new MockSocket();
  gateway.attachPage(page.session, newSocket, ORIGIN);

  assert.equal(oldSocket.closed.code, 4001);
  gateway.disconnectPage(page.session, "old socket closed", oldSocket);
  assert.equal(gateway.listSessions().pageSessions[0].connected, true);

  gateway.disconnectPage(page.session, "real close", newSocket);
  assert.equal(gateway.listSessions().pageSessions[0].connected, false);
});

test("revoking an Agent session fails inflight calls and removes its token", async () => {
  const { gateway } = setup({ requestTimeoutMs: 1_000 });
  const page = connectedPage(gateway);
  const agent = await pairedAgent(gateway, page, ["add_task"]);
  const invocation = gateway.invoke(agent.token, "add_task", { text: "wait" });
  const envelope = takeRequest(page.socket);

  gateway.revokeAgentSession(agent.agentSessionId, "test revoke");
  const result = await invocation;
  assert.equal(result.response.error.code, "SESSION_REVOKED");
  assert.throws(() => gateway.authenticateAgent(agent.token), (error) => error.code === "AGENT_SESSION_INVALID");
  assert.throws(() => gateway.status(agent.token, envelope.requestId), (error) => error.code === "AGENT_SESSION_INVALID");
});
