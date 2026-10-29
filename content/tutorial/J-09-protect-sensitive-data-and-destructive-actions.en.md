---
id: J-09
title: "Protect sensitive data and destructive actions"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Protect sensitive data and destructive actions

A support queue usually contains two kinds of risk at once. Some fields are private even though the assistant needs to work with them. Some actions change or remove data and should not follow a single click from a model without an explicit decision by the person using the page.

The example handles both cases in the same table. The model can call the account owner without receiving the phone number, and it can clear completed tasks only after the destructive action has passed the confirmation gate.

## Keep private values out of the observation

The account and note are useful context. The phone number is also necessary for one action, but sending it to the model would expose it in every request, in conversation history, and in any diagnostic transcript.

Declare each field according to what the model needs to do with it:

```ts
pling.record(row, {
  data: task,
  id: task.id,
  label: copy.recordLabel(task.text),
  fields: {
    text: task.text,
    done: task.done,
    phone: sensitive(task.phone, "token"),
    account: sensitive(task.account, {
      mode: "masked",
      mask: (value) => String(value).replace(/^(.{3}).*(.{4})$/, "$1****-$2"),
    }),
    internalNote: sensitive(task.internalNote),
  },
});
```

The three modes answer different questions:

| Mode | What the model receives | When it fits |
| --- | --- | --- |
| `token` | A stable reference such as <code v-pre>{{p:…}}</code> that the runtime can restore for a declared action | The model must pass the value to an operation |
| `masked` | A partial value, using the default shape or a supplied mask | A person or model needs to recognize the record without reading the full value |
| `hidden` | `[hidden]`, with the field name still present | The model only needs to know that the field exists |

`token` is not encryption. It keeps the value out of model context while allowing a declared action to use it. The runtime restores the token after argument validation and before the business function runs. A made-up token is rejected rather than passed through.

## Use the token in a narrow action

The call control accepts the phone number as an explicit parameter:

```ts
pling.tool(call, {
  id: `call@${task.id}`,
  desc: copy.callDesc(task.text),
  kind: "read",
  params: [{ name: "phone", label: copy.phoneParamLabel }],
  run: (args) => {
    lastCall = String(args.phone);
    callStatus.textContent = copy.called(lastCall.slice(-4));
  },
});
```

The model sees the token in the record and can pass the same token into `phone`. The page receives the real value only inside `run`. The visible confirmation shows the last four digits, so demonstrating the page does not reveal the full number on screen.

A token should not make an action broader than the business operation requires. Do not expose an arbitrary `dial(number)` action. Declare the specific row operation, keep its target scoped to the record, and leave authorization to the backend that owns the account.

## Treat removal as a different kind of decision

Changing a completion state is reversible. Clearing every completed task is not. The clear button therefore declares both consequences and confirmation requirements:

```ts
pling.tool(clearButton, {
  id: "clear_completed",
  desc: copy.clearDesc,
  kind: "danger",
  confirm: "always",
  available: () => tasks.some((task) => task.done)
    ? true
    : "There are no completed tasks to clear.",
  run: () => removeCompleted(),
});
```

`kind: "danger"` tells the runtime that the operation can be destructive. `confirm: "always"` prevents a session-wide approval from covering a later invocation. The action remains visible only while there is something to clear.

Confirmation is not a substitute for authorization. It records that a person approved this invocation in the page. The backend still has to check whether that person may delete the records, and whether the records may be deleted at all.

## Remove the declarations with the rows

When the clear operation removes a row, it must also remove the row's record and actions:

```ts
function removeRow(task: Task): void {
  for (const cleanup of rowCleanups.get(task.id)?.reverse() ?? []) cleanup();
  rowCleanups.delete(task.id);
  rows.get(task.id)?.remove();
  rows.delete(task.id);
}

function removeCompleted(): void {
  for (const task of tasks.filter((candidate) => candidate.done)) removeRow(task);
  for (let index = tasks.length - 1; index >= 0; index -= 1) {
    if (tasks[index]?.done) tasks.splice(index, 1);
  }
  syncSummary();
}
```

Removing only the DOM row leaves stale records and callable actions in the registry. The model would then see a task that no longer exists, or invoke a phone action whose target has already been removed.

## Run the example

```bash
pnpm tutorial:dev j-09
```

Open `http://127.0.0.1:5274/`, or use `--locale zh` and `http://127.0.0.1:5274/?lang=zh`.

Ask the assistant to contact the owner of the first task. Then ask it to clear completed tasks; the destructive action should require approval. The activity view shows the declared action and its result without printing the raw phone number.

```bash
pnpm tutorial:check j-09
```

The checks cover four boundaries: the observation contains a token, mask, and hidden value rather than the originals; the token is restored only inside the declared action; the dangerous action is always confirmed; and a denied or approved invocation produces the corresponding result.

## Common failures

**Marking every field as hidden.** The model then cannot identify the record or use the value in a permitted operation. Decide per field whether it needs the value, a partial form, or only its existence.

**Putting a sensitive value in a label or description.** Records are not the only outbound surface. Action descriptions, region descriptions, errors, and state keys must follow the same rule.

**Using `kind: "danger"` without a confirmation policy.** The risk level helps the runtime choose a policy, but an explicit `confirm` value makes the intent of a destructive operation unambiguous.

**Assuming the confirmation dialog is authorization.** It is a human decision at the page boundary. The server remains the authority for identity, scope, and business rules.

Next: [Connect vanilla pages to the model gateway](/vanilla/connect-vanilla-pages-to-the-model-gateway).
