# @plingjs/vanilla

The framework-free adapter for Pling. Declare actions, records, regions, and
read-only state on ordinary DOM elements, and mount the shared assistant surface
without Vue or React.

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

pling.dock({ title: "Todo assistant" });
```

Use `namespace` when several framework islands register the same local action,
record, region, or state ids. Call the unsubscribe function when a dynamic row
unmounts, and `pling.destroy()` when the page is torn down.

## Documentation

- [Vanilla and jQuery quick start](https://plingjs.dev/vanilla/quick-start-add-pling-to-a-vanilla-page)
- [Vanilla / jQuery adapter](https://plingjs.dev/reference/vanilla-jquery-adapter)
- [Vanilla JavaScript API](https://plingjs.dev/reference/api/vanilla)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
