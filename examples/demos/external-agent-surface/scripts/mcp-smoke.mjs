#!/usr/bin/env node
/**
 * End-to-end smoke without Codex or Claude:
 * MCP stdio client -> mcp-server.mjs -> loopback bridge -> simulated Todo page.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ORIGIN = "http://localhost:5191";
const TOKEN = "pling-todo-local";

const child = spawn(process.execPath, ["mcp-server.mjs"], {
  cwd: ROOT,
  env: {
    ...process.env,
    PLING_SURFACE_BRIDGE_PORT: "0",
    PLING_SURFACE_APP_URL: `${ORIGIN}/external-agent-surface/?mcp=1`,
    PLING_SURFACE_TOKEN: TOKEN,
  },
  stdio: ["pipe", "pipe", "pipe"],
});

let stderr = "";
const bridgeReady = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Timed out waiting for the MCP server")), 5_000);
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
    const match = stderr.match(/loopback bridge (ws:\/\/127\.0\.0\.1:\d+\/surface)/);
    if (!match) return;
    clearTimeout(timer);
    resolve(match[1]);
  });
  child.once("exit", (code) => {
    clearTimeout(timer);
    reject(new Error(`MCP server exited early (${code})\n${stderr}`));
  });
});

const responses = new Map();
let seq = 0;
let stdoutBuffer = "";
child.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk.toString();
  for (;;) {
    const newline = stdoutBuffer.indexOf("\n");
    if (newline < 0) break;
    const line = stdoutBuffer.slice(0, newline).trim();
    stdoutBuffer = stdoutBuffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    const waiter = responses.get(message.id);
    if (!waiter) continue;
    responses.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  }
});

function rpc(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    responses.set(id, { resolve, reject });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

function connectPage(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${url}?token=${TOKEN}`, { origin: ORIGIN });
    socket.once("error", reject);
    socket.once("open", () => {
      socket.send(JSON.stringify({ type: "hello", protocol: "pling.bridge/0.1", app: "smoke-todo" }));
      socket.on("message", (raw) => onPageMessage(socket, JSON.parse(raw.toString())));
      resolve(socket);
    });
  });
}

function onPageMessage(socket, message) {
  if (message.type !== "request") return;
  if (message.request.method === "describe") {
    socket.send(
      JSON.stringify({
        type: "response",
        requestId: message.requestId,
        response: {
          protocol: "pling.surface/0.1",
          id: message.requestId,
          ok: true,
          result: {
            protocol: "pling.surface/0.1",
            app: "smoke-todo",
            capabilities: [
              {
                id: "todo.toggle",
                description: "Toggle one task",
                inputSchema: { type: "object", required: ["taskId"] },
                effect: "write",
                approval: "never",
                fidelity: "high",
                source: "declared",
              },
              {
                id: "todo.delete",
                description: "Delete one task",
                inputSchema: { type: "object", required: ["taskId"] },
                effect: "destructive",
                approval: "ask",
                fidelity: "high",
                source: "declared",
              },
            ],
            context: { records: [{ id: "t1", fields: { text: "Prepare demo", status: "open" } }] },
          },
        },
      }),
    );
    return;
  }
  if (message.request.method === "invoke" && message.request.capability === "todo.delete") {
    socket.send(
      JSON.stringify({
        type: "approval_pending",
        requestId: message.requestId,
        approval: { description: "Delete Prepare demo", args: message.request.input, kind: "danger", expiresAt: Date.now() + 60_000 },
      }),
    );
    setTimeout(() => {
      socket.send(
        JSON.stringify({
          type: "response",
          requestId: message.requestId,
          response: {
            protocol: "pling.surface/0.1",
            id: message.requestId,
            ok: true,
            result: { result: { ok: false, error: { code: "PERMISSION_DENIED", message: "The user denied the action" } } },
          },
        }),
      );
    }, 30);
  }
}

try {
  const url = await bridgeReady;
  const page = await connectPage(url);
  await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
  const tools = await rpc("tools/list");
  const names = tools.tools.map((tool) => tool.name);
  if (names.some((name) => name.includes("approve"))) throw new Error("MCP must not expose an approval tool");

  const description = await rpc("tools/call", { name: "pling_surface_describe", arguments: {} });
  if (!description.content[0].text.includes("todo.toggle")) throw new Error("describe did not return Todo capabilities");

  const invocation = await rpc("tools/call", {
    name: "pling_surface_invoke",
    arguments: { capability: "todo.delete", input: { taskId: "t1" } },
  });
  const requestId = invocation.content[0].text.match(/requestId: (\S+)/)?.[1];
  if (!requestId) throw new Error("invoke did not return a requestId for approval");

  await new Promise((resolve) => setTimeout(resolve, 60));
  const status = await rpc("tools/call", { name: "pling_surface_approval_status", arguments: { requestId } });
  const final = JSON.parse(status.content[0].text);
  if (final.state !== "done") throw new Error(`Expected done after page decision, received ${final.state}`);
  page.close();
  console.log("tools:", names.join(", "));
  console.log("✓ MCP stdio → loopback bridge → Todo surface passed");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (stderr) console.error(stderr.trim());
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
}
