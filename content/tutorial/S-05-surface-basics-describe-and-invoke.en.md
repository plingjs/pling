---
id: S-05
title: "Surface basics: describe and invoke"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Surface basics: describe and invoke

The current Surface protocol has two methods. `describe` lets a client learn what page it is looking at and which capabilities are currently exposed. `invoke` asks the page to execute one of them. Everything else in a connection—authentication, transport discovery, revocation, and audit delivery—belongs to the host.

## Create a Surface

```ts
const surface = createSurface({
  registry,
  execute: (id, args) => executor.execute(id, args),
  app: "orders",
  expose: ["orders.search", "orders.open", "orders.update_note@order"],
  session: () => verifiedSession,
  recordLimit: 8,
});
```

`registry` is the same declaration set used by the page assistant. `execute` must be the existing execution path or an equivalent that preserves availability, confirmation, schema validation, expectations, and evidence. Do not reimplement those checks inside a transport.

## `describe`

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req-1",
  "method": "describe",
  "input": { "limit": 8, "capabilities": "changed" }
}
```

The response includes:

- `app` and `protocol`;
- `capabilities`, limited to `expose ∩ session.scope`;
- `context.page` when page identity is available;
- regions, a record window, record ids, state, feedback, and unavailable actions;
- `recordWindow` and totals so truncation is visible;
- `capabilitiesUnchanged` when a changed request finds no difference.

Use `record` to inspect one or a few named records. Do not combine it with `offset` or `limit`. Use `capabilities: "changed"` only after an initial full description; an empty array means unchanged, not “no capabilities”.

## `invoke`

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req-2",
  "method": "invoke",
  "capability": "orders.update_note@order",
  "input": { "record": "SO-1002", "note": "Call before Friday" }
}
```

The capability id, not a selector, identifies the operation. A folded row action resolves the record from `input.record`; the page's executor still checks that the record is present, belongs to the active region, and is allowed by the session scope.

The response has two layers. `ok` describes the protocol exchange. A valid exchange can contain a business failure in `result.error`:

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req-2",
  "ok": true,
  "result": {
    "error": { "code": "ACTION_UNAVAILABLE", "message": "The record is locked" }
  }
}
```

A protocol failure, by contrast, has `ok: false` and an `error.code` such as `CAPABILITY_NOT_EXPOSED`, `INVALID_REQUEST`, `SESSION_EXPIRED`, `RATE_LIMITED`, or `REPLAY_DETECTED`.

## Incremental evidence

An invoke result can include an `after` object describing new capabilities, changed records, and changed state. It is evidence for the next decision, not a replacement for a full description after a navigation or a large external change. If no `after` is present, the client may request a fresh `describe` rather than assume nothing changed.

Do not use `after` as an authorization proof. It describes what the page observed after execution; it does not prove that the user approved a high-risk operation or that a backend transaction committed.

## Failure categories

| Observation | Meaning | Next action |
| --- | --- | --- |
| `CAPABILITY_NOT_EXPOSED` | Site or session scope rejected the id | Request a new description, or request a valid grant |
| `ACTION_NOT_FOUND` | The id was not registered on the current page | Re-describe the current page |
| `ACTION_UNAVAILABLE` | The action exists but its precondition failed | Resolve the precondition; do not retry blindly |
| `INVALID_PARAMS` | The input does not match the schema | Correct the input from the description |
| `PERMISSION_DENIED` | A person or backend refused | Stop and report; consent cannot be self-granted |
| `EXPECTATION_FAILED` | The declared result did not appear | Re-observe before retrying |
| `SESSION_EXPIRED` / `SESSION_REVOKED` | Delegation is no longer valid | Re-authenticate or ask for a new grant |

## Minimal client loop

1. Authenticate and obtain a verified session from the host.
2. Call `describe` with a bounded record window.
3. Choose one exposed capability whose input matches the schema.
4. Call `invoke` with a new request id.
5. Inspect both `ok` and `result.error`.
6. Re-describe after navigation, an unavailable action, or a failed expectation.

The protocol is intentionally smaller than a browser automation API. It does not expose `click(selector)`, `eval`, arbitrary HTTP, or a generic workflow language. If the task cannot be expressed through declared business capabilities, leave it to an explicit human flow rather than adding an escape hatch.

See [Build an external agent client](/surface/build-an-external-agent-client) and [Reference: Surface protocol](/reference/surface-protocol).
