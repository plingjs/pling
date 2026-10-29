---
id: RCP-14
title: "Pass Surface conformance with another implementation"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Pass Surface conformance with another implementation

When another team implements a page surface or client, differences often appear only after a convincing demo. A reproducible conformance harness should expose them earlier.

## Runnable page

The panel below creates a fresh fixture in the browser, runs nine Surface request vectors, and compares each expected code with the actual response. These are repository vectors, not certification or an interoperability endorsement.

<DemoPlayground id="recipe-conformance" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-conformance/`. The page source is in `examples/demos/recipe-conformance/`; the package-level suite remains `packages/surface/test/surface.test.ts`.

## Define the role

- Server implementation: receives `describe` / `invoke`, applies exposure intersection, forwards execution;
- Client implementation: builds requests and handles responses and errors;
- Transport implementation: authenticates, forwards, and handles disconnects;
- Delegation implementation: issue, introspect, revoke, and events.

A test SHOULD declare one role and its evidence. Do not turn a passing client into a claim about the whole deployment.

## Fixed fixture

Build a minimal page:

| Capability | Purpose |
| --- | --- |
| `item.list` | Read; verifies record windows |
| `item.add` | Write; verifies schema |
| `item.archive@item` | Folded record action |
| `item.delete@item` | Destructive; requires human approval |
| `item.unavailable` | Always unavailable; verifies errors |

The fixture should produce records, feedback, unavailability reasons, and expired sessions deterministically without a real model or wall-clock dependency.

## Request vectors

Store at least:

1. valid `describe`;
2. invalid version;
3. invalid method;
4. missing `id`;
5. `record` together with `offset`;
6. unexposed capability;
7. missing or filtered record target;
8. write requiring confirmation;
9. expired and revoked sessions;
10. reused `request.id`;
11. rate-limit hit;
12. truncated `after` data.

Each vector needs expected code, whether the executor was called, business state, and audit fields. “Returned JSON” is not enough.

## Run and compare

```ts
const cases = loadVectors("surface-0.1.json");
for (const vector of cases) {
  const before = await fixture.snapshot();
  const response = await implementation.handle(vector.request);
  assertEnvelope(response, vector.expected);
  assertBusinessState(await fixture.snapshot(), vector.beforeAfter ?? before);
  assertExecutorCalls(fixture, vector.expected.executorCalls);
}
```

Compare protocol results, not internal logs. Transports may differ, but business side effects must match. Every rejection MUST prove the executor was not called.

## Version and environment

Record:

- protocol version and implementation commit;
- Node / browser / runtime version;
- transport shape;
- session and delegation adapter;
- whether rate limit and replay were enabled;
- test date and whether the worktree was clean.

An uncommitted-worktree result must be labeled; it cannot be compared silently with a release commit.

## What can be claimed now

The repository contains `packages/surface/test/surface.test.ts` and delegation-adapter conformance helpers. They prove parts of the reference implementation. There is currently no public certification program, independent second implementation, or standards-body endorsement.

The accurate statement is “passed the 0.1 repository vectors,” not “Pling certified.” If another implementation passes the same vectors, say “interoperable on the named fixture and versions,” and list uncovered transports, SSO, tenancy, and browser matrices.

## Failure handling

- Different business side effects: pause the interoperability claim and isolate the vector.
- Different error class: check whether business failure was promoted to protocol failure.
- Hidden capability still invokable: this is an authorization defect, not a format difference.
- Client retry writes twice: inspect id lifetime and business idempotency, not only network retry.

Conformance is not a demo. It is reproducible, auditable evidence with an explicit boundary.

## Runnable verification

Press **Run suite** and inspect all nine expected codes, actual codes, and timings. Then run `pnpm --filter @plingjs/surface test` for the package-level protocol and executor boundary; run `pnpm --filter @plingjs/surface-gateway test` when a gateway is involved. When comparing another implementation, use the same fixture, versions, and environment record, and state which transport and identity cases remain uncovered.
