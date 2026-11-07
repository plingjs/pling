---
id: V3-25
title: "Guided tasks for a real workflow"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Guided tasks for a real workflow

The Todo examples show that a page with clear action declarations can complete a concrete operation. Real back offices are harder: one business task often spans several fields, a few decisions, and one human handoff.

Creating a course is a good example. An employee knows they need a new course, but may not remember which field comes first, how teachers and eligible cards relate, whether the cover must be chosen by hand, or where to confirm the result. Putting all of that into chat creates a second form. Leaving it only on the page lets people get lost.

This chapter narrows the page to one job. The original course form remains the only input surface. The assistant explains the current step, shows read-only summaries, locates real fields, and reads the catalogue back after saving.

## Let the model read the whole sentence

Creating a course used to invite a field-by-field interrogation. This example does not put an intent classifier in the page; the assistant reads the active task context and writes the field values from one sentence into working memory:

```text
Pregnancy yoga, Chen, 2 stars, write the intro
```

The model receives the active task's objective, constraints, fields, current values, gaps, and guide stage. It reads the sentence as four values — `name`, `teacherId`, `difficulty`, and `intro` — and calls `pling_update_task` once. The page validates every declared field before the values reach the form. The assistant asks only for what is actually missing, such as “Eligible cards have not been selected.” If the teacher is not in the list, it stops and asks instead of silently choosing a similar name. A cover is an explicit human handoff: the assistant locates the upload field and leaves file selection to the person.

Value validation belongs to the page, not to the conversation. A `TaskField` can declare `min` / `max` for numbers, `minLength` / `maxLength` and `pattern` for text, a small closed `values` list, and a business check with `validate(value, values)` over the current working memory. These checks run before a model value is written to the task snapshot: a wrong type, an unknown teacher, an out-of-range difficulty, or a malformed deduction count fails without leaving a half-applied form. The model may retry, rephrase, or ask the person, but it cannot bypass that boundary.

```ts
const courseTask = {
  id: "course.create",
  fields: [
    { name: "name", label: "Course name", type: "text", minLength: 1, maxLength: 40 },
    {
      name: "teacherId",
      label: "Teacher",
      type: "lookup",
      lookup: teacherLookup,
      validate: (value) =>
        teachers.some((teacher) => teacher.id === value) ? null : "Choose a teacher from the search_teachers results.",
    },
    { name: "difficulty", label: "Difficulty", type: "number", optional: true, min: 1, max: 5 },
  ],
};
```

The model does not turn a question into a field value just because the conversation has not moved on. Asking what a field means, asking to look first, changing one's mind, or pausing all stay in the same conversation; the task state is working memory, not a script. Follow-ups such as “change the difficulty to 4 stars” or “rename the course to Fat burn yoga” are likewise corrections to the current task, and only update the matching field. The assistant asks only when it genuinely cannot tell which field is meant.

## Two ways in, one task

A user can start from either direction:

- Opening the **Create a course** dialog makes the task available from page context;
- Asking the assistant to “create a yoga course” lets the model choose and open the same registered task.

Both paths use one task definition, one guide definition, and one executor. The page does not maintain separate UI for “context activation” and “assistant activation”.

The page registers the task once:

```ts
pling.task.define({
  definition: createCourseTaskDefinition(taskOptions),
  guide: guideDefinition,
  controller,
  scope: "create-course-form",
  autoStart: true,
  initialValues: currentTaskValues,
  state: () => ({
    snapshot: taskSnapshot.value,
    step: 1,
    busy: busy.value,
    error: taskError.value,
    completed: completed.value,
  }),
  onActivate: applyTaskRunValues,
  onCommand,
});
```

`scope` means the task is available only while the create-course dialog exists. `autoStart` shows it when the context matches. Closing the dialog removes the scope and hides the guide; reopening it restores the task.

Assistant-initiated runs need no extra wiring. Once the task is registered, the model sees the tasks available in the current context. It calls `pling_start_task`, the catalog activates the same `course.create` entry, and the built-in assistant panel renders the guide.

## Why task and guide are separate

`TaskDefinition` answers **what must be achieved, under which constraints, and how completion is observed**: `objective` is the goal, `constraints` are the boundaries the model must respect, `successCriteria` are observable completion conditions, and `fields` are the current working memory. Fixed `steps` are only for business writes that can execute deterministically; they are not a conversation script.

```ts
export const courseTask = {
  id: "course.create",
  title: "Create a course",
  objective: "Help the person create a publishable course instead of walking a fixed field sequence.",
  constraints: [
    "The cover must be uploaded by the person; the assistant must not fake it.",
    "Every write still goes through create_course, the executor and read-back verification.",
    "Questions, corrections, pauses and abandonment take precedence over collecting the next field.",
  ],
  successCriteria: [
    "The new course appears first in the catalogue",
    "Name, teacher, eligible cards and cover match what the person confirmed",
  ],
  fields: [
    { name: "name", label: "Course name", type: "text", recommended: "Yoga foundations" },
    {
      name: "teacherId",
      label: "Teacher",
      type: "lookup",
      lookup: searchTeachers,
      searchAction: "search_teachers",
      recommended: "teacher_zhoumin",
    },
    { name: "cards", label: "Eligible cards", type: "select", values: cardChoices },
    { name: "cover", label: "Course cover", type: "boolean", agentWritable: false },
  ],
  steps: [
    {
      id: "course.save",
      label: "Write and read back",
      action: "create_course",
      args: (values) => ({
        name: values.name,
        teacherId: values.teacherId,
        cards: values.cards,
        cover: values.cover,
      }),
    },
  ],
};
```

It has no Vue dependency and does not know what the chat looks like. A task may be executable only, or carry a user-facing guide.

`TaskGuideDefinition` answers **what the user sees**: the task title, welcome copy, current field list, and the page commands the model may invoke.

```ts
export const courseGuide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "Create a course",
  welcome: "Tell me the course details in one sentence, or fill the form directly; I will fill the gaps.",
  agent: {
    review: "review-task",
    proposeSave: "propose-save",
    cancel: "cancel-task",
  },
  fields: () => courseCreateFieldNodes(locale, draft(), teachers, skipped),
  steps: [
    {
      id: "course.fill",
      label: "Create a course",
      title: "Create a course",
      description: "Write the course values into the original form, then let the person confirm the save.",
    },
  ],
};
```

`steps` describes a coarse business stage for the title and progress copy; it does not decide what to ask next. This example has one stage. The actual “what is still missing” answer comes from `fields()` reading the page. The guide contains no `input`, `textarea`, or `select`; writing values, opening dialogs, and focusing fields still belong to the page.

The split also lets the same task run headlessly or act as a conversation-only playbook. A task can have no guide; a guide can exist without executable steps.

## The assistant chooses, it does not invent tasks

The task catalog is the page's declaration of what is legal right now. The model receives the available tasks together with their goals, constraints, fields, and step summaries. Once a task is active, it also sees the current values, missing required fields, current guide step, and available guide actions. That state is working memory rebuilt on every turn, not a script the model must follow. It can choose one task and pass values the user has already supplied:

```json
{
  "task": "course.create",
  "values": {
    "name": "Yoga foundations",
    "teacherId": "teacher_zhoumin"
  }
}
```

Three boundaries apply:

- The task id must come from the current available list. Inventing an id returns `INVALID_ARGS`.
- `values` may contain only fields declared by that task. Unknown fields are rejected.
- Supplied values only prefill a task run. They do not bypass the permission, confirmation, or audit path of `create_course`.

So “the assistant creates a task” means **starting a registered task run**. If a later version supports genuinely dynamic workflows, it still needs task templates, validation, and user confirmation before entering the same catalog. The model should never compose arbitrary action sequences into a task definition.

### Once active, the task is not a script

Once a task is active, the model receives structured current state and decides whether this turn should answer, ask, write, pause, or hand control back. It must not put an entire sentence into the course-name field merely because that is the next required field, and it must not keep advancing when the person asks “what can you do?”.

The model writes working memory through one narrow action:

```json
{
  "task": "course.create",
  "values": { "cards": "Monthly card" },
  "clear": []
}
```

That action is `pling_update_task`. It only writes the active task, accepts only declared fields, and rejects page-only fields marked `agentWritable: false`. `TaskField.recommended` is a suggestion the model may use when the person explicitly delegates a choice, not an automatic write. The cover remains a page-owned upload. After working memory changes, the Vue page subscribes to `TaskRunSnapshot`, writes the values back into the original form, and highlights the changed fields. The real business write still goes through `create_course`, the executor, confirmation, and read-back verification.

### The page keeps the final step

The model can perceive, explain, ask, and correct, but the page keeps three actions it never delegates: locating, reviewing, and saving.

- `pling_focus_field` scrolls a declared field into view and highlights it; it never writes a value.
- `pling_review_task` opens the page's own read-only review.
- `pling_propose_save` opens the confirmation step; it never performs the business write.
- `pling_cancel_task` ends the guide, and values already written to the page are not rolled back automatically.

These tools are not hidden framework defaults. A guide must explicitly declare `review` / `proposeSave` / `cancel` under `guide.agent` before the model can see the matching tool. When a command is missing, the tool is not advertised and no no-op action appears. This lets each product own its save path: some show a confirmation, some require a second verification, and some do not allow saving from the task at all.

```ts
guide: {
  taskId: "course.create",
  agent: {
    review: "review-task",
    proposeSave: "propose-save",
    cancel: "cancel-task",
  },
}
```

The page handles the `proposeSave` command itself: opening its existing confirmation, re-reading the form, calling `create_course`, and reading the catalogue back. The model may say that it is ready to save and ask the person to confirm, but it must not claim success before that confirmation.

## Do not build a second chat UI

The older integration asked the page to mount `AgentTaskGuide` inside the transcript and maintain its own header, message list, and styling. That leads to a different assistant appearance in every example and couples business pages to chat chrome.

Now the page keeps only the business form and the task registration. The assistant uses the built-in component:

```vue
<aside class="assistant" aria-label="Pling assistant">
  <AgentInline
    class="assistant-agent"
    :title="createCopy.assistantTitle"
    :placeholder="page.assistant.placeholder"
    task-placement="none"
    guide-placement="end"
    :debug="{ maxCalls: 8 }"
    model-settings="readonly"
  >
    <template #guide>
      <AgentGuideActions :items="guideActions" @command="onGuideCommand" />
    </template>
  </AgentInline>
</aside>
```

`AgentInline` subscribes to the task catalog, but this example turns the built-in card off with `task-placement="none"` and puts the `#guide` slot after the latest message with `guide-placement="end"`. The task layer still matters; the problem is duplication. Creating a course is already a continuous form. A second field rail above the conversation would give the user two parallel paths to the same job. The chat should carry the narrative, and the next action should appear at the end of that narrative. `AgentGuideActions` only emits commands declared by the page; it does not write a field or call a business action.

The task definition still owns fields, order, commands, and success evidence. It only gives presentation control back to the page. `task-placement` accepts three values: the default `inline` places the guide in the transcript, `pinned` keeps it under the chat header, and `none` hides it. Use the first two when a persistent step rail genuinely helps. Use `none` when the page and the conversation already have clear, separate jobs.

A product that truly needs a different task presentation can override the default guide with the `#task` slot. The important rule is not to show a built-in field rail and a second copy of the same guidance in chat at the same time.

## A long recommendation must not stretch the button

The first “fill it in” control put the recommended value inside the button label. Short course names looked fine. A booking note written as one sentence turned the button into a block wider than the panel, wrapped the action row, and pushed the conversation down. The user saw one large button instead of the next decision.

Truncating the label does not fix that: before clicking, a person still needs to know what will be written. Hiding the text behind an icon or a second menu only replaces uncertainty with discovery work.

The rule is now **short verb + one-line preview**:

- the button keeps the action only, for example “Fill it in” or “Point to · Course name”;
- the recommendation sits in a grey preview inside the button: one line, roughly `300px` at most, ellipsised;
- the full value remains in the conversation bubble, in `title` on hover, and in the complete `aria-label` for screen readers;
- a recommendation means “this is what clicking would write”. Nothing changes in the page form until the user clicks.

```ts
const items: GuideActionItem[] = [
  {
    id: "use-note",
    label: "Fill it in",
    preview: "Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
    ariaLabel: "Fill in booking notes: Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
    command: "apply-note",
    kind: "suggestion",
  },
];
```

The renderer does not belong to one adapter. It lives in `@plingjs/dom`; Vue, React, and plain DOM mount it from their own lifecycle shells:

```vue
<AgentGuideActions :items="guideActions" @command="onGuideCommand" />
```

It only emits the `command` the host declared. It does not know what a course is, does not write a field, and cannot open a second execution path. Because there is one renderer, wrapping, ellipsis, focus, and disabled states behave the same in all three adapters instead of drifting across three stylesheets.

The edge cases that matter:

- while a write is running the button is `disabled`, but the label stays “Saving…” so the row does not disappear;
- optional fields get an explicit “Skip” instead of forcing the user to invent a value;
- on narrow screens the chip becomes `max-width: 100%`, the preview ellipsises first, and the verb never wraps;
- English recommendations are usually longer, so the preview stays on one line instead of using `word-break` to grow the button;
- this rule applies to the action row only. The conversation still shows the full recommendation. They are different layers of information.

## Write into the original form

The first version of the guide showed recommended content as if it were already in the page. The user could not tell whether a value was a suggestion or a real form value. The current version separates the two. The row states below describe the built-in guide contract; this example hides the card, but recommendations and commands follow the same rules:

- the page form remains the only input source;
- a recommendation carries `suggested` status and says it has not been written;
- choosing “Use” writes the value into the existing control and changes the state to `current`;
- if the user edits the form directly, the next guide pass reads the new page value.

The field list is derived from the page's current values. There is no `status` / `badge` row template and no step counter:

```ts
const guideField = computed(() => {
  const gaps = courseCreateFieldNodes(locale, draft, teachers, skipped.value);
  return gaps.find((field) => field.required && !field.filled && !field.skipped)
    ?? gaps.find((field) => !field.filled && !field.skipped);
});
```

The action row uses that gap to offer a short action: locate the current field, use a suggestion, or skip an optional value. A review action appears only when every required field is present. Ten inputs do not become ten steps; field-level differences stay in the field list.

If a suggestion is wrong, the user does not have to reject it first. They can type directly into the page. The guide reads the new page value, and a later “Use” action does not overwrite what the user already entered.

The button does not open another input. It writes values into the existing controls, scrolls to the field, and marks it on the form. The user sees “fill here”, not a chat message claiming that a field was located.

The page handles explicit commands only; it does not parse natural language:

```ts
function onGuideCommand(command: string): void {
  if (command === "save-course") void saveCourse();
  else if (command === "resume-editing") resumeEditing();
  else if (command === "pick-cover") void pickCover();
  else if (command === "locate-field") locateField(guideField.value);
  else if (command === "use-suggestion") useSuggestion(guideField.value);
  else if (command === "skip-field") skipField(guideField.value);
  else if (command === "start-review") startReview();
  else if (command === "focus-save") focusSave();
}
```

Deciding whether the user wants to create a course or first ask a question is the model's job. The page only executes explicit commands such as “locate the course name” or “use this suggestion”. A mid-task question, correction, or pause therefore cannot be mistaken for the next step.

When the assistant opens the task with field values, the page also has to sync them back into the original form. This example does that in `onActivate`:

```ts
function applyTaskRunValues(task: ActiveGuidedTask): void {
  const values = task.state.snapshot?.values;
  if (!values) return;
  if (values.name !== undefined) draft.name = String(values.name ?? "");
  if (values.teacherId !== undefined) {
    draft.teacherId = String(values.teacherId ?? "");
    draft.teacherName = teachers.find((teacher) => teacher.id === draft.teacherId)?.name ?? "";
  }
  // Apply the remaining fields in the same way.
}
```

The page remains the source of truth. If the user edits the form by hand, the next step reads the current page value, not the initial example from the task definition.

## Cancel, and survive a context change

The task menu and the model can both emit a cancel command:

```ts
const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "Create a course",
  cancel: { label: "Cancel task", command: "cancel-task" },
  agent: { cancel: "cancel-task" },
  // ...
};
```

The page calls `pling.task.deactivate()` when it receives `cancel-task`. The guide disappears and the controller run is cancelled, so no panel is left looking active after the run has ended. Cancelling does not roll back values already written into the form, because the page is the source of truth the user is editing.

If a task closes a modal, moves to a detail page, or briefly leaves the scope that opened it, register it with `keepActive`:

```ts
pling.task.define({
  definition: courseDefinition,
  guide: courseGuide,
  controller,
  scope: "create-course-form",
  autoStart: true,
  keepActive: true,
  // ...
});
```

`keepActive` applies only to a task explicitly started by a person or the assistant; it does not make an auto-started task stick to every page. It prevents a temporary context mismatch from closing the run. Stage transitions, unsaved-form protection, and branching across pages still belong to the business flow, not to a single boolean.

## Make human handoff explicit

Choosing a cover reads a local file, so the assistant should not pick it. The cover is required, so the guide never invents a boolean value; it points to the real upload control and the action row keeps only “Upload cover”, with no “continue”.

The task enters review only after the page re-reads every value from the file input and the original form. This pause is part of the boundary, not a failure. Without it the flow looks faster, but the user discovers the missing required action at the very end.

The review reads the current name, teacher, cards, cover, deduction, and price from the page. Only when those values are valid does the action row offer “Confirm save”; clicking it runs `create_course`.

## Verify from the page

A successful action result is not the same as a completed business operation. After the write, the page checks that the new course is first in the catalogue and that its visible values match the reviewed values.

```ts
const result = await controller.run();
if (result.status === "done" && courses.value[0]?.id === newCourseId.value) {
  modalOpen.value = false;
  reviewOpen.value = false;
  return true;
}
```

The completion card reflects that read-back, not a canned success message.

## Check it in the browser

Open the [Vue 3 create-course example](/demos/course-workspace-vue3/?lang=en) and verify:

- The first screen contains the course catalogue and the create-course form, not unrelated admin modules.
- The chat card has no inputs, selects, or textareas.
- Opening the create-course dialog activates the task; the chat does not show a separate task card or field rail.
- Entering “Pregnancy yoga, Chen, 2 stars, write the intro” fills four fields at once and asks only for the missing eligible cards.
- Saying “change the difficulty to 4 stars” updates only that value, without asking for the name or teacher again.
- An unknown teacher produces a list of available teachers and marks the teacher field on the form; it is not silently replaced.
- An unclear correction such as “change it for me” asks which field to change.
- Entering “advanced yoga, 2 stars, any teacher, monthly card” uses the recommended teacher and keeps the course name “advanced yoga”.
- Saving without a cover stops on the cover step with a clear message.
- After selecting a cover, saving puts the new course first; the deduction renders as `1`, not `1.0`.
- Choosing “Do it again” creates a second course while the first one stays in the catalogue, and the transcript still scrolls up and down once it overflows.
- There are no console errors during chat or page interaction.

## Add it to another page

Do not copy the UI. Follow this order:

1. Describe fields, actions, and read-back evidence with `TaskDefinition`.
2. Describe user-facing steps, summaries, and command names with `TaskGuideDefinition`.
3. Register the task with `pling.task.define()` and declare `route`, `scope`, and `autoStart`.
4. Handle command names in the page: write into existing controls, locate fields, open dialogs, or invoke the task controller.
5. Read business data back before showing completion.

When a task should be selected by a person, or only start from a detail page or row, declare `route`, `scope`, or `requiresRecord`. Do not infer availability from ad-hoc page state; the catalog evaluates these declarations.

React 19, React 16.3, Vue 2.7, and vanilla reuse the same task definition, field derivation, and action row, replacing only the adapter mount. All five versions now provide the same create-course flow, human confirmation, and read-back verification.
