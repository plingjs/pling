import assert from "node:assert/strict";
import test from "node:test";
import { createMcpHandler } from "../src/mcp.mjs";

function fakeGateway() {
  const calls = [];
  return {
    calls,
    async describe(token) {
      calls.push(["describe", token]);
      if (token !== "agent-token") throw new Error("bad token");
      return {
        ok: true,
        result: { protocol: "pling.surface/0.1", capabilities: [], context: { records: [] } },
      };
    },
    async invoke(token, capability, input) {
      calls.push(["invoke", token, capability, input]);
      return {
        state: "pending_approval",
        requestId: "plg_req_1",
        capability,
        approval: { description: "Delete one task" },
      };
    },
    status(token, requestId) {
      calls.push(["status", token, requestId]);
      return { state: "pending_approval", requestId };
    },
  };
}

function rpc(id, method, params = {}) {
  return { jsonrpc: "2.0", id, method, params };
}

test("MCP binds the bearer token outside model-visible tool arguments", async () => {
  const gateway = fakeGateway();
  const mcp = createMcpHandler(gateway);
  const response = await mcp.handle(
    rpc(1, "tools/call", { name: "pling_surface_describe", arguments: { _agentToken: "attacker-controlled" } }),
    { agentToken: "agent-token" },
  );

  assert.equal(response.result.isError, undefined);
  assert.deepEqual(gateway.calls.at(-1), ["describe", "agent-token"]);
  assert.match(response.result.content[0].text, /pling\.surface/);
});

test("pending approval is returned as a state, never as an approval tool", async () => {
  const gateway = fakeGateway();
  const mcp = createMcpHandler(gateway);
  const listed = await mcp.handle(rpc(1, "tools/list"), { agentToken: "agent-token" });
  assert.deepEqual(
    listed.result.tools.map((tool) => tool.name),
    ["pling_surface_describe", "pling_surface_invoke", "pling_surface_approval_status"],
  );

  const invoked = await mcp.handle(
    rpc(2, "tools/call", { name: "pling_surface_invoke", arguments: { capability: "delete@task", input: { record: "t1" } } }),
    { agentToken: "agent-token" },
  );
  assert.match(invoked.result.content[0].text, /Waiting for user confirmation/);
  assert.match(invoked.result.content[0].text, /Do not claim approval/);

  const status = await mcp.handle(
    rpc(3, "tools/call", { name: "pling_surface_approval_status", arguments: { requestId: "plg_req_1" } }),
    { agentToken: "agent-token" },
  );
  assert.match(status.result.content[0].text, /pending_approval/);
});

test("notifications do not produce an MCP response", async () => {
  const mcp = createMcpHandler(fakeGateway());
  assert.equal(await mcp.handle({ jsonrpc: "2.0", method: "notifications/initialized" }, { agentToken: "agent-token" }), null);
});
