import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

export const ALL_PACKAGES = [
  "@plingjs/core",
  "@plingjs/ui",
  "@plingjs/dom",
  "@plingjs/surface",
  "@plingjs/delegation",
  "@plingjs/agent",
  "@plingjs/surface-browser",
  "@plingjs/continuity-http",
  "@plingjs/server",
  "@plingjs/vanilla",
  "@plingjs/react",
  "@plingjs/vue",
  "@plingjs/vue2",
];

/**
 * Expand the requested public packages with their workspace dependencies.
 * Tutorial fixtures and preview builds install only local tarballs, so a new
 * internal dependency must be packed even when the fixture does not import it
 * directly.
 */
export async function expandWorkspacePackages(root, packageNames) {
  const expanded = [];
  const visiting = new Set();

  async function visit(name) {
    if (!ALL_PACKAGES.includes(name)) throw new Error(`Unknown public package: ${name}`);
    if (visiting.has(name) || expanded.includes(name)) return;
    visiting.add(name);
    const directory = join(root, "packages", name.slice("@plingjs/".length));
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (dependency.startsWith("@plingjs/")) await visit(dependency);
    }
    visiting.delete(name);
    expanded.push(name);
  }

  for (const name of packageNames) await visit(name);
  return expanded;
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`${command} ${args.join(" ")} 失败（exit ${result.status}）`);
  }
  return result.stdout ?? "";
}

async function packPackage({ root, temp, name }) {
  const directory = join(root, "packages", name.slice("@plingjs/".length));
  const source = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const destination = join(temp, `tar-${name.slice("@plingjs/".length)}`);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });

  // Run from the package root, exactly like `pnpm publish`. pnpm reads
  // publishConfig.directory from here; packing dist directly could pass the
  // smoke test while leaving the real publish path unchecked.
  run("pnpm", ["build"], { cwd: directory });
  run("pnpm", ["pack", "--pack-destination", destination], { cwd: directory });

  const archives = (await readdir(destination)).filter((entry) => entry.endsWith(".tgz"));
  if (archives.length !== 1) throw new Error(`${name} 期望生成 1 个 tarball，实际为 ${archives.length} 个`);
  const file = archives[0];
  const tarball = join(destination, file);

  const contents = run("tar", ["-tzf", tarball]);
  if (contents.includes("/src/")) throw new Error(`${name} 的 tarball 泄漏了 src/`);
  if (!contents.includes("package/package.json")) throw new Error(`${name} 的 tarball 缺少 package.json`);
  if (!contents.includes("package/README.md")) throw new Error(`${name} 的 tarball 缺少 README.md`);
  if (!contents.includes("package/LICENSE")) throw new Error(`${name} 的 tarball 缺少 LICENSE`);
  if (!contents.includes("package/NOTICE")) throw new Error(`${name} 的 tarball 缺少 NOTICE`);
  if (name === "@plingjs/vue" && !contents.includes("package/style.css")) {
    throw new Error("@plingjs/vue 的 tarball 缺少 style.css");
  }
  if (/package\/.*\.(?:env|pem|key)$/m.test(contents)) {
    throw new Error(`${name} 的 tarball 夹带了疑似密钥文件`);
  }

  const manifestText = run("tar", ["-xOzf", tarball, "package/package.json"]);
  if (manifestText.includes("workspace:")) throw new Error(`${name} 的发布 manifest 仍含 workspace:*`);
  const manifest = JSON.parse(manifestText);
  if (manifest.name !== source.name) throw new Error(`${name} 的发布 manifest 包名不一致`);
  if (manifest.version !== source.version) throw new Error(`${name} 的发布 manifest 版本不一致`);
  if (manifest.license !== "Apache-2.0") {
    throw new Error(`${name} 的发布 manifest 缺少 license: Apache-2.0`);
  }
  if (manifest.repository?.url !== source.repository?.url) {
    throw new Error(`${name} 的发布 manifest 缺少 repository 元数据`);
  }
  if (manifest.publishConfig?.access !== "public") {
    throw new Error(`${name} 的发布 manifest 缺少 publishConfig.access = public`);
  }

  return tarball;
}

/**
 * Build and pack the requested public packages without touching the registry.
 * The returned map can be installed with `file:` dependencies in a clean app.
 */
export async function buildAndPackPackages({ root, temp, packages = ALL_PACKAGES }) {
  await mkdir(temp, { recursive: true });
  const tarballs = {};
  for (const name of packages) {
    tarballs[name] = await packPackage({ root, temp, name });
  }
  return tarballs;
}
