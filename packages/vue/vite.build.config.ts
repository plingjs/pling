import vue from "@vitejs/plugin-vue";
import { defineConfig, type Plugin } from "vite";

const IMPORT_META_MARKER = "__PLING_IMPORT_META__";

/**
 * 库构建不能把 `import.meta.env` 冻结成发布机上的 production 值。
 * 这里先把它换成一个自由标识符，等 Rollup 完成压缩后再还原成 `import.meta`，
 * 让消费方 Vite 构建负责注入**他们自己的**环境变量。
 */
function preserveConsumerEnv(): Plugin {
  return {
    name: "pling-preserve-consumer-env",
    enforce: "pre",
    transform(code, id) {
      if (!id.replaceAll("\\", "/").endsWith("/src/env.ts")) return null;
      return { code: code.replaceAll("import.meta", IMPORT_META_MARKER), map: null };
    },
    generateBundle(_options, bundle) {
      let restored = false;
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk" || !output.code.includes(IMPORT_META_MARKER)) continue;
        output.code = output.code.replaceAll(IMPORT_META_MARKER, "import.meta");
        restored = true;
      }
      if (!restored) this.error("没有在库产物里找到 import.meta 占位符，拒绝发布一份 env 被冻结的构建");
    },
  };
}

export default defineConfig({
  plugins: [preserveConsumerEnv(), vue()],
  build: {
    target: "es2022",
    sourcemap: true,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "style",
    },
    rollupOptions: {
      // 运行时依赖由使用方安装；Vue 是 peer，不能打进来。
      external: ["vue", "@plingjs/core", "@plingjs/agent", "@plingjs/dom", "@plingjs/ui", "markdown-it"],
    },
  },
});
