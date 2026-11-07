import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { resolveDefaultConfig } from "../src/cli.mjs";

test("the default config resolves from both source and packaged layouts", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pling-gateway-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const sourcePackage = join(root, "source-package");
  const sourceDir = join(sourcePackage, "src");
  const installedPackage = join(root, "installed-package");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(installedPackage, { recursive: true });
  await writeFile(join(sourcePackage, "config.example.json"), "{}");
  await writeFile(join(installedPackage, "config.example.json"), "{}");

  assert.equal(
    resolveDefaultConfig(pathToFileURL(join(sourceDir, "cli.mjs")).href),
    join(sourcePackage, "config.example.json"),
  );
  assert.equal(
    resolveDefaultConfig(pathToFileURL(join(installedPackage, "cli.mjs")).href),
    join(installedPackage, "config.example.json"),
  );
});
