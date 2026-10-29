#!/usr/bin/env node
// 守卫「框架 / 业务」边界（规则见 AGENTS.md §1）。
// 只做静态扫描，零依赖：node scripts/check-boundaries.mjs
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const SKIP = new Set(["node_modules", "dist", ".git", ".codex", ".vite"]);
const FRAMEWORK_DIRS = ["core", "tool", "toolkit", "adapters", "registry", "runtime", "policy", "primitives"];
const SRC_EXT = /\.(ts|tsx|js|mjs|vue)$/;
const IMPORT_RE = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;

const problems = [];
const fail = (file, msg) => problems.push(`${relative(ROOT, file)}: ${msg}`);

function walk(dir, visit) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, visit);
    else visit(full);
  }
}

const groups = (prefix) =>
  existsSync(join(ROOT, prefix))
    ? readdirSync(join(ROOT, prefix)).map((n) => join(ROOT, prefix, n)).filter((p) => statSync(p).isDirectory())
    : [];

// 1. 框架不得依赖业务：packages/ 里不许 import 逃出本包（../../）或任何 cases/ 路径
for (const pkg of groups("packages")) {
  walk(join(pkg, "src"), (file) => {
    if (!SRC_EXT.test(file)) return;
    const code = readFileSync(file, "utf8");
    for (const [, spec] of code.matchAll(IMPORT_RE)) {
      if (spec.includes("cases/") || /(^|\/)\.\.\/\.\.\//.test(spec)) {
        fail(file, `框架包内出现跨包 / 业务引用："${spec}"`);
      }
    }
  });
}

// 1b. Surface 只做能力投影与协议边界：不得引入 UI、传输或第二套权限/执行逻辑
const surfaceSrc = join(ROOT, "packages", "surface", "src");
const SURFACE_FORBIDDEN_IMPORTS = [/^vue($|\/)/, /^react($|\/)/, /^@vue\//, /^@plingjs\/(vue|agent|server)$/, /^node:/];
walk(surfaceSrc, (file) => {
  if (!SRC_EXT.test(file)) return;
  const code = readFileSync(file, "utf8");
  for (const [, spec] of code.matchAll(IMPORT_RE)) {
    if (SURFACE_FORBIDDEN_IMPORTS.some((pattern) => pattern.test(spec))) {
      fail(file, `Surface 不允许引入 UI / 传输 / 权限层依赖："${spec}"`);
    }
  }
  for (const pattern of [/\bwindow\./, /\bdocument\./, /\bfetch\s*\(/, /\bpostMessage\s*\(/, /\beval\s*\(/, /\bcreatePolicy\b/, /\bcreateExecutor\b/]) {
    if (pattern.test(code)) fail(file, `Surface 不允许越过协议边界（命中 ${pattern}）`);
  }
});

// 1c. Delegation 是可移植的凭证集成包：不绑定 UI、Node、数据库或消息队列 SDK。
const delegationSrc = join(ROOT, "packages", "delegation", "src");
const DELEGATION_FORBIDDEN_IMPORTS = [
  /^vue($|\/)/,
  /^react($|\/)/,
  /^@vue\//,
  /^@plingjs\/(vue|agent|server)$/,
  /^node:/,
  /^(pg|mysql2?|ioredis|redis|@prisma\/client|kafkajs|nats)(\/|$)/,
];
walk(delegationSrc, (file) => {
  if (!SRC_EXT.test(file)) return;
  const code = readFileSync(file, "utf8");
  for (const [, spec] of code.matchAll(IMPORT_RE)) {
    if (DELEGATION_FORBIDDEN_IMPORTS.some((pattern) => pattern.test(spec))) {
      fail(file, `Delegation 不允许绑定 UI / Node / 数据库 / 消息队列依赖："${spec}"`);
    }
  }
});

// 1d. 框架无关层不得偷带 UI 框架；React 适配器也不得反向依赖 Vue。
const neutralBoundaries = [
  { dir: join(ROOT, "packages", "core", "src"), name: "Core", forbidden: [/^vue($|\/)/, /^react($|\/)/, /^@vue\//] },
  {
    dir: join(ROOT, "packages", "ui", "src"),
    name: "UI",
    forbidden: [/^vue($|\/)/, /^react($|\/)/, /^@vue\//, /^@plingjs\/(vue|react|vanilla|dom)$/],
  },
  { dir: join(ROOT, "packages", "dom", "src"), name: "DOM", forbidden: [/^vue($|\/)/, /^react($|\/)/, /^@vue\//, /^@plingjs\/(vue|react)$/] },
  { dir: join(ROOT, "packages", "vanilla", "src"), name: "Vanilla", forbidden: [/^vue($|\/)/, /^react($|\/)/, /^@vue\//, /^@plingjs\/(vue|react)$/] },
  { dir: join(ROOT, "packages", "vue2", "src"), name: "Vue 2", forbidden: [/^@plingjs\/vue$/, /^react($|\/)/, /^@vue\//] },
  { dir: join(ROOT, "packages", "react", "src"), name: "React", forbidden: [/^vue($|\/)/, /^@vue\//, /^@plingjs\/vue$/] },
];
for (const { dir, name, forbidden } of neutralBoundaries) {
  walk(dir, (file) => {
    if (!SRC_EXT.test(file)) return;
    const code = readFileSync(file, "utf8");
    for (const [, spec] of code.matchAll(IMPORT_RE)) {
      if (forbidden.some((pattern) => pattern.test(spec))) {
        fail(file, `${name} 层不允许引入该框架依赖："${spec}"`);
      }
    }
  });
}

// 2. 业务案例不得内嵌框架实现：cases/*/src 下不许出现 core/tool/adapters 等目录
for (const c of groups("cases")) {
  const src = join(c, "src");
  if (!existsSync(src)) continue;
  for (const name of readdirSync(src)) {
    if (FRAMEWORK_DIRS.includes(name) && statSync(join(src, name)).isDirectory()) {
      fail(join(src, name), `业务案例内嵌了框架实现目录 src/${name}/`);
    }
  }
}

// 3. 历史快照必须自包含：archive/* 不许依赖 @plingjs/*
for (const a of groups("archive")) {
  const pj = join(a, "package.json");
  if (!existsSync(pj)) continue;
  const parsed = JSON.parse(readFileSync(pj, "utf8"));
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    for (const dep of Object.keys(parsed[field] ?? {})) {
      if (dep.startsWith("@plingjs/")) fail(pj, `快照依赖了框架包 ${dep}（快照必须冻结自包含）`);
    }
  }
}

// 4. 根目录只允许约定的顶层条目
const ALLOWED_TOP = new Set([
  "packages", "cases", "examples", "archive", "docs", "opensource", "scripts", "website",
  "content", "deploy", "services", "skills",
  "node_modules", ".gitignore", ".codex", "README.md", "README.en.md", "README.zh-CN.md", "AGENTS.md", "LICENSE", "NOTICE",
  "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
  "logo-dark.jpg", "logo-light.png",
]);
for (const name of readdirSync(ROOT)) {
  if (name.startsWith(".")) continue;
  if (!ALLOWED_TOP.has(name)) problems.push(`仓库根出现未约定的条目：「${name}」`);
}

if (problems.length) {
  console.error(`✗ 边界检查失败（${problems.length} 处）：`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("✓ 边界检查通过：packages 不碰业务、cases 不含框架实现、archive 自包含。");
