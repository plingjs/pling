---
id: REF-10
title: "Vue 2.7 adapter"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Vue 2.7 adapter (`@plingjs/vue2`)

`@plingjs/vue2` is a real adapter for applications that cannot move to Vue 3 yet. It installs Vue 2.7 directives and exposes a small composition API, while reusing `@plingjs/vanilla` for execution, visibility, records, state, and the assistant dock.

Supported range: Vue 2.7 only. Vue 2.6 and earlier do not provide the Composition API used by `useAgentState`; they are not supported by this adapter. They can still integrate manually through `@plingjs/vanilla`, as described below.

## Installation

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  agent: {
    config: {
      baseUrl: "/llm/v1",
      model: "your-model",
    },
  },
});

Vue.use(pling.plugin);

new Vue({ render: (h) => h(App) }).$mount("#app");
```

The package does not prescribe a build tool. Vue 2.7 SFC projects still need their own Vue 2 compiler setup; the adapter only requires that the app runs on Vue 2.7 and that declarations are installed before components mount.

## Vue 2.6 and earlier

`@plingjs/vue2` cannot be used with Vue 2.6 or earlier. Do not install this package and attempt to register its directives in those versions. Install `@plingjs/vanilla` instead and call `pling.tool()`, `pling.scope()`, `pling.record()`, and `pling.state()` on DOM elements after the component mounts.

| Project version | Package | Declaration model |
| --- | --- | --- |
| Vue 2.7 | `@plingjs/vue2` | Directives, Composition API state helpers, and automatic lifecycle cleanup |
| Vue 2.6 and earlier | `@plingjs/vanilla` | Manual declarations and explicit unbinding |

See the Vue 2.6 section in [Install and first mount](/vue2/install-and-first-mount) for a complete example. The Vanilla path does not provide `v-tool`, `v-scope`, `v-record`, `useAgentState()`, or automatic cleanup. Records and row actions must be registered again after the list renders.

## Public API

| Export | Purpose |
| --- | --- |
| `createPling(options)` | Create the instance and plugin |
| `usePling()` | Read the current instance inside a component |
| `useAgentState(key, source, options?)` | Register a read-only view |
| `useAgentStoreState(key, store, fields \\| selector, options?)` | Select fields from Pinia or Vuex |
| `v-tool` | Declare an element action |
| `v-scope` | Declare a region |
| `v-record` | Declare a row record |
| `pling.dock(options?)` | Mount the shared assistant |
| `pling.action(options)` | Declare a function-level action |
| `pling.setActiveScopes(ids)` | Manual region activation |

`createPling` accepts the same options as `@plingjs/vanilla`, including `ui`, `agent`, `presence`, `derive`, `shared`, `namespace`, and `defaultApproval`.

## Directives

```vue
<template>
  <section v-scope="{ id: 'todos', label: 'Task list', role: 'list' }">
    <li v-for="task in tasks" :key="task.id" v-record="{ data: task, label: task.title }">
      <button
        v-tool="{ id: `toggle@${task.id}`, desc: `Toggle ${task.title}`, kind: 'write' }"
        @click="toggle(task)"
      >
        {{ task.done ? 'Undo' : 'Done' }}
      </button>
      {{ task.title }}
    </li>
  </section>
</template>
```

`v-tool` accepts a string, a `ToolOptions` object, or an array of options. `v-scope` accepts a region id or a full region object. `v-record` accepts row data or a full record object.

The directives register on insertion and unregister on unbind or update. Declarations inside a `v-for` should use the business key in their ids.

## Read-only state

Use the Composition API for automatic cleanup:

```ts
import { defineComponent, ref } from "vue";
import { useAgentState } from "@plingjs/vue2";

export default defineComponent({
  setup() {
    const filter = ref("all");
    const total = ref(24);

    useAgentState("task_view", () => ({
      filter: filter.value,
      total: total.value,
    }), { description: "Current task filter and total" });

    return { filter, total };
  },
});
```

Pinia and Vuex work through the same field allowlist:

```ts
const todos = useTodoStore();
useAgentStoreState("task_view", todos, ["filter", "appliedSearch", "remaining", "completed"]);
```

The field array is checked during registration. A missing field throws instead of producing an empty view. A selector can rename or compute values.

## Assistant surface

```ts
const dock = pling.dock({
  title: "Task assistant",
  quick: ["Add a task", "Complete the first task"],
});
```

The dock is the shared vanilla surface. It supports the same conversation, confirmation, handoff, activity, and telemetry behavior as the other adapters. It does not include the Vue 3 model-settings panel or debug inspector.

## Supported subset

| Capability | Status |
| --- | --- |
| `v-tool` | Supported |
| `v-scope` | Supported |
| `v-record` | Supported |
| `useAgentState` | Supported |
| `useAgentStoreState` | Supported |
| `pling.action()` | Supported |
| `pling.dock()` | Supported |
| `confirm` / `handoff` | Supported through tool options |
| `derive` | Supported through vanilla options |
| `v-feedback` | Missing |
| `v-guide-target` | Missing |
| `v-task` | Missing |
| Compound `steps` | Missing |
| Model settings UI | Missing |
| Debug inspector | Missing |
| `inspectCoverage()` | Missing |
| Router page identity | Missing |

Do not infer Vue 3 parity from the shared directive names. Compare the [Vue 3 adapter](/reference/vue-3-adapter), [React adapter](/reference/react-adapter), and [Vanilla / jQuery adapter](/reference/vanilla-jquery-adapter) support tables when moving code between adapters.

## Migration notes

- `@plingjs/vue2` requires Vue 2.7. Upgrade 2.6 when possible; otherwise use the manual Vanilla path.
- Install the plugin once, before the root component is created.
- State and tools that rely on component lifecycle should be declared in `setup()`, not in a detached helper.
- `v-feedback`, guide targets, task entrances, and compound flows require either a Vue 3 move or a new Vue 2 implementation.
- The adapter shares the vanilla dock, so styling is controlled through the shared `ui` options rather than Vue 3 component slots.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `v-tool` is ignored | Plugin was not installed before mount | `Vue.use(pling.plugin)` first |
| `usePling()` throws | Called outside a component after the root was destroyed | Keep the `createPling()` reference |
| State is never cleaned up | Declared outside `setup()` or an active scope | Declare inside `setup()` |
| Duplicate action ids | A loop reused a constant id | Include the row key |
| Record fields are stale | A copied object was passed | Pass the live row object |
| Dock has no model | No configuration and no environment variables | Configure `agent.config` |

## Evidence

- Adapter implementation: `packages/vue2`.
- Runnable example: `examples/recipes/vue2`.
- Shared execution layer: `packages/vanilla`.
- Package smoke: `pnpm pack:check` builds a separate Vue 2.7 consumer.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/vue2` `0.1.0-alpha.2` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Vue 2.7 in browsers with ES2022 modules; Node.js 20 or later for builds |
| Peer dependencies | `vue ^2.7.0` |
| Stability | Pre-1.0 alpha; a minor release may change the API |

This adapter requires Vue 2.7 and does not support Vue 3. Vue 2.6 and earlier can use `@plingjs/vanilla` manually; that is a separate integration path, not a capability of this adapter. The supported subset is the compatibility boundary; an API absent from this page is not available through this adapter at this version.
