import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

function readRootModel(): string | undefined {
  try {
    for (const raw of readFileSync(new URL("../../../../.llm", import.meta.url), "utf8").split(/\r?\n/)) {
      const line = raw.trim().replace(/^export\s+/, "");
      if (!line || line.startsWith("#")) continue;
      const at = line.indexOf("=");
      if (at <= 0 || line.slice(0, at).trim() !== "MODEL") continue;
      return line.slice(at + 1).trim().replace(/^(['"])(.*)\1$/, "$2") || undefined;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return undefined;
}

const previewModel = process.env.VITE_AGENT_MODEL?.trim() || readRootModel();

export default defineConfig({
  base: "/demos/course-workspace-react/",
  resolve: { dedupe: ["react", "react-dom"] },
  define: previewModel ? { "import.meta.env.VITE_AGENT_MODEL": JSON.stringify(previewModel) } : undefined,
  envDir: "../../",
  esbuild: {
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  },
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: {
    host: "127.0.0.1",
    port: 5195,
    strictPort: true,
    proxy: {
      "/api/agent": {
        target: "http://127.0.0.1:5192",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/agent/, ""),
      },
    },
  },
  build: {
    outDir: "../../dist/course-workspace-react",
    emptyOutDir: true,
  },
});
