---
id: SITE-03-course-create-directives-vue3
layout: page
pageClass: demo-page
title: "Case 07: Directives only — create a course (Vue 3)"
description: The same course page using only v-scope, v-record and v-tool. The dialog starts closed; the agent clicks the real create button and operates the real controls.
status: draft
release: 0.1
locale: en
---

<DemoPlayground id="course-create-directives-vue3" />

## Starting point: do not build a second form

This page comes from an ordinary course admin. The catalogue, dialog, teacher select, star rating and upload tile already exist. The person clicks **New course**, fills the form and saves.

The easy mistake is to declare another course field schema for the agent. Names, required rules, teacher options and save logic then live in two places. A page change requires a second change in the integration.

Case 07 takes a different route. The page only shares its regions, current values and real controls. The agent operates the page the same way a person does.

This case has no task goal. It runs the same create-course flow as [Case 06](/examples/course-workspace-vue3) with:

- `v-scope` naming the course catalogue and the create-course dialog;
- `v-record` publishing the current draft and saved courses;
- `v-tool` declaring every real control as an action.

The page starts on the catalogue. The dialog is closed. The agent sees the real `new_course` button and clicks it itself. No page callback opens the dialog, fills a field or submits the form.

## Implementation: from the entrance to save

The entry is `examples/demos/course-create-directives-vue3/src/App.vue`, a thin wrapper around the shared page. The integration is in `examples/shared/course-create/CourseCreatePage.vue`.

The real button carries the first action:

```vue
<button
  type="button"
  v-tool="{ id: 'new_course', kind: 'read', label: page.newCourse, desc: copy.newCourseDesc }"
  @click="openCreate"
>
  {{ page.newCourse }}
</button>
```

The agent calls `new_course`. The button's own `@click="openCreate"` opens the dialog. The page has no `if (agent) openCreate()` branch.

The dialog names its region and publishes the draft:

```vue
<section
  v-scope="{ id: 'create-course-form', label: page.form.title, description: copy.formScope }"
  v-record="draftRecord"
>
  <!-- existing form -->
</section>
```

`v-scope` defines the region. `v-record` exposes current values, requirements and gaps. Both disappear when the dialog closes.

Each real control gets an action. Inputs use `fill`, selects use `select`, and each custom star button is a click action. The cover is a `handoff`, so the person chooses the file.

Save calls the page's handler and reads the catalogue back:

```ts
expect: {
  desc: copy.value.saveExpect,
  check: () => courses.value[0]?.id === newCourseId.value,
}
```

If the new course is not first, save fails.

## Run and verify

From the repository root:

```bash
pnpm dev:examples
```

Open `http://127.0.0.1:5191/demos/course-create-directives-vue3/?lang=en` and check:

1. The page starts on the catalogue with the dialog closed.
2. `Create prenatal yoga with Chen Jing, 2 stars, monthly card, write the intro` makes the agent click **New course** itself.
3. The name, teacher, difficulty, cards and intro appear in the real form.
4. `What is missing?` is answered from the draft record.
5. `Where do I upload the cover?` highlights the real upload tile; the file picker does not open by itself.
6. After you choose a cover and save, the new course is first in the catalogue.

## Final result

The developer changes declarations on the existing page. There is no second form and no business logic moved into the chat panel.

The person says one sentence. The agent clicks the real create button, fills the real fields, asks only for the missing cover, calls the real save action and reads the catalogue back before reporting success.

For the same page with a persistent goal, open [Case 06](/examples/course-workspace-vue3).

## Business action ids are yours

Names such as `course_name`, `course_intro` and `course_cover` are **business action ids chosen by this example**. They are not predefined Pling APIs. The framework provides the declaration mechanism; the page chooses names, descriptions and constraints. Another application uses order, student or invoice ids in the same way.

## What the developer still describes

Directives do not derive a field schema. The action text states which values are required, which options exist and what the page looks like after success.

If the page adds a field, add its `v-tool`. If a select's options change, update the description. That is a small cost for a stable form. It becomes a second schema when the form is long, changes often or spans several pages.

## Custom controls

Difficulty is a row of custom star buttons, not a native input. Each star declares a click action. The upload is a `handoff`, so the person chooses the file. This is the normal way to connect controls that are not `input` or `select`.

Ask “Where do I upload the cover?”. The assistant calls the built-in `pling_locate` tool, scrolls the cover area into view and highlights it. It does not open the file picker or change the draft.

## When to use the goal

Use this directive-only case when one stable single-page form is the whole job. Move to [Case 06](/examples/course-workspace-vue3) when the outcome must survive closing the dialog or changing routes.
