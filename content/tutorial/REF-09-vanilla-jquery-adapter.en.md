---
id: REF-09
title: "Vanilla / jQuery adapter"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Vanilla and jQuery adapter (`@plingjs/vanilla`)

`@plingjs/vanilla` is the DOM-level adapter. It has no framework dependency. The Vue 2.7 adapter also builds on it, which makes it the smallest executable reference for how declarations, visibility, and execution fit together.

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

`createPling(options)` accepts `ui`, `registry`, `shared`, `namespace`, `onWarn`, `diagnostics`, `agent`, `revealSensitive`, `defaultApproval`, `scopes`, `presence`, `derive`, and `page`. It returns a `VanillaPling`.

| Method | Returns | Purpose |
| --- | --- | --- |
| `tool(element, options)` | unbind | Declare an element action |
| `action(options)` | unbind | Declare a function-level action |
| `record(element, value)` | unbind | Declare a row record |
| `scope(element, options)` | unbind | Declare a region |
| `state(key, source, options?)` | unbind | Register a read-only view |
| `declareFeedback(element, value)` | unbind | Declare page feedback |
| `declareTask(element, value)` | unbind | Declare a human-facing task entrance without registering an action |
| `guideTarget(element, id)` | unbind | Mark a target for a human handoff |
| `setActiveScopes(ids)` | - | Manual activation when the observer cannot infer the layout |
| `dock(options?)` | `VanillaDock` | Mount the shared assistant |
| `surfaceGateway(options)` | `VanillaSurfaceGateway` | Expose allowed capabilities to external Agents |
| `inspectCoverage(root?)` | `CoverageReport` | Scan interactive controls that have not been declared |
| `derived()` | controller or `null` | Access the automatic-derivation controller |
| `destroy()` | - | Stop observers and unregister every declaration |

Every declaration returns an unbind function. Keep it and call it when your own code removes the node. The runtime tracks the element for scope visibility; removing the node without unbinding leaves a stale registration until `destroy()` is called.

The vanilla page does not have a framework `updated` or `beforeUnmount` hook. Declaring the same element or state key again therefore removes the previous declaration before registering the new one. Calling the old unbind function afterwards is safe and will not remove the replacement. A list rerender or a jQuery plugin that replaces a node can use this behavior without maintaining two registries.

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

`tool({ steps })` declares a compound action. Each step references an action id that is already registered, and execution still goes through the same confirmation gate. Use `handoff` for a step that the user must complete in person:

```ts
pling.tool(document.querySelector("#submit-order")!, {
  id: "submit_order",
  desc: "Save and submit the order",
  steps: [{ action: "save_order" }, { action: "confirm_order" }],
});

pling.tool(document.querySelector("#verify-phone")!, {
  id: "verify_phone",
  desc: "Wait for the user to verify their phone",
  handoff: {
    reason: "Only the user can see and enter the SMS code",
    steps: ["Open the SMS message", "Enter the 6-digit code"],
    expect: { desc: "The code has been verified", check: () => Boolean(document.querySelector("[data-verified]")) },
  },
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

## Page feedback, tasks, and guide targets

Expose form errors as page feedback instead of adding an action whose only job is to read the error:

```ts
pling.declareFeedback(document.querySelector("#customer-field")!, {
  message: "Customer name is required",
  field: "customer",
  severity: "error",
});

pling.declareTask(document.querySelector("#ask-assistant")!, {
  prompt: "Check whether the current order is missing any required fields",
});
```

`declareTask()` only sends a prompt to the mounted assistant, so it never appears in the action list. `guideTarget()` only marks the place a user should look during a handoff; it also does not create an action.

## Assistant, model settings, and debugging

```ts
const dock = pling.dock({
  layout: "dock",
  quick: ["Summarize the current order"],
  debug: { maxCalls: 8 },
  modelSettings: { mode: "readonly" },
});
```

`layout` can be `dock`, `sidebar`, or `inline`; `side` and `launcherPlacement` control the sidebar position. `debug` opens the read-only inspector in Activity and shows the page projection, actual request messages, tools, responses, and the latest call trace. `modelSettings: "readonly"` shows the application-managed endpoint; `{ mode: "byok", persist: "session" }` lets a trusted page use its own model key. `persist` supports only `memory` and `session`, not `localStorage`.

When `continuity.scope` is `browser` or `remote`, the dock also shows a Tasks tab. A person can follow another tab or device read-only, take the task over, or fork it into an independent task. A page whose continuity is local to one tab keeps the tab hidden.

## Page identity and coverage

The page path, title, and allowlisted query parameters enter the snapshot automatically. When you need Router-like `name` and `params`, pass an object with `currentRoute` and an optional `afterEach` to `page.router`.

```ts
const report = pling.inspectCoverage(document.querySelector("main"));
console.log(report.coveragePercent, report.targets.filter((target) => target.status === "missing"));
```

The coverage scan only reports interactive controls that have not been declared. It does not register actions automatically.

## External Agents

`pling.surfaceGateway()` reuses `@plingjs/surface-browser` and exposes only capabilities in the explicit allowlist. `createSurfaceAccessPanel()` is the native DOM counterpart of Vue's `<SurfaceAccessPanel>`:

```ts
import { createSurfaceAccessPanel } from "@plingjs/vanilla";

const gateway = pling.surfaceGateway({
  app: "orders",
  mode: "bff",
  expose: ["list_orders", "update_note@order:"],
  getPageSession: () => fetch("/api/surface/session").then((response) => response.json()),
});

const panel = createSurfaceAccessPanel(gateway, { mount: document.querySelector("#access")! });
```

## jQuery usage

```js
const $ = window.jQuery;

const pling = createPling({ agent: { config: { baseUrl: "/llm/v1", model: "your-model" } } });

pling.tool($("#add")[0], { id: "add_task", desc: "Add a task", kind: "write" });
pling.scope($("#task-list")[0], { id: "task_list", label: "Task list", role: "list" });
$("#add").on("click", addTask);
```

Attach Pling after the element exists. If a plugin replaces the DOM node afterwards, unbind the old declaration before declaring the new node. Do not keep a declaration pointing at a detached clone.

## Defaults and boundaries

- `presence` is on by default; `presence: false` disables the highlight.
- `derive` is off by default.
- `kind` defaults to `write`; confirmation follows the active approval policy.
- `ui` defaults to English and the light theme.
- There is no framework component tree or store: `AgentDock` / `AgentInline` components and `useAgentStoreState` do not apply. Use `pling.dock()`, `pling.page`, and explicit field selection instead.
- The adapter does not have Vue / React's automatic mount and unmount lifecycle. Declaring again replaces the previous declaration, but you should still call the unbind function when the node is destroyed.
- SSR is outside the DOM adapter's scope. The Surface protocol remains available from `@plingjs/surface`; this adapter only wires the page session and browser transport.

## Common failures

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
| Applies to | `@plingjs/vanilla` `0.1.0-alpha.9` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later for builds |
| Peer dependencies | None; jQuery is optional |
| Stability | Pre-1.0 alpha; a minor release may change the API |
