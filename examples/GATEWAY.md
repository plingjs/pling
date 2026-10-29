# Local model gateway

`gateway.mjs` is the small Node service used by the public examples. The browser
calls `/api/agent/v1`; this process forwards the request to an OpenAI-compatible
provider. The provider base URL and API key never enter the browser bundle.

It is a teaching fixture, not a complete production gateway. Authentication,
durable quotas, abuse controls, and deployment-specific logging belong in the
hosting layer.

## Configure and run

From the repository root:

```bash
cp examples/.env.example examples/.env.local
# Fill PLING_UPSTREAM_BASE_URL, PLING_UPSTREAM_API_KEY, and PLING_MODEL.
pnpm dev:examples
```

`pnpm dev:examples` starts this gateway, the recipe access service, and the
Vite examples site. To run only the gateway:

```bash
node examples/gateway.mjs
```

The default local endpoint is `http://127.0.0.1:5192`; Vite proxies
`/api/agent/*` to it. `GET /health` reports whether the process is configured
without returning credentials.

## Browser and server values

- `VITE_AGENT_BASE_URL` is the browser-facing path, normally
  `/api/agent/v1`.
- `VITE_AGENT_MODEL` selects the model name visible to the page.
- `PLING_UPSTREAM_BASE_URL`, `PLING_UPSTREAM_API_KEY`, and `PLING_MODEL` are
  server-only values read by `gateway.mjs`.
- `PLING_DEMO_RATE_LIMIT` and `PLING_DEMO_RATE_WINDOW_MS` bound the local
  demonstration quota.

The gateway applies a per-client request limit and can pin one allowed model.
It does not move page state, tool execution, or approvals out of the browser.

## Production boundary

For a hosted deployment, put the same proxy behind an authenticated route such
as `/api/agent`, terminate TLS at the edge, and replace the in-memory quota with
the hosting platform's durable controls. Keep audit records free of model keys
and user credentials.
