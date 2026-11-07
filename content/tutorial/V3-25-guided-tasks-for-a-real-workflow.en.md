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

## Start from one sentence

Creating a course used to invite a field-by-field interrogation. This example lets the business parse one instruction and write the result into the page at once:

```text
Pregnancy yoga, Chen, 2 stars, write the intro
```

The course name, teacher, difficulty, and introduction land in the original form together. The assistant only asks for what is actually missing, such as “Eligible cards have not been selected.” If the teacher is not in the list, it stops and asks instead of silently choosing a similar name. A cover is an explicit human handoff: the assistant locates the upload field and leaves file selection to the person.

`AgentInline` supports an optional `beforeSend`, but it owns only the deterministic fast path: explicit field values and explicit save, review, or cancel commands are handled immediately and return `{ handled: true, reply }`. Questions, help requests, vague corrections, delegated choices such as “choose the card for me”, and ordinary chat return `undefined` so the model can decide with the active task's working memory. A question must never become a field value just because the page is waiting for the course name.

```ts
async function handleBeforeSend(text: string) {
  const result = parseCourseIntake(text, { /* teachers, cards, current draft */ });
  if (shouldUseAgent(result)) return undefined;

  applyIntakePatch(result.patch);
  return {
    handled: true,
    reply: composeCourseIntakeReply({ draft, result, /* ... */ }),
  };
}
```

Bind it as a prop with `:before-send="handleBeforeSend"`. It is not an event listener; `@before-send` registers a listener and will not run the function as the intake hook.

Follow-ups such as “change the difficulty to 4 stars” or “rename the course to Fat burn yoga” update only the matching field in the current draft. When the parser cannot tell which field is meant, the assistant asks instead of guessing.

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
    step: step.value,
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

`TaskGuideDefinition` answers **what the user sees**: step titles, descriptions, read-only rows, button labels, and the point where control returns to a person.

```ts
export const courseGuide = {
  taskId: "course.create",
  title: "Create a course",
  steps: [
    {
      id: "course.basics",
      label: "Course details",
      title: "Decide what the course is",
      description: "These three values will be written into the original form.",
      rows: () => [
        { label: "Course name", value: draft.name || recommended.name },
        { label: "Difficulty", value: draft.difficulty || 3, format: "stars" },
      ],
      primary: { label: "Fill recommended values", command: "apply-basics" },
      secondary: { label: "Locate on page", command: "focus-basics" },
    },
    // Teaching and booking, cover, review and save...
  ],
};
```

The guide contains no `input`, `textarea`, or `select`. It only renders summaries and business command names. Writing values, opening dialogs, and focusing fields still belong to the page.

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
    :debug="{ maxCalls: 8 }"
    model-settings="readonly"
  />
</aside>
```

`AgentInline` subscribes to the task catalog, but this example turns the built-in card off with `task-placement="none"`. The task layer still matters; the problem is duplication. Creating a course is already a continuous form. A second field rail above the conversation would give the user two parallel paths to the same job. The chat should carry the narrative, and the next action should appear at the end of that narrative.

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

A task row expresses this with `status`, `badge`, `note`, and `action`:

```ts
const row: TaskGuideRow = filled
  ? {
      label: "Course name",
      value: draft.name,
      status: "current",
      badge: "In page",
      action: { label: "Locate", command: "focus-name" },
    }
  : {
      label: "Course name",
      value: recommended.name,
      status: "suggested",
      badge: "Suggested",
      note: "From the demo template; not written to the page",
      action: { label: "Use", command: "apply-name" },
    };
```

`action.command` does not open a second execution path. Like a step button, it ends up in the page's `onCommand`.

If a suggestion is wrong, the user does not have to reject it first. They can type directly into the page. The guide reads the new page value, and a later “Use” action does not overwrite what the user already entered.

The button does not open another input. It writes values into the existing course-name, difficulty, and introduction controls, then scrolls to the field and marks it on the form. The user sees “fill here”, not a chat message claiming that a field was located.

```ts
async function onCommand(command: TaskGuideCommand) {
  switch (command.action.command) {
    case "apply-basics":
      applyBasics();
      await focusFields(["name", "difficulty", "intro"]);
      break;
    case "focus-teaching":
      await focusFields(["teacher", "cards", "note"]);
      break;
    case "save-course":
      await saveCourse();
      break;
    case "cancel-task":
      pling.task.deactivate();
      break;
    default:
      if (command.action.command.startsWith("apply-")) {
        applyField(command.action.command.slice("apply-".length));
      } else if (command.action.command.startsWith("focus-")) {
        await focusFields([command.action.command.slice("focus-".length)]);
      }
  }
}
```

Steps should not depend on a button incrementing `step.value`. The page already has the fields, so derive the step from their state:

```ts
const step = computed(() => {
  if (!draft.name.trim()) return 1;
  if (!draft.teacherId || !draft.cards.trim()) return 2;
  if (!draft.cover) return 3;
  return 4;
});
```

Editing the page, starting the task through `pling_start_task`, and choosing a row action all go through the same decision. Do not turn ten inputs into ten steps. Group steps by business decision, usually three to five groups, and use task rows for field-level differences.

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

The guide header can offer a cancel command:

```ts
const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "Create a course",
  cancel: { label: "Cancel task", command: "cancel-task" },
  steps: courseSteps,
};
```

The page calls `pling.task.deactivate()` when it receives `cancel-task`. The guide disappears and the controller run is cancelled, so no panel is left looking active after the run has ended. This example exposes the same command from the assistant task menu.

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

Choosing a cover reads a local file, so the assistant should not pick it. The third step has no “continue” button. It shows a handoff explanation and points to the real upload control.

The task enters review only after the user selects an image. This pause is part of the plan, not a failure. Without it the flow looks faster, but the user discovers the missing required action at the very end.

The review step reads the current name, teacher, cards, cover, deduction, and price from the page. Only when those values are valid does the save button run `create_course`.

## Verify from the page

A successful action result is not the same as a completed business operation. After the write, the page checks that the new course is first in the catalogue and that its visible values match the reviewed values.

```ts
const result = await controller.run();
if (result.status === "done" && courses.value[0]?.id === newCourseId.value) {
  modalOpen.value = false;
  step.value = 4;
  return;
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
- After selecting a cover, saving puts the new course first.
- There are no console errors during chat or page interaction.

## Add it to another page

Do not copy the UI. Follow this order:

1. Describe fields, actions, and read-back evidence with `TaskDefinition`.
2. Describe user-facing steps, summaries, and command names with `TaskGuideDefinition`.
3. Register the task with `pling.task.define()` and declare `route`, `scope`, and `autoStart`.
4. Handle command names in the page: write into existing controls, locate fields, open dialogs, or invoke the task controller.
5. Read business data back before showing completion.

When a task should be selected by a person, or only start from a detail page or row, declare `route`, `scope`, or `requiresRecord`. Do not infer availability from ad-hoc page state; the catalog evaluates these declarations.

React, Vue 2, and vanilla versions can reuse the same task and guide definitions, replacing only the adapter mount. This chapter completes Vue 3 first; the other adapters follow after the interaction direction is settled.
