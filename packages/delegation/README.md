# @plingjs/delegation

Short-lived, revocable credentials for external agents that call Pling's Agent Surface.

This is an **optional integration package**, not part of the page execution kernel. It defines the
stable contract and reference adapters; your application still owns identity, persistence and
message delivery.

```text
user session ──issue──▶ opaque plg_dlg_… token (returned once)
                              │
                              ├─ server stores only SHA-256 hash
                              ├─ introspect ──▶ safe view (never the token)
                              └─ toSurfaceSession() ──▶ SurfaceSession

revoke / refresh ──▶ DelegationEventBus ──▶ SSE ──▶ page fails closed immediately
```

## Install

```bash
pnpm add @plingjs/delegation @plingjs/surface
```

## Server

Implement three ports:

- `DelegationIdentity`: resolve the current user from your real Cookie / JWT / SSO.
- `DelegationStore`: persist token hashes, scope, expiry and revocation in a database.
- `DelegationEventBus`: broadcast `credential_revoked` per user through Redis, NATS or an outbox.

For local development, use the included memory adapters:

```ts
import {
  createDelegationHandler,
  createMemoryDelegationEventBus,
  createMemoryDelegationStore,
} from "@plingjs/delegation";

const handler = createDelegationHandler({
  store: createMemoryDelegationStore(),
  events: createMemoryDelegationEventBus(),
  identity: {
    async resolve({ request, setCookie }) {
      const userId = await readUserFromYourSession(request.headers.get("cookie"));
      if (!userId) return null;
      return { userId, expiresAt: Date.now() + 60 * 60_000 };
    },
  },
});
```

`handler.handle(request)` uses only Web standard `Request` / `Response`, so it composes with Node,
Bun, Deno and serverless runtimes. The endpoint contract is:

```text
GET  /delegation/health
GET  /delegation/session
GET  /delegation/events          SSE
POST /delegation/issue
POST /delegation/introspect
POST /delegation/refresh
POST /delegation/revoke
```

## Browser

```ts
import { createDelegationClient, toSurfaceSession } from "@plingjs/delegation";

const delegation = createDelegationClient({ baseUrl: "/delegation" });
const credential = await delegation.introspect(token);

const session = toSurfaceSession(credential); // no token in the session
delegation.openEvents((event) => {
  if (event.credentialId === credential.credentialId) markSessionRevoked();
});
```

## Adapter conformance

Before shipping a Postgres / Redis / SSO adapter, run the same lifecycle checks the reference store
uses. The checks do not need a test framework and do not require any database SDK:

```ts
import {
  assertDelegationEventBusConformance,
  assertDelegationStoreConformance,
} from "@plingjs/delegation/testing";

await assertDelegationStoreConformance(productionStore, {
  userIdPrefix: `conformance-${process.env.CI_RUN_ID}`,
});
await assertDelegationEventBusConformance(productionEvents);
```

The store suite checks token redaction, scope normalization, rotation, binding, revocation, expiry
and stable error codes. It creates throwaway credentials and has no delete API: use a disposable
test database or namespace, never a production store.

The event-bus suite checks per-user isolation, allowlisted fields, unsubscribe, malformed-event
filtering and subscriber fault isolation. A process-local bus cannot prove Redis / NATS / outbox
delivery; test that bridge separately (052's two-instance test is the reference).

`publish()` may be synchronous or asynchronous. The HTTP handler awaits it, but treats a failed
notification as non-fatal: credential state is already committed by the store, and the next
introspect still fails closed. Production outbox adapters should therefore write the credential
change and outbox row in one database transaction inside `DelegationStore`; `DelegationEventBus`
is the wake-up / fan-out path, not the source of truth.

## Security defaults

- The token is returned only by `issue` / `refresh`; it is never included in a safe view or event.
- The reference store keeps only a SHA-256 hash and binds every credential to user, agent, session and scope.
- Scope is deduplicated in first-seen order before it is stored or exposed.
- Missing, forged, expired, revoked and cross-user credentials fail closed with stable error codes.
- Events are filtered by user and normalized to an allowlist before reaching the browser.
- SSE is an early warning, not the source of truth: call `introspect` before each Surface request.

## What this package does not own

- Database schema or transactions
- Redis / NATS / Kafka / outbox
- SSO, login, tenant rules or business authorization
- Audit retention and distributed rate limiting

See [deploy to production](https://plingjs.dev/operations/deploy-to-production) for the
Postgres / Redis / SSO blueprint,
[connecting external agents](https://plingjs.dev/concepts/connecting-external-agents)
for the protocol walkthrough, and
[delegated access with user consent](https://plingjs.dev/recipes/delegated-access-with-user-consent)
for the end-to-end flow.
