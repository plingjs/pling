---
id: J-07
title: "Forms, async updates, and dialogs"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Forms, async updates, and dialogs

An edit form introduces two problems that a simple click does not. The dialog's controls should exist only while it is open, and a save may finish after the click has already returned. Reporting success too early gives the model a false picture of the page.

The example opens a dialog from a row action, registers its controls when it becomes visible, and waits for the saved value to appear before the save step succeeds.

## Open the dialog through the existing row action

Each row has an edit button with a stable id:

```ts
pling.tool(editButton, {
  id: `edit@${task.id}`,
  desc: `Edit “${task.text}”.`,
});
```

Clicking it runs the same `openEdit` function a person uses. That function fills the form and reveals the dialog. It does not mutate the task yet.

## Register the dialog only while it is open

The dialog begins hidden. `openEdit` declares its scope and controls at the moment it becomes visible:

```ts
dialogCleanups = [
  pling.scope(dialog, {
    id: "edit_dialog",
    label: "Edit task",
    role: "dialog",
  }),
  pling.tool(editText, {
    id: "edit_text",
    desc: "Enter the updated text for this task.",
    action: "fill",
    params: [{ name: "text", label: "Task text" }],
  }),
  pling.tool(saveButton, { id: "edit_save", desc: "Save the edited task text." }),
  pling.tool(cancelButton, { id: "edit_cancel", desc: "Close the dialog without saving." }),
];
```

`closeDialog` calls every function in reverse order before hiding the element. This is the same ownership rule as a dynamic row, applied to a temporary surface. A dialog that is hidden by CSS but remains registered is still visible to the model.

## Wait for the asynchronous result

The save button submits the form, but the page simulates persistence with a short delay:

```ts
async function saveEdit(): Promise<void> {
  const id = editingId;
  const text = editText.value.trim();
  if (!id || !text) return;

  editStatus.textContent = "Saving…";
  await new Promise((resolve) => setTimeout(resolve, 80));

  const task = tasks.find((candidate) => candidate.id === id);
  if (!task) return;
  task.text = text;
  lastSaved = { id, text };
  closeDialog();
  replaceRow(task);
}
```

The tool declares an expectation, not merely a click:

```ts
expect: {
  desc: "The task text has been updated and the dialog has closed.",
  check: () => lastSaved?.id === task.id && editingId === null,
  timeout: 2_000,
}
```

The executor waits for this condition before returning a successful result. If the page shows “Saving…” forever, the model receives an expectation failure instead of a false success. This is useful for any action whose business effect arrives after the event handler returns.

## Rebind the row after the text changes

The record label and edit description contain the task text. After saving, the example replaces the row and registers it again:

```ts
function replaceRow(task: Task): void {
  const entry = rows.get(task.id);
  if (!entry) return;
  for (const cleanup of entry.cleanups.reverse()) cleanup();
  rows.delete(task.id);
  const replacement = mountRow(task, false);
  entry.element.replaceWith(replacement);
}
```

This keeps the visible label, record fields, and action descriptions consistent. If only the text node were changed, the record could still carry the old field value until the next live read.

## Run the example

```bash
pnpm tutorial:dev j-07
```

Open `http://127.0.0.1:5272/`, or use `--locale zh` and `http://127.0.0.1:5272/?lang=zh`.

```bash
pnpm tutorial:check j-07
```

The check opens `edit@t2`, verifies that dialog actions appear, fills `edit_text`, saves, waits for the asynchronous record update, and confirms that all dialog actions disappear after close.

## Common failures

**Declaring dialog actions at page startup.** They remain available after the dialog closes. Bind them in the open path and unbind them in the close path.

**Returning success immediately after the click.** The form may still be saving. Expose a result the page can check and declare it with `expect` when the wait is bounded.

**Keeping the old row record after an edit.** Rebinding the row updates labels and descriptions that contain the new value.

**Using a hidden dialog as a confirmation step.** Visibility is not approval. Destructive operations still need the confirmation policy and server-side authorization.

Next: [Mount the assistant UI](/vanilla/mount-the-assistant-ui).
