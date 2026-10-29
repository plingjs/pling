---
id: J-10
title: "Connect vanilla pages to the model gateway"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Connect vanilla pages to the model gateway

A key placed in a browser bundle is not a secret. It is sent to every visitor. Even when the variable is named `VITE_AGENT_KEY` or stored outside the repository, the built value is still readable in the page and usable by anyone who copies it.

The example removes the provider credential from the browser entirely. The page calls a same-origin endpoint. A small server process checks the session, chooses the upstream model, adds the provider key, applies limits, and returns the response.

## Keep the browser configuration ordinary

The page needs an endpoint and a model name. It does not need a provider key:

```ts
export const browserAgentConfig = {
  baseUrl: "/api/llm/v1",
  model: "server-model",
  apiKey: "",
} as const;
```

Pass that object to the page runtime:

```ts
const pling = createPling({
  agent: {
    config: {
      ...browserAgentConfig,
      systemPrompt: copy.systemPrompt,
      limits: { maxTurns: 100 },
    },
  },
});
```

The empty `apiKey` is deliberate. Cookies are sent by the browser under its normal same-origin rules, and the gateway supplies the provider credential after authenticating the request. The model name in the browser is a preference; the server can pin it or reject it.

## Authenticate before forwarding

The gateway receives a Web `Request` and returns a Web `Response`. This keeps it usable in Node, Bun, Deno, and serverless environments:

```ts
const gateway = createPlingGateway({
  upstream: {
    baseUrl: process.env.PLING_UPSTREAM_BASE_URL!,
    apiKey: process.env.PLING_UPSTREAM_API_KEY!,
  },
  model: process.env.PLING_GATEWAY_MODEL,
  allowedModels: ["server-model"],
  authorize: auth.authorize,
  allowAnonymous: false,
  onAudit(event) {
    console.log(JSON.stringify({ type: "pling.audit", ...event }));
  },
});
```

`authorize` runs before the request reaches the provider. A missing or expired session is rejected. If neither `authorize` nor `allowAnonymous: true` is configured, the gateway returns `503`; forgetting to configure authentication closes the endpoint instead of opening it.

The demo uses an HttpOnly session cookie instead of putting a token in `localStorage`. The cookie is `SameSite=Lax` and becomes `Secure` when the public origin uses HTTPS. Signing out revokes the session on the server, not merely in the page.

## Let the server choose the model

The browser may send a model name, but it should not be able to select an arbitrary or expensive one:

```ts
model: "server-model",
allowedModels: ["server-model", "server-model-fast"],
```

The gateway rejects an unknown model before calling upstream. A model picker in the page can express a preference, but it cannot grant access.

The same boundary limits request size, upstream time, and retries. These are security and availability constraints, not tuning knobs. One browser session should not be able to consume unbounded memory or upstream time.

## Record metadata, not conversations

An audit entry should answer operational questions: who called, which model, what status, how long, how many bytes, and whether retries were exhausted.

```ts
{
  type: "pling.audit",
  requestId: "…",
  user: { id: "demo-user" },
  model: "server-model",
  status: 200,
  durationMs: 842,
  bytesIn: 1780,
  bytesOut: 96,
  attempts: 1
}
```

Prompts and responses are omitted by default. They can contain customer data, personal information, or text copied from a private page. If an organization must record content for compliance, that decision needs its own retention, access, and redaction policy.

The response carries `x-pling-request-id`, so a browser failure can be matched to the server record without logging the conversation.

## Run the example

The page is a support-task table whose model route is `/api/llm/v1`. The gateway runs as a separate process.

```bash
pnpm tutorial:dev j-10
```

Copy `.env.gateway.example` to `.env.gateway`, fill in the provider settings, then start the gateway in another terminal:

```bash
pnpm --dir examples/tutorials/j-10-model-gateway dev:gateway
```

Open `http://127.0.0.1:5275/`, sign in with the configured demo password, and ask the assistant to work with the tasks. The browser network panel shows requests to the page origin, never to the provider and never with the provider key.

```bash
pnpm tutorial:check j-10
```

The checks cover the browser configuration, unauthenticated rejection before upstream access, fail-closed behavior without an authorization hook, server-side key injection, model pinning, HttpOnly session cookies, revocation, and metadata-only audit records.

## Common failures

**Using a `VITE_*` variable for the provider key.** Vite embeds those values in the browser bundle. The name does not protect the value.

**Trusting the model name from the browser.** The browser can change any part of its request. Pin the model or enforce an allowlist on the server.

**Using cookies without a CSRF decision.** `SameSite=Lax` covers common cases, but cross-site forms and multiple subdomains need an explicit policy.

**Logging full prompts under “debug”.** The gateway has broad access to sensitive content. Keep operational metadata separate from content logs, and redact before data leaves the process.

**Putting the agent loop in the gateway.** In this architecture the loop remains in the page. The gateway handles transport, credentials, authentication, limits, and audit; it does not read the DOM or decide which action to run.

Next: [MPA and task continuity](/vanilla/mpa-and-task-continuity).
