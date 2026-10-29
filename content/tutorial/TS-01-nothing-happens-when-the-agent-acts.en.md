---
id: TS-01
title: "Nothing happens when the agent acts"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Nothing happens when the agent acts

Determine three things first: did the model emit a tool call, did the call reach the executor, and did the page change. Reading only the chat text conflates three different failures.

## Decision tree

```text
No tool card in chat?
  ├─ yes: model configuration, prompt, or tool list
  └─ no: inspect the tool result
       ├─ ACTION_NOT_FOUND → id or page snapshot
       ├─ ACTION_UNAVAILABLE → preconditions / visibility
       ├─ PERMISSION_DENIED → authorization
       ├─ EXPECTATION_FAILED → executed, result not observed
       └─ success → page state or model continuation
```

## 1. Confirm the model is ready

In the debug panel, inspect `baseUrl`, model name, and configuration diagnostics. `NOT_CONFIGURED`, `MODEL_BASE_URL_MISSING`, or `MODEL_NAME_MISSING` means no valid model request was sent. Do not put a provider key in the page; production should use a same-origin model gateway.

## 2. Confirm the capability is declared and visible

Inspect the request messages and tool list:

- is the target action present?
- does the model's id match exactly?
- is it in the active region?
- does `available()` return false?
- is the control disabled or covered by a modal?

Check the stable errors in [Diagnostics and observability](/concepts/diagnostics-and-observability) and [Error codes and diagnostics](/reference/error-codes-and-diagnostics).

## 3. Separate “not executed” from “no visible change”

If the result is success but the user sees nothing:

- did the expectation wait only for a toast while the list stayed stale?
- is the record outside the current filter, page, or scroll window?
- was the store updated without a declared state view?
- is an asynchronous job still running?
- is there a cached page or duplicate component instance?

`EXPECTATION_FAILED` means the handler may have run, but the declared result did not appear. Do not resend a write immediately; read business state and check for partial success.

## 4. Check approval and handoff

A high-risk action may be `pending`. Check for an approval item, another open window, or a rejection. The agent has no approval tool. A denied confirmation should produce an explicit state, not an infinite wait.

## 5. Check transport and limits

For an external agent, check:

- the page is still connected;
- the session is valid;
- `RATE_LIMITED` was not returned;
- a `request.id` was not reused;
- the MCP facade returned the result as tool content.

`REPLAY_DETECTED` means no business action ran. Do not mint a new id for the same intent to bypass it; query the prior result first.

## Minimal reproduction

Capture the user request, tool id, arguments, execution result, page snapshot, and timestamp. Replay with a deterministic scripted model. If replay works, the issue is model selection; if not, inspect declaration, availability, or transport.

## Verify the fix

- Manual click and agent invocation produce the same business result.
- The success condition observes a real change.
- Unavailable actions explain why.
- Repeated calls do not write twice.
- Theme and locale do not change action ids.
