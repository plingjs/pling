---
id: R-25
title: "Guided tasks for a real workflow"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Guided tasks for a real workflow

React applications often expose a rich table but still begin the assistant with an empty composer. Guided tasks reverse the order: the page first offers the outcomes available to this role, then collects only the choices the person must make.

This chapter uses the same course management back office as the Vue path. React owns rendering and state; the shared task controller owns field collection and step order; the existing action or business service performs each step.

## Put task cards in the conversation

The task catalog belongs in the assistant conversation, not in a second utility app. Show a small set of stable outcomes, not every possible API. In the course management back office, “Create a course”, “Find a member's card”, “Create a teacher”, “Schedule a lesson”, and the row-level “Write a lesson note” cover most daily work. A generic composer remains available for requests that do not fit.

The task card should state the result and its example in ordinary language. Avoid showing action ids or parameter schemas; those are implementation details.

## Create the controller outside render

The controller can live for the mounted workspace. The bridge calls the application service that already validates the reference, shop scope, and permission.

```tsx
import { useRef } from "react";
import { AgentDock, AgentTaskCard, usePling } from "@plingjs/react";
import type { AgentDockHandle, AgentTaskCardHandle } from "@plingjs/react";
import { createTaskController, type TaskController } from "@plingjs/agent";

export function CourseWorkspace() {
  const pling = usePling();
  const dock = useRef<AgentDockHandle>(null);
  const card = useRef<AgentTaskCardHandle>(null);
  const tasks: TaskController = createTaskController({
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

  return (
    <AgentDock
      ref={dock}
      layout="sidebar"
      sidebarMode="fused"
      defaultOpen
      task={<AgentTaskCard ref={card} controller={tasks} onPrompt={pling.ask} />}
    />
  );
}
```

`AgentTaskCard` owns only the mount lifecycle. The fields, lookup, confirmation, and run state machine remain in the shared task controller, so the legacy entry can render the same DOM card without pretending Hooks exist. The dock uses a fused sidebar column, which keeps the page and the conversation visible together.

Open the [React 19 course back office](/demos/course-workspace-react/) to see course creation, the task definitions, duplicate-name lookup, and conflict failure running against the same business service. The React page only changes how the back office is rendered. On React 16.3, the [legacy back office](/demos/course-workspace-react16/) reaches the same outcomes through class components and render props.

The course-creation demo follows the business page more closely: it opens the existing “Create a course” form, and the assistant column only shows a four-step guide. Step one writes recommended values into the original form; step two selects the teacher and eligible cards; step three pauses while the user chooses a cover in the page; step four reads the page again and reviews it. The chat never duplicates the course fields. `examples/shared/course-workspace/course-guide.ts` owns the guide, while `course-form.ts` remains the only source of business input. Next actions use the shared compact row from `@plingjs/dom`: the button keeps a short verb, a long recommendation becomes a one-line preview, and the full value stays in the conversation, `title`, and `aria-label` so the recommendation cannot stretch the button.

Those four stages are the page's own presentation, not a script imposed on the task layer. `course.create` also declares `objective`, `constraints`, and `successCriteria`, and registers the same controller in the task catalogue with `pling.task.define`. The model can answer “What can you do?”, accept a correction such as “rename the course to Fat-burn yoga”, or call `pling_update_task` with only the delegated field when the user says “You pick the cards”. The page subscribes to `TaskRunSnapshot`, writes the change back to the original form, and re-derives the current stage. The actual save still goes through `create_course`, the executor, and a read-back.

The note task is opened from a schedule row, not from the four-card list. React reveals the dock first, then passes the selected lesson to the card as a binding, so the form never asks for an id:

```ts
dock.current?.open();
card.current?.open("lesson.note", {}, {
  record: { id: lesson.id, label: `${lesson.course} · ${lesson.date} ${lesson.time}` },
});
```

The definition sets `requiresRecord: true`, and its only field is the note text. If the binding is missing, the controller refuses to start instead of running against an empty id.

## Resolve people and records with labelled choices

A lookup result should contain a stable reference and a human label. When names collide, the description must tell them apart. A phone suffix, membership number, or recent course is more useful than a database id. The selected value never becomes authorization on its own.

```ts
const choices = students.map((student) => ({
  value: student.ref,
  label: student.name,
  description: `${student.maskedPhone} · ${student.recentCourse}`,
}));
```

The server resolves the submitted reference again and checks that it belongs to the current shop. A stale reference, a reference from another tenant, or a missing record must produce a visible failure.

Lookup fields can also be exposed as read actions. `registerTaskLookupActions(controller.list())` lets the assistant search by a name and receive the same labelled candidates as the UI. The model still cannot write until the subsequent action passes the existing scope and approval checks.

## Keep execution on the existing path

The task controller does not call `fetch`, click a DOM node, or approve a write. It sends an action name and arguments through `invoke`. That bridge can call the registry executor, an API-backed function action, or the Surface gateway.

Read-only lookups may use a compact API. Writes should use the application service that already owns validation, idempotency, notifications, and audit. After a write, verify the result through the existing expectation or a read-after-write step.

## Review the run in React

`AgentTaskCard` destroys the DOM card when the component unmounts, cancelling subscriptions and in-flight lookups. The task controller remains scoped to the workspace, so a new page can register a new set of tasks without inheriting the previous run.

Test the duplicate-name case, empty required fields, an unavailable time, a failed write, and cancellation. The UI should never turn a failed or cancelled run into a success message.

## Completion checklist

- A person can start work without writing a prompt.
- The component does not duplicate execution or permission logic.
- Lookup choices distinguish duplicate names.
- A row-level note task shows the bound lesson and asks only for the note.
- The task card is destroyed with the workspace.
- A write is verified after execution.
- Saving a note updates the row and the activity list.
- The same task definition can be rendered by a different adapter.

## Next step

Move from one task to a family only when each task has a distinct, stable outcome. For free-form requests, register an agent-mode task with a prompt template; for manual steps, pause and return control instead of simulating the person.

