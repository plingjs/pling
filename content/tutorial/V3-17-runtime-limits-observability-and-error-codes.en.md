---
id: V3-17
title: "Runtime limits, observability, and error codes"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Runtime limits, observability, and error codes

An agent that works in a demo can still fail as a product: it may spend too many model turns, carry an unbounded history into every request, or report “something went wrong” without enough information to act on. This chapter keeps the order flow unchanged and examines the runtime around it.

The goal is not to make every number configurable. It is to make the boundaries explicit, expose what happened during a run, and give failures a stable shape.

## Separate the two kinds of limits

The application configures one request budget and one context budget:

```ts
createPling({
  agent: {
    config: {
      limits: {
        maxTurns: 100,
        contextTokens: 8_192,
        reserveForOutput: 1_024,
        compactRatio: 0.8,
        keepRecent: 6,
      },
    },
  },
});
```

| Setting | What it controls |
| --- | --- |
| `maxTurns` | Model round trips in one `send()` call |
| `contextTokens` | Total prompt budget for the conversation |
| `reserveForOutput` | Space kept back for the model's next response |
| `compactRatio` | When history is compacted, as a fraction of usable context |
| `keepRecent` | Recent messages kept verbatim when compaction runs |

`maxTurns` is not a session-wide counter. A conversation can contain several user requests, each with its own turn budget. `contextTokens` is not the same as `maxTokens` either: the latter limits one generated response, while the former limits the prompt history that is sent.

The demo uses `maxTurns: 100` so a learner can experiment. Production should start with the framework default of 10 unless there is a measured reason to allow more. A large turn budget turns a loop bug into a bill.

`reserveForOutput` must leave usable room for history. If `contextTokens - reserveForOutput` is too small, every request starts near the compaction threshold. The framework rejects configurations such as `maxTurns: 0` or `compactRatio: 1.5` instead of letting them produce confusing behavior later.

## Observe two different counters

The runtime exposes both values because they answer different questions:

- `turnsUsed` is how many model round trips the latest `send()` used. It is the right number to compare with `maxTurns`.
- `telemetry.summary().llmCalls` is the cumulative number of model calls for the session, including retries or compaction.

Do not put both numbers under the same label. “3 turns of 10” describes a budget; “17 calls this session” describes accumulated usage.

The order example records tool calls in a `Telemetry` instance:

```ts
const telemetry = new Telemetry();
const loop = createAgentLoop({ registry, policy, llm, telemetry, maxTurns: 4 });

await loop.run('Change the note on SO-1002');

loop.turnsUsed;                       // model round trips for this run
telemetry.summary().toolCalls;        // cumulative tool calls
```

In production, send the same events to your own collector. Do not log raw prompts, form values, or model output by default. The built-in telemetry keeps counts, durations, token estimates, and error categories; it does not need to become a copy of the user's data.

## Inspect one run in the Activity view

The Vue dock can include a bounded request inspector:

```vue
<AgentDock :debug="{ maxCalls: 8 }" />
```

The inspector shows the system prompt, the assembled history, tool schemas, the page snapshot, and the model response for recent calls. `maxCalls` limits how many calls are kept in memory. A bound is necessary: retaining every prompt for a long session turns a debugging feature into a memory leak.

The inspector lives in the Activity view rather than in a second application panel. It describes the same run the user just watched, including approvals and handoffs.

Debug data is operational data. Treat model output and page snapshots as untrusted content when displaying them, and do not copy them into public logs.

## Give failures a code and a next step

The flow from the previous chapter can fail because saving is locked. The receipt contains both a stable code and a readable explanation:

```json
{
  "error": {
    "code": "STEP_FAILED",
    "message": "Flow update_order_note failed at step 4/4 (save_note): ...",
    "resume": { "runId": "run-3", "from": 4 }
  }
}
```

Codes such as `PERMISSION_DENIED`, `ACTION_UNAVAILABLE`, `EXPECTATION_FAILED`, `HANDOFF_CANCELLED`, and `STEP_FAILED` are for program logic and tests. The message is for the model and the person reading the Activity view. Do not make a client branch on the exact wording of the message; branch on the code.

Error handling should stop at the right boundary:

- permission denial and handoff cancellation are user decisions; do not retry silently;
- an unavailable action needs a precondition fixed first;
- an expectation timeout means the effect is unconfirmed; inspect before retrying;
- a failed flow with a `resume` handle should continue from the failed step.

## Run the example

```bash
pnpm tutorial:dev v3-17
```

Open `http://127.0.0.1:5230/` and use the Activity view.

1. Ask for a note change. Inspect `turnsUsed`, the tool call, and the model request in the inspector.
2. Lock saving, then change a note again. Locate `STEP_FAILED`, the step report, and the resume handle.
3. Unlock saving and continue. The original flow is resumed rather than repeated.

The deterministic check:

```bash
pnpm tutorial:check v3-17
```

It covers limit validation, separate turn and call counters, and stable error codes.

## Failure modes

**Raising `maxTurns` to hide a loop.** More turns let a broken loop run longer. Fix the repeated action or the unclear instruction; increase the budget only after measuring a legitimate need.

**Using one counter for two meanings.** A UI that says “20 of 10 turns” because it mixed cumulative calls with the per-request budget is worse than showing nothing.

**Keeping every request in the inspector.** A debug buffer needs a limit. Bounded recent calls are enough for diagnosis and keep memory predictable.

**Parsing human-readable error text.** Messages change as the framework improves. Tests and recovery logic should use the error code and structured fields.
