import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/legacy.tsx"],
  format: ["esm"],
  target: "es2022",
  platform: "browser",
  dts: true,
  sourcemap: true,
  clean: true,
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  external: [
    "react",
    "react-dom",
    "use-sync-external-store/shim",
    "@plingjs/core",
    "@plingjs/agent",
    "@plingjs/dom",
    "@plingjs/vanilla",
    "markdown-it",
  ],
  esbuildOptions(options) {
    options.inject = [new URL("./src/react-runtime.ts", import.meta.url).pathname];
    options.tsconfig = undefined;
    options.tsconfigRaw = {
      compilerOptions: {
        jsx: "react",
        jsxFactory: "React.createElement",
        jsxFragment: "React.Fragment",
      },
    };
  },
});
