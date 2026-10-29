import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const env = loadEnv("development", ROOT, "");
const proxyTarget = env.VITE_AGENT_PROXY_TARGET?.trim();

export default defineConfig({
  plugins: [
    vue(),
    {
      name: "todo-surface-auth-demo-root",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url === "/") {
            response.statusCode = 302;
            response.setHeader("location", "/demo/");
            response.end();
            return;
          }
          next();
        });
      },
    },
  ],
  resolve: { dedupe: ["vue"] },
  server: {
    proxy: {
      "/api": {
        target: process.env.TODO_BFF_URL ?? "http://127.0.0.1:5221",
        changeOrigin: false,
      },
      ...(proxyTarget
        ? {
            "/llm": {
              target: proxyTarget,
              changeOrigin: true,
              rewrite: (path: string) => path.replace(/^\/llm/, ""),
            },
          }
        : {}),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL("./demo/index.html", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
    exclude: ["server/test/**"],
  },
});
