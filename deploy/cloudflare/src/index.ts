import { createPlingGateway, type PlingGateway } from "../../../packages/server/src/index.ts";

interface StaticAssets {
  fetch(request: Request): Promise<Response>;
}

interface RateLimiter {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ASSETS: StaticAssets;
  MODEL_RATE_LIMIT: RateLimiter;
  PLING_UPSTREAM_BASE_URL?: string;
  PLING_UPSTREAM_API_KEY?: string;
  PLING_MODEL?: string;
  PLING_ALLOWED_ORIGINS?: string;
  PLING_PUBLIC_ACCESS?: string;
}

const API_PREFIX = "/api/agent";
let gateway: PlingGateway | undefined;

function jsonResponse(payload: unknown, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function siteClosedResponse(): Response {
  return new Response(
    "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>Pling</title><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><main><h1>Pling</h1><p>The site is not public yet. Please check back later.</p></main></html>",
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": "86400",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
      },
    },
  );
}

function configuredOrigins(env: Env): Set<string> {
  return new Set(
    (env.PLING_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.protocol === "http:";
  } catch {
    return false;
  }
}

function originAllowed(request: Request, origin: string, env: Env): boolean {
  if (isLocalOrigin(origin)) return true;
  if (origin === new URL(request.url).origin) return true;
  return configuredOrigins(env).has(origin);
}

function getGateway(env: Env): PlingGateway {
  if (gateway) return gateway;

  const baseUrl = env.PLING_UPSTREAM_BASE_URL?.trim();
  const apiKey = env.PLING_UPSTREAM_API_KEY?.trim();
  const model = env.PLING_MODEL?.trim();
  if (!baseUrl || !apiKey || !model) {
    throw new Error("Cloudflare model gateway is not configured");
  }

  gateway = createPlingGateway({
    upstream: { baseUrl, apiKey },
    model,
    allowedModels: [model],
    authorize: () => true,
    timeoutMs: 60_000,
    maxBodyBytes: 500_000,
    retry: { maxRetries: 2, baseDelayMs: 400, maxDelayMs: 2_500 },
    onAudit(event) {
      console.log(JSON.stringify({ type: "pling.cloudflare.audit", ...event }));
    },
  });
  return gateway;
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleAgentApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === `${API_PREFIX}/health`) {
    const configured = Boolean(
      env.PLING_UPSTREAM_BASE_URL?.trim() && env.PLING_UPSTREAM_API_KEY?.trim() && env.PLING_MODEL?.trim(),
    );
    return jsonResponse({ ok: true, service: "pling-gateway", edge: "cloudflare", configured }, 200);
  }

  if (!url.pathname.endsWith("/chat/completions")) {
    return jsonResponse({ error: { code: "NOT_FOUND", message: "Unknown model gateway route." } }, 404);
  }
  if (request.method !== "POST") {
    return jsonResponse(
      { error: { code: "METHOD_NOT_ALLOWED", message: "Use POST for model requests." } },
      405,
      { allow: "POST" },
    );
  }

  const origin = request.headers.get("origin");
  if (!origin || !originAllowed(request, origin, env)) {
    return jsonResponse(
      { error: { code: "DEMO_ORIGIN_DENIED", message: "This origin may not use the public demo gateway." } },
      403,
    );
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return jsonResponse(
      { error: { code: "DEMO_ORIGIN_DENIED", message: "Cross-site model requests are not allowed." } },
      403,
    );
  }

  if (isLocalOrigin(origin) === false) {
    const client = request.headers.get("cf-connecting-ip") ?? origin;
    const result = await env.MODEL_RATE_LIMIT.limit({ key: client });
    if (!result.success) {
      return jsonResponse(
        { error: { code: "DEMO_RATE_LIMITED", message: "Demo request limit reached. Try again shortly." } },
        429,
        { "retry-after": "60" },
      );
    }
  }

  if (!env.PLING_UPSTREAM_BASE_URL?.trim() || !env.PLING_UPSTREAM_API_KEY?.trim() || !env.PLING_MODEL?.trim()) {
    return jsonResponse(
      { error: { code: "DEMO_MISCONFIGURED", message: "The demo model gateway is not configured yet." } },
      503,
    );
  }

  return getGateway(env).handle(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === "www.plingjs.dev") {
      url.hostname = "plingjs.dev";
      return Response.redirect(url.toString(), 308);
    }

    if (url.pathname === `${API_PREFIX}/health`) {
      return handleAgentApi(request, env);
    }

    if (env.PLING_PUBLIC_ACCESS !== "true") {
      return siteClosedResponse();
    }

    if (url.pathname === API_PREFIX || url.pathname.startsWith(`${API_PREFIX}/`)) {
      return handleAgentApi(request, env);
    }

    if (url.pathname === "/demos" || url.pathname === "/demo") {
      return Response.redirect(new URL("/demos/quickstart/", url).toString(), 308);
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
