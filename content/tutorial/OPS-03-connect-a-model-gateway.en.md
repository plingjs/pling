---
id: OPS-03
title: Connect a model gateway
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Connect a model gateway

A browser-based agent must send model requests somewhere. During local development, it can call an OpenAI-compatible provider directly. In production, that arrangement exposes the provider key, depends on the provider's CORS policy, and gives the application no reliable place to enforce identity, model choice, spending, or audit.

A model gateway is the server-side path through which those requests pass. It keeps the upstream credential out of the browser, decides which model the request may use, and records operational metadata. It does not take over the agent loop or the page runtime.

This guide uses the reference gateway in `@plingjs/server`. The same contract can be implemented by an existing backend; the package is a small implementation of that contract, not a required platform.

## The boundary this guide draws

The browser still owns the page observation, the conversation, the model turn, the selected tool call, and the execution result. The gateway receives an individual model request and returns the provider's response. It never sees the DOM, chooses a page action, or executes a capability.

This distinction matters for both latency and authority. Moving the loop into the gateway would create a second copy of page state and a second execution path. Neither is necessary for credential protection.

“Model gateway” is also not “Surface gateway”. They face opposite directions.

| Question | Model gateway | Surface gateway |
| --- | --- | --- |
| Who is asking? | The page's agent, using a model | An external agent, using a delegated session |
| What crosses it? | An OpenAI-compatible model request | A capability description and invocation |
| What does it protect? | Upstream model credentials and model-use policy | Page capabilities, scope, approval, and audit |
| Typical route | `/chat/completions` | Surface `describe` and `invoke` |
| What it does not do | Operate the page | Choose or pay for the external agent's model |

The two can be deployed in the same backend, but they are separate interfaces with separate trust decisions.

## The production topology

The production shape has three hops:

```text
Browser
  │  POST /api/llm/v1/chat/completions   (no upstream key)
  ▼
Application origin / reverse proxy
  │  authenticated, rate-limited route
  ▼
Model gateway
  │  fixed upstream + server-side credential
  ▼
OpenAI-compatible model service
```

The browser uses a relative URL, so its request remains on the application's origin. The reverse proxy or application server authenticates the user's session and forwards the request to the gateway. The gateway selects the upstream model service and adds the server credential. The model service never receives a browser-held provider key because there is none.

This shape also avoids a broad CORS exception. A browser calling a different model host directly needs CORS permission from that host and must decide whether cross-site cookies are acceptable. A same-origin route avoids that extra surface.

## Configure the browser

The browser needs three values: a relative base path, a model alias, and an empty browser-side key.

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

`createOpenAiLlm` appends `/chat/completions`, so this example sends to `/api/llm/v1/chat/completions`. The model name must be one the fixed upstream accepts. The reference gateway forwards it unchanged; it does not maintain an alias table.

The equivalent configuration entry in a React or vanilla adapter uses the same values. The adapter changes how the application declares the runtime, not how the model request is transported.

Direct browser access is still useful during development:

| Mode | Browser base URL | Browser key | Appropriate use |
| --- | --- | --- | --- |
| Direct | An absolute provider URL | A short-lived development key | Local development or compatibility testing |
| Gateway | A same-origin relative path | Empty | Production |
| Injected model | Not used by the transport | Not used | Scripted demos, tests, or a host-provided implementation |

A key placed in a `VITE_*` variable is embedded in the front-end build. It is visible to every user of that build, regardless of whether the source file is committed. Environment variables protect a key only when the code reading them runs on the server.

The assistant interface should not ask visitors to paste a provider key or an arbitrary endpoint. If a product needs customer-owned credentials, store them in a server-side control plane and expose a model alias to the page. If a person wants to use their own agent and model, that is an external-agent path, not a browser key form.

## Create the gateway

The package exports a Web-standard request handler and a small `node:http` adapter. The following example stands up the reference gateway on a private loopback interface:

```ts
import { createServer } from "node:http";
import { createPlingGateway, toNodeHandler } from "@plingjs/server";

const gateway = createPlingGateway({
  upstream: {
    baseUrl: process.env.PLING_UPSTREAM_BASE_URL!,
    apiKey: process.env.PLING_UPSTREAM_API_KEY!,
  },
  model: process.env.PLING_MODEL!,
  allowedModels: [process.env.PLING_MODEL!],
  authorize: async ({ headers }) => {
    const user = await verifySession(headers.get("cookie"));
    return user ? { ok: true, user: { id: user.id } } : false;
  },
  onAudit: (event) => auditLog.write(event),
  timeoutMs: 30_000,
  maxBodyBytes: 512 * 1024,
  retry: { maxRetries: 1, baseDelayMs: 400, maxDelayMs: 2_000 },
});

createServer(toNodeHandler(gateway)).listen(5192, "127.0.0.1");
```

`verifySession` and `auditLog` stand for the application's existing session checker and audit sink. They are not Pling APIs. The gateway calls them at the model-request boundary.

In development, a same-origin Vite proxy is enough to connect the page to this listener:

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

The gateway accepts any path ending in `/chat/completions`, so the proxy does not need to strip the prefix. `GET .../health` returns a small readiness response. In production, the reverse proxy must forward request bodies and streaming responses without buffering them.

The gateway object can also be mounted directly in Bun, Deno, a serverless function, or an existing web framework by calling `gateway.handle(request)` with a standard `Request`. The Node adapter is an integration convenience, not the protocol.

## Authentication is per request

The gateway does not infer a user from a client-supplied header or from the presence of a cookie. The application supplies an `authorize` hook. It runs for every model request and returns a decision.

```ts
authorize: async ({ headers, request }) => {
  const session = await verifySession(headers.get("cookie"));
  if (!session) return false;

  return {
    ok: true,
    user: { id: session.userId, tenant: session.tenantId },
  };
}
```

- `false` rejects the request with `401 UNAUTHORIZED`.
- `{ ok: false, status?, message? }` rejects with `403` by default, or with the explicit status.
- `{ ok: true, user?, headers? }` allows the request. `user` is available to the audit hook; `headers` are added to the upstream request.
- A missing hook and no explicit `allowAnonymous: true` produce `503 GATEWAY_MISCONFIGURED`. Forgetting to configure authentication never means “open to everyone”.
- An exception in the hook produces `500 AUTHORIZE_FAILED`; it is not treated as a successful authentication.

The hook should verify a server-side session or a signed token. It should not trust a `user-id` header sent by the browser unless a trusted proxy has signed or stripped that header. When a cookie is used across sites, the application also needs an explicit CSRF and CORS design; a gateway does not make an unsafe cookie policy safe.

The value returned as `user` should contain only the non-sensitive identifiers needed for audit, such as a user id and tenant id. The gateway does not sanitize that value.

Upstream credentials and user credentials are separate. The configured upstream `apiKey` becomes the default `Authorization` header. If the upstream expects the current user's token, `authorize` can return an `authorization` header explicitly; that decision replaces the configured header for that request. Browser cookies are not forwarded automatically.

## Model selection stays on the server

The browser may include a model name in the request body, but it does not control the upstream target. The upstream base URL is fixed when the gateway is created. The package accepts only `http` and `https`, rejects embedded usernames or passwords, and rejects query strings and fragments in the base URL. There is no request parameter that redirects a model call to another host.

Model policy is expressed through two options:

```ts
createPlingGateway({
  upstream,
  model: "app-chat",
  allowedModels: ["app-chat", "app-chat-mini"],
});
```

- `model` overrides any model name in the browser request.
- `allowedModels` validates the final model name. An unlisted value returns `400 MODEL_NOT_ALLOWED`.
- If neither option is set, the request's model name is used. That may be acceptable for a trusted internal client, but it is not a good default for a public application.

A model alias is useful only when the fixed upstream resolves it. The reference gateway forwards the selected model name unchanged; it does not map `support-fast` to a provider model. When an internal model router provides that mapping, aliases can hide provider and region details, let the backend rotate credentials without a front-end release, and give the gateway a stable unit for budgets and policy. The alias is not a secret. If the upstream is the provider itself, use the provider's model id.

## What the gateway sees

A model gateway is a credential boundary, not a privacy boundary. The request contains the system prompt, page observation, conversation history, and tool declarations. The response contains the model's text and any proposed tool calls. The gateway necessarily handles both.

That has three consequences:

1. Sensitive-value substitution must happen before the request reaches the gateway. Removing a key from the browser does not remove business data from the model request.
2. Prompt and response bodies should not be written to ordinary gateway logs, access logs, error trackers, or tracing systems. The built-in audit hook is deliberately metadata-only for this reason.
3. A gateway can add content filtering or data-loss-prevention rules, but those rules do not replace the page's capability and backend authorization checks. The model still only proposes actions; the runtime and backend decide whether an action may run.

The audit event contains a request id, time, model, stream flag, status, upstream status, attempts, duration, byte counts where available, the authorizer's user value, and an error code. It does not contain the prompt, the response, or the upstream key. If the application needs a stronger audit trail, it should add fields that identify the business request without copying the model context.

## Limits, retries, and failure semantics

The reference gateway has bounded defaults. They are starting points, not a complete capacity plan.

| Option | Default | Effect |
| --- | --- | --- |
| `maxBodyBytes` | 1,000,000 bytes | Requests above the limit return `413 PAYLOAD_TOO_LARGE` before the upstream is called |
| `timeoutMs` | 60,000 ms | Limits the wait for upstream response headers; `0` disables this timer |
| `retry.maxRetries` | 2 | Adds at most two retries after the first attempt; the range is 0–5 |
| `retry.baseDelayMs` | 500 ms | Base for exponential backoff |
| `retry.maxDelayMs` | 4,000 ms | Caps one backoff delay, including an upstream `Retry-After` |

Retries cover 408, 425, 429, 5xx, network failures, and a header timeout. They do not cover 400, 401, 403, or other deterministic client errors. A streaming request can be retried only before the upstream starts returning a body; once bytes are flowing to the browser, the gateway does not replay the request.

The gateway timeout ends when upstream headers arrive. The body can still stall while it is being read; the browser-side OpenAI adapter applies its own timeout to that phase.

The browser-side model chain also has a retry budget. It recognizes the gateway's `retryExhausted` marker and stops retrying, so the default two layers do not multiply into an unbounded loop. If the application wants only one retry budget, set the other layer to zero explicitly and monitor the result.

The gateway maps upstream failures to stable client-facing errors and does not return the upstream body:

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_JSON` / `INVALID_BODY` | The request body is not a JSON object |
| 400 | `MODEL_REQUIRED` / `MODEL_NOT_ALLOWED` | The final model is missing or not allowed |
| 401 / 403 | `UNAUTHORIZED` | The authorize hook rejected the request |
| 413 | `PAYLOAD_TOO_LARGE` | The request body exceeded the configured limit |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | The request is not JSON |
| 499 | `CLIENT_ABORTED` | The browser cancelled the request |
| 500 | `AUTHORIZE_FAILED` / `GATEWAY_INTERNAL` | The hook or gateway itself failed |
| 502 | `UPSTREAM_UNAVAILABLE` / `UPSTREAM_ERROR` | Network failure or a non-retryable upstream response |
| 503 | `GATEWAY_MISCONFIGURED` | No authentication policy was configured |
| 503 | `UPSTREAM_RATE_LIMITED` | Upstream returned 429 and retries were exhausted |
| 504 | `UPSTREAM_TIMEOUT` | The gateway did not receive upstream headers in time |

Error bodies include `requestId`, `retryable`, and, where applicable, `attempts` and `retryExhausted`. The request id is also returned in `x-pling-request-id` and appears in the audit event, which makes it possible to correlate a user report with gateway metadata without logging the prompt.

Three failures are common during a first integration:

- **Every request returns `503 GATEWAY_MISCONFIGURED`.** No `authorize` hook was supplied. Add one. Use `allowAnonymous: true` only on a private local or internal listener, and remove it before production.
- **The browser reports a network failure or CORS error.** The browser is still pointing at an absolute provider URL, or the same-origin route is not proxying to the gateway. Set the relative base path and verify the POST route, including streaming.
- **The provider rejects the credential, but the browser only sees `502 UPSTREAM_ERROR`.** The gateway deliberately hides the upstream response body. Check `upstreamStatus` and the request id in the audit sink, then correct or rotate the server credential without exposing it to the client.

## Deployment checklist

- Keep the upstream key in a secret manager or server environment, never in source, a container image, a public build, or localStorage.
- Serve the browser and the model route from the same origin. Use TLS, and do not enable broad credentialed CORS to compensate for a cross-origin deployment.
- Bind the gateway to a private interface. Expose only the intended route through the reverse proxy.
- Implement `authorize` against the application's real identity system. Do not accept user ids or roles from the request body.
- Set a fixed model alias or an allowlist. Do not let a public client choose an arbitrary expensive model.
- Add rate limits, tenant quotas, spending budgets, and a kill switch outside `@plingjs/server`. The package bounds individual requests; it is not a billing or tenant platform.
- Disable request and response body capture in reverse-proxy, APM, and error logs. Keep prompt-free audit metadata and define its retention period.
- Use the health route on the internal listener. It is intentionally unauthenticated; do not expose it as a general public endpoint.
- Decide timeout and retry budgets as one system. Alert on repeated `UPSTREAM_RATE_LIMITED`, `UPSTREAM_TIMEOUT`, and `retryExhausted` outcomes.
- Test the negative paths: no session, wrong origin, missing model, oversized body, upstream timeout, and a missing provider key.
- Scan the production bundle for credentials. A key in a `VITE_*` variable is not protected by the fact that it is “only an environment variable”.

## Summary

A model gateway keeps the provider credential on the server and turns model use into an application-controlled operation. The browser keeps the agent loop and page authority; the gateway authenticates the caller, selects a permitted model, forwards one request to a fixed upstream, and emits metadata for operations.

It does not make the model request private, authorize page actions, or replace backend business rules. Those remain separate controls. The useful production question is therefore narrow and testable: can this browser call this model under this identity, with this budget, through this fixed upstream, without learning the credential?
