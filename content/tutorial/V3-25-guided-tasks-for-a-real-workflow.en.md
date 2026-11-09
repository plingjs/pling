---
id: V3-25
title: "Guided tasks for a real workflow"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Guided tasks for a real workflow

The Todo chapters show that a page with clear action declarations can complete a concrete operation. A real back office is harder. One business task crosses a dialog, several fields and one human upload. The person may ask questions, change their mind, or close the dialog halfway through.

## Starting point: do not duplicate the business form

This chapter does one job: create a course. The page is the original course workspace: a catalogue, a **New course** button, and the existing form behind it. We do not add a chat-only form, and page code does not open the dialog, fill fields or save on the agent's behalf.

The same page ships in two runnable versions:

- [Case 07: directives only](/examples/course-create-directives-vue3) uses `v-scope`, `v-record` and `v-tool`.
- [Case 06: a persistent goal](/examples/course-workspace-vue3) adds one goal to the same page.

Both create a course. The difference is not capability. It is whether the page can describe itself, and whether the outcome must survive a page change.

## Two integration paths

| Your page | Recommended path |
| --- | --- |
| One stable form, finished after save | Directives only |
| The dialog closes and the person comes back | Directives plus one goal |
| The job continues across routes or pages | Directives plus one goal |
| You need a fixed task entrance, cancel and completion | Directives plus one goal |
| An external agent needs the same playbook and completion boundary | Directives plus one goal |
| Fields need validation, lookup, or a fixed action sequence | Advanced `TaskDefinition` and `TaskController` |

Most pages stop at the first row. Add a goal only when a later row applies.

## What the directives already say

Case 07 declares no task. The page exposes itself through three directives.

```vue
<button
  type="button"
  v-tool="{
    id: 'new_course',
    kind: 'read',
    label: page.newCourse,
    desc: copy.newCourseDesc
  }"
  @click="openCreate"
>
  {{ page.newCourse }}
</button>
```

`new_course` is bound to the real button. The dialog is closed on load. To create a course, the agent calls this action, and the button's own `@click` opens the dialog. There is no `if (agent) openCreate()` branch in page code.

Inside the dialog, `v-scope` names the region:

```vue
<section
  class="course-modal"
  v-scope="{
    id: 'create-course-form',
    label: page.form.title,
    description: copy.formScope,
    role: 'dialog'
  }"
  v-record="draftRecord"
>
```

`v-scope` gives the group a stable id. It exposes no data and provides no execution. When the dialog closes, the region and its actions leave the page.

`v-record` publishes the draft as a read-only record:

```ts
const draftRecord = computed(() => ({
  data: { ...draft },
  id: "course-draft",
  label: copy.value.draftLabel,
  fields: {
    name: draft.name,
    difficulty: draft.difficulty,
    teacher: teacherName.value || draft.teacherId,
    cards: draft.cards,
    intro: draft.intro,
    cover: draft.cover,
    required: [page.value.form.name, page.value.form.teacher, page.value.form.cards, page.value.form.cover],
    missing: requiredMissing.value,
  },
}));
```

The agent can answer “what is missing?” without a second read tool. `missing` is computed by the page and uses the same rule as the page's save validation.

Each real control declares one action:

```vue
<input
  v-model="draft.name"
  v-tool="{
    id: 'course_name',
    action: 'fill',
    label: page.form.name,
    desc: copy.fieldDesc.name
  }"
/>
```

`action: 'fill'` means the action accepts a text value. A native select uses `action: 'select'`. Difficulty is not a native input; it is a row of custom star buttons, so each star declares a click action:

```vue
<button
  v-for="score in 5"
  :key="score"
  type="button"
  v-tool="{
    id: `course_difficulty_${score}`,
    kind: 'write',
    label: `${page.form.difficulty} ${score}`,
    desc: copy.difficultyDesc(score)
  }"
  @click="setDifficulty(score)"
>
  ★
</button>
```

That is how custom components work. Whether the control is an `input` does not matter. What matters is that it has a real click or input entry. Stars are click actions, upload is a human handoff, and save is the page's own save handler.

Upload must be done by the person:

```vue
<button
  class="upload-tile"
  v-tool="{
    id: 'course_cover',
    kind: 'write',
    label: page.form.cover,
    desc: copy.coverDesc,
    handoff: {
      reason: copy.coverHandoff,
      expect: { desc: copy.coverExpect, check: () => draft.cover }
    }
  }"
  @click="coverInput?.click()"
>
```

`handoff` pauses the executor and waits for the person. The assistant may call `pling_locate` to scroll to and highlight the upload tile, but cannot choose a local file. When the person uploads, `draft.cover` provides the completion evidence.

Save declares a read-back condition:

```ts
const saveTool = computed(() => ({
  id: "save_course",
  kind: "write",
  label: page.value.form.save,
  desc: copy.value.saveDesc,
  run: () => saveCourse(),
  expect: {
    desc: copy.value.saveExpect,
    check: () => courses.value[0]?.id === newCourseId.value,
  },
}));
```

The executor checks `expect` after the action returns. If the new course is not first in the catalogue, the save fails with a reason. The agent receives the page result, not just an HTTP 200.

### From one sentence to several actions

The person says:

```text
Pregnancy yoga, Chen Jing, 2 stars, monthly card, write the intro
```

There is no regular expression and no intent classifier in the page. The agent receives:

- the available actions and their descriptions;
- the draft's current values, required fields and missing labels;
- each control's label, input type and allowed values;
- which actions are human handoffs.

It opens the real dialog, then calls `course_name`, `course_teacher`, `course_difficulty_2`, `course_cards` and `course_intro`. “Write the intro” is explicit delegation, so the action description allows the model to draft it from the known course details. If there is no cover, the agent does not pretend an upload happened; it asks the person to choose a file.

If the person asks “what is missing?”, the agent reads `draftRecord`. If they say “change the teacher to Lin”, it changes only the teacher. The conversation follows the current page state, not a fixed field script.

### Business action ids are not framework APIs

`course_name`, `course_intro` and `course_cover` are names chosen by this example. Pling provides the declaration mechanism, not a set of course fields. An order back office declares `order_note`, `refund_reason` or `approve_order` with the same mechanism.

Whatever id you give an action is what the model sees. Keep it stable and specific. Use the description to explain what the control does, when it is available, and what the page looks like after it succeeds.

## When a goal is still useful

Case 07 has one boundary: when the dialog closes, `create-course-form` and its field actions disappear. If the person then asks “what is still missing on that course?”, the agent can see the catalogue but not the draft.

A goal covers that gap. The entire task integration in Case 06 is three lines:

```ts
const pling = usePling();
const disposeGoal = pling.task.goal(courseGoal(props.locale));
onBeforeUnmount(disposeGoal);
```

`courseGoal()` describes only the outcome and its boundaries:

```ts
export function courseGoal(locale: Locale): TaskGoalInput {
  return {
    id: "course.create",
    title: locale === "zh" ? "创建课程" : "Create a course",
    goal: "Create a course in the course workspace: open the real form yourself, fill what the person supplied, ask them to upload the cover, save, then read the catalogue back and confirm the new course is first.",
    constraints: [
      "The page's actions are the only way to operate it; do not invent field names, selectors or a second form.",
      "Fill only what the person supplied or explicitly delegated; ask when unsure.",
      "The person must upload the cover; never choose a local file for them.",
      "Questions, corrections, pauses and abandonment take precedence over filling the form.",
    ],
    successCriteria: [
      "The new course appears first in the catalogue",
      "Name, teacher, eligible cards and cover match what the person confirmed",
      "The save action read the catalogue back and confirmed the new record",
    ],
    examples: ["Create prenatal yoga with Chen Jing, 2 stars, monthly card, write the intro"],
  };
}
```

There is no `fields`, no `steps`, no `controller`, no form callback and no save function. The goal answers four questions:

- what outcome should be reached;
- which boundaries must not be crossed;
- what counts as done;
- why the work is still active after the dialog closes or the route changes.

`goal()` defaults to `keepActive: true`. Once a person or the model explicitly starts it, the goal stays active when the dialog closes, its region disappears, or the page briefly leaves the original route. The agent can keep answering, reopen the form, or ask the person to upload the cover first.

`route` and `scope` restrict where the goal can be started. They decide whether it is available now, not what may be operated. Every operation still goes through page actions.

### A goal is neither permission nor an executor

- It does not open the dialog. `new_course` does that.
- It does not fill a field. `course_name` and `course_teacher` do that.
- It does not save. `save_course` does that.
- It does not relax permissions. Every action keeps its own risk, confirmation, scope and audit rules.

A goal only manages lifecycle. It keeps an outcome alive across page changes and leaves an explicit completion or cancellation state.

### How a goal ends

While the goal is active, the model also sees `pling_complete_task`. It calls this only when the page satisfies every success criterion. The call writes no business data and does not replace `save_course`; it only marks the goal complete.

The order is:

1. the agent calls `save_course`;
2. the page's save handler writes the course;
3. `expect` reads the catalogue and confirms the new course is first;
4. the agent sees that evidence and calls `pling_complete_task`;
5. the goal card shows completed.

The person can cancel instead. Cancellation ends the goal without rolling back values already written to the form. The page belongs to the person; the framework does not undo their input.

## From one sentence to a course

Here is the real sequence in Case 06.

### 1. The person asks for a course

```text
Create a course: pregnancy yoga, Chen Jing, 2 stars, monthly card, write the intro
```

The agent sees the available `course.create` goal and the page's `new_course` action. It calls `pling_start_task`, then `new_course`.

Starting the goal changes nothing on the page. The dialog stays closed. Only the click handler behind `new_course` opens it.

### 2. The agent opens the real form

After `new_course` runs, `@click="openCreate"` executes:

```ts
function openCreate(): void {
  if (newCourseId.value) {
    Object.assign(draft, emptyCourseDraft());
    newCourseId.value = "";
    highlightedCourseId.value = "";
  }
  modalOpen.value = true;
  saveError.value = "";
}
```

This is the page's original **New course** logic. Clearing the previous draft, opening the dialog and resetting the error all belong to the page. The agent only clicked the button.

### 3. The agent fills what the person supplied

With the dialog open, the field actions enter the page. The agent calls:

- `course_name` with “Pregnancy yoga”;
- `course_teacher` with “Chen Jing”;
- `course_difficulty_2`;
- `course_cards` with “Monthly card”;
- `course_intro` with a draft based on the explicit “write the intro” delegation.

Each step is the same operation a person can perform. Vue `v-model`, `@change` and page validation work as usual.

### 4. Only real gaps are asked

The agent reads `draftRecord.fields.missing` and sees that the cover is missing. It says so. When the person asks where to click, it calls `pling_locate` and marks the upload tile.

After the person chooses a file, `handleCoverSelected` sets `draft.cover` to `true`. The `handoff` expectation passes, and the agent continues.

### 5. Save and read back

The agent calls `save_course`. The page checks four required values: name, teacher, eligible cards and cover. It then creates the course and puts the new record first.

`expect` checks:

```ts
check: () => courses.value[0]?.id === newCourseId.value
```

Only after that passes does the agent call `pling_complete_task`. The goal card moves from running to completed.

### 6. The dialog closes midway

If the person closes the dialog, `create-course-form` and its field actions disappear. The goal stays active because `goal()` keeps it by default.

The person can ask:

```text
What is still missing on that course?
```

The agent explains that the goal is still active but the form is closed. It can call `new_course` again, reopen the form, read the draft and continue. The values are still in `draft` because the page component was not unmounted.

### 7. Questions and changes are allowed at any time

The guide is not a “next question” script. The person can say:

- “Why can't you upload the cover?”
- “Change the teacher to Lin.”
- “Stop for now.”
- “Rename the course to Pregnancy Flow Yoga.”

The agent answers or handles that turn first, then decides whether to continue. A single-field change calls one action. Cancellation calls `pling_cancel_task` or the cancel button on the goal card. The goal ends and the page values stay as they are.

## Custom controls

Real back offices do not use only `input` and `select`. Declare the control's real interaction; do not rewrite it into a form for the agent.

| Control | Integration |
| --- | --- |
| Native input | `v-tool` with `action: 'fill'` |
| Native select | `v-tool` with `action: 'select'` |
| Row of star buttons | One click action per star |
| Custom date picker | One action to open, one to choose, or one parameterised action |
| Upload, signature, one-time code | `handoff`, completed by the person |
| Multi-step dialog | One action per real button, optionally composed with `steps` |

A custom date picker that accepts a value can use a parameterised action:

```ts
v-tool="{
  id: 'course_start_date',
  desc: 'Set the course start date in YYYY-MM-DD format',
  params: [{ name: 'date', label: 'Start date' }],
  run: ({ date }) => setStartDate(String(date))
}"
```

`run` still calls the page's own `setStartDate`. The agent does not need to know what the date panel looks like; it needs to know what value the action accepts.

Do not simulate uploads, one-time codes or payment confirmations. Use `handoff` to return control to the person, then use `expect` to check the page really changed.

## Why page code has no intent matching

Some integrations write:

```ts
if (/create course/.test(text)) openCreate();
```

That regular expression treats “which information does creating a course need?” as a create command. It cannot handle questions, changes or “stop for now”. Once the page owns intent matching, it becomes a second conversation layer and competes with the model.

This example gives understanding to the model and execution to the page. The model sees the goal, action descriptions, records and current page state, so it can distinguish a question, a change, a delegation and a cancellation. The page only owns real control availability and results.

## Follow along with a real page

These steps follow the files. Each one can run and be checked on its own. Finish the first seven steps in Case 07 before deciding whether step eight is needed.

### Prepare: run both cases

From the repository root:

```bash
pnpm dev:examples
```

Open:

- `http://127.0.0.1:5191/demos/course-create-directives-vue3/?lang=en`
- `http://127.0.0.1:5191/demos/course-workspace-vue3/?lang=en`

Open **New course** manually, fill a few fields and close the dialog. The two cases render the same page. Case 06 adds one goal; nothing else differs.

The entry for Case 07 is a thin wrapper:

```vue
<!-- examples/demos/course-create-directives-vue3/src/App.vue -->
<script setup lang="ts">
import CourseCreatePage from "../../../shared/course-create/CourseCreatePage.vue";
import type { Locale } from "../../../shared/course-workspace/copy";

defineProps<{ locale: Locale }>();
</script>

<template>
  <CourseCreatePage :locale="locale" task-placement="none" />
</template>
```

The integration lives in `examples/shared/course-create/CourseCreatePage.vue`. You do not create a second form for the agent or move the business page into the chat panel.

### Step 1: keep the page and confirm the baseline

Start with the original page. The dialog stays closed and the catalogue is visible. Do not add a task yet, and do not call `openCreate()` on mount.

The baseline has three properties:

1. the page starts on the catalogue with a visible **New course** button;
2. the form appears only after someone clicks that button;
3. closing the dialog removes the form and its field actions.

These properties determine the integration. The agent has to find the real button and operate the form like a person.

### Step 2: declare the real button with `v-tool`

Add one action to the existing **New course** button:

```vue
<button
  class="primary-button"
  type="button"
  v-tool="{
    id: 'new_course',
    kind: 'read',
    label: page.newCourse,
    desc: copy.newCourseDesc
  }"
  @click="openCreate"
>
  <span>＋</span>{{ page.newCourse }}
</button>
```

The declaration tells the agent what the button does. The click still runs the page's own `@click="openCreate"`.

Open the assistant debug panel and confirm that `new_course` appears. Then say:

```text
Create a course for me
```

The agent should call `new_course`, and the button should open the dialog. The page must not contain a branch such as `if (agent) openCreate()`.

### Step 3: name the dialog with `v-scope`

Expose the form region only while the dialog exists:

```vue
<div v-if="modalOpen" class="modal-layer">
  <section
    class="course-modal"
    role="dialog"
    aria-modal="true"
    v-scope="{
      id: 'create-course-form',
      label: page.form.title,
      description: copy.formScope,
      role: 'dialog'
    }"
    v-record="draftRecord"
  >
    <!-- existing form controls -->
  </section>
</div>
```

`v-scope` names a region. It does not turn the controls into actions or expose their values.

Close the dialog and check the assistant context. `create-course-form` should disappear. The agent must not believe that a closed form can still be edited.

### Step 4: publish the draft with `v-record`

The form needs a readable snapshot of its current values:

```ts
const draftRecord = computed(() => ({
  data: { ...draft },
  id: "course-draft",
  label: copy.value.draftLabel,
  fields: {
    name: draft.name,
    difficulty: draft.difficulty,
    teacher: teacherName.value || draft.teacherId,
    cards: draft.cards,
    intro: draft.intro,
    cover: draft.cover,
    required: [
      page.value.form.name,
      page.value.form.teacher,
      page.value.form.cards,
      page.value.form.cover,
    ],
    missing: requiredMissing.value,
  },
}));
```

Expose business fields only. Do not dump the whole store or the form instance.

The page computes `missing` with the same rule used by save. The agent and the person therefore see the same gaps.

Open an empty form and ask what is missing. Fill the name and teacher, then ask again. The answer should come from `draftRecord`, and the list should shrink from four items to two.

### Step 5: add one action per real control

Native inputs use `fill`:

```vue
<input
  v-model="draft.name"
  v-tool="{
    id: 'course_name',
    action: 'fill',
    label: page.form.name,
    desc: copy.fieldDesc.name
  }"
/>
```

Selects use `select`. Their descriptions list the real options:

```vue
<select
  :value="draft.teacherName"
  v-tool="{
    id: 'course_teacher',
    action: 'select',
    label: page.form.teacher,
    desc: copy.teacherDesc(teacherValues)
  }"
  @change="setTeacher(($event.target as HTMLSelectElement).value)"
>
  <option value="">{{ page.form.teacherPlaceholder }}</option>
  <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.name">
    {{ teacher.name }} · {{ teacher.subject }}
  </option>
</select>
```

`teacherValues` comes from page data. When the teacher list changes, the action description changes with it.

Custom controls follow their real interaction. Difficulty is five stars, so each star is one click action:

```vue
<button
  v-for="score in 5"
  :key="score"
  type="button"
  v-tool="{
    id: `course_difficulty_${score}`,
    kind: 'write',
    label: `${page.form.difficulty} ${score}`,
    desc: copy.difficultyDesc(score)
  }"
  @click="setDifficulty(score)"
>
  ★
</button>
```

Upload stays with the person. Use `handoff`:

```vue
<button
  class="upload-tile"
  type="button"
  v-tool="{
    id: 'course_cover',
    kind: 'write',
    label: page.form.cover,
    desc: copy.coverDesc,
    handoff: {
      reason: copy.coverHandoff,
      expect: { desc: copy.coverExpect, check: () => draft.cover }
    }
  }"
  @click="coverInput?.click()"
>
  <!-- upload tile -->
</button>
```

Try one complete request:

```text
Create prenatal yoga with Chen Jing, 2 stars, monthly card, write the intro
```

The agent should open the real dialog and call the name, teacher, difficulty, card and introduction actions. It must not write values into a hidden object.

Then ask:

```text
Where do I upload the cover?
```

The agent should call `pling_locate`, scroll the upload tile into view and highlight it. The file picker must not open by itself; the person still chooses the file.

### Step 6: verify save by reading the page back

A save is not complete because a function returned without an error. Add `expect`:

```ts
const saveTool = computed(() => ({
  id: "save_course",
  kind: "write",
  label: page.value.form.save,
  desc: copy.value.saveDesc,
  run: () => saveCourse(),
  expect: {
    desc: copy.value.saveExpect,
    check: () => courses.value[0]?.id === newCourseId.value,
  },
}));
```

`saveCourse()` remains the page's original handler. It validates required fields, creates the course and puts the new record first.

`expect` runs after the action returns. If the new course is not first, the save fails. The agent cannot report success or complete the goal.

Check four things:

1. save without a cover and the page reports the missing cover;
2. upload the cover and save, and the new course appears first;
3. inspect the action result and confirm that `expect` passed;
4. refresh the page and confirm that the record came from the page's save logic, not from the chat transcript.

### Step 7: add a goal only when continuity is required

Enter this step only when the first six steps are insufficient. The usual reasons are a dialog that can close, a person who leaves and returns, or an external agent that needs a fixed completion boundary.

The complete task integration in Case 06 is three lines:

```ts
const pling = usePling();
const disposeGoal = pling.task.goal(courseGoal(props.locale));
onBeforeUnmount(disposeGoal);
```

`courseGoal()` contains only the outcome, boundaries and success criteria:

```ts
export function courseGoal(locale: Locale): TaskGoalInput {
  return {
    id: "course.create",
    title: locale === "zh" ? "创建课程" : "Create a course",
    goal: "Open the real form, fill what the person supplied, ask them to upload the cover, save, then read the catalogue back and confirm the new course is first.",
    constraints: [
      "The page's actions are the only way to operate it; do not invent field names, selectors or a second form.",
      "Fill only what the person supplied or explicitly delegated; ask when unsure.",
      "The person must upload the cover; never choose a local file for them.",
      "Questions, corrections, pauses and abandonment take precedence over filling the form.",
    ],
    successCriteria: [
      "The new course appears first in the catalogue",
      "Name, teacher, eligible cards and cover match what the person confirmed",
      "The save action read the catalogue back and confirmed the new record",
    ],
    examples: ["Create prenatal yoga with Chen Jing, 2 stars, monthly card, write the intro"],
  };
}
```

Do not add `fields`, `steps`, `controller` or a save callback. Fields come from the real page. Save comes from `save_course`. The goal only keeps the job alive across page changes.

Check the lifecycle:

1. start the task and let the agent open the dialog;
2. close the dialog and ask what is still missing;
3. in Case 06 the goal remains active and the agent can reopen the form;
4. Case 07 has no goal, so the agent must reason from the current page;
5. after save and a passed `expect`, the agent calls `pling_complete_task`.

### Step 8: use the advanced API only when page actions are insufficient

Advanced `TaskDefinition` and `TaskController` solve different problems:

- field types, ranges, patterns or business validation;
- asynchronous lookup and candidate confirmation for large sets;
- several actions in a fixed order over shared values;
- tasks that run in a host without a UI.

They do more, and they add a second field definition. A single-page form does not need them. Make the page actions work first, then decide whether these capabilities are actually missing.

## Common mistakes

### The page opens the dialog for the agent

If the page sets `modalOpen = true` on load, the agent never has to find and click the real button. A task should also start on the catalogue instead of presenting an already-open form.

### A custom control gets a hidden input

A hidden input looks convenient, but it creates a second interaction. The person clicks a star while the agent writes a hidden field, and the two states drift. Declare the control's real behaviour.

### Action descriptions omit allowed values

The teacher list comes from page data, but the description does not name the teachers. The model has to guess and fails. Generate the description from page data so both change together.

### `expect` only checks for an exception

A save function that did not throw has not necessarily changed the business state. Read a page result, such as whether the new record is first. Without that evidence, the agent cannot claim success.

### Page code contains regex intent matching

`if (/create course/.test(text)) openCreate()` treats a question as a command. Let the model understand intent. The page provides actions and state.

### The goal repeats the field schema

A second `fields` array makes the form a second source of truth. A renamed field, a changed option or a new validation rule will drift. A goal manages lifecycle, not a form schema.

## Final result

After the first six steps, the page can create a course:

| The person says | The agent does | The page responds |
| --- | --- | --- |
| “Create prenatal yoga with Chen Jing, 2 stars, monthly card” | Calls `new_course`, then fills the matching fields | The dialog opens and the real form shows the supplied values |
| “What is missing?” | Reads `missing` from `draftRecord` | Reports only the real gaps |
| “Where do I upload the cover?” | Calls `pling_locate` | Scrolls to and highlights the upload tile |
| The person chooses a cover and says “save” | Calls `save_course` and waits for `expect` | The new course becomes first in the catalogue |
| The read-back passes | Reports the result | The list matches the page state |

After step seven, closing the dialog no longer loses the goal. The agent can reopen the form and continue. It calls `pling_complete_task` only after save and read-back succeed.

## Verify in the browser

Open [Case 06](/demos/course-workspace-vue3/?lang=en) and [Case 07](/demos/course-create-directives-vue3/?lang=en). Check:

- The dialog is closed on load and the page starts on the catalogue.
- `Create pregnancy yoga, Chen Jing, 2 stars, monthly card, write the intro` makes the agent click **New course**; the page button opens the dialog.
- Name, teacher, difficulty, eligible cards and introduction go into the real form with the same styling as manual input.
- `What is missing?` is answered from the draft record, not guessed.
- `Where do I upload the cover?` scrolls to and highlights the upload tile. The file picker does not open by itself.
- After the person chooses a cover and saves, the new course is first in the catalogue.
- The goal completes only after save; completing writes no business data.
- Close the dialog and ask what is missing. Case 06 keeps the goal active; Case 07 has no task layer.
- Cancel removes the goal without rolling back values already in the form.
- Long chats still scroll and the console stays clean.

## Boundary with the advanced API

`pling.task.goal()` is the default task integration. It has no field table and no step controller. Fields come from the real page; execution comes from real actions.

`pling.task.define()` remains for cases that genuinely need declarations:

- field types, ranges, patterns or business validation;
- asynchronous lookup and candidate confirmation for large sets;
- several actions executed in a fixed order over shared values;
- tasks that run in a host without a UI.

Those APIs solve “page actions cannot express this”, not “agent integration must start with a task”. Most single-page forms do not need them.

See the [guided task API](/reference/guided-task-api) for every parameter, state and method.
