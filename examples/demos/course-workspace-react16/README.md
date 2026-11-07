# Course management back office (React 16.3)

This is a real React 16.3 course back office for applications that cannot use Hooks. It
uses `@plingjs/react/legacy`, class components, render props, and the shared DOM
task card. The five tasks, duplicate-name lookup, conflict failure, and
activity evidence are the same as in the Hooks version. The card is rendered in
the assistant conversation, and the dock occupies a fused sidebar column.

## Run

From the repository root:

```bash
pnpm dev:examples
```

Open `http://127.0.0.1:5191/demos/course-workspace-react16/?lang=zh`.

## What to try

1. Choose **New course**, enter a course name, pick a teacher, and run the task.
   The new course should appear at the front of the catalogue.
2. Search `李娜` and distinguish the two records by masked phone.
3. Add a teacher, then schedule a lesson with that teacher.
4. Choose **Add note** on a schedule row and confirm that the note is saved to
   the selected lesson rather than to a newly entered id.
5. Try the conflicting Zhou Min slot and confirm that the write step is not
   executed.
6. Open Activity and Debug in the legacy assistant dock.

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
