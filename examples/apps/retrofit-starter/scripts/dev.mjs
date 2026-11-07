import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const children = [];
let stopping = false;

if (!(await healthy("http://127.0.0.1:5192/health"))) {
  const gateway = spawn(process.execPath, ["examples/gateway.mjs"], { cwd: repoRoot, env: process.env, stdio: "inherit" });
  children.push(gateway);
  gateway.on("exit", (code) => {
    if (!stopping && code !== 0) shutdown();
  });
  await waitFor("http://127.0.0.1:5192/health", "model gateway");
}

const vite = spawn(pnpm, ["exec", "vite", "--config", "./vite.config.ts", "--host", "127.0.0.1", "--port", "5230", "--strictPort"], {
  cwd: packageRoot,
  env: process.env,
  stdio: "inherit",
});
children.push(vite);
vite.on("exit", (code) => {
  if (!stopping && code !== 0) shutdown();
});

process.stderr.write("[retrofit-starter] integrated  http://127.0.0.1:5230/?lang=zh\n");
process.stderr.write("[retrofit-starter] baseline    http://127.0.0.1:5230/baseline/?lang=zh\n");

function shutdown(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill(signal);
}

async function healthy(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(700) })).ok;
  } catch {
    return false;
  }
}

async function waitFor(url, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await healthy(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  console.error(`[retrofit-starter] ${label} did not start at ${url}`);
  shutdown();
  process.exit(1);
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  setTimeout(() => process.exit(0), 200);
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  setTimeout(() => process.exit(0), 200);
});
