#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer as createHttpServer, request as httpRequest } from "node:http";
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const websiteRoot = resolve(repoRoot, "website");
const distRoot = resolve(websiteRoot, ".vitepress/dist");
const vitepressBin = resolve(websiteRoot, "node_modules/vitepress/bin/vitepress.js");

const API_ROUTES = [
  {
    prefix: "/api/agent",
    host: "127.0.0.1",
    port: Number(process.env.PLING_GATEWAY_PORT ?? 5192),
    rewrite: (url) => url.replace(/^\/api\/agent/, ""),
  },
  {
    prefix: "/api/recipe",
    host: "127.0.0.1",
    port: Number(process.env.PLING_RECIPE_PORT ?? 5193),
    rewrite: (url) => url,
  },
];

function optionValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

function parsePort(value, name) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}

async function freePort() {
  const probe = createNetServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  probe.close();
  await once(probe, "close");
  return port;
}

async function waitForStaticServer(port, child) {
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (exited) throw new Error("VitePress preview exited before becoming ready");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" });
      await response.body?.cancel();
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
  }
  throw new Error("Timed out waiting for VitePress preview");
}

function writeProxyError(res, apiRoute) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  if (apiRoute) {
    const body = JSON.stringify({
      error: {
        code: "LOCAL_GATEWAY_UNAVAILABLE",
        message: `Cannot reach the local service at http://127.0.0.1:${apiRoute.port}. Start the examples gateway first.`,
      },
    });
    res.writeHead(502, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "content-length": Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }
  res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
  res.end("Documentation preview is unavailable.");
}

function proxyRequest(req, res, route) {
  const upstream = httpRequest(
    {
      host: route.host,
      port: route.port,
      method: req.method,
      path: route.rewrite(req.url ?? "/"),
      headers: {
        ...req.headers,
        host: `${route.host}:${route.port}`,
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on("error", () => writeProxyError(res, route.api));
  req.pipe(upstream);
}

if (!existsSync(resolve(distRoot, "index.html"))) {
  console.error("Documentation build not found. Run `pnpm --filter @plingjs/website build` first.");
  process.exit(1);
}

const publicPort = parsePort(optionValue("--port", process.env.PORT ?? "5190"), "preview port");
const staticPort = await freePort();
const staticChild = spawn(
  process.execPath,
  [vitepressBin, "preview", "--port", String(staticPort), "--strictPort"],
  { cwd: websiteRoot, stdio: "inherit" },
);

staticChild.once("exit", (code, signal) => {
  if (!signal && code !== 0) process.exitCode = code ?? 1;
});

await waitForStaticServer(staticPort, staticChild);

const server = createHttpServer((req, res) => {
  const url = req.url ?? "/";
  const apiRoute = API_ROUTES.find((route) => url === route.prefix || url.startsWith(`${route.prefix}/`));
  proxyRequest(req, res, apiRoute ? { ...apiRoute, api: true } : {
    host: "127.0.0.1",
    port: staticPort,
    rewrite: (path) => path,
  });
});

server.listen(publicPort, () => {
  console.log(`[pling-docs] preview http://localhost:${publicPort}/`);
  console.log("[pling-docs] /api/agent -> http://127.0.0.1:5192");
  console.log("[pling-docs] /api/recipe -> http://127.0.0.1:5193");
});

function shutdown() {
  server.close();
  if (!staticChild.killed) staticChild.kill("SIGTERM");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
