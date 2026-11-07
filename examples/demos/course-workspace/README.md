# Course management back office (Vanilla)

A realistic course-management back office for a yoga studio. It has a course
catalogue, students with membership cards, teachers, and a weekly schedule. The
assistant carries a guided task in chat as a compact action row, so a user can
create a course from one sentence without knowing which controls to click or how
to phrase a prompt. The page remains the place where business data is read and
changed.

The page uses a local mock service, not a business backend. Model requests still
go through the shared example gateway; no provider key enters the browser.

## Run

From the repository root:

```bash
pnpm dev:examples
```

Open:

- `http://127.0.0.1:5191/demos/course-workspace/?lang=zh`
- `http://127.0.0.1:5191/demos/course-workspace/`

## What to try

1. **Create a course.** The form opens on entry. Say
   `孕妇瑜伽，陈老师，2 星，介绍自动填写，用月卡`. The model writes the
   values it understood through `pling_update_task`; the page validates them and
   puts them into the original form. Upload a cover, review, and confirm; the new
   course appears first in the catalogue.
2. **Check a student's membership.** Search `李娜` or `Li Na`. Two students have
   the same name; their masked phone numbers distinguish them.
3. **Add a teacher.** Enter a name, phone, and subject. The new teacher is
   immediately available in the scheduling task.
4. **Schedule a lesson.** Pick a student, teacher, date, and time. The first step
   checks for a conflict; the lesson is written only after that step succeeds.
5. **Write a lesson note.** Choose **Add note** on a schedule row. The lesson is
   already bound, so the form asks only for the note text. The assistant sidebar
   opens before the bound task card appears.
6. **Trigger a failure.** Schedule Zhou Min on `2026-03-16` at `10:00`. The first
   step reports the existing lesson and the second step does not run.

## Agent-first, not a script

The page does not parse natural language. It exposes a task definition, a guide,
and explicit commands; the model reads the active task's goal, constraints,
fields, current values, and gaps, then decides what to update or ask. A question,
a correction, a pause, or a side request remains ordinary conversation.

`TaskField` validation runs before a model value reaches the form. `cover` is
`agentWritable: false`, so the assistant locates the upload control instead of
faking a required file. `pling_focus_field` only moves attention,
`pling_review_task` opens a read-only review, `pling_propose_save` opens
confirmation without writing, and `pling_cancel_task` ends the guide. The real
write still runs `create_course` from the page and checks the catalogue
afterwards.

Open the assistant dock and switch to Activity or Debug to inspect the model
request, tool arguments, and page evidence.

## How the pieces fit

- `examples/shared/course-workspace/course-service.ts` owns the mock data and
  business rules. Every operation is also registered as a Pling action.
- `examples/shared/course-workspace/tasks.ts` defines five guided tasks. The
  course task is agent-first: fields hold working memory, validation belongs to
  the page, and one deterministic step writes through `create_course`. The
  lesson-note task reads the selected record from the task binding instead of
  asking for a database id.
- `examples/shared/course-workspace/runtime.ts` registers the actions, creates
  one executor, and passes `executor.execute` to the task controller. There is
  no second executor and no second approval path.
- `createTaskCard()` comes from `@plingjs/vanilla`. It renders the same
  controller as the full panel with a compact conversation treatment, and the
  dock mounts that card inside the chat transcript.
- The dock uses a fused sidebar column. The page and the assistant stay visible
  together without one covering the other.
- `examples/shared/course-workspace/copy.ts` keeps both languages aligned. Add a
  task copy in one place and both page and panel use it.

## Source map

- `src/main.ts` — the standalone page entry and rendering.
- `examples/shared/course-workspace/runtime.ts` — actions and task runtime.
- `examples/shared/course-workspace/tasks.ts` — task definitions and field contracts.
- `examples/shared/course-workspace/course-service.ts` — students, cards, teachers, conflicts, activities.
- `examples/shared/course-workspace/copy.ts` — English and Chinese copy.
- `examples/shared/course-workspace/styles.css` — workspace layout shared by framework variants.
- `src/main.ts` — creates the card, mounts it into the dock, and uses a fused sidebar.
- `index.html` — standalone Vite entry.
