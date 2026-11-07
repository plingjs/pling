---
id: C-15
title: "Tasks, references, and guided execution"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Tasks, references, and guided execution

A chat box asks the user to explain the work before the application has shown what it can do. That is a poor starting point for a booking desk, an admin console, or a support queue. The person usually knows the outcome, not the prompt, the action id, or the database key behind a customer record.

Guided Tasks turn that outcome into a goal with constraints and working memory. The application names the task, states what completion means and which boundaries apply, asks only for decisions that are still missing, resolves references such as a student or course, and reports what happened. Deterministic business writes may still use ordered steps, but the conversation is not a field-by-field script. The agent handles questions, corrections, delegated choices, and exceptions against the same task state.

## Why a task layer is separate from the agent loop

The agent loop decides what to do next from context. A routine business task should not be reinvented every time, but it should also not be reduced to `next field`. The application declares the objective, constraints, success criteria, and fields that matter. The model reads that state as working memory and decides whether this turn should answer, ask, update one value, pause, or leave the task untouched.

The task layer also gives the interface something the chat transcript cannot: a stable list of entrances. A new employee can see “Find a member's card” or “Schedule a lesson” without learning how to prompt for them.

A task existing is not the same as a task always being available. On a real page, availability depends on the route, an open dialog, a selected row, and the current user's permissions. Spreading those checks through components creates two versions of the truth: one on the page and one in the assistant. A task catalog centralizes that decision.

### The catalog owns “what is legal right now”

The page registers a task with `pling.task.define()` and declares its context:

```ts
pling.task.define({
  definition: courseTask,
  guide: courseGuide,
  controller,
  route: "/courses",
  scope: "create-course-form",
  autoStart: true,
  onCommand,
});
```

- `route` makes the task available only on a matching route;
- `scope` makes it available only while a region or dialog exists;
- `autoStart` opens its guide when the context matches;
- omitting both means a global task, still opened explicitly by the page or the assistant.

The catalog stores registrations and the active guide. It never executes the task. Writes still go through `controller` and the existing executor.

### The assistant chooses from the catalog; it cannot invent tasks

Each turn, the model receives the currently available tasks, their fields, and a summary of their steps. When the user says “create a yoga course”, it may call one narrow action, `pling_start_task`:

```json
{
  "task": "course.create",
  "values": { "name": "Yoga foundations", "teacherId": "teacher_zhoumin" }
}
```

The action accepts only ids that are available right now, and `values` may contain only fields declared by that task. An unknown id or field returns `INVALID_ARGS`. Supplied values prefill a task run; they do not bypass the action's permission, confirmation, or audit path.

Today this means “the assistant starts a run of a registered task”. Once active, it may update the run through the separate `pling_update_task` action. That action writes only the active task's declared, agent-writable fields; it does not execute the business write. A page can subscribe to the run snapshot and mirror the values into its original form. If a later version composes new workflows, it must register task templates, validate them, and ask the user before they enter the same catalog. The model must not assemble arbitrary action sequences into a task definition.

The separation is deliberate:

| Layer | Owns | Must not own |
| --- | --- | --- |
| Application task definition | Goal, constraints, success criteria, fields, lookup sources, deterministic steps | DOM selectors or model transport |
| Task run | Collected values, progress, errors, cancellation | A second permission system |
| Existing action executor | Availability, confirmation, execution, verification | Business task names |
| Agent loop | Ambiguous requests and exception handling | The only path to routine work |

## Describe only the decisions a person can make

A task field is not a database column. It should exist because the person must choose something. The current shop, operator, request time, and authorization scope come from the session and server. A customer identifier comes from a selected row, a search result, or a stable reference resolved by the server.

The following definition asks for a student and a membership card. It does not ask for `shopId`, `operatorId`, or a raw student primary key.

```ts
import { createTaskController } from "@plingjs/agent";

const tasks = createTaskController({
  invoke: (action, args) => businessApi.invoke(action, args),
});

tasks.register({
  id: "student.cards",
  title: "查看学员会员卡",
  description: "按姓名或手机号找到学员，再读取会员卡。",
  objective: "Find the right student and show the cards they can actually use.",
  constraints: ["Ask the person to choose when names are ambiguous."],
  successCriteria: ["The cards belong to the student the person confirmed."],
  fields: [
    {
      name: "studentRef",
      label: "学员",
      type: "lookup",
      recommended: "student_li_na",
      lookup: (query) => businessApi.searchStudents(query),
    },
  ],
  steps: [
    { label: "读取学员", action: "get_student" },
    { label: "读取会员卡", action: "get_student_cards" },
  ],
});
```

The action names still belong to the existing registry or business service. The task controller passes arguments to the host's `invoke` function; it does not execute DOM operations, approve itself, or reinterpret permission.

### Accept what the user already said

A guided task is not a field-by-field questionnaire. When the user says “pregnancy yoga, Chen, 2 stars, write the intro”, the page should write every explicit value at once, then ask only for what is missing, conflicting, or must be done by a person. Prompting for one field at a time makes the assistant feel like a chat-shaped form and is slower than using the page directly. If the user says “you choose the card”, the model may use a declared `recommended` value for that one field even while other required fields are empty; the recommendation is a suggestion, not an automatic write.

Field values do not need a page-side intent classifier first. The model receives the active task's fields, current values, and gaps, then calls `pling_update_task` with the values it understood from the whole sentence. The page only checks that each value belongs to a declared field, matches its type, and satisfies its business constraints. A failed check writes no partial value; the model can retry or ask the person. A follow-up such as “change the difficulty to 4 stars” is likewise a correction to the current task, not a new creation request. The model decides what was meant using working memory; the page does not maintain a parallel set of regular expressions or keywords.

## Resolve references before they become IDs

People recognize names, rows, and recent activity. APIs require stable references. A guided task should cross that boundary without making the person or the model guess.

| Source | Example | Interface |
| --- | --- | --- |
| Current selection | A row on a student detail page | Bind the row context; do not ask for its id |
| Small closed set | Lesson types or card templates | A select field with labelled values |
| Large collection | Students or courses | A lookup with a search function |
| Server fact | Shop, operator, request time | Derive on the server; never expose as a field |

A lookup returns labelled choices. The selected value may be an opaque reference, but the choice must include enough human context to distinguish duplicates. Two students named “Li Na” need different phone suffixes, membership numbers, or recent lesson dates. Selecting the first result is not a safe default for a write operation.

References also expire. A reference obtained before a page reload may no longer be valid, and a reference from one shop must not be accepted by another. The server resolves the reference again before executing the write. The browser-side choice is an intent, not a grant of authority.

## Bind the selected record instead of asking for its id

The strongest reference is the one the page already has. If a staff member opens a lesson row and chooses “Write a note”, the lesson id is not a question for the form; it is a fact of the current view. Supplying it through `start(id, values, binding)` keeps it out of user input and out of the model prompt.

Use `requiresRecord: true` when the task cannot work without that selection. A generic task list can still show the card, but it must open it from a row or detail page rather than starting an empty run. Inside a step, `args(values, binding)` reads `binding.record?.id`; the form only asks for the note. This is also safer for the model: it never has to guess or repeat an opaque id.

## Keep one execution path

A task step refers to an existing action. The action may be backed by a button, a function-level tool, an application API, or a governed Surface call. This lets an application start with the visible workflow and later move a step to a read-only API without changing the task's language or the user's mental model.

Reading data is usually better through a read-only API: it is faster and avoids scrolling a table just to answer a question. Writing is usually better through the application's service layer so existing validation, idempotency, audit, and notifications still run. Visual work such as cropping an image, entering a one-time code, or dragging a schedule stays in the UI.

The rule is not “API first” or “DOM first”. The rule is that the task must use the same business boundary as a person using the page. A successful task is not an HTTP 200; it is observable after the write, through a reload, a read-after-write check, or a declared expectation.

## Make progress legible

The task interface should answer four questions without exposing implementation detail:

1. What is the user trying to finish?
2. What does the application need from them?
3. Which step is running now, and why?
4. What changed, or why did it stop?

Step labels should be written for people: “Check the time slot”, “Create the lesson”, “Verify the card balance”. Raw action ids, argument objects, and stack traces belong in diagnostics. The same distinction applies to errors. Show the cause and the next safe action; keep internal codes available for support.

Progress has three distinct moments that are easy to merge by accident. `planned` means the route is fixed but nothing has run. `running` means a call is in flight. `verifying` means the call returned and the page is being checked for evidence. A task that shows only “running” cannot tell the user whether the write actually happened.

Task-level confirmation is also separate from action approval. The task asks “should this plan proceed?”; the executor still asks whether the individual write is allowed. Neither can override the other. A `waitingFor: "confirmation"` snapshot is resolved with `confirm()`, while `waitingFor: "handoff"` waits for a person to finish work in the page.

## Pause for human work and ambiguity

Some steps require a person: a signature, a verification code, a payment confirmation, or a visual choice that cannot be described reliably. The task should pause and return control instead of simulating the action. After the person finishes, the flow resumes from the next step, not from the first one.

Mark such a step with `handoff`. The run enters `waitingFor: "handoff"`, and the host is responsible for observing the page and deciding that the work is done. A long-running bridge can use `context.report("waiting", "handoff")` or `report("verifying")` for the same reason: the UI should reflect the real sub-state, not a generic spinner.

Ambiguity is different from manual work. If two students match, ask which one. If a requested course is unavailable, explain the conflict and offer another time. Do not silently choose a different record or create a partial result. The task run should end in a visible, recoverable state.

## Failure is part of the contract

A run moves from collecting to ready, then through running to done, failed, or cancelled. A required field prevents execution. A failed write stops the flow. An optional enrichment step may be skipped, but that decision must be visible. Cancellation aborts the work in progress and must not be reported as success.

| State | User-visible meaning | Recovery |
| --- | --- | --- |
| `collecting` | More information is needed | Complete the named field |
| `ready` | The task can start | Run it or choose another task |
| `running` | A step is in progress | Wait or cancel |
| `done` | The steps completed | Review the result |
| `failed` | A step failed | Read the cause; retry or change input |
| `cancelled` | The person stopped the run | Start again when ready |

## Where the implementation lives

The business definitions live with the application. The framework-independent run model lives in `@plingjs/agent`. The existing action registry and executor remain in `@plingjs/core`. Task rendering belongs to the adapter layer, not the agent loop. This keeps the same task model available to Vue, React, Vue 2, and Vanilla without four execution engines.

The catalog lives in `@plingjs/agent`; it only decides availability, activation, and command routing. The adapter decides where the active guide appears. Vue 3's `<AgentInline>` subscribes to the catalog and renders the guide automatically, so a business page does not have to rebuild chat chrome or mount a task card by hand. Use the `#task` slot only when a product deliberately needs a different presentation.

`@plingjs/vanilla` still exposes lower-level renderers such as `createTaskPanel()` and `createTaskCard()` for vanilla pages or custom layouts. They share the same task run, lookup, confirmation, and failure handling; there is no second execution engine.

The compact row for the next actions is provided by `@plingjs/dom`, not copied into each adapter. `GuideActionItem` reduces an action to one line: short label, business command, optional kind. A long recommendation lives in `preview`, ellipsised on one line, while the full value stays in the conversation, `title`, and `aria-label`. The button width is therefore not decided by business copy, and the row cannot push the conversation away. The renderer only emits a command; writing a field, locating it, and calling the executor remain the host's job.

Lookup fields can also become read actions through `registerTaskLookupActions`. The model then searches by a human name before it writes, using the same candidates the person sees. This closes the gap between “the model knows an id is required” and “the person knows which row they mean”.

The same task can be described to an external agent through Surface `tasks`. That description is a map, not a key: it explains which capabilities belong together, but `invoke` still passes through the existing export allowlist, session scope, approval, and audit.

## Runnable reference

The [course back office](/demos/course-workspace/) puts these ideas on one page: course creation, duplicate-name lookup, a teacher-creation form, a slot-conflict failure, a bound lesson-note task, and a catalogue and schedule that update while the card runs. Read the [source and integration notes](/examples/course-workspace) after trying the five tasks.

The course-creation demo follows the business page more closely: it opens the existing “Create a course” form, and the assistant carries the task in chat. A person can describe the whole course in one sentence; the model understands the fields and calls `pling_update_task`, the page validates them and writes the accepted values into the original form, and the assistant asks only for what is still missing. An unknown teacher, an invalid difficulty, or a cover that must be uploaded by hand is located on the original form. This example deliberately sets `task-placement="none"` to hide the built-in task card and field rail: the course form is already continuous, so a second rail above the conversation would create a parallel path to the same job. Field gaps, suggestions, locating, and review actions live in the action row at the end of the conversation. Once the values are complete, the conversation shows a read-only review and a confirm action, then reads the result back from the catalogue. `examples/shared/course-create/guide.ts` owns the guide copy, field state, and page commands; `CourseWorkspace.vue` remains the only source of business input. `legacy-intake.ts` is a historical snapshot of the earlier deterministic parser and is no longer imported by the live demo.

## Verification checklist

- The user can start a task without writing a prompt; a task appears only when its route and scope match.
- Every field corresponds to a decision the user can make.
- Duplicate lookup results require an explicit choice.
- The server validates the selected reference and its shop/session scope.
- A row-level task receives its record through a binding, not a hidden text field.
- Each step calls the existing action or business service; the assistant may choose a registered task but cannot invent an id or field.
- The interface distinguishes success, failure, cancellation, and skipped optional work.
- `planned`, `running`, and `verifying` are not collapsed into one label.
- A write is verified after execution, not inferred from a successful request.
- Raw action ids and arguments appear only in diagnostics.

