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

const vite = spawn(pnpm, ["exec", "vite", "--config", "./vite.config.ts", "--host", "127.0.0.1", "--port", "5231", "--strictPort"], {
  cwd: packageRoot,
  env: process.env,
  stdio: "inherit",
});
children.push(vite);
vite.on("exit", (code) => {
  if (!stopping && code !== 0) shutdown();
});

process.stderr.write("[retrofit-full] integrated  http://127.0.0.1:5231/?lang=zh\n");
process.stderr.write("[retrofit-full] baseline    http://127.0.0.1:5231/baseline/?lang=zh\n");
process.stderr.write("[retrofit-full] external Surface is optional; start pnpm surface:dev for a local gateway\n");

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
  console.error(`[retrofit-full] ${label} did not start at ${url}`);
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
