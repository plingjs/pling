---
id: R-14
title: "Page feedback, target highlighting, and guidance"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Page feedback, target highlighting, and guidance

A user asks the assistant to save a workspace name. The save fails because the field is empty. On the page, an error message appears beside the field. To the model, nothing has changed: the action returned a failure, but the reason is still hidden in the rendered interface. It may retry the same call or describe the operation as complete when it was not.

Human handoff creates a similar problem. If the assistant says “enter the verification code” but neither the field nor the publish button is identified, the user has to guess where the task moved from the agent to them. A highlight helps only after the instruction itself is clear.

React applications need three related mechanisms here:

- `usePlingFeedback` exposes a page error or status as structured, read-only context;
- `usePlingGuideTarget` marks an element for guidance without making it an action;
- presence shows which real element is being operated or is waiting for a person.

## Why a visible error is not enough

The release panel in the example has a workspace name, a verification code, and a publish button. Saving an empty name produces a readable error. The model needs more than the fact that the call failed:

| Information | Why it matters |
| --- | --- |
| The message | Retrying without a reason wastes a turn |
| The field | The model can correct the right input instead of guessing |
| The severity | An error, warning, and routine status call for different responses |

Pling reads feedback from two sources. The first is an explicit declaration made with `usePlingFeedback`. The second is existing accessibility semantics: `role="alert"`, `role="status"`, `aria-live`, and `aria-invalid="true"`.

The automatic path is intentionally narrow. It does not infer an error from a class named `error` or a red border. A state that is invisible to assistive technology is also invisible to the model.

## Declare feedback where the page shows it

The release panel owns one feedback value and passes it to the hook:

```tsx{10-19}
const [feedbackText, setFeedbackText] = useState("");
const [feedbackField, setFeedbackField] = useState<string | undefined>();

usePlingFeedback(
  feedbackText
    ? {
        id: "release_feedback",
        message: feedbackText,
        ...(feedbackField ? { field: feedbackField } : {}),
        severity: "error",
        scope: "release_check",
      }
    : null,
);
```

Passing `null` means that the page currently has no feedback. Changing the message does not require a new declaration: the hook updates the value that the next snapshot reads.

The object form carries the details needed to act on the message:

| Field | Meaning |
| --- | --- |
| `id` | Stable identity for the same feedback item |
| `message` | Text the user can already see, or a function returning it |
| `field` | The affected input; it may also be a function when the field changes |
| `severity` | `error`, `warning`, `info`, or `success` |
| `scope` | The declared region that owns the message |

`scope` must match the real region id. In this example it is `release_check`. Omitting it is appropriate only when the feedback does not belong to a specific region. The hook does not inspect React component boundaries to guess a scope.

The model receives a bounded block rather than the page's entire DOM:

```text
## Current page feedback (1 total, showing 1)
- [error] Enter a workspace name. It cannot contain only spaces.
  id: release_feedback · field: workspace_name · scope: release_check
```

Feedback is data. It does not appear in the tool schema and the model cannot execute it. The system prompt can tell the model to read this block before retrying a failed operation, but the authority boundary remains unchanged.

If the same message is rendered in several places, declare it once at the element that owns the status. Duplicate feedback increases context size and makes the page appear more broken than it is.

## Use ARIA when the semantics already exist

Many React form components already expose accessible validation state. Pling can collect it without a second declaration:

```tsx
<input
  aria-invalid={invalid ? "true" : undefined}
  aria-errormessage={invalid ? "name-error" : undefined}
/>
<p id="name-error" role="alert">Enter a workspace name.</p>
```

The invalid input contributes its field and error; the alert contributes the visible message. Use a real `<label>`, `aria-label`, `aria-labelledby`, or `data-pling-field` so the model can identify the field. Without a stable field name, it receives an error but cannot tell where to apply the correction.

Prefer an explicit declaration when the business meaning is richer than the visible text: several fields failing one operation, a temporary account lock, or a status that needs a stable id across updates.

Do not declare the same message explicitly and through a live region at the same time. The example suppresses `aria-live` while a declared error is present, then allows it for the success status. One status element should have one source of truth.

## A guide target is not an action

The verification-code field is completed only by a person. Registering it with `usePlingTool` would invite the model to fill a value it should not know. Leaving it invisible would make the handoff hard to follow.

`usePlingGuideTarget` provides the middle ground:

```tsx{8}
const codeTargetRef = usePlingGuideTarget<HTMLInputElement>("verification_code");

<input
  ref={codeTargetRef}
  value={code}
  onChange={(event) => setCode(event.target.value)}
  data-pling-field="verification_code"
  autoComplete="off"
/>
```

The field now has a stable target for visual guidance. It is not in the action list. The model can see that a person must use it through the handoff instructions, but it cannot fill or click it.

This distinction matters in both directions:

- a control the agent may operate should be declared as an action;
- a control reserved for a person may be a guide target.

`usePlingGuideTarget` changes presentation, not authority. It creates no permission, business operation, or tool schema entry.

## Put the human step in the action

The publish action does not simulate the person's work. It declares a handoff, and each step points to the element involved:

```tsx{6-9}
const publishToolRef = usePlingTool<HTMLButtonElement>({
  id: "publish_changes",
  desc: copy.publishDesc,
  kind: "danger",
  handoff: {
    reason: copy.publishReason,
    steps: [
      { text: copy.publishStepOne, highlight: "verification_code" },
      { text: copy.publishStepTwo, highlight: "publish_changes" },
    ],
    expect: {
      desc: copy.publishExpect,
      check: () => publishedRef.current,
    },
  },
});
```

`highlight` may name a guide target or an already registered action. The first step points to the person-only field; the second points to the action's own button. The executor moves the visual focus as the user advances through the steps.

The `expect` function must read a durable signal. In the example it reads a ref updated when publishing succeeds. Checking only that the user clicked “done” would not prove that the page reached the promised state.

## Make the transfer of control visible

Presence is enabled once when the application is created:

```ts
const pling = createPling({
  presence: { effect: "spotlight" },
});
```

Available effects are:

| Effect | Appearance | Suitable for |
| --- | --- | --- |
| `ring` | A light outline | Normal actions |
| `spotlight` | The rest of the page dims | A step that needs attention |
| `none` | No overlay | Tests or a fully custom presentation |

The outline follows the element the executor actually targets, not a nearby wrapper. During a handoff, it follows the current step. The overlay uses `pointer-events: none` and carries Pling's UI marker, so it cannot intercept the click and does not enter the page snapshot. Reduced-motion preferences disable animation while retaining a static outline.

Presence does not replace accessible labels or written instructions. It answers “where is the control now?” The handoff panel and its step text answer “what should I do?”

## Three mechanisms, three questions

| Mechanism | Question |
| --- | --- |
| Page feedback | What has the page already told the user? |
| Presence | Which element is the assistant touching or waiting on? |
| Human handoff | Which step must a person complete? |

Do not use feedback as approval. A message saying “this operation is dangerous” does not replace `confirm` or `handoff`. Do not use a guide target as permission. Marking an element for guidance does not make it executable.

## Verify

Start the example:

```bash
pnpm tutorial:dev r-14 --locale en
```

The source is in `examples/tutorials/r-14-page-feedback-target-highlighting-and-guidance`. It uses the workspace packages and contains no copied framework implementation.

Open `http://127.0.0.1:5254/?lang=en` and check:

1. Clear the workspace name and select **Save name**. The feedback appears and the status changes to “Needs attention.”
2. Inspect Activity. The page snapshot contains the message, field, severity, and `release_check` scope; no `release_feedback` action exists.
3. Inspect the tool list. `verification_code` is absent and `publish_changes` is present.
4. Ask the assistant to publish changes. The handoff lists the code field and the publish button, and the spotlight follows the current step.
5. Enter `246810`, publish, and complete the handoff. The status becomes “Published.”

The deterministic check covers declared feedback, clearing, the wrong-code path, localized copy, guide targets, and handoff steps:

```bash
pnpm tutorial:check r-14
```

## Common mistakes

**Hiding the only error in a style.** A red border is not a message. Add explicit feedback or real ARIA semantics at the component boundary that owns the state.

**Declaring the same status twice.** An explicit declaration and a live region can both be valid individually, but together they produce duplicate context. Choose one owner for each message.

**Using a guide target for an agent-operated control.** If the assistant should be allowed to use the element, declare an action. Reserve guide targets for people.

**Checking only that the user pressed “done.”** A handoff succeeds when the page reaches the expected business state, not when the confirmation button was clicked.
