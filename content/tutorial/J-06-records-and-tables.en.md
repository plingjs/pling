---
id: J-06
title: "Records and tables"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Records and tables

An HTML table groups cells visually. It does not tell a model which row is the same business object after a sort, which cell is its stable key, or which button changes only that row. A record adds that meaning without replacing the table.

The example keeps a semantic `<table>` and declares each `<tr>` as one task record:

```html
<table class="tasks">
  <thead>
    <tr><th scope="col">Task</th><th scope="col">Status</th><th scope="col">Complete</th></tr>
  </thead>
  <tbody data-tasks></tbody>
</table>
```

The header explains the columns to a person. The record below explains the row to the assistant:

```ts
pling.record(row, {
  data: task,
  label: `Task: ${task.text}`,
});
```

`task` is the same object that supplies the text and status cells. If a person toggles the task, the next snapshot reads the new `done` value rather than a copy made at mount time.

## Use a stable business key

The task's id, not its row index, anchors the record and its action:

```ts
pling.tool(check, {
  id: `toggle@${task.id}`,
  desc: `Change the completion state of “${task.text}”.`,
});
```

After a sort, a filter, or an insertion, `t2` still means the same task. `row-1` would not. This is particularly important for tables because their visual order changes more often than their business identity.

## Separate the displayed cell from the record field

The status cell renders a human label such as “Open” or “Done”. The model receives the record's `done` boolean, which is the value the business logic uses. That avoids asking the model to infer state from translated text.

The table can display additional columns without exposing all of them. When a column contains sensitive data, do not put it in the record by default; mark its value explicitly with the sensitivity helpers described in the sensitive-data chapter.

## Row actions belong to the row

The completion button is inside the row and receives the stable task id. Its description identifies the exact task, while the record carries the current state. The combination lets the model choose a row and perform an operation without guessing from cell position.

Do not encode “mark complete” as a writable record field. Records are read-only. A mutation must be an action with its own availability, policy, and evidence.

## Run the example

```bash
pnpm tutorial:dev j-06
```

Open `http://127.0.0.1:5271/`, or use `--locale zh` and `http://127.0.0.1:5271/?lang=zh`.

```bash
pnpm tutorial:check j-06
```

The check confirms the table renders three records with stable ids, the row action toggles its own record, and adding a task through the form produces a fourth row with matching declarations.

## Common failures

**Putting the record on the table instead of the row.** The model then sees one large object and cannot identify which action belongs to which business item.

**Using the visible row number as the id.** Sorting and deletion break it. Use the database or business key.

**Exposing only the visible cell text.** The model may need the underlying status value, not a translated label. Keep the business value explicit and stable.

**Forgetting to remove a record when the row is destroyed.** A table refresh must clean up the old row declarations, just like any other dynamic list.

Next: [Forms, async updates, and dialogs](/vanilla/forms-async-updates-and-dialogs).
