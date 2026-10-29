# @plingjs/continuity-http

HTTP integration for Pling's cross-device task continuity. It implements the browser-side
`ContinuityAuthority` and a Web standard `Request → Response` handler; your backend still owns
authentication, persistence and transactional guarantees.

```ts
import { createHttpContinuityAuthority } from "@plingjs/continuity-http";

const authority = createHttpContinuityAuthority({
  baseUrl: "/pling/continuity", // same-origin relative URL; cookies are sent automatically
});
```

```ts
import { createContinuityHandler } from "@plingjs/continuity-http";
import { createMemoryContinuityBackend } from "@plingjs/continuity-http/testing";

const handler = createContinuityHandler({
  backend: createMemoryContinuityBackend(), // local reference only
  identity: {
    async resolve({ request }) {
      const user = await verifySession(request.headers.get("cookie"));
      return user ? { userId: user.id } : null;
    },
  },
});
```

The handler accepts any `ContinuityBackend`. Methods may return a value or a Promise, so a Postgres
adapter can keep all checks and writes in one transaction. `userId` comes only from the verified
identity and is never read from the request body.

## Endpoints

```text
GET    /pling/continuity/health
GET    /pling/continuity/session
GET    /pling/continuity/events        SSE metadata only
GET    /pling/continuity/tasks
POST   /pling/continuity/tasks
GET    /pling/continuity/tasks/:id
PUT    /pling/continuity/tasks/:id
DELETE /pling/continuity/tasks/:id
POST   /pling/continuity/tasks/:id/claim
POST   /pling/continuity/tasks/:id/renew
POST   /pling/continuity/tasks/:id/release
```

## Security boundary

- Checkpoints contain bounded, redacted task context; they never contain DOM, screenshots, cookies,
  JWTs or sensitive literals.
- SSE carries only lease/revision metadata. Every `renew` and `compareAndSwap` still validates over
  authenticated HTTP, so a lost notification cannot preserve execution rights.
- `claim.preempt: true` is emitted only for an explicit user takeover, never by automatic resume.
- Network errors, 401 responses and unprovable leases fail closed.

## Testing only

`@plingjs/continuity-http/testing` exports `createMemoryContinuityBackend`. It is a single-process
reference with server time, per-user isolation, revision/lease checks, TTL and subscription support.
It is not a production store. Implement `ContinuityBackend` with your database, transactional locks
and event bus instead.

The same entry also exports a backend conformance suite:

```ts
import { assertContinuityBackendConformance } from "@plingjs/continuity-http/testing";

await assertContinuityBackendConformance(postgresBackend, {
  expiryTtlMs: 1_100,
  advanceTime: () => clock.advance(1_200),
});
```

It checks user isolation, duplicate creation, non-preempting claims, takeover revocation, stale CAS,
renew, release/reclaim, owner-only removal and lease expiry. Run it against your production adapter
with a disposable user namespace. The production blueprint describes the transactional boundary
expected from a persistent adapter.

See [task continuity across pages and tabs](https://plingjs.dev/concepts/task-continuity-across-pages-and-tabs)
for the protocol walkthrough and the public example set for runnable fixtures.
