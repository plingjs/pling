# External Agent Surface example

This directory shows one Todo page arranged as three work areas:

- the Todo itself, with all normal manual controls;
- an in-page protocol inspector that sends Surface `describe` / `invoke` calls;
- a public Surface that provides setup snippets for Codex, Claude, Hermes Agent,
  and WorkBuddy.

There is intentionally no page chat assistant here. The operator and the
external Agent share one business page, so the example stays focused on the
third-party capability boundary.

The hosted path is the primary one. Open:

```text
https://plingjs.dev/demos/external-agent-surface/?mcp=1&lang=zh
```

The page asks the official Surface Gateway for a short-lived page session and
generates an Agent access token for that session. Pick the client tab that
matches your runtime and copy its complete setup snippet.

The hosted path uses `useSurfaceGateway()` from `@plingjs/vue`. The adapter owns
the page session, WebSocket transport, request bridge, claim, reconnect, and
teardown; the demo only declares its allowlist and renders the resulting state.

The public demo currently gives both the page session and the Agent token a
maximum lifetime of 24 hours. The token still becomes unusable as soon as the
page is closed or reloaded, the Agent is revoked, or the page session expires.

The rules shown in the page are deliberate:

- reloading the page creates a new page session and a new token;
- one page session binds one Agent, so multiple clients need separate pages;
- keep the page open for the whole interaction.

```bash
export PLING_AGENT_TOKEN='<token shown on the page>'
codex mcp remove pling-todo 2>/dev/null || true
codex mcp add pling-todo \
  --url https://surface.hunger-valley.com/mcp \
  --bearer-token-env-var PLING_AGENT_TOKEN
codex --no-daemon
```

The last line starts Codex from the same shell so the MCP process inherits the
token. `--no-daemon` is deliberate: otherwise Codex can reuse a shared
app-server daemon that was started before the token existed. Ask the agent to call
`pling_surface_describe` before invoking anything. The page must stay open. A destructive call returns
`pending_approval` and waits for the person on the page; there is deliberately
no approve-on-behalf tool.

To use the Codex desktop app's `/mcp` panel, quit the app completely and run
`codex app-server daemon stop` before launching it again from the same terminal.
The CLI path above is the most reliable way to verify the integration.

This direct-token flow is a deliberate convenience for the public demo. The
token is in the page DOM and can be read by page scripts, browser extensions, or
screenshots. Production integrations should use OAuth or device authorization
and keep long-lived credentials out of the page.

The other client tabs use the same remote MCP endpoint:

- Claude Code: `claude mcp add --transport http ... --header "Authorization: Bearer $PLING_AGENT_TOKEN"`;
- Hermes Agent and WorkBuddy: add a Remote / Streamable HTTP MCP server in their
  MCP or connector settings, then use the page URL and Authorization header.

Menu names can vary by client version; the endpoint and permission boundary do
not.

## Local loopback bridge

The original stdio bridge remains useful for local transport debugging. Start
the example server, open the local page, and register the stdio server:

```bash
pnpm dev:examples
PLING_SURFACE_APP_URL="http://localhost:5191/external-agent-surface/?mcp=1" \
pnpm --filter @plingjs/examples surface:mcp
```

```bash
codex mcp add pling-todo -- node "$(pwd)/examples/demos/external-agent-surface/mcp-server.mjs"
```

The local bridge listens on `127.0.0.1:5283` by default. It exposes
`pling_surface_describe`, `pling_surface_invoke`, and
`pling_surface_approval_status`. It does not expose the DOM, a generic click, a
script evaluator, or an approval tool.

Do not use the loopback bridge as the hosted integration. Browsers block a
public HTTPS page from opening a private loopback socket
(`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`). The hosted page therefore uses
the Surface Gateway; see `services/surface-gateway/README.md`.

## Files

- `src/App.vue` — business UI, declared tools, records, and approval, plus the
  hosted path through `useSurfaceGateway()`; the session, bridge, and transport
  stay in the package instead of this demo;
- `src/GatewayGuide.vue` — token lifetime, connection rules, and the Codex,
  Claude, Hermes Agent, and WorkBuddy tabs;
- `src/surface.ts` — external allowlist and the local Surface used by the
  protocol inspector and loopback bridge;
- `src/mcp-bridge.ts` — optional loopback bridge for local development;
- `mcp-server.mjs` and `lib/` — stdio MCP facade used by the loopback path.

The smoke test exercises the stdio facade end to end with a simulated page:

```bash
pnpm --filter @plingjs/examples surface:smoke
```
