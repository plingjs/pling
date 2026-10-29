import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "browser",
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "@plingjs/core", "@plingjs/agent", "@plingjs/dom", "markdown-it"],
});
