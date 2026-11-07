---
id: J-15
title: "Guided tasks for a real workflow"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Guided tasks for a real workflow

A vanilla page does not need a framework to offer guided work. It needs a stable task definition, a conversation surface, and a bridge to the application's existing service. A task card then handles fields, lookup choices, progress, and errors without introducing a second execution path.

## Put the card in the assistant conversation

Use `createTaskCard()` when the task belongs to the assistant conversation. The business page remains interactive, and the original controls stay in place. The card is an additional entrance for the decisions and steps that are hard to discover from the page alone.

For a course desk, start with four titled outcomes in the card catalogue: create a course, find a member's card, create a teacher, and schedule a lesson. Keep each definition local to the page or import it from the application's own task module. A fifth outcome, writing a lesson note, lives on each schedule row because it needs a selected lesson.

## Bridge task steps to the business service

The controller receives one `invoke` function. That function decides whether a step reaches the action executor, a read-only API, or the application service. The card never receives direct access to the model or the network.

```ts
import { createTaskController } from "@plingjs/agent";
import { createTaskCard } from "@plingjs/vanilla";
import { courseApi } from "./course-api";

const tasks = createTaskController({
  invoke: (action, args) => courseApi.invoke(action, args),
});

tasks.register({
  id: "student.cards",
  title: "Find a member's card",
  fields: [
    {
      name: "studentRef",
      label: "Student",
      type: "lookup",
      lookup: (query) => courseApi.searchStudents(query),
    },
  ],
  steps: [
    { label: "Read the student", action: "get_student" },
    { label: "Read the cards", action: "get_student_cards" },
  ],
});

const card = createTaskCard(tasks, { locale: "en-US", catalog: false });
pling.dock({
  layout: "sidebar",
  sidebarMode: "fused",
  defaultOpen: true,
  task: card.element,
});
```

The same `invoke` boundary lets an application replace a DOM-backed action with an API-backed function action later. The task id and user-facing copy stay the same.

The [course back office](/demos/course-workspace/) is the runnable version of this chapter. It includes all five tasks, a rejected slot, and a course catalogue and schedule that update through the normal page renderer.

The course-creation demo follows the business page more closely: it opens the existing “Create a course” form, and the assistant column only shows a four-step guide. Step one writes recommended values into the original form; step two selects the teacher and eligible cards; step three pauses while the user chooses a cover in the page; step four reads the page again and reviews it. The chat never duplicates the course fields. `examples/shared/course-workspace/course-guide.ts` owns the guide, while `course-form.ts` remains the only source of business input. Next actions use the shared compact row from `@plingjs/dom`; a long recommendation stays a one-line preview instead of stretching the button.

Those four stages are the page's own presentation, not a script imposed on the task layer. `course.create` also declares `objective`, `constraints`, and `successCriteria`, and registers the same controller in the task catalogue with `pling.task.define`. The model can answer “What can you do?”, accept a correction such as “rename the course to Fat-burn yoga”, or call `pling_update_task` with only the delegated field when the user says “You pick the cards”. The page subscribes to `TaskRunSnapshot`, writes the change back to the original form, and re-derives the current stage. The actual save still goes through `create_course`, the executor, and a read-back.

The note task uses a record binding instead of a hidden id field:

```ts
tasks.register({
  id: "lesson.note",
  title: "Write a lesson note",
  requiresRecord: true,
  fields: [{ name: "note", label: "Note", type: "textarea" }],
  steps: [{
    label: "Save the note",
    action: "update_lesson_note",
    args: (values, binding) => ({ lessonId: binding.record?.id, note: values.note }),
  }],
});

dock.open();
card.open("lesson.note", {}, {
  record: { id: lesson.id, label: `${lesson.course} · ${lesson.date} ${lesson.time}` },
});
```

The definition refuses to start without a bound record. The form asks only for the note, and the controller shows the bound course in the task header.

## Keep lookup results safe and readable

Searching returns choices with a stable reference and a human label. If two students share a name, show a masked phone number or another useful distinction. The reference is resolved again on the server, including shop and session scope, before a write.

```ts
const lookup = (query: string) =>
  courseApi.searchStudents(query).then((students) =>
    students.map((student) => ({
      value: student.ref,
      label: student.name,
      description: student.maskedPhone,
    })),
  );
```

Do not expose the reference as an editable text field. If no result matches, say so; do not invent a record or fall back to the first row silently.

## Make the run observable

While a task runs, show the current step and its reason. When a write finishes, read it back or use a declared expectation. A failure should keep the selected input and the failed step visible so the person can retry or change the choice.

The card emits `pling-task-prompt` for agent-mode tasks and `pling-task-complete` when a deterministic task ends. A vanilla host can route the prompt to `pling.ask()` and refresh its own views from the complete event.

## Test the page without a model

Guided tasks are deterministic, so most checks need no model call. Test an empty field, a duplicate lookup, a successful write, a server rejection, and cancellation. Use the same task definition in the browser and in the unit test; the controller is framework-independent.

Destroy the card when the page or route is torn down. That cancels active work, aborts searches, and removes subscriptions while the business page continues to own its own DOM.

## Completion checklist

- The page presents outcomes before asking for a prompt.
- The task card is mounted in the assistant transcript; the page keeps its own controls.
- Search results are labelled and references are revalidated on the server.
- A row action receives its lesson through a binding rather than a text field.
- Step actions use the existing executor or business service.
- A failed write remains visible and recoverable.
- Saving a note updates the row and the activity list.
- No action id or raw argument appears in the ordinary interface.

## Next step

Add an agent-mode task for requests that cannot be described as a fixed sequence. Keep deterministic tasks for routine work, and let the person take over visual or manual steps instead of forcing the agent to simulate them.

