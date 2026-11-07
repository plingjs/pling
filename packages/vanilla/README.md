# @plingjs/vanilla

The framework-free adapter for Pling. Declare actions, records, regions, and
read-only state on ordinary DOM elements, and mount the same assistant UI used
by the Vue and React adapters without depending on either framework.

```bash
npm install @plingjs/vanilla
```

```ts
import { createPling } from "@plingjs/vanilla";

const pling = createPling();
const todoList = document.querySelector("#todos")!;

pling.scope(todoList, {
  id: "todos",
  label: "Task list",
  role: "list",
});

pling.tool(document.querySelector("#add")!, {
  id: "add_task",
  desc: "Add a task",
});

pling.state("todo", () => ({ total: todos.length }), {
  description: "Current number of tasks",
});

pling.dock({
  title: "Todo assistant",
  quick: ["Add a task", "Complete the first task"],
  debug: { maxCalls: 8 },
});
```

Use `namespace` when several framework islands register the same local action,
record, region, or state ids. Call the unsubscribe function when a dynamic row
unmounts, and `pling.destroy()` when the page is torn down.

Declaring the same element or state key again replaces the previous declaration,
which matches the Vue directive's update lifecycle for rerendered DOM. Calling
an older unsubscribe function afterwards is safe.

## Parity with the Vue adapter

The public runtime supports the same page capabilities as `@plingjs/vue`:

- `pling.tool()` / `pling.action()` for atomic, parameterized, compound, and
  handoff actions.
- `pling.record()`, `pling.scope()`, and read-only `pling.state()` views.
- `pling.declareFeedback()`, `pling.declareTask()`, and `pling.guideTarget()`.
- Page identity, coverage diagnostics, sensitive values, and expectations.
- `pling.dock()` with Chat and Activity, model settings, the read-only debug
  inspector, and `dock`, `sidebar`, or `inline` layouts. Shared continuity also
  adds a Tasks tab for following, taking over, or forking work started in
  another tab or device.
- `pling.surfaceGateway()` plus `createSurfaceAccessPanel()` for governed
  external-Agent access.

The adapter exposes but does not reimplement the shared runtime under
`@plingjs/core`, `@plingjs/dom`, `@plingjs/agent`, and `@plingjs/surface-browser`.

## Guided tasks

`createTaskPanel` and `createTaskCard` render a `TaskController` from
`@plingjs/agent` without adding another task runtime. The panel is a standalone
workspace; the card is the compact form that belongs in the assistant
transcript. Task steps still go through the executor or business bridge
supplied by the host.

```ts
import { createTaskController } from "@plingjs/agent";
import { createTaskCard } from "@plingjs/vanilla";

const tasks = createTaskController({
  invoke: (action, args) => executor.execute(action, JSON.stringify(args)),
});

const card = createTaskCard(tasks, {
  locale: "en-US",
  catalog: false,
  onPrompt: (prompt) => pling.ask(prompt),
});

pling.dock({ layout: "sidebar", sidebarMode: "fused", task: card.element });
```

Set `catalog: false` when task entrances already exist on the page; call
`card.open(...)` from a row action or a button. `card.setCatalog(false)` hides
the catalog without closing the active run. Vue and React expose the same
renderer as `AgentTaskCard`, mounted through `AgentDock`'s `#task` slot or
`task` prop. `createTaskPanel()` remains available when a task needs its own
dedicated area.

When the next step is only a few actions, do not add another card. Use the
compact action row from `@plingjs/dom` (re-exported by this package). A long
recommendation stays a one-line preview; the full value remains in `title` and
`aria-label`, and the button never renders business copy as its width:

```ts
import { createGuideActions } from "@plingjs/vanilla";

const actions = createGuideActions({
  ariaLabel: "Booking note actions",
  onCommand: (command) => runCourseCommand(command),
  items: [
    { id: "locate", label: "Point to the field", command: "focus-note", kind: "primary" },
    {
      id: "use",
      label: "Fill it in",
      preview: "Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
      ariaLabel: "Fill in booking notes: Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
      command: "apply-note",
      kind: "suggestion",
    },
  ],
});

document.querySelector("#course-actions")!.replaceChildren(actions.element);
```

The renderer never writes a field. It emits the host's `command`; the page still
owns validation, the executor, and read-back.

When a task belongs to the currently selected row or detail page, open it with
the third argument. A definition marked `requiresRecord: true` cannot be started
without a record, and the generic task list shows it as an entry point rather
than a runnable card:

```ts
card.open("lesson.note", {}, {
  record: { id: lesson.id, label: `${lesson.course} · ${lesson.date}` },
});
```

The panel shows the bound record in the task header. The binding is page
context, not user input and not an authorization grant. Register lookup fields as
model-facing read actions with `registerTaskLookupActions(pling, tasks.list())`.

## Documentation

- [Vanilla and jQuery quick start](https://plingjs.dev/vanilla/quick-start-add-pling-to-a-vanilla-page)
- [Vanilla / jQuery adapter](https://plingjs.dev/reference/vanilla-jquery-adapter)
- [Vanilla JavaScript API](https://plingjs.dev/reference/api/vanilla)
- [Guided task API](https://plingjs.dev/reference/guided-task-api)
- [Full reference source](https://github.com/plingjs/pling/blob/main/content/tutorial/REF-09-vanilla-jquery-adapter.en.md)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
