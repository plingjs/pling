#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "../server/env.mjs";

const caseRoot = fileURLToPath(new URL("../", import.meta.url));
loadEnvFiles([`${caseRoot}.env.local`, `${caseRoot}.env`]);

const args = process.argv.slice(2);
const code = args.find((value) => !value.startsWith("--"));
const agentIndex = args.indexOf("--agent");
const agentId = agentIndex >= 0 ? args[agentIndex + 1] : "codex";

if (!code) {
  process.stderr.write("Usage: pnpm surface:claim <pairing-code> [--agent codex]\n");
  process.exit(1);
}
if (!agentId) {
  process.stderr.write("--agent requires a non-empty name\n");
  process.exit(1);
}

const gateway = (process.env.SURFACE_GATEWAY_URL || "http://127.0.0.1:5219").replace(/\/$/, "");
let response;
try {
  response = await fetch(`${gateway}/v1/agent-sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, agentId }),
  });
} catch (error) {
  process.stderr.write(`Surface Gateway is unreachable at ${gateway}: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

const payload = await response.json().catch(() => null);
if (!response.ok) {
  process.stderr.write(`${payload?.error?.code ?? "CLAIM_FAILED"}: ${payload?.error?.message ?? `HTTP ${response.status}`}\n`);
  process.exit(1);
}

const config = {
  mcpServers: {
    "pling-todo": {
      type: "http",
      url: payload.mcpUrl,
      headers: { Authorization: `Bearer ${payload.token}` },
    },
  },
};

process.stdout.write(`Agent session: ${payload.agentSessionId}\n`);
process.stdout.write(`Agent id:      ${payload.agentId}\n`);
process.stdout.write(`Expires:       ${new Date(payload.expiresAt).toISOString()}\n`);
process.stdout.write(`Scope:         ${payload.scope.join(", ")}\n\n`);
process.stdout.write("Bearer token (treat as a secret):\n");
process.stdout.write(`${payload.token}\n\n`);
process.stdout.write("MCP client configuration:\n");
process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
