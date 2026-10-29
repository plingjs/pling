import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const children = [];

function run(label, command, args) {
  const child = spawn(command, args, { cwd: root, stdio: "inherit", env: process.env });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal || code === 0) return;
    console.error(`[pling-demo] ${label} exited with code ${code}`);
  });
  return child;
}

run("gateway", process.execPath, ["gateway.mjs"]);
run("recipe-api", process.execPath, ["recipe-backends/access-service/server.mjs"]);
run("vite", pnpm, ["exec", "vite", "--config", "./vite.config.ts", "--host", "127.0.0.1", "--port", "5191", "--strictPort"]);

function stop(signal = "SIGTERM") {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on("SIGINT", () => {
  stop("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop("SIGTERM");
  process.exit(0);
});
