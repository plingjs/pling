# Pling Surface Gateway

Reference transport and control plane for Pling Agent Surface. It connects an
open business page to a user-owned Agent runtime without moving page execution
or business permissions into the gateway.

```text
Agent runtime (Codex / Claude / Hermes / WorkBuddy)
        │  MCP over HTTPS (Bearer Agent session token)
        ▼
surface.example.com
        │  opaque describe / invoke envelopes over WebSocket
        ▼
business page (same page as the user is already looking at)
        │
        ▼
application backend + existing authorization
```

The gateway is deliberately narrow:

- it authenticates a page session created by the application backend;
- it binds a one-time pairing code to one Agent session;
- it forwards `describe`, `invoke`, approval-pending, and final responses;
- it supports revocation, expiry, and audit callbacks;
- it never exposes DOM, `click(selector)`, script evaluation, cookies, or keys.

The page's Surface session remains the capability and approval authority. The
application backend remains the business authorization authority.

## Run locally

Node.js 20 or newer is required.

```bash
cd services/surface-gateway
SURFACE_ADMIN_TOKEN="$(openssl rand -hex 32)" pnpm start
```

The default development configuration is `config.example.json` and listens on
`http://127.0.0.1:5219`. For a real deployment, copy it and set:

```bash
SURFACE_CONFIG=/etc/pling/surface.json
SURFACE_ADMIN_TOKEN=<server-side secret>
SURFACE_PUBLIC_BASE_URL=https://surface.plingjs.dev
SURFACE_HOST=127.0.0.1
SURFACE_PORT=5219
```

`SURFACE_ADMIN_TOKEN` is server-to-server only. Never put it in browser code,
an MCP server configuration, logs, or a public repository.

## Application flow

1. The business backend verifies the signed-in user and calls
   `POST /v1/page-sessions` with the narrow set of capability ids that page may
   expose. It returns a short-lived page token to that page only.
2. The page opens `WS /surface?token=...`, sends a `pling.bridge/0.1` hello, and
   keeps its existing Pling Surface session active.
3. The page calls `POST /v1/pairings` to display a one-time code. Pairing is
   refused unless the page WebSocket is connected and the `Origin` is allowed for
   its tenant.
4. The user gives the code to their Agent runtime. The runtime claims it at
   `POST /v1/agent-sessions` and receives a short-lived Agent token and MCP URL.
5. The Agent configures `https://surface.example.com/mcp` with
   `Authorization: Bearer <agent token>`. It first calls `pling_surface_describe`,
   then `pling_surface_invoke`.
6. If the page requires human confirmation, the gateway returns
   `pending_approval`. The user confirms in the business page. The Agent polls
   `pling_surface_approval_status`; there is no approval tool and no way for the Agent to
   approve its own request.

## HTTP routes

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | public | Liveness only |
| `GET` | `/v1/discovery/:tenantId` | public | Draft discovery metadata |
| `POST` | `/v1/page-sessions` | admin Bearer | Create a page session after the application has authenticated the user |
| `POST` | `/v1/pairings` | page token + Origin | Create a one-time pairing code |
| `POST` | `/v1/agent-sessions` | pairing code | Claim a pairing and receive an Agent token |
| `POST` | `/v1/agent-sessions/revoke` | page token + Origin | Let the signed-in page revoke its Agent |
| `GET` | `/admin/sessions` | admin Bearer | Inspect live sessions |
| `DELETE` | `/admin/page-sessions/:id` | admin Bearer | Revoke a page and all of its Agents |
| `DELETE` | `/admin/agent-sessions/:id` | admin Bearer | Revoke one Agent session |
| `POST` | `/mcp` | Agent Bearer | Streamable-style JSON-RPC MCP endpoint (JSON response mode) |
| `WS` | `/surface?token=...` | page token + Origin | Page transport for Surface envelopes |

## MCP tools

- `pling_surface_describe` reads the paired page's current capabilities,
  records, regions, state, and feedback.
- `pling_surface_invoke` invokes one capability returned by `describe`.
- `pling_surface_approval_status` reads the final state of an earlier invocation.

The Agent token is bound to the active HTTP request. It is not a model-visible
tool argument, and tool arguments cannot override it.

## Production boundary

This package is a reference implementation, not an enterprise control plane.
Before exposing it to untrusted traffic:

- terminate TLS at a reverse proxy and bind Node to loopback;
- use scoped, per-tenant admin credentials instead of one global control token;
- put shared rate limiting and abuse detection in front of pairing and MCP;
- persist session metadata and audit events in the application's system of
  record;
- connect approval receipts to the application's approval backend;
- configure one pairing per user/page, short Agent TTLs, and explicit scopes;
- add monitoring for failed pairing, repeated auth failures, revocations, and
  approval latency.

The gateway cannot stop an Agent that already owns the browser through CDP from
clicking the page directly. Its security value is that declared operations have
identity, scope, confirmation, and audit evidence, while business authorization
stays in the backend.

## Test

```bash
pnpm --filter @plingjs/surface-gateway test
```

The suite covers scope narrowing, one-time pairing, replacement connections,
request and approval timeouts, revocation, MCP token binding, Origin checks, and
a real HTTP + WebSocket + remote MCP loop.
