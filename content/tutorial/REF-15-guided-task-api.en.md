---
id: REF-15
title: "Guided task API"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Guided task API

A guided task is for the case where a person knows the result they want but not the steps in between. The API has two entries:

- `pling.task.goal()` declares an outcome, boundaries and success criteria. Fields come from the real page; execution goes through real actions. This is the default.
- `pling.task.define()` declares fields, steps and a run controller. Use it only when page actions cannot express validation, lookup or a fixed sequence.

Both share the task catalog, permissions, confirmation and audit. A goal does not create a second execution path, and neither does an advanced task.

```ts
import type { TaskGoalInput } from "@plingjs/agent";
```

## Choose a path

| Requirement | Use |
| --- | --- |
| One sentence to operate an existing form, then save | `v-scope` + `v-record` + `v-tool`, no task API |
| The outcome must survive a closed dialog or route change | `pling.task.goal()` |
| A fixed task entrance, cancel and completion record | `pling.task.goal()` |
| An external agent needs the playbook and completion boundary | `pling.task.goal()` |
| Field types, ranges, patterns or business validation | Advanced `define()` + `TaskField` |
| Asynchronous lookup and candidate confirmation | Advanced `define()` + `lookup` |
| Several actions in a fixed order | Advanced `define()` + `TaskStep` |
| A task that runs in a host with no UI | `createTaskController()` |

Most pages stop at the first or second row. Do not start with a field table just because an agent is involved.

## Minimal integration: goal()

```ts
const disposeGoal = pling.task.goal(courseGoal(props.locale));
onBeforeUnmount(disposeGoal);
```

`goal()` returns an unregister function. Call it when the component unmounts to remove the goal and its guide.

`goal()` registers an outcome, not a workflow. It accepts no fields, steps, controller, form tools or business callbacks.

### TaskGoalInput

| Property | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | None | Stable goal id, unique in the catalog |
| `title` | `string` | Yes | None | Human-facing goal name |
| `goal` | `string` | Yes | None | Outcome to reach. Must not be empty |
| `description` | `string` | No | `goal` | Extra description in the card or task list |
| `constraints` | `readonly string[]` | No | None | Boundaries the model must keep, such as “page actions are the only entry” |
| `successCriteria` | `readonly string[]` | No | None | Observable completion conditions |
| `examples` | `readonly string[]` | No | None | Sample sentences a person might say |
| `risk` | `read` / `write` / `danger` | No | `write` | Goal-level risk hint; actions keep their own rules |
| `route` | `string \| readonly string[] \| (page) => boolean` | No | Every route | Restrict where the goal can be started |
| `scope` | `string \| readonly string[]` | No | No restriction | Every listed region must be active |
| `keepActive` | `boolean` | No | `true` | Keep an explicitly started goal across temporary context changes |
| `labels` | `TaskGuideLabels` | No | Built-in labels | Override running and completed labels |
| `cancelLabel` | `string` | No | `Cancel task` | Cancel button label |
| `stepSubtitle` | `string` | No | Built-in | Subtitle for the compact goal card |

Example:

```ts
const goal: TaskGoalInput = {
  id: "course.create",
  title: "Create a course",
  goal: "Create a course in the course workspace: open the real form yourself, fill what the person supplied, ask them to upload the cover, save, then read the catalogue back and confirm the new course is first.",
  constraints: [
    "The page's actions are the only way to operate it; do not invent field names, selectors or a second form.",
    "Fill only what the person supplied or explicitly delegated; ask when unsure.",
    "The person must upload the cover; never choose a local file for them.",
    "Questions, corrections, pauses and abandonment take precedence over filling the form.",
  ],
  successCriteria: [
    "The new course appears first in the catalogue",
    "Name, teacher, eligible cards and cover match what the person confirmed",
    "The save action read the catalogue back and confirmed the new record",
  ],
  examples: ["Create prenatal yoga with Chen Jing, 2 stars, monthly card, write the intro"],
  cancelLabel: "Cancel task",
};
```

### What it registers

`goal()` internally:

1. creates a `TaskDefinition` with no fields and puts `goal` in `objective`;
2. creates a compact guide card with title, goal, cancel and completion state;
3. defaults `keepActive` to `true`;
4. registers `pling_start_task`, `pling_cancel_task` and `pling_complete_task`;
5. projects the goal, constraints, success criteria and examples to the model.

It does not:

- open a dialog;
- read or write a form;
- call a save handler;
- relax any action's permissions;
- create a second page.

### Goal lifecycle

```ts
const active = pling.task.active();
active?.goal;                  // true
active?.startedBy;             // "page" | "agent"
active?.state.snapshot?.status; // "running" | "done"
active?.state.completed;       // boolean
```

There are two ways to start:

- the page calls `pling.task.activate("course.create")`;
- the model calls `pling_start_task` with `task: "course.create"`.

Starting changes only the catalog state. The goal calls no page function. The real page stays where it is until the model calls an action such as `new_course`.

A goal has two states:

| State | Meaning |
| --- | --- |
| `running` | Started, not completed or cancelled |
| `done` | The page met the success criteria and the model called complete |

Cancellation removes the goal from active state; it does not keep a `cancelled` snapshot. Values already written to the page are not rolled back.

### Complete and cancel

While a goal is active, the model sees `pling_complete_task`:

```json
{
  "task": "course.create"
}
```

This action only closes the goal. It does not save, submit or change business data. The model calls it only after the page satisfies the success criteria. The usual order is:

1. call the page's save action;
2. its `expect` reads the result back;
3. the read-back passes;
4. call `pling_complete_task`.

If save has not happened, the model must not complete the goal. A completed card means the lifecycle ended, not that another write happened.

A person can cancel from the goal card, or the model can call `pling_cancel_task`. Cancellation only ends the goal. Draft values stay on the page.

### What the model sees

With a goal active, the system prompt contains:

```text
Active task: course.create — Create a course
Objective: Create a course in the course workspace……
Constraints: The page's actions are the only way to operate it……
Success criteria: The new course appears first in the catalogue | ……
Started by: agent
Mode: goal only. The page's real actions are the only way to operate the page.
```

It also states:

- the task has no field schema;
- do not call `pling_update_task`;
- do not invent field names or a second form;
- use the page's real actions;
- call `pling_complete_task` after the page meets the success criteria.

With no fields, `pling_update_task` is unavailable. The model does not receive an empty field table or a request to fill fields one by one.

## TaskCatalog

`createTaskCatalog()` manages which tasks exist on the current page. It does not execute tasks; it handles availability, activation, command forwarding and model projection.

```ts
import { createTaskCatalog } from "@plingjs/agent";

const catalog = createTaskCatalog({
  registry: pling.registry,
  isScopeActive: (id) => pling.registry.isScopeActive(id),
});
```

Vue 3, React, Vue 2.7 and vanilla adapters expose the same catalog through `pling.task`. Pages normally call `pling.task.goal()`, `pling.task.define()` and `pling.task.active()`.

### Properties

| Property | Type | Description |
| --- | --- | --- |
| `actionId` | `readonly string` | Actual bound `pling_start_task` id |
| `updateActionId` | `readonly string` | Actual bound `pling_update_task` id |
| `focusActionId` | `readonly string` | Action id that points at a declared guide field |
| `reviewActionId` | `readonly string` | Action id that opens the page's read-only review |
| `proposeSaveActionId` | `readonly string` | Action id that opens the page's confirmation step |
| `cancelActionId` | `readonly string` | Action id that ends the active guide |
| `completeActionId` | `readonly string` | Action id that completes a goal-only task |

Read these properties when several runtimes share one registry. The first catalog uses `pling_start_task`; a second catalog uses `pling_start_task_2` automatically.

### Methods

| Method | Signature | Behavior |
| --- | --- | --- |
| `goal(input)` | `(input: TaskGoalInput) => () => void` | Register a minimal goal; return unregister |
| `define(registration)` | `(registration: GuidedTaskRegistration) => () => void` | Register an advanced task; return unregister |
| `get(id)` | `(id: string) => GuidedTaskRegistration \| undefined` | Read one registration even when unavailable |
| `list()` | `() => readonly GuidedTaskRegistration[]` | List every task in registration order |
| `available()` | `() => readonly GuidedTaskRegistration[]` | List tasks matching the current route and scopes |
| `active()` | `() => ActiveGuidedTask \| null` | Return the task currently shown |
| `activate(id, options?)` | `(id: string, options?: GuidedTaskActivationOptions) => ActiveGuidedTask` | Start or resume a task explicitly |
| `deactivate()` | `() => void` | End the active task |
| `command(command)` | `(command: TaskGuideCommand) => boolean` | Forward a guide command to `onCommand` |
| `complete()` | `() => boolean` | Complete the active goal-only task; returns `false` for advanced tasks |
| `views()` | `() => readonly GuidedTaskView[]` | Compact read-only descriptions of available tasks |
| `refresh()` | `() => void` | Notify subscribers that live state changed |
| `subscribe(listener)` | `(listener: () => void) => () => void` | Subscribe to availability, activation and snapshots |
| `destroy()` | `() => void` | Unregister actions, clear subscriptions and release controllers |

`activate()` options:

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `values` | `TaskValues` | `{}` | Values already supplied; only declared fields are accepted |
| `startedBy` | `"page" \| "agent"` | `"page"` | Record whether the page or the model opened it |

A goal has no fields, so `values` is usually unnecessary. Advanced tasks validate field names and values.

### ActiveGuidedTask

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Task id |
| `definition` | `TaskDefinition` | Definition used for this run |
| `guide` | `TaskGuideDefinition` | Active guide, if any |
| `controller` | `TaskController` | Run controller; absent for a goal |
| `state` | `TaskGuideState` | Live render state |
| `startedBy` | `"page" \| "agent"` | Who opened it |
| `goal` | `boolean` | Whether it came from `goal()` |

## Advanced: define(registration)

Use `define()` only when page actions cannot express the requirement.

```ts
pling.task.define({
  definition: courseDefinition,
  guide: courseGuide,
  controller,
  route: "/courses/new",
  scope: "create-course-form",
  autoStart: true,
  state: () => ({ snapshot: controller.snapshot(), step: currentStep.value }),
  onCommand: (command) => runCourseCommand(command),
});
```

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | No | Registration id; defaults to `definition.id` and must match when supplied |
| `definition` | `TaskDefinition` | Yes | Executable task definition |
| `guide` | `TaskGuideDefinition` | No | Human-facing guide; a task may run without one |
| `controller` | `TaskController` | No | Run controller; without it the task does not start a run |
| `route` | `GuidedTaskRoute` | No | Exact path, route name, list or predicate |
| `scope` | `string \| readonly string[]` | No | Every listed scope must be active |
| `autoStart` | `boolean` | No | Activate when context matches; default `false` |
| `keepActive` | `boolean` | No | Keep an explicit run across temporary context changes; default `false` |
| `initialValues` | `TaskValues \| () => TaskValues` | No | Values loaded before an automatic or explicit run |
| `binding` | `TaskBinding \| () => TaskBinding` | No | Page facts such as the selected record |
| `state` | `() => TaskGuideState` | No | Live render state |
| `onActivate` | `(task) => void \| Promise<void>` | No | Called after activation |
| `onDeactivate` | `(task) => void` | No | Called when the task stops being active |
| `onCommand` | `(command, task) => void \| Promise<void>` | No | Receives guide button commands |

`define()` returns an unregister function. It removes the controller registration, clears active state and refreshes subscribers.

Only one guide is active at a time. Automatic tasks are chosen in registration order; an explicit activation overrides the current automatic task. After `deactivate()`, the current context does not auto-start again immediately.

## TaskDefinition

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | Stable task id |
| `title` | `string` | Yes | Human-facing task name |
| `description` | `string` | No | What the task does and when to choose it |
| `objective` | `string` | No | Outcome the task should reach |
| `constraints` | `readonly string[]` | No | Boundaries the assistant must keep |
| `successCriteria` | `readonly string[]` | No | Observable completion conditions |
| `requiresRecord` | `boolean` | No | Requires a selected record before start |
| `examples` | `readonly string[]` | No | Sample utterances |
| `fields` | `readonly TaskField[]` | No | Working memory and decisions |
| `risk` | `read` / `write` / `danger` | No | Display risk hint |
| `steps` | `readonly TaskStep[]` | No | Deterministic business action calls |
| `prompt` | `string \| (values) => string` | Agent mode | Prompt template used when handing the task to the assistant |
| `confirm` | `boolean \| "always"` | No | Task-level confirmation preference |

A definition with `steps` is deterministic. Without steps it runs in agent mode and must provide `prompt` or `prompt(values)`.

## TaskField

A field is a decision a person must make, not a database column. Facts such as the current shop, tenant or operator do not belong in fields.

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | Yes | Key used in values and step argument functions |
| `label` | `string` | Yes | Human-facing field name |
| `type` | `text` / `textarea` / `number` / `boolean` / `date` / `select` / `lookup` | No | Input control; default `text` |
| `optional` | `boolean` | No | Allow empty; default required |
| `placeholder` | `string` | No | Input or selection hint |
| `help` | `string` | No | Short field note |
| `defaultValue` | `TaskValue` | No | Initial run value |
| `values` | `readonly TaskChoice[]` | No | Small closed option set |
| `recommended` | `TaskValue` | No | Suggestion used only under explicit delegation |
| `lookup` | `TaskLookup` | No | Asynchronous search for large sets |
| `min` / `max` | `number` | No | Numeric bounds |
| `minLength` / `maxLength` | `number` | No | Text length bounds after trimming |
| `pattern` | `string` | No | Regular-expression source without delimiters |
| `validate` | `(value, values) => string \| null \| undefined` | No | Business validation before writing |
| `searchAction` | `string` | No | Action id exposed for lookup; defaults to `search_<name>` |
| `minChars` | `number` | No | Minimum query length; default 1 |
| `agentWritable` | `boolean` | No | Set `false` for uploads, one-time codes and other page-only values; default `true` |

Each `TaskChoice` has a stable `value`, a human `label`, and an optional `description` for duplicate names.

```ts
const studentField: TaskField = {
  name: "studentRef",
  label: "Student",
  type: "lookup",
  minChars: 2,
  searchAction: "search_students",
  recommended: "student_li_na",
  lookup: async (query, { signal }) => api.searchStudents(query, { signal }),
  validate: (value) =>
    students.some((student) => student.id === value)
      ? null
      : "Choose a student from the search results.",
};
```

These checks run before `pling_update_task` writes. If any field has a wrong type, out-of-range value, wrong length, pattern mismatch or `validate` reason, the whole update is rejected.

`validate` receives the candidate values after this submission. It cannot bypass the field allowlist, `agentWritable`, permissions, confirmation or the business executor.

## TaskStep

A step calls one existing action. It does not declare a second executor.

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | No | Stable step id; defaults to a one-based index |
| `label` | `string` | Yes | Human-facing step name |
| `summary` | `string` | No | Why this step runs or what it checks |
| `action` | `string` | Yes | Registered action or governed business operation |
| `args` | `object \| (values, binding) => object` | No | Static args, field values and bound page facts |
| `optional` | `boolean` | No | Record failure as skipped and continue |
| `handoff` | `boolean \| string` | No | The person must complete this step on the page |

`args` receives copies of values and binding. Changing the argument object does not mutate controller state.

```ts
const approve: TaskStep = {
  label: "Sign the approval on the page",
  action: "sign_approval",
  handoff: "This approval must be signed by the current user.",
};
```

`handoff` pauses the run at `waitingFor: "handoff"`. The host must verify the page when resuming. A boolean from the task layer cannot prove the person completed the operation.

## TaskBinding

Many tasks start from a table row or detail page. When a person clicks “write a note”, the page already knows which lesson is selected.

```ts
interface TaskRecordBinding {
  id: string;
  label?: string;
}

interface TaskBinding {
  record?: TaskRecordBinding;
}
```

A definition declares `requiresRecord: true`. Steps read `binding.record?.id` directly instead of exposing it as a field.

```ts
const addNote: TaskDefinition = {
  id: "lesson.note",
  title: "Write a lesson note",
  requiresRecord: true,
  fields: [{ name: "note", label: "Note", type: "textarea" }],
  steps: [{
    label: "Save the note",
    action: "update_lesson_note",
    args: (values, binding) => ({
      lessonId: binding.record?.id,
      note: values.note,
    }),
  }],
};

controller.start("lesson.note", {}, {
  record: { id: "lesson_42", label: "Yoga basics · 2026-03-16 10:00" },
});
```

When `requiresRecord` is true and there is no non-empty record id, `start()` throws. A general task list should show the task as an entrance, not allow it to start without context.

## createTaskController

```ts
createTaskController(options: {
  invoke: (action, args, context) => unknown | Promise<unknown>;
  now?: () => number;
}): TaskController;
```

`invoke` is the only execution bridge. It should call the existing executor, a governed Surface, or a business service.

It may return `void`, `{ ok: true }`, or an existing `ExecResult`. An `error`, or `result.ok === false`, fails the step. An unrecognized return shape counts as success and is stored in the step snapshot.

```ts
const controller = createTaskController({
  invoke: async (action, args, context) => {
    if (context.signal.aborted) throw new Error("Cancelled");
    return executor.execute(action, JSON.stringify(args));
  },
});
```

### TaskController methods

| Method | Signature | Behavior |
| --- | --- | --- |
| `register` | `(definition) => () => void` | Add a definition; duplicate ids throw |
| `get` | `(id) => TaskDefinition \| undefined` | Read a registered definition |
| `list` | `() => readonly TaskDefinition[]` | List tasks in registration order |
| `start` | `(id, values?, binding?) => TaskRunSnapshot` | Start a run with page facts |
| `setValue` | `(name, value) => TaskRunSnapshot` | Update a field while collecting or ready |
| `plan` | `() => TaskRunSnapshot` | Freeze values as `planned` without calling the bridge |
| `confirm` | `() => TaskRunSnapshot` | Complete a pending task-level confirmation |
| `run` | `() => Promise<TaskRunSnapshot>` | Execute steps or return the agent prompt |
| `cancel` | `() => TaskRunSnapshot` | Abort the current step and mark cancelled |
| `reset` | `() => void` | Clear the current run without removing definitions |
| `snapshot` | `() => TaskRunSnapshot \| null` | Read the current run |
| `subscribe` | `(listener) => () => void` | Receive a snapshot after every change |

Starting another task cancels the previous run. Fields cannot change after execution starts. Calling `plan()` or `run()` without required values returns a `collecting` snapshot with `TASK_FIELDS_REQUIRED` and never calls the bridge.

When a definition sets `confirm`, the first `run()` stops at `planned`, then at `waiting`. After a person confirms, the host calls `confirm()` and `run()` again.

```ts
controller.register({ ...approveOrder, confirm: "always" });
controller.start("order.approve", { orderId: "SO-1001" });

let run = await controller.run();
if (run.status === "waiting" && run.waitingFor === "confirmation") {
  showPlan(run.steps);
  run = controller.confirm();
  run = await controller.run();
}
```

Task-level confirmation is not a second permission system. It answers “should this specific plan continue?”. The underlying action still applies its own risk, approval, scope and audit rules.

### Run states

| State | Meaning | Next step |
| --- | --- | --- |
| `collecting` | Required values are missing | Fill fields |
| `ready` | Values are complete, not executed | `plan()` or `run()` |
| `planned` | Plan is fixed and visible | Confirm or start |
| `running` | A step is executing | Wait or report progress |
| `waiting` | Waiting for confirmation or a human handoff | `confirm()` or complete on the page |
| `verifying` | Action returned; the host is checking the result | Review evidence and continue |
| `done` | Every required step finished | Show the result |
| `failed` | A required step failed | Fix the cause or retry |
| `cancelled` | Run cancelled or replaced | Start again when ready |

`planned`, `running` and `verifying` are not three names for one moment. `planned` means the route was frozen before execution; `running` means a call is in progress; `verifying` means the call returned and the page is being read for evidence.

## TaskGuideDefinition

`goal()` generates a compact guide. Advanced tasks can declare their own:

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `taskId` | `string` | Yes | Must match the task definition id |
| `title` | `string` | Yes | Guide card title |
| `compact` | `boolean` | No | Show only goal, cancel and completion |
| `welcome` | `string` | No | Intro before the step rail |
| `footer` | `string` | No | Small note under the guide body |
| `cancel` | `TaskGuideAction` | No | Header action to leave the task |
| `stepSubtitle` | `string` | No | Subtitle template supporting `{step}` and `{total}` |
| `avatar` | `string` | No | Short avatar text or initials |
| `agent` | `{ focusField?, review?, proposeSave?, cancel? }` | No | Page commands the model may trigger |
| `labels` | `TaskGuideLabels` | No | Override running, completed, current, done, pending, skipped and error labels |
| `fields` | `readonly TaskGuideField[] \| (snapshot) => readonly TaskGuideField[]` | No | Read-only field rail projection |
| `steps` | `readonly TaskGuideStep[]` | Yes | Human-facing steps; a goal card passes an empty array |
| `done` | `{ title?, description? }` | No | Completion card copy |

Commands in `guide.agent` only open page-owned UI and never write:

- `focusField` enables `pling_focus_field`, scroll and highlight only;
- `review` enables `pling_review_task`, opens a read-only review;
- `proposeSave` enables `pling_propose_save`, opens the confirmation surface;
- `cancel` enables `pling_cancel_task`, ends the task.

When a command is omitted, the model does not see the tool. Calling it returns `ACTION_UNAVAILABLE` instead of running an empty action.

## Updating working memory

With an advanced task active, the model receives the objective, constraints, success criteria, field values, gaps and current guide step. It may answer without writing a field, or update only the one value the person supplied, corrected or delegated.

These changes go through a separate `pling_update_task` action:

```json
{
  "task": "course.create",
  "values": { "cards": "Monthly card" },
  "clear": []
}
```

The action is available only while an advanced task is active and not terminal. It accepts only declared fields, rejects fields with `agentWritable: false`, and only updates `TaskRun.values`; it never writes business data. The page may subscribe to the snapshot and sync values into its real form. Actual writes still use the task's actions, executor, approval, audit and read-back.

A goal has no fields, so `pling_update_task` is unavailable. The model calls page actions directly.

## Model actions

### pling_start_task

When a catalog registers its first task, it binds a narrow action into the current registry:

```ts
{
  id: "pling_start_task",
  kind: "read",
  confirm: false,
  params: {
    task: "string",   // enum from currently available task ids
    values: "object", // only advanced tasks have field properties
  },
}
```

The action accepts only currently available task ids. `values` may contain only fields declared by that task. An unknown id or field returns `INVALID_ARGS`.

Passing values only prefills a run. It does not skip the action's own permissions, confirmation or audit.

### pling_complete_task

Available while a goal is active. It only closes a goal-only task and writes no business data. Advanced tasks use their own completion state and do not expose this action.

```json
{
  "task": "course.create"
}
```

Call it only after the page satisfies the success criteria. Do not call it because the person said thanks or because the assistant finished explaining the next step.

### pling_cancel_task

Ends the current task. Values already written to the page are not rolled back. A goal is removed; an advanced controller run is cancelled.

### Other page commands

`pling_focus_field`, `pling_review_task` and `pling_propose_save` are available only when the active guide declares the matching command. All follow one rule: they move the person's attention or open page-owned UI; they never execute a business write.

## Rendering

Vue 3, React, Vue 2.7 and vanilla JS share one task state machine and one DOM renderer. Adapters mount the component and expose methods; they do not copy execution logic.

| Adapter | Conversation host | Task view |
| --- | --- | --- |
| Vue 3 | `AgentInline` / `AgentDock` renders the active guide; `#task` can override | Built-in guide, or low-level `AgentTaskCard` |
| React | `AgentChat` or `AgentDock` `task` prop | `AgentTaskCard` |
| Vue 2.7 | `pling.dock({ task })` | `createTaskCard()` |
| Vanilla JS | `pling.dock({ task })` | `createTaskCard()` |

A normal business page does not need `#task`. The built-in assistant subscribes to the catalog and renders the active guide.

```vue
<AgentInline
  title="Pling assistant"
  :debug="{ maxCalls: 8 }"
  collapsible
  speakers
  composer="multiline"
  task-placement="inline"
/>
```

A goal card shows only the goal, cancel and completion. It contains no form controls. The only input is the chat composer; to fill the form, people use the page.

## Surface tasks

External agents can receive the same business tasks as descriptive metadata:

```ts
const tasks: SurfaceTask[] = [{
  id: "course.create",
  title: "Create a course",
  goal: "Create a course in the course workspace and read the catalogue back",
  constraints: ["Page actions are the only entry", "The person uploads the cover"],
  successCriteria: ["The new course appears first in the catalogue"],
  risk: "write",
  playbook: ["Call new_course to open the real form", "Complete the goal only after save read-back passes"],
}];
```

A Surface task explains how capabilities work together. It does not grant capability, expand session scope or bypass approval. `invoke` still goes through the exposed list, executor and audit path.

## Error codes

| Code | Meaning | Recovery |
| --- | --- | --- |
| `TASK_FIELDS_REQUIRED` | Required value missing | Fill fields and run again |
| `TASK_ACTION_FAILED` | Execution bridge returned a business failure | Read the message, fix or retry |
| `TASK_STEP_FAILED` | Execution bridge threw or rejected | Retry or change task input |
| `ACTION_UNAVAILABLE` | Current task or action is unavailable | Check active state, goal and scope |
| `INVALID_ARGS` | Unknown task, unknown field or invalid value | Fix the call arguments |

Unknown task ids, unknown fields, duplicate definitions, a missing bound record, and field changes after execution starts throw synchronously. These are programming or host errors, not user-facing task states.

## Current limits

- A goal provides no planner and generates no steps.
- A goal executes no business action; it only manages lifecycle.
- One controller has one active run at a time; parallel business tasks need separate controllers.
- Step results go to the host, but later steps receive only values and binding; they do not automatically chain previous results.
- The four adapters share one DOM renderer.
- Task cards own entrances, decisions, progress and handoffs; the page's original form and controls remain the source of business input.
- Surface tasks are descriptions. An agent still calls `describe` for more context and follows session scope.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/agent`, `@plingjs/vanilla`, `@plingjs/surface` `0.1.0-alpha.10` |
| Introduced | `0.1.0-alpha.6` |
| `goal()` introduced | `0.1.0-alpha.9` |
| Runtime | Browsers with ES2022 modules; the task controller runs in Node.js 20 or later |
| Peer dependencies | None |
| Stability | Experimental; snapshots may add fields without changing existing meanings |

The task controller is DOM-free. `createTaskPanel` and `createTaskCard` are reference renderers in `@plingjs/vanilla`; every adapter renders the same `TaskRunSnapshot` instead of writing a second execution engine.

`goal()` is the recommended entry. `define()` remains for field validation, lookup, fixed steps and headless runs.
