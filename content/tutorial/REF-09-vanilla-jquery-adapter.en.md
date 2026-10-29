---
id: REF-09
title: "Vanilla / jQuery adapter"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Vanilla and jQuery adapter (`@plingjs/vanilla`)

`@plingjs/vanilla` is the DOM-level adapter. It has no framework dependency. Vue 2.7 also builds on it, which makes it the smallest executable reference for how declaration, visibility, and execution fit together.

jQuery projects use this adapter directly. There is no separate jQuery package, and none is needed: `pling.tool()` accepts any DOM element, including `$el[0]`.

## Instance

```ts
import { createPling } from "@plingjs/vanilla";

const pling = createPling({
  agent: {
    config: {
      baseUrl: "/llm/v1",
      model: "your-model",
      apiKey: "",
    },
  },
  presence: true,
  derive: false,
});

const dock = pling.dock({
  title: "Task assistant",
  quick: ["Add a task", "Complete the first task"],
});
```

`createPling(options)` accepts `ui`, `registry`, `shared`, `namespace`, `onWarn`, `agent`, `revealSensitive`, `defaultApproval`, `scopes`, `presence`, and `derive`. It returns a `VanillaPling`.

| Method | Returns | Purpose |
| --- | --- | --- |
| `tool(element, options)` | unbind | Declare an element action |
| `action(options)` | unbind | Declare a function-level action |
| `record(element, value)` | unbind | Declare a row record |
| `scope(element, options)` | unbind | Declare a region |
| `state(key, source, options?)` | unbind | Register a read-only view |
| `setActiveScopes(ids)` | — | Manual activation for layouts the observer cannot infer |
| `dock(options?)` | `VanillaDock` | Mount the shared assistant |
| `derived()` | controller or `null` | Access the automatic-derivation controller |
| `destroy()` | — | Stop observers and unregister declarations |

Every declaration returns an unbind function. Keep it and call it when the node is removed by code you own. The runtime also tracks the element for scope visibility; removing the node without unbinding leaves a stale registration until `destroy()`.

## Element actions

```ts
const addButton = document.querySelector<HTMLButtonElement>("#add")!;

const unbind = pling.tool(addButton, {
  id: "add_task",
  desc: "Add the text in the composer as a task",
  kind: "write",
  available: () => {
    const input = document.querySelector<HTMLInputElement>("#composer")!;
    return input.value.trim() ? true : "The composer is empty";
  },
});
```

For a fill action, declare the input itself:

```ts
pling.tool(document.querySelector<HTMLInputElement>("#composer")!, {
  id: "composer_text",
  desc: "Fill the new task text",
  action: "fill",
  params: [{ name: "text", label: "Task text" }],
});
```

For an operation with no element, use `pling.action()`:

```ts
pling.action({
  id: "clear_completed",
  desc: "Remove every completed task",
  kind: "danger",
  run: () => removeCompleted(),
});
```

## Records and regions

```ts
for (const task of tasks) {
  const row = document.querySelector(`[data-task="${task.id}"]`)!;
  pling.record(row, { data: task, label: task.title });
}

pling.scope(document.querySelector("#task-list")!, {
  id: "task_list",
  label: "Task list",
  role: "list",
});
```

Records inherit the nearest declared region. An action declared inside an inactive or covered region is removed from the model's snapshot with a reason.

## State

```ts
const offState = pling.state("task_view", () => ({
  filter,
  appliedSearch,
  matched: visibleTasks.length,
  total: tasks.length,
}), {
  description: "Current filter, applied search, and task counts",
});
```

`state` is read-only. It has no setter and does not create an action. If the model should be able to change the filter, declare the filter control with `pling.tool()`.

## jQuery shape

```js
const $ = window.jQuery;

const pling = createPling({ agent: { config: { baseUrl: "/llm/v1", model: "your-model" } } });

pling.tool($("#add")[0], { id: "add_task", desc: "Add a task", kind: "write" });
pling.scope($("#task-list")[0], { id: "task_list", label: "Task list", role: "list" });
$("#add").on("click", addTask);
```

Attach Pling after the element exists. If a plugin replaces the DOM node later, unbind the old declaration and declare the new node. Do not keep a declaration pointing at a detached clone.

## Defaults and boundaries

- `presence` is on by default; `presence: false` disables the highlight.
- `derive` is off by default.
- `kind` defaults to `write`; confirmation follows the active approval policy.
- `ui` defaults to English and the light theme.
- The adapter has no compound `steps`, page feedback, guide targets, task entrance, model settings UI, debug inspector, coverage scanner, or Router page identity.
- Surface describe/invoke is provided by `@plingjs/surface`, not by this adapter.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Action remains after the node is replaced | The old unbind was not called | Unbind before replacing the DOM |
| Action never appears | The element is detached, disabled, covered, or in an inactive region | Check `isConnected`, disabled state, and the region |
| Record fields are stale | A copy was passed instead of the live object | Pass the current business object or a reader |
| Duplicate id | A loop reused a constant id | Add the row key |
| State never updates | A snapshot value was passed | Pass a function |
| Dock has no model | No `agent.config` and no environment variables | Configure one of them |

## Evidence

- Adapter implementation: `packages/vanilla/src`.
- Runnable vanilla / jQuery example: `examples/recipes/vanilla`.
- Vue 2.7, which reuses this adapter: `examples/recipes/vue2`.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/vanilla` `0.1.0-alpha.3` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later for builds |
| Peer dependencies | None; jQuery is optional |
| Stability | Pre-1.0 alpha; a minor release may change the API |

The adapter assumes a browser DOM and an ES2022-capable build. jQuery only affects the optional wrapper; the declaration and execution contract on this page is the same without it.
