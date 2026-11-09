---
id: SITE-03-course-workspace-vue3
layout: page
pageClass: demo-page
title: "Case 06: A persistent goal — create a course (Vue 3)"
description: The same real course page plus one goal. The agent opens the actual create dialog, operates the real controls, asks the person to upload the cover, saves and reads the catalogue back.
status: draft
release: 0.1
locale: en
---

<DemoPlayground id="course-workspace-vue3" />

## Starting point: add what the page cannot express

Case 07 already creates a course. It has one boundary: closing the dialog removes the form region and its field actions. If the person leaves and returns, the agent can no longer see the draft.

Case 06 adds a goal to the same page. The goal does not copy fields or take over save. It answers four questions:

- what outcome must be reached;
- which boundaries cannot be crossed;
- what evidence makes the job complete;
- why the job remains active after the dialog closes or the route changes.

## Implementation: three lines

The page is identical to [Case 07](/examples/course-create-directives-vue3). Both start on the course catalogue with the dialog closed. The agent must call the real `new_course` button before it can see the form.

The complete task integration is:

```ts
const pling = usePling();
const disposeGoal = pling.task.goal(courseGoal(props.locale));
onBeforeUnmount(disposeGoal);
```

`courseGoal()` contains only the outcome, constraints and success criteria:

```ts
{
  id: "course.create",
  title: "Create a course",
  goal: "Open the real form, fill what the person supplied, ask them to upload the cover, save, then read the catalogue back.",
  constraints: ["Page actions are the only entrance", "The person uploads the cover"],
  successCriteria: ["The new course appears first in the catalogue"],
}
```

There are no `fields`, `steps`, `controller` or save callbacks. Fields come from the real page. Save comes from `save_course`.

## Run and verify

From the repository root:

```bash
pnpm dev:examples
```

Open `http://127.0.0.1:5191/demos/course-workspace-vue3/?lang=en` and check:

1. The page starts on the catalogue with the dialog closed.
2. `Create prenatal yoga with Chen Jing, 2 stars, monthly card, write the intro` starts the goal and makes the agent click **New course**.
3. Close the dialog and ask what is still missing. The goal remains active and the agent can reopen the form.
4. `Where do I upload the cover?` highlights the real upload tile; you still choose the file.
5. After save, `save_course` reads the catalogue back and confirms the new record is first.
6. Only then does the agent call `pling_complete_task`; the goal card becomes completed.

## Final result

The person experiences one continuous job. Closing the dialog does not lose the goal. The agent can reopen the form, answer a follow-up or ask for the cover.

The page has no second form and no second execution channel. The goal manages lifecycle; each page action still passes through its own permission, confirmation and audit rules.

The goal has no fields, steps, controller or business callbacks. It keeps the outcome active after the dialog closes or the route changes, and it adds explicit cancel and complete actions.

## What the goal does not do

- It does not open the dialog. `new_course` does that through its own click handler.
- It does not read or write a field. `course_name`, `course_teacher`, `course_cards` and the other page actions do that.
- It does not save. `save_course` runs the page's own handler and reads the catalogue back.
- It does not grant permission. Every action keeps its risk, confirmation, scope and audit rules.

The only extra model action is `pling_complete_task`. It closes the goal after the page satisfies the success criteria; it writes no business data.

## Why one page, two cases

Case 07 is the shortest integration. Use it when a stable single-page form is the whole job.

Case 06 is the same page plus continuity. Use it when the dialog may close, the person may leave and return, or an external agent needs a fixed completion boundary.

Neither case adds a second form or a second execution channel.
