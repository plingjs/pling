import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "../server/env.mjs";

const root = fileURLToPath(new URL("../../../..", import.meta.url));
const caseRoot = fileURLToPath(new URL("../", import.meta.url));
loadEnvFiles([`${caseRoot}.env.local`, `${caseRoot}.env`]);

const externalGateway = Boolean(process.env.SURFACE_ADMIN_TOKEN && process.env.SURFACE_GATEWAY_URL);
const adminToken = process.env.SURFACE_ADMIN_TOKEN || randomBytes(32).toString("hex");
const gatewayUrl = process.env.SURFACE_GATEWAY_URL || "http://127.0.0.1:5219";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const children = [];
let stopping = false;

if (!externalGateway) {
  start("surface-gateway", process.execPath, ["services/surface-gateway/src/index.mjs"], {
    ...process.env,
    SURFACE_ADMIN_TOKEN: adminToken,
    SURFACE_HOST: "127.0.0.1",
    SURFACE_PORT: "5219",
    SURFACE_PUBLIC_BASE_URL: gatewayUrl,
  });
  await waitFor(`${gatewayUrl}/health`, "Surface Gateway");
}

start("todo-bff", process.execPath, ["examples/apps/todo-surface-auth/server/index.mjs"], {
  ...process.env,
  SURFACE_ADMIN_TOKEN: adminToken,
  SURFACE_GATEWAY_URL: gatewayUrl,
});
await waitFor("http://127.0.0.1:5221/api/health", "Todo BFF");

start("vite", pnpm, ["exec", "vite", "--config", "./vite.config.ts", "--host", "127.0.0.1", "--port", "5220", "--strictPort"], process.env, caseRoot);

process.stderr.write("[todo-demo] open http://127.0.0.1:5220/\n");
process.stderr.write("[todo-demo] register, then use the Agent Surface panel to pair a third-party Agent\n");

function start(label, command, args, env, cwd = root) {
  const child = spawn(command, args, { cwd, env, stdio: "inherit" });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (stopping || signal || code === 0) return;
    console.error(`[todo-demo] ${label} exited with code ${code}`);
    shutdown("SIGTERM");
  });
  return child;
}

async function waitFor(url, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (response.ok) return;
    } catch {
      // Keep waiting for the child process to bind its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  console.error(`[todo-demo] ${label} did not become ready at ${url}`);
  shutdown("SIGTERM");
  process.exit(1);
}

function shutdown(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  setTimeout(() => process.exit(0), 200);
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  setTimeout(() => process.exit(0), 200);
});
