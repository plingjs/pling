#!/usr/bin/env node
/**
 * 导出公开仓库工作区。
 *
 * 内部开发库保留 docs/、archive/、opensource/ 与实验 cases；
 * 公开仓库只接收框架、文档站、发布脚本和根级发布文件。
 *
 * 用法：
 *   node scripts/export-public.mjs /Users/mac/Workspace/Projects/plingjs-public
 *   node scripts/export-public.mjs .public-export --with-cases
 */
import { chmod, copyFile, lstat, mkdir, readFile, readdir, readlink, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const withCases = args.includes("--with-cases");
const targetArg = args.find((arg) => !arg.startsWith("--"));
const target = resolve(root, targetArg ?? ".public-export");

if (target === root || target === "/" || target === resolve(root, "..")) {
  throw new Error("拒绝导出到仓库根目录或其父目录");
}

const allow = [
  "packages",
  "content",
  "examples",
  "website",
  "services",
  "deploy",
  "skills",
  "scripts",
  ".github",
  ".dockerignore",
  ".gitignore",
  "README.md",
  "README.zh-CN.md",
  "LICENSE",
  "NOTICE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
];
if (withCases) allow.push("cases");

const skipNames = new Set(["node_modules", "dist", ".data", ".codex", ".llm", ".wrangler", ".DS_Store"]);

function filter(source) {
  const normalized = source.replaceAll("\\", "/");
  const relativePath = normalized.startsWith(root.replaceAll("\\", "/"))
    ? normalized.slice(root.replaceAll("\\", "/").length).replace(/^\//, "")
    : normalized;
  const name = source.split(/[\\/]/).pop() ?? "";
  if (skipNames.has(name)) return false;
  if (relativePath === "deploy/release" || relativePath.startsWith("deploy/release/")) return false;
  if (relativePath === "deploy/surface.config.json") return false;
  if (relativePath === "website/legacy" || relativePath.startsWith("website/legacy/")) return false;
  if (normalized.includes("/.vitepress/cache")) return false;
  if (name === ".env" || name === ".dev.vars" || name.endsWith(".local")) return false;
  if (name.includes(".timestamp-") && name.endsWith(".mjs")) return false;
  if (name.endsWith(".tgz")) return false;
  return true;
}

// Keep the checkout metadata when re-exporting into an existing clone.
const gitDir = join(target, ".git");
const gitBackup = `${target}.git-export-backup`;
const hasGitDir = existsSync(gitDir);
if (hasGitDir) {
  await rm(gitBackup, { recursive: true, force: true });
  await rename(gitDir, gitBackup);
}
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
if (hasGitDir) {
  await rename(gitBackup, gitDir);
}

// Node's fs.cp() intermittently skipped subtrees in this repository, so copy the
// tree file by file. A missing file must fail the export, never the release.
async function copyTree(source, destination) {
  const info = await lstat(source).catch(() => undefined);
  if (!info) throw new Error(`导出时源文件消失：${source}`);
  await mkdir(dirname(destination), { recursive: true });
  if (info.isSymbolicLink()) {
    await symlink(await readlink(source), destination);
    return;
  }
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) {
      const child = join(source, entry.name);
      if (!filter(child)) continue;
      await copyTree(child, join(destination, entry.name));
    }
    return;
  }
  await copyFile(source, destination);
}

for (const entry of allow) {
  const source = join(root, entry);
  if (!existsSync(source)) throw new Error(`公开导出缺少 ${entry}`);
  if (!filter(source)) continue;
  await copyTree(source, join(target, entry));
}

// fs.cp() can finish successfully while a subtree is missing (observed after an
// interrupted export). Verify the copied tree against the exact filter we used,
// so a partial export can never reach the public workspace guard or a release.
async function collectExportedFiles(directory, collected) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (!filter(absolute)) continue;
    collected.push(relative(root, absolute).split("\\").join("/"));
    if (entry.isDirectory()) await collectExportedFiles(absolute, collected);
  }
}

const expectedFiles = [];
for (const entry of allow) {
  const source = join(root, entry);
  if ((await stat(source)).isDirectory()) await collectExportedFiles(source, expectedFiles);
  else expectedFiles.push(entry);
}
const missingExports = () => expectedFiles.filter((file) => !existsSync(join(target, file)));

// copyFile() on macOS has intermittently reported success while leaving a file
// absent (observed for package READMEs and tutorial pages). Retry every missing
// entry from the verified source tree before failing the export.
async function repairMissingExports() {
  let unexported = missingExports();
  for (let attempt = 0; unexported.length && attempt < 2; attempt += 1) {
    for (const file of unexported) {
      const source = join(root, file);
      if (!existsSync(source)) continue;
      await copyTree(source, join(target, file));
    }
    unexported = missingExports();
  }
  return unexported;
}

let unexported = await repairMissingExports();
if (unexported.length) {
  throw new Error(`公开导出不完整（${unexported.length} 个文件缺失）：${unexported.slice(0, 20).join(", ")}`);
}

const publicPackage = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
publicPackage.scripts ??= {};
publicPackage.scripts.dev = "pnpm dev:docs";
delete publicPackage.scripts["export:public"];
delete publicPackage.scripts["dev:mcp-reference"];
delete publicPackage.scripts["mcp:reference"];
delete publicPackage.scripts["cloudflare:dev"];
delete publicPackage.scripts["cloudflare:deploy"];
delete publicPackage.scripts["cloudflare:check"];
if (publicPackage.devDependencies) {
  delete publicPackage.devDependencies.wrangler;
  if (Object.keys(publicPackage.devDependencies).length === 0) delete publicPackage.devDependencies;
}
await writeFile(join(target, "package.json"), `${JSON.stringify(publicPackage, null, 2)}\n`, { mode: 0o644 });
await chmod(join(target, "package.json"), 0o644);

const workspace = [
  "packages:",
  '  - "packages/*"',
  '  - "services/*"',
  '  - "examples"',
  '  - "examples/demos/course-workspace-react"',
  '  - "examples/apps/*"',
  '  - "examples/recipes/*"',
  '  - "website"',
  ...(withCases ? ['  - "cases/*"'] : []),
  "",
  "allowBuilds:",
  "  esbuild: true",
  "  vue-demi: true",
  "  workerd: true",
  "",
  "minimumReleaseAgeExclude:",
  '  - "@electric-sql/pglite@0.5.11"',
  "",
].join("\n");
await writeFile(join(target, "pnpm-workspace.yaml"), workspace, { mode: 0o644 });
await chmod(join(target, "pnpm-workspace.yaml"), 0o644);

// The internal lockfile describes the internal workspace (it includes wrangler and
// private members). Regenerate it from the exported manifests so
// `pnpm install --frozen-lockfile` works for readers.
execFileSync("pnpm", ["install", "--lockfile-only", "--ignore-scripts"], {
  cwd: target,
  stdio: "inherit",
});

// Some pnpm versions on macOS prune package-level files while regenerating the
// public lockfile. Re-verify after install so the exported tree is still exactly
// the verified source snapshot.
unexported = await repairMissingExports();
if (unexported.length) {
  throw new Error(`公开导出在安装后不完整（${unexported.length} 个文件缺失）：${unexported.slice(0, 20).join(", ")}`);
}

const requiredFiles = [
  ".dockerignore",
  ".gitignore",
  "README.md",
  "README.zh-CN.md",
  "LICENSE",
  "NOTICE",
  "CHANGELOG.md",
  "package.json",
  "pnpm-lock.yaml",
  "website/package.json",
  "examples/package.json",
];
const missing = requiredFiles.filter((file) => !existsSync(join(target, file)));

const privateDeployPaths = [
  "deploy/cloudflare",
  "deploy/nginx",
  "deploy/start-host.sh",
  "deploy/build-image.sh",
];
const leakedPrivate = privateDeployPaths.filter((entry) => existsSync(join(target, entry)));
if (leakedPrivate.length) {
  throw new Error(`私有运维文件被错误导出：${leakedPrivate.join(", ")}`);
}

// A manifest is a promise to readers that every listed source file is present.
// Check the exported copy as well, so a partial or concurrent export cannot get
// as far as the public workspace guard.
for (const directory of await readdir(join(root, "examples", "demos"), { withFileTypes: true })) {
  if (!directory.isDirectory()) continue;
  const manifestPath = join(root, "examples", "demos", directory.name, "demo.json");
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest.files)) continue;
  const source = typeof manifest.source === "string" && manifest.source.trim()
    ? manifest.source.replace(/\/+$/, "")
    : `examples/demos/${directory.name}`;
  for (const file of manifest.files) {
    if (typeof file?.path !== "string" || !file.path.trim()) continue;
    const base = file.scope === "workspace" ? join(target, "examples") : join(target, source);
    const exported = resolve(base, file.path);
    if (!existsSync(exported)) {
      missing.push(`${source}/${file.path} (listed by examples/demos/${directory.name}/demo.json)`);
    }
  }
}

for (const directory of await readdir(join(target, "packages"), { withFileTypes: true })) {
  if (directory.isDirectory() && !existsSync(join(target, "packages", directory.name, "package.json"))) {
    missing.push(`packages/${directory.name}/package.json`);
  }
}

for (const directory of await readdir(join(target, "examples", "demos"), { withFileTypes: true })) {
  if (!directory.isDirectory()) continue;
  for (const file of ["README.md", "demo.json", "index.html"]) {
    const relativePath = `examples/demos/${directory.name}/${file}`;
    if (!existsSync(join(target, relativePath))) missing.push(relativePath);
  }
}

if (missing.length) {
  throw new Error(`公开导出不完整，缺少：${missing.join(", ")}`);
}

console.log(`✓ 公开工作区已导出：${target}`);
console.log("  已排除：docs/ archive/ opensource/ website/legacy/（以及默认情况下的 cases/）");
console.log(`  下一步：cd ${target} && pnpm install`);
