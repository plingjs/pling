import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const rootPackage = await readJson(join(root, "package.json"));
const license = await readFile(join(root, "LICENSE"), "utf8").catch(() => "");
const notice = await readFile(join(root, "NOTICE"), "utf8").catch(() => "");
const changelog = await readFile(join(root, "CHANGELOG.md"), "utf8").catch(() => "");
const expectedLicense = "Apache-2.0";
const expectedHomepage = "https://plingjs.dev";

if (rootPackage.license !== expectedLicense) {
  fail(`根 package.json 的 license 必须是 ${expectedLicense}`);
}
if (!license.includes("Apache License") || !license.includes("Version 2.0")) {
  fail("LICENSE 不是预期的 Apache-2.0 许可证正文");
}
if (!notice.includes("Pling") || !notice.includes("Copyright 2026 Pling contributors")) {
  fail("NOTICE 缺少 Pling 版权声明");
}
if (rootPackage.homepage !== expectedHomepage) {
  fail(`根 package.json 的 homepage 必须是 ${expectedHomepage}`);
}
const packageDirs = (await readdir(join(root, "packages"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (packageDirs.length === 0) fail("packages/ 下没有公开包");

const packages = [];
const names = new Set();
for (const dir of packageDirs) {
  const packageDir = join(root, "packages", dir);
  const manifestPath = join(packageDir, "package.json");
  if (!(await exists(manifestPath))) {
    fail(`packages/${dir} 缺少 package.json`);
    continue;
  }

  const pkg = await readJson(manifestPath);
  packages.push({ dir, packageDir, pkg });

  if (pkg.name !== `@plingjs/${dir}`) {
    fail(`packages/${dir} 的包名必须是 @plingjs/${dir}，实际为 ${pkg.name}`);
  }
  if (pkg.private !== false) {
    fail(`${pkg.name} 必须显式设置 private: false 才能进入发布链路`);
  }
  if (names.has(pkg.name)) fail(`重复的包名 ${pkg.name}`);
  names.add(pkg.name);

  if (!pkg.version || typeof pkg.version !== "string") fail(`${pkg.name} 缺少 version`);
  if (pkg.license !== expectedLicense) fail(`${pkg.name} 的 license 必须是 ${expectedLicense}`);
  if (pkg.publishConfig?.access !== "public") fail(`${pkg.name} 必须设置 publishConfig.access = public`);
  if (pkg.publishConfig?.directory !== "dist") fail(`${pkg.name} 必须设置 publishConfig.directory = dist`);
  if (!pkg.description?.trim()) fail(`${pkg.name} 缺少 description`);
  if (!pkg.repository || pkg.repository.type !== "git") fail(`${pkg.name} 缺少 repository.type = git`);
  if (pkg.repository?.url !== rootPackage.repository?.url) {
    fail(`${pkg.name} 的 repository.url 必须与根包一致`);
  }
  if (pkg.repository?.directory !== `packages/${dir}`) {
    fail(`${pkg.name} 的 repository.directory 必须是 packages/${dir}`);
  }
  if (!pkg.homepage || !pkg.bugs) fail(`${pkg.name} 缺少 homepage 或 bugs`);
  if (pkg.homepage !== expectedHomepage) fail(`${pkg.name} 的 homepage 必须是 ${expectedHomepage}`);
  if (!pkg.exports || typeof pkg.exports !== "object") fail(`${pkg.name} 缺少 exports`);
  if (!(await exists(join(packageDir, "README.md")))) fail(`${pkg.name} 缺少 README.md`);

  for (const [dependency, range] of Object.entries(pkg.dependencies ?? {})) {
    if (dependency.startsWith("@plingjs/")) {
      if (range !== "workspace:*") {
        fail(`${pkg.name} 的内部依赖 ${dependency} 必须写 workspace:*，实际为 ${range}`);
      }
      if (!packageDirs.includes(dependency.slice("@plingjs/".length))) {
        fail(`${pkg.name} 依赖了不存在的内部包 ${dependency}`);
      }
    } else if (range.startsWith("workspace:")) {
      fail(`${pkg.name} 的外部依赖 ${dependency} 不能使用 ${range}`);
    }
  }
}

const versions = new Set(packages.map(({ pkg }) => pkg.version));
if (versions.size !== 1) {
  fail(`公开包版本必须一致，当前为：${[...versions].join(", ")}`);
}

const releaseVersion = [...versions][0];
if (releaseVersion && !changelog.includes(`## [${releaseVersion}]`)) {
  fail(`CHANGELOG.md 缺少当前版本 ${releaseVersion}`);
}

const ci = await readFile(join(root, ".github/workflows/ci.yml"), "utf8").catch(() => "");
if (!ci.includes("pnpm release:check")) fail("CI 没有执行 pnpm release:check");
if (!ci.includes("pnpm pack:check")) fail("CI 没有执行 pnpm pack:check");
if (!ci.includes("pnpm tutorial:check v3-03")) fail("CI 没有执行 pnpm tutorial:check v3-03");
if (!ci.includes("pnpm tutorial:check v3-04")) fail("CI 没有执行 pnpm tutorial:check v3-04");
if (!ci.includes("pnpm tutorial:check v3-05")) fail("CI 没有执行 pnpm tutorial:check v3-05");
if (!ci.includes("pnpm tutorial:check v3-06")) fail("CI 没有执行 pnpm tutorial:check v3-06");
if (!ci.includes("pnpm tutorial:check v3-07")) fail("CI 没有执行 pnpm tutorial:check v3-07");
if (!ci.includes("pnpm --filter @plingjs/website build")) {
  fail("CI 没有构建 @plingjs/website");
}
if (ci.includes("@pi/")) fail("CI 仍引用旧的 @pi/* 包名");

const websitePackage = await readJson(join(root, "website/package.json")).catch(() => null);
if (websitePackage?.name !== "@plingjs/website") {
  fail("website/package.json 的包名必须是 @plingjs/website");
}

if (failures.length) {
  console.error("发布检查失败：");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`✓ 发布检查通过：${packages.length} 个包，版本 ${[...versions][0]}`);
