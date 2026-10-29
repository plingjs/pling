---
id: RCP-05
title: "Dangerous actions and confirmation"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Dangerous actions and confirmation

“Ask before deleting” is not one feature. It combines a risk declaration, a user-interface approval, a server-side authorization check, and an audit trail. Pling can coordinate the first two. It cannot replace the last two.

This recipe defines a delete operation that is always confirmed, surfaces the decision to the host application, and still fails safely when the user rejects it.

## Runnable page

The report page below declares archive as a danger action and asks again on every call. Rejection never reaches the business handler; approval runs it once.

<DemoPlayground id="recipe-danger-confirm" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-danger-confirm/`. The source is in `examples/demos/recipe-danger-confirm/`; local state is enough to observe the confirmation boundary, so no backend is required.

## Mark the risk

`kind` describes the nature of the action. `confirm` overrides the default approval policy for that action.

| Declaration | Meaning |
| --- | --- |
| `kind: "danger"` | The action is destructive, irreversible, or unusually broad |
| `confirm: true` | Ask before execution, using the application's approval channel |
| `confirm: "always"` | Ask on every invocation and do not offer a session-wide “always allow” choice |
| `handoff` | The user must perform the step themselves; the framework does not run it |

The default policy is `defaultApproval: "danger"`: read and write actions run directly, danger actions ask. `confirm: true` can also be used on a read action whose result is unusually sensitive, such as exporting all customer data.

## A delete action

### Vue 3

```vue
<button
  v-tool="{
    id: `delete_order@${order.id}`,
    desc: `Delete order ${order.id} for ${order.customer}`,
    kind: 'danger',
    confirm: 'always'
  }"
  @click="deleteOrder(order)"
>
  Delete
</button>
```

### React

```tsx
function DeleteButton({ order }: { order: Order }) {
  const remove = usePlingTool<HTMLButtonElement>({
    id: `delete_order@${order.id}`,
    desc: `Delete order ${order.id} for ${order.customer}`,
    kind: "danger",
    confirm: "always",
  });

  return <button ref={remove} onClick={() => deleteOrder(order)}>Delete</button>;
}
```

### Vanilla / jQuery

```ts
pling.tool(deleteButton, {
  id: `delete_order@${order.id}`,
  desc: `Delete order ${order.id} for ${order.customer}`,
  kind: "danger",
  confirm: "always",
});

$(deleteButton).on("click", () => deleteOrder(order));
```

### Vue 2.7

```vue
<button
  v-tool="{
    id: `delete_order@${order.id}`,
    desc: `Delete order ${order.id} for ${order.customer}`,
    kind: 'danger',
    confirm: 'always'
  }"
  @click="deleteOrder(order)"
>
  Delete
</button>
```

The visible button and the agent call the same business function. That function must authenticate the user and check whether this order may be deleted. The confirmation shown in chat is not a substitute for that check.

## Approval channel

The built-in surfaces render a pending approval with the action description and risk kind. They do not show the raw `request.args`. If the approver must inspect business values, provide a custom approval surface that renders a bounded, masked view of those values. The user can approve once, reject, or in some cases choose “always allow” for the current session. `confirm: "always"` removes that last option for the individual action.

The runtime's `gate` controls whether this approval channel exists at all:

```ts
const pling = createPling({
  agent: {
    gate: () => approvalUiAvailable.value,
    approvalTimeoutMs: 60_000,
  },
});
```

If the gate returns `false`, every action executes without waiting, including danger actions. Use that only for a trusted automation context where confirmation is supplied by another layer. Do not disable the gate merely to make a demo smoother.

An approval that times out is treated as rejection. A closed dialog, a lost session, or a navigation during approval must also fail closed.

## Confirmation versus handoff

Use confirmation when the agent can perform the operation and the user only needs to approve it. Use handoff when the user must perform a step the agent cannot safely simulate.

```vue [Vue 3]
<button
  v-tool="{
    id: 'submit_export',
    desc: 'Submit the export after the owner enters the one-time code',
    kind: 'danger',
    handoff: {
      reason: 'Enter the one-time code and submit the export yourself',
      expect: {
        desc: 'The export job exists',
        check: () => exportJobId !== null
      },
      timeout: 300000
    }
  }"
  @click="submitExport()"
>
  Submit export
</button>
```

```tsx [React]
function SubmitExportButton() {
  const submit = usePlingTool<HTMLButtonElement>({
    id: "submit_export",
    desc: "Submit the export after the owner enters the one-time code",
    kind: "danger",
    handoff: {
      reason: "Enter the one-time code and submit the export yourself",
      expect: { desc: "The export job exists", check: () => exportJobId !== null },
      timeout: 5 * 60_000,
    },
  });

  return <button ref={submit} onClick={() => submitExport()}>Submit export</button>;
}
```

```ts [Vanilla / jQuery]
pling.tool(submitButton, {
  id: "submit_export",
  desc: "Submit the export after the owner enters the one-time code",
  kind: "danger",
  handoff: {
    reason: "Enter the one-time code and submit the export yourself",
    expect: { desc: "The export job exists", check: () => exportJobId !== null },
    timeout: 5 * 60_000,
  },
});

submitButton.addEventListener("click", () => submitExport());
```

```vue [Vue 2.7]
<button
  v-tool="{
    id: 'submit_export',
    desc: 'Submit the export after the owner enters the one-time code',
    kind: 'danger',
    handoff: {
      reason: 'Enter the one-time code and submit the export yourself',
      expect: { desc: 'The export job exists', check: () => exportJobId !== null },
      timeout: 300000
    }
  }"
  @click="submitExport()"
>
  Submit export
</button>
```

In all four adapters, the agent receives one action and execution pauses until the user marks the human step complete or the request times out. `handoff` is an element-tool option, not a function-tool option; use a real control or an application-defined wrapper rather than pretending the action can run itself.

The click handler remains the user's real business step. `handoff` pauses the agent; it does not replace the button's own submit logic or prove that the submission succeeded. The `expect` condition is what checks the result.

## What to log

The host-side audit record should contain at least:

- action id and human-readable description;
- arguments after masking sensitive values;
- requesting user and session id;
- approval decision, timestamp, and deciding principal;
- execution result or rejection reason;
- the page or route where the request occurred.

The approval policy receives the request and returns a decision, but Pling does not persist an audit record. The UI event stream is useful for debugging and is not an immutable audit log. Persist approval decisions and results outside the browser when the operation has legal, financial, or security consequences.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| A delete runs without a prompt | The action was classified as `read` or `write`, `confirm` was disabled, or the gate is off | Mark the action `danger` and `confirm: "always"` |
| The model says “deleted” after rejection | The result path treated a rejected promise as success | Return the rejection unchanged and require `expect` |
| The same destructive action keeps asking | `confirm: "always"` is intentional | Use the session-level approval option only where policy allows it |
| Approval appears, but the server performs the delete twice | Retry or double-submit is not idempotent | Use an idempotency key and disable the action while running |
| A user approves the wrong row | Description lacks business identity | Include the record id and a recognizable label in `desc` |
| The action is hidden behind a modal but still callable | Region visibility was not declared | Put the control in the dialog scope and mark the underlying region inactive |

## Security boundary

Approval answers “did the person operating this session agree to this call?” It does not answer “is this person authorized to delete this record?” The server must check identity, tenant, role, object ownership, and current state.

Confirmation text must come from the application, not from model-generated prose. Otherwise a prompt injection can describe a harmless action while the actual arguments perform a destructive one.

## Evidence

- Approval queue and timeouts: `packages/agent/src/approval-queue.ts`.
- Confirmation policy: `packages/core/src/policy.ts`.
- Runnable source for this recipe: `examples/demos/recipe-danger-confirm/`.

## Local verification

Ask the assistant to archive `RPT-31`, reject the first confirmation, and verify that the report remains. Repeat and allow it. The result log should gain one entry only after approval, and each decision should remain tied to its own request rather than to the model's prose.

