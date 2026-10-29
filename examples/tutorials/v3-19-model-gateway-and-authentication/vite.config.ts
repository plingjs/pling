import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  resolve: { dedupe: ["vue"] },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5332",
    },
  },
  test: { environment: "jsdom" },
});
