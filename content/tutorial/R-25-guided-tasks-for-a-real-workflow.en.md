---
id: R-25
title: "Guided tasks for a real workflow"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Guided tasks for a real workflow

React applications often expose a rich back-office page while the assistant still starts with an empty composer. Guided tasks reverse that order: the page states what this role can accomplish, then the assistant collects missing information from a normal sentence, explains the next step, and takes the person to the real field.

This chapter keeps the course back office. React owns rendering and the Hook or class lifecycle; the task definition, field derivation, executor, and guide action row come from `examples/shared/course-workspace/`. Neither React version copies the business rules.

## The page stays; the assistant carries the task

Creating a course is still the original form. The assistant panel contains no second set of inputs, only a compact action row:

```text
Pregnancy yoga, Chen, 2 stars, auto-fill the intro, monthly card
```

The model reads that as `name`, `teacherId`, `difficulty`, `intro`, and `cards`, then calls `pling_update_task` to update task working memory. The page subscribes to `TaskRunSnapshot` and writes the values into the original form. If the person edits the page directly, the next guide pass reads the new page value.

Field validation belongs to the page, not the conversation. A `TaskField` can declare `min` / `max`, `minLength` / `maxLength`, `pattern`, a closed `values` set, and a business `validate(value, values)` callback. The model can write only declared fields through `pling_update_task`; it cannot bypass validation or invent a cover that a person must upload.

## React only mounts the shared runtime

React 19 uses Hooks; React 16.3 uses classes and render props. Both mount the same `createCourseTaskRuntime`:

```tsx
React.useEffect(() => {
  taskRuntime.current = createCourseTaskRuntime({
    registry: pling.registry,
    ask: (prompt) => pling.ask(prompt),
    catalog: pling.task,
    service,
    locale,
    form: courseForm,
    onComplete: () => setRevision((value) => value + 1),
  });

  taskCard.current = createTaskCard(taskRuntime.current.controller, {
    locale: locale === "zh" ? "zh-CN" : "en-US",
    title: COPY[locale].taskPanelTitle,
    onPrompt: (prompt) => void pling.ask(prompt),
  });

  taskView.current = createCourseTaskView(taskCard.current, taskRuntime.current);
  taskHost.current?.replaceChildren(taskView.current.element);

  return () => {
    taskRuntime.current?.destroy();
    taskView.current?.destroy();
    taskCard.current?.destroy();
    courseForm.destroy();
  };
}, [pling, service, locale, courseForm]);
```

The component tree gains one task slot:

```tsx
<AgentDock
  title="Pling assistant"
  placeholder="Tell the assistant what to do, or continue this task…"
  layout="sidebar"
  sidebarMode="fused"
  defaultOpen
  debug={{ maxCalls: 8 }}
  task={<div ref={taskHost} />}
/>
```

`course-form.ts` remains the only business input surface. `course-guide.ts` owns locate, auto-fill, review, and cancel commands. React components contain no natural-language regex and do not decide which field to ask for next.

## A task is not a script

The course task declares a goal, constraints, success criteria, and a field list:

```ts
const courseTask: TaskDefinition = {
  id: "course.create",
  title: "Create a course",
  objective: "Help the person create a publishable course instead of walking a fixed field sequence.",
  constraints: [
    "The name, teacher, eligible cards, and cover are completion conditions; difficulty, intro, notes, deduction, and price are optional.",
    "The cover must be uploaded by the person; the assistant must not fake it.",
  ],
  successCriteria: ["The new course appears first in the catalogue", "The catalogue is read back after the write"],
  fields: [
    { name: "name", label: "Course name", minLength: 1, maxLength: 40 },
    { name: "teacherId", label: "Teacher", type: "lookup", searchAction: "search_teachers" },
    { name: "cards", label: "Eligible cards", type: "select", values: cardChoices },
    { name: "cover", label: "Course cover", type: "boolean", agentWritable: false },
  ],
  steps: [{ id: "course.save", label: "Write to the catalogue", action: "create_course", args: (values) => values }],
};
```

The model may answer questions, accept corrections, pause, or open a review when the information is sufficient. It cannot turn “the course name is still missing” into a whole sentence inside the name field, and it cannot bypass the permission and read-back checks around `create_course`.

## The page keeps the final move

The guide declares the commands the model may call:

```ts
const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "Create a course",
  welcome: "Describe the course in one go, or fill the page yourself; I will close the gaps.",
  agent: {
    review: "review-task",
    proposeSave: "propose-save",
    cancel: "cancel-task",
  },
  fields: () => courseCreateFieldNodes(locale, draft, teachers, skipped),
  steps: [{ id: "course.fill", label: "Create a course", title: "Create a course", description: "Write into the original form and let a person confirm the save." }],
};
```

- `pling_focus_field` locates and highlights; it never writes a value.
- `pling_review_task` opens a read-only review.
- `pling_propose_save` opens confirmation; it does not execute the write.
- `pling_cancel_task` ends the guide without rolling back values already written to the form.

While required fields are missing, **Confirm save** is absent. While the cover is missing, only **Upload cover** remains. After confirmation, the page re-reads every field, runs `create_course`, and checks that the first catalogue entry is the new course.

## Two React versions

Open the [React 19 course back office](/demos/course-workspace-react/?lang=en) and the [React 16.3 course back office](/demos/course-workspace-react16/?lang=en). They should behave identically:

- The create-course form opens on entry; chat shows only the compact action row, not a separate task panel.
- Entering “Pregnancy yoga, Chen, 2 stars, auto-fill the intro, monthly card” writes the values at once and resolves Chen to Chen Jing.
- Asking an unrelated question mid-task gets an answer; the question is not treated as the course name.
- “Change the difficulty to 4 stars” updates only the difficulty.
- An unknown teacher stops the assistant and lists candidates instead of silently replacing the name.
- Saving without a cover is blocked; after upload, confirmation puts the new course first and renders the deduction as `1`.
- Creating a second course keeps the first one, and the transcript remains scrollable.

React 16.3 has no Hooks, but its business result, task definition, and guide commands are identical to React 19. Only the class lifecycle and render-prop mounting differ.
