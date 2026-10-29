---
id: V2-05
title: "Records and dialogs"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Records and dialogs

An action list is not enough when every row carries its own data. A model needs to know that the page currently contains three tasks, which one is completed, and which row an edit action belongs to. A dialog adds a second problem: its controls should exist only while the dialog is open.

Vue 2's `v-record` exposes one business record per element. The record reads its fields from the same object that the template renders, so a change made by a person or by an action appears in the next registry snapshot.

```ts
directives: [{
  name: "record",
  value: {
    data: task,
    label: copy.recordLabel(task.text),
  },
}]
```

The row still has a stable action id derived from the record id:

```ts
directives: [{ name: "tool", value: {
  id: `edit@${task.id}`,
  desc: copy.editDesc(task.text),
} }]
```

`edit@t2` therefore identifies the operation on the second task, not the second DOM node that happens to exist after a sort.

## Open a dialog through an action

The edit button has no injected `run`. The executor clicks the real button, and the Vue handler sets `editingId`:

```ts
beginEdit(task) {
  this.editingId = task.id;
  this.editText = task.text;
}
```

The dialog is rendered only when `editingId` is set. Its controls are declared as part of that branch:

```vue
<div v-if="editing" role="dialog" aria-modal="true"
     v-scope="{ id: 'edit_dialog', label: 'Edit task', role: 'dialog' }">
  <input v-tool="{ id: 'edit_text', action: 'fill', desc: '...' }" />
  <button v-tool="{ id: 'edit_save', desc: '...' }" @click="saveEdit">Save</button>
</div>
```

This gives the model an accurate view of the current page. While the dialog is closed, `edit_save` and `edit_text` are absent. While it is open, the dialog scope describes where they live. When the dialog closes, their registrations are removed with the Vue elements.

The `role="dialog"` and `aria-modal="true"` attributes are for users and assistive technology. They are not a substitute for the Pling scope. The scope tells the capability layer which region is active; the ARIA attributes describe the same region to the browser.

## Keep the edit local to one record

Saving calls the existing Vue mutation:

```ts
saveEdit() {
  const task = this.tasks.find((item) => item.id === this.editingId);
  const text = this.editText.trim();
  if (!task || !text) return;
  task.text = text;
  this.editingId = null;
}
```

The next snapshot returns `text` from the updated object. The changed field in a record is evidence that the business state moved; it is not proof that a server accepted the write. If the app persists through an API, expose that acknowledgement separately.

## Run the example

```bash
pnpm tutorial:dev v2-05
```

Open `http://127.0.0.1:5266/`, or use `--locale zh` and `http://127.0.0.1:5266/?lang=zh`.

```bash
pnpm tutorial:check v2-05
```

The checks open a dialog through `edit@t2`, verify that dialog actions appear, change the record, confirm live fields, and confirm that closing the dialog removes its actions.

## Common failures

**Declaring dialog actions from the page root.** They become visible even when the dialog is closed. Declare them inside the conditional branch that creates the controls.

**Using a dialog as a hidden way to authorize an action.** Opening a dialog is not approval. A destructive action still needs a confirmation policy and a server-side check where the operation is authoritative.

**Forgetting the record label.** The model needs a human-readable name for the row, especially when the rendered text is truncated or contains sensitive values.

**Assuming a scope makes an element visible.** A scope describes a region. Whether its actions are usable also depends on DOM presence, visibility, overlays, preconditions, and the executor's policy.
