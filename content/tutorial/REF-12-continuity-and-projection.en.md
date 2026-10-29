---
id: REF-12
title: "Continuity and projection"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Continuity and projection

Continuity answers a different question from projection. Continuity defines which page instance may continue a task and which bounded checkpoint is shared. Projection defines how controls across Shadow DOM and same-origin iframe boundaries participate in one page capability surface. Mixing them produces the wrong security model: a checkpoint is not an execution lease, and a visible iframe is not automatically shared authority.

## Continuity scopes

`@plingjs/agent` exposes three scopes:

| Scope | Storage and arbitration | Intended use |
| --- | --- | --- |
| `tab` | Browser `sessionStorage`, unless a custom `ContinuityStore` is supplied | MPA navigation in the same tab |
| `browser` | A same-origin browser authority; `localStorage` and lease coordination by default | Multiple tabs that may follow or explicitly take over one task |
| `remote` | A host-provided `ContinuityAuthority`, such as `@plingjs/continuity-http` | Different devices or browsers |

`scope` defaults to `tab`. `remote` requires an explicit `authority`; there is no hidden fallback to local storage.

```ts
createPling({
  continuity: {
    scope: "remote",
    authority: createHttpContinuityAuthority({ baseUrl: "/pling/continuity" }),
  },
});
```

### Checkpoint bounds

| Option | Default | Meaning |
| --- | --- | --- |
| `ttlMs` | 2 hours | A checkpoint older than this is not restored |
| `maxMessages` | 20 | Maximum retained conversation messages |
| `maxEvents` | 60 | Maximum retained UI events |
| `maxChars` | 4000 | Maximum characters for one string or argument |
| `leaseTtlMs` | 30 seconds | Execution-owner lease duration |
| `takeover` | `"manual"` | Only an explicit human action may preempt an active owner |
| `maxTasks` | 20 | Shared-task discovery limit |
| `resume` | `"ask"` | User-facing resume policy |
| `returnOnDone` | disabled | Same-origin return after task completion; a delay is capped at five seconds |

The checkpoint contains a bounded task summary, recent messages, recent events, page identity, and status. It does not contain DOM, screenshots, cookies, JWTs, provider keys, or arbitrary application state.

## Authority operations

`ContinuityAuthority` is the transport-independent port:

```ts
interface ContinuityAuthority {
  list(): Promise<ContinuityTaskSummary[]>;
  read(sessionId: string): Promise<ResidencyEnvelope | null>;
  create(input: CreateTaskInput): Promise<LeaseGrant>;
  claim(input: ClaimTaskInput): Promise<LeaseGrant>;
  renew(input: RenewLeaseInput): Promise<LeaseGrant>;
  release(input: ReleaseLeaseInput): Promise<void>;
  compareAndSwap(input: CompareAndSwapInput): Promise<ResidencyEnvelope>;
  remove(input: ReleaseLeaseInput): Promise<void>;
  subscribe?(listener: (change) => void): () => void;
  dispose?(): void;
}
```

The backend must atomically check the revision and lease. A stale writer is rejected with `REVISION_CONFLICT`; it must not overwrite a newer checkpoint. `preempt: true` is reserved for an explicit user takeover. Automatic resume may join as a follower, but it must not seize an active owner.

`ContinuityChange` is notification metadata only: type, session id, revision, status, owner/lease identifiers, lease expiry, and time. It is not a second authority. A lost notification may delay a UI update, but every write still checks the current lease and revision.

## HTTP integration

`@plingjs/continuity-http` provides both sides:

- `createHttpContinuityAuthority(options)` for the browser;
- `createContinuityHandler({ backend, identity, ... })` for a Web `Request → Response` backend.

The default base path is `/pling/continuity`.

| Method and path | Operation |
| --- | --- |
| `GET /health` | Health |
| `GET /session` | Resolve identity |
| `GET /events` | SSE lease and revision metadata |
| `GET /tasks` | List the current user's tasks |
| `POST /tasks` | Create a task and lease |
| `GET /tasks/:id` | Read a checkpoint |
| `PUT /tasks/:id` | Compare-and-swap a checkpoint |
| `DELETE /tasks/:id` | Owner-only removal |
| `POST /tasks/:id/claim` | Claim or explicitly take over |
| `POST /tasks/:id/renew` | Renew the lease |
| `POST /tasks/:id/release` | Release the lease |

`userId` comes only from verified identity. It is never read from the request body. The handler maps stable backend errors to HTTP status:

| Code | HTTP |
| --- | --- |
| `UNAUTHORIZED` | `401` |
| `OWNER_MISMATCH` | `403` |
| `NOT_FOUND` | `404` |
| `TASK_EXISTS`, `REVISION_CONFLICT`, `LEASE_HELD`, `LEASE_REVOKED` | `409` |
| `LEASE_EXPIRED` | `410` |
| `INVALID_STATE` | `422` |
| `STORE_UNAVAILABLE` | `500` |

Network failure, `401`, and an unprovable lease fail closed. The page does not execute merely because it has a remembered summary.

## Projection across boundaries

### Shadow DOM

Shadow roots change the parent traversal rule, not the action model. Declarations stay on the element, and the DOM layer uses a composed tree so records, scopes, availability, and feedback can cross the boundary. There is no second registry for a shadow root.

### Same-origin iframe

An iframe is not scanned or adopted automatically. The parent explicitly calls:

```ts
import { sharePlingPageWithFrame } from "@plingjs/dom";

const stop = sharePlingPageWithFrame(frame, page);
```

The child can read or wait for that runtime:

```ts
import { plingPageFromParent, waitForPlingPageFromParent } from "@plingjs/dom";

const existing = plingPageFromParent();
const page = existing ?? await waitForPlingPageFromParent({ timeoutMs: 5000 });
```

This shared-memory path requires same-origin access. A cross-origin frame must use an explicit `postMessage` or Surface transport with its own identity and permission checks. Reading `contentWindow` failure is not an authorization result.

When embedding distinct framework islands, give each adapter a short `namespace`. IDs are prefixed with `namespace/` before appearing in actions, scopes, records, state, or feedback. Namespace collisions are visible in the full id, not hidden by separate registries.

## What not to infer

- A projected control is not automatically safe to expose. Exposure remains the `expose` and session-scope intersection.
- A checkpoint does not grant execution rights. A valid lease does.
- A visible cross-origin iframe is not a shared runtime.
- An SSE message is not durable task state.
- Browser `localStorage` coordination is not a multi-device authority.

## Verification

Run the backend conformance suite against a disposable namespace:

```ts
import { assertContinuityBackendConformance } from "@plingjs/continuity-http/testing";

await assertContinuityBackendConformance(productionBackend, {
  expiryTtlMs: 1_100,
  advanceTime: () => clock.advance(1_200),
});
```

It checks user isolation, duplicate creation, non-preempting claims, takeover, stale compare-and-swap, lease renewal, release and reclaim, owner-only removal, and expiry. The included memory backend is a testing reference, not a production store.

Relevant examples cover MPA continuity, Shadow DOM projection, same-origin iframe projection, cross-tab follow and takeover, cross-tab forks, cross-device continuity, and a server-side continuity store.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/continuity-http` `0.1.0-alpha.2` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later for the HTTP backend |
| Peer dependencies | None |
| Stability | Pre-1.0 alpha; a minor release may change the API |

Continuity backends implement the ports in this package; the memory backend is only a test fixture. Compatibility therefore includes both the package version and the backend's conformance result.
