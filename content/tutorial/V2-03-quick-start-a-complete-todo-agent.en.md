---
id: V2-03
title: "Quick start: a complete Todo agent"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Quick start: a complete Todo agent

This chapter starts with a working Vue 2.7 Todo page and makes a small, complete capability surface: the task region, the task records, the new-task input, submission, and completion controls. The business page still adds and toggles tasks through its original Vue handlers.

Consider a request such as “mark the first task complete and add two tasks.” The assistant needs three kinds of information:

1. The task area is a meaningful region.
2. The rows are records with stable ids, text, and completion state.
3. The input, submit button, and completion buttons are the operations that can change those records.

A bare DOM tree can show text, but it cannot reliably decide which button means “complete this task” or which row remains the same after a sort. The declarations supply that missing business meaning.

## Describe the region and the rows

The outer section names the page area. The list names its parent, so an action inside a row has a location that a model can reason about:

```vue
<section v-scope="{ id: 'todo', label: 'Tasks', role: 'main' }">
  <ul v-scope="{ id: 'todo_list', label: 'Task list', role: 'list', parent: 'todo' }">
    <li v-for="task in tasks" :key="task.id" v-record="{ data: task, label: `Task: ${task.text}` }">
      ...
    </li>
  </ul>
</section>
```

The record is backed by the same object that the list renders. When a user toggles a task, the next snapshot reads the updated `done` value from that object.

## Declare the controls

The input declares a fill primitive, not a replacement for the Vue input handler:

```vue
<input
  v-model="draft"
  v-tool="{ id: 'composer_text', desc: 'Enter the text for a new task.', action: 'fill',
            params: [{ name: 'text', label: 'Task text' }] }"
/>
```

The submit button stays a normal submit button. Its declaration adds the business description and availability condition:

```vue
<button
  type="submit"
  :disabled="!draft.trim() || tasks.length >= 8"
  v-tool="{ id: 'composer_submit', desc: 'Add the text in the new-task field to the list.',
            available: submitAvailable }"
>
  Add task
</button>
```

Each row's completion control has an id derived from the stable task id:

```vue
<button v-tool="{ id: `toggle@${task.id}`, desc: toggleDescription(task) }" @click="toggleTask(task.id)">
  {{ task.done ? '✓' : '' }}
</button>
```

The id keeps its meaning when the list changes. `toggle@t2` identifies a particular business record, not the second DOM node at a given moment.

## Mount the assistant

The dock is created once, after the Vue instance mounts:

```ts
mounted() {
  this.dock = pling.dock({
    title: "Todo assistant",
    quick: [
      "Add “Prepare tomorrow’s agenda” to my tasks",
      "Mark the first task as completed",
    ],
  });
}
```

The quick prompts are suggestions, not privileged commands. The assistant still has to resolve the current region, records, and actions before it can act.

## Run the example

```bash
pnpm tutorial:dev v2-03
```

Open `http://127.0.0.1:5243/`. The Chinese interface is available with `pnpm tutorial:dev v2-03 --locale zh` at `http://127.0.0.1:5243/?lang=zh`.

```bash
pnpm tutorial:check v2-03
```

The deterministic test confirms the task region, the three records, the declared controls, adding a task through the real input and submit handlers, and toggling a task through its row action.

## Limits in this example

The page intentionally does not expose deletion, editing, or a server acknowledgement. Those operations need more than an additional click: they need stable records, a confirmation boundary, persistence, and evidence about whether the write reached the system of record.

Next: [Directive-based actions](/vue2/directive-based-actions).
