---
id: J-15
title: "Guided tasks for a real workflow"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Guided tasks for a real workflow

A vanilla page does not need a framework to offer guided work. It needs a stable business boundary, an assistant entry point, and a thin adapter that writes task working memory back into the existing form. The course back office keeps its original form, actions, and validation; the assistant understands the person, updates working memory, and explains what happens next.

## Create a course from one sentence, not a field-by-field quiz

The demo opens the existing **Create course** form on entry. A person can simply say:

```text
Pregnancy yoga, Chen, 2 stars, auto-fill the intro, monthly card
```

The model reads that as `name`, `teacherId`, `difficulty`, `intro`, and `cards`, then calls `pling_update_task` once. `runtime.ts` subscribes to `TaskRunSnapshot` and writes the changes back into the original form. The page contains no natural-language regex and never treats the whole sentence as a course name.

An unknown teacher makes the assistant stop and ask. The cover must be uploaded by the person. Cards, difficulty, and the intro can arrive in one sentence or be edited directly in the page. A mid-task question, a change of mind, or a pause remains ordinary conversation.

## A task is a goal, constraints, and working memory

`TaskDefinition` describes **what must be true**, not what to ask next. The course field list serves both the model and the page's gap calculation:

```ts
const courseTask: TaskDefinition = {
  id: "course.create",
  title: "Create a course",
  objective: "Help the person create a publishable course instead of walking a fixed field sequence.",
  constraints: [
    "The name, teacher, eligible cards, and cover are completion conditions; difficulty, intro, notes, deduction, and price are optional.",
    "The cover must be uploaded by the person; the assistant must not fake it.",
    "Every write still goes through the create_course action, executor, and read-back verification.",
  ],
  successCriteria: ["The new course appears first in the catalogue", "The catalogue is read back after the write"],
  fields: [
    { name: "name", label: "Course name", minLength: 1, maxLength: 40 },
    {
      name: "teacherId",
      label: "Teacher",
      type: "lookup",
      searchAction: "search_teachers",
      validate: (value) => teachers.some((teacher) => teacher.id === value) ? null : "Choose a teacher from the search results.",
    },
    { name: "cards", label: "Eligible cards", type: "select", values: cardChoices },
    { name: "cover", label: "Course cover", type: "boolean", agentWritable: false },
    { name: "difficulty", label: "Difficulty", type: "number", optional: true, min: 1, max: 5 },
  ],
  steps: [
    {
      id: "course.save",
      label: "Write to the catalogue and read it back",
      action: "create_course",
      args: (values) => values,
    },
  ],
};
```

Fields support `min` / `max`, `minLength` / `maxLength`, `pattern`, closed `values` sets, and a business `validate(value, values)` callback. These checks run before a value enters the task snapshot; the model can retry or rephrase, but it cannot bypass page validation.

`steps` only describes one deterministic business write. It is not a conversation script. Course creation has one `create_course` step; which fields to collect first, when to ask, and when to answer a question belongs to the model and the task's working memory.

## The page executes explicit commands only

The page does not parse what the person said. It executes declared UI commands. The shared runtime connects the task catalog, controller, and guide:

```ts
taskRuntime = createCourseTaskRuntime({
  registry: pling.registry,
  ask: (prompt) => pling.ask(prompt),
  catalog: pling.task,
  service,
  locale,
  form: courseForm,
  onComplete: () => render(),
});
```

`createCourseTaskRuntime` registers `course.create`, `teacher.create`, and `course.schedule`, then creates the course guide. The guide exposes a small set of commands:

- `focus-*` scrolls to and highlights a real field;
- `use-suggestion` / `apply-*` writes a recommendation into the existing control;
- `skip-field` skips an optional value;
- `start-review` / `review-task` opens the read-only review;
- `propose-save` opens confirmation without writing;
- `cancel-task` ends the guide.

The model-facing tools are `pling_focus_field`, `pling_review_task`, `pling_propose_save`, and `pling_cancel_task`. They pass through the same permission, audit, and availability checks as any action. A command that the guide does not declare in `guide.agent` never reaches the model.

## Mount it in the vanilla assistant

The vanilla entry only connects the existing page, the task runtime, and the assistant dock:

```ts
import { createTaskCard } from "@plingjs/vanilla";
import {
  createCourseTaskRuntime,
  createCourseTaskView,
} from "../../../shared/course-workspace/runtime";

taskRuntime = createCourseTaskRuntime({
  registry: pling.registry,
  ask: (prompt) => pling.ask(prompt),
  catalog: pling.task,
  service,
  locale,
  form: courseForm,
});

taskCard = createTaskCard(taskRuntime.controller, {
  locale: locale === "zh" ? "zh-CN" : "en-US",
  title: copy.taskPanelTitle,
  onPrompt: (prompt) => void pling.ask(prompt),
});

const taskView = createCourseTaskView(taskCard, taskRuntime);
dock = pling.dock({
  title: "Pling assistant",
  layout: "sidebar",
  sidebarMode: "fused",
  defaultOpen: true,
  task: taskView.element,
  mount: document.querySelector("#dock-mount")!,
});
```

`course-form.ts` remains the only business input surface. When the person clicks **Auto-fill**, the page writes the recommendation into the real control. When they edit the form directly, the next guide pass reads the new page value. Chat never grows a second course form.

## Saving needs a human confirmation

The final step is not the model declaring success. It is a real write from the page:

1. While required fields are missing, the action row offers locate, auto-fill, or skip; **Confirm save** is absent.
2. While the cover is missing, only **Upload cover** remains, pointing at the real file input.
3. When the person clicks **Confirm save**, the page re-reads every field and calls `controller.run()`.
4. `create_course` is registered with `modelVisible: false`, so the model cannot bypass confirmation.
5. After the write, the catalogue is checked; the new course must be first before the task is complete.

After the first course, **Do it again** keeps the first course in the catalogue and starts the second through the same task. Once the transcript overflows, it still scrolls up and down.

## Check it in the browser

Open the [vanilla course back office](/demos/course-workspace/?lang=en) and verify:

- The create-course form opens on entry; the assistant shows only a compact action row, not a separate task panel.
- Entering “Pregnancy yoga, Chen, 2 stars, auto-fill the intro, monthly card” writes the values into the form and resolves Chen to Chen Jing.
- Asking an unrelated question mid-task gets an answer; it is not treated as the course name.
- Saying “change the difficulty to 4 stars” updates only that value.
- An unknown teacher stops the assistant and lists available teachers; it is not silently replaced.
- Saving without a cover is blocked; after uploading one, **Confirm save** appears.
- Confirming puts the new course first and renders the deduction as `1`.
- Creating a second course keeps the first one, and the transcript remains scrollable.

## Minimum integration order

1. Declare fields, validation, actions, and read-back evidence with `TaskDefinition`.
2. Declare welcome copy, the field list, and `agent` commands with `TaskGuideDefinition`; `steps` names business stages, not a per-field script.
3. Register the task with `pling.task.define()` or the shared runtime, declaring `route`, `scope`, and `autoStart`.
4. Implement explicit page commands: locate, use a suggestion, skip, review, confirm save, cancel.
5. Read business data back before showing completion.

React, Vue 3, Vue 2.7, and vanilla share the same task definition, field derivation, and action row. Only the adapter mount changes.
