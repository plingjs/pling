---
name: pling-local-mcp-facade
description: Build, review, or debug a local stdio MCP facade that lets Codex, Hermes, Claude, or another MCP-capable agent call a Pling Agent Surface in an already-open browser page. Use for local MCP bridge work, agent-to-page capability calls, and troubleshooting page connection or approval flows.
---

# Local MCP Facade for Pling Surface

## Use this skill when

- An external agent needs to operate a Pling-enabled page on the same machine.
- You are implementing or reviewing a local MCP server that forwards Surface
  `describe` / `invoke` calls to a browser page.
- The page is open, but Codex, Hermes, or another local agent cannot discover
  its capabilities.
- A local bridge works for reads but fails during approval, reconnect, or page
  close.

Do not use this skill to design a multi-user production gateway. The local
facade is a single-user development and controlled-pilot pattern. A production
gateway needs delegated identity, server-side authorization, durable audit,
shared rate limiting, and tenant isolation.

## Boundary

The facade is only a process and transport adapter. It must not duplicate
Surface, action registration, permissions, confirmation, sensitive-value
handling, or business execution.

```text
Agent process
  │ stdio JSON-RPC (MCP)
  ▼
Local MCP facade
  │ loopback WebSocket (or another local transport)
  ▼
Open page
  │ @plingjs/surface
  ▼
Existing registry + executor
  │
  ▼
Page state and business backend
```

Hard rules:

1. The page remains the execution authority for page-scoped capabilities.
2. Reuse `@plingjs/surface`; do not add `click(selector)`, `eval`, or arbitrary
   DOM steps to the facade.
3. Never expose an approval or "approve" MCP tool. The facade may report
   `pending_approval`, but only the page's trusted UI or the business backend
   may approve.
4. Bind the bridge to `127.0.0.1`, not `0.0.0.0`, unless the user explicitly
   requests a remote deployment and understands the credential boundary.
5. Treat the loopback token and Origin check as anti-accident controls, not
   authentication.
6. Write logs only to stderr. Stdout belongs to MCP JSON-RPC.

## Architecture decisions

Use stdio MCP when the agent starts local processes. This is the simplest and
most portable option for Codex and most desktop agents.

Use a loopback WebSocket when the page runs in a normal browser and the agent
runs as a separate process. The browser cannot accept an inbound connection;
the page therefore opens an outbound WebSocket to the local facade.

Use a remote HTTP/SSE MCP endpoint only when the agent cannot start a local
process, or when the page and agent are on different machines. That is a
different deployment with different authentication requirements.

If an HTTPS page cannot use `ws://127.0.0.1`, use `wss` with a trusted local
certificate or a same-origin relay. Do not disable browser security checks to
make the demo work.

## Implementation path

### 1. Reuse the page-side Surface

Keep the page's existing declarations and executor. Install the Surface where
the application already has access to its registry:

```ts
const surface = createSurface({
  registry,
  execute: (id, args) => executor.execute(id, args),
  expose: (id) => allowed.has(id),
  session: () => verifiedSession,
});
```

For a local facade, `expose` should be a small allowlist. Do not expose every
action merely because the page declares it. Prefer read actions first, then one
write action with confirmation.

The page-side transport only needs:

```ts
interface SurfaceTransport {
  post(message: unknown): void;
  subscribe(handler: (message: unknown) => void): () => void;
  close(): void;
}
```

The transport should reconnect after a transient socket failure and send a
`hello` message containing its app identity. Do not put Surface logic in the
transport.

### 2. Implement the local bridge

The bridge owns the WebSocket server and pending-request state. It should:

- listen on `127.0.0.1`;
- accept one explicit `/surface` path;
- verify the browser `Origin` against the configured app origin;
- require a random per-launch token, even on loopback;
- enforce a small maximum message size, for example 256 KiB;
- keep at most one active page connection, or explicitly key connections by
  session;
- fail in-flight calls when the page disconnects;
- give every request a unique id and a timeout;
- retain completed results for a bounded time;
- serialize `invoke` calls when approval can pause a request;
- allow `describe` while an `invoke` is waiting for approval.

The bridge does not need to understand the business action. It forwards a
Surface request and receives a Surface response.

### 3. Expose the minimum MCP surface

Implement these methods:

- `initialize`
- `ping`
- `tools/list`
- `tools/call`

Expose these tools:

- `surface_describe` with input `{}`
- `surface_invoke` with input `{ capability: string, input?: object }`
- `surface_status` with input `{ requestId: string }`

Do not implement `surface_approve`. A model must not be able to approve its own
request.

The status tool should return a state such as:

```json
{ "state": "waiting" }
{ "state": "pending_approval", "approval": { "reviewUrl": "..." } }
{ "state": "done", "response": { "ok": true, "result": {} } }
{ "state": "not_found" }
```

When an invoke is waiting, tell the agent to ask the user to finish the action
in the already-open business page. Do not tell it to open a second tab when the
bridge supports only one page connection.

### 4. Use a stdio MCP process

The server must be an executable Node process, for example
`mcp-server.mjs`. It should:

- start the bridge before reading MCP input;
- read one JSON-RPC object per line from stdin;
- write one JSON object per line to stdout;
- ignore notifications that have no `id`;
- return JSON-RPC errors for malformed protocol calls;
- return tool failures as MCP tool results with `isError: true`;
- close the bridge on `SIGINT`, `SIGTERM`, and stdin close;
- keep startup and diagnostics on stderr.

Do not print banners, warnings, or debug logs to stdout. A single non-JSON line
can break the agent's MCP parser.

### 5. Register it with the agent

For Codex, a typical registration is:

```bash
codex mcp add pling-local -- node /absolute/path/to/mcp-server.mjs
```

Then restart the Codex session so it reloads the MCP server list. Keep the
server path absolute; the agent's working directory is not guaranteed to be the
repository root.

For Hermes or another MCP-capable agent, use its documented MCP configuration
and add the same command/args pair:

```json
{
  "mcpServers": {
    "pling-local": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server.mjs"],
      "env": {
        "PLING_APP_URL": "http://localhost:5280/demo/",
        "PLING_BRIDGE_PORT": "5281"
      }
    }
  }
}
```

Do not invent a Hermes config path. Locate the agent's actual MCP configuration
first and preserve its existing entries.

## Recommended environment variables

Use names that make the boundary obvious:

| Variable | Purpose |
| --- | --- |
| `PLING_APP_URL` | Exact page origin and path allowed to connect |
| `PLING_BRIDGE_PORT` | Loopback WebSocket port |
| `PLING_BRIDGE_TOKEN` | Random per-launch connection token |
| `PLING_BRIDGE_PATH` | Usually `/surface` |
| `PLING_REQUEST_TIMEOUT_MS` | Time allowed for a page response |
| `PLING_RESULT_TTL_MS` | How long completed results remain queryable |

Do not reuse a static demo token in a shared or long-running environment.

## Acceptance sequence

Verify the complete chain in this order:

1. Start the page and confirm it says the local bridge is connected.
2. Start the MCP server manually and confirm it prints diagnostics only to
   stderr.
3. Send `initialize`, `tools/list`, and `tools/call` for `surface_describe` over
   stdin.
4. Confirm `describe` returns only the intended capabilities and bounded
   records.
5. Invoke one safe read capability.
6. Invoke one write capability that requires approval and confirm the first
   result is `pending_approval`.
7. Confirm the agent cannot call an approval tool, complete the approval in the
   page, then call `surface_status`.
8. Close the page and confirm new calls fail with a page-disconnected error.
9. Restart the MCP server and confirm stale pending requests are not reported
   as successful.

For a Pling repository example, compare against
`examples/demos/external-agent-surface/mcp-server.mjs`,
`lib/surface-bridge.mjs`, and `lib/mcp.mjs`. Run its smoke test before changing
protocol behavior.

## Common failures

### Agent sees no tools

- The MCP server was not restarted after registration.
- The command path is relative or points to a non-existent file.
- The server printed a banner or log to stdout.
- The agent requires a different MCP transport (HTTP instead of stdio).

### Page never connects

- The page URL or WebSocket path differs from the bridge configuration.
- The browser Origin is not in the allowlist.
- The page runs in HTTPS and tries to open a plain `ws` connection.
- The agent runs in Docker or WSL while the browser and bridge use the host's
  `localhost`.
- A second page replaced the first page under a single-page bridge.

### Call hangs or returns `waiting`

- The page is not responding to a Surface request.
- The request timed out before the page settled its UI.
- The bridge is serializing an invoke that is waiting for approval.
- The pending request was lost when the page reconnected.

### Approval cannot complete

- The bridge exposed an action that the page did not install with a real
  confirmation handler.
- The `reviewUrl` points to a different origin or opens a second page that
  replaces the connected page.
- The agent is trying to approve through a tool that should not exist.

## Production boundary

A successful local facade proves reachability and protocol behavior. It does
not prove production safety. Before exposing an enterprise page to arbitrary
external agents, add:

- user and Agent authentication;
- short-lived delegated credentials with explicit scope;
- revocation and expiry checks;
- server-side authorization for every high-risk action;
- durable audit with correlation ids;
- distributed rate limiting and replay protection;
- multi-tenant isolation;
- TLS, secret rotation, and operational monitoring.

An agent with CDP or browser-level access can still bypass this facade. Surface
improves capability discovery, context accuracy, and auditability; it is not a
browser sandbox.
