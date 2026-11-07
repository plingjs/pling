# Create a course with a guided task (Vue 3)

This is a small, realistic slice of the Bingcao Studio course back office. It
does not try to demonstrate every admin feature. The page has one job: create a
course in the existing course form, while the assistant accepts as much of the
course description as the user already knows and points only at the remaining
gaps.

The original form remains the only input surface. The assistant panel uses the
same built-in chat UI as every other Pling example. It shows the active plan,
read-only summaries, field locations, the one human handoff (choosing a cover),
and the final result. The page does not ship a second chat shell.

## Run

From the repository root:

```bash
pnpm dev:examples
```

Open `http://127.0.0.1:5191/demos/course-workspace-vue3/?lang=zh`. Remove
`?lang=zh` for the English copy.

The model request goes through the shared example gateway. No provider key is
read by the browser.

## What the demo does

1. The page opens with the existing **Create a course** form and an active task.
2. The user can describe the whole course at once, for example
   `孕妇瑜伽，陈老师，2 星，介绍自动填写` (or the English equivalent in `lang=en`).
   The model reads the active task's objective, constraints, current values,
   recommendations and gaps, then calls `pling_update_task` with only the fields
   the person actually supplied. The page writes those values into the original
   Vue controls.
3. It then asks only for actual gaps. In the example sentence, eligible cards are
   the only required value left; optional price and booking notes are not turned
   into extra questions.
4. Questions, help requests, corrections, pauses and delegated choices such as
   `卡片你来选` remain normal conversation. The same model may answer without
   touching a field, update one field, call `search_teachers`, point at a field
   with `pling_focus_field`, or leave the task untouched. No natural-language
   intent parser or `beforeSend` shortcut runs ahead of it.
5. A cover is the deliberate human handoff. **Upload cover** locates the field
   and opens the file picker; the assistant does not choose a local file for the
   person.
6. Once the required values are complete, the conversation shows a read-only
   review. **Confirm save** runs `create_course` through the normal executor and
   checks that the new course is first in the catalogue.
7. The result card offers **View new course** and **Create another**.

The chat card has no `input`, `textarea`, or `select`. That is an intentional
contract, not a styling detail, and it is also why the business page does not
need a second intent grammar. The model reads the same task context that the UI
renders and proposes values through a narrow action; the page validates those
values before writing them into the real controls.

The guide exposes three page-owned controls to the model:

- `pling_review_task` opens the read-only review command.
- `pling_propose_save` opens the same review as a confirmation step. It never
  executes `create_course`; the person still presses **Confirm save**.
- `pling_cancel_task` closes the guide without undoing values already written.

`pling_focus_field` is available for every declared field and only moves the
person's attention. If a guide does not declare a review or save-confirmation
command, the corresponding tool is reported unavailable rather than invoking a
no-op.

## When does the task appear?

The page registers one guided task with a route, a scope, and `autoStart: true`:

```ts
pling.task.define({
  definition: createCourseTaskDefinition(taskOptions),
  guide: guideDefinition,
  controller,
  scope: "create-course-form",
  autoStart: true,
  onActivate: applyTaskRunValues,
  onCommand,
});
```

That declaration covers the first path: while the create-course dialog is open,
the task is active. Closing the dialog removes the scope. Reopening it brings the
same task back.

The second path is assistant-initiated. The model sees only tasks available in
the current page context. When the user asks to create a course, it can start
`course.create` through `pling_start_task`. While the task is active, the model
may write declared, agent-writable fields through `pling_update_task`. Those
calls update task working memory only; the Vue page subscribes to the run
snapshot and synchronises the values back into the original form. Neither path
may invent a task id, an unknown field, or a page-only value. Every business
write still goes through `create_course`, the executor, and the page's read-back
check.

`TaskDefinition` is a goal, not a conversation script. It declares
`objective`, `constraints`, and `successCriteria`; `fields` hold the current
working memory; `recommended` is a suggestion used only when the user delegates
a choice; `agentWritable: false` marks page-owned actions such as the cover
upload. The model may answer a question without changing any field, or update a
single field that the user delegated while other required fields are still
empty.

Fields also carry value-level validation: numeric bounds, text length, allowed
values, patterns, and an optional business `validate` callback run before a
model value reaches the task snapshot. This is deliberately value validation,
not intent classification.

Both paths run through `<AgentInline>`, but this demo sets
`task-placement="none"`. The conversation and the original form already have
clear, separate jobs; a second field rail above the transcript would duplicate
the form. The next action still appears at the end of the conversation, and the
page marks the real field on the form when the user asks to locate it.

Keep the default `inline` or use `pinned` when a persistent step rail genuinely
helps. `none` is a deliberate product choice, not a missing integration.

## Long recommendations and the action row

The action row under the latest assistant message is not bespoke Vue markup.
It is `AgentGuideActions`, a thin lifecycle shell around
`createGuideActions()` in `@plingjs/dom`:

```vue
<AgentGuideActions
  :items="guideActions"
  :hint="reviewOpen && requiredComplete ? copy.review.title : ''"
  :aria-label="copy.assistantTitle"
  @command="onGuideCommand"
/>
```

Each item keeps the verb short and puts a long recommendation in `preview`:

```ts
{
  id: "use-suggestion",
  label: copy.row.use,                 // “自动填写” / “Fill it in”
  preview: field.suggestion,           // one line, roughly 300px at most
  ariaLabel: `${copy.row.use}${field.label}：${field.suggestion}`,
  command: "use-suggestion",
  kind: "suggestion",
}
```

Why not just put the value in the label: a booking note or a course
introduction will stretch the chip past the panel, wrap the row, and push the
conversation down. Truncating the label alone hides what clicking does. The
current contract keeps the full recommendation in three places — the
conversation bubble, `title` on hover, and the complete `aria-label` — while the
button stays a fixed-width action.

The renderer only emits `command`. It does not write a field, call
`create_course`, or know what a course is. The page remains responsible for
writing the suggested value into the real Vue control and for focusing it.

## How to add another guided task

1. Define the executable work in `examples/shared/course-create/task.ts`.
   A `TaskDefinition` owns the goal, constraints, success criteria, fields,
   lookup rules, optional deterministic steps, and the arguments sent to the
   existing executor.
2. Describe the human-facing steps in
   `examples/shared/course-create/guide.ts`. A `TaskGuideDefinition` owns step
   labels, descriptions, read-only rows, handoff copy, commands, and the result
   view. It contains no form controls.
3. Register the task on `pling.task`, with its route/scope and `autoStart`
   policy. `<AgentInline>` renders the active guide automatically unless the
   page sets `task-placement="none"`. Use the `#task` slot only when a product
   deliberately needs a different renderer.
4. Handle emitted command names in the page. Commands may write values into
   existing controls, focus a field, open a dialog, or invoke the task
   controller. They must not create a second copy of the business form.
5. Declare the safe model-callable commands in `guide.agent` (`review`,
   `proposeSave`, and `cancel`). These are UI commands, not business writes.
6. Read the result back from the page's normal data source before showing
   success.

## Where each piece lives

- `src/main.ts` creates one Pling runtime and installs the Vue plugin.
- `src/CourseWorkspace.vue` renders the original back office, owns the page
  state, registers the guided task, and handles command names.
- `src/course-create.css` keeps the page visually aligned with the static
  reference without changing the task contract.
- `examples/shared/course-create/task.ts` is the executable task definition.
- `examples/shared/course-create/guide.ts` is the framework-neutral
  presentation definition.
- `examples/shared/course-create/model.ts` contains the course rules and mock
  catalogue.
- `examples/shared/course-create/legacy-intake.ts` is retained only as a
  historical reference for the earlier deterministic demo; the live example
  does not import it.
- `examples/shared/course-create/page.ts` and `copy.ts` contain business copy.
- `packages/agent/src/task-catalog.ts` decides which tasks are available for
  the current route/scope and exposes the narrow `pling_start_task` and
  `pling_update_task` actions.
- `packages/dom/src/guide-actions.ts` is the shared compact action row used by Vue, React, and plain DOM.
- `packages/vanilla/src/task-guide.ts` is the framework-neutral task-guide DOM renderer.
- `packages/vue/src/components/AgentInline.vue` owns the assistant surface and
  the active-guide lifecycle. This demo hides the built-in guide with
  `task-placement="none"` and keeps the original form as the only input surface.
