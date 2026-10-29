#!/usr/bin/env node
import { createInterface } from "node:readline";
import { SurfaceBridge } from "./lib/surface-bridge.mjs";
import { createMcpHandler } from "./lib/mcp.mjs";

const port = Number(process.env.PLING_SURFACE_BRIDGE_PORT ?? 5283);
const appUrl = process.env.PLING_SURFACE_APP_URL ?? "http://localhost:5191/external-agent-surface/?mcp=1";
const token = process.env.PLING_SURFACE_TOKEN ?? "pling-todo-local";

const bridge = new SurfaceBridge({ port, appUrl, token });
const mcp = createMcpHandler({ bridge });

try {
  const address = await bridge.start();
  process.stderr.write(`[pling-todo] loopback bridge ${address.url}\n`);
  process.stderr.write(`[pling-todo] waiting for ${appUrl}\n`);
} catch (error) {
  process.stderr.write(`[pling-todo] bridge failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (line.trim()) void handleLine(line);
});

async function handleLine(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  if (request.id === undefined || request.id === null) return;
  try {
    const result = await mcp.handle(request.method, request.params ?? {});
    write({ jsonrpc: "2.0", id: request.id, result });
  } catch (error) {
    write({
      jsonrpc: "2.0",
      id: request.id,
      error: { code: error?.code === "METHOD_NOT_FOUND" ? -32601 : -32603, message: error instanceof Error ? error.message : String(error) },
    });
  }
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await bridge.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
rl.on("close", () => void stop());
