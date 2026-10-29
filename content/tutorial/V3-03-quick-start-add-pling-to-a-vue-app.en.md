---
id: V3-03
title: "Quick start: a complete Todo agent"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Quick start: a complete Todo agent

A working conversation is not yet a working page agent. A model may understand “mark the design review as completed” without knowing which tasks exist, what each row represents, or which safe entry points can change the page.

This chapter builds the first usable path through a complete Todo application. The page keeps its original business code. The integration adds four kinds of information: which region contains the task module, what each row contains, which operations the agent may use, and where the assistant entry lives.

By the end, the assistant can add a task and complete an existing task by its content. It still cannot operate every button on the page. That boundary is part of the result.

## What this chapter builds

The starting point is a working Vue 3 + Vite project. It already has a task list, an add form, completion checkboxes, filters, and deletion. The model connection was configured in the previous chapter.

The integration in this chapter consists of five pieces:

1. one shared Pling instance at the application entry;
2. a `v-scope` declaration for the task region;
3. a `v-record` declaration for every task row;
4. `v-tool` declarations on the input, submit button, and completion checkbox;
5. an `<AgentDock>` assistant entry.

The task data, `addTask`, `toggleTask`, form submission, and layout are not rewritten. The agent operates existing controls and ends in the same business functions as a person.

## Install and prerequisites

Install the Vue adapter and import the published stylesheet once at the application entry:

| Package manager | Command |
| --- | --- |
| pnpm | `pnpm add @plingjs/vue` |
| npm | `npm install @plingjs/vue` |
| Yarn | `yarn add @plingjs/vue` |

```ts
import "@plingjs/vue/style.css";
```

The endpoint, model name, and authentication remain as configured in [Installation and model configuration](/vue/installation-and-model-configuration). This chapter does not repeat model setup.

## Create one runtime at the application entry

Create the Pling instance where the Vue application is created, then install its plugin:

```ts{2,3,6,8}
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";

const pling = createPling();

createApp(App).use(pling.plugin).mount("#app");
```

`createPling()` owns the page capability registry. `pling.plugin` registers the Vue directives and exposes the same instance to the assistant.

Keep this wiring at the application entry rather than in each business component. A page has one capability registry; multiple instances would give the page, records, and assistant different views of what exists.

## Leave the business code in place

The Todo state remains ordinary Vue state:

```ts
interface Task {
  id: string;
  text: string;
  done: boolean;
}

const tasks = ref<Task[]>([
  { id: "t1", text: "Review the launch checklist", done: false },
  { id: "t2", text: "Book the design review", done: false },
  { id: "t3", text: "Send the customer follow-up", done: true },
]);

function addTask(text: string): Task | null {
  const value = text.trim();
  if (!value || tasks.value.length >= 8) return null;

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
```

Adding a task still goes through `draft`, `submitDraft`, and `addTask`. Completion still goes through `toggleTask`. The declarations below do not create a second implementation for the agent.

## Start from one request

Consider this request:

> Mark the first task as completed, and add a task to go to bed at 10.

The sentence names no page element, yet it contains two concrete operations. To turn it into executable steps, the model needs at least three pieces of information.

| What the model needs | The fact on this page | Declared by |
| --- | --- | --- |
| Which module is the task region, and what it owns | The task list and add form are in the `todo` region | `v-scope` |
| Which task is “the first”, and its current state | `t1` in the current list, “Review the launch checklist”, status `open` | `v-record` |
| Which operations are available, and which control each one targets | Fill a new task, submit the form, toggle `t1` | `v-tool` |

With that information, the model can map the request onto real controls:

```text
toggle(record: "t1")                   -> the checkbox for the first task
composer_text(text: "Go to bed at 10") -> the new-task input
composer_submit()                      -> the Add task button
```

If `t1` is already completed, the record's `status` and the action description tell the model that the same control would now reopen the task rather than complete it. Each action is declared on an existing control, so the execution target is the actual input, button, or checkbox, not a separate set of commands invented by the framework.

The next three sections add the region, the records, and the actions. The business code does not change.

## Describe the task region

A real page has a header, filter bar, task list, dialogs, and other regions. A person can tell which “confirm” button belongs to the payment dialog. A model that receives only a flat action list may not be able to make the same distinction.

Place the task list and the add form in a named region:

```vue{2-5}
<section
  v-scope="{
    id: 'todo',
    label: 'Tasks',
    description: 'The task list and the form for adding a new task.',
    role: 'main',
  }"
>
  <!-- Task list and add form -->
</section>
```

The declaration enters the model's page context. It tells the model that the actions below belong to one task module and that the module is responsible for reading and changing tasks.

`role` is a structural hint, not permission. `v-scope` does not expose the controls inside it; each operation still needs an explicit declaration.

On a page with one list, the region can look optional. Once several similarly named buttons appear, it becomes one of the main signals the model uses to choose the right target. Full region semantics are covered later.

## Make each row a readable record

An id such as `toggle@t2` says that a checkbox can be clicked, but not what `t2` means. The model needs the business fields for each row:

```vue{5-11}
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
    <!-- Task content and completion checkbox -->
  </li>
</ul>
```

The record id comes from `task.id`. The model receives a compact row view:

```text
t1: text Review the launch checklist; status open
t2: text Book the design review; status open
t3: text Send the customer follow-up; status completed
```

The developer chooses the fields. Do not dump the whole object into context, and do not scrape text from the DOM. `status: 'completed'` is easier to interpret than `done: false`, while internal flags and unrelated data do not need to leave the page.

Records are read-only views. Changing a task still requires a declared operation.

## Open three existing controls

### Fill the new task

The input keeps its original `v-model` and gains an action declaration:

```vue{4-8}
<input
  id="new-task"
  v-model="draft"
  v-tool="{
    id: 'composer_text',
    desc: 'Enter the text for a new task in this field.',
    kind: 'write',
  }"
  autocomplete="off"
/>
```

`id` is the stable name used by model calls, tests, and execution records. `desc` explains what the control does and where its boundary lies. `kind` marks this step as an operation that changes page state.

### Submit the new task

The submit button keeps the existing form handler:

```vue{4-8}
<button
  type="submit"
  v-tool="{
    id: 'composer_submit',
    desc: 'Add the text in the new-task field to the task list.',
    kind: 'write',
  }"
  :disabled="draft.trim() === ''"
>
  Add task
</button>
```

When the input is empty, the native button is disabled and the model does not see `composer_submit`. After text is entered, the action becomes available. No extra availability rule is needed; the control's existing state is the source of truth.

Both steps still use the page's form. When a user asks to add a follow-up task, the model normally calls `composer_text` and then `composer_submit`. It takes an extra round trip, but follows the path a person actually uses. A later chapter combines the two into one business action.

### Complete a task

The completion checkbox already exists. It only needs an id that includes the row identity:

```vue{5-9}
<input
  type="checkbox"
  :checked="task.done"
  @change="toggleTask(task.id)"
  v-tool="{
    id: `toggle@${task.id}`,
    desc: task.done ? `Mark “${task.text}” as open.` : `Mark “${task.text}” as completed.`,
    kind: 'write',
  }"
/>
```

The part after `@` is the record id. Because the page declares `t1`, `t2`, and `t3` through `v-record`, row actions of the same kind are folded into one model-facing tool:

```text
toggle(record)
  Mark “{record}” as completed or open.
  record: t1 / t2 / t3
```

The model chooses a business record; the framework maps it back to the precise element-level action such as `toggle@t2`. Records, folding, and change evidence are covered in full later. For this chapter, the important point is that the model is not guessing an internal element id.

Filters, deletion, and clear-completed remain undeclared. People can still use them; the agent cannot currently see them. `kind` is a readable risk class, not an authorization decision or proof of user consent.

## Mount the assistant entry

Place the assistant entry in the page shell:

```vue{1,5-8}
<script setup lang="ts">
import { AgentDock } from "@plingjs/vue";
</script>

<template>
  <main class="page">
    <!-- Todo page -->
    <AgentDock title="Todo assistant" :quick="['Mark the first task as completed, then create two tasks of your choosing']" />
  </main>
</template>
```

`AgentDock` supplies the launcher, conversation, execution status, and run history. The `quick` items are shortcuts for people; they do not create actions or change the existing conversation.

This shortcut completes the current first task, then lets the model choose two new tasks. It is a compact way to observe one request expanding into several page operations.

The assistant does not live inside the Todo business component. Changing its placement, layout, or theme later does not require changing task state or capability declarations.

## Scope of change

| Place | Change |
| --- | --- |
| Application entry | Create the Pling instance, install the Vue plugin, import the stylesheet |
| Task region | Add one `v-scope` description |
| Each task row | Add `v-record` with text and completion status |
| Input and submit button | Add two explicitly named `v-tool` declarations |
| Completion checkbox | Add one `v-tool` with row identity |
| Page shell | Mount `<AgentDock>` |

The following remain unchanged:

- the task array and seed data;
- `addTask`, `submitDraft`, and `toggleTask`;
- form submission, filters, deletion, and clear-completed;
- the page layout and styles;
- every control without a declaration.

## Run and verify

Start the chapter fixture from the repository root:

```bash
pnpm tutorial:dev v3-03
```

Open:

```text
http://127.0.0.1:5196/
```

Check the following:

1. Open the Todo assistant and send: `Add “Reply to the customer” to my tasks.`
2. The task appears once and is created through the original `addTask`.
3. Click the quick prompt: `Mark the first task as completed, then create two tasks of your choosing.`
4. The current first task becomes completed, and its record status changes from `open` to `completed`. Two tasks chosen by the model are also added through the original `addTask`.
5. Open **Activity**. Completion shows one record-level `toggle` call; each added task shows a fill step and a submit step.
6. Ask the assistant to delete or filter tasks. Those actions are not in the current list.

For the Chinese interface, run `pnpm tutorial:dev v3-03 --locale zh` and open `http://127.0.0.1:5196/?lang=zh`.

## What happens during a successful run

Adding a task usually takes three model requests: the model selects the input, then the submit button, then answers from the tool result. Completing an existing task is shorter: the model reads the records, calls `toggle`, and confirms the result.

The exact number depends on whether the model issues several tool calls in one response. The important property is that each step is based on the current page snapshot rather than an imagined DOM.

The next chapter opens the read-only run inspector. It shows the system prompt, tool list, assembled messages, and page snapshot the model actually received. When the agent chooses an unexpected action or cannot see an expected control, that is the first place to look.

## Common failures

| Symptom | Likely cause | Correction |
| --- | --- | --- |
| `Failed to resolve directive: tool` | The Vue plugin was not installed | Call `.use(pling.plugin)` at the entry |
| The model can chat but cannot see the input action | The input has no `v-tool`, or the id is duplicated | Check the declaration and page-level uniqueness |
| Submit disappears after the input is filled | The button is disabled while the field is empty | Fill the field first; availability follows the native control |
| The model changes the wrong row | Record fields are incomplete or the action description is vague | Expose `text` and `status`, and describe the target task |
| The model says it cannot delete or filter | Those controls are undeclared | Expected in this chapter |
| Model requests fail | Endpoint, proxy, or key is not configured | Return to the model configuration chapter and restart Vite |

## Next step

The page now has a complete, usable agent path, but two limits remain. Adding still takes a fill step and a submit step, and success is inferred from page changes and the model's answer.

Continue with [Inspect one agent run](/vue/inspect-one-agent-run) to see exactly what the model receives. Later chapters then combine the two interface steps into one business action with arguments and a result expectation.
