---
id: V2-09
title: "Guided tasks for a real workflow"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Guided tasks for a real workflow

Vue 2.7 can provide the same guided workflow as Vue 3, React, and vanilla JavaScript without rewriting the application in Vue 3. The business page keeps its existing form, service, and validation. Vue 2.7 owns component lifecycle and rendering; the task definition, field derivation, executor, and action row come from the shared `examples/shared/course-workspace/`.

This chapter keeps the course back office. Opening the page opens the existing **Create course** form. The assistant does not duplicate those fields; it understands a normal sentence, writes the changes back into the original form, and stops where a person must decide.

## Read one course description, not a field-by-field quiz

Creating a course normally requires many fields. A field-by-field interrogation would push the person back into form filling, so this example does not put natural-language regex or a keyword table in the page. A person can simply say:

```text
Pregnancy yoga, Chen, 2 stars, auto-fill the intro, monthly card
```

The model receives the active task's `objective`, `constraints`, field list, current values, gaps, and guide stage. It reads the sentence as `name`, `teacherId`, `difficulty`, `intro`, and `cards`, then calls `pling_update_task` once. The page subscribes to `TaskRunSnapshot` and mirrors the values into the original form.

If the teacher is not in the list, the assistant stops and lists candidates. If the cover is missing, it locates the upload control and leaves file selection to the person. A mid-task question, a change of mind, or a pause remains ordinary conversation. Task state is working memory, not a script that must run to the next step.

Field validation belongs to the page. A `TaskField` supports `min` / `max`, `minLength` / `maxLength`, `pattern`, a closed `values` set, and a business `validate(value, values)` callback. The model can write only declared fields through `pling_update_task`; a wrong type, an unknown teacher, or an out-of-range difficulty fails without leaving a half-applied form.

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
    { name: "teacherId", label: "Teacher", type: "lookup", searchAction: "search_teachers" },
    { name: "cards", label: "Eligible cards", type: "select", values: cardChoices },
    { name: "cover", label: "Course cover", type: "boolean", agentWritable: false },
  ],
  steps: [{ id: "course.save", label: "Write to the catalogue and read it back", action: "create_course", args: (values) => values }],
};
```

`steps` describes one deterministic business write. It is not a conversation script. Which fields to collect first, when to ask, and when to answer a question belongs to the model and the task's working memory.

## Vue 2.7 only mounts the shared runtime

This example uses the Composition API available in Vue 2.7 and a render function. `onMounted` creates the shared task runtime, and `Vue.nextTick` ensures the dialog scope is mounted before the task activates:

```ts
import { Vue, onBeforeUnmount, onMounted } from "./vue2-runtime";
import { createTaskCard } from "@plingjs/vanilla";
import {
  createCourseTaskRuntime,
  createCourseTaskView,
} from "../../../shared/course-workspace/runtime";

onMounted(() => {
  void Vue.nextTick(() => {
    taskRuntime = createCourseTaskRuntime({
      registry: pling.registry,
      ask: (prompt) => pling.ask(prompt),
      catalog: pling.task,
      service,
      locale,
      form: courseForm,
      onComplete: () => { version.value += 1; },
    });

    taskCard = createTaskCard(taskRuntime.controller, {
      locale: zh ? "zh-CN" : "en-US",
      title: copy.value.taskPanelTitle,
      onPrompt: (prompt) => void pling.ask(prompt),
    });

    taskView = createCourseTaskView(taskCard, taskRuntime);
    dock = pling.dock({
      title: "Pling assistant",
      layout: "sidebar",
      sidebarMode: "fused",
      defaultOpen: true,
      task: taskView.element,
      mount: root.querySelector<HTMLElement>("#dock-mount"),
    });
  });
});

onBeforeUnmount(() => {
  taskRuntime?.destroy();
  taskView?.destroy();
  taskCard?.destroy();
  dock?.destroy();
});
```

`course-form.ts` remains the only business input surface. When the person clicks **Auto-fill**, the page writes the recommendation into the real control. When they edit the form directly, the next guide pass reads the new page value. Chat never grows a second course form.

## The page executes explicit commands only

The page does not parse what the person said. It executes declared UI commands. The course guide exposes a small set:

- `focus-*` scrolls to and highlights a real field;
- `use-suggestion` / `apply-*` writes a recommendation into the existing control;
- `skip-field` skips an optional value;
- `review-task` opens the read-only review;
- `propose-save` opens confirmation without writing;
- `cancel-task` ends the guide.

The model-facing tools are `pling_focus_field`, `pling_review_task`, `pling_propose_save`, and `pling_cancel_task`. They pass through the same permission, audit, and availability checks as any action. A command that the guide does not declare in `guide.agent` never reaches the model.

## Saving needs a human confirmation

The final step is not the model declaring success. It is a real write from the page:

1. While required fields are missing, the action row offers locate, auto-fill, or skip; **Confirm save** is absent.
2. While the cover is missing, only **Upload cover** remains, pointing at the real file input.
3. When the person clicks **Confirm save**, the page re-reads every field and calls `controller.run()`.
4. `create_course` is registered with `modelVisible: false`, so the model cannot bypass confirmation.
5. After the write, the catalogue is checked; the new course must be first before the task is complete.

After the first course, **Do it again** keeps the first course in the catalogue and starts the second through the same task. Once the transcript overflows, it still scrolls up and down.

## Check it in the browser

Open the [Vue 2.7 course back office](/demos/course-workspace-vue2/?lang=en) and verify:

- The create-course form opens on entry; the assistant shows only a compact action row, not a separate task panel.
- Entering “Pregnancy yoga, Chen, 2 stars, auto-fill the intro, monthly card” writes the values into the form and resolves Chen to Chen Jing.
- Asking an unrelated question mid-task gets an answer; it is not treated as the course name.
- Saying “change the difficulty to 4 stars” updates only that value.
- An unknown teacher stops the assistant and lists available teachers; it is not silently replaced.
- Saving without a cover is blocked; after uploading one, **Confirm save** appears.
- Confirming puts the new course first and renders the deduction as `1`.
- Creating a second course keeps the first one, and the transcript remains scrollable.

## The Vue 2.7 boundary

Vue 2.7 is the last Vue 2 release with the Composition API, so this example can reuse the task model and DOM action row from the Vue 3 chapter. Vue 2.6 and earlier do not have that API; do not install `@plingjs/vue2` and expect the same lifecycle bridge. Treat the page as vanilla JavaScript with `@plingjs/vanilla`. The task definition and `course-form.ts` do not need to be rewritten.

## Minimum integration order

1. Declare fields, validation, actions, and read-back evidence with `TaskDefinition`.
2. Declare welcome copy, the field list, and `agent` commands with `TaskGuideDefinition`; `steps` names business stages, not a per-field script.
3. Register the task with `pling.task.define()` or the shared runtime, declaring `route`, `scope`, and `autoStart`.
4. Implement explicit page commands: locate, use a suggestion, skip, review, confirm save, cancel.
5. Read business data back before showing completion.

Vue 2.7, Vue 3, React 19, React 16.3, and vanilla share the same task definition, field derivation, and action row. Only the adapter mount changes.
