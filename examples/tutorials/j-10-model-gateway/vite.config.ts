import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    proxy: { "/api": "http://127.0.0.1:5333" },
  },
  test: { environment: "jsdom" },
});
