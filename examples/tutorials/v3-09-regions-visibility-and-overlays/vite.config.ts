import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const proxyTarget = loadEnv("development", ROOT, "VITE_").VITE_AGENT_PROXY_TARGET?.trim();

export default defineConfig({
  plugins: [vue()],
  resolve: { dedupe: ["vue"] },
  server: proxyTarget
    ? {
        proxy: {
          "/llm": { target: proxyTarget, changeOrigin: true, rewrite: (path) => path.replace(/^\/llm/, "") },
        },
      }
    : undefined,
  test: { environment: "jsdom" },
});
