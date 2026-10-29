---
id: RCP-11
title: "Delegated access with user consent"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Delegated access with user consent

Delegation is not lending an agent the login cookie. It is an explicit grant from a user to a specific agent, session, capability scope, and time window. The credential can be revoked, must never enter model context, and does not replace backend authorization.

## Runnable page

The page below issues a short-lived delegation from a local account. The user chooses the agent, scopes, and lifetime; after revocation, the next call must fail before the business handler.

<DemoPlayground id="recipe-delegation" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-delegation/` and sign in with `demo@example.com` / `pling-demo`. The page source is in `examples/demos/recipe-delegation/`; the issue, introspection, and revocation backend is in `examples/recipe-backends/access-service/`, with routes and limits in its `README.md`.

## Roles and flow

```text
User signs in to the application
  │ selects an agent and capability scope
  ▼
Backend issues a short-lived delegation token
  │ appears once in the issue response
  ▼
Browser / host introspects a safe view
  │ toSurfaceSession() removes the token
  ▼
Surface validates session and capability intersection
  │
  └─ user revokes → event hint + next call fails closed
```

`@plingjs/delegation` provides the credential contract, memory adapters, browser client, and Web standard HTTP/SSE handler. The application still owns identity, database, event fan-out, tenancy, and business authorization.

## Server ports

| Port | Responsibility |
| --- | --- |
| `DelegationIdentity` | Resolve the current user from real Cookie / JWT / SSO |
| `DelegationStore` | Persist token hashes, scope, expiry, revocation, and rotation |
| `DelegationEventBus` | Broadcast revocation or rotation per user |

Reference endpoints:

```text
GET  /delegation/session
POST /delegation/issue
POST /delegation/introspect
POST /delegation/refresh
POST /delegation/revoke
GET  /delegation/events
```

`issue` and `refresh` are the only paths that return the raw token. `introspect` returns a safe view without it. A deployment must replace memory or file adapters with its own store and broadcast implementation.

## Browser flow

```ts
const client = createDelegationClient({ baseUrl: "/delegation" });
const credential = await client.issue({
  agentId: "codex",
  scope: ["tasks.read", "tasks.add", "tasks.complete@task"],
  ttlMs: 15 * 60_000,
});

// Pass the one-time token only to the trusted agent transport setup.
await handTokenToAgentTransport(credential.token);

// The surface receives a verified, token-free session view.
const session = toSurfaceSession(credential);
```

In practice, token delivery follows an explicit “enable external access” action and pairing. The model must not choose `agentId`, `userId`, or scope.

## What consent must show

- which agent requests access;
- which capabilities are allowed, not just “read/write”;
- lifetime and whether renewal is possible;
- which actions still require confirmation;
- how to revoke immediately;
- the current account and tenant.

Refusal, closing the window, or an unfinished pairing must not grant access by default.

## Acceptance criteria

1. The token appears once in issue/refresh, then only a hash is stored.
2. Safe views, SSE events, logs, and model context contain no token.
3. Scope is deduplicated in order; empty or invalid scope is rejected.
4. Expiry, revocation, user mismatch, and agent mismatch fail closed.
5. Browser events contain only allowlisted fields; if an event is lost, introspection still rejects the old token.
6. One token cannot cross users, tenants, or page sessions.
7. Refresh creates a new credential or session id; old descriptions cannot keep authorizing.

## Error handling

| Code | Meaning | Behavior |
| --- | --- | --- |
| `DELEGATION_INVALID_CREDENTIAL` | Missing, forged, or malformed token | Pair again |
| `DELEGATION_BINDING_MISMATCH` | User, agent, or session mismatch | Stop; do not retry across accounts |
| `DELEGATION_REVOKED` | Revoked or rotated | Clear local session |
| `DELEGATION_EXPIRED` | Expired | Obtain fresh user consent |
| `DELEGATION_INTERNAL_ERROR` | Backend failure | Fail closed and alert |

## Reference cases

The backend for this recipe implements issue, introspection, invocation, and revocation; the page only collects consent and displays a bounded view. It exercises the full lifecycle, but memory storage is not a production database and the demo account is not enterprise SSO. Before launch, run `@plingjs/delegation/testing` against the real store and event bus, and test cross-instance delivery separately.

## Local verification

Issue a two-minute delegation containing only `invoice.list`, invoke it once, revoke it, and invoke again. The second call should return a revocation error without reading invoice data. Calling an unscoped capability such as `report.export` must also fail.
