---
id: C-04
title: Execution lifecycle
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Execution lifecycle

The page capability model defines what a page can do. The execution lifecycle begins when the agent chooses one of those actions and ends when the runtime returns a receipt.

This is more than calling a click handler. The runtime has to resolve the action, decode its arguments, reject invalid input, apply the confirmation policy, make the target usable, execute through the page's own path, observe the result, and describe what happened. The receipt then becomes part of the next model turn.

This chapter follows one action through that process. Authority policy, human handoff, sensitive values, and the wider agent loop have separate concerns; here they appear only where they change the execution path.

## What a receipt has to answer

A browser event can return without telling anyone whether the business operation happened. A page handler may return `void` after starting a request, a click may be ignored by the application, or the UI may update before the server rejects the change.

The lifecycle therefore produces a structured receipt that answers four questions:

1. **Did the call reach a declared action?** The action id must exist in the current page model.
2. **Was the action allowed to run?** Arguments, authority, and availability are checked before execution.
3. **Did the page reach the intended state?** An optional expectation and a before/after snapshot provide evidence.
4. **What should happen next?** The error position and result fields tell the agent whether to inspect, correct an input, ask the user, resume a flow, or stop.

A successful receipt is not proof that the user's business goal was achieved. It records what the page runtime could verify. `ok: true` means the execution path completed without returning an error; `expect` and `changed` are the evidence that something observable happened.

## The pipeline

One call passes through these stages in order:

```text
action id + arguments
        │
        ▼
1. resolve the declared action
2. parse arguments and restore referenced values
3. validate and normalize arguments
4. apply the confirmation policy
5. make the target visible and confirm it is available
6. execute: element action, function action, flow, or human handoff
7. observe the transition, check the expectation, and let the page settle
8. compare snapshots and return a bounded receipt
```

Stages 1–5 happen before any business side effect. Stage 6 is the first point where the page's own write path may run. Stages 7–8 do not change the business result; they determine what evidence the runtime can report about it.

Argument validation comes before confirmation deliberately. There is no reason to ask a person to approve a call that is missing a required field or contains an invalid value. Once the arguments are valid, the confirmation decision can show the user the operation that will actually run.

## Before any side effect

### Resolve the action

The executor looks up the action id in the current page registry. If the id is unknown, it returns `ACTION_NOT_FOUND`. Before the model sees that error, the agent runtime adds the actions that are currently available, so the model can correct its choice instead of guessing again.

An action id is an element-level or function-level identity, not a selector. For a folded row operation, the agent runtime has already mapped the model's `record` argument back to the original action id before this stage begins.

### Decode and validate arguments

Arguments arrive as JSON text produced by a model, which means they may be malformed. The runtime first parses the JSON, returning `INVALID_ARGS` if it is not valid. It then restores any referenced sensitive values so that validation sees the real value rather than a placeholder.

The argument schema is checked next. Missing required fields, wrong types, and values outside an allowed enum produce `INVALID_PARAMS`. Valid values are normalized before execution, so the page handler receives the same shape that was described to the model.

These checks do not mutate page state. A failure here means the operation has not started.

### Apply the confirmation policy

The action's risk class and declaration determine whether the runtime must ask for confirmation. A denial returns `PERMISSION_DENIED`; when no confirmation channel is configured, the default policy is to deny rather than silently proceed.

A compound action is evaluated at the highest risk that can be resolved from its steps. A later step may be discovered to carry a stricter risk than the outer decision covered; that step asks again before it runs. A human handoff is different: the user performs the step, so the lifecycle does not first ask the user to approve their own action.

Confirmation is a runtime gate, not authentication and not a substitute for backend authorization. A page action still uses the application's existing write path and server-side checks.

### Make the target usable

The action must be reachable and available in the page as it exists now. If the target is outside the visible area and declares a reveal handler, the runtime brings it into view, waits for the page to settle, and checks visibility again. The second check matters because scrolling can trigger lazy rendering or replace the target row.

If the target still cannot be made visible, the result is `ACTION_UNAVAILABLE`. The same code is used when the application reports that the action exists but its business prerequisite is not met. The receipt includes the reason when one is available: a disabled button, an unselected record, a closed dialog, or a required filter.

Revealing a target may scroll the page, but it does not change business data. It happens after confirmation because the user should approve the operation, not the incidental scrolling needed to reach it.

## Execution modes

Every mode passes through the same pre-execution gates. The difference is what happens at stage 6.

| Mode | What runs | What the model receives |
| --- | --- | --- |
| Element action | The page's declared handler for a button, input, menu item, or other control | The action receipt, plus evidence when available |
| Function action | A page function with no dedicated DOM element | The same receipt, optionally with a bounded `data` value returned by the function |
| Compound action | An ordered set of already declared actions | One receipt with a step ledger and one before/after diff for the whole operation |
| Human handoff | A request for the user to complete a step personally | A receipt after the user finishes or cancels; no simulated click is attempted |

Function results are bounded in the same spirit as page state. An action may return a small business result, such as a count or an export reference. Large arrays, deep objects, and long strings are summarized or truncated before they enter the model context.

Each element action is assigned a fidelity value when it is registered. The receipt reports that value when it is not `high`. `high` means the developer supplied the execution path, named an explicit target, or declared a native control that the runtime can operate directly. `auto` means the runtime found one nested native target but the developer did not confirm it. `low` means the result came from DOM simulation without a guarantee that the application's effect was observed. A low-fidelity receipt carries a warning rather than treating the simulation as authoritative.

## After execution: expectation and evidence

The page's handler returning does not establish that the business operation completed. A submit handler may start a request and return immediately; a delete animation may still be running; a server may reject the write after the first render.

### Expectation

An action may declare an expectation: a condition that must become true for the step to count as verified. The runtime polls that condition until it is true or its timeout expires. The default timeout is two seconds.

If the condition becomes true, the receipt includes an `expect` description. This is the developer's success criterion and the runtime has already checked it. If the timeout expires, the result is `EXPECTATION_FAILED`. That code says the action was sent but the expected state was not observed. It does not prove that the action had no effect; the page may still be processing, or the effect may not be exposed in the snapshot.

An expectation is stronger than a snapshot diff. The diff says what changed in the page model; the expectation says that a declared business condition was reached.

### Snapshot comparison

When evidence is enabled, the runtime takes a snapshot after all pre-execution gates have passed and immediately before execution. After the action, the expectation check, and the page settling, it takes another snapshot and compares the parts the model can see:

- page identity;
- records and their fields;
- available actions;
- state views;
- page feedback.

The resulting `changed` object reports added, removed, reordered, and updated records; action additions and removals; changed state keys; and feedback changes. The record, action, state, and feedback lists are bounded. If entries are omitted, the receipt includes an omission count, so the model does not mistake a partial diff for a complete one.

A write action that completes without any observable change receives a warning. The warning does not make the action fail: it states that the page model did not change and that the business change may be invisible to this layer. A read action does not receive that warning because reading, scrolling, or navigation may legitimately leave the page model unchanged.

The receipt therefore separates several kinds of evidence:

| Field | What it establishes |
| --- | --- |
| `ok` | The execution path returned without an error |
| `expect` | The declared success condition was observed |
| `changed` | These visible parts of the page model changed |
| `fidelity` | How much confidence the framework has in the execution path |
| `warning` | A successful call still needs interpretation |
| `data` | A bounded business result returned by a function action |

## Failure position and retry safety

The most important part of an error is where it happened. Retrying a call that never started is different from repeating a call whose write may already have landed.

| Failure point | Typical code | What is known |
| --- | --- | --- |
| Action lookup or argument decoding | `ACTION_NOT_FOUND`, `INVALID_ARGS`, `INVALID_PARAMS` | The operation did not start |
| Permission decision | `PERMISSION_DENIED` | The operation did not start |
| Visibility or business availability | `ACTION_UNAVAILABLE` | The operation did not start; the page may need a prerequisite |
| Page handler or function execution | `EXECUTION_FAILED` | Execution started; the effect may be partial or unknown |
| Expected state not reached | `EXPECTATION_FAILED` | The action was sent; the intended result was not observed |
| A step inside a compound action failed | `STEP_FAILED` | Earlier steps may have taken effect; the remaining steps are known |
| Human handoff cancelled, timed out, or unverified | `HANDOFF_CANCELLED`, `HANDOFF_TIMEOUT`, `HANDOFF_FAILED` | The human step did not finish successfully |

The runtime returns expected failures as structured results rather than throwing them into the agent loop. If an implementation throws unexpectedly, the loop catches the exception and converts it into `EXECUTION_FAILED`; the model still receives a result it can reason about.

These categories do not guarantee that a retry is safe. A business operation must still be idempotent, or the caller must use a stable operation id, a server-side idempotency key, or a read-before-write check. The framework reports the failure position; it cannot infer the business's retry semantics.

## Compound actions

A compound action is one tool to the model and one business operation to the user. Its steps run in order against the page as it exists at each step. A search field, a row action that appears after search, a dialog button that appears after the dialog opens, and a save action can therefore be composed without the model needing to know the intermediate layout.

The outer call asks for confirmation at the highest risk it can resolve from the steps. The inner steps still pass through the same lookup, argument, visibility, and availability gates. They are not a backdoor around the page's action declarations. A step that becomes riskier than the outer approval asks again.

The whole flow produces one before/after diff. That is the correct unit for a user asking what the business operation changed; a separate diff for every internal step would multiply snapshot work and obscure the result. The receipt also contains a step ledger with each step's id, outcome, and error when relevant.

If a step fails, the result is `STEP_FAILED` rather than a generic failure. The step ledger says what already ran, and a resumable failure includes a handle for continuing from the failed step. The earlier steps are not replayed. This matters when a flow has already created or modified a record: retrying from step one would duplicate the effect.

A flow is not a database transaction. Earlier steps can remain in effect after a later step fails. The resume handle reduces repeated side effects; it does not roll them back.

## What the lifecycle does not guarantee

The lifecycle provides order, gates, observation, and a structured result. It does not provide:

- **Automatic rollback.** A failed step or timeout can follow a write that already happened.
- **Automatic idempotency.** Repeating the same action can create a second record or submit twice.
- **Automatic retry.** Retry policy belongs to the caller and must account for the failure position.
- **Backend truth.** The snapshot describes what the page exposes. A server may reject a write after the UI has changed, or accept a change the page does not show.
- **A generic DOM fallback.** If an action is not declared, the executor does not search the DOM for a similar button.
- **Authentication or authorization.** Confirmation is not an identity check, and page capability does not replace backend policy.

Cancellation follows the same boundary. The agent can stop before the next action and can abort a model request, but an action that has already entered its page handler may still finish. Cancellation is not rollback. Similarly, an expectation timeout is not proof that the operation did not happen.

## A complete walkthrough

Consider a Todo page with twelve open tasks. The user says, “Delete the weekly report.” The agent has already resolved the target to `t9` and calls the declared action `remove@t9` with `{}`.

1. **Resolve.** The current snapshot contains `remove@t9`; the executor finds its binding.
2. **Validate.** `{}` is valid for an action with no additional parameters.
3. **Confirm.** Deletion is a dangerous operation. The policy asks for confirmation and the user approves.
4. **Make usable.** `t9` is outside the viewport. The reveal handler scrolls it into view, the runtime settles the page, and the second visibility check passes.
5. **Execute.** The page's existing delete handler removes the task.
6. **Expect.** The developer declared that the row should disappear. The condition becomes true within the timeout.
7. **Observe.** The runtime lets the page settle and takes the after snapshot.
8. **Report.** The record `t9` is gone, its row action is gone, and the total falls from twelve to eleven.

The receipt can be summarized as:

```json
{
  "result": {
    "ok": true,
    "action": {
      "id": "remove@t9",
      "description": "Delete the task"
    },
    "expect": "The task is no longer in the list",
    "changed": {
      "observed": true,
      "records": {
        "added": [],
        "removed": ["t9"],
        "updated": [],
        "reordered": false,
        "omitted": { "added": 0, "removed": 0, "updated": 0 },
        "total": { "from": 12, "to": 11 }
      },
      "actions": {
        "added": [],
        "removed": ["remove@t9"],
        "omitted": { "added": 0, "removed": 0 }
      }
    }
  }
}
```

If the user denies the confirmation, the result is `PERMISSION_DENIED` and the page is untouched. If the action is sent but its expected postcondition never verifies, the result is `EXPECTATION_FAILED`; the agent must inspect the page instead of sending the same deletion again. If the delete handler throws after issuing the request, the result is `EXECUTION_FAILED`; whether the server accepted the request is unknown from this layer.

## Summary

The execution lifecycle turns a selected capability into evidence. It resolves and validates the call, applies authority and availability gates before any business side effect, executes the page's declared operation, waits for an optional expectation, compares the visible page before and after, and returns a bounded receipt.

A receipt is not a claim that the whole business goal succeeded. It states what ran, what was verified, what changed, and where a failure occurred. That distinction is what lets the next model turn decide whether to stop, correct an argument, inspect the page, continue a flow, or ask the user.
