import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/testing.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "neutral",
  dts: true,
  sourcemap: true,
  clean: true,
});
