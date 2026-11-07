# Course management back office (React 16.3)

This is a real React 16.3 course back office for applications that cannot use Hooks. It
uses `@plingjs/react/legacy`, class components, render props, and the shared DOM
task view. The five tasks, agent-first course flow, duplicate-name lookup,
conflict failure, and activity evidence are the same as in the Hooks version.
The guide is rendered in the assistant conversation, and the dock occupies a
fused sidebar column.

## Run

From the repository root:

```bash
pnpm dev:examples
```

Open `http://127.0.0.1:5191/demos/course-workspace-react16/?lang=zh`.

## What to try

1. The create-course form opens on entry. Say
   `孕妇瑜伽，陈老师，2 星，介绍自动填写，用月卡`. The model writes the values
   it understood through `pling_update_task`; the page validates them and puts
   them into the original form. Upload a cover, review, and confirm; the new
   course appears first in the catalogue.
2. Search `李娜` and distinguish the two records by masked phone.
3. Add a teacher, then schedule a lesson with that teacher.
4. Choose **Add note** on a schedule row and confirm that the note is saved to
   the selected lesson rather than to a newly entered id.
5. Try the conflicting Zhou Min slot and confirm that the write step is not
   executed.
6. Open Activity and Debug in the legacy assistant dock.

## Agent-first, not a script

React 16.3 changes the mounting API, not the task contract. The model reads the
active task's goal, constraints, fields, values, and gaps, then calls
`pling_update_task` with only what the person supplied. The page does not run a
natural-language parser; a question, a correction, or a side request stays in the
conversation.

`TaskField` bounds and `validate` run before a value reaches the form. The cover
is page-owned (`agentWritable: false`), so the assistant locates the upload
control instead of inventing a file. `pling_focus_field` only highlights,
`pling_review_task` opens a read-only review, `pling_propose_save` opens
confirmation without writing, and `pling_cancel_task` ends the guide. The page
re-reads the form and checks the catalogue after the real `create_course` call.

## How the pieces fit

- `src/main.tsx` uses `ReactDOM.render`, `PlingProvider`, and the React 16.3
  provider from the legacy entry.
- `src/App.tsx` uses `PlingScope` and `PlingRecord` render props to bind DOM
  elements during component mount and update.
- The task runtime is created when the class is constructed; the shared
  `createTaskCard()` view is passed to `AgentDock` through its `task` prop.
- `examples/shared/course-workspace/` owns the service, task contracts,
  execution bridge, copy, and styles.

React 16.3 has context, refs, and fragments, but no Hooks. The legacy entry
therefore uses class-based bindings and render props rather than pretending the
Hooks API is available.

## Source map

- `src/main.tsx` — React 16.3 root and provider.
- `src/App.tsx` — class page, scope/record bindings, task card, and fused dock.
- `examples/shared/course-workspace/` — shared business and task code.
- `index.html` — Vite entry.
