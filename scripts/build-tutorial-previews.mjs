#!/usr/bin/env node
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { ALL_PACKAGES, buildAndPackPackages, run } from "./lib/pack-packages.mjs";
import {
  PUBLIC_PREVIEW_AGENT,
  tutorialFramework,
  tutorialLocalCommand,
  tutorialPreviewPath,
} from "./lib/tutorial-previews.mjs";

const root = resolve(import.meta.dirname, "..");
const registryPath = join(root, "examples", "tutorials", "registry.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const outputRoot = join(root, "examples", "dist", "tutorials");
const workRoot = join(root, ".tmp", "tutorial-previews");
const packRoot = join(workRoot, "packs");
const textArtifact = /\.(?:html|js|mjs|cjs|css|json|map|txt|xml|svg)$/;
const credentialPatterns = [
  { name: "OpenAI-style key", pattern: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: "Google API key", pattern: /AIza[0-9A-Za-z_-]{30,}/g },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: "Slack token", pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

function parseArgs(argv) {
  let only = [];
  let all = false;
  for (const arg of argv) {
    if (arg === "--all") all = true;
    else if (arg.startsWith("--only=")) {
      only = arg.slice("--only=".length).split(",").map((value) => value.trim()).filter(Boolean);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return { all, only };
}

const args = parseArgs(process.argv.slice(2));
const allIds = Object.keys(registry);
const selectedIds = args.only.length > 0 ? args.only.map((id) => id.toLowerCase()) : allIds;

if (!args.all && args.only.length === 0) {
  console.log(`[tutorial-preview] building all ${allIds.length} chapter previews`);
}
if (args.only.length > 0 && args.all) throw new Error("Use either --all or --only, not both");

for (const id of selectedIds) {
  if (!registry[id]) throw new Error(`Unknown tutorial "${id}". Available: ${allIds.join(", ")}`);
  tutorialFramework(id);
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(file)));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

function fixtureFilter(sourceRoot) {
  return (source) => {
    const rel = relative(sourceRoot, source);
    if (!rel) return true;
    const name = basename(source);
    if (["node_modules", "dist", ".vite", "coverage"].includes(name)) return false;
    if (name.endsWith(".example")) return true;
    if (name === ".env" || name.startsWith(".env.")) return false;
    return true;
  };
}

function rewriteManifest(manifest, packages, tarballs) {
  const next = structuredClone(manifest);
  for (const name of packages) {
    if (next.dependencies?.[name]) next.dependencies[name] = `file:${tarballs[name]}`;
    if (next.devDependencies?.[name]) next.devDependencies[name] = `file:${tarballs[name]}`;
  }
  return next;
}

async function secretValues(source) {
  const values = [];
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/^\.env(?:\.|$)/.test(entry.name) || entry.name.endsWith(".example")) continue;
    const text = await readFile(join(source, entry.name), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const [, key, raw] = match;
      if (!/(?:API_?KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE_?KEY)/i.test(key)) continue;
      const value = raw.replace(/^(['"])(.*)\1$/, "$2");
      if (value.length >= 12 && !/^(?:replace|your-|example)/i.test(value)) {
        values.push({ key, value, source: join(source, entry.name) });
      }
    }
  }
  return values;
}

async function assertNoCredentials(target, source) {
  const files = (await walk(target)).filter((file) => textArtifact.test(file));
  const literals = await secretValues(source);
  const failures = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const secret of literals) {
      if (text.includes(secret.value)) failures.push(`${relative(root, file)} embeds ${secret.key} from ${relative(root, secret.source)}`);
    }
    for (const { name, pattern } of credentialPatterns) {
      if (pattern.test(text)) failures.push(`${relative(root, file)} contains a credential-shaped value (${name})`);
      pattern.lastIndex = 0;
    }
  }
  if (failures.length > 0) {
    throw new Error(`Preview build contains credentials:\n- ${failures.join("\n- ")}`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function writeGallery() {
  const groups = [
    { key: "v3", title: "Vue 3", blurb: "从安装、最小接入，到网关、外部 Agent 与 SSR。" },
    { key: "r", title: "React", blurb: "与 Vue 3 对齐的章节路径，使用 React Provider 与 hooks。" },
    { key: "j", title: "Vanilla JS / jQuery", blurb: "无框架页面、增量 DOM、多页连续性与外部 Agent。" },
    { key: "v2", title: "Vue 2.7", blurb: "Vue 2.7 指令、记录、助手入口与迁移边界。" },
  ];
  const sections = [];
  for (const group of groups) {
    const rows = [];
    for (const [id, entry] of Object.entries(registry)) {
      if (tutorialFramework(id).key !== group.key) continue;
      const target = join(outputRoot, tutorialFramework(id).path, id);
      if (!(await exists(join(target, "index.html")))) continue;
      const route = tutorialPreviewPath(id);
      rows.push(`<li><a href="${route}?lang=zh"><span>${escapeHtml(id.toUpperCase())}</span>${escapeHtml(entry.title)}</a><small><code>${escapeHtml(tutorialLocalCommand(id, "zh"))}</code></small></li>`);
    }
    if (rows.length > 0) {
      sections.push(`<section><header><h2>${group.title}</h2><p>${group.blurb}</p></header><ol>${rows.join("")}</ol></section>`);
    }
  }

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Pling 教程章节示例</title>
  <style>
    :root{color:#0d1728;background:#fff;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}
    *{box-sizing:border-box}body{margin:0}.page{width:min(1120px,calc(100% - 40px));margin:0 auto;padding:64px 0 96px}
    .eyebrow{margin:0 0 12px;color:#086aa8;font-size:12px;font-weight:750;letter-spacing:.12em;text-transform:uppercase}
    h1{max-width:760px;margin:0;font-size:clamp(36px,6vw,64px);line-height:1.04;letter-spacing:-.05em}
    .lead{max-width:720px;margin:20px 0 48px;color:#526174;font-size:17px;line-height:1.75}
    section{display:grid;grid-template-columns:minmax(180px,240px) 1fr;gap:40px;padding:34px 0;border-top:1px solid #dce8f4}
    h2{margin:0 0 8px;font-size:22px;letter-spacing:-.02em}header p{margin:0;color:#718096;font-size:13px;line-height:1.65}
    ol{display:grid;gap:10px;margin:0;padding:0;list-style:none}
    li{display:grid;grid-template-columns:1fr auto;align-items:center;gap:20px;padding:4px 0}
    li a{display:flex;align-items:baseline;gap:12px;color:#0d1728;font-weight:600;text-decoration:none}
    li a:hover{color:#086aa8}li a span{min-width:48px;color:#2e9df7;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:750}
    small,code{color:#718096;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}code{white-space:nowrap}
    footer{margin-top:42px;color:#718096;font-size:13px}footer a{color:#086aa8}
    @media(max-width:760px){section{grid-template-columns:1fr;gap:18px}li{grid-template-columns:1fr}small{display:none}}
  </style>
</head>
<body>
  <main class="page">
    <p class="eyebrow">Pling tutorials</p>
    <h1>每一章，都可以直接运行。</h1>
    <p class="lead">这些页面与教程中的本地夹具使用同一份源码。选择章节后可直接体验，也可以回到文档复制本地命令。线上预览的模型请求经过服务端网关，浏览器不持有供应商密钥。</p>
    ${sections.join("\n")}
    <footer>查看全部教程与源码，请回到 <a href="/zh/">Pling 文档</a>。</footer>
  </main>
</body>
</html>
`;
  await mkdir(outputRoot, { recursive: true });
  await writeFile(join(outputRoot, "index.html"), html);
}

const packageNames = [...new Set(selectedIds.flatMap((id) => registry[id].packages ?? []))];
for (const name of packageNames) {
  if (!ALL_PACKAGES.includes(name)) throw new Error(`Unknown package in registry: ${name}`);
}

console.log(`[tutorial-preview] packing ${packageNames.length} public packages`);
const tarballs = await buildAndPackPackages({ root, temp: packRoot, packages: packageNames });

for (const [index, id] of selectedIds.entries()) {
  const entry = registry[id];
  const framework = tutorialFramework(id);
  const source = join(root, "examples", "tutorials", entry.dir);
  const work = join(workRoot, id);
  const app = join(work, "app");
  const target = join(outputRoot, framework.path, id);
  if (!(await exists(join(source, "package.json")))) throw new Error(`${id}: missing source package.json`);

  console.log(`[tutorial-preview] ${index + 1}/${selectedIds.length} ${id} · ${entry.title}`);
  await rm(work, { recursive: true, force: true });
  await cp(source, app, { recursive: true, filter: fixtureFilter(source) });

  const manifestPath = join(app, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  await writeFile(manifestPath, `${JSON.stringify(rewriteManifest(manifest, entry.packages, tarballs), null, 2)}\n`);

  const overrides = entry.packages.map((name) => `  "${name}": "file:${tarballs[name]}"`).join("\n");
  await writeFile(join(app, "pnpm-workspace.yaml"), `packages:\n  - "."\noverrides:\n${overrides}\n`);

  run("pnpm", ["install", "--ignore-scripts", "--prefer-offline"], { cwd: app });
  run("pnpm", ["exec", "vite", "build", `--base=${tutorialPreviewPath(id)}`], {
    cwd: app,
    env: {
      VITE_AGENT_BASE_URL: PUBLIC_PREVIEW_AGENT.baseUrl,
      VITE_AGENT_MODEL: PUBLIC_PREVIEW_AGENT.model,
      VITE_AGENT_API_KEY: "",
      VITE_AGENT_PROXY_TARGET: "",
      VITE_DEMO_LOCALE: "",
    },
  });

  const dist = join(app, "dist");
  const distIndex = entry.distIndex ?? "dist/index.html";
  if (!(await exists(join(app, distIndex)))) throw new Error(`${id}: build did not produce ${distIndex}`);

  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(dist, target, { recursive: true });

  const entryInsideDist = relative("dist", distIndex).replaceAll("\\", "/");
  if (entryInsideDist !== "index.html") {
    const relativeEntry = entryInsideDist;
    const redirect = `<!doctype html><meta charset="utf-8"><title>Pling tutorial</title><script>location.replace(${JSON.stringify(relativeEntry)}+location.search+location.hash)</script><noscript><a href="${relativeEntry}">Open the tutorial example</a></noscript>\n`;
    await writeFile(join(target, "index.html"), redirect);
  }

  await writeFile(
    join(target, "preview.json"),
    `${JSON.stringify({
      id,
      title: entry.title,
      framework: framework.label,
      route: tutorialPreviewPath(id),
      localCommand: tutorialLocalCommand(id, "zh"),
    }, null, 2)}\n`,
  );
  await assertNoCredentials(target, source);
}

await writeGallery();
console.log(`✓ Tutorial previews built in ${relative(root, outputRoot)}`);
