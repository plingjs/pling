---
id: RCP-09
title: "Expose three safe capabilities to an external agent"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Expose three safe capabilities to an external agent

The first external surface should not start with “all APIs.” Choose three explainable, verifiable capabilities with increasing risk. That is enough to prove the loop and makes audit and rollback practical.

## Runnable page

The editorial queue below shares one page registry. The external client sees only list, approve, and comment; delete remains available inside the page and is rejected by the external allowlist.

<DemoPlayground id="recipe-external-surface" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-external-surface/`. The source is in `examples/demos/recipe-external-surface/`; the fixture runs the Surface in the browser to expose protocol boundaries, without a public transport or identity layer.

## Capability selection

For an order page:

| Capability | Effect | Reason |
| --- | --- | --- |
| `orders.search` | Read | Verify bounded context and filtering |
| `orders.update_note@order` | Write | Verify schema, record target, and evidence |
| `orders.cancel@order` | Destructive | Verify confirmation and an irreversible boundary |

Search tells the agent what the page can query. The note write has explicit input and a result. Cancellation requires a person; the agent must not self-approve. The three cover read, write, and high-risk paths without exposing user management, payment, or arbitrary DOM.

## Server setup

```ts
import { createSurface } from "@plingjs/surface";

const surface = createSurface({
  registry,
  app: "orders",
  expose: ["orders.search", "orders.update_note@order", "orders.cancel@order"],
  session: () => verifiedSession,
  recordLimit: 8,
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  replay: true,
  onAudit(event) {
    auditStore.append(event);
  },
  execute: (id, args, context) => executor.execute(id, args, context),
});
```

`registry` MUST be shared with the in-page assistant. `expose` is only the site ceiling; `session.scope` narrows the actual session. Do not create a second executor for external calls.

## Acceptance flow

1. Open the page and sign in as a test user.
2. Create an external session scoped to the three capabilities.
3. Call `describe`; only the three appear, and records report totals.
4. Call `orders.search`; verify filtering and reject arbitrary SQL or selectors.
5. Call `orders.update_note@order`; verify record id, schema, success condition, and audit.
6. Call `orders.cancel@order`; verify it waits for a person and the agent receives pending status.
7. Invoke an unexposed id; verify `CAPABILITY_NOT_EXPOSED` with no side effect.
8. Revoke the session; verify the next call fails before the executor.

## Failure and rollback

- A filtered record produces `INVALID_REQUEST` or a structured business failure. Describe again; do not substitute another row.
- Insufficient permission stops the action and involves a person. Do not try a similar capability.
- A failed expectation requires reading state first; a partial success may exist.
- A write timeout keeps the request id and checks business state; do not auto-replay.
- Emergency shutdown revokes sessions and closes the external transport without affecting the in-page assistant.

## Evidence and cases

The runnable source for this recipe is `examples/demos/recipe-external-surface/`. It places page tools, the `expose` allowlist, and one executor together, making the difference between in-page availability and external exposure directly observable. A public deployment still needs an authenticated transport and audit boundary.

## Do not expose

- arbitrary record lists or full database queries;
- payment, refund, or administrator-role changes;
- Cookies, JWTs, keys, or another user's data;
- generic click, script evaluation, or arbitrary HTTP;
- a tool that approves high-risk actions on the agent's behalf.

Prove that three capabilities can be discovered, executed, and audited accurately before expanding.

## Local verification

Call `describe` in the external panel, then invoke `article_list`, `article_approve`, and `article_comment`. Finally invoke `article_delete`; it should return `CAPABILITY_NOT_EXPOSED`. Check that the description contains only the three allowlisted capabilities and that the rejected call changes no article state.
