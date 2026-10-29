---
id: REF-06
title: "Node gateway"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Node gateway

`@plingjs/server` is a thin OpenAI-compatible gateway. It forwards a browser request to a fixed upstream using a server-held credential, applies authentication and bounded request handling, and returns the response. It does not run the agent loop, read the page, store conversation memory, or implement tenant billing.

This separation matters: the browser still decides which declared capability to call, while the server owns provider credentials and the outbound request boundary.

## Minimal server

```ts
import { createPlingGateway, toNodeHandler } from "@plingjs/server";
import { createServer } from "node:http";

const gateway = createPlingGateway({
  upstream: {
    baseUrl: process.env.PLING_UPSTREAM_BASE_URL!,
    apiKey: process.env.PLING_UPSTREAM_API_KEY!,
  },
  model: "deepseek-chat",
  authorize: async ({ headers }) => {
    const user = await verifySession(headers.get("cookie"));
    return user ? { ok: true, user } : false;
  },
  onAudit: (event) => audit.write(event),
});

createServer(toNodeHandler(gateway)).listen(5192);
```

The browser configuration contains a same-origin path and no provider secret:

```ts
createPling({
  agent: {
    config: { baseUrl: "/api/llm/v1", model: "deepseek-chat", apiKey: "" },
  },
});
```

## Options

| Option | Type | Default | Behavior |
| --- | --- | --- | --- |
| `upstream` | `string \| { baseUrl, apiKey?, headers? }` | required | The only target the gateway can call |
| `model` | `string` | client value | Forces the upstream model |
| `allowedModels` | `readonly string[]` | omitted | Rejects a resolved model outside the allowlist |
| `authorize` | `(ctx) => boolean \| decision` | omitted | Receives the `Request`, `Headers`, and path |
| `allowAnonymous` | `boolean` | `false` | Must be explicit for an unauthenticated local demo |
| `onAudit` | `(event) => void \| Promise<void>` | omitted | Metadata audit; callback failure is contained |
| `fetch` | `typeof fetch` | global `fetch` | Injection point for tests or a custom transport |
| `timeoutMs` | `number` | `60_000` | Waits for upstream response headers; `0` disables |
| `retry` | `false \| { maxRetries?, baseDelayMs?, maxDelayMs? }` | `maxRetries: 2` | Bounded retry before any response body is relayed |
| `maxBodyBytes` | `number` | `1_000_000` | Request body limit |

`createPlingGateway()` returns `{ handle(request: Request): Promise<Response> }`. `toNodeHandler(gateway)` adapts that interface to `node:http`; Bun, Deno, serverless handlers, and existing frameworks can call `handle()` directly.

## Routing contract

- A model request path must end with `/chat/completions`.
- `POST` is the only accepted method for model calls.
- `GET .../health` returns `{ "ok": true, "service": "pling-gateway" }`.
- The path prefix is not fixed. `/api/llm/v1/chat/completions` and `/internal/llm/v1/chat/completions` both work.
- The upstream URL is selected at construction time. A browser cannot supply a new upstream URL.

## Authentication and credentials

If neither `authorize` nor `allowAnonymous: true` is present, model calls fail closed with HTTP `503` and `GATEWAY_MISCONFIGURED`. This prevents a forgotten policy from becoming public access.

`authorize` can return:

```ts
true
// or
{ ok: true, user?: unknown, headers?: Record<string, string> }
// or
{ ok: false, status?: number, message?: string }
```

The returned `headers` are added to the upstream request. They are the explicit path for a tracing header or a short-lived provider assertion. Browser cookies are not forwarded automatically.

The provider key is read from server configuration and sent only upstream. It must never be returned in a response, audit event, browser bundle, or error message.

## Body, timeout, and retry

The body limit is enforced before parsing and before any upstream call. A request above the limit returns `413 PAYLOAD_TOO_LARGE`.

The timeout covers waiting for upstream response headers, not the full streamed completion. When it expires, the gateway returns `504 UPSTREAM_TIMEOUT`.

Retry applies only while nothing has been sent to the browser. It covers:

- HTTP `408`, `425`, `429`, and `5xx`;
- network failure;
- waiting for response headers past the timeout.

It does not retry `400`, `401`, `403`, or another non-retryable status. `maxRetries` excludes the first attempt, defaults to `2`, and is capped at `5`. Delay uses bounded exponential backoff with jitter; `Retry-After` is respected but still clamped by `maxDelayMs`.

For streaming, retry stops once the response body begins to reach the browser. Replaying a partially delivered completion would duplicate content and distort usage accounting.

The browser-side agent chain also has retry logic. Keep both budgets explicit. If only one layer should retry, disable the other with `retry: false` on the gateway or a zero browser budget.

## Error shape

All gateway errors have this shape:

```json
{
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "Upstream timed out after 3 attempts",
    "requestId": "…",
    "retryable": true,
    "attempts": 3,
    "retryExhausted": true
  }
}
```

`retryable` describes the final failure class. `retryExhausted` means this gateway has consumed its own budget; a client must not start another automatic retry loop for the same request.

| HTTP | Code | Meaning |
| --- | --- | --- |
| `400` | `INVALID_JSON` / `INVALID_BODY` | Invalid request body |
| `400` | `MODEL_REQUIRED` / `MODEL_NOT_ALLOWED` | No model or a disallowed model |
| `401` / `403` | `UNAUTHORIZED` | Application authorization failed |
| `404` | `NOT_FOUND` | Path does not end in `/chat/completions` |
| `405` | `METHOD_NOT_ALLOWED` | Non-POST model request |
| `413` | `PAYLOAD_TOO_LARGE` | Body limit exceeded |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Body is not JSON |
| `499` | `CLIENT_ABORTED` | Client disconnected |
| `502` | `UPSTREAM_UNAVAILABLE` / `UPSTREAM_ERROR` | Upstream network failure or non-2xx response |
| `503` | `GATEWAY_MISCONFIGURED` | Authentication was not configured |
| `503` | `UPSTREAM_RATE_LIMITED` | Upstream `429` after retry exhaustion |
| `504` | `UPSTREAM_TIMEOUT` | Upstream timeout |

## Audit

`GatewayAuditEvent` contains the request id, time, method, path, model, stream flag, final status, optional upstream status, attempts, duration, byte counts, optional authorized user, and final error metadata. It deliberately excludes prompts, completions, cookies, and provider keys.

Audit sink failures do not change the model response. Production should still route audit failures to its own logger or alerting system; a callback that silently disappears is not an audit trail.

## Deployment checklist

- Terminate TLS before the gateway or inside the same trusted boundary.
- Set an explicit authentication policy; never rely on a forgotten `authorize`.
- Pin the provider base URL and, where possible, the model.
- Keep request and timeout limits below the platform's own limits.
- Add a per-user rate limit in front of the gateway if the service is public.
- Send audit events to durable storage with access control and retention.
- Do not expose admin, billing, or arbitrary proxy paths from the same handler.
- Test streaming cancellation and one retry-exhaustion path before launch.

The gateway is not a policy engine, secret vault, cost-accounting service, or prompt firewall. Those controls belong in the surrounding backend and must remain independent of model compliance.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/server` `0.1.0-alpha.3` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Node.js 20 or later |
| Peer dependencies | None |
| Stability | Pre-1.0 alpha; a minor release may change the API |

The compatibility boundary is the Node.js runtime and the HTTP contract on this page. Provider-specific request and response behaviour remains the provider's contract, and this package does not depend on any UI framework.
