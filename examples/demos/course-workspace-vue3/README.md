# A persistent goal: create a course (Vue 3)

This is the same Bingcao Studio course page as
[`course-create-directives-vue3`](../course-create-directives-vue3/), plus one
task goal. The page still owns every field, every control and the save handler.
The goal adds only the part the DOM cannot express: the outcome must survive the
dialog closing, and it has an explicit complete/cancel lifecycle.

## Run

From the repository root:

```bash
pnpm dev:examples
```

Open `http://127.0.0.1:5191/demos/course-workspace-vue3/?lang=zh`. Remove
`?lang=zh` for the English copy. The model request goes through the shared
example gateway; the browser never reads a provider key.

## The whole integration

```ts
const pling = usePling();
const disposeGoal = pling.task.goal(courseGoal(props.locale));
onBeforeUnmount(disposeGoal);
```

`courseGoal()` contains only an outcome, boundaries, success criteria and
examples:

```ts
{
  id: "course.create",
  title: "Create a course",
  goal: "Open the real form, fill what the person supplied, ask them to upload the cover, save, then read the catalogue back.",
  constraints: ["The page's actions are the only way to operate it.", "The person uploads the cover."],
  successCriteria: ["The new course appears first in the catalogue."],
  examples: ["Create prenatal yoga with Chen Jing, 2 stars, monthly card."],
}
```

There is no `fields` array, no `steps`, no `controller`, no form surface and no
business callback in this path.

## What the goal does not do

- It does not open the dialog. The page starts on the catalogue; the agent sees
  `new_course` and clicks the real button itself.
- It does not read or write the form. Those are `course_name`,
  `course_teacher`, `course_cards`, `course_cover` and the other real actions.
- It does not save. `save_course` is the page's own handler and its `expect`
  check reads the catalogue back.
- It does not grant permission. Every action keeps its own risk, approval and
  audit rules.

## Why a goal is still useful

Directives describe the page that exists now. A goal describes the outcome that
should remain true after the page changes:

- the user closes the dialog before finishing;
- the user asks a question and then returns to the form;
- the page navigates between a list and a detail view;
- an external agent needs a stable playbook and an auditable completion point.

The task catalog keeps the goal available and active across those changes. The
compact card in the assistant shows the goal, a cancel button, and a completed
state. The model has one extra lifecycle tool, `pling_complete_task`; it closes
the goal only after the page's success criteria are visible. It never performs a
business write.

## When to choose which path

| Situation | Use |
| --- | --- |
| One page, stable form, no continuity requirement | Directives only (Case 07) |
| Short form but the goal must survive closing a dialog | `pling.task.goal()` |
| Cross-route journey, resume, or a stable task entrance | `pling.task.goal()` |
| External agent needs a task playbook and completion boundary | `pling.task.goal()` |
| Field-level validation, lookups, deterministic multi-step execution | Advanced `pling.task.define()` + `TaskController` |

The advanced API remains available for cases that genuinely need a field
schema, lookups, handoffs or deterministic steps. It is not the recommended
first integration, and this example does not use it.

## Try it

1. The page opens on the course catalogue with the dialog closed.
2. Say `创建孕妇瑜伽，陈静，2 星，月卡，介绍自动填写`.
3. The agent starts the goal, clicks **新建课程**, and operates the real form.
4. Ask `上传封面在哪里点？`; the agent locates the real upload tile. You choose
   the file.
5. Close the dialog and ask a follow-up. The goal is still active; the agent can
   reopen the form and continue.
6. Save. The action reads the catalogue back, then the agent completes the goal.

## Files

- `src/CourseWorkspace.vue` — the complete task integration: one goal.
- `src/main.ts` — Vue entry and Pling setup.
- `src/course-create.css` — page and assistant layout.
- `shared/course-create/CourseCreatePage.vue` — the real page.
- `shared/course-create/task.ts` — the goal contract.
- `shared/course-create/copy.ts` — action descriptions and assistant copy.
- `shared/course-create/model.ts` — course rules and mock catalogue.
- `shared/course-create/page.ts` — page copy and seed values.
