---
id: V3-20
title: "Testing, coverage, and evaluation"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Testing, coverage, and evaluation

There are three different questions behind “does the assistant work?”

1. Does an action change the application state that it claims to change?
2. Does the page declare every control that should be available to the agent?
3. Given a request, does the agent choose the right actions and finish the task?

One kind of test cannot answer all three. A unit test can prove that `add_task` updates the list, but not that the model will choose it. A transcript can prove that one scripted conversation works, but not that a real model will behave the same way. Coverage can reveal an undeclared button, but it cannot decide whether that button should be exposed.

## Test the action against business state

Start with the executor. It is deterministic, runs without a model, and gives a useful failure message when a declaration is wrong.

```ts
const result = await executor.execute(
  "add_task",
  JSON.stringify({ text: "Prepare the demo" }),
);

expect(result).toMatchObject({ result: { ok: true } });
expect(tasks.some((task) => task.text === "Prepare the demo")).toBe(true);
```

Assert the state the user can observe. Do not assert only that the tool returned `{ ok: true }`: an action can return success while changing the wrong row, or while the expected DOM update never happens.

## Use a replay model for conversation mechanics

`createReplayLlm` returns a prepared sequence of model turns. It is useful for testing the loop, tool calls, confirmations, and failure recovery without network access or a nondeterministic provider.

```ts
const llm = createReplayLlm([
  { calls: [{ tool: 'add_task', args: { text: 'Prepare the demo' } }] },
  { content: 'Added.' },
]);

const loop = createAgentLoop({
  registry: pling.registry,
  policy: createPolicy(async () => true),
  llm,
  settle: defaultSettle,
});
```

The model is scripted. If the page stops exposing `add_task`, the replay will produce an `ACTION_NOT_FOUND` result, which is exactly the regression this test should catch.

A replay test does not measure model quality. It measures the code around the model: context assembly, tool dispatch, state changes, policy gates, and stopping conditions.

## Turn a transcript into an evaluation case

`runEvaluation` adds assertions around a run and resets state between cases. The assertions should cover both what happened and what must not happen.

```ts
const report = await runEvaluation({
  run: (input) => loop.run(input),
  reset: () => {
    resetBusinessState();
    loop.reset();
  },
  hooks: loop.hooks,
  cases: [
    {
      name: 'add one task',
      input: 'Add a task to prepare the demo',
      expectIncludes: ['Added'],
      expectTools: ['add_task'],
      maxToolErrors: 0,
      verify: () => tasks.some((task) => task.text === 'Prepare the demo'),
    },
    {
      name: 'do not invent a bulk delete',
      input: 'Delete every task',
      expectNotTools: ['add_task'],
      maxToolErrors: 0,
    },
  ],
});
```

The fields have distinct jobs:

- `expectTools` confirms that the intended capability was used.
- `expectNotTools` catches an unsafe or invented path.
- `maxToolErrors: 0` rejects a run that only succeeds after trial and error.
- `verify` reads real application state instead of trusting the final sentence.
- `reset` prevents history and business data from leaking between cases.

The report is a pass rate, not a score for the model in general. It describes this page, this prompt, and this set of cases.

## Inspect coverage, but do not equate it with permission

`inspectCoverage()` scans actionable controls inside the mounted Vue root. It reports declared controls, grouped declarations, derived controls, and missing ones.

```ts
const report = pling.inspectCoverage();

expect(report.missing).toBe(1);
expect(report.targets).toContainEqual({
  element: 'button#export_csv',
  label: 'Export CSV',
  status: 'missing',
});
expect(pling.registry.snapshot().actions.map((action) => action.id)).not.toContain('export_csv');
```

The last assertion is the important one. A missing control is a diagnostic signal; it is not registered as an action and it is not made available by a DOM fallback. The “Export CSV” button in the example is intentionally undeclared. The report notices it; the agent still cannot call it.

Coverage is a review tool. A 100% report does not mean every exposed capability is safe. It only means that every detected control has some declaration nearby. The declaration itself still needs a useful description, an appropriate risk level, and a confirmation policy.

## Keep real-model tests separate

A real-model test is valuable, but it answers a different question: how does the current provider respond to this prompt and page? Keep it in a separate suite with an explicit model, key, budget, and tolerance for variability.

The practical split is:

| Layer | Runs with | Proves |
| --- | --- | --- |
| executor test | no model | The business action changes the right state |
| replay test | scripted turns | The loop and tool boundary are wired correctly |
| coverage check | no model | The page is explicit about available controls |
| evaluation | replay or real model | A defined set of requests produces acceptable actions and answers |
| real-model smoke test | provider | The current model can follow this page's prompt |

Do not let a real-model test become the only regression test. It is slower, costs money, and changes when a provider updates a model.

## Run the example

```bash
pnpm tutorial:dev v3-20
```

Open `http://127.0.0.1:5233/`. The Todo list exposes one add action and per-row completion actions. The export button is visible to a person and invisible to the agent.

The deterministic check is:

```bash
pnpm tutorial:check v3-20
```

It verifies the coverage report, the absence of an `export_csv` action, the replay transcript, the evaluation report, and the business state after a run.

## Failure modes

**Testing only the model's final sentence.** A convincing answer can coexist with no state change. Assert the action result and the state that a person would see.

**Calling 100% coverage “safe.”** Coverage says a control was classified. It does not say the description is clear, the risk level is correct, or the action should be available at all.

**Reusing one loop history across cases.** The second case inherits the first case's context and can appear to pass for the wrong reason. Reset history and business state.

**Treating `createReplayLlm` as a benchmark.** Replay proves the wiring. It cannot tell you whether a model understands the page.

**Letting diagnostics silently expose controls.** A missing-control warning should lead to a review decision: declare it, group it, or leave it unavailable. It should never become an automatic tool.
