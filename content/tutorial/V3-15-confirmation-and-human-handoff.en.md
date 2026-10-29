---
id: V3-15
title: "Confirmation and human handoff"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Confirmation and human handoff

A page capability is not automatically safe to execute just because the agent can describe it. Archiving a workspace, deleting a record, or publishing a release may need a person's approval. Other steps cannot be delegated at all: a verification code, a hardware token, or a legal acknowledgement must be completed by the person using the page.

Pling treats these as two different events:

- **Confirmation** asks, “May the agent perform this action?”
- **Handoff** asks, “Can the person perform this step now?”

Neither is a prompt instruction. Both happen in the execution pipeline, after the model has selected an action and before the business operation completes.

## Start with risk, then override deliberately

An action's `kind` sets the default risk:

| `kind` | Default approval |
| --- | --- |
| `read` | No confirmation |
| `write` | No confirmation |
| `danger` | Confirm every time; no “always allow” |

Use `confirm` when the default is not quite right:

```ts
const saveAction = {
  id: 'save_workspace_name',
  desc: 'Save the shared workspace settings. This asks for confirmation once.',
  kind: 'write',
  confirm: true,
  run: saveName,
};

const resetAction = {
  id: 'reset_workspace',
  desc: 'Clear the workspace settings. This dangerous action asks every time.',
  kind: 'danger',
  confirm: 'always',
  run: resetWorkspace,
};
```

The resolved values are:

| Declaration | Approval | “Always allow” in this conversation |
| --- | --- | --- |
| `read` / `write` | `none` | Not applicable |
| `write`, `confirm: true` | `ask` | Available |
| `danger` (including `confirm: true`) | `ask-always` | Never offered |
| Any kind, `confirm: "always"` | `ask-always` | Never offered |

`confirm: false` exists for exceptional cases, including a dangerous-looking action with an independent safety mechanism. Use it sparingly. It does not make the action safe; it only removes this gate.

## Confirmation belongs to the execution pipeline

The model proposes an action. The executor then checks parameters, scope, availability, and approval. If approval is required, the runtime asks the user. A denial returns `PERMISSION_DENIED`; the action's `run` function is never called.

That ordering matters. Hiding a danger button in the UI is not enough, because the capability may still be present in the snapshot. A prompt saying “please do not delete anything” is not enough either, because prompts are not a policy boundary.

The agent runtime exposes pending approvals through its UI. In this example, `<AgentDock>` renders the approval panel. A custom host can use the runtime's approval queue directly, but it should preserve the same rule: execute only after an affirmative decision.

Do not build the application so that an action first mutates data and then asks for confirmation. Approval is a precondition, not a post-hoc message.

## Handoff means the framework will not click for the user

The release action in this example declares a handoff:

```ts
handoff: {
  reason: 'The user must confirm the verification code before publishing.',
  steps: [
    { text: 'Enter 246810 in the verification-code field.', highlight: 'verification_code' },
    { text: 'Select “Publish changes” to complete the confirmation.', highlight: 'publish_changes' },
  ],
  expect: {
    desc: 'The workspace changes are published',
    check: () => published.value,
  },
}
```

When the model invokes `publish_changes`, the executor skips the action's `run` function. It emits a handoff request with the reason and steps, highlights the current target, and waits for one of three results:

| Result | Error code | Meaning |
| --- | --- | --- |
| User completes the step | none | `expect` must pass before success is reported |
| User cancels | `HANDOFF_CANCELLED` | The step did not happen |
| Timeout | `HANDOFF_TIMEOUT` | No completion was confirmed |

The default timeout is five minutes. An action can override it in its own handoff declaration. A timeout is not a failure to retry automatically; the model should ask the user what to do next.

Always include `expect` when the outcome can be checked. Otherwise the user's “I completed it” is only an assertion. The check should read the real business state, not a transient toast.

## Confirmation and handoff are not stacked

An action with a handoff does not also show a separate approval prompt. The person performing the step is already making the decision. Stacking “approve” and “complete” would be repetitive and make it unclear which click actually authorized the change.

The two mechanisms are appropriate for different situations:

| Situation | Mechanism |
| --- | --- |
| The agent may act, but a person should approve first | `confirm` |
| The action is destructive and should always ask | `kind: 'danger'`, optionally `confirm: 'always'` |
| Correct execution requires a person to enter information or use a device | `handoff` |
| The page needs to show which field a person should operate | `v-guide-target` plus handoff steps |

If the agent must decide *what* to do, but a person must perform the final physical or legal step, use handoff. If the agent can perform everything and a person only needs to authorize it, use confirmation.

## Inspect the declarations in the app

Start the example:

```bash
pnpm tutorial:dev v3-15
```

Then:

1. Ask the assistant to save the workspace settings. The first request asks for approval; after allowing it once, a later request in the same conversation can proceed.
2. Ask it to reset the workspace. The runtime asks every time and does not offer “always allow”.
3. Ask it to publish changes. The assistant does not click the form. It explains the handoff and highlights the verification field and publish button.
4. Cancel a handoff. The assistant reports that the step did not complete.
5. Enter `246810`, publish, and let the assistant continue. The verified result is returned only after the page state changes.

Run the deterministic checks with:

```bash
pnpm tutorial:check v3-15
```

They cover the three approval policies, denied execution, cancelled handoff, successful handoff verification, and localized copy.

## Common failure modes

**Using `danger` as a substitute for thinking.** Risk level does not know whether an operation is reversible, regulated, or appropriate for the current user. The declaration must reflect the business.

**Asking for confirmation after side effects.** If the API call already happened, approval is only theater. Put the gate before the mutation.

**Simulating a handoff step.** Do not call `.click()` or fill a CAPTCHA behind the scenes. If a step is declared as human-only, the model should wait or fail closed.

**Omitting the success check.** A handoff without `expect` can report completion when the user only opened the dialog. Check the resulting data, route, or business state.

**Treating a denial as a transient error.** `PERMISSION_DENIED`, `HANDOFF_CANCELLED`, and `HANDOFF_TIMEOUT` are user decisions or boundaries. Do not loop or retry silently.
