---
id: J-03
title: "Quick start: a complete Todo agent on a vanilla page"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Quick start: a complete Todo agent on a vanilla page

This chapter attaches an agent to a Todo page written with ordinary DOM APIs. There is no component tree to hook into and no reactive store to expose. The page already knows how to render rows, fill a draft value, submit the form, and toggle completion. Pling adds the declarations that make those facts usable by a model.

The result is deliberately narrow. The agent can add a task and change the completion state of an existing task. It cannot delete, filter, or operate a control the page did not declare.

## What “first task” means without a framework

Consider:

> Mark the first task as completed and add “Prepare tomorrow's agenda”.

The DOM can tell a browser that three `li` elements exist. It does not tell a model which one is first in the business list, what text each contains, or whether a row is already complete. The page must declare those facts.

| Need | Vanilla declaration |
| --- | --- |
| The Todo module | `pling.scope(todo, { id: "todo", ... })` |
| Each task row | `pling.record(row, { data: task, ... })` |
| The new-task field | `pling.tool(input, { id: "composer_text", action: "fill", ... })` |
| The submit button | `pling.tool(submit, { id: "composer_submit", ... })` |
| A row's completion button | `pling.tool(check, { id: `toggle@${task.id}`, ... })` |

The record id comes from the stable task id, not from the visual position in the DOM. The model can choose `t2`; Pling resolves the matching element-level action.

## Keep the DOM and handlers

The page still creates its own markup and attaches its own events:

```ts
const form = document.querySelector<HTMLFormElement>("[data-composer]")!;
const input = document.querySelector<HTMLInputElement>("[data-new-task]")!;
const submit = document.querySelector<HTMLButtonElement>("[data-submit]")!;

function addTask(): void {
  const text = input.value.trim();
  if (!text) return;
  const task = { id: `t${++sequence}`, text, done: false };
  tasks.unshift(task);
  list.prepend(renderRow(task));
  input.value = "";
  syncSummary();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  addTask();
});
```

The declarations below do not replace `addTask`, `renderRow`, or the click handler. They only tell the agent where those operations live.

## Declare the region

```ts{3-8}
const todo = document.querySelector<HTMLElement>("[data-todo]")!;

const offScope = pling.scope(todo, {
  id: "todo",
  label: copy.regionLabel,
  description: copy.regionDescription,
  role: "main",
});
```

The scope gives all controls inside the Todo module a shared context. The return value is the unsubscribe function; keep it with the page's cleanup list.

## Declare the input and submit button

```ts{1-10,12-17}
const offText = pling.tool(input, {
  id: "composer_text",
  desc: copy.composerTextDesc,
  action: "fill",
  params: [{ name: "text", label: copy.textParamLabel }],
});

const offSubmit = pling.tool(submit, {
  id: "composer_submit",
  desc: copy.composerSubmitDesc,
  available: () => input.value.trim() ? true : copy.submitReason,
});
```

`action: "fill"` is important. A text input is not a click target in the business sense; it accepts a value. The tool's parameters describe that value to the model.

The submit action is initially unavailable because the input is empty. After a fill, the page updates `input.value`, the availability check becomes true, and the action appears. This is the same rule a person encounters through the disabled button.

## Declare each row and its completion control

The row renderer receives a task and creates the row DOM. Attach a record and a tool while the row is created:

```ts{4,11-14,18}
function mountRow(task: Task): HTMLLIElement {
  const row = document.createElement("li");
  const check = document.createElement("button");
  const text = document.createElement("span");

  row.append(check, text);
  text.textContent = task.text;

  const offRecord = pling.record(row, {
    data: task,
    label: copy.recordLabel(task.text),
  });

  const offToggle = pling.tool(check, {
    id: `toggle@${task.id}`,
    desc: copy.toggleDesc(task.text),
  });

  check.addEventListener("click", () => {
    task.done = !task.done;
    syncRow();
    syncSummary();
  });

  return row;
}
```

The record's `data` object includes `id`, `text`, and `done`. The model can therefore read the row before choosing an operation. The tool id includes `task.id`, so two rows do not share the same control identity.

The completion description is intentionally stable: it says the control changes the completion state. The current state belongs in the record, not in a sentence that becomes stale after the click. This also avoids unbinding and rebinding the tool on every visual update.

If a row is ever removed, call `offRecord()` and `offToggle()` before discarding the element. The tutorial fixture does not remove rows, but dynamic lists are covered later.

## Mount the assistant

```ts
const dock = pling.dock({
  title: copy.dockTitle,
  quick: copy.quick,
});
```

The dock is a shared DOM surface. It uses the same registry and agent runtime as the page controls. The quick prompts are text suggestions, not hidden capabilities.

## Teardown is part of the integration

The fixture keeps every unsubscribe function in a list:

```ts
const cleanups: Array<() => void> = [];
cleanups.push(offScope, offText, offSubmit, offRecord, offToggle);

return {
  destroy() {
    for (const cleanup of cleanups.reverse()) cleanup();
    dock.destroy();
    pling.destroy();
  },
};
```

This is not ceremony. A DOM adapter cannot infer when your code discards a node. Explicit cleanup prevents the registry from describing a control that no longer exists.

## Run and verify

From the repository root:

```bash
pnpm tutorial:dev j-03
```

Open `http://127.0.0.1:5241/`. For Chinese, run `pnpm tutorial:dev j-03 --locale zh` and open `http://127.0.0.1:5241/?lang=zh`.

Check:

1. Ask: `Add “Reply to the customer” to my tasks.` The task appears once.
2. Open the activity view. The run should show the input fill and the existing form submission.
3. Toggle the second row through the assistant. Only that row changes state.
4. Ask it to delete or filter. Those capabilities are not present.
5. Reload and confirm the page still behaves normally without the assistant.

## Common failures

| Symptom | Likely cause | Correction |
| --- | --- | --- |
| The model sees an input but cannot submit | The submit action is still unavailable | Ensure the fill updates the real input and the availability function reads that value |
| Clicking on the row does not change the task | The declared element is not the button with the click handler | Pass the actual interactive element to `pling.tool` |
| Two rows share a control | The action id omits the stable task id | Use the id in both the record and the action |
| A removed row remains in the snapshot | The unsubscribe functions were not called | Tie registration and cleanup to the row lifecycle |
| The assistant cannot see filters | Filters were not declared | Expected; declare them only when needed |
| The page keeps working but the agent cannot see it | The declaration is attached after the element is replaced | Attach declarations to the final DOM node and re-register after replacement |

Continue with the data-attribute and dynamic-DOM chapters when they become available.
