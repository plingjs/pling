---
id: R-15
title: "Confirmation and human handoff"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Confirmation and human handoff

The workspace settings panel has three kinds of operation. Saving a name is allowed, but the first attempt needs explicit approval. Archiving and resetting ask every time. Publishing requires the person to enter a verification code; the agent must not fill it in.

All three look like “pause before execution”, but they assign responsibility differently. Pling separates two boundaries:

- **Confirmation** answers “May the agent perform this action?”
- **Human handoff** answers “Has a person completed this step?”

Both are enforced by the executor, not by requests in a prompt. A model may ask for an action, but it cannot bypass the user's decision or report a waiting human step as complete.

## Let risk decide the default approval policy

An action's `kind` supplies its default risk:

| `kind` | Default behavior |
| --- | --- |
| `read` | Execute directly |
| `write` | Execute directly |
| `danger` | Ask every time; never offer “always allow” |

Use `confirm` when the business requires a stricter rule:

```tsx{6}
const saveToolRef = usePlingTool<HTMLButtonElement>({
  id: "save_workspace_name",
  desc: "Save the shared workspace settings.",
  kind: "write",
  confirm: true,
  run: saveName,
});
```

The effective policy has three cases:

| Declaration | Approval | Can allow for the session |
| --- | --- | --- |
| `read` / `write` without `confirm` | `none` | Not applicable |
| `write` with `confirm: true` | `ask` | Yes |
| `danger`, or any kind with `confirm: "always"` | `ask-always` | No |

`confirm: false` removes the approval gate. It is appropriate only when the action already has an independent authorization mechanism. It does not reduce business risk.

Archive and reset are both declared as `danger` in the example. Archive also includes `confirm: true`, but the result remains `ask-always`; a dangerous action does not become permanently allowed after one approval.

## Approval comes before the business operation

After the model requests an action, the executor checks parameters, scope, availability, and approval. When confirmation is required, `<AgentDock>` displays the pending item. A denial returns `PERMISSION_DENIED`, and the action's `run` function is not called.

That ordering cannot be reversed. Asking after data has been written is a notification, not authorization. Hiding a dangerous button in the interface is also insufficient: if the capability remains in the page projection, the model may still invoke it.

An approval only grants permission to attempt the operation. The executor should still verify the business result afterward.

## Handoff leaves the final step to a person

The publish action declares a `handoff` and has no `run`:

```tsx{5-12}
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
    expect: { desc: copy.publishExpect, check: () => publishedRef.current },
  },
});
```

When the model invokes this action, the executor does not click the button or guess the code. It presents the reason and steps, highlights the current target, and waits for the person:

| User outcome | Execution result |
| --- | --- |
| Completes, and `expect` passes | Successful receipt |
| Cancels | `HANDOFF_CANCELLED` |
| Times out | `HANDOFF_TIMEOUT` |
| Claims completion without the expected page state | `HANDOFF_FAILED` |

The default timeout is five minutes; an action may override it with `handoff.timeout`. After cancellation or timeout, the model should ask what to do next rather than retry silently.

`expect` reads durable business state. The example updates `publishedRef` after a successful publish and uses it to confirm that the page reached “Published”. A user clicking “done” alone does not prove success.

## Do not stack the two mechanisms

An action with a `handoff` does not also display a confirmation prompt. The person completing the step is already making the decision. Asking someone to approve and then complete the same operation is repetitive and obscures which action granted authority.

| Situation | Mechanism |
| --- | --- |
| The agent may act, but should ask first | `confirm: true` |
| Every attempt of a destructive action needs consent | `kind: "danger"` or `confirm: "always"` |
| A person must enter information, use a device, or accept legal responsibility | `handoff` |
| A person needs to be shown the field to operate | Guide target plus `handoff.steps` |

If the agent can perform the entire operation and only needs authorization, use confirmation. If the final step can only be completed by a person, use handoff.

## Verify

Start the example:

```bash
pnpm tutorial:dev r-15 --locale en
```

Open `http://127.0.0.1:5255/?lang=en` and check:

The source is in `examples/tutorials/r-15-confirmation-and-human-handoff`. It uses the workspace packages and contains no copied framework implementation.

1. Ask the assistant to save the workspace name. The first request asks for approval; the action runs only after it is allowed.
2. Ask it to archive the workspace. It asks every time and offers no “always allow”.
3. Deny one archive request. The assistant reports that permission was not granted and does not claim the workspace was archived.
4. Ask it to publish changes. The page enters a handoff, highlights the verification field and publish button, and does not complete the form for the user.
5. Cancel the handoff. The assistant reports that the step did not complete.
6. Enter `246810` and publish. The assistant receives success only after the page reaches “Published”.

The deterministic checks cover the three approval policies, denial without execution, cancelled handoff, successful receipts, and localized copy:

```bash
pnpm tutorial:check r-15
```

## Common mistakes

**Treating `danger` as a complete risk assessment.** The level does not know whether an operation is reversible, regulated, or permitted for this user. The declaration must reflect the business.

**Requesting approval after a business write.** That confirmation prevents nothing. The gate belongs before the side effect.

**Simulating a human step.** Do not fill in a verification code or click “the person confirms” behind the scenes. A declared human step must wait or fail closed.

**Omitting the success check.** Opening a dialog or clicking done does not prove that the business state changed. Check the resulting data, route, or page state.

**Treating denial as a transient failure.** `PERMISSION_DENIED`, `HANDOFF_CANCELLED`, and `HANDOFF_TIMEOUT` are decisions or boundaries. Do not loop or retry silently.
