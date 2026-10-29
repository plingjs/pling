import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, resolve, sep } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const DEMOS_ROOT = fileURLToPath(new URL("./demos/", import.meta.url));
const ENV_ROOT = fileURLToPath(new URL(".", import.meta.url));
const TUTORIAL_PREVIEW_ROOT = resolve(fileURLToPath(new URL("./dist/tutorials/", import.meta.url)));
const demos = readdirSync(new URL("./demos", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const agentProxy = {
  "/api/agent": {
    target: "http://127.0.0.1:5192",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/agent/, ""),
  },
};

const recipeProxy = {
  "/api/recipe": {
    target: "http://127.0.0.1:5193",
    changeOrigin: false,
  },
};

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function serveTutorialPreviews() {
  return {
    name: "pling-tutorial-previews",
    configureServer(server: { middlewares: { use(handler: (req: any, res: any, next: () => void) => void): void } }) {
      server.middlewares.use((req, res, next) => {
        const raw = (req.url ?? "").split("?")[0];
        const marker = "/tutorials/";
        const markerAt = raw.indexOf(marker);
        if (markerAt < 0) return next();
        let relative: string;
        try {
          relative = decodeURIComponent(raw.slice(markerAt + marker.length));
        } catch {
          return next();
        }
        let file = resolve(TUTORIAL_PREVIEW_ROOT, relative);
        if (file !== TUTORIAL_PREVIEW_ROOT && !file.startsWith(TUTORIAL_PREVIEW_ROOT + sep)) return next();
        if (!existsSync(file)) return next();
        if (statSync(file).isDirectory()) file = resolve(file, "index.html");
        if (!existsSync(file)) return next();
        res.setHeader("content-type", MIME_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
        res.setHeader("cache-control", "no-store");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: "/demos/",
  envDir: ENV_ROOT,
  plugins: [vue(), serveTutorialPreviews()],
  root: DEMOS_ROOT,
  server: { host: "127.0.0.1", proxy: { ...agentProxy, ...recipeProxy } },
  preview: { host: "127.0.0.1", proxy: { ...agentProxy, ...recipeProxy } },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        demos.map((name) => [name, fileURLToPath(new URL(`./demos/${name}/index.html`, import.meta.url))]),
      ),
    },
  },
});
