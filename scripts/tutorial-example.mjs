#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, cp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { ALL_PACKAGES, buildAndPackPackages, run } from "./lib/pack-packages.mjs";

const root = resolve(import.meta.dirname, "..");
const [mode, tutorialArg, ...options] = process.argv.slice(2);
const tutorialId = (tutorialArg ?? "v3-03").toLowerCase();

function parseLocale(value) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "zh" || normalized === "cn" || normalized.startsWith("zh-")) return "zh";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return undefined;
}

let locale;
for (let index = 0; index < options.length; index += 1) {
  const option = options[index];
  const value = option === "--locale" ? options[++index] : option.startsWith("--locale=") ? option.slice("--locale=".length) : undefined;
  if (value === undefined) {
    console.error(`Unknown option "${option}".`);
    console.error("Usage: node scripts/tutorial-example.mjs <dev|check> <tutorial-id> [--locale en|zh]");
    process.exit(1);
  }
  locale = parseLocale(value);
  if (!locale) {
    console.error(`Unsupported locale "${value ?? ""}". Use en or zh.`);
    process.exit(1);
  }
}

if (mode !== "dev" && mode !== "check") {
  console.error("Usage: node scripts/tutorial-example.mjs <dev|check> <tutorial-id> [--locale en|zh]");
  process.exit(1);
}

const registryPath = join(root, "examples", "tutorials", "registry.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const entry = registry[tutorialId];

if (!entry) {
  console.error(`Unknown tutorial "${tutorialId}". Available: ${Object.keys(registry).join(", ")}`);
  process.exit(1);
}

if (!Array.isArray(entry.packages) || entry.packages.length === 0) {
  throw new Error(`${tutorialId} 没有配置 packages`);
}
for (const name of entry.packages) {
  if (!ALL_PACKAGES.includes(name)) throw new Error(`${tutorialId} 引用了未知包 ${name}`);
}

const source = join(root, "examples", "tutorials", entry.dir);
const work = join(root, ".tmp", "tutorials", tutorialId);
const app = mode === "check" ? join(work, "check", "app") : join(work, "app");
const packs = join(work, mode === "check" ? "check-packs" : "packs");

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(join(source, "package.json")))) {
  throw new Error(`教程源目录不存在或缺少 package.json：${source}`);
}

for (const file of entry.docs ?? []) {
  const absolute = join(root, file);
  if (!(await exists(absolute))) throw new Error(`教程文档不存在：${file}`);
  const text = await readFile(absolute, "utf8");
  for (const marker of entry.docMarkers ?? []) {
    const alternatives = typeof marker === "string" ? [marker] : marker.anyOf ?? [];
    if (!alternatives.some((candidate) => text.includes(candidate))) {
      throw new Error(`${file} 与可运行示例不一致，缺少：${alternatives.join(" / ")}`);
    }
  }
}

console.log(`[tutorial] ${entry.title}`);
if (locale) console.log(`[tutorial] locale: ${locale}`);
console.log(`[tutorial] packing ${entry.packages.join(" / ")}`);
const tarballs = await buildAndPackPackages({
  root,
  temp: packs,
  packages: entry.packages,
});

await rm(app, { recursive: true, force: true });
await cp(source, app, { recursive: true });

const manifestPath = join(app, "package.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
for (const name of entry.packages) {
  if (manifest.dependencies?.[name]) manifest.dependencies[name] = `file:${tarballs[name]}`;
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

// A local workspace file prevents pnpm from walking up into the Pling monorepo.
// Overrides resolve the tarballs' exact internal versions without contacting the registry.
const overrides = entry.packages.map((name) => `  "${name}": "file:${tarballs[name]}"`).join("\n");
await writeFile(join(app, "pnpm-workspace.yaml"), `packages:\n  - "."\noverrides:\n${overrides}\n`);

console.log(`[tutorial] installing release-equivalent dependencies in ${app}`);
run("pnpm", ["install", "--ignore-scripts"], { cwd: app });

if (mode === "dev") {
  const base = `http://127.0.0.1:${entry.port}`;
  const url = `${base}/?lang=${locale ?? "en"}`;
  console.log(`[tutorial] ready: ${url}`);
  if (!locale) console.log(`[tutorial] Chinese UI: ${base}/?lang=zh`);
  console.log(`[tutorial] source: ${source}`);
  if (!(await exists(join(source, ".env.local")))) {
    console.log("[tutorial] .env.local not found in the source fixture; copy .env.example to configure a real model");
  }

  const command = entry.devCommand ?? [
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    "exec",
    "vite",
    "--host",
    "127.0.0.1",
    "--port",
    String(entry.port),
    "--strictPort",
  ];
  const child = spawn(command[0], command.slice(1), {
    cwd: app,
    stdio: "inherit",
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(entry.port),
      VITE_DEMO_LOCALE: locale ?? "en",
    },
  });
  const stop = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGINT", () => {
    stop("SIGINT");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    stop("SIGTERM");
    process.exit(0);
  });
  child.on("exit", (code, signal) => {
    process.exit(signal ? 0 : code ?? 0);
  });
} else {
  console.log("[tutorial] typecheck");
  run("pnpm", ["run", "typecheck"], { cwd: app });
  console.log(`[tutorial] deterministic end-to-end test (${locale ?? "en + zh"})`);
  run("pnpm", ["exec", "vitest", "run"], { cwd: app, env: { VITE_DEMO_LOCALE: locale ?? "" } });
  console.log("[tutorial] production build");
  run("pnpm", ["exec", "vite", "build"], { cwd: app });
  const distIndex = join(app, entry.distIndex ?? join("dist", "index.html"));
  if (!(await exists(distIndex))) {
    throw new Error(`Vite 构建后缺少 ${entry.distIndex ?? "dist/index.html"}`);
  }
  console.log(`✓ Tutorial ${tutorialId} passed against local tarballs: ${app}`);
}
