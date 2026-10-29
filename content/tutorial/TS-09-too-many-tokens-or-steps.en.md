---
id: TS-09
title: "Too many tokens or steps"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Too many tokens or steps

An expensive run usually comes from unbounded context, oversized record windows, broad tool results, undetected loops, or a turn budget that hides a page problem. It is rarely just “a weak model.”

## Measure first

Record:

- `turnsUsed`: model round trips in this request;
- `telemetry.summary().llmCalls`: cumulative session calls;
- estimated tokens and tool-result size per request;
- the actual tool sequence;
- compaction count;
- failures and retries.

Do not mix cumulative calls and per-request budget. Find whether growth comes from history, tool output, or repetition.

## Common causes

| Cause | Fix |
| --- | --- |
| Oversized record window | Reduce `limit`; read individual records on demand |
| Repeating the full page description | Use `capabilities: "changed"` and `after` |
| Exposing the whole store | Expose only task-relevant fields |
| Tool returns large HTML/JSON | Return a business summary and changed ids |
| Model repeats the same action | Inspect expectations, errors, and loop detection |
| Unbounded history | Configure `contextTokens`, `compactRatio`, `keepRecent` |
| Excessive turn budget | Start from production default 10 and measure before raising |

## Suggested configuration

```ts
limits: {
  maxTurns: 10,
  contextTokens: 8_192,
  reserveForOutput: 1_024,
  compactRatio: 0.8,
  keepRecent: 6,
  maxTokens: 1_024,
}
```

`maxTurns` bounds one `send()`, `contextTokens` bounds prompt history, and `maxTokens` bounds one generation. They are different controls. Raising `maxTurns` from 10 to 100 does not compact history; it only gives a loop more chances.

## Design smaller context

- expose only fields needed for the current decision;
- return a window, total, and referenceable ids for long lists;
- use `after` instead of describing the entire page after success;
- convert large files into a business summary or job id;
- keep stable instructions in capability descriptions rather than repeating them in every user turn;
- stop on a definite failure instead of treating it as a new prompt.

## Loop detection

If the model repeats the same id and arguments:

1. check whether the tool result indicates success;
2. check whether the expectation can ever become true;
3. check whether the page rebuilds on every call;
4. check whether the error gives actionable information;
5. verify `LOOP_DETECTED` and the turn limit.

Do not solve a loop by raising the budget. It turns a bug into a larger bill.

## Acceptance

- A 100-record page has predictable token use under the default window.
- A successful action does not trigger a full page description.
- Repeated failure terminates with a structured error.
- The task still completes after compaction.
- Token and step growth can be explained by request id.

## Related

[Runtime limits, observability, and error codes](/vue/runtime-limits-observability-and-error-codes), [Agent runtime, sessions, context, and limits](/reference/agent-runtime-sessions-context-limits), [Testing, coverage, and evaluation](/vue/testing-coverage-and-evaluation).
