import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const root = new URL(".", import.meta.url).pathname;
const proxyTarget = loadEnv("development", root, "VITE_").VITE_AGENT_PROXY_TARGET?.trim();

export default defineConfig({
  // Vitest 2 的配置类型仍指向 Vite 5，而示例使用 Vite 6；插件本身兼容两者。
  plugins: [react() as never],
  server: proxyTarget
    ? {
        proxy: {
          "/llm": { target: proxyTarget, changeOrigin: true, rewrite: (path) => path.replace(/^\/llm/, "") },
        },
      }
    : undefined,
  test: { environment: "jsdom" },
});
