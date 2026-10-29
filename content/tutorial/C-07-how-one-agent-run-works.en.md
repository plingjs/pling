---
id: C-07
title: "How one agent run works"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# How one agent run works

An agent run is a sequence of bounded decisions, not a browser session that keeps clicking until something looks finished. Each turn gives the model a current description of the page, waits for one response, executes any declared tool calls through the page executor, and returns their results before asking again.

## The run at a glance

```text
user message
    │
    ▼
read registry snapshot ──▶ render context and tool schemas
    │
    ▼
model response ──▶ text? finish or continue
    │
    └─ tool calls ──▶ executor: availability → policy → run → expect → observe
                           │
                           ▼
                      tool results ──▶ next turn
```

The snapshot and tool list are rebuilt for each turn. The model does not receive a live DOM handle. It receives a bounded representation of the page plus tools whose ids match actions currently declared by the page.

## What happens in one turn

1. The session accepts a user message or a resumed task instruction.
2. The runtime snapshots the active scopes, records, state, feedback, unavailable actions, and usable actions.
3. It renders the system context and a function schema for each exposed action.
4. The model returns text, tool calls, or both.
5. Every tool call goes through the same executor used by direct tests: parameter validation, availability, confirmation, execution, expectation, and post-action observation.
6. The tool result is appended in protocol order.
7. If the model asked for another tool, the loop continues. If it produced a final answer, the run ends. Limits stop a run that exceeds its turn, token, or loop budget.

The executor does not search the DOM for a plausible substitute when an action is missing. A missing or unavailable declaration becomes a structured result the model can reason about; it is never silently repaired by a generic click.

## What the model does not own

The model chooses an action by its declared id and supplies arguments. It does not decide whether the action is available, whether a person must approve it, or whether the expected business state changed. Those checks remain in the page runtime and, where appropriate, the backend.

This separation also makes runs reproducible. A replay model can emit the same tool calls without a network provider, and a trace can show the exact snapshot, messages, and tools used for each request.

## Budgets and termination

Production runs default to a finite turn budget. A page can lower that budget or make it larger for a controlled demonstration, but it should not remove it. Context compaction, per-response output limits, and repeated-call detection keep a run from growing without bound.

Stopping is a successful outcome when the requested state has been reached. The loop does not require an extra tool call merely to produce another paragraph. Likewise, a failure result is terminal for that step until the model chooses a different action or reports why it cannot continue.

## Where to inspect a run

Enable request tracing in a development build and inspect the first system context, each tool list, each response, and each tool result. Read them in order rather than looking only at the final answer. The common question is not “what did the model say?” but “what could it see and call at that moment?”

For the request and execution details, continue with [Execution lifecycle](/concepts/execution-lifecycle) and [Diagnostics and observability](/concepts/diagnostics-and-observability).
