import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
const envRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  envDir: envRoot,
  plugins: [vue()],
  resolve: { dedupe: ["vue"] },
  server: {
    proxy: {
      "/api/agent": {
        target: "http://127.0.0.1:5192",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/agent/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        integrated: fileURLToPath(new URL("./index.html", import.meta.url)),
        baseline: fileURLToPath(new URL("./baseline/index.html", import.meta.url)),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
  },
  root,
});
