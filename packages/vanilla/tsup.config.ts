import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "browser",
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    "@plingjs/core",
    "@plingjs/dom",
    "@plingjs/agent",
    "@plingjs/surface",
    "@plingjs/surface-browser",
    "markdown-it",
  ],
});
