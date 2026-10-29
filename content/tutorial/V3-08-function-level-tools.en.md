---
id: V3-08
title: "Function-level tools"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Function-level tools

The previous chapter made the task rows readable. The agent could identify a task by its record id, act on that row, and inspect a before-and-after summary of the exposed page. Every action introduced so far still belonged to a control: a form, a checkbox, a delete button, or a menu item.

Not every business operation has such a control. An application may support marking every open task complete without offering a bulk button, or may have an implementation for exporting the current view that is only reachable through code. The question in this chapter is how to expose that implementation without inventing a fake element and dispatching a synthetic click.

The answer is a **function-level tool**: a declaration whose implementation is an application function, not a DOM interaction. It uses the same action identity, availability, argument validation, policy, execution, expectation, and audit path as an element-bound action. Its differences follow from one fact: there is no target element.

## The operation without a control

The example in this chapter is a bulk operation: mark every open task as completed. The page already provides a checkbox for each row and a menu item for deleting completed tasks. It deliberately has no “complete all open tasks” button.

One possible shortcut is to attach `v-tool` to a hidden button and let the action click it. That shortcut creates problems which are easy to miss:

- the action claims to operate on an element that a person cannot see or reach;
- visibility, obstruction, and scrolling rules now apply to an artificial target;
- the page acquires a control that exists only for the agent, including its keyboard and accessibility surface;
- a change to the button's styling or event handler can break the declared operation even though the business function did not change.

Those problems are not theoretical. Once the framework reports that an action is available because its hidden button exists, the model receives a misleading account of what the page can do. The declaration should describe the operation, not the workaround.

## Keep the page model from the previous chapter

The Todo application keeps its region, records, row actions, filters, and change evidence. The new code adds one plain business function and one tool declaration:

```vue{1-7,42-47,74-89}
<script setup lang="ts">
import { computed, ref } from "vue";
import {
  AgentDock,
  useAgentTool,
  type AgentToolOptions,
} from "@plingjs/vue";

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

const remaining = computed(
  () => tasks.value.filter((task) => !task.done).length,
);

function toggleTask(id: string): void {
  const task = tasks.value.find((item) => item.id === id);
  if (task) task.done = !task.done;
}

function completeOpenTasks(): number {
  const openTasks = tasks.value.filter((task) => !task.done);
  for (const task of openTasks) task.done = true;
  return openTasks.length;
}

const completeOpenTasksAction = {
  id: "complete_open_tasks",
  desc: "Mark every open task as completed. This changes all open records in one operation.",
  kind: "write",
  available: () =>
    remaining.value > 0
      ? true
      : "There are no open tasks. Every task is already completed.",
  run: () => ({ completed: completeOpenTasks() }),
  expect: {
    desc: "No task remains open",
    check: () => remaining.value === 0,
  },
} satisfies AgentToolOptions;

useAgentTool(completeOpenTasksAction);
</script>

<template>
  <section
    v-scope="{
      id: 'todo',
      label: 'Tasks',
      description: 'The task list, the composer, and the controls for finding and filtering tasks.',
      role: 'main',
    }"
  >
    <ul>
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
      </li>
    </ul>

    <AgentDock title="Todo assistant" />
  </section>
</template>
```

Nothing in the template represents `complete_open_tasks`. The region and records are still what the model sees; the new action changes those records through the shared task array.

This separation is the main lesson. The page model answers what the application contains and what it can expose. A function-level tool is one implementation of an exposed capability. It does not need a corresponding visual control, and it should not pretend to have one.

## Declare the function as an action

`useAgentTool` registers the same kind of action descriptor as `v-tool`, with one different primitive:

```ts
const completeOpenTasksAction = {
  id: "complete_open_tasks",
  desc: "Mark every open task as completed. This changes all open records in one operation.",
  kind: "write",
  available: () =>
    remaining.value > 0
      ? true
      : "There are no open tasks. Every task is already completed.",
  run: () => ({ completed: completeOpenTasks() }),
  expect: {
    desc: "No task remains open",
    check: () => remaining.value === 0,
  },
} satisfies AgentToolOptions;

useAgentTool(completeOpenTasksAction);
```

The declaration has no `action`, `target`, or `fidelity` field. There is no element to click, fill, press, or resolve. The framework records the action as the `call` primitive with high fidelity because the developer supplied the implementation directly; that value says the call reaches the stated function, not that the business result is correct.

The fields have distinct jobs:

| Field | Job in this example |
| --- | --- |
| `id` | Stable model-facing identity and execution key. It shares the namespace with every `v-tool` id. |
| `desc` | Explains the operation when there is no visible control to infer meaning from. It is required. |
| `kind` | `write` states that the operation changes application state. It is not an authorization decision by itself. |
| `available` | Reports whether the operation can be attempted in the current page state. |
| `run` | Calls the existing business implementation once and returns bounded data. |
| `expect` | States the result the application expects to observe after the call. |

The action does not need `params` here because it takes no input. The next section explains what changes when a function does take input.

## Function arguments are declared, not inferred

A function-level tool can accept the same `params` declaration as `v-tool`. For example, an operation that rejects an order might declare a required `reason` string and a bounded set of reason codes. Validation runs before policy and before `run`, so a malformed call cannot reach the business function.

The fact that the implementation is a JavaScript function does not make its argument validation automatic. TypeScript types disappear at runtime, and the model does not read them. If an argument matters to correctness, declare it in `params` and validate it inside the function as well when the operation reaches an untrusted service boundary.

`run` receives one validated argument object. In this chapter the action has no parameters, so the implementation ignores the object and returns `{ completed: 2 }`. A return value is optional; when present, it is serialized into the execution result's `data` field under the framework's size limits. It is useful for a count, a generated identifier, or a short confirmation. It is not a place to return the whole task list.

## Availability is page state, not permission

With two open tasks, `available` returns `true`. After the operation reaches a state with no open tasks, it returns a sentence:

```text
There are no open tasks. Every task is already completed.
```

That sentence enters the page snapshot and becomes the reason on an `ACTION_UNAVAILABLE` result. It tells the model what to do next instead of leaving it to guess why a known action disappeared.

A function-level tool has no native disabled state, no hidden parent, and no covered target. The declared predicate is therefore the only availability check the framework can make. It does not replace authorization, tenant isolation, or server-side validation. A button-less operation can be just as sensitive as a visible one; policy still decides whether the caller may attempt it.

## One call, one expected outcome

`run` is the whole business call:

```ts
run: () => ({ completed: completeOpenTasks() })
```

It does not fill a hidden input, click a hidden button, or narrate a sequence of DOM events. The existing state is updated directly, and the result says how many records it changed. Keeping the implementation narrow is important: the agent needs a stable operation, while the page remains free to change its visual controls without invalidating the tool.

The success predicate is also stated once:

```ts
expect: {
  desc: "No task remains open",
  check: () => remaining.value === 0,
}
```

The framework waits for this condition after `run`. If it becomes true, the result carries the expectation description. If it times out, the result reports `EXPECTATION_FAILED`: the function returned, but the declared page state was not observed. That distinction matters for asynchronous implementations, where a resolved promise is not the same as a completed UI update.

## What the result can prove

The business change is visible through the records established in the previous chapter. A successful call returns output in this shape:

```json
{
  "ok": true,
  "action": {
    "id": "complete_open_tasks",
    "description": "Mark every open task as completed. This changes all open records in one operation."
  },
  "expect": "No task remains open",
  "data": { "completed": 2 },
  "changed": {
    "observed": true,
    "records": {
      "added": [],
      "removed": [],
      "updated": [
        { "id": "t1", "fields": ["status"] },
        { "id": "t2", "fields": ["status"] }
      ],
      "reordered": false,
      "omitted": { "added": 0, "removed": 0, "updated": 0 },
      "total": { "from": 3, "to": 3 }
    },
    "actions": {
      "added": [],
      "removed": [],
      "omitted": { "added": 0, "removed": 0 }
    }
  }
}
```

The result separates three layers:

- `data.completed` is what the function returned;
- `expect` is the application predicate the framework observed;
- `changed` is the difference between exposed snapshots.

None of them is a server receipt. If the task array were synchronized over a network, a successful local mutation and a later server rejection could still produce this result. The application must expose a separate acknowledgement when remote correctness matters.

The change summary also has a limit. It reports only exposed records and their declared fields. It cannot show a private audit row, an email sent, or a database write that has no corresponding page projection.

## Which declaration fits

The three forms have different responsibilities:

| Declaration | Use it when | Important consequence |
| --- | --- | --- |
| `v-tool` with a browser primitive | A real control receives the interaction and its native behavior is reliable. | The action is tied to an element and participates in visibility and targeting rules. |
| `v-tool` with `run` | A real control exists, but reproducing its DOM interaction would be unreliable or would split one business operation. | The action remains element-bound; the injected path performs the operation directly. |
| `useAgentTool` | The operation exists as application logic but has no control that should represent it. | There is no target, no visibility check, no hover, and no presence highlight. Availability is entirely developer-declared. |

Do not use a function-level tool merely to avoid writing a clear control declaration. When a real button already owns the operation, declaring the button is usually easier for users to understand and easier for the application to audit. Use the function-level form when the absence of a control reflects the product, not a missing integration.

For compound behavior such as opening a dialog, filling several fields, and saving, use the flow layer rather than hiding the sequence inside one opaque function. A single function-level tool should represent one understandable business operation.

## Failures worth designing for

The common mistakes are structural rather than syntax errors:

| Symptom | Cause | Better response |
| --- | --- | --- |
| The tool can be called when the page is not in the right state | No `available` predicate, or the predicate only checks that the component is mounted | Check the business precondition and return a readable reason. |
| A call succeeds but produces no visible evidence | The function returned before the page settled, or the affected data is not exposed | Add `expect`, expose the relevant record fields, and wait for the render boundary. |
| The model receives a successful response for an operation that should have been blocked | `kind` or `available` was treated as authorization | Enforce policy and backend authorization independently. |
| The context grows after a bulk operation | `run` returns every affected object or an entire external response | Return counts, ids, and a bounded summary. |
| The action remains after the component disappears | `useAgentTool` was called outside a tracked Vue scope | Tie registration to the component lifecycle or dispose the owning runtime. |

The framework rejects a missing `desc`, rejects duplicate action ids, and keeps unavailable actions visible with their reason. Those checks prevent silent ambiguity; they do not decide the business policy.

## Verify the chapter example

From the repository root, start the packaged example:

```bash
pnpm tutorial:dev v3-08
```

Open `http://127.0.0.1:5218/`. For the Chinese interface, use `pnpm tutorial:dev v3-08 --locale zh` and `http://127.0.0.1:5218/?lang=zh`.

Check these paths:

1. Ask the assistant: `Mark every open task as completed.` The two open rows should become completed, including their record fields and visible checked state.
2. Open the activity view. The record for `complete_open_tasks` should include `completed: 2`, the expectation `No task remains open`, and record updates for `t1` and `t2`.
3. Ask the same question again. The action should remain in the capability list with the declared unavailable reason instead of running a second time.
4. Reload the page, add a task manually, and confirm that the form, checkbox, delete button, and filters still use the previous chapter's declarations.
5. Ask the assistant to add a task, then mark every open task complete. The new task should be included in the same record diff.
6. Inspect the debug view's tool list. `complete_open_tasks` should have no element target and should not be folded into a record template.

## Scope and next step

This chapter adds a function-level action, but it does not add a new visibility model. A function-level tool is always present when it is available and mounted; it has no element that can be scrolled out of view, hidden by a parent, or covered by a dialog. That is a convenience for genuinely button-less operations, not a way to escape the page's visibility rules for controls.

The next chapter returns to elements. It covers regions, visibility, and overlays: how the page tells the agent which area is active, which controls are clipped or covered, and which actions remain valid when a dialog opens.

Next: [Regions, visibility, and overlays](/vue/regions-visibility-and-overlays).
