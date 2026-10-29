---
id: J-12
title: "Test and debug vanilla capabilities"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Test and debug vanilla capabilities

An agent can fail in several places that look similar in the chat window. A control may never have been declared. The declaration may exist but be unavailable. The model may choose the wrong action. The action may run and still leave the page unchanged. A useful test suite separates those cases instead of asserting only that the final paragraph sounds plausible.

The example is a small work queue. Its page already has ordinary DOM controls. Pling adds a region, one input action, one submit action, and one action per visible row. The same page is used for all checks below.

## Test three boundaries

Start with the declaration boundary. This test reads the registry and asserts what the page actually published.

```ts
const snapshot = pling.registry.snapshot();

expect(snapshot.scopes.find((scope) => scope.id === "todo")).toMatchObject({ role: "main" });
expect(snapshot.records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);
expect(snapshot.actions.map((action) => action.id)).toContain("composer_text");
expect(snapshot.actions.map((action) => action.id)).not.toContain("composer_submit");
```

The last assertion is not incidental. The submit button is unavailable while the text field is empty, so its action is absent from that snapshot. If it appeared anyway, the page and the model would be working from different states.

The second boundary is execution. Use the same registry and a deterministic policy, then check the business object and the DOM:

```ts
const executor = createExecutor({
  registry: pling.registry,
  policy: createPolicy(async () => true),
});

await executor.execute("composer_text", JSON.stringify({ text: "Write the regression note" }));
await executor.execute("composer_submit", "{}");

expect(tasks[0]).toMatchObject({ text: "Write the regression note", done: false });
expect(document.querySelectorAll(".task")).toHaveLength(4);
```

This check does not start a model loop and does not need a gateway. It answers a narrower question: when the page accepts this action, does it change the object the UI is rendering?

The third boundary is the agent loop. Replace the remote model with a replay script:

```ts
const llm = createReplayLlm([
  { calls: [{ tool: "composer_text", args: { text: "Verify the trace" } }] },
  { calls: [{ tool: "composer_submit" }] },
  { content: "The task was added." },
]);

await dock.runtime.session.send("Add a task named Verify the trace");
```

The replay emits the same tool protocol as a model. It exercises availability calculation, execution, result messages, and the next request. It does not pretend that language understanding has been tested.

## Inspect the exact request

Set `trace` when the development build needs to explain what happened:

```ts
createPling({
  agent: {
    trace: { maxCalls: 8 },
    config: { limits: { maxTurns: 100 } },
  },
});
```

The trace is opt-in and bounded. Each retained call contains the messages, function tools, page snapshot, response, status, duration, and context estimate that were present for that request.

```ts
const trace = dock.runtime.trace;

expect(trace?.calls).toHaveLength(3);
expect(trace?.calls[0]?.messages.map((message) => message.role)).toEqual(["system", "user"]);
expect(trace?.calls[0]?.tools.map((tool) => tool.function.name)).toContain("composer_text");
expect(trace?.calls[1]?.tools.map((tool) => tool.function.name)).toContain("composer_submit");
```

Use the trace to answer four questions in order:

1. Did the first request contain the instruction?
2. Did it contain the intended action and the current record?
3. Did the next request contain the tool call and its result?
4. Did the final page match what the response claimed?

The trace is a development aid. It contains outgoing model context, so production should  leave it off unless access is restricted.

## Test failures as first-class outcomes

A model gateway can be offline. A declaration can be unavailable. A business handler can reject a value. These are different outcomes and should produce different assertions.

The example records a failed request with its structured code instead of reducing it to an empty answer:

```ts
await dock.runtime.session.send("Hello");

expect(dock.runtime.trace?.calls[0]).toMatchObject({
  turn: 1,
  status: "error",
  error: { code: "LLM_FAILED", message: "gateway offline" },
});
```

Keep a small real-model suite if the product depends on intent selection. Run it separately from the deterministic suite, record the model and prompt version, and do not make every pull request depend on a network service.

## Run the example

```bash
pnpm tutorial:dev j-12
```

Open `http://127.0.0.1:5277/?lang=en`. The page uses the same queue for human controls and replay-driven tests.

```bash
pnpm tutorial:check j-12
```

The check type-checks the example, runs the declaration, execution, replay, trace, and failure tests, and produces a production build.

## Common mistakes

**Asserting exact model prose.** Wording changes without a behavioural regression. Assert page state, returned codes, tools used, and the messages required for the workflow.

**Testing the model first.** If the declaration or executor is wrong, a model test only adds noise. Verify the deterministic layers before involving a provider.

**Leaving tracing on everywhere.** The trace stores system prompts and page snapshots in memory. Treat it as a debugging surface with an explicit access boundary.

**Using sleeps instead of observable conditions.** Wait for a record, a result, or a status transition. Arbitrary delays make tests slow and still race.

Next: [Add Pling to an existing jQuery app](/vanilla/add-pling-to-an-existing-jquery-app).
