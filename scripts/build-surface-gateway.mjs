import { chmod, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const packageDir = resolve(import.meta.dirname, "../packages/surface-gateway");
const distDir = join(packageDir, "dist");
const pkg = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
const versionSource = await readFile(join(packageDir, "src/version.mjs"), "utf8");
const versionMatch = /PACKAGE_VERSION\s*=\s*"([^"]+)"/.exec(versionSource);
if (versionMatch?.[1] !== pkg.version) {
  throw new Error(`surface-gateway version.mjs (${versionMatch?.[1] ?? "missing"}) does not match package.json (${pkg.version})`);
}

await rm(distDir, { recursive: true, force: true });
await mkdir(join(distDir, "bin"), { recursive: true });

for (const file of await readdir(join(packageDir, "src"))) {
  if (file.endsWith(".mjs") || file.endsWith(".d.ts")) {
    await copyFile(join(packageDir, "src", file), join(distDir, file));
  }
}
await copyFile(join(packageDir, "bin/surface-gateway.mjs"), join(distDir, "bin/surface-gateway.mjs"));
await chmod(join(distDir, "bin/surface-gateway.mjs"), 0o755);
await copyFile(join(packageDir, "config.example.json"), join(distDir, "config.example.json"));
await copyFile(join(packageDir, "README.md"), join(distDir, "README.md"));

for (const file of ["LICENSE", "NOTICE"]) {
  const source = resolve(packageDir, "../..", file);
  if (!existsSync(source)) throw new Error(`surface-gateway build is missing ${file}`);
  await copyFile(source, join(distDir, file));
}

const published = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  license: pkg.license,
  repository: pkg.repository,
  homepage: pkg.homepage,
  bugs: pkg.bugs,
  type: "module",
  main: "./index.mjs",
  module: "./index.mjs",
  types: "./index.d.ts",
  exports: {
    ".": {
      types: "./index.d.ts",
      import: "./index.mjs",
      default: "./index.mjs",
    },
    "./package.json": "./package.json",
  },
  bin: {
    "pling-surface-gateway": "./bin/surface-gateway.mjs",
  },
  dependencies: pkg.dependencies,
  engines: pkg.engines,
  publishConfig: { access: "public" },
};

await writeFile(join(distDir, "package.json"), `${JSON.stringify(published, null, 2)}\n`);
console.log(`✓ ${pkg.name}@${pkg.version} → ${dirname(join(distDir, "package.json"))}`);
