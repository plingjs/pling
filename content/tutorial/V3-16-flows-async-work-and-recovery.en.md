---
id: V3-16
title: "Flows, async work, and recovery"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Flows, async work, and recovery

Some business operations have a fixed sequence. Changing an order note, for example, may require returning to the full list, opening the right order, filling the editor, and waiting for the save request to finish. The order is not a decision the model should make each time; it is part of the operation.

If every step is a separate tool call, three problems appear:

- the model spends several turns repeating the same intent;
- an intermediate failure often leads it to start from step one again;
- approval and audit see five unrelated actions instead of one business operation.

A flow declares that sequence once. The model sees one tool. Pling runs the steps in the declared order, resolves each action when its turn arrives, and returns one receipt for the whole operation.

## Declare the operation, not a macro language

The order example declares one flow on the page:

```ts
const updateNoteFlow = {
  id: 'update_order_note',
  desc: 'Change one order\'s note (show all → open the order → fill → save).',
  kind: 'write',
  params: [
    { name: 'orderId', label: 'Order id', options: () => orders.value.map((order) => order.id) },
    { name: 'note', label: 'The new note text', minLength: 1 },
  ],
  steps: [
    { action: 'filter_all', desc: 'Restore the All filter' },
    { action: 'open_order@{{orderId}}', desc: 'Open the target order' },
    { action: 'note_input', args: { text: '{{note}}' }, desc: 'Fill in the new note' },
    { action: 'save_note', desc: 'Save the note', idempotent: true },
  ],
};
```

Steps reference action ids that already exist in the page. They do not introduce selectors, DOM calls, or a second permission system. The flow is registered with `v-tool` like any other capability:

```vue
<section v-scope="{ id: 'orders', role: 'main' }" v-tool="updateNoteFlow">
```

This matters for maintainability. If the query field is renamed, the step fails during development with an actionable message instead of silently clicking a stale selector. If a row action requires approval, the same approval logic applies inside the flow.

A flow should be used when the sequence is genuinely fixed. If the next step depends on the result of the previous one, keep the decision in the agent loop and expose the individual actions. A flow is not a general-purpose scripting language.

## What the model receives

The model sees one action with a flow label, not the four child steps as independent suggestions:

```text
update_order_note (flow: 4 steps / write)
  Change one order's note (show all → open the order → fill → save).
```

When it calls the flow, the runtime performs the same checks as for any other action: parameters, scope, availability, and approval. The risk of the whole flow is the highest risk among its reachable steps, and the user is asked once for that business operation.

The executor resolves step ids one at a time. The editor actions do not exist until the row has been opened. This is why the steps are resolved at execution time rather than validated against a static list when the page first renders.

After the last step, the receipt contains a step report and one change summary:

```json
{
  "ok": true,
  "flow": { "completed": 4, "total": 4, "steps": ["…"] },
  "changed": { "observed": true }
}
```

One receipt is not just a convenience. It is the unit the model uses to answer “did this business operation finish, and what changed?”

## Make asynchronous completion explicit

A save button does not necessarily finish synchronously. The UI may keep the editor open while a request is in flight, then close it after the server responds. In the example, `saveNote()` waits 250 ms before updating the order and closing the editor.

The save declaration supplies a success condition:

```ts
expect: {
  desc: 'The order note is updated and the editor is closed',
  check: () => {
    const order = editingOrder.value;
    return Boolean(order && order.note === draftNote.value.trim() && editingId.value === null);
  },
  timeout: 2_000,
}
```

`expect` is a claim about business state, not a delay. Pling waits for the check to become true. If the request fails, the editor stays open and the action returns `EXPECTATION_FAILED` rather than reporting a successful click.

Do not add an arbitrary `setTimeout` to the flow as a substitute for `expect`. A fixed delay is either slower than necessary or, under load, still too short. Once the outcome is observable, let the framework wait for it.

`settle` covers a different concern: it lets Vue apply DOM updates and waits for the page to stop moving between steps. A flow uses the same settle mechanism as an ordinary sequence of actions. Neither `settle` nor `expect` replaces the other.

## Fail in the middle without pretending nothing happened

The recovery switch in the example makes the save action unavailable. Running the flow then returns `STEP_FAILED` at step four:

```text
Flow update_order_note failed at step 4/4 (save_note): saving is locked.
Progress: 3/4 steps: filter_all✓ / open_order@SO-1004✓ / note_input✓ / save_note✗.
Changes from completed steps have already taken effect.
Call pling_resume_flow to resume from step 4 (runId: run-…).
```

The first three steps are not undone: the filter is restored, the correct order is open, and the new text is in the editor. The agent should keep that state and continue, not replay the sequence from the beginning.

After the save action becomes available again, the continuation uses the handle from the failure receipt:

```ts
await executor.execute('pling_resume_flow', JSON.stringify({ runId: failed.error.resume.runId }));
```

The framework starts at the failed step and keeps the earlier reports. Once the flow succeeds, the temporary resume action disappears from the page.

Not every failed step is safe to retry. A missing action, invalid parameter, unavailable control, or denied permission fails before the step has any side effect, so continuing is safe. A step that threw after changing data, or whose expectation timed out, may already have produced an effect. Mark such a step `idempotent: true` only when repeating it is genuinely harmless. Otherwise inspect the page and repair the remaining work manually.

## Run the example

```bash
pnpm tutorial:dev v3-16
```

Open `http://127.0.0.1:5229/`.

1. Ask the assistant to change the note on `SO-1002`. The page filters to All, opens the editor, fills the note, and settles the delayed save.
2. Select **Lock saving**, then ask for another note change. Inspect the step report and the resume handle.
3. Select **Unlock saving** and ask the assistant to continue. The same editor is completed; the first three steps are not repeated.

The deterministic check is:

```bash
pnpm tutorial:check v3-16
```

It covers the registered flow shape, asynchronous completion, failure at the last step, and continuation from the failed step.

## Failure modes

**Using a flow to hide a decision.** A flow has no branches. If the next action depends on a result, expose the actions and let the model choose. Encoding a long decision tree in steps makes the receipt hard to understand and the behavior harder to test.

**Retrying a step with unknown side effects.** A timeout after a submit request does not prove that the request failed. Do not mark such a step idempotent unless the underlying operation provides idempotency.

**Waiting for a fixed number of milliseconds.** Use `expect` for business outcomes and `settle` for page updates. A sleep is not evidence that anything happened.

**Ignoring the step report.** “The flow failed” is less useful than “steps one through three completed; step four is unavailable.” The report exists so the model can repair the right part of the operation.
