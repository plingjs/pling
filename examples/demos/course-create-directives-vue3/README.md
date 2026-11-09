# Create a course with directives only (Vue 3)

This is the create-course page without a task goal. It uses only three
declarations:

- `v-scope` names the course catalogue and the create-course dialog;
- `v-record` publishes the in-progress draft and each saved course;
- `v-tool` declares one action for each real control.

The page starts on the catalogue with the dialog closed. The agent sees the
real `new_course` button and clicks it itself. No page callback opens the
dialog, focuses a field, fills the draft or submits the form.

This is the shortest integration in the repository. Use it when one stable
single-page form is the whole job.

## Run

From the repository root:

```bash
pnpm dev:examples
```

Open `http://127.0.0.1:5191/demos/course-create-directives-vue3/?lang=zh`.
Remove `?lang=zh` for the English copy.

The model request goes through the shared example gateway. No provider key is
read by the browser.

## What each directive gives the agent

| Directive | Declaration | What the agent gets |
| --- | --- | --- |
| `v-scope` | `create-course-form`, `course-catalogue` | A named region around related controls and records |
| `v-record` | `draftRecord`, one record per course card | Read-only current values, required labels and missing labels |
| `v-tool` | one action per input, select, star button, upload and save | A narrow action with a description; no arbitrary selector |

The draft is a record, not hidden state. That is how the agent can answer
“what is still missing?” without a second read tool.

## How the flow works

1. The page opens on the catalogue. The dialog is closed.
2. The person describes the course, for example
   `孕妇瑜伽，陈静，2 星，月卡，介绍自动填写`.
3. The agent calls `new_course` on the real button. The button's own click
   handler opens the dialog.
4. The agent fills `course_name`, `course_teacher`, `course_cards`,
   `course_intro` and any other field the person supplied.
5. Difficulty is a row of custom star buttons, so the agent clicks
   `course_difficulty_2` rather than writing a hidden field.
6. The cover is a `handoff`: the agent asks the person to upload it and waits
   for the page to record the choice. Ask “上传封面在哪里点？” and the agent
   calls the built-in `pling_locate` tool to scroll to and highlight the upload
   tile. Locate is read-only; the person still chooses the file.
7. `save_course` runs the page's own save handler and declares an `expect`
   check: the new record must be first in the catalogue.

Names such as `course_name`, `course_intro` and `course_cover` are business
action ids chosen by this example. They are not Pling API names. Another
application uses order, student or invoice ids in the same way.

## What the developer still has to describe

Directives do not derive a field schema. The agent understands the page from
each action's description:

- required fields are stated in the action text;
- the teacher list and card labels are listed in the description because they
  come from page data;
- the upload rule is stated in `handoff`;
- the save outcome is stated in `expect`.

If the page adds a field, add its `v-tool`. If a select's options change, update
the description with the options. This is small for a stable form. It becomes a
second schema when the form is long, changes often or spans several pages.

## Optional copy and delegation

The introduction is optional. Its action description says to prefer the
person's exact words. When the person explicitly says “write it for me” or
“fill it however”, the description permits the agent to draft the introduction
from the known course name, level and teacher. That is explicit delegation, not
inventing data without permission.

## When to add the goal

Case 06 uses the same page and adds one `pling.task.goal()`. The goal does not
open, fill or save anything. It adds only the lifecycle the DOM cannot express:

- the outcome stays active when the dialog closes or the route changes;
- the task can be cancelled or marked complete;
- an external agent gets the same goal and completion boundary.

Use the goal when the work must survive page changes. Keep this directive-only
case when the form is stable and one page is enough.

## Files

- `src/App.vue` — a thin wrapper around the shared page.
- `src/main.ts` — the Vue entry and Pling setup.
- `src/course-create.css` — the shared course-page styling.
- `shared/course-create/CourseCreatePage.vue` — the real page and all three
  directive declarations.
- `shared/course-create/copy.ts` — action descriptions and assistant copy.
- `shared/course-create/model.ts` — course rules and mock catalogue.
- `shared/course-create/page.ts` — page copy and seed values.
