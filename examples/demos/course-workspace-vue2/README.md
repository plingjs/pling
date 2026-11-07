# Course management back office (Vue 2.7)

This example runs the Bingcao Studio course back office on Vue 2.7. It uses the Composition API
available in 2.7, a render function instead of a Vue 3 template, and the
`@plingjs/vue2` adapter. The agent-first task view is the shared DOM view from
`@plingjs/vanilla`, mounted in the assistant chat inside a fused sidebar.

The page is intentionally not a Vue 3 compatibility-mode app. It is a real
Vue 2.7 entry with its own runtime and directives, so the compatibility path can
be evaluated directly.

## Run

From the repository root:

```bash
pnpm dev:examples
```

Open `http://127.0.0.1:5191/demos/course-workspace-vue2/?lang=zh`.

## What to try

1. The create-course form opens on entry. Say
   `孕妇瑜伽，陈老师，2 星，介绍自动填写，用月卡`. The model writes the values
   it understood through `pling_update_task`; the page validates them and puts
   them into the original form. Upload a cover, review, and confirm; the new
   course appears first in the catalogue.
2. Search `李娜`, confirm that both candidates appear, and select the one with
   `139****5678`.
3. Add a teacher and check that the scheduling select refreshes.
4. Schedule a lesson, choose **Add note** on its row, and check that the note is
   written to that lesson without entering its id.
5. Try the conflicting slot for Zhou Min.
6. Open the assistant and compare Activity with the Vue 3 version.

The lesson-note action opens the dock first, then opens the task with the
selected lesson as its binding. No component asks the user for a lesson id.

## Agent-first, not a script

Vue 2.7 owns the component lifecycle and render function; it does not own a
natural-language parser. The model reads the active task's objective,
constraints, fields, current values, and gaps, then writes only the values the
person supplied. Questions, corrections, pauses, and side requests remain
ordinary conversation.

`TaskField` bounds and `validate` run before a value reaches the form. The cover
is page-owned (`agentWritable: false`), so the assistant locates the upload
control instead of inventing a file. `pling_focus_field` only highlights a real
field, `pling_review_task` opens a read-only review, `pling_propose_save` opens
confirmation without writing, and `pling_cancel_task` ends the guide. The page
re-reads the form and checks the catalogue after the real `create_course` call.

## How the pieces fit

- `src/main.ts` installs the Vue 2 plugin and mounts the workspace.
- `src/CourseWorkspace.ts` defines the render tree, directives, task view, and
  fused assistant dock.
- `src/vue2-runtime.js` isolates the Vue 2 module resolution needed by the
  monorepo.
- The shared course files define the business service, task contracts, runtime,
  copy, and styles.

`@plingjs/vue2` connects Vue 2.7 directives and lifecycle to the same DOM
runtime used by the Vanilla example. It does not import `@plingjs/vue` or
Vue 3, and the task controller is not reimplemented here.

## Source map

- `src/main.ts` — Vue 2.7 plugin and mount.
- `src/CourseWorkspace.ts` — render tree, declarations, and dock.
- `src/vue2-runtime.js` — Vue 2.7 module boundary.
- `examples/shared/course-workspace/` — shared business and task code.
- `index.html` — Vite entry.
