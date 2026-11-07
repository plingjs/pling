---
id: V2-09
title: "Guided tasks for a real workflow"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Guided tasks for a real workflow

A Vue 2.7 application can expose the same guided tasks as its Vue 3 counterpart. The business page keeps the options API and the controls staff already use. The shared task controller collects the decisions that cannot be inferred from the page, while the existing service still validates and performs each write.

The course back office uses four tasks that can start from the card catalogue, plus one task that starts from a schedule row. The row-level task is the important difference: the selected lesson is page context, not a value the user should type.

## Start with outcomes, not action ids

Show the stable outcomes for the current role. In the course back office, a staff member sees “Create a course”, “Find a member's card”, “Create a teacher”, and “Schedule a lesson”. The fifth outcome, “Write a lesson note”, belongs beside a lesson because it needs a lesson first.

Task titles, field labels, and examples should use the language of the desk. Action ids and parameter schemas remain implementation details for the debug view.

## Mount the shared card from Vue 2

The DOM card is independent of Vue's renderer. Vue 2 owns the component lifecycle; the controller and card are created after mount and released in `beforeDestroy`. The card is passed into the assistant dock's `task` option, so it appears in the conversation instead of taking over a separate region of the page.

```vue
<script>
import { createTaskController } from "@plingjs/agent";
import { createTaskCard, registerTaskLookupActions } from "@plingjs/vanilla";
import { courseApi } from "./course-api";

export default {
  name: "CourseTasks",
  data() {
    return { card: null, dock: null, stopLookups: null };
  },
  mounted() {
    this.tasks = createTaskController({
      invoke: (action, args) => courseApi.invoke(action, args),
    });
    this.tasks.register({
      id: "student.cards",
      title: "Find a member's card",
      fields: [{
        name: "studentRef",
        label: "Student",
        type: "lookup",
        searchAction: "search_students",
        lookup: (query) => courseApi.searchStudents(query),
      }],
      steps: [{ label: "Read the cards", action: "get_student_cards" }],
    });
    this.stopLookups = registerTaskLookupActions(
      this.$pling,
      this.tasks.list(),
    );
    this.card = createTaskCard(this.tasks, {
      locale: "en-US",
      catalog: false,
    });
    this.dock = this.$pling.dock({
      layout: "sidebar",
      sidebarMode: "fused",
      defaultOpen: true,
      task: this.card.element,
    });
  },
  beforeDestroy() {
    this.stopLookups?.();
    this.card?.destroy();
    this.dock?.destroy();
  },
};
</script>
```

The controller does not make the Vue instance reactive, and it does not copy the action registry. It publishes snapshots; the card subscribes to that one run. Vue 2 remains responsible for rendering the page and passing in the application service.

## Bind a row to its task

The note task declares `requiresRecord: true`. The definition has only the note field, and its step reads the lesson id from the binding supplied by the page.

```ts
this.tasks.register({
  id: "lesson.note",
  title: "Write a lesson note",
  requiresRecord: true,
  fields: [{ name: "note", label: "Note", type: "textarea" }],
  steps: [{
    label: "Save the lesson note",
    action: "update_lesson_note",
    args: (values, binding) => ({
      lessonId: binding.record?.id,
      note: values.note,
    }),
  }],
});

openNote(lesson) {
  this.dock.open();
  this.card.open("lesson.note", {}, {
    record: {
      id: lesson.id,
      label: `${lesson.course} · ${lesson.date} ${lesson.time}`,
    },
  });
}
```

Without a non-empty record id, `start()` rejects the run instead of executing with an empty lesson id. Generic task lists also show this task as an entry point that must be opened from a record, not as a card that can run by itself. The form asks only for the note, and the task header shows the bound lesson.

## Use lookups instead of raw ids

People know a student's name or phone number, not `studentId`. A lookup should return labelled choices; when two students share a name, include enough masked information to distinguish them.

```ts
const search = (query) =>
  courseApi.searchStudents(query).then((students) =>
    students.map((student) => ({
      value: student.ref,
      label: student.name,
      description: student.maskedPhone,
    })),
  );
```

The selected `ref` is still not authorization. The server resolves it again and checks the current shop, session, and permission before reading cards or writing a lesson. A missing, stale, or cross-shop reference must fail visibly.

`registerTaskLookupActions` exposes the same lookup as a narrow read action for the assistant. It does not expose a general table query, and it does not bypass the write action's own approval path.

## Keep execution in the business boundary

The task bridge may call an existing function action or the application service. Do not put a second model loop, a second permission check, or a direct `fetch` inside the Vue 2 component.

After a write, read the result back or use the action's expectation. A failed required step stops the run and stays visible; an optional step may be marked skipped. The run must not turn a server failure or cancellation into success.

## Verify in a real Vue 2.7 build

Open the [Vue 2.7 course back office](/demos/course-workspace-vue2/) and check the following:

The course-creation demo follows the business page more closely: it opens the existing “Create a course” form, and the assistant column only shows a four-step guide. Step one writes recommended values into the original form; step two selects the teacher and eligible cards; step three pauses while the user chooses a cover in the page; step four reads the page again and reviews it. The chat never duplicates the course fields. `examples/shared/course-workspace/course-guide.ts` owns the guide, while `course-form.ts` remains the only source of business input. Next actions mount the same compact row from `@plingjs/dom` in Vue 2.7, React, and plain DOM.

Those four stages are the page's own presentation, not a script imposed on the task layer. `course.create` also declares `objective`, `constraints`, and `successCriteria`, and registers the same controller in the task catalogue with `pling.task.define`. The model can answer “What can you do?”, accept a correction such as “rename the course to Fat-burn yoga”, or call `pling_update_task` with only the delegated field when the user says “You pick the cards”. The page subscribes to `TaskRunSnapshot`, writes the change back to the original form, and re-derives the current stage. The actual save still goes through `create_course`, the executor, and a read-back.

- The assistant conversation shows business task cards without requiring a prompt.
- Searching a duplicate name shows both candidates and their distinguishing details.
- “Write a lesson note” opens from a schedule row and displays that lesson in the task header.
- Starting a task with no selected student keeps the run action unavailable.
- A successful schedule shows a human result and completed steps.
- A server rejection keeps the failed step and its message on screen.
- Saving a note updates the row and the activity list, with no lesson id in the form.
- Leaving the component destroys the card and aborts pending lookup work.

Run the page with Vue 2.7, not Vue 3 compatibility mode. The shared card should use the same snapshots, messages, and failure behavior as the Vue 3 chapter.

## Completion checklist

- The controller is created after the component mounts and released when it is destroyed.
- The card catalogue contains four stable tasks; the row-level note task is opened with a binding.
- Task fields use lookup or labelled choices rather than raw ids.
- Steps call the existing business boundary.
- A failed or cancelled run is not shown as success.
- The same task definition remains valid without Vue 2.

## Next step

When the role has several stable tasks, move their definitions into the application's own task module and keep Vue focused on layout and business state. For free-form requests, add an agent-mode task with a prompt template rather than inventing a deterministic path.
