import assert from "node:assert/strict";
import test from "node:test";
import { createTodoServer } from "../app.mjs";
import {
  parseSurfaceScopes,
  provisionPageSession,
  SurfaceConfigurationError,
  SurfaceProvisionError,
  TODO_SURFACE_SCOPES,
} from "../surface.mjs";

test("parses a deployment-level Surface scope without accepting unknown capabilities", () => {
  assert.deepEqual(parseSurfaceScopes(undefined), TODO_SURFACE_SCOPES);
  assert.deepEqual(parseSurfaceScopes("add_task, toggle@,add_task"), ["add_task", "toggle@"]);
  assert.throws(
    () => parseSurfaceScopes("add_task,click"),
    (error) =>
      error instanceof SurfaceConfigurationError &&
      error.message.includes("click") &&
      error.message.includes("add_task, toggle@, delete@, clear_completed"),
  );
  assert.throws(() => parseSurfaceScopes(" , "), SurfaceConfigurationError);
});

test("provisions a page session server-to-server without exposing the admin token", async () => {
  let request;
  const page = await provisionPageSession({
    gatewayUrl: "https://surface.example.com/",
    adminToken: "admin-secret",
    tenantId: "demo",
    userId: "u_1",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return Response.json({
        pageSessionId: "ps_1",
        token: "plg_page_short",
        expiresAt: Date.now() + 60_000,
        tenantId: "demo",
        surfaceUrl: "wss://surface.example.com/surface",
        pairingUrl: "https://surface.example.com/v1/pairings",
        agentSessionsUrl: "https://surface.example.com/v1/agent-sessions",
        mcpUrl: "https://surface.example.com/mcp",
      });
    },
  });

  assert.equal(request.url, "https://surface.example.com/v1/page-sessions");
  assert.equal(request.init.headers.authorization, "Bearer admin-secret");
  assert.deepEqual(JSON.parse(request.init.body), {
    tenantId: "demo",
    userId: "u_1",
    scope: TODO_SURFACE_SCOPES,
  });
  assert.equal(page.pageToken, "plg_page_short");
  assert.equal(page.surfaceUrl, "wss://surface.example.com/surface?token=plg_page_short");
  assert.equal(JSON.stringify(page).includes("admin-secret"), false);
});

test("maps gateway authentication failures to a service configuration error", async () => {
  await assert.rejects(
    provisionPageSession({
      gatewayUrl: "https://surface.example.com",
      adminToken: "wrong",
      userId: "u_1",
      fetchImpl: async () => Response.json({ error: { code: "ADMIN_UNAUTHORIZED", message: "no" } }, { status: 401 }),
    }),
    (error) => error instanceof SurfaceProvisionError && error.code === "ADMIN_UNAUTHORIZED" && error.status === 503,
  );
});

test("BFF requires login and returns only the page session to the browser", async (t) => {
  let provisioned = null;
  const server = createTodoServer({
    provision: async (input) => {
      provisioned = input;
      return {
        pageSessionId: "ps_1",
        pageToken: "plg_page_short",
        expiresAt: Date.now() + 60_000,
        tenantId: "demo",
        surfaceUrl: "ws://127.0.0.1:5219/surface?token=plg_page_short",
        pairingUrl: "http://127.0.0.1:5219/v1/pairings",
        agentSessionsUrl: "http://127.0.0.1:5219/v1/agent-sessions",
        mcpUrl: "http://127.0.0.1:5219/mcp",
        scope: TODO_SURFACE_SCOPES,
      };
    },
    surface: { gatewayUrl: "http://127.0.0.1:5219", adminToken: "server-only", tenantId: "demo" },
    logger: () => {},
  });
  const { port } = await server.start(0, "127.0.0.1");
  t.after(() => server.stop());
  const base = `http://127.0.0.1:${port}`;

  const anonymous = await fetch(`${base}/api/surface/page-session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(anonymous.status, 401);

  const registration = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "ada@example.com", password: "correct horse", name: "Ada" }),
  });
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const registered = await registration.json();

  const response = await fetch(`${base}/api/surface/page-session`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: "{}",
  });
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.pageToken, "plg_page_short");
  assert.equal(provisioned.userId, registered.user.id);
  assert.equal(JSON.stringify(payload).includes("server-only"), false);
});

test("returns 503 rather than inventing access when Surface is not configured", async (t) => {
  const server = createTodoServer({ logger: () => {} });
  const { port } = await server.start(0, "127.0.0.1");
  t.after(() => server.stop());
  const base = `http://127.0.0.1:${port}`;

  const registration = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "ada@example.com", password: "correct horse" }),
  });
  const cookie = registration.headers.get("set-cookie");
  const response = await fetch(`${base}/api/surface/page-session`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: "{}",
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "SURFACE_NOT_CONFIGURED");
});
