import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 生成「发布用」的 dist/package.json。
 *
 * 为什么不直接改工作区 package.json 的 exports：
 * - 开发 / 测试要继续从 src 取源码，改一次源码不用先构建；
 * - 发布包只能包含 dist，由 `publishConfig.directory` 把 dist 当作包根。
 *
 * 这样同一个包在仓库内是「源码包」，`pnpm pack` / `pnpm publish` 出来的是「产物包」。
 */
const packageDir = resolve(process.argv[2] ?? process.cwd());
const distDir = join(packageDir, "dist");
const pkg = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));

const workspaceVersions = new Map();
for (const entry of await readdir(resolve(packageDir, "../"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = resolve(packageDir, "..", entry.name, "package.json");
  if (!existsSync(file)) continue;
  const candidate = JSON.parse(await readFile(file, "utf8"));
  workspaceVersions.set(candidate.name, candidate.version);
}

function rewriteRange(name, range) {
  if (!range.startsWith("workspace:")) return range;
  const version = workspaceVersions.get(name);
  if (!version) throw new Error(`找不到工作区依赖 ${name} 的版本`);
  const kind = range.slice("workspace:".length);
  if (kind === "^") return `^${version}`;
  if (kind === "~") return `~${version}`;
  return version;
}

function rewriteDependencies(input = {}) {
  return Object.fromEntries(
    Object.entries(input).map(([name, range]) => [name, rewriteRange(name, range)]),
  );
}

function sourceExport(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  if (typeof value.default === "string") return value.default;
  if (typeof value.import === "string") return value.import;
  if (typeof value.types === "string") return value.types;
  return null;
}

function publishedExport(key, value) {
  if (key === "./package.json") return value;
  const source = sourceExport(value);
  const match = typeof source === "string" ? /^\.\/src\/(.+)\.ts$/.exec(source) : null;
  if (!match?.[1]) throw new Error(`${pkg.name} 的导出 ${key} 必须指向 src/*.ts`);
  return { types: `./${match[1]}.d.ts`, import: `./${match[1]}.js` };
}

const sourceExports = pkg.exports ?? {
  ".": { types: "./src/index.ts", default: "./src/index.ts" },
};
const exports = Object.fromEntries(
  Object.entries(sourceExports).map(([key, value]) => [key, publishedExport(key, value)]),
);
exports["./package.json"] = "./package.json";
if (pkg.name === "@plingjs/vue") exports["./style.css"] = "./style.css";

const published = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  license: pkg.license,
  repository: pkg.repository,
  homepage: pkg.homepage,
  bugs: pkg.bugs,
  type: "module",
  main: "./index.js",
  module: "./index.js",
  types: "./index.d.ts",
  exports,
  ...(pkg.name === "@plingjs/vue" ? { sideEffects: ["**/*.css"] } : {}),
  ...(Object.keys(pkg.dependencies ?? {}).length
    ? { dependencies: rewriteDependencies(pkg.dependencies) }
    : {}),
  ...(pkg.peerDependencies ? { peerDependencies: pkg.peerDependencies } : {}),
  publishConfig: { access: "public" },
};

await writeFile(join(distDir, "package.json"), `${JSON.stringify(published, null, 2)}\n`);
if (existsSync(join(packageDir, "README.md"))) {
  await copyFile(join(packageDir, "README.md"), join(distDir, "README.md"));
}
const rootLicense = resolve(packageDir, "../..", "LICENSE");
if (!existsSync(rootLicense)) throw new Error(`${pkg.name} 找不到仓库根 LICENSE`);
await copyFile(rootLicense, join(distDir, "LICENSE"));
const rootNotice = resolve(packageDir, "../..", "NOTICE");
if (existsSync(rootNotice)) await copyFile(rootNotice, join(distDir, "NOTICE"));

for (const [key, value] of Object.entries(exports)) {
  if (key === "./package.json" || typeof value === "string") continue;
  for (const file of [value.import, value.types]) {
    const relative = file.replace(/^\.\//, "");
    if (!existsSync(join(distDir, relative))) throw new Error(`${pkg.name} 构建缺少 ${file}`);
  }
}
if (pkg.name === "@plingjs/vue" && !existsSync(join(distDir, "style.css"))) {
  throw new Error("@plingjs/vue 构建缺少 style.css");
}

console.log(`✓ ${pkg.name}@${pkg.version} → ${distDir}`);
