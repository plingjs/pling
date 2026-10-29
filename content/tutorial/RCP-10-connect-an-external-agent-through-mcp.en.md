---
id: RCP-10
title: "Connect an external agent through MCP"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Connect an external agent through MCP

MCP is a common tool entry point for external agents. It can carry `describe` and `invoke`, but it does not automatically provide page identity, capability scope, or approval. Treat MCP as a transport and tool-presentation layer, not a second business implementation.

## Runnable page

The ticket page below stays open while an external stdio MCP process connects to it over loopback. The client receives `describe` and `invoke`, not the DOM, model credentials, or a generic script evaluator.

<DemoPlayground id="recipe-mcp" />

Start the page and the MCP server separately:

```bash
pnpm dev:examples
PLING_SURFACE_APP_URL="http://localhost:5191/demos/recipe-mcp/?mcp=1" \
pnpm --filter @plingjs/examples surface:mcp
```

Open `http://localhost:5191/demos/recipe-mcp/`, then register the second command in an MCP client that supports stdio. The page source is in `examples/demos/recipe-mcp/`; the bridge and server are in `examples/demos/external-agent-surface/`, with startup, tool inventory, and security boundaries in that directory's `README.md`. This fixture listens on loopback only and does not provide a public MCP endpoint.

## Target structure

```text
External agent
  │ MCP tool call
  ▼
MCP facade
  │ describe / invoke / status
  ▼
Authenticated transport
  │ page session + agent session
  ▼
Pling Surface → existing executor
```

The page must remain connected, or the backend must hold a verifiable page session. A facade must not assume that an agent token grants every user, tenant, or page.

## Tool mapping

A minimal facade can expose:

| Tool | Behavior |
| --- | --- |
| `pling_surface_describe` | Return current capabilities and bounded context |
| `pling_surface_invoke` | Invoke one exposed capability |
| `pling_surface_approval_status` | Query a pending request or asynchronous result |

The tool schema must preserve capability id, input properties, effect, approval, and record template. Do not flatten every capability into a parameterless tool or synthesize tools from button copy.

Do not expose `pling_approve`, arbitrary DOM clicks, or script evaluation. Approval belongs to a real person in the page; the agent can query the result.

## Wiring steps

1. Start the page-side Surface reference:

   ```bash
   pnpm dev:mcp-reference
   ```

2. Register the local MCP server with your client from the repository root:

   ```bash
   codex mcp add pling-demo -- pnpm mcp:reference
   ```

3. Open the demo page and let its session connect to the local bridge.
4. Ask the agent to call `describe` and confirm only allowlisted capabilities appear.
5. Run a read task, then a write with schema.
6. Try an action requiring confirmation; verify the agent receives pending status and has no approval tool.

For a complete login and bearer-token flow, use the authenticated Todo reference: the page creates a one-time pairing code, the terminal claims a token, and the MCP client sends it as a bearer token. Treat that token as a password and never put it in logs or model context.

## Acceptance criteria

1. Unpaired or expired tokens are rejected.
2. One user cannot reach records through another user's connection.
3. The tool list contains only the current session's exposed capabilities.
4. Business failure remains a result, not a disguised transport error.
5. High-risk actions return `pending_approval` or an equivalent state; no self-approval tool exists.
6. Closing the page, revoking the session, or expiring the token fails closed.
7. Reusing a request id does not write twice.

## Common problems

**The MCP server owns a database.** That splits page state from business truth. The facade should forward capability calls; the application remains authoritative.

**Dumping the whole page into a system prompt.** It changes on every connection. Use `describe` for the current snapshot and `after` to reduce repetition.

**Giving the bearer token to the model.** The MCP client adds it at the transport layer; the model sees tool results only.

**Approving through an MCP tool.** Refuse. Approval must occur in a user-visible page bound to the request.

## Tests and limits

The local MCP reference includes stdio transport and a scripted smoke test; the authenticated Todo reference adds the bearer-token path. Both use memory or demo identity and are not production SSO, cross-instance session storage, or a public gateway. Production still needs TLS, tenant isolation, persistence, distributed limits, and audit retention.

## Local verification

Ask the MCP client to list open tickets, reply to `TCK-91`, and read the statistics. Confirm that its tool list contains only describe, invoke, and approval status. Close the page and call again; the client should disconnect or fail rather than continue from a cached business result.
