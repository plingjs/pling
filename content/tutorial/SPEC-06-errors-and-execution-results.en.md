---
id: SPEC-06
title: "Errors and execution results"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Errors and execution results

An implementation MUST distinguish protocol failure from business execution failure. Collapsing both into one “failed” state causes duplicate writes, false success, or treating a permission denial as a transient error.

## Two result classes

| Class | Fields | Meaning |
| --- | --- | --- |
| Protocol failure | `ok: false`, top-level `error` | The request did not enter business execution, or the execution boundary raised an internal exception |
| Business result | `ok: true`, `result` | The call reached the executor; the executor defines success or structured failure |

A business failure appears in `result.error`:

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_02",
  "ok": true,
  "result": {
    "error": {
      "code": "EXPECTATION_FAILED",
      "message": "No new state was observed after saving"
    }
  }
}
```

A client MUST check `ok`, then `result.error`. Checking only HTTP status or only `ok` is insufficient.

## Protocol errors

| Code | Trigger | Executed? |
| --- | --- | --- |
| `INVALID_REQUEST` | Invalid envelope, field, type, or value | No |
| `PROTOCOL_VERSION_UNSUPPORTED` | `protocol` is not supported | No |
| `METHOD_NOT_SUPPORTED` | Method is not `describe` or `invoke` | No |
| `CAPABILITY_NOT_EXPOSED` | Capability is outside site/session intersection | No |
| `SESSION_REQUIRED` | Implementation requires a session and none exists | No |
| `SESSION_INVALID` | Session is malformed or unbound | No |
| `SESSION_EXPIRED` | Session passed its expiry | No |
| `SESSION_REVOKED` | Session was revoked | No |
| `RATE_LIMITED` | Window exceeded; may include `retryAfterMs` | No |
| `RATE_LIMIT_UNAVAILABLE` | Limiter failed and the implementation failed closed | No |
| `REPLAY_DETECTED` | A consumed `request.id` was reused in the session | No |
| `REPLAY_GUARD_UNAVAILABLE` | Replay guard failed and the implementation failed closed | No |
| `INTERNAL_ERROR` | Internal implementation exception; no inference of business success | Unconfirmed |

`INTERNAL_ERROR` can occur near the execution boundary. A client MUST NOT automatically resend a write after receiving it. It should observe business state through a read path or ask a person to verify.

## Business errors

An executor may return these stable codes:

| Code | Meaning |
| --- | --- |
| `DUPLICATE_ACTION_ID` | Duplicate action id was declared |
| `DUPLICATE_STATE_KEY` | Duplicate state key was declared |
| `DUPLICATE_GUIDE_TARGET` | Duplicate guide target was declared |
| `ACTION_NOT_FOUND` | The current page has no such action |
| `INVALID_ARGS` | Tool arguments are invalid JSON or malformed |
| `INVALID_PARAMS` | Arguments do not satisfy the schema |
| `PERMISSION_DENIED` | Business policy denied the action |
| `ACTION_UNAVAILABLE` | Preconditions are not met |
| `EXECUTION_FAILED` | Handler threw or business logic rejected the action |
| `EXPECTATION_FAILED` | The declared success condition was not observed |
| `HANDOFF_CANCELLED` | The user cancelled handoff |
| `HANDOFF_TIMEOUT` | Handoff timed out |
| `HANDOFF_FAILED` | The user claimed completion but the result did not occur |
| `STEP_FAILED` | A composite step failed; may include `resume` |
| `HOOK_BLOCKED` | A lifecycle hook blocked execution |
| `LOOP_DETECTED` | The runtime detected a loop |

Business codes MUST remain machine-readable. `message` may be localized and MUST NOT be used as a branching contract.

## Successful results

The executor and application define a successful `result`. It SHOULD include evidence sufficient to verify the business outcome, such as changed record ids, confirmed expectations, or an operation summary. It MUST NOT contain credentials, raw sensitive arguments, or internal object references.

## Recovery rules

- `INVALID_REQUEST`: fix the envelope; never retry unchanged.
- `CAPABILITY_NOT_EXPOSED`: describe again; do not try a similar id.
- `ACTION_NOT_FOUND`: the page or declaration changed; describe again.
- `ACTION_UNAVAILABLE`: satisfy preconditions; do not bypass the gate.
- `INVALID_PARAMS`: correct values against the schema.
- `PERMISSION_DENIED`: stop and involve a person; the agent cannot self-authorize.
- `EXPECTATION_FAILED`: observe the page first; a partial success may exist.
- `RATE_LIMITED`: obey `retryAfterMs`.
- `REPLAY_DETECTED`: do not mint a new id for the same intent; check the previous result first.
- Session errors: reauthenticate or obtain a new delegation.

## Logging and presentation

Logs may contain the error code, request id, capability id, and duration, but not full input or response bodies. User-facing text should explain an actionable next step without exposing a stack. Audit and alerting should key on error class and risk, not treat every business denial as an outage.
