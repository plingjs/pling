---
id: C-11
title: "Failure model and error codes"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Failure model and error codes

A reliable agent integration must distinguish failures before presenting them. “The assistant did not do it” can mean that the model was not configured, the action was never declared, the action was declared but unavailable, a person denied it, the business handler threw an error, or the action ran but its expected result never appeared.

## Four failure layers

| Layer | Examples | What it proves |
| --- | --- | --- |
| Configuration | `NOT_CONFIGURED`, `MODEL_BASE_URL_MISSING` | The runtime cannot make a valid model request yet |
| Protocol | `INVALID_REQUEST`, `PROTOCOL_VERSION_UNSUPPORTED`, `CAPABILITY_NOT_EXPOSED` | The caller and surface did not agree on a valid exchange |
| Execution | `ACTION_NOT_FOUND`, `ACTION_UNAVAILABLE`, `PERMISSION_DENIED`, `INVALID_PARAMS`, `EXECUTION_FAILED`, `EXPECTATION_FAILED` | The request reached the page boundary, but did not produce an accepted result |
| Model/network | `LLM_FAILED`, retry exhaustion, timeout | The reasoning provider or transport did not return a usable response |

The layer matters more than the wording. A configuration error needs a deployment change. A protocol error needs a client change or a wider allowlist. An unavailable action often needs the page to satisfy a precondition. A failed expectation requires inspecting the page, not repeatedly sending the same call.

## Protocol failure versus action failure

Surface keeps two result shapes separate:

```ts
// The capability was never exposed to this caller.
{ ok: false, error: { code: "CAPABILITY_NOT_EXPOSED", message: "..." } }

// The call reached an action, but the policy or handler rejected it.
{ ok: true, result: { error: { code: "PERMISSION_DENIED", message: "..." } } }
```

A client that checks only `ok` will report a denied write as successful. Both branches must be handled.

## Recovery is state-specific

- `ACTION_NOT_FOUND`: revisit the current page description; the declaration may have disappeared or changed.
- `ACTION_UNAVAILABLE`: read the reason and satisfy the precondition. Do not bypass the guard.
- `INVALID_PARAMS`: correct the field identified by the schema. Do not retry the same object.
- `PERMISSION_DENIED`: stop that operation and ask the user or use a permitted path.
- `EXPECTATION_FAILED`: observe the page and determine whether the action partially succeeded.
- `LLM_FAILED`: preserve the request id, check gateway health, and retry only according to a bounded policy.

## Errors are evidence

The returned `code`, the current snapshot, and the tool result together form the recovery context. A generic sentence such as “something went wrong” discards that evidence. Localized UI copy may explain the error to a person, but program logic should branch on the stable code.

The complete code table, limit defaults, and adapter behaviour are in [Error codes and diagnostics](/reference/error-codes-and-diagnostics).
