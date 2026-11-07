---
id: REF-15
title: "Guided task API"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Guided task API

Guided tasks turn “the user knows the outcome, not the steps” into a bounded run. A definition states the goal, constraints, success criteria, and working-memory fields. Deterministic steps may call existing actions in order, but the conversation is not a field-by-field script. Every interface renders the same task snapshot.

The API lives in `@plingjs/agent`; the reference DOM panel lives in `@plingjs/vanilla`. Neither package creates a second permission model. The host injects the same executor, Surface, or business service that already governs the page.

```ts
import {
  createTaskController,
  type TaskDefinition,
  type TaskRunSnapshot,
} from "@plingjs/agent";
```

## The pieces

| Piece | Answers | Does not do |
| --- | --- | --- |
| `TaskDefinition` | Goal, constraints, success criteria, working memory, and optional deterministic steps | Execute or approve anything |
| `TaskRunSnapshot` | What should the user see right now | Own a model session |
| `TaskInvoke` | Which existing executor receives the call | Add a new transport or permission rule |
| `GuidedTaskPanel` | How a run is rendered in plain DOM as either a full panel or a conversation card | Replace framework components or execution |

A definition with `steps` is deterministic. A definition without steps is in agent mode and must provide `prompt` or `prompt(values)`.

## TaskDefinition

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | Stable task id, unique in one controller |
| `title` | `string` | Yes | Human-facing task name |
| `description` | `string` | No | What the task does and when to choose it |
| `objective` | `string` | No | The outcome the task is trying to achieve |
| `constraints` | `readonly string[]` | No | Boundaries the assistant must respect while helping |
| `successCriteria` | `readonly string[]` | No | Observable conditions that mean the task is complete |
| `requiresRecord` | `boolean` | No | Start only after the page supplies a selected record |
| `examples` | `readonly string[]` | No | Example requests shown on a task card |
| `fields` | `readonly TaskField[]` | No | Current working memory and decisions that may need a person |
| `risk` | `read` / `write` / `danger` | No | Presentation hint; the action still enforces its own risk |
| `steps` | `readonly TaskStep[]` | No | Deterministic business action calls; presence selects step mode |
| `prompt` | `string \| (values) => string` | Agent mode | Template used to hand the task to the assistant |
| `confirm` | `boolean \| "always"` | No | Task-level confirmation preference |

`examples` fills the form. It must not execute a write. That distinction keeps a suggestion from becoming an accidental command.

## Binding the current record

Many business tasks start from a row or a detail page. By the time the user clicks “Add note”, the page already knows which lesson, order, or member is selected. Asking for that id in the form is both awkward and error-prone.

`TaskBinding` carries page facts; it is not another values object.

```ts
interface TaskRecordBinding {
  id: string;
  label?: string;
}

interface TaskBinding {
  record?: TaskRecordBinding;
}
```

The task definition opts into this contract with `requiresRecord: true`. The step then reads `binding.record?.id` instead of exposing it as a field.

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

panel.open("lesson.note", {}, {
  record: { id: "lesson_42", label: "Yoga basics · 2026-03-16 10:00" },
});
```

`start()` throws when `requiresRecord` is true and no non-empty record id is present. Generic task lists should show such tasks as entry points, not as buttons that can start without context.

## TaskField

Fields are user decisions, not database columns. Omit server facts such as the current shop, tenant, or operator.

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | Yes | Key used in values and step argument functions |
| `label` | `string` | Yes | Human-facing field label |
| `type` | `text` / `textarea` / `number` / `boolean` / `date` / `select` / `lookup` | No | Input control; defaults to text |
| `optional` | `boolean` | No | Allows an empty value; required by default |
| `placeholder` | `string` | No | Input placeholder or select prompt |
| `help` | `string` | No | Short explanation next to the field |
| `defaultValue` | `TaskValue` | No | Initial value when the run starts |
| `values` | `readonly TaskChoice[]` | No | Small closed choice set |
| `recommended` | `TaskValue` | No | Suggestion used only when the person explicitly delegates this choice |
| `lookup` | `TaskLookup` | No | Async search for a large collection |
| `min` / `max` | `number` | No | Numeric bounds. Enforced before a model-proposed value reaches the task snapshot. |
| `minLength` / `maxLength` | `number` | No | Text-length bounds, counted on the trimmed string. |
| `pattern` | `string` | No | Regular-expression source without delimiters, tested against a text value. Use anchors when the whole value must match, for example `^[1-9]\d*$`. |
| `validate` | `(value, values) => string \| null \| undefined` | No | Business-level check run before the value is written. Return a short human-readable reason to reject it, or nothing when valid. It validates a value; it must not classify intent or trigger side effects. |
| `searchAction` | `string` | No | Action id exposed for this lookup; defaults to `search_<name>` |
| `minChars` | `number` | No | Minimum query length; defaults to 1 and is never lower |
| `agentWritable` | `boolean` | No | Set to `false` for page-owned values such as an upload or one-time code; defaults to `true` |

Each `TaskChoice` has a stable `value`, a human `label`, and an optional `description` that distinguishes duplicates.

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

These checks run before `pling_update_task` writes anything, so the page does not need a parallel natural-language parser. If one submitted value has the wrong type, exceeds a bound, fails a length or pattern check, or returns a reason from `validate`, the whole update is rejected and no half-applied form is left behind. `validate` sees the candidate values for this submission, but it still cannot bypass the field allowlist, `agentWritable`, permissions, confirmation, or the business executor.

## TaskStep

A step calls one existing action. It does not declare a second executor.

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | No | Stable step id; defaults to its 1-based index |
| `label` | `string` | Yes | Human-facing step name |
| `summary` | `string` | No | Why the step exists or what it checks |
| `action` | `string` | Yes | Registered action or governed business operation |
| `args` | `object \| (values, binding) => object` | No | Static arguments, collected values, and bound page facts |
| `optional` | `boolean` | No | A failure becomes skipped and later steps continue |
| `handoff` | `boolean \| string` | No | The user must complete this step in the page |

`args` receives copies of values and the binding. A step cannot mutate the controller's stored state by editing the arguments object.

```ts
const approve: TaskStep = {
  label: "Sign the approval in the page",
  action: "sign_approval",
  handoff: "The approval must be signed by the current user.",
};
```

`handoff` pauses the run with `waitingFor: "handoff"`. When the host resumes, it must verify the page itself; a boolean from the task layer is not evidence that the user completed the work.

## Run lifecycle

| Status | Meaning | Typical next step |
| --- | --- | --- |
| `collecting` | Required values are missing | Fill fields |
| `ready` | Values are complete; nothing has run | `plan()` or `run()` |
| `planned` | The plan is fixed and visible | Confirm, or run |
| `running` | A step is in progress | Wait, or report progress |
| `waiting` | Paused for confirmation or handoff | `confirm()`, or complete the page step |
| `verifying` | The action returned and the host is checking the result | Observe the evidence, then continue |
| `done` | All required steps completed | Show the result |
| `failed` | A required step failed | Correct the cause or retry |
| `cancelled` | The run was cancelled or replaced | Start again if needed |

`planned`, `running`, and `verifying` are not three names for the same moment. `planned` means the route is frozen before execution. `running` means an invocation is in flight. `verifying` means the invocation returned and the page is being read for evidence. Collapsing them would make a progress UI lie about whether work has happened.

## createTaskController

```ts
createTaskController(options: {
  invoke: (action, args, context) => unknown | Promise<unknown>;
  now?: () => number;
}): TaskController;
```

`invoke` is the only bridge. It should call the existing executor, a governed Surface, or an application service.

The bridge may return `void`, `{ ok: true }`, or an existing `ExecResult`. A returned `error` or `result.ok === false` fails the step. Unknown return shapes are treated as successful results and stored in the step snapshot.

```ts
const controller = createTaskController({
  invoke: async (action, args, context) => {
    if (context.signal.aborted) throw new Error("Cancelled");
    return executor.execute(action, JSON.stringify(args));
  },
});
```

## TaskController methods

| Method | Signature | Behavior |
| --- | --- | --- |
| `register` | `(definition) => () => void` | Adds a definition; duplicate ids throw |
| `get` | `(id) => TaskDefinition \| undefined` | Reads one registered definition |
| `list` | `() => readonly TaskDefinition[]` | Lists tasks in registration order |
| `start` | `(id, values?, binding?) => TaskRunSnapshot` | Starts a run and records page facts |
| `setValue` | `(name, value) => TaskRunSnapshot` | Updates a field while collecting or ready |
| `plan` | `() => TaskRunSnapshot` | Freezes values into planned state without invoking the bridge |
| `confirm` | `() => TaskRunSnapshot` | Completes a pending task-level confirmation |
| `run` | `() => Promise<TaskRunSnapshot>` | Executes steps or returns the agent prompt |
| `cancel` | `() => TaskRunSnapshot` | Aborts the active step and marks the run cancelled |
| `reset` | `() => void` | Clears the active run without deleting definitions |
| `snapshot` | `() => TaskRunSnapshot \| null` | Reads the current run |
| `subscribe` | `(listener) => () => void` | Receives a snapshot after every state transition |

Starting another task cancels the previous run. Field values cannot be changed after execution starts. Calling `plan()` or `run()` with a missing required field returns a `collecting` snapshot with `TASK_FIELDS_REQUIRED`; it does not invoke the bridge.

When a definition sets `confirm`, the first `run()` stops at `planned` and then at `waiting`. The host calls `confirm()` after a person approves, then calls `run()` again.

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

Task-level confirmation is not a second permission system. It answers “should this exact plan proceed?”. The underlying action still has its own risk, approval, scope, and audit rules. A task cannot approve an action that the executor would reject.

## Task catalog (TaskCatalog)

`createTaskCatalog()` manages **which tasks are available on the current page**. It does not execute a task. It owns availability, activation, command routing, and the task list projected to the model.

```ts
import { createTaskCatalog } from "@plingjs/agent";

const catalog = createTaskCatalog({
  registry: pling.registry,
  isScopeActive: (id) => pling.registry.isScopeActive(id),
});
```

Vue 3 exposes the same catalog as `pling.task`, combined with the task controller. A page therefore usually calls `pling.task.define()`, `pling.task.active()`, and `pling.task.command()` directly.

The catalog exposes `actionId` and `updateActionId`. The first is the actual bound id for `pling_start_task`; the second is the actual bound id for `pling_update_task`. Read both properties instead of assuming the default ids when multiple runtimes share one registry.

When the active guide declares page-control commands, the catalog also exposes `focusActionId`, `reviewActionId`, `proposeSaveActionId`, and `cancelActionId`. They map to four narrow actions and never create a second execution path:

| Property | Model action | Effect | Available when |
| --- | --- | --- | --- |
| `focusActionId` | `pling_focus_field` | Scrolls a declared guide field into view and highlights it; never writes | The active guide has fields |
| `reviewActionId` | `pling_review_task` | Opens the page's read-only review; does not save | `guide.agent.review` declares a command |
| `proposeSaveActionId` | `pling_propose_save` | Opens the page's confirmation surface only; does not perform the business write | `guide.agent.proposeSave` declares a command |
| `cancelActionId` | `pling_cancel_task` | Ends the guide without rolling back values already written to the page | `guide.agent.cancel` or `guide.cancel` declares a command |

When a command is missing, the model does not see the tool; a call returns `ACTION_UNAVAILABLE` instead of invoking an empty page action. The real save still goes through the page button, executor, confirmation, and read-back.

### define(registration)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | No | Registration id; defaults to `definition.id`. A mismatch throws. |
| `definition` | `TaskDefinition` | Yes | Executable task definition. |
| `guide` | `TaskGuideDefinition` | No | Human-facing presentation. A task without a guide can still run headlessly. |
| `controller` | `TaskController` | No | Run controller. A run starts only when a controller is present. |
| `route` | `string \| readonly string[] \| (page) => boolean` | No | Matches page path or route name. Omit for no route restriction. |
| `scope` | `string \| readonly string[]` | No | Every listed scope must be active. Omit for no scope restriction. |
| `autoStart` | `boolean` | No | Open the guide when context matches. Defaults to `false`. |
| `initialValues` | `TaskValues \| () => TaskValues` | No | Initial values for automatic or explicit runs. |
| `binding` | `TaskBinding \| () => TaskBinding` | No | Page facts such as the selected record. |
| `state` | `() => TaskGuideState` | No | Live rendering state. If `snapshot` is omitted, the controller snapshot is used. |
| `onActivate` | `(task) => void \| Promise<void>` | No | Called after the task becomes active; useful for opening a dialog or syncing a form. |
| `onDeactivate` | `(task) => void` | No | Called when the task stops being active. |
| `onCommand` | `(command, task) => void \| Promise<void>` | No | Receives business command names from guide buttons. |

`define()` returns an unregister function. It removes the controller registration, clears active state when needed, and notifies subscribers.

When a registration supplies a `controller`, the catalog subscribes to its run state. New snapshots from `setValue()`, `run()`, `cancel()`, and related transitions also notify catalog subscribers. Vue 3's built-in `AgentInline` / `AgentDock` therefore do not need a page-level `refresh()` call; steps, busy state, errors, and completion update with the run.

Only one guide is active at a time. Automatic tasks follow registration order; an explicit activation replaces the current automatic task. When context stops matching, an explicit activation is cleared. After `deactivate()`, the same context does not immediately auto-start again; it can return after the route or the available task set changes.

### Activation and state

```ts
const task = catalog.activate("course.create", {
  values: { name: "Yoga foundations" },
  startedBy: "agent",
});

catalog.active();    // ActiveGuidedTask | null
catalog.available(); // registrations valid in the current context
catalog.command({ action, step: null, stepIndex: 0, done: false });
catalog.deactivate();
```

`ActiveGuidedTask` contains `id`, `definition`, optional `guide`, optional `controller`, current `state`, and `startedBy` (`page` or `agent`).

`activate()` rejects values that are not declared fields on that task. The error is `INVALID_ARGS`, and no partially active task is left behind.

### Working memory updates

Starting a task exposes its objective, constraints, success criteria, field values, gaps, and current guide step to the model. This state is rebuilt on every turn. The model may answer a question without writing a field, or update only the field the user supplied, corrected, or delegated.

Those changes go through the separate `pling_update_task` action:

```json
{
  "task": "course.create",
  "values": { "cards": "Monthly card" },
  "clear": []
}
```

The action is available only while a task is active and not terminal. It accepts only declared fields, rejects page-only fields (`agentWritable: false`), and updates `TaskRun.values` without executing the business write. The page can subscribe to the run snapshot and mirror the values into the original form. A real write still uses the task's declared action, executor, approval, audit, and read-back verification.

`ActiveGuidedTask` contains:

| Property | Description |
| --- | --- |
| `id` | Task id |
| `definition` | Executable definition |
| `guide` | Presentation definition, when supplied |
| `controller` | Task controller, when supplied |
| `state` | Current render state |
| `startedBy` | `page` or `agent`, used for diagnostics and later policy |

### Model action: pling_start_task

The first task registration binds one narrow action to the current registry:

```ts
{
  id: "pling_start_task",
  kind: "read",
  confirm: false,
  params: {
    task: "string",   // enum from the currently available task ids
    values: "object", // properties generated from the current task fields
  },
}
```

`values` is not an arbitrary object. The task catalog merges the fields of the currently available tasks into an explicit `properties` schema. Each property carries its type, description, optionality, enum choices, and lookup instructions, and `additionalProperties` is `false`. When tasks share a field name, its description lists every task that uses it.

JSON Schema cannot change shape based on the value of `task`, so this schema describes the field set that may appear on the current page. On activation, `activate()` validates the chosen task's field allowlist again; the model cannot mix in fields from another task.

```json
{
  "task": "course.create",
  "values": {
    "name": "Morning yoga",
    "teacherId": "teacher_18",
    "cards": ["monthly"]
  }
}
```

The model may select only an available task. An unknown or unavailable id returns `INVALID_ARGS`; an unknown field is rejected the same way. Starting a task is read-only and never writes business data. The actual write still goes through the task step action, executor, approval, and audit path.

For a write action that should be reached only through the guide, set `modelVisible: false` when registering it. It is omitted from the model's tool list and action snapshot, while the registry keeps the action so page controls and task steps can still call it.

```ts
useAgentTool({
  id: "create_course",
  desc: "Create a course",
  kind: "write",
  modelVisible: false,
  params: [{ name: "name", label: "Course name" }],
  run: ({ name }) => api.createCourse(String(name)),
});
```

The example uses the Vue 3 / React function-action shape; Vue 2 and vanilla JS pass the same fields to `pling.action()`.

This controls visibility to the model; it is not a permission system. Risk rules, scope, business API checks, and audit still stop unauthorized work. Nor does `modelVisible: false` prevent page code or a task step from invoking the action.

The action exists only while the catalog has at least one task. A page with no guided tasks does not gain an always-unavailable tool. If several `createPling` instances share a registry, later catalogs use ids such as `pling_start_task_2`; the system prompt names the actual id.

## TaskGuideDefinition

`TaskDefinition` says what must happen. `TaskGuideDefinition` says how to explain it to a person. They share a `taskId`, but neither replaces the other: the definition can run without a guide, and the guide never owns an extra execution path.

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `taskId` | `string` | Yes | Must match the task definition id |
| `title` | `string` | Yes | Guide card heading |
| `welcome` | `string` | No | Short introduction before the step rail |
| `footer` | `string` | No | Small note under the card |
| `cancel` | `TaskGuideAction` | No | Header action for leaving the task; the renderer emits the command and the page decides whether to end the run |
| `stepSubtitle` | `string` | No | Step subtitle supporting `{step}` and `{total}` |
| `avatar` | `string` | No | Short avatar text for the built-in renderer |
| `agent` | `{ focusField?, review?, proposeSave?, cancel? }` | No | Page-control commands the model may trigger. Declaring `review` enables `pling_review_task`, `proposeSave` enables `pling_propose_save`, and `cancel` enables `pling_cancel_task`; omitting a command makes its tool unavailable. `focusField(field)` overrides the default `focus-<field>` while `pling_focus_field` remains limited to declared guide fields. None of these commands performs a business write |
| `labels` | `TaskGuideLabels` | No | Overrides the running, completed, current, pending, and error labels |
| `fields` | `TaskGuideFields` | No | Switches to a compact horizontal field rail; the full step card is not rendered |
| `steps` | `readonly TaskGuideStep[]` | Yes | Ordered human-facing steps |
| `done` | `TaskGuideDone` | No | Completion copy, summary, and follow-up commands |

Each `TaskGuideStep` can show read-only rows, point at the original page control, wait for the person to act, or emit a business command. A button carries only a `command` string; the page's `onCommand` decides what it means. Adding a guide button never adds a second way to execute business work.

```ts
const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "Create a course",
  welcome: "I will check the details and put them into the form on the right.",
  stepSubtitle: "Step {step} of {total}",
  steps: [
    {
      id: "name",
      label: "Course name",
      title: "Start with the course name",
      description: "I have pointed at the name field on the right.",
      handoff: {
        title: "Confirm the name",
        description: "Fill it in, then return to the conversation and I will continue.",
      },
      primary: { label: "I have filled it in", command: "name.done" },
    },
  ],
  done: {
    title: "Course created",
    description: "The first row in the course list is the new course.",
  },
};
```

The read-only summary inside a step is made of `TaskGuideRow` values. Its most important field is `status`: an existing page value, a suggestion that has not been written, and a missing value must not look the same.

### Compact field rail

Use `fields` when a task must stay pinned above the conversation without taking over the panel. The renderer keeps only the title, the stage status, and one horizontally scrollable field rail. Filled nodes show a check; required and optional fields are labelled. Clicking a node emits `focus-<field>` by default so the page can bring that control into view. Suggestions, explanations, and the next-step prompt belong in the conversation, not in the fixed area.

```ts
const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "Create a course",
  stepSubtitle: "Course management · step {step} of {total}",
  fields: () => [
    { field: "name", label: "Name", required: true, filled: Boolean(draft.name) },
    { field: "difficulty", label: "Level", filled: Boolean(draft.difficulty), suggested: true },
    { field: "cover", label: "Cover", required: true, filled: draft.cover },
  ],
  steps: [/* business stages, used only for the step count */],
};
```

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `field` | `string` | Yes | Page field name; the default command is `focus-<field>` |
| `label` | `string` | Yes | Short label shown under the node |
| `required` | `boolean` | No | Renders as Required or Optional |
| `filled` | `boolean` | No | Whether the page already holds a value; filled nodes show a check |
| `suggested` | `boolean` | No | A recommendation exists but is not in the page; the node uses a dashed accent |
| `command` | `string` | No | Overrides the default locate command; still routed through `onCommand` |

The rail expresses progress and location, not input. Recommendations, follow-up questions, and failure explanations stay in the conversation or the page. The fixed area therefore does not grow with the number of fields, and there is never a second form.

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `label` | `string` | Yes | Field name or business fact |
| `value` | `string \| number \| boolean \| null \| undefined` | Yes | Display value; the renderer formats it and never edits the page |
| `format` | `"text" \| "stars" \| "check" \| "number"` | No | Display format; `stars` renders a 1–5 rating and `check` expects boolean semantics |
| `status` | `"current" \| "suggested" \| "missing"` | No | Whether the value is in the page, suggested, or missing |
| `badge` | `string` | No | Short business-owned label such as “In page”, “Suggested”, or “Needs input” |
| `note` | `string` | No | Provenance or helper text; a suggestion should say that it is not written yet |
| `action` | `TaskGuideAction` | No | Row command such as “Use”, “Locate”, or “Choose”, still routed through `onCommand` |

```ts
const rows: TaskGuideRow[] = [
  {
    label: "Course name",
    value: "Yoga foundations",
    status: "suggested",
    badge: "Suggested",
    note: "From the demo template; not written to the page",
    action: { label: "Use", command: "apply-name" },
  },
  {
    label: "Teacher",
    value: "Zhou Min",
    status: "current",
    badge: "In page",
    action: { label: "Locate", command: "focus-teacher" },
  },
];
```

A Vue 3 business page normally registers this definition only. `AgentInline` and `AgentDock` read the active task and pass it to the built-in `AgentTaskGuide`. In plain DOM, `createTaskGuide()` from `@plingjs/vanilla` consumes the same `TaskGuideDefinition`; `AgentTaskGuide` is the Vue lifecycle shell for products that deliberately replace the default presentation.

## Compact action row (GuideActionItem)

`TaskGuideRow` is for one-field-per-row summaries. When the guide reduces the next step to a few actions, use the lighter `GuideActionItem`. It renders one action row, not a field table, and every adapter mounts the same DOM.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | Stable id for tests and host bookkeeping; never sent to the model |
| `label` | `string` | Yes | Short verb, for example “Fill it in” or “Point to · Course name” |
| `command` | `string` | Yes | Business command emitted on click; the renderer does not interpret it |
| `kind` | `"primary" \| "secondary" \| "suggestion" \| "skip"` | No | Visual emphasis; only `suggestion` renders `preview` |
| `preview` | `string` | No | One-line, ellipsised preview of a long recommendation, capped around `300px` |
| `ariaLabel` | `string` | No | Full accessible name when the visible label omits the field or the preview is truncated |
| `disabled` | `boolean` | No | Disables the action during a write; disabled buttons never emit a command |

```ts
const items: GuideActionItem[] = [
  {
    id: "use-note",
    label: "Fill it in",
    preview: "Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
    ariaLabel: "Fill in booking notes: Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
    command: "apply-note",
    kind: "suggestion",
  },
  { id: "skip-note", label: "Skip", command: "skip-note", kind: "skip" },
];
```

In plain DOM, call `createGuideActions({ items, hint, ariaLabel, locale, onCommand })`. Vue and React use `AgentGuideActions`. The component only mounts and syncs the row; the host still handles every command.

The long recommendation deliberately stays out of `label`. When the button width is driven by the value, the row wraps, squeezes the conversation, and blurs the difference between “suggested” and “already written”. The full value lives in the conversation, `title`, and `aria-label`; the button only answers what clicking will do.

The renderer lives in `@plingjs/dom` and depends on no UI framework. The Vue and React packages provide lifecycle shells only, so wrapping, ellipsis, focus, and disabled states have one implementation. It never writes a field, calls a business function, or creates a second execution path.

## TaskRunSnapshot

| Property | Type | Description |
| --- | --- | --- |
| `taskId` | `string` | Definition id |
| `title` | `string` | Human-facing task title |
| `mode` | `steps` / `agent` | Deterministic steps or assistant handoff |
| `status` | `TaskRunStatus` | Current run state |
| `fields` | `readonly TaskField[]` | Field definitions for rendering |
| `values` | `TaskValues` | Current values |
| `binding` | `TaskBinding` | Present when page facts were supplied |
| `steps` | `readonly TaskStepSnapshot[]` | Ordered progress and outcomes |
| `prompt` | `string` | Present in agent mode after values resolve |
| `waitingFor` | `confirmation` / `handoff` | Why the run is waiting |
| `confirmation` | `{ required; confirmed }` | Present when the definition requests confirmation |
| `error` | `{ code, message }` | Present when the run or a required step fails |
| `startedAt` | `number` | Millisecond timestamp from the injected clock |
| `finishedAt` | `number` | Present after completion, failure, or cancellation |

Step status is `pending`, `running`, `ok`, `skipped`, or `failed`. A skipped optional step keeps its error in the step snapshot while the run continues.

## TaskRunContext

The bridge receives `{ taskId, values, binding, signal, report }`. `values` and `binding` are copies. `signal` aborts when the run is cancelled or replaced.

`report("running")`, `report("waiting", "confirmation" | "handoff")`, and `report("verifying")` let a long-running bridge describe a sub-state without inventing a second snapshot store. Stale runs ignore reports.

## Lookup actions

`registerTaskLookupActions` turns each lookup field into a narrow read action:

```ts
const off = registerTaskLookupActions(pling, controller.list(), { maxResults: 8 });
```

The generated action takes `{ query }`, returns `{ query, minChars?, choices }`, and is clamped to at most 50 choices. It never writes, bypasses scope, or skips the executor for the eventual write. The UI and the model share the same `field.lookup` function, so a duplicate-name decision is made from the same candidates in both places.

Use `searchAction` when several tasks share one search implementation. Without it, the action id is `search_<fieldName>`; duplicate ids keep the first implementation and emit a warning.

## Prompt templates in agent mode

Agent mode is for tasks whose route cannot be fixed safely. It produces a prompt; it does not call the model.

```ts
controller.register({
  id: "student.summary",
  title: "Explain a student's membership",
  fields: [{ name: "name", label: "Student name" }],
  prompt: "Summarize the membership for {{name}} and list any expiring cards.",
});

controller.start("student.summary", { name: "Li Na" });
const snapshot = await controller.run();
// snapshot.prompt is ready for pling.ask().
```

The host passes `snapshot.prompt` to its existing assistant entrance. The task controller never owns a session or model connection.

## Rendering a run

Vue 3's `<AgentInline>` subscribes to `pling.task` and renders the active guide inside the conversation automatically. The page registers the task; it does not rebuild chat chrome or mount `AgentTaskGuide` by hand. Override the `#task` slot only when a product deliberately needs a different task presentation.

`@plingjs/vanilla` still provides two lower-level shapes. `createTaskPanel()` is the full task workspace. `createTaskCard()` is the compact form that belongs inside a conversation. They differ in presentation, not in fields, lookup, execution, confirmation, or failure handling.

```ts
import { createTaskCard } from "@plingjs/vanilla";

const card = createTaskCard(controller, {
  locale: "en-US",
  onPrompt: (prompt) => pling.ask(prompt),
});

pling.dock({
  layout: "sidebar",
  sidebarMode: "fused",
  task: card.element,
});
```

The card emits `pling-task-prompt` for agent-mode tasks and `pling-task-complete` after a run ends. `open(taskId, values?, binding?)`, `close()`, `refresh()`, `setCatalog()`, and `destroy()` control its lifecycle.

A standard task entry does not have to stay visible after the user has chosen a task. Construct the card with `catalog: false`, add a button or row action on the page, then call `card.open(...)` when needed. `setCatalog(false)` hides the catalogue only when no run is active; it never dismisses an in-progress task or loses its values.

Tasks with `requiresRecord` are disabled in the generic list. A row or detail page opens them with a binding, which is why the card can show the selected record without asking the user for its id.

### Framework components

| Adapter | Conversation surface | Task view | Open a bound task |
| --- | --- | --- | --- |
| Vue 3 | `AgentInline` / `AgentDock` render the active guide; `#task` can override | Built-in guide; `AgentTaskCard` remains available at the lower level | Activate through the page or `pling_start_task`; a lower-level card can call `open(taskId, values?, binding?)` |
| React | `AgentChat` `task` prop or `AgentDock` `task` prop | `AgentTaskCard` | Call `open(taskId, values?, binding?)` on `AgentTaskCardHandle` |
| Vue 2.7 | `pling.dock({ task })` | `createTaskCard()` | Call `card.open(taskId, values?, binding?)` |
| Vanilla | `pling.dock({ task })` | `createTaskCard()` | Call `card.open(taskId, values?, binding?)` |

`AgentDock` also exposes `open()` and `close()`, so a row action can reveal the assistant before activating the relevant task. A normal Vue 3 page does not need a `#task` slot: the built-in assistant renders the active guide from the task catalog.

```vue
<template>
  <AgentDock ref="dock" layout="sidebar" sidebar-mode="fused" :default-open="true" />
</template>
```

Use the `#task` slot only when the product deliberately replaces the task presentation. It is not a required step for a normal business page.

```tsx
const dock = useRef<AgentDockHandle>(null);
const card = useRef<AgentTaskCardHandle>(null);

<AgentDock
  ref={dock}
  layout="sidebar"
  sidebarMode="fused"
  defaultOpen
  task={<AgentTaskCard ref={card} controller={tasks} onPrompt={pling.ask} />}
/>;
```

The full `createTaskPanel()` remains available for a dedicated task workspace. `GuidedTaskPanelOptions.variant` accepts `"panel"` or `"card"`; `createTaskCard()` is the shorthand for the latter.

## Structured quick tasks

`quick` still accepts plain strings. The structured form separates the button label from the prompt, so a short button does not force a vague instruction.

```ts
const quick: QuickTaskItem[] = [
  "Show this week's unpaid orders",
  {
    label: "Tidy today's list",
    prompt: "Review today's todos, archive completed items, and keep unfinished ones.",
    description: "Archives completed items and leaves the rest untouched.",
  },
];
```

`disabled: true` keeps an entry visible while the application knows it cannot run yet.

## Surface tasks

An external agent can receive the same business tasks as descriptive metadata:

```ts
const tasks: SurfaceTask[] = [{
  id: "order.approve",
  title: "Approve an order",
  steps: [{ action: "approve@order", label: "Approve this order" }],
  risk: "destructive",
  playbook: ["Read the order first", "Confirm the status before approving"],
}];
```

Surface tasks explain how capabilities fit together. They do not grant a capability, widen a session scope, or bypass approval. `invoke` still goes through the existing exporter, executor, and audit path.

## Error codes

| Code | Meaning | Recovery |
| --- | --- | --- |
| `TASK_FIELDS_REQUIRED` | Required values are missing | Complete the fields and run again |
| `TASK_ACTION_FAILED` | The bridge returned a business failure | Read the message, correct the cause, retry |
| `TASK_STEP_FAILED` | The bridge threw or rejected | Retry or change the task input |
| `TASK_FIELDS_REQUIRED` on an optional field | Not applicable; optional fields never block | Leave the field empty |

Unknown task ids, unknown field names, duplicate definitions, a missing bound record, and mutation after execution throw synchronously. Treat those as programming or host errors rather than user-facing failures.

## Current limits

- The task model does not provide a general planner or automatic step authoring.
- A task has one active run at a time; parallel business tasks need separate controllers.
- Step results are exposed to the host, but later steps receive values and the binding, not an automatic result chain.
- The DOM renderer is shared by Vue, React, Vue 2.7, and Vanilla. The framework components own only mounting and exposed methods; they do not copy the task state machine.
- The conversation card is an entry and progress surface. The page's original forms and controls remain the source of business input.
- Surface tasks are descriptive. An agent that needs more context must still call `describe` and obey the session scope.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/agent`, `@plingjs/vanilla`, `@plingjs/surface` `0.1.0-alpha.8` |
| Introduced | `0.1.0-alpha.6` |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later for the task controller |
| Peer dependencies | None |
| Stability | Experimental; snapshots may gain fields without changing existing meaning |

The task controller has no DOM dependency. `createTaskPanel` and `createTaskCard` are the reference renderers in `@plingjs/vanilla`; adapters render the same `TaskRunSnapshot` rather than reimplement execution.
