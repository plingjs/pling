import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createPlingGateway, toNodeHandler } from "@plingjs/server";
import { createDemoAuth } from "./src/demo-auth.mjs";

try {
  for (const raw of readFileSync(new URL(".env.gateway", import.meta.url), "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    if (!(key in process.env)) process.env[key] = line.slice(at + 1).trim();
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const port = Number(process.env.PLING_GATEWAY_PORT ?? 5333);
const upstream = process.env.PLING_UPSTREAM_BASE_URL;
if (!upstream) {
  console.error("Missing PLING_UPSTREAM_BASE_URL. Copy .env.gateway.example to .env.gateway.");
  process.exit(1);
}

const publicOrigin = process.env.PLING_DEMO_ORIGIN ?? "http://127.0.0.1:5275";
const auth = createDemoAuth({
  password: process.env.PLING_DEMO_PASSWORD ?? "demo-password",
  publicOrigin,
  secureCookie: new URL(publicOrigin).protocol === "https:",
});

const gateway = createPlingGateway({
  upstream: { baseUrl: upstream, apiKey: process.env.PLING_UPSTREAM_API_KEY ?? "" },
  model: process.env.PLING_GATEWAY_MODEL,
  allowedModels: (process.env.PLING_ALLOWED_MODELS ?? "").split(",").map((item) => item.trim()).filter(Boolean),
  authorize: auth.authorize,
  allowAnonymous: false,
  onAudit(event) {
    console.log(JSON.stringify({ type: "pling.audit", ...event }));
  },
});

const handleGateway = toNodeHandler(gateway);
const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", publicOrigin).pathname;
  if (path === "/api/session" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let password = "";
    try { password = String(JSON.parse(body).password ?? ""); } catch {}
    const session = auth.login(password);
    res.statusCode = session ? 204 : 401;
    if (session) res.setHeader("set-cookie", session.cookie);
    res.end();
    return;
  }
  if (path === "/api/session" && req.method === "GET") {
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ signedIn: auth.isSignedIn(new Headers(req.headers)) }));
    return;
  }
  if (path === "/api/session/logout" && req.method === "POST") {
    res.statusCode = 204;
    res.setHeader("set-cookie", auth.logout(new Headers(req.headers)));
    res.end();
    return;
  }
  await handleGateway(req, res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[pling-gateway] listening on http://127.0.0.1:${port}`);
  console.log("[pling-gateway] the provider key and model allowlist stay in this process");
});
