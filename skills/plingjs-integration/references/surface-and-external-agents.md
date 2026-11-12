# Expose Pling capabilities to an external Agent

Use this reference only when an Agent outside the page must act on the app,
for example through MCP. A model gateway is not a Surface gateway.

## Choose the deployment shape

- **In-page assistant:** the browser's Pling runtime calls a model gateway. No
  Surface gateway is required.
- **Local Agent on the same machine:** use the local MCP facade with a narrow
  `@plingjs/surface` projection. Do not publish a gateway just to connect a
  local process.
- **Remote Agent on another machine:** use the page-side Surface runtime, an
  authenticated application BFF, a Surface gateway, and an Agent token. Keep
  the BFF and gateway under the application's trusted control.

Read the exact protocol version and gateway package contract before coding:

- [Surface `describe` and `invoke`](https://plingjs.dev/surface/surface-basics-describe-and-invoke)
- [Deploy a Surface gateway](https://plingjs.dev/surface/deploy-a-surface-gateway)
- [Surface security boundaries](https://plingjs.dev/surface/threat-model-and-legal-boundaries)
- [Reference gateway service](https://github.com/plingjs/pling/tree/main/services/surface-gateway)

## Keep the capability boundary narrow

1. Declare only business capabilities needed for the reviewed workflows.
2. Use stable, namespaced IDs and a small allowlist. `describe` should not
   reveal all page actions by default.
3. Use lookup/read actions so the Agent can identify a student/course by
   human-readable fields; do not make the Agent invent database IDs.
4. Return only the fields needed to select and verify the operation.
5. Keep business authorization in the existing backend. A page declaration or
   Surface session scope is not a replacement for per-user/per-tenant checks.
6. Keep dangerous writes behind a trusted page or backend confirmation. Never
   expose an action that approves its own pending request.
7. Keep model-provider keys, gateway admin tokens, page-session tokens, and
   Agent bearer tokens distinct. Do not embed server/admin credentials in the
   browser or source control.

The effective access is the intersection of the page's declared exposure, the
verified page-session scope, and the Agent-session scope; the business backend
still authorizes the final operation. A wider upstream scope must not widen a
narrower scope.

## Hosted request path

```text
External Agent
  → HTTPS MCP + short-lived Agent token
  → Surface Gateway
  → WebSocket + page-session token
  → business page / Pling executor
  → existing application backend and authorization
```

The authenticated BFF verifies the user's existing application session, creates
a page session with the gateway's admin credential server-side, and gives only
the page session to the browser. Pair the external Agent through the intended
user flow; never display or hard-code a shared long-lived admin token in a
public demo.

## Runtime and operations

The reference gateway is a transport/control-plane example. Check its current
README and package options for storage and production requirements. In-memory
stores are not durable, shared multi-instance production storage. Production
deployments need an explicit decision for persistence, revocation, audit
retention, rate limits, tenant isolation, and identity integration.

Before deployment, test denied scopes, guessed capability IDs, expired and
revoked sessions, reconnect/disconnect, approval refusal, authorization on the
backend, and absence of tokens in logs. Do not expand public exposure or deploy
until that change is explicitly in scope.
