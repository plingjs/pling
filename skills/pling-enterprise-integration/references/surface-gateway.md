# Surface and Gateway Development

Use this reference for the external-Agent path: a page exposes a narrow
capability surface, an authenticated BFF creates a page session, and a remote
Agent calls the page through an MCP endpoint backed by a Surface Gateway.

## 1. Architecture and trust zones

```text
Agent runtime (Codex / Claude / Hermes / WorkBuddy / other MCP client)
  │  HTTPS MCP + Agent bearer token
  ▼
Surface Gateway
  ├─ tenant, Origin, TTL, pairing, scope, revocation
  ├─ describe / invoke / approval-status forwarding
  └─ audit callbacks
  │  WebSocket + page token
  ▼
Open business page
  ├─ @plingjs/surface-browser
  ├─ explicit capability allowlist
  └─ existing registry + executor + human confirmation
  │
  ▼
Application backend + existing authorization
```

The Gateway does not know how to click a page and does not execute business
operations. It authenticates transport sessions and forwards opaque Surface
envelopes. The page executes declared capabilities through its existing
registry; the business backend remains the authorization authority.

## 2. Credentials are not interchangeable

| Credential | Holder | Purpose | Must never reach |
| --- | --- | --- | --- |
| Application session / cookie | User's browser and BFF | Authenticate the human user | Agent context, Gateway, audit payload |
| `SURFACE_ADMIN_TOKEN` | Application backend / control plane | Create and revoke page sessions; admin APIs | Browser bundle, page token field, Agent config, logs |
| Page token | The page and Gateway | Authenticate the page WebSocket | Agent, model messages, analytics |
| Agent token | The Agent runtime and Gateway | Authenticate MCP calls | Page DOM, URL copied into another user's browser, audit payload |
| Pairing code | User/user agent handoff | Single-use claim of an Agent session | Logs, long-lived storage, public screenshots |
| Provider API key | Model proxy / server | Call the model provider | Browser, Surface tool input, page/Gateway logs |

The reference Gateway uses one global admin token. A production control plane
should use scoped server-to-server credentials, an internal auth service, or a
trusted BFF boundary rather than handing this token to application clients.

## 3. Lifecycle

### Step 1: BFF authenticates the user and creates a page session

The browser calls a same-origin application route. That route verifies its own
session, narrows the capability scope, and calls the Gateway server-to-server.

```ts
// Server-only BFF route. Do not run this in browser code.
app.post("/api/surface/page-session", requireSignedInUser, async (req, res) => {
  const response = await fetch(`${SURFACE_GATEWAY_URL}/v1/page-sessions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.SURFACE_ADMIN_TOKEN}`,
    },
    body: JSON.stringify({
      tenantId: "northstar",
      userId: req.user.id,
      scope: ["northstar/orders.search", "northstar/orders.set_note"],
      ttlMs: 15 * 60_000,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    return res.status(503).json({
      error: error?.error ?? { code: "SURFACE_PROVISION_FAILED" },
    });
  }

  const page = await response.json();
  const socketUrl = new URL(page.surfaceUrl);
  socketUrl.searchParams.set("token", page.token);
  // Keep the page token out of logs and analytics.
  res.status(201).json({
    pageSessionId: page.pageSessionId,
    pageToken: page.token,
    expiresAt: page.expiresAt,
    tenantId: page.tenantId,
    surfaceUrl: socketUrl.toString(),
    pairingUrl: page.pairingUrl,
    agentSessionsUrl: page.agentSessionsUrl,
    mcpUrl: page.mcpUrl,
    scope: page.scope,
  });
});
```

The application should also enforce that `userId` is the current signed-in user
and that the requested scope is a subset of the capabilities that user may use.
Do not trust a browser-supplied `userId` or `scope`.

### Step 2: Page connects with the page token

For Vue 3, the adapter owns page session, WebSocket, reconnect, bridge, pairing,
and teardown:

```ts
const surface = useSurfaceGateway({
  app: "northstar-order-desk",
  mode: "bff",
  expose: EXTERNAL_SCOPE, // fully qualified ids
  getPageSession: () => api.pageSession(),
  approval: approvalController,
  confirm: approvalController.confirm,
  surface: {
    recordLimit: 20,
  },
});
```

The page opens the returned `surfaceUrl` (a WebSocket URL) with `Origin` set by
the browser. The Gateway verifies the page token and allowed Origin. The page
must stay open while the Agent is connected.

Lower-level hosts can compose `createSurfaceTransport`, `createPlingSurface`,
and `createSurfaceBridge` from `@plingjs/surface-browser`. Do not reimplement
the protocol in the transport.

### Step 3: User creates a pairing and claims it

The page asks for a one-time pairing:

```http
POST /v1/pairings
Content-Type: application/json
Origin: https://app.example.com

{ "pageToken": "plg_page_..." }
```

The response contains a short-lived `code`, `tenantId`, `mcpUrl`, and scope. The
user gives the code to the Agent runtime. The runtime claims it:

```http
POST /v1/agent-sessions
Content-Type: application/json

{
  "code": "ABCD-EFGH",
  "agentId": "codex",
  "scope": ["northstar/orders.search", "northstar/orders.set_note"],
  "ttlMs": 86400000
}
```

The requested scope must be a subset of the page session scope. The response
contains an Agent token and `mcpUrl`. Pairing codes are single-use. In the
reference gateway they expire after two minutes by default. A page session has
one active Agent session; use a separate page/session for concurrent Agents.

### Step 4: Agent reads capabilities, then invokes

The MCP surface has exactly three tools:

- `pling_surface_describe`: capabilities, schemas, records, regions, state,
  feedback, and current context.
- `pling_surface_invoke`: one capability plus an object input.
- `pling_surface_approval_status`: read the final result of a prior invocation.

Never add `surface_approve`, `confirm`, `allow`, or an equivalent tool. A danger
or confirmation-required action returns `pending_approval`; the user approves in
the business page, and the Agent only polls status.

### Step 5: Revoke or expire

- Page owner can revoke its Agent through `POST /v1/agent-sessions/revoke`.
- Admin can revoke a page or Agent:
  `DELETE /admin/page-sessions/:id`, `DELETE /admin/agent-sessions/:id`.
- Page expiry invalidates its Agent sessions.
- Agent expiry invalidates future MCP calls.
- The page can always disconnect locally; the Gateway must then fail pending
  calls rather than pretending they succeeded.

## 4. HTTP and WebSocket contract

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | public | Liveness |
| `GET` | `/v1/discovery/:tenantId` | public draft | Discovery metadata |
| `POST` | `/v1/page-sessions` | admin Bearer | Create page session after app auth |
| `POST` | `/v1/demo/page-sessions` | configured Origin | Rate-limited public demo only |
| `POST` | `/v1/pairings` | page token + Origin | Create one-time pair code |
| `POST` | `/v1/agent-sessions` | pairing code | Claim Agent session and token |
| `POST` | `/v1/agent-sessions/revoke` | page token + Origin | Revoke one Agent |
| `GET` | `/admin/sessions` | admin Bearer | Inspect sessions |
| `DELETE` | `/admin/page-sessions/:id` | admin Bearer | Revoke page and Agents |
| `DELETE` | `/admin/agent-sessions/:id` | admin Bearer | Revoke one Agent |
| `POST` | `/mcp` | Agent Bearer | MCP JSON-RPC endpoint |
| `WS` | `/surface?token=...` | page token + Origin | Page transport |

Do not put page tokens in query strings that reach application logs if you can
avoid it; the reference protocol necessarily carries the page token in the
WebSocket URL. Redact access logs and browser telemetry accordingly.

## 5. Gateway configuration

The reference configuration is tenant based:

```json
{
  "tenants": [
    {
      "id": "northstar",
      "displayName": "Northstar Orders",
      "origins": ["https://orders.example.com"],
      "maxPageSessionTtlMs": 3600000,
      "maxAgentSessionTtlMs": 3600000,
      "publicDemo": null
    }
  ]
}
```

For a hosted demo, `publicDemo` may add explicit origins, a scope, a page-session
TTL, and rate limits:

```json
{
  "publicDemo": {
    "origins": ["https://demo.example.com"],
    "scope": ["demo/todo.overview", "demo/todo.add", "demo/todo.toggle"],
    "pageSessionTtlMs": 900000,
    "maxSessionsPerWindow": 30,
    "windowMs": 600000,
    "maxActiveSessions": 40
  }
}
```

`publicDemo` origins must also appear in the tenant origins. `public-demo` page
sessions are rate limited and are not a substitute for BFF authentication.

Start the reference server:

```bash
SURFACE_CONFIG=/etc/pling/surface.json \
SURFACE_ADMIN_TOKEN='<server-side secret>' \
SURFACE_PUBLIC_BASE_URL=https://surface.example.com \
SURFACE_HOST=127.0.0.1 \
SURFACE_PORT=5219 \
npx pling-surface-gateway
```

Relevant defaults in the reference implementation:

| Setting | Default |
| --- | --- |
| Page session TTL | 24 hours, tenant-clamped |
| Agent session TTL | 24 hours, tenant-clamped |
| Pairing TTL | 2 minutes |
| Request timeout | 20 seconds |
| Approval timeout | 15 minutes |
| Result retention | 10 minutes |
| Pairing claim limit | 30 attempts per 10 minutes per client key |

All durations and limits are policy, not a promise. Use short page and Agent
sessions for sensitive applications, and set a service-side maximum per tenant.

## 6. Scope matching

The Gateway uses the Surface family semantics:

- an exact id covers its `:` and `@` families;
- an id ending in `:` or `@` is a family prefix;
- `*` is accepted only when the page session explicitly allows it;
- a concrete id never widens to a broader family.

Prefer exact fully qualified ids. A row template such as
`northstar/orders.open@` is useful for a bounded row family, but test it with
the actual record ids. Do not use `*` for convenience.

The effective capability permission is the intersection of:

1. page `expose` allowlist;
2. verified page-session scope;
3. Agent-session scope.

For the `public-demo` route, the tenant `publicDemo.scope` seeds the page-session
scope. Tenant config also controls Origin and TTL policy. Business authorization
inside the application remains a separate final gate; it is not replaced by any
Gateway scope.

A capability accepted at one layer but absent at another must fail closed.

## 7. MCP client registration

For Codex, use the actual MCP command and keep the token in an environment
variable:

```bash
export PLING_AGENT_TOKEN='plg_agent_...'
codex mcp add pling-orders \
  --url https://surface.example.com/mcp \
  --bearer-token-env-var PLING_AGENT_TOKEN
```

Restart the Agent session if required by that client. The MCP URL and token come
from the pairing/claim response. Do not hardcode a token in a repository.

For Claude, Hermes, WorkBuddy, or another MCP client, find that product's real
configuration mechanism and use its streamable-HTTP/remote-MCP form with:

- URL: the returned `mcpUrl`;
- Authorization: `Bearer <Agent token>` from a secret store/environment;
- no page cookie and no admin token.

Do not invent a configuration path or assume one client's interpolation syntax
works in another. Preserve existing MCP entries when adding one.

The Agent workflow should be:

1. call `pling_surface_describe`;
2. choose only a returned capability;
3. call `pling_surface_invoke`;
4. if `pending_approval`, ask the user to confirm in the open page and poll
   `pling_surface_approval_status`;
5. report the final result or structured failure, never an imagined approval.

## 8. Developing or extending a Gateway

### Reuse the reference package when possible

The package exports the pieces needed to embed it:

```js
import {
  createSurfaceGateway,
  createSurfaceServer,
  createMcpHandler,
  loadConfig,
} from "@plingjs/surface-gateway";
```

Use `createSurfaceServer` for the reference HTTP/WS composition. Use
`createSurfaceGateway` only when you need a custom transport or test harness;
keep the protocol envelopes and session semantics intact. `services/surface-gateway/`
is a deployment wrapper, not a second implementation.

### Preserve these boundaries when adapting

- The Gateway never knows DOM selectors, model prompts, or business auth.
- A page token, Agent token, and admin credential remain distinct.
- `describe` and `invoke` use the same scope decision.
- Pairing is single-use and Origin checked.
- A pending approval is forwarded, never auto-approved.
- Revocation and expiry fail future calls closed.
- One active Agent per page is explicit unless a reviewer approves a multi-Agent
  design.

### Add enterprise infrastructure outside the protocol kernel

For durable production, replace only the control-plane/storage portions:

- page and Agent records in Postgres or the existing identity/session store;
- token hashes, not plaintext tokens, where the storage model permits it;
- tenant-scoped admin authorization and rotation;
- shared rate limiting and replay prevention in Redis or equivalent;
- durable audit/outbox with PII-safe metadata;
- approval challenge/receipt persistence tied to the page and business backend;
- multi-instance WebSocket routing or a sticky connection strategy;
- SSO/OIDC/MLS integration owned by the application platform.

The reference package currently keeps state in process memory. Do not solve that
by adding a database import to `@plingjs/surface`; store control-plane state in
the Gateway/application layer and keep the protocol kernel transport-neutral.

### Public-demo path

`mode: "public-demo"` is useful for a hosted product demo. It may create a page
session from the browser and display a short-lived token. It is not appropriate
for customer data because the page/Origin is acting as the session creator. A
production app must use an authenticated BFF and the admin route.

## 9. Failure handling

| Error / state | Meaning | Correct response |
| --- | --- | --- |
| `PAGE_NOT_CONNECTED` | Page socket is closed or not ready | Reopen the page, reconnect, pair again if needed |
| `PAIRING_INVALID` | Code expired, used, or unknown | Create a fresh pairing; do not reuse codes |
| `AGENT_SESSION_ACTIVE` | Page already has an active Agent | Revoke/close it or use another page/session |
| `SCOPE_NOT_ALLOWED` | Capability outside the agent/session scope | Fix allowlist or request a reviewed scope; never bypass |
| `AGENT_SESSION_INVALID` | Token expired/revoked | Pair again after confirming the user wants access |
| `GATEWAY_TIMEOUT` | Page did not answer in time | Check page health; do not report success |
| `GATEWAY_APPROVAL_TIMEOUT` | User did not confirm | Report not approved/expired; do not approve |
| `pending_approval` | Human confirmation is required | Ask the user to act in the page, then poll status |
| `CAPABILITY_NOT_EXPOSED` / not found | Guessed or excluded capability | Do not retry with a different guessed id |

## 10. Verification

Run at least:

```bash
pnpm --filter @plingjs/surface test
pnpm --filter @plingjs/surface-browser test
pnpm --filter @plingjs/surface-gateway test
pnpm --filter @plingjs/surface-gateway check
```

Then test the composition end to end:

- unauthenticated BFF page-session request is rejected;
- authenticated user receives only their scope;
- page WebSocket rejects a wrong Origin, expired token, or wrong token type;
- pairing code is single-use and expires;
- Agent scope cannot exceed page scope;
- a guessed excluded capability does not execute;
- `describe` excludes approval and destructive capabilities;
- danger action returns `pending_approval`, then final result only after page
  confirmation;
- Agent revocation and page expiry fail closed;
- reconnect does not create a second active Agent silently;
- audit contains request identity and outcome, but no token, cookie, provider
  key, raw sensitive argument, or response body.

