import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const ROOT = new URL(".", import.meta.url).pathname;
const page = (name: string): string => new URL(`./demo/${name}`, import.meta.url).pathname;
const proxyTarget = loadEnv("development", ROOT, "VITE_").VITE_AGENT_PROXY_TARGET?.trim();

export default defineConfig({
  server: proxyTarget
    ? {
        proxy: {
          "/llm": { target: proxyTarget, changeOrigin: true, rewrite: (path) => path.replace(/^\/llm/, "") },
        },
      }
    : undefined,
  build: {
    rollupOptions: {
      input: { index: page("index.html"), detail: page("detail.html") },
    },
  },
  test: {
    environment: "jsdom",
  },
});
