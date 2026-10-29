---
id: SITE-03-surface
layout: page
pageClass: demo-page
title: "Example 05: Expose capabilities"
description: A complete Todo, a protocol inspector, and a public Surface for Codex, Claude, Hermes Agent, and WorkBuddy, while records, approvals, and business handlers stay in the page.
status: draft
release: 0.1
locale: en
---

<DemoPlayground id="external-agent-surface" />

## Live page

Open [Example 05 on plingjs.dev](https://plingjs.dev/demos/external-agent-surface/?mcp=1&lang=en). The page has three work areas:

- **Todo**: the real business page. Manual operations and external Agent calls act on the same data.
- **Protocol inspector**: sends `describe` / `invoke` directly and shows what an external client actually receives.
- **Public Surface**: requests a page session from the Pling Surface Gateway and provides setup snippets for Codex, Claude, Hermes Agent, and WorkBuddy.

This example deliberately has no page chat assistant. It shows how an outside Agent reaches the same business capabilities, not what an in-page assistant feels like.

The public example currently gives both the page session and the Agent token a
maximum lifetime of **24 hours**. The token stops operating the current page as
soon as the page is closed or reloaded, the Agent is revoked, or the session
expires.

There is intentionally no “hosted page plus local WebSocket” path: browsers block a public HTTPS page from reaching a loopback socket (`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`). The hosted example uses the gateway; the loopback bridge is for local development.

## Client setup

The four tabs on the page cover Codex, Claude, Hermes Agent, and WorkBuddy. They
connect to the same HTTPS MCP endpoint and share the six capabilities exposed by
the current page.

### Codex

1. Open the live page and wait for the **Codex access token** to appear.
2. Copy the complete command shown on the page. It is equivalent to:

```bash
export PLING_AGENT_TOKEN='token shown on the page'
codex mcp remove pling-todo 2>/dev/null || true
codex mcp add pling-todo \
  --url https://surface.hunger-valley.com/mcp \
  --bearer-token-env-var PLING_AGENT_TOKEN
codex --no-daemon
```

3. Run the whole command in one terminal. The last line uses `codex --no-daemon` so it does not reuse an older daemon that has no token.
4. Ask Codex to call `pling_surface_describe` before invoking a capability. For example:

> Describe the current Todo page, add “Prepare the customer demo”, then mark the first open task complete.

### Claude Code

```bash
export PLING_AGENT_TOKEN='token shown on the page'
claude mcp remove pling-todo >/dev/null 2>&1 || true
claude mcp add --transport http pling-todo \
  https://surface.hunger-valley.com/mcp \
  --header "Authorization: Bearer $PLING_AGENT_TOKEN"
claude
```

If your Claude build uses the Connectors screen, choose remote MCP and enter the
same URL and `Authorization` header.

### Hermes Agent and WorkBuddy

Add a remote HTTP server (also called Remote MCP or Streamable HTTP in some
builds) in the client's MCP or connector settings. Name it `pling-todo`, then use
the URL and `Authorization: Bearer <token>` shown on the page. If the client
accepts `mcpServers` JSON, the page provides a ready-to-copy object too.

Menu names vary by client version; the endpoint, request header, and permission
boundary do not.

## Lifetime and rules

- The page session and Agent token last at most **24 hours**.
- **Reloading the page creates a new page session and token.** The old token cannot operate the reloaded page.
- One page session is bound to one Agent. To run Codex, Claude, and other clients together, **open a separate page for each Agent**.
- Keep the page open. Closing it or revoking the Agent makes the token unusable even before its stated expiry.
- Delete and clear-completed always wait for a human confirmation on the page. An Agent cannot approve itself.

To use the Codex desktop app's `/mcp` panel, quit the app completely and run
`codex app-server daemon stop`, then relaunch it from the terminal where the
token is set. The `--no-daemon` CLI path is the most reliable way to verify the
integration.

This is the convenience mode for the public demo: the token is visible in the page DOM and can be read by page scripts, browser extensions, or screenshots. Production integrations should use OAuth or device authorization and keep long-lived credentials out of the page. The gateway still never exposes the DOM, script execution, cookies, or model keys to the Agent.

## What the Surface layer covers

- `@plingjs/surface` owns capability projection, `describe`, `invoke`, sessions, and the approval boundary.
- `services/surface-gateway` provides public transport, page sessions, Agent tokens, revocation, and audit.
- The page keeps the executor, parameter validation, and business functions. The gateway never executes page code and has no `click(selector)`, script evaluator, or approve-on-behalf tool.
- A company should create page sessions from its own backend rather than reuse this public demo endpoint.
