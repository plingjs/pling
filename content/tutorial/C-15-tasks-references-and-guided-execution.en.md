---
id: C-15
title: "Tasks, references, and guided execution"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Tasks, references, and guided execution

An empty chat box asks the person to learn how to prompt. The application has not told them what it can do. That is a poor starting point for a booking desk, a back office or a support queue.

People usually know the outcome they want. They do not know the prompt, the action id, or the database key behind a customer record. A guided task turns the outcome into **goal + constraints + working memory**: the app states what should be reached, which boundaries must hold and what counts as done. The assistant then decides whether to answer, ask, execute, or wait for a person.

## Decide whether the task layer is needed

A short form usually does not need it. With `v-scope`, `v-record` and `v-tool`, the page declares regions, drafts and actions. The assistant can understand one sentence, operate real controls and verify the result. This is the smallest integration and the closest to existing business code.

The task layer solves a different set of problems:

- the flow crosses several pages and must retain progress;
- the job continues after a dialog closes or a route changes;
- the task needs a fixed entrance that can be started repeatedly;
- several steps share one working memory;
- an external agent needs an auditable playbook and completion boundary.

Add task declarations only when one of these applies.

| Situation | Recommended path |
| --- | --- |
| One page, stable fields, one save path | `v-scope` + `v-record` + `v-tool` |
| The outcome must survive a closed dialog | Add one `pling.task.goal()` |
| The job crosses routes and needs cancel/complete | `pling.task.goal()` |
| An external agent needs the same playbook | `pling.task.goal()` |
| Fields need validation, lookup or a fixed sequence | Advanced `TaskDefinition` + `TaskController` |

The first column is not a capability ladder. It is an integration-cost ladder. If page actions can express the job, do not write a task definition.

## A goal answers what the page cannot

Page actions explain what a button does and what an input accepts. They cannot explain whether the job still counts after the dialog closes.

A goal contains only:

```ts
const disposeGoal = pling.task.goal({
  id: "course.create",
  title: "Create a course",
  goal: "Create a course in the course workspace and read the catalogue back to confirm the new course is first.",
  constraints: [
    "The page's actions are the only way to operate it; do not invent a second form.",
    "The person must upload the cover.",
  ],
  successCriteria: [
    "The new course appears first in the catalogue",
    "Name, teacher, eligible cards and cover match what the person confirmed",
  ],
});
```

There is no field table, no step array and no execution callback. Fields come from the real page; execution goes through real actions.

A goal solves four things:

1. **Continuity**: after an explicit start, the goal stays active when the dialog or region disappears.
2. **Availability**: `route` and `scope` decide where it can be started.
3. **Lifecycle**: a person can cancel; the model can mark it complete when success criteria hold.
4. **External description**: Surface can receive the same goal, constraints and success criteria.

A goal does not grant permission. Every action keeps its own risk, confirmation, scope and audit. It does not save either. Saving is always the page's own action.

## The catalog decides what can start now

A page registers tasks with `pling.task.goal()` or `pling.task.define()`. The task catalog decides which tasks are available in the current context and keeps at most one active.

```ts
pling.task.goal({
  ...courseGoal,
  route: "/courses",
  scope: "course-catalogue",
});
```

- `route`: available only on a matching route;
- `scope`: available only while a region exists;
- `keepActive`: whether an explicitly started task survives a temporary context change;
- omitting both means the whole page, but a person or the model still has to start it.

Keeping availability in the catalog means the page and the assistant do not maintain separate answers. The page renders real controls, the catalog decides whether the task can start, and the executor decides whether an action may run.

## The assistant may choose a task, not invent one

Every turn, the model receives the available goals or tasks. When the person says “create a yoga course”, it can call the narrow `pling_start_task` action:

```json
{
  "task": "course.create"
}
```

The action accepts only a currently available task id. An unknown id returns `INVALID_ARGS`. The model cannot assemble a workflow that was never registered, and cannot bypass an action's own permissions.

While a goal is active, the model also sees `pling_complete_task`. It calls this only when success criteria hold. It closes the goal and writes no business data.

For advanced tasks, the model may also see `pling_update_task`, `pling_focus_field`, `pling_review_task`, `pling_propose_save` and `pling_cancel_task`. The task declaration decides which of these exist; they are not all open by default.

Three boundaries hold at once:

| Layer | Owns | Does not own |
| --- | --- | --- |
| Page | Real controls, regions, records, save handler | Intent matching, task scheduling |
| Task catalog | Availability, activation, cancel, complete | Business writes, relaxed permissions |
| Model | Understanding the turn, choosing actions, explaining results | Inventing actions, bypassing confirmation |

## Catch what the person already said

Creating a course needs many values. Asking one by one turns the conversation into a form interview. This example puts no intent classifier in the page and no fixed “what to ask next” script in the task.

The person says:

```text
Pregnancy yoga, Chen Jing, 2 stars, monthly card, write the intro
```

The model sees the goal, constraints, page actions, draft record and gaps. It treats the sentence as several values and calls page actions to write name, teacher, difficulty, eligible cards and introduction into the real form. Then it asks only for what is genuinely missing, such as the cover.

If a teacher is not in the list, it asks instead of substituting a similar name. If the person says “fill it however”, the action description allows a draft only under explicit delegation. Without that, it does not invent content.

Validation belongs to the page. Native `min` / `max`, the option set of a `select`, and disabled or read-only state are checked at write time. A wrong type, an unknown option or a missing field returns a reason instead of leaving a half-applied form.

## Resolve references into something a person can confirm

In a real task, people say “Li Na's membership card”, not `student_0018`. The model should not guess the key and the person should not type it.

Advanced tasks can declare a `lookup` field:

```ts
const studentField: TaskField = {
  name: "studentRef",
  label: "Student",
  type: "lookup",
  minChars: 2,
  searchAction: "search_students",
  lookup: async (query, { signal }) => api.searchStudents(query, { signal }),
};
```

The model calls `search_students`, receives the same candidates the person sees, and writes the confirmed result. Duplicate names must show candidates and masked details; it must not silently pick the first.

Small sets can use `values`. Large lists use asynchronous lookup so thousands of records never enter the context.

## Bind the selected record, not a hidden id

Many tasks start from a table row or a detail page. When the person clicks “write a note”, the page already knows which lesson or order is selected.

`TaskBinding` carries that page fact:

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
```

When `requiresRecord` is true and no record id exists, `start()` throws. A task list should show the task as an entrance, not allow it to start without context.

## Keep one execution path

The task layer does not create a second executor. Advanced task steps call registered actions through the same executor, confirmation and audit path.

```ts
const controller = createTaskController({
  invoke: (action, args, context) => executor.execute(action, JSON.stringify(args), context),
});
```

The goal path is simpler: it executes nothing. The model calls page actions directly and the executor handles each one.

Neither path allows a generic `click(selector)` or `eval` escape hatch. Every operation must be a narrow action the page declared.

## Make progress readable

People need to know what is happening, what is missing and whether something failed. The task snapshot carries that visible state.

| State | What it means | How to resume |
| --- | --- | --- |
| `collecting` | More information is needed | Fill the named fields |
| `ready` | Ready to run | Run or switch tasks |
| `running` | A step is executing | Wait or cancel |
| `waiting` | Waiting for confirmation or a human handoff | Confirm, or complete it on the page |
| `verifying` | The action returned; the host is checking the result | Review evidence, then continue |
| `done` | Finished | Review the result |
| `failed` | A step failed | Read the reason, retry or change input |
| `cancelled` | The person stopped the task | Start again when ready |

A goal has only running and completed. It has no field rail and no step controller. The UI shows the goal, cancel and completion, not fake form controls.

## Human steps and ambiguity

Some steps can only be done by a person: signatures, one-time codes, payment confirmation, or a visual choice that cannot be described reliably. The task should pause and return control rather than simulate a click.

Use `handoff` on a page action:

```ts
v-tool="{
  id: 'course_cover',
  desc: 'Upload the course cover',
  handoff: {
    reason: 'Choose a local image',
    expect: { desc: 'The page recorded the chosen cover', check: () => draft.cover }
  }
}"
```

The run enters waiting. The host observes the page and decides whether it completed. The model cannot choose the file or fake completion.

Ambiguity is different from a human step. When two students share a name, ask which one. When a lesson time conflicts, explain the conflict and offer another time. Do not silently substitute a record or leave a half-finished state.

## Failure is part of the contract

A save without required fields must not run. A failed write stops. An optional step may be skipped, but the person must see it. Cancellation aborts the current step and must not report success.

An action's `expect` verifies the result:

```ts
expect: {
  desc: "The new course appears first in the catalogue",
  check: () => courses.value[0]?.id === newCourseId.value,
}
```

The executor checks it after the action returns. A failed condition produces a visible reason. The result card shows the read-back evidence, not a pre-written success message.

## Where the implementation lives

Business task definitions stay in the application. The framework-neutral run model lives in `@plingjs/agent`. The action registry and executor stay in `@plingjs/core`. Task rendering belongs to adapters, not the agent loop.

The task catalog only handles availability, activation and command forwarding. Vue 3's `<AgentInline>` subscribes to the catalog and renders the guide. A business page does not need a second chat shell or a manually mounted task card.

Vue, React, Vue 2.7 and vanilla JS share one task model and one DOM renderer. There are no four execution engines.

The same goal can also be exposed to external agents through Surface `tasks`. The description is a map, not a key: it explains which capabilities form a job, but `invoke` still goes through the exposed list, session scope, approval and audit.

## Runnable examples

[Case 06: a persistent goal](/demos/course-workspace-vue3/?lang=en) registers one goal. The page is the original course workspace. The assistant opens the dialog, operates real fields, asks the person to upload the cover, saves, and reads the catalogue back.

[Case 07: directives only](/demos/course-create-directives-vue3/?lang=en) uses the same page without the task layer. It is the comparison: when page actions already express the job, no goal is needed.

Both examples include full source and integration notes on the [example page](/examples/course-workspace-vue3).

## Checklist

- A person can start without writing a prompt; a goal appears only where route and scope allow.
- Starting a goal does not open a dialog, fill a field or save.
- Every field maps to a real action a person can perform.
- Custom controls use real clicks or parameterised actions, not a second form.
- Duplicate lookup results require an explicit choice.
- Row tasks get the record from a binding, not a hidden input.
- Every write goes through the existing executor and a read-back check.
- The UI distinguishes success, failure, cancellation and human waiting.
- The page satisfies all success criteria before a goal is completed.
- Raw action ids and arguments appear only in diagnostics.
