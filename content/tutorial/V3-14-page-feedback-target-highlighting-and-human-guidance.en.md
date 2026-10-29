---
id: V3-14
title: "Page feedback, target highlighting, and human guidance"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Page feedback, target highlighting, and human guidance

A user says, “Save the workspace name”, and the page rejects the request because the field is empty. To a person, the red border and error text explain what happened. To the model, that information is invisible unless the page exposes it in a machine-readable form. The model may retry the same call, choose another action, or report a misleading success.

A similar gap appears when a person must complete a step. If the assistant says “enter the verification code” without identifying the field or the final button, the user has to infer which part of the page matters. Highlighting is not decoration here; it is part of explaining where the action moved from agent to person.

This chapter adds three connected mechanisms:

- `v-feedback` turns a page-level error or status into structured context.
- `v-guide-target` marks an element that should be shown to the user without becoming an agent action.
- `presence` draws attention to the element that is currently being operated or handed to the user.

## Why a visible error is not always readable context

The page in this example has a workspace name and a release code. Saving an empty name fails. The failure is visible to the user, but the agent needs three facts:

| Fact | Why it matters |
| --- | --- |
| What went wrong | Retrying without a reason is wasteful |
| Which field is involved | The model can correct the input instead of guessing |
| How severe it is | A validation error and an informational status require different responses |

Pling reads two sources of feedback:

1. explicit declarations through `v-feedback`;
2. existing accessibility semantics such as `role="alert"`, `role="status"`, `aria-live`, and `aria-invalid="true"`.

The second source is automatic, but deliberately narrow. It does not infer meaning from CSS classes such as `error` or `warning`. The page must already communicate the state through ARIA or a declaration.

## Declare feedback where the page already shows it

The release panel keeps its error state in a computed value and attaches it to the visible feedback area:

```vue{6-10}
<p id="release-status" v-feedback="feedback" class="release__feedback">
  <span v-if="feedback">{{ feedback.message }}</span>
  <span v-else-if="status === 'saved'">{{ copy.saved(name.trim()) }}</span>
  <span v-else-if="status === 'published'">{{ copy.published }}</span>
</p>
```

The fields that can produce feedback point at this element with
`aria-describedby="release-status"`. That keeps the visible error, the browser's
accessibility tree, and the model's context aligned. Do not add `aria-live` as
well: this element is already declared explicitly, and automatic ARIA collection
would otherwise register the same message twice.

The object form carries the details the model needs:

```ts
const feedback = computed(() => ({
  id: "release_feedback",
  message: "Enter a workspace name. It cannot contain only spaces.",
  field: "workspace_name",
  severity: "error",
  scope: "release_check",
}));
```

`message` may be a string or a function. `field` may also be a function, which is useful when the invalid field changes at runtime. `scope` links the feedback to a declared region; here it must match the real region id, `release_check`. Omitting it attaches the item to the nearest scope.

The next model turn receives a block like:

```text
## Current page feedback (1 total, showing 1)
- [error] Enter a workspace name. It cannot contain only spaces.
  id: release_feedback · field: workspace_name · scope: release_check
```

Feedback is read-only page data. It is not an action, and the model cannot execute it. The system prompt tells the model to read feedback before retrying a failed action.

If the same message is rendered in three places, do not register it three times. Prefer one element that owns the status. Duplicate feedback increases context size and makes the page look noisier than it is.

## Let ARIA carry the feedback you already have

Standard form semantics are enough for many cases:

```vue
<input
  v-model="name"
  :aria-invalid="invalid ? 'true' : undefined"
  :aria-errormessage="invalid ? 'name-error' : undefined"
/>
<p v-if="invalid" id="name-error" role="alert">Enter a workspace name.</p>
```

Pling will collect the invalid field and the alert. This is useful when an existing component library already emits accessible errors. Give the input a stable label through `<label>`, `aria-label`, `aria-labelledby`, or `data-pling-field`, otherwise the model receives an error without knowing which field it belongs to.

Explicit `v-feedback` is preferable when the business meaning is richer than the visible message, for example when several fields belong to one failed operation or when the page needs to explain a temporary lock.

## Separate “an action” from “a place to look”

The verification-code input in this example is completed only by a person. Registering it as a tool would invite the model to fill a value it should not know. Leaving it completely invisible makes the handoff difficult to follow.

`v-guide-target` provides the middle ground:

```vue{7}
<input
  v-model="code"
  data-pling-field="verification_code"
  autocomplete="off"
  v-guide-target="'verification_code'"
/>
```

The field has an id for highlighting, but it does not appear in the action list. A handoff step can refer to that id:

```ts
handoff: {
  reason: "The user must confirm the verification code before publishing.",
  steps: [
    { text: "Enter 246810 in the verification-code field.", highlight: "verification_code" },
    { text: "Select “Publish changes” to complete the confirmation.", highlight: "publish_changes" },
  ],
  expect: {
    desc: "The workspace changes are published",
    check: () => published.value,
  },
}
```

`highlight` may name a guide target or an already registered action. The target is presentation only. It adds no permission, no business operation, and no entry in the model's tool schema.

## Make agent activity visible

Presence is enabled once at application setup:

```ts
const pling = createPling({
  presence: { effect: 'spotlight' },
});
```

The available effects are:

| Effect | Appearance | Suitable for |
| --- | --- | --- |
| `ring` | A lightweight outline | Normal actions |
| `spotlight` | The rest of the page dims | A required human step |
| `none` | No visual overlay | Headless tests or highly custom UI |

Presence follows the element the executor actually targets. When an action is running, the outline appears over the real control. When a handoff waits for a person, the corresponding guide target or action is highlighted. When execution ends, the overlay clears.

The overlay uses `pointer-events: none` and is marked as Pling UI, so it cannot intercept clicks and does not become part of the page snapshot. Reduced-motion preferences disable animation while keeping a static outline.

Presence is not an accessibility substitute. The handoff panel still needs readable instructions, and the page still needs a real label on the field. Highlighting helps a sighted user locate the step; it does not explain it on its own.

## Keep feedback and confirmation boundaries distinct

The three mechanisms answer different questions:

| Mechanism | Question |
| --- | --- |
| Feedback | What did the page already tell the user? |
| Presence | Which element is the agent touching or waiting on? |
| Handoff | Which step must a person perform? |

Do not use feedback as approval. A message saying “this action is dangerous” does not replace `confirm` or `handoff`. Do not use highlighting as permission. Marking an element with `v-guide-target` does not allow the model to operate it.

## Verify the page

Start the example:

```bash
pnpm tutorial:dev v3-14
```

Check the following:

1. Clear the workspace name and select **Save name**. The feedback message appears.
2. Ask the assistant to save the name without providing one. Inspect Activity and confirm the model receives the field and message.
3. Inspect the page actions. `verification_code` is absent; `publish_changes` is present.
4. Ask the assistant to publish changes. The handoff panel identifies the code field and the publish button, and the spotlight follows the steps.
5. Enter `246810` and publish. The status changes to published and the feedback clears.

Run the deterministic checks with:

```bash
pnpm tutorial:check v3-14
```

## Common failure modes

**Hiding the only error in a CSS class.** A red border is invisible to assistive technology and to Pling unless it also has ARIA semantics or `v-feedback`. Add the semantic state at the component boundary.

**Registering every explanatory label as a tool.** Feedback should describe the page, not create operations. Keep it read-only and let actions remain the only way to change state.

**Using a guide target for an agent-operated control.** If the model should be able to use the control, declare it with `v-tool`. Use `v-guide-target` only for elements that a person must inspect or operate.

**Highlighting without instructions.** A spotlight tells the user where to look; the handoff reason and step text must tell them what to do and when the step is complete.
