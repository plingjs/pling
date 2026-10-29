---
id: SPEC-05
title: "Messages and envelopes"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Messages and envelopes

Messages in this version are JSON objects carried by a transport. The transport may be `postMessage`, HTTP, an MCP facade, an extension channel, or a future browser proposal. Envelope semantics do not change with the transport.

## Common request fields

Every request MUST contain:

| Field | Requirement |
| --- | --- |
| `protocol` | The exact value `pling.surface/0.1` |
| `id` | A non-empty string unique to this logical call within the session |
| `method` | `describe` or `invoke` |

`id` associates the response, audit event, and error. A client MUST NOT reuse one id for independent business calls. A server MUST NOT execute `invoke` again merely because it retransmits a response.

## `describe` request

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_01",
  "method": "describe",
  "input": {
    "limit": 8,
    "capabilities": "full"
  }
}
```

`input` MAY be omitted. Supported fields:

| Field | Constraint | Meaning |
| --- | --- | --- |
| `record` | Non-empty string, or an array of one to twenty ids | Read selected records |
| `offset` | Non-negative integer | Record-window start |
| `limit` | Non-negative integer, subject to implementation maximum | Record-window size |
| `capabilities` | `full` or `changed` | Return a full list or an unchanged signal |

`record` MUST NOT be combined with `offset` or `limit`. Unknown `describe.input` fields SHOULD be rejected. `capabilities: "changed"` SHOULD be used only when the client retained the previous description in the same session.

## Successful `describe`

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_01",
  "ok": true,
  "result": {
    "app": "orders",
    "capabilities": [],
    "context": {
      "regions": [],
      "records": [],
      "recordIds": [],
      "recordIdsTotal": 0,
      "state": {},
      "feedback": [],
      "unavailable": [],
      "recordsTotal": 0,
      "feedbackTotal": 0,
      "unavailableTotal": 0
    }
  }
}
```

The response protocol MUST match the request version. Capability and context semantics are defined by the [Capability model](/spec/0.1/capability-model) and [Context model](/spec/0.1/context-model).

## `invoke` request

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_02",
  "method": "invoke",
  "capability": "order.update_note@order",
  "input": {
    "record": "SO-1002",
    "note": "Call before Friday"
  }
}
```

`capability` MUST be non-empty and MUST come from the current session's visible list. `input` MUST be an object; omission is equivalent to an empty object. A folded template's target record MUST be placed in `input.record`; other properties follow that capability's schema.

## Successful `invoke`

Protocol success does not mean business success. The business result may still be a structured error:

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_02",
  "ok": true,
  "result": {
    "error": {
      "code": "ACTION_UNAVAILABLE",
      "message": "The record is locked"
    }
  }
}
```

A business success may be any JSON value defined by the executor. The client MUST check both `ok` and `result.error`.

A successful response MAY include `after`:

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_02",
  "ok": true,
  "result": { "title": "Note updated" },
  "after": {
    "records": [{ "id": "SO-1002", "fields": { "note": "Call before Friday" } }],
    "state": { "filter": "all" }
  }
}
```

`after` is an incremental observation, not proof of authorization and not a full snapshot. Capabilities, records, and omitted counts MUST be bounded.

## Protocol failure

Envelope, version, method, exposure, session, rate-limit, or internal failures use:

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_02",
  "ok": false,
  "error": {
    "code": "CAPABILITY_NOT_EXPOSED",
    "message": "The capability is outside the current exposure"
  }
}
```

`id` MAY be empty when it cannot be parsed. `message` is diagnostic; clients MUST NOT branch on its text. Stable behavior is keyed by `error.code`.

## Processing order

A server SHOULD process in this order:

1. validate object, `id`, `protocol`, and `method`;
2. resolve and validate the session when required;
3. apply the rate limit;
4. validate method-specific fields;
5. for `invoke`, validate capability, record, and replay;
6. call the existing executor;
7. produce bounded `after` data and an audit event.

An implementation MUST NOT leak an unstructured exception to the caller. Unknown versions, unknown methods, and internal exceptions MUST produce `ok: false`.

## Versioning and compatibility

A client MUST send the exact version value. A server MUST return `PROTOCOL_VERSION_UNSUPPORTED` for an unsupported version and MUST NOT guess a newer interpretation. Future optional response fields SHOULD be safe for older clients to ignore. An older client MUST NOT treat an unknown state as success or approval.

## Size and caching

The transport MUST bound request and response size and reject an oversized request with a clear error. `describe` results are not cached by default. An implementation MAY provide session-scoped increments, but the cache MUST be bound to the session and scope. Navigation, permission changes, or revocation MUST invalidate old descriptions.
