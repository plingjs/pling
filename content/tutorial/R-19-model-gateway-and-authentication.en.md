---
id: R-19
title: "Model gateway and authentication"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Model gateway and authentication

A model key copied into a browser bundle is not protected by an environment variable. It is delivered to every visitor who opens the page. The same is true of a base URL the browser can edit freely: once a visitor controls the destination and the model name, the application has handed over both the credential and the bill.

The production boundary is therefore narrower than “the page calls a model.” The page calls its own server. That server authenticates the request, chooses the upstream provider, adds the provider key, applies model and size limits, and records what happened.

## Keep the browser configuration boring

The browser needs an endpoint and a model name. It does not need a provider secret.

```ts
// src/agent-config.ts
export const browserAgentConfig = {
  baseUrl: '/api/llm/v1',
  model: 'server-model',
  apiKey: '',
} as const;
```

Pass this object to the agent configuration:

```ts
const pling = createPling({
  agent: {
    config: {
      ...browserAgentConfig,
      limits: { maxTurns: 100 },
    },
  },
});
```

`baseUrl` is same-origin. Cookies are sent with the request under the browser's normal same-origin rules. `apiKey` is empty because the gateway supplies the provider credential later. The model name in the browser is a preference, not an authority; the gateway can pin or reject it.

An empty key in the client is intentional, not an unfinished configuration. Putting a real provider key here defeats the entire boundary.

## Authenticate before forwarding

The gateway receives a normal `Request` and returns a normal `Response`. This keeps it usable from Node, Bun, Deno, or a serverless adapter without introducing a second agent loop.

```ts
const gateway = createPlingGateway({
  upstream: {
    baseUrl: process.env.PLING_UPSTREAM_BASE_URL!,
    apiKey: process.env.PLING_UPSTREAM_API_KEY!,
  },
  model: process.env.PLING_GATEWAY_MODEL,
  allowedModels: ['server-model'],
  authorize: auth.authorize,
  allowAnonymous: false,
  onAudit(event) {
    console.log(JSON.stringify({ type: 'pling.audit', ...event }));
  },
});
```

`authorize` runs before the request body is sent upstream. Returning `false` or `{ ok: false }` rejects the request. If neither `authorize` nor `allowAnonymous: true` is present, the gateway refuses requests. Forgetting to configure authentication therefore fails closed rather than opening the endpoint to everyone.

For a browser application, an HttpOnly session cookie is usually a better fit than a token stored in `localStorage`. The example also requires `SameSite=Lax` and, on HTTPS origins, `Secure`. The gateway validates the cookie on every model request; signing out revokes the session server-side.

## Make the server, not the page, choose the model

The client may send a model name, but it should not be allowed to choose an arbitrary or more expensive one. `model` pins the upstream model. `allowedModels` provides a whitelist when several models are legitimate:

```ts
model: 'server-model',
allowedModels: ['server-model', 'server-model-fast'],
```

Rejecting an unknown model before the upstream call is part of the authorization boundary. A client-side dropdown can describe a preference; it cannot grant access.

The gateway also enforces a request-body limit, an upstream timeout, and optional retries for transient failures. These are not performance tweaks. They prevent one browser session from consuming unbounded memory, upstream time, or retry budget.

## Audit metadata, not conversations

The audit record should answer operational questions: which user, which model, which status, how long, how many bytes, and whether a retry was exhausted.

```ts
{
  type: 'pling.audit',
  requestId: '…',
  user: { id: 'demo-user' },
  model: 'server-model',
  status: 200,
  durationMs: 842,
  bytesIn: 1780,
  bytesOut: 96,
  attempts: 1
}
```

Prompts and model answers are omitted by default. They can contain personal data, customer records, or secrets copied from the page. If an organisation needs content logging for compliance, that is a separate decision with its own retention, access, and redaction policy.

The request identifier is returned as `x-pling-request-id`, so a browser error and a server audit entry can be correlated.

## Run the example

The page is a small Todo list whose only model route is `/api/llm/v1`. A separate Node process provides the gateway.

```bash
pnpm tutorial:dev r-19
```

Start the gateway in another terminal after copying `.env.gateway.example` to `.env.gateway` and filling the provider settings:

```bash
cd examples/tutorials/r-19-model-gateway-and-authentication
node server.mjs
```

Then open `http://127.0.0.1:5259/?lang=en`, sign in with the configured demo password, and ask the Todo assistant to add or inspect a task. The browser network panel will show requests to `127.0.0.1:5259/api/llm/...`; it will not show a provider key.
The complete example is in `examples/tutorials/r-19-model-gateway-and-authentication`.

The deterministic check is:

```bash
pnpm tutorial:check r-19
```

It verifies the browser configuration, fail-closed authentication, session revocation, model pinning, server-side key injection, and metadata-only audit records.

## Failure modes

**Putting the provider key in `VITE_*` variables.** Vite embeds those values into the client bundle. They are visible to every visitor, regardless of how the variable is named.

**Trusting a client-supplied model name.** A browser can change any request it sends. Pin the model or enforce an allowlist on the server.

**Using a cookie without CSRF consideration.** `SameSite=Lax` covers the common case, but an application with cross-origin forms or multiple subdomains still needs an explicit CSRF policy.

**Logging full prompts for “debugging.”** Audit logs are long-lived and widely accessible. Keep operational metadata separate from content, and redact before anything leaves the process.

**Assuming the gateway is the agent.** It is not. The loop still runs in the page in this architecture; the gateway only owns transport, credentials, authentication, limits, and audit.
