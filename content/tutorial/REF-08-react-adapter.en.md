---
id: REF-08
title: "React adapter"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# React adapter (`@plingjs/react`)

`@plingjs/react` connects React refs, effects, and context to the same page runtime used by the Vue adapters. It does not ship a second executor or a second agent loop.

Peer range: React 18 and later. The adapter is client-side; Next.js and other SSR hosts must create the instance after the DOM exists.

## Installation and provider

```tsx
import { createRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";
import App from "./App";

const pling = createPling({
  agent: {
    config: {
      baseUrl: import.meta.env.VITE_AGENT_BASE_URL,
      model: import.meta.env.VITE_AGENT_MODEL,
      apiKey: import.meta.env.VITE_AGENT_API_KEY,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <PlingProvider pling={pling}>
    <App />
  </PlingProvider>,
);
```

`createPling(options)` accepts `ui`, `registry`, `shared`, `namespace`, `onWarn`, `agent`, `revealSensitive`, `scopes`, `presence`, and `derive`. It returns `PlingElement` with `registry`, `scopes`, `ui`, `presence`, `derived()`, `setActiveScopes()`, and `destroy()`.

## Hooks

| Hook | Returns | Purpose |
| --- | --- | --- |
| `usePling()` | `PlingElement` | Access the provider instance |
| `usePlingTool<T>(options)` | `RefCallback<T>` | Declare an element action |
| `useAgentTool(options)` | `void` | Declare a function-level action |
| `usePlingRecord<T>(value)` | `RefCallback<T>` | Declare a row record |
| `usePlingScope<T>(options)` | `RefCallback<T>` | Declare a region |
| `usePlingState(key, source, options?)` | `() => void` | Register a component-scoped read-only view |
| `exposePlingState(pling, key, source, options?)` | `() => void` | Register a view outside the component tree |

`usePlingTool` accepts the same fields as Vue's `v-tool`: `id`, `desc`, `kind`, `params`, `run`, `available`, `expect`, `confirm`, `handoff`, `action`, `target`, `autoTarget`, and `fidelity`. The options are read from a ref, so handlers do not go stale after a re-render.

## A complete row

```tsx
function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const row = usePlingRecord({ data: task, label: task.title });
  const toggle = usePlingTool<HTMLButtonElement>({
    id: `toggle@${task.id}`,
    desc: `${task.done ? "Reopen" : "Complete"} ${task.title}`,
  });

  return (
    <li ref={row}>
      <button ref={toggle} onClick={() => onToggle(task.id)}>
        {task.done ? "Undo" : "Done"}
      </button>
      {task.title}
    </li>
  );
}
```

The ref callback registers on mount and unregisters on unmount. The record reads the latest `task` prop, so a field update does not require a second declaration.

## Region and state

```tsx
function TaskList({ tasks }: { tasks: Task[] }) {
  const scope = usePlingScope<HTMLUListElement>({
    id: "task_list",
    label: "Task list",
    role: "list",
  });

  usePlingState("task_view", () => ({
    total: tasks.length,
    open: tasks.filter((task) => !task.done).length,
  }), { description: "Task totals for the current list" });

  return <ul ref={scope}>{tasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => {}} />)}</ul>;
}
```

`usePlingState` has no setter. To change the list, declare the button or function that performs the change.

## Assistant surfaces

```tsx
<AgentDock
  title="Task assistant"
  quick={["Add a task", "Complete the first task"]}
  config={{ limits: { maxTurns: 100 } }}
/>
```

`<AgentDock>` owns the runtime, confirmation panel, handoff panel, and activity view. `<AgentChat>` is presentation-only and is useful when the host already owns the runtime and event stream.

Pass `debug` to `<AgentDock>` to enable the read-only run inspector in the activity view:

```tsx
<AgentDock debug={{ maxCalls: 8 }} />
```

The inspector shows the page projection at open time and the messages, tools, responses, and page snapshot for each retained model call. It uses the runtime that already drives the conversation; it does not execute actions or create a second session. `debug` is off by default. A number object bounds retained calls; `true` uses the default limit. Treat the inspector as a development surface: it can reveal outbound messages and page data, so do not enable it unconditionally in a public build.

Model settings remain Vue 3-only. React applications should keep credentials behind their model gateway.

## Boundaries

React supports actions, function tools, records, regions, state, confirmation, handoff, presence, derivation, namespaces, shared page runtimes, and the read-only run inspector.

It does not currently support:

- store field allowlists (`useAgentStoreState`);
- compound `steps`;
- page feedback, guide targets, or task entrances;
- model settings UI;
- coverage scanning;
- Router page identity.

Do not import Vue components to fill these gaps. Add a React implementation or move the capability into the shared layers.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Hook throws because there is no provider | The component was rendered outside `<PlingProvider>` | Wrap the root |
| Action disappears after a re-render | The ref moved to a different element, or the element unmounted | Keep the ref on the stable interactive node |
| Row action targets the wrong row | id is not tied to the row | Use `toggle@${task.id}` |
| State never updates | A value was captured instead of read | Pass a function that reads current props/state |
| Dock has no model | `createPling({ agent })` and `<AgentDock>` both lack configuration | Supply `config` on one of them, or use environment variables |
| `useAgentTool` remains registered after unmount | The hook was called outside a component | Move it into the component or unregister explicitly |

## Evidence

- Adapter implementation: `packages/react/src`.
- Shared executor: `packages/core/src/executor.ts`.
- Runnable example: `examples/recipes/react`.
- Compare the [Vue 3 adapter](/reference/vue-3-adapter), [Vanilla / jQuery adapter](/reference/vanilla-jquery-adapter), and [Vue 2.7 adapter](/reference/vue-2-adapter) support tables before sharing code between adapters.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/react` `0.1.0-alpha.2` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | React 18 or later in browsers with ES2022 modules; Node.js 20 or later for SSR and builds |
| Peer dependencies | `react >=18` |
| Stability | Pre-1.0 alpha; a minor release may change the API |

The adapter does not depend on Vue or on a particular router. The provider, hooks, component names, and props on this page are the public surface at this version.
