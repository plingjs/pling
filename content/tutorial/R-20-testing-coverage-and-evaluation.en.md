---
id: R-20
title: "Testing, coverage, and evaluation"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Testing, coverage, and evaluation

“The assistant works” can mean three different things. A declared action may fail to change the state it promises to change. A visible control may never have been classified for the agent. Or the page may be wired correctly while a particular model chooses the wrong action for a request.

These failures need separate checks. An executor test does not tell you whether a model will choose the action. A scripted conversation does not prove that every control has an explicit policy. A coverage report does not prove that the exposed actions are safe.

This chapter keeps the Todo example small and adds one deliberate coverage gap. The gap is useful because it makes the difference between “detected” and “available” visible in the running page.

## Test the action against observable state

Start below the model. The executor is deterministic, and a failure points to the declaration or the business function rather than to model behaviour.

```ts
const result = await executor.execute(
  "add_task",
  JSON.stringify({ text: "Prepare the demo" }),
);

expect(result).toMatchObject({ result: { ok: true } });
expect(document.body.textContent).toContain("Prepare the demo");
```

For a React page, wait for the commit before reading the DOM. In Vitest, wrapping the assertion boundary in `act` is enough:

```ts
await act(async () => {});
expect(document.querySelector(".task")?.textContent).toContain("Prepare the demo");
```

Assert what a person sees, not only the value returned by the executor. A tool can report success while updating the wrong row, or while the component never renders the new state.

## Use a replay model for conversation mechanics

`createReplayLlm` returns a prepared sequence of model turns. It removes provider variance while preserving the path that matters in a page test: context construction, tool selection, dispatch, state updates, and stopping.

```ts
const llm = createReplayLlm([
  { calls: [{ tool: "add_task", args: { text: "Prepare the demo" } }] },
  { content: "Added." },
]);

const loop = createAgentLoop({
  registry: pling.registry,
  policy: createPolicy(async () => true),
  llm,
  settle: async () => {
    flushSync(() => {});
    await act(async () => {});
  },
});
```

The call to `flushSync` matters in React. Between two scripted turns, React must commit the action's state update before the next turn reads the registry or the DOM. Without that boundary, a test can inspect a page that has not rendered yet.

The replay model does not measure model quality. It measures the code around the model. If `add_task` disappears, the replay produces `ACTION_NOT_FOUND`, which is exactly the regression this test should catch.

## Turn a transcript into an evaluation case

`runEvaluation` adds assertions around a run and calls `reset` between cases. Both the page and the conversation must be reset; otherwise the second case inherits the first case's history.

```ts
const report = await runEvaluation({
  run: (input) => loop.run(input),
  reset: () => {
    app.current?.reset();
    loop.reset();
  },
  hooks: loop.hooks,
  cases: [
    {
      name: "add one task",
      input: "Add a task to prepare the demo",
      expectIncludes: ["Added"],
      expectTools: ["add_task"],
      maxToolErrors: 0,
      verify: () => app.current?.getTasks().some(
        (task) => task.text === "Prepare the demo",
      ) === true,
    },
    {
      name: "do not invent a bulk delete",
      input: "Delete every task",
      expectNotTools: ["add_task"],
      maxToolErrors: 0,
    },
  ],
});
```

Each field answers a narrow question:

- `expectTools` confirms that the intended capability was used.
- `expectNotTools` catches an invented or unsafe path.
- `maxToolErrors: 0` rejects a run that only succeeds after trial and error.
- `verify` reads the business state instead of trusting the final sentence.
- `reset` prevents page data and conversation history from leaking between cases.

The result is a pass rate for these cases on this page. It is not a general score for the model.

## Inspect coverage without treating it as permission

`inspectCoverage()` scans a mounted application for controls that should have been classified. The report distinguishes direct declarations, optional derived actions, controls grouped under an ancestor declaration, and controls with no declaration at all.

```ts
const report = pling.inspectCoverage(document.querySelector("main"));

expect(report.missing).toBe(1);
expect(report.targets).toContainEqual({
  element: "button#export_csv",
  label: "Export CSV",
  status: "missing",
});
expect(pling.registry.snapshot().actions.map((action) => action.id))
  .not.toContain("export_csv");
```

The last assertion carries the security decision. A missing control is a diagnostic signal. It is not registered automatically, and it is not exposed through a DOM fallback. The Export CSV button remains usable by a person; the agent still cannot call it.

Pass the application root when the page contains more than one mounted surface. The React adapter defaults to `document.body`, which is convenient for a single application but too broad for an embedded widget.

Coverage is a review aid. A report of 100% means that every detected control has a nearby classification. It does not mean the descriptions are clear, the risk levels are correct, or the controls should be available to an agent at all.

## Keep the test layers separate

| Layer | Runs with | Proves |
| --- | --- | --- |
| executor test | no model | The action changes the state a person can observe |
| replay test | scripted turns | Context and tool dispatch are wired correctly |
| coverage check | no model | The page has an explicit decision for each detected control |
| evaluation | replay or real model | A defined set of requests produces acceptable actions and answers |
| real-model smoke test | provider | This model can follow this page's prompt today |

Do not make a real-model test the only regression test. It is slower, costs money, and changes when a provider changes the model. Use it to learn how the current model behaves, not to replace deterministic checks.

## Run the example

For English:

```bash
pnpm tutorial:dev r-20
```

For Chinese:

```bash
pnpm tutorial:dev r-20 --locale zh
```

Open `http://127.0.0.1:5260/`. The Todo list exposes one add action and one completion action per row. The Export CSV button is intentionally undeclared.

The source is in `examples/tutorials/r-20-testing-coverage-and-evaluation`.

The release-equivalent check is:

```bash
pnpm tutorial:check r-20
```

It verifies the coverage gap, the absence of an `export_csv` action, the replay transcript, the evaluation result, and the business state after the run.

## Failure modes

**Asserting only the final sentence.** A convincing answer can coexist with no state change. Check the action result and the rendered state.

**Reusing one loop history across cases.** The second case can appear to pass because it inherited context from the first. Reset both the conversation and the application.

**Testing React before the commit.** Between scripted turns, flush and await the component update. Otherwise the registry or DOM assertion reads stale output.

**Treating coverage as authorization.** Coverage says a control was classified. It does not say the classification is safe or useful.

**Turning a missing-control warning into an automatic action.** The response to a warning is a review decision: declare the control, group it, or leave it unavailable.
