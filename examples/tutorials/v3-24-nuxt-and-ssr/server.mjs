import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createViteServer } from "vite";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 5237);
const template = await readFile(new URL("./index.html", import.meta.url), "utf8");
const vite = await createViteServer({
  appType: "custom",
  server: { middlewareMode: true },
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);

  if (url.pathname === "/") {
    try {
      const locale = url.searchParams.get("lang") === "zh" ? "zh" : "en";
      const { renderTodoSsr } = await vite.ssrLoadModule("/src/ssr.ts");
      const appHtml = await renderTodoSsr(locale);
      const html = template
        .replace('<html lang="en">', `<html lang="${locale === "zh" ? "zh-CN" : "en"}">`)
        .replace('<title>Nuxt and SSR · Pling</title>', `<title>${locale === "zh" ? "Nuxt 与服务端渲染 · Pling" : "Nuxt and SSR · Pling"}</title>`)
        .replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`);
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(html);
    } catch (error) {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.stack : String(error));
    }
    return;
  }

  vite.middlewares(request, response, (error) => {
    if (error) {
      response.statusCode = 500;
      response.end(error.stack ?? String(error));
    }
  });
});

server.listen(port, host, () => {
  console.log(`[v3-24] SSR ready: http://${host}:${port}/`);
  console.log(`[v3-24] Chinese UI: http://${host}:${port}/?lang=zh`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await vite.close();
    server.close(() => process.exit(0));
  });
}
