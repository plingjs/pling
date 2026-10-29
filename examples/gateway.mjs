/**
 * Local / hosted gateway for the public examples.
 *
 * The browser only knows `/api/agent/v1`; the upstream URL and key stay here.
 * This is deliberately small: it demonstrates the production shape without
 * moving the agent loop or page state off the browser.
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createPlingGateway, toNodeHandler } from "@plingjs/server";

function loadEnv(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(new URL("./.env.local", import.meta.url));

const port = Number(process.env.PLING_GATEWAY_PORT ?? 5192);
const host = process.env.PLING_GATEWAY_HOST?.trim() || "127.0.0.1";
const baseUrl = process.env.PLING_UPSTREAM_BASE_URL?.trim();
const apiKey = process.env.PLING_UPSTREAM_API_KEY?.trim() ?? "";
const model = process.env.PLING_MODEL?.trim() ?? "";
const maxCalls = Math.max(1, Number(process.env.PLING_DEMO_RATE_LIMIT ?? 80));
const windowMs = Math.max(1_000, Number(process.env.PLING_DEMO_RATE_WINDOW_MS ?? 10 * 60_000));
const trustProxy = process.env.PLING_TRUST_PROXY === "1";

if (!baseUrl) {
  console.error(
    "[pling-demo] 缺少 PLING_UPSTREAM_BASE_URL。复制 examples/.env.example 为 examples/.env.local 后重启。",
  );
  process.exit(1);
}

const gateway = createPlingGateway({
  upstream: { baseUrl, apiKey },
  ...(model ? { model, allowedModels: [model] } : {}),
  // The local gateway is bound to loopback and protected by the lightweight
  // per-client quota below. Put a real WAF / quota in front of a public host.
  allowAnonymous: true,
  timeoutMs: Number(process.env.PLING_TIMEOUT_MS ?? 60_000),
  maxBodyBytes: Number(process.env.PLING_MAX_BODY_BYTES ?? 500_000),
  retry: { maxRetries: 2, baseDelayMs: 400, maxDelayMs: 2_500 },
  onAudit(event) {
    console.log(JSON.stringify({ type: "pling.demo.audit", ...event }));
  },
});

const handleGateway = toNodeHandler(gateway);
const buckets = new Map();

function clientKey(req) {
  if (trustProxy) {
    const forwarded = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || "unknown";
}

function takeQuota(key) {
  const now = Date.now();
  const prior = buckets.get(key);
  const bucket = !prior || prior.resetAt <= now ? { count: 0, resetAt: now + windowMs } : prior;
  if (bucket.count >= maxCalls) {
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return { ok: true, remaining: Math.max(0, maxCalls - bucket.count), resetAt: bucket.resetAt };
}

function writeJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    writeJson(res, 200, { ok: true, configured: true, model: model || "client-selected" });
    return;
  }

  const quota = takeQuota(clientKey(req));
  const quotaHeaders = {
    "x-pling-ratelimit-remaining": String(quota.remaining),
    "x-pling-ratelimit-reset": new Date(quota.resetAt).toISOString(),
  };
  if (!quota.ok) {
    writeJson(
      res,
      429,
      { error: { code: "DEMO_RATE_LIMITED", message: "Demo request limit reached. Try again later." } },
      quotaHeaders,
    );
    return;
  }

  for (const [name, value] of Object.entries(quotaHeaders)) res.setHeader(name, value);
  void handleGateway(req, res).catch((error) => {
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    writeJson(res, 500, { error: { code: "DEMO_GATEWAY_ERROR", message: "Demo gateway failed." } });
  });
});

server.listen(port, host, () => {
  console.log(`[pling-demo] gateway http://${host}:${port}`);
  console.log(`[pling-demo] model ${model || "client-selected"}; upstream credentials stay server-side`);
  console.log(`[pling-demo] quota ${maxCalls} calls / ${Math.round(windowMs / 60_000)} min per client`);
});
