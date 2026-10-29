---
id: REF-01
title: "Core declarations: actions, records, regions, state"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Core declarations: actions, records, regions, and state

Pling exposes a page to a model through four kinds of declarations. They answer different questions and are deliberately not interchangeable:

| Declaration | Question it answers | Write path |
| --- | --- | --- |
| Action | What can be done here? | Yes |
| Record | Which object is this, and what does it contain? | No |
| Region | Where is this, and is it currently reachable? | No |
| State | What view is currently in effect? | No |

Only actions write. Records, regions, and state describe; they never become a second execution channel.

## Actions

An action is a stable id, a description written for the model, a risk kind, and an execution route. The route is either a DOM primitive (`click`, `fill`, `select`, `press`, `hover`), an injected `run`, or a `handoff` that asks the user to complete the step.

| Field | Required | Default | Notes |
| --- | --- | --- | --- |
| `id` | Recommended | Generated once for element bindings | Stable ids are mandatory for list rows and task continuity |
| `desc` | Yes | — | The model's only explanation of the operation |
| `kind` | No | `"write"` | `"read"`, `"write"`, or `"danger"` |
| `params` | No | — | Array shorthand or JSON Schema; array params are required unless `optional: true` |
| `run` | No | DOM primitive | Receives validated, unmasked arguments |
| `available` | No | — | `false` or a string makes the action unavailable; the string is shown to the model |
| `expect` | No | — | Waits for a result; failure becomes `EXPECTATION_FAILED` |
| `confirm` | No | Derived from the policy | `true` or `"always"` |
| `handoff` | No | — | The user completes the step; `run` is not executed |
| `action` / `target` / `autoTarget` / `fidelity` | No | Inferred | Control how a DOM primitive resolves its target |

```ts [Vue 3]
const submit = { id: "add_task", desc: "Add a task from the composer", kind: "write" };
```

```tsx [React]
const submit = usePlingTool<HTMLButtonElement>({
  id: "add_task",
  desc: "Add a task from the composer",
  kind: "write",
});
```

```ts [Vanilla / jQuery]
const off = pling.tool(document.querySelector("#add")!, {
  id: "add_task",
  desc: "Add a task from the composer",
  kind: "write",
});
```

```ts [Vue 2.7]
// <button v-tool="{ id: 'add_task', desc: 'Add a task from the composer' }">
// The directive accepts the same ToolOptions shape.
```

Declaring an action does not guarantee it is visible. Disabled elements, covered elements, inactive regions, and failed `available()` checks remove it from the model's action list and attach a reason. This is intentional: “not registered” and “temporarily unavailable” are different states and should remain distinguishable.

## Records

A record gives a row an identity and a bounded set of fields. The identity must come from the business object, not from its position in the array.

```ts [Vue 3]
// <li v-for="task in tasks" :key="task.id" v-record="{ data: task, label: task.title }">
```

```tsx [React]
const row = usePlingRecord({ data: task, label: task.title });
return <li ref={row}>{task.title}</li>;
```

```ts [Vanilla / jQuery]
const off = pling.record(rowElement, { data: task, label: task.title });
```

```ts [Vue 2.7]
// <li v-for="task in tasks" :key="task.id" v-record="{ data: task, label: task.title }">
```

Defaults:

- id: `data.id`, then `data.key`;
- fields: the data object without the id field;
- scope: the nearest enclosing region;
- order: page order when the adapter can determine it.

Records are read-only. A row action is still an action and still goes through availability, policy, execution, and expectation checks. Do not try to encode “mark complete” as a record field change.

## Regions

A region gives the page a small structure tree. It also participates in visibility and reachability.

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Stable, language-independent |
| `label` | No | Human-readable name shown to the model |
| `description` | No | What the region is for |
| `role` | No | `main`, `dialog`, `toolbar`, `list`, and the other `RegionRole` values |
| `parent` | No | Explicit parent when DOM ancestry is not the right tree |

```ts [Vue 3]
// <section v-scope="{ id: 'todo_list', label: 'Task list', role: 'list' }">
```

```tsx [React]
const listScope = usePlingScope<HTMLUListElement>({
  id: "todo_list",
  label: "Task list",
  role: "list",
});
return <ul ref={listScope}>…</ul>;
```

```ts [Vanilla / jQuery]
const off = pling.scope(listElement, { id: "todo_list", label: "Task list", role: "list" });
```

```ts [Vue 2.7]
// <ul v-scope="{ id: 'todo_list', label: 'Task list', role: 'list' }">
```

A region is not a permission boundary. It reduces and explains what the model can reach at this moment. Authorization still belongs to the action implementation or the server.

## State

A state view is a named, read-only object that explains the current projection: active filter, applied search, counts, pagination, or the selected tab. It has no setter.

```ts [Vue 3]
useAgentState("task_view", () => ({
  filter: filter.value,
  search: appliedSearch.value,
  matched: visibleTasks.value.length,
  total: tasks.value.length,
}), { description: "Current filter, applied search, and task counts" });
```

```tsx [React]
usePlingState("task_view", () => ({
  filter,
  search: appliedSearch,
  matched: visibleTasks.length,
  total: tasks.length,
}), { description: "Current filter, applied search, and task counts" });
```

```ts [Vanilla / jQuery]
const off = pling.state("task_view", () => ({
  filter,
  search: appliedSearch,
  matched: visibleTasks.length,
  total: tasks.length,
}), { description: "Current filter, applied search, and task counts" });
```

```ts [Vue 2.7]
useAgentState("task_view", () => ({
  filter: this.filter,
  search: this.appliedSearch,
  matched: this.visibleTasks.length,
  total: this.tasks.length,
}));
```

The reader runs for every snapshot. A plain object is evaluated once at registration and will freeze the initial values. Expose the view the user is seeing, not the whole store.

## How the four declarations compose

A reliable page usually needs all four in the same region:

- the region identifies the list and controls whether it is reachable;
- records identify the rows and provide the data needed to choose one;
- actions describe the operations available on the list or a row;
- state explains filters and counts that are not visible from the rows alone.

This is the difference between “the model can click a button” and “the model can understand the current screen before choosing an action”.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| The model invents an action id | The action was never registered, or its id changes between renders | Declare it explicitly and use a stable id |
| A row action targets the wrong row | The id came from the array index | Use the business key |
| A count is correct once and then stale | A plain object captured setup-time values | Read through a function |
| A dialog action remains available behind the overlay | The dialog has no region, or the overlay is not detectable | Put the dialog in a `dialog` region and verify hit testing |
| The model tries to write through state | The corresponding action is missing or poorly described | Add the action the user would use; keep state read-only |
| Two rows share an action id | The id lacks the row key | Use `toggle@${task.id}` or a namespaced id |

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/core` `0.1.0-alpha.3` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later for Node-side use |
| Peer dependencies | None |
| Stability | Pre-1.0 alpha; a minor release may change the API |

All four declarations are present in each adapter at this version. The adapter table below is the compatibility boundary; a change to a declaration's meaning would be a breaking change, not a documentation adjustment.

| Adapter | Actions | Records | Regions | State |
| --- | --- | --- | --- | --- |
| Vue 3 | Supported | Supported | Supported | Supported |
| React | Supported | Supported | Supported | Supported |
| Vanilla / jQuery | Supported | Supported | Supported | Supported |
| Vue 2.7 | Supported | Supported | Supported | Supported |

The status differs by adapter. The support tables in the [Vue 3 adapter](/reference/vue-3-adapter), [React adapter](/reference/react-adapter), [Vanilla / jQuery adapter](/reference/vanilla-jquery-adapter), and [Vue 2.7 adapter](/reference/vue-2-adapter) references define the exact boundary for each framework. Vue 2.7 is a real adapter, but only for the subset listed on its page.

## Where to continue

- The [Vue 3 learning path](/vue/) builds the declarations one at a time.
- [Table rows and batch actions](/recipes/table-rows-and-batch-actions) applies records and row actions to a table.
- The adapter references give the precise signature and support boundary for each framework.
