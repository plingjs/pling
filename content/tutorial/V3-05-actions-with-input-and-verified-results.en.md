---
id: V3-05
title: "Actions with input and verified results"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Actions with input and verified results

The previous chapter made one agent run observable, but left the composer exposed as two primitive actions: fill `composer_text`, then press `composer_submit`. That path works, yet it asks the model to reproduce a UI sequence instead of calling the operation the person requested. It also splits one business operation across two executions, with no shared place to declare valid input or a finished result.

This chapter replaces only the add path. The page, task list, task region, records, and row toggles from the previous chapter remain. The form is still usable by hand; the form and the assistant now both pass the task text into the same `addTask` function. The declaration adds three things around that function: an argument contract, an availability condition, and a result expectation.

## Why two control actions are not one operation

Consider a request such as “add a task called Reply to the customer”. With the old declarations, the model first needs to know that `composer_text` belongs to the new-task input, fill it, wait for the submit button to become enabled, and then call `composer_submit`. The model is solving the form's interaction order, not the user's request.

This coupling creates three practical costs:

- one business operation consumes several model calls;
- a layout or interaction change can invalidate the tool descriptions without changing the business operation;
- validation and success checks have no natural home, because neither primitive owns the complete operation.

The page already has a function that owns the business operation. The missing piece is a declaration that exposes that function at the same level as the user request.

## Keep the existing page model

The following excerpt keeps the region, records, and row toggle declarations from the previous chapter and adds one business action on the composer. Copy and styling are omitted here; the runnable fixture uses localized strings.

```vue{39-64,82}
<script setup lang="ts">
import { ref } from "vue";
import { AgentDock, type ToolOptions } from "@plingjs/vue";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const MAX_TASKS = 8;
const tasks = ref<Task[]>([
  { id: "t1", text: "Review the launch checklist", done: false },
  { id: "t2", text: "Book the design review", done: false },
  { id: "t3", text: "Send the customer follow-up", done: true },
]);
const draft = ref("");
let sequence = 3;
let lastAddedId: string | null = null;

function addTask(text: string): Task | null {
  const value = text.trim();
  if (!value || tasks.value.length >= MAX_TASKS) return null;

  const task = { id: `t${++sequence}`, text: value, done: false };
  tasks.value.unshift(task);
  return task;
}

function submitDraft(): void {
  if (addTask(draft.value)) draft.value = "";
}

function toggleTask(id: string): void {
  const task = tasks.value.find((item) => item.id === id);
  if (task) task.done = !task.done;
}

const addTaskAction = {
  id: "add_task",
  desc: "Add one task to the list using the supplied text.",
  kind: "write",
  params: [
    {
      name: "text",
      label: "Task text, 1–80 characters; it cannot contain only spaces",
      minLength: 1,
      maxLength: 80,
      pattern: /\S/,
    },
  ],
  available: () =>
    tasks.value.length < MAX_TASKS
      ? true
      : `The list is full (${MAX_TASKS} tasks). Remove a task before adding another.`,
  run: ({ text }: Record<string, unknown>) => {
    lastAddedId = addTask(String(text))?.id ?? null;
  },
  expect: {
    desc: "The new task is present in the list",
    check: () =>
      lastAddedId !== null && tasks.value.some((task) => task.id === lastAddedId),
  },
} satisfies ToolOptions;
</script>

<template>
  <main class="page">
    <section
      class="todo"
      v-scope="{
        id: 'todo',
        label: 'Tasks',
        description: 'The task list and the form for adding a new task.',
        role: 'main',
      }"
    >
      <header class="todo__header">
        <h1>Tasks</h1>
      </header>

      <form class="composer" v-tool="addTaskAction" @submit.prevent="submitDraft">
        <label for="new-task">New task</label>
        <input id="new-task" v-model="draft" maxlength="80" autocomplete="off" />
        <button type="submit" :disabled="draft.trim() === '' || tasks.length >= MAX_TASKS">
          Add task
        </button>
      </form>

      <ul class="tasks">
        <li
          v-for="task in tasks"
          :key="task.id"
          v-record="{
            data: task,
            fields: {
              text: task.text,
              status: task.done ? 'completed' : 'open',
            },
          }"
        >
          <label>
            <input
              type="checkbox"
              :checked="task.done"
              v-tool="{
                id: `toggle@${task.id}`,
                desc: `Mark “${task.text}” as ${task.done ? 'open' : 'completed'}.`,
                kind: 'write',
              }"
              @change="toggleTask(task.id)"
            />
            <span>{{ task.text }}</span>
          </label>
        </li>
      </ul>

      <AgentDock title="Todo assistant" />
    </section>
  </main>
</template>
```

Only the highlighted action declaration and the composer's `v-tool` binding are new. The highlighted `add_task` block replaces the two composer primitives; the region, record fields, and row toggle keep the same meaning they had in the previous chapter.

There are still two entry paths, but now one business operation:

```text
Manual:  form submit -> submitDraft() -> addTask()
Agent:   add_task({ text }) -> run()    -> addTask()
```

## What the model sees

The declaration produces a model-facing action descriptor. The model sees the action id, description, risk level, argument schema, and current availability. It does not receive the bodies of `run` or `expect`.

| Field | Purpose | Visible to the model |
| --- | --- | --- |
| `id` | Stable name used in calls, events, and diagnostics | Yes |
| `desc` | What the operation does and what it affects | Yes |
| `kind` | Risk classification used by the execution policy | Yes |
| `params` | JSON Schema generated from the parameter declarations | Yes |
| `available` | Whether the action can run now, with a reason when it cannot | Yes |
| `run` | Page-side boundary that receives validated arguments | No |
| `expect` | Page-side check for the declared result | No |

The id should name an operation, not a piece of UI. `add_task` remains stable if the button text changes from “Add task” to “Create task”. The description should describe the outcome; “click the button” would only restate a mechanism the model no longer needs to choose.

`kind` is a risk classification, not a visual property. `read` observes; `write` changes page or business state; `danger` marks destructive or unusually sensitive operations. The example states `write` explicitly even though it is the fail-closed default.

## Arguments form a contract

The single `text` parameter becomes this JSON Schema:

```json
{
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "description": "Task text, 1–80 characters; it cannot contain only spaces",
      "minLength": 1,
      "maxLength": 80,
      "pattern": "\\S"
    }
  },
  "required": ["text"]
}
```

The rules are part of the declaration rather than prose the model has to remember. Parameters are required by default; `optional: true` is reserved for operations that genuinely accept omission. The `label` explains what a valid value means, and constraints such as `minLength`, `maxLength`, `pattern`, numeric bounds, and enums are visible before the call.

Validation runs before the approval decision and before `run`. A missing or malformed argument therefore does not open a confirmation prompt and cannot reach `addTask`. The model receives `INVALID_PARAMS` with the failed constraint and can correct the call.

Once `params` is declared, `run` receives the whole validated argument object. An atomic action without `params` keeps the primitive-shaped input instead: a click receives no value, fill receives `text`, select receives `value`, and press receives `key`.

## `run` is a boundary, not a second implementation

`run` connects the declared arguments to the application's existing operation. In this example it does three things: read `text`, call `addTask`, and remember the new id for the expectation.

It owns no task state of its own. If task storage, persistence, or synchronization changes later, both the manual form and the agent still enter through `addTask`.

An action that needs no input and whose target is a normal control can omit `run`; the framework performs the declared primitive and the component's existing handler runs. Use `run` when the action needs arguments or when the operation cannot be expressed faithfully through a DOM event. `run` may be asynchronous, and the framework waits for its promise before checking the result.

## Availability describes page state

`available` answers whether the action can run in the current page state. It is not a permission check and not backend authorization. It replaces neither. It exists so the model can tell the difference between “this operation is not allowed” and “this operation cannot be attempted until the list has room”.

Return `true` when the action is available. Return a string when it is not; that reason enters the page snapshot and the `ACTION_UNAVAILABLE` error. With eight tasks, the example reports:

```text
The list is full (8 tasks). Remove a task before adding another.
```

Native conditions still apply. A hidden, disabled, or covered target is unavailable even when `available` returns `true`.

## `expect` checks that the result happened

A resolved `run` proves that the function returned, not that the page reached the intended state. It may still be waiting for a render, animation, or network response.

`expect` makes the intended result explicit:

```ts
expect: {
  desc: "The new task is present in the list",
  check: () =>
    lastAddedId !== null && tasks.value.some((task) => task.id === lastAddedId),
}
```

The framework waits for the check after execution. The default timeout is two seconds; `expect.timeout` can change it. When the check succeeds, the result includes its description. When it times out, the action reports `EXPECTATION_FAILED`, which says that execution happened but the declared result was not observed.

That distinction prevents two opposite mistakes: reporting an unfinished asynchronous operation as a successful no-op, or reporting it as a failed click and inviting a duplicate submission. `expect` is still evidence about page state, not a server acknowledgement, permission check, or audit record.

## Execution result and change evidence

Because the task list is already exposed as records, the framework can compare the page before and after the action. A successful `add_task` returns the verified expectation together with the visible change:

```json
{
  "changed": {
    "observed": true,
    "records": {
      "added": ["t4"],
      "removed": [],
      "updated": [],
      "reordered": false,
      "omitted": { "added": 0, "removed": 0, "updated": 0 },
      "total": { "from": 3, "to": 4 }
    },
    "actions": {
      "added": ["toggle@t4"],
      "removed": [],
      "omitted": { "added": 0, "removed": 0 }
    }
  }
}
```

The evidence answers a narrower question than `expect`. `expect` says that the declared business predicate became true. `changed` says which exposed records and actions differ between the two snapshots. Neither proves that the change was correct or complete. The later records chapter examines row-action folding and the limits of this evidence in detail.

The three failure results in this chapter remain distinct:

| Result | Meaning | What has already happened |
| --- | --- | --- |
| `INVALID_PARAMS` | An argument is missing or violates the declaration | Neither approval nor the business operation ran |
| `ACTION_UNAVAILABLE` | A page or business precondition is false | The business operation did not run; the reason is included |
| `EXPECTATION_FAILED` | Execution completed, but the declared result was not observed | `run` may have changed the page; retrying blindly may duplicate the operation |

## Verify the chapter example

From the repository root:

```bash
pnpm tutorial:dev v3-05
```

Open `http://127.0.0.1:5198/`. For the Chinese interface, use `pnpm tutorial:dev v3-05 --locale zh` and `http://127.0.0.1:5198/?lang=zh`.

Check these paths:

1. Enter `Reply to the customer` in the form and submit it. The task should appear at the top and the input should clear.
2. Ask the assistant: `Add “Prepare tomorrow's agenda” to my tasks.` The run should choose `add_task` and supply the text as an argument, not fill and submit two separate controls.
3. Open the **Activity** view. The execution record should show `add_task`, the supplied text, and the verified expectation.
4. Compare the successful result with the record list. The evidence should report the new record (`t4` in a fresh session) and its new `toggle@t4` action.
5. Ask the assistant to mark `Book the design review` as completed. This confirms that the row toggle introduced earlier still shares the same record model.
6. Add tasks until the list contains eight entries, then request another. The action should remain declared but report the full-list reason instead of changing the page.
7. Reload the page to restore the initial three tasks.

## Next step

The add operation now has one model-facing identity, validated input, an availability condition, and a stated result. The next problem is narrower: which DOM element actually receives a declared interaction when the control is native, wrapped by a component, or selected from a component with several possible targets?

The next chapter, [Real controls and custom components](/vue/real-controls-and-custom-components), follows the same Todo application through a native priority selector, a custom search field, and a component with several filter buttons.
