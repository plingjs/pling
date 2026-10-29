---
id: RCP-04
title: "Multi-step modal and wizard"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Multi-step modal and wizard

The hard part of a wizard is not the Next button. An agent must know which step is active, which fields are filled, which steps are hidden, and whether a failure can be resumed without submitting twice.

## Runnable page

The supplier wizard below moves through company, contact, and review. Actions from inactive steps are not kept in the capability list, and asynchronously loaded choices are unavailable until they exist.

<DemoPlayground id="recipe-wizard" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-wizard/`. The source is in `examples/demos/recipe-wizard/`; the fixture is frontend-only, with the approval chain and submission result observable on the page.

## Page contract

Model the wizard as regions with stable ids, not anonymous divs:

- the modal is a region; each step is a child region or a clear `state.step`;
- only the current step's actions appear in the capability list;
- completed fields appear through records or a read-only state view, not a full form dump;
- Next, Back, Submit, and Cancel have stable action ids;
- the success condition is bound to business state, not only a toast;
- closing the modal invalidates old capabilities, including hidden writes.

## Example flow

```text
Open wizard → only “fill basic information” is available
Fill fields → “Next” appears
Enter step two → step-one actions disappear; step-two fields appear
Submit → wait for backend success and visible state
Close → describe again; do not reuse old step capabilities
```

If the user can jump back, expose Back explicitly and recompute availability after returning. An agent must not guess hidden fields to bypass validation.

## Acceptance criteria

1. Only the current step's allowed actions are visible.
2. `state` reports step and progress without unrelated fields.
3. Validation failure returns `INVALID_PARAMS` and the page shows the error.
4. A failed submit preserves entered data and permits a retry when business rules allow it.
5. After cancel or close, old `invoke` calls are unavailable and have no side effect.
6. Refresh or navigation has defined recovery: restore the same draft, or discard and explain.
7. Human-only steps use `handoff`; the agent has no “approve on behalf” capability.

## Framework paths

For Vue 3, start with [Regions, visibility, and overlays](/vue/regions-visibility-and-overlays) and [Flows, async work, and recovery](/vue/flows-async-work-and-recovery). React equivalents are [Regions](/react/regions-visibility-and-overlays) and [Async work](/react/flows-async-work-and-recovery). Vue 2 and vanilla use the same structure with different declaration syntax.

The repository's onboarding-wizard reference includes step transitions, batch field state, and benchmark tasks.

## Common failures

**Every step declares every field.** The model tries to fill hidden steps or submit in the wrong state. Expose only the active view.

**Submit appears without progress.** The agent cannot reason about the next step; provide step and completed-item state.

**A closed modal remains callable.** Remove action registration on teardown and invalidate the current description.

**Next is treated as an ordinary button.** Use page confirmation when approval is required and `handoff` when a human must act. Do not give the agent a self-approval capability.

## Test fixture

Test successful entry, validation failure, cancel on step two, submit timeout followed by recovery, invocation after close, and refresh recovery. Every rejection path should assert that the backend did not create a duplicate order or record.

## Local verification

Ask the assistant to complete all three steps and reorder the approval chain on the review page. Watch for inactive-step actions disappearing, asynchronously loaded industries becoming selectable only after loading, and duplicate submit attempts producing one application.
