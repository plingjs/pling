# Configure the Pling model gateway

This reference is for an in-page Pling assistant that calls a language model.
It does not configure an external Agent's MCP transport; that is the Surface
gateway covered separately.

## Request path

```text
Page agent runtime
  → same-origin application route
  → model gateway / existing backend
  → fixed OpenAI-compatible upstream
```

The Agent loop and page capability execution remain in the browser. The model
gateway handles one model request at a time; it keeps the provider key server
side and can enforce identity, model policy, rate limits, request limits, retry,
timeout, and metadata-only audit.

## Browser configuration

Use a relative, same-origin `baseUrl`; leave the browser key empty. The OpenAI
adapter appends `/chat/completions` to the base path.

```ts
const pling = createPling({
  agent: {
    config: {
      baseUrl: "/api/llm/v1",
      model: "app-chat",
      apiKey: "",
    },
  },
});
```

The model value must be accepted by the gateway's fixed upstream and policy.
Follow the exact config shape exposed by the installed adapter version.

Never put provider credentials in `VITE_*`, `NEXT_PUBLIC_*`, client-side
environment variables, browser storage, an Agent prompt, or an exposed tool.
Build-time environment variables are still public when embedded in frontend
assets.

## Reference Node gateway

Install the gateway package on the server, not as a frontend dependency:

```bash
npm install @plingjs/server
```

Minimal production-shaped Node example:

```ts
import { createServer } from "node:http";
import { createPlingGateway, toNodeHandler } from "@plingjs/server";

const model = process.env.PLING_MODEL!;
const gateway = createPlingGateway({
  upstream: {
    baseUrl: process.env.PLING_UPSTREAM_BASE_URL!,
    apiKey: process.env.PLING_UPSTREAM_API_KEY!,
  },
  model,
  allowedModels: [model],
  authorize: async ({ headers }) => {
    const session = await verifySession(headers.get("cookie"));
    return session ? { ok: true, user: { id: session.userId } } : false;
  },
  onAudit: (event) => auditLog.write(event),
  timeoutMs: 30_000,
  maxBodyBytes: 512 * 1024,
  retry: { maxRetries: 1, baseDelayMs: 400, maxDelayMs: 2_000 },
});

createServer(toNodeHandler(gateway)).listen(5192, "127.0.0.1");
```

`verifySession` and `auditLog` are the application's existing services, not
Pling exports. In production, use an explicit auth hook. Without one,
`@plingjs/server` fails closed unless `allowAnonymous: true` is explicitly
configured. Allow anonymous access only for a private local/test gateway with
appropriate network controls; do not expose that example configuration to a
public endpoint.

Environment variables belong to the server process or secret manager:

```dotenv
PLING_UPSTREAM_BASE_URL=https://provider.example/v1
PLING_UPSTREAM_API_KEY=server-only-secret
PLING_MODEL=provider-model-id
```

Use the provider's documented OpenAI-compatible base URL. Some providers
require `/v1`; do not append `/chat/completions` to `PLING_UPSTREAM_BASE_URL`.
The browser's `baseUrl` and the provider's `baseUrl` are different settings.

## Development proxy

For local development, proxy the browser route to the loopback gateway. Example
Vite configuration:

```ts
server: {
  proxy: {
    "/api/llm": {
      target: "http://127.0.0.1:5192",
      changeOrigin: true,
    },
  },
}
```

The reverse proxy must preserve request bodies and streaming responses. In
production, bind the Node gateway to a private interface and expose only the
authenticated application route over TLS. Do not solve routing with broad
credentialed CORS.

## Authentication, models, and audit

- `authorize` runs for each request. Verify a real server-side session or signed
  credential; do not trust an unsigned `user-id` or role header supplied by the
  browser.
- `model` pins/overrides the model name. `allowedModels` rejects values outside
  the allowlist. The reference gateway forwards model IDs; it does not create
  an alias-to-provider mapping.
- Add application-level rate limits, user/tenant budgets, and a kill switch;
  the package's request bounds are not a billing platform.
- Do not log prompt/response bodies in the gateway, reverse proxy, APM, or error
  tracker. Use the metadata-only audit hook and a request ID for correlation.
- The gateway sees conversation history, page context, and tool declarations.
  Keeping the key server-side does not make business data private from the
  configured model provider.

## Diagnose common failures

| Symptom | Check |
| --- | --- |
| `503 GATEWAY_MISCONFIGURED` | Configure `authorize`; use explicit anonymous mode only for a private local/test listener. |
| Browser network/CORS failure | Confirm the client uses the same-origin relative URL and the proxy forwards that route and streaming body. |
| `404` from upstream | Check provider base URL, whether its path requires `/v1`, and exact model ID. Do not add `/chat/completions` twice. |
| `401` / `403` | Verify the server-only provider credential and the application's `authorize` result. |
| `502 UPSTREAM_ERROR` | Use the request ID and metadata-only audit record to inspect `upstreamStatus`; the gateway intentionally does not return provider bodies. |
| `413` / `504` / repeated retries | Check request size, timeouts, and combined browser/server retry budgets. |

Consult the exact option table and error codes at:

- [Connect a model gateway](https://plingjs.dev/operations/connect-a-model-gateway)
- [Node gateway API](https://plingjs.dev/reference/node-gateway)
- [Model access and trust boundaries](https://plingjs.dev/concepts/model-access-and-trust-boundaries)
