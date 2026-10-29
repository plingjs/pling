import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const root = new URL(".", import.meta.url).pathname;
const proxyTarget = loadEnv("development", root, "VITE_")?.VITE_AGENT_PROXY_TARGET?.trim();

export default defineConfig({
  server: proxyTarget
    ? {
        proxy: {
          "/llm": { target: proxyTarget, changeOrigin: true, rewrite: (path) => path.replace(/^\/llm/, "") },
        },
      }
    : undefined,
  test: { environment: "jsdom" },
});
