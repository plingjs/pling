# Course management back office (React 19)

This is the React 19 Hooks version of the Bingcao Studio course back office. It uses
`usePlingScope`, `usePlingRecord`, `usePlingState`, and `AgentDock`. Rendering and
hook cleanup belong to React; the agent-first course task, lookup, conflicts,
task progress, and execution belong to the shared course runtime.

The guided task is rendered inside `AgentDock`'s `task` slot. In guide mode the
conversation shows a compact action row instead of a second form. The dock
occupies a fused sidebar column, so the conversation and the business page remain
visible together.

## Run

From the repository root:

```bash
pnpm dev:examples
```

That command starts the main examples server and a separate React 19 Vite server.
Open `http://127.0.0.1:5191/demos/course-workspace-react/?lang=zh`.

You can also run the isolated entry directly:

```bash
pnpm --filter @plingjs/examples dev:react19
```

Then open `http://127.0.0.1:5195/demos/course-workspace-react/?lang=zh`.

## Why a separate Vite entry

The repository also contains a real React 16.3 compatibility example. React 16.3
and React 19 cannot share one Vite dependency graph without risking two React
runtime instances. The React 19 demo therefore has its own `vite.config.ts`,
local React 19 dependencies, and build output. The main examples server proxies
the public path during development, so the user-facing URL stays the same.

`pnpm --filter @plingjs/examples build` builds the main examples first and then
this isolated entry into `examples/dist/demos/course-workspace-react/`.

## What to try

1. The create-course form opens on entry. Say
   `孕妇瑜伽，陈老师，2 星，介绍自动填写，用月卡`. The model writes the values
   it understood through `pling_update_task`; the page validates them and puts
   them into the original form. Upload a cover, review, and confirm; the new
   course appears first in the catalogue.
2. Search `李娜` and select the record with `139****5678`.
3. Add a teacher and schedule a lesson with the refreshed teacher option.
4. Choose **Add note** on a schedule row and verify that the note is written to
   that lesson without asking for a lesson id.
5. Trigger the Zhou Min slot conflict and verify that the failed step remains
   visible.
6. Open Activity and Debug in the assistant sidebar.

## Agent-first, not a script

There is no natural-language regex in the React components. The model sees the
active task's objective, constraints, fields, current values, and gaps, then
decides whether to update one field, several fields, ask a question, or leave the
task alone. A correction such as “难度改成 4 星” updates only that field; an
unrelated question gets an answer instead of becoming the course name.

The page owns validation and the final move. `TaskField` bounds and `validate`
run before a value reaches the form, `cover` is `agentWritable: false`, and
`pling_propose_save` opens confirmation without executing `create_course`.
`pling_focus_field` only locates a real control, `pling_review_task` opens a
read-only review, and `pling_cancel_task` ends the guide without rolling back the
form. The page re-reads every value and checks the catalogue after the write.

## Source map

- `src/main.tsx` — React 19 root and Pling provider.
- `src/App.tsx` — page, Hooks, declarations, task runtime, and dock.
- `src/react19-runtime.js` — small runtime boundary used by the demo.
- `vite.config.ts` — isolated development and production build.
- `examples/shared/course-workspace/` — shared business and task code.
- `index.html` — Vite entry.

`AgentTaskCard` and `AgentDock` share the same `TaskController`; switching the
page framework does not create a second task state machine.
