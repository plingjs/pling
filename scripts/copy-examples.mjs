#!/usr/bin/env node
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = join(root, "examples", "dist");
const target = join(root, "website", ".vitepress", "dist", "demos");

if (!existsSync(source)) {
  console.error("Missing examples/dist. Build @plingjs/examples first.");
  process.exit(1);
}

await mkdir(join(root, "website", ".vitepress", "dist"), { recursive: true });
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log(`✓ Copied examples into ${target}`);
