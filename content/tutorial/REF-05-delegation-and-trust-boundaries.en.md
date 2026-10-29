---
id: REF-05
title: "Delegation and trust boundaries"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Delegation and trust boundaries

`@plingjs/delegation` is an optional browser-to-backend integration package for short-lived agent authority. It defines the credential lifecycle, reference adapters, and conformance checks. It does not own application login, tenant policy, database transactions, Redis, an audit archive, or the final business authorization decision.

Use it when an external agent must act for a signed-in user without receiving the user's Cookie or session token. If the agent runs only inside the page and uses the page's existing runtime, a delegation credential is unnecessary.

## Lifecycle

```text
authenticated user
      │
      ├─ POST /delegation/issue ──▶ plg_dlg_… token (returned once)
      │                              store keeps a SHA-256 hash
      │
      ├─ POST /delegation/introspect ──▶ public credential view
      │                                  toSurfaceSession() ──▶ SurfaceSession
      │
      ├─ POST /delegation/refresh ──▶ replacement token
      └─ POST /delegation/revoke  ──▶ revoked view
                                         │
                                         └─ event bus / SSE ──▶ page invalidates its session
```

The token is bearer authority. It must not enter a Surface response, an Agent prompt, browser telemetry, or an event payload. The safe credential view contains identifiers, scope, issue time, expiry, and revocation time only.

## Endpoints

The Web `Request → Response` handler defaults to the `/delegation` base path.

| Method and path | Purpose |
| --- | --- |
| `GET /delegation/health` | Instance health |
| `GET /delegation/session` | Resolve the current authenticated user |
| `GET /delegation/events` | SSE invalidation metadata |
| `POST /delegation/issue` | Issue a credential after the user consents |
| `POST /delegation/introspect` | Validate a bearer token and return its safe view |
| `POST /delegation/refresh` | Rotate a valid credential and invalidate the old one |
| `POST /delegation/revoke` | Revoke a credential |

`createDelegationHandler({ store, events, identity, basePath?, instanceId?, now?, heartbeatMs?, maxBodyBytes? })` returns an object with `handle(request)`. The default SSE heartbeat is 15 seconds; setting it to `0` disables heartbeats. JSON request bodies default to a 32 KB limit.

`createDelegationClient({ baseUrl?, fetch?, credentials?, eventSource? })` defaults to same-origin requests at `/delegation`. Its methods are `ensureSession()`, `issue()`, `introspect()`, `refresh()`, `revoke()`, and `openEvents()`.

## Ports

### Identity

`DelegationIdentity.resolve({ request, setCookie })` returns the authenticated `{ userId, expiresAt }` or `null`. A production implementation reads its real Cookie, JWT, SSO session, or identity proxy. It must not accept a user id from the JSON body.

### Store

`DelegationStore` has four operations:

| Operation | Requirement |
| --- | --- |
| `issue` | Generate a token, persist only its hash and binding, return the token once |
| `introspect` | Validate token, user binding, expiry, rotation, and revocation |
| `refresh` | Atomically rotate; the old credential must stop working |
| `revoke` | Persist revocation and return a safe view |

The minimum binding is user, agent, session, scope, issued time, expiry, and revocation state. Scope must be deduplicated in first-seen order before persistence.

The included memory store is a local reference, not a production database. A production adapter should keep state changes and outbox rows in one transaction.

### Events

`DelegationEventBus` exposes `subscribe(userId, listener)`, `publish(event)`, and `close()`. Events are limited to:

```ts
{
  type: "credential_revoked",
  reason: "revoked" | "rotated",
  at: number,
  credentialId: string,
  delegationId: string,
  sessionId: string,
  userId: string,
  agentId: string,
  replacedBy?: string
}
```

SSE is an early-warning path, not the source of truth. Every protected action still introspects or otherwise validates the credential at the server. A lost event may delay local cleanup, but it must not preserve execution rights.

## Safe views and Surface conversion

```ts
import { createDelegationClient, toSurfaceSession } from "@plingjs/delegation";

const client = createDelegationClient({ baseUrl: "/delegation" });
const view = await client.introspect(token);
const session = toSurfaceSession(view);
```

`toSurfaceSession()` copies `agentId`, `sessionId`, `userId`, `expiresAt`, `scope`, `delegationId`, and `revokedAt` when present. It does not copy a token because the safe view does not contain one.

The resulting `SurfaceSession.scope` is still intersected with the Surface site allowlist. A delegated credential cannot expand what the application chose to expose.

## Errors and status codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| `400` | `DELEGATION_INVALID_REQUEST` | Malformed request or input |
| `401` | `DELEGATION_INVALID_CREDENTIAL` | Missing, forged, or unusable token |
| `403` | `DELEGATION_BINDING_MISMATCH` | Token does not belong to this user or session |
| `404` | `DELEGATION_NOT_FOUND` | Unknown endpoint |
| `409` | `DELEGATION_REVOKED` | Credential was revoked or rotated |
| `410` | `DELEGATION_EXPIRED` | Credential expired |
| `500` | `DELEGATION_INTERNAL_ERROR` | Backend failure with no safe detail exposed |

The browser client preserves the backend code and HTTP status in `DelegationClientError`. Do not translate `DELEGATION_EXPIRED` or `DELEGATION_REVOKED` into a prompt asking the Agent to retry. The user must reauthorize.

## Conformance checks

Before shipping a production adapter, run the reference lifecycle checks:

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

The store suite checks token redaction, scope normalization, rotation, binding, revocation, expiry, and stable error codes. Use a disposable namespace or test database. The suite creates credentials and intentionally has no cleanup API that could hide lifecycle defects.

The event-bus suite checks per-user isolation, field allowlisting, unsubscribe behavior, malformed-event filtering, and subscriber fault isolation. A process-local bus does not prove Redis, NATS, or outbox delivery; test that bridge separately.

## Boundary checklist

- The token is returned only by `issue` and `refresh`.
- The store keeps a hash, not the plaintext token.
- The user id comes only from verified identity.
- Scope is explicit and cannot exceed the Surface allowlist.
- Revocation takes effect without waiting for SSE.
- Rotation invalidates the previous token.
- Logs and metrics use credential ids, never bearer values.
- The page treats a missing lease or failed introspection as no authority.

Reference implementations cover credentials, revocation, multi-instance invalidation, package integration, production ports, and an authenticated Todo flow. They are examples, not production identity services.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/delegation` `0.1.0-alpha.2` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later on the server |
| Peer dependencies | None; the application supplies the store, event bus, and identity adapter |
| Stability | Pre-1.0 alpha; a minor release may change the API |

Compatibility includes both this package and the implementations behind its ports. The conformance suites describe the behaviour expected at this version; they do not certify a deployment's storage, delivery, or identity provider.
