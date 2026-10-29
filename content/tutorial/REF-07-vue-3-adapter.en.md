---
id: REF-07
title: "Vue 3 adapter"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Vue 3 adapter (`@plingjs/vue`)

`@plingjs/vue` is the reference adapter. It contains the most complete UI surface and the only implementation of the Vue-specific declaration set. It still delegates every execution decision to `@plingjs/core`, `@plingjs/dom`, and `@plingjs/agent`.

## Installation

```ts
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";

const pling = createPling({
  agent: {
    config: {
      baseUrl: import.meta.env.VITE_AGENT_BASE_URL,
      model: import.meta.env.VITE_AGENT_MODEL,
      apiKey: import.meta.env.VITE_AGENT_API_KEY,
    },
  },
});

createApp(App).use(pling.plugin).mount("#app");
```

Peer range: Vue 3. The adapter does not depend on Vue Router or Pinia. Router support is opt-in through `page: { router }`.

## `createPling(options)`

| Option | Default | Purpose |
| --- | --- | --- |
| `ui` | English, light theme | Locale, theme, message overrides, class names |
| `registry` | New registry | Reuse a registry in tests or advanced setups |
| `shared` | — | Join a `createPlingPage()` runtime; cannot be combined with `registry` / `scopes` |
| `namespace` | — | Prefix action ids for mixed-framework islands |
| `onWarn` | `console.warn` | Development warnings |
| `agent` | — | Model config, hooks, gate, trace, locale of responses |
| `diagnostics` | Vite dev only | Warn about interactive controls with no declaration; never registers actions |
| `page` | Automatic | Page identity; pass `false` to disable, or `{ router }` for Vue Router |
| `presence` | On | Action highlight; `false` disables it |
| `revealSensitive` | `true` | Render masked values in the operator's own chat view |
| `derive` | Off | Automatic derivation from native controls |
| `scopes` | Automatic | Test hooks for visibility and hit testing |

`createPling()` returns `PlingElement`: `plugin`, `registry`, `ui`, `scopes`, `page`, `feedback`, `ask()`, `inspectCoverage()`, `derived()`, and `setActiveScopes()`.

## Directives

| Directive | Value | Purpose |
| --- | --- | --- |
| `v-tool` | `string` or `ToolOptions` or `ToolOptions[]` | Declare an element action |
| `v-scope` | `string` or `Scope Options` | Declare a region |
| `v-record` | `data` or a full record object | Declare a row |
| `v-task` | `string` or `{ prompt, surface?, disabled? }` | Human task entrance; never an agent action |
| `v-feedback` | String, array, or feedback object | Page feedback visible to the model |
| `v-guide-target` | `{ id, label?, description? }` | Highlight a non-action target during handoff |

```vue
<template>
  <section v-scope="{ id: 'todos', label: 'Task list', role: 'list' }">
    <li v-for="task in tasks" :key="task.id" v-record="{ data: task }">
      <button v-tool="{ id: `toggle@${task.id}`, desc: `Toggle ${task.title}` }" @click="toggle(task)">
        {{ task.done ? 'Undo' : 'Done' }}
      </button>
      {{ task.title }}
    </li>
  </section>
</template>
```

## Composables

| API | Scope | Notes |
| --- | --- | --- |
| `usePling()` | Component | Returns the installed `PlingElement` |
| `useAgentState(key, source, options?)` | Component / effect scope | Read-only view; auto-unregisters |
| `useAgentStoreState(key, store, fields \\| selector, options?)` | Component / effect scope | Pinia / Vuex field allowlist |
| `useAgentTool(options)` | Component / effect scope | Function-level action with no DOM element |

`useAgentStoreState` reads Pinia state and getters directly. For Vuex it reads `store.state` first, then `store.getters`; a missing field throws during registration.

## Components

| Component | Use |
| --- | --- |
| `<AgentDock>` | Floating or sidebar assistant; owns placement, task registration, and open state |
| `<AgentInline>` | Embed the conversation in a business column |
| `<AgentChat>` | Render the conversation without owning placement |
| `<AgentPanel>` | Development-only snapshot view; not a production assistant |

`<AgentDock>` supports `layout="dock" | "sidebar"`, `side`, `launcherPlacement`, `launcherLabel`, `quick`, `config`, `debug`, and `modelSettings`.

```vue
<AgentDock
  layout="sidebar"
  side="right"
  launcher-placement="bottom"
  :debug="{ maxCalls: 8 }"
  :model-settings="{ mode: 'byok', persist: 'session' }"
/>
```

`modelSettings` modes:

- `off` (default): no settings UI;
- `readonly`: show the application-managed connection without the key;
- `byok`: let the user enter `baseUrl`, `model`, and `apiKey`; persistence is `memory` by default, `session` optional. `localStorage` is not supported.

## External Agent Surface

`useSurfaceGateway()` owns the repeated page-side plumbing for an external
Agent: page session, WebSocket, `describe` / `invoke` bridge, pairing, token
claim, reconnection, and teardown. It does not declare business actions. The
existing `v-tool` / `useAgentTool` declarations remain the capability source,
and `expose` remains an explicit allowlist.

```ts
import { computed } from "vue";
import { useSurfaceGateway } from "@plingjs/vue";

const gateway = useSurfaceGateway({
  app: "orders",
  expose: ["orders.overview", "orders.update_note"],
  mode: "bff",
  getPageSession: async () => {
    const response = await fetch("/api/surface/page-session", { method: "POST" });
    if (!response.ok) throw new Error("Surface session unavailable");
    return response.json();
  },
  approval,
});

const surface = computed(() => gateway.surface.value);
```

Choose the mode by who creates the page session:

| Mode | Page session source | Token display | Use |
| --- | --- | --- | --- |
| `public-demo` | Gateway demo endpoint from the browser | May show a short-lived Agent token | Hosted examples only |
| `bff` | `getPageSession()` backed by your authenticated server | Application decides; never expose an admin token | Production |

The controller exposes `state`, `surface`, `page`, `pairing`, `access`,
`agent`, `busy`, `error`, `connect()`, `disconnect()`, `pair()`, `claim()`, and
`revoke()`. `<SurfaceAccessPanel :gateway="gateway" />` renders an optional
connection, pairing, token, scope, and revoke panel without creating a second
runtime.

Two rules do not move into the wrapper:

- `expose` is never inferred. A capability absent from the allowlist is absent
  from the external Surface even if the page can execute it.
- Destructive actions still stop in the page confirmation UI. The gateway
  receives `pending_approval` metadata; it never receives an approval tool.

## Defaults that affect behavior

- No declaration means no action. `derive` is off.
- `kind` defaults to `write`; `confirm` is derived from the active approval policy.
- Action ids are generated for element bindings but should be explicit for rows.
- State values are read on every snapshot; plain objects freeze at registration.
- `inspectCoverage()` is diagnostic only. It does not make undeclared controls reachable.
- `debug` stores recent model calls in memory; it is not a privacy boundary.

## Failure modes

| Symptom | Likely cause | Check |
| --- | --- | --- |
| Action is absent from the snapshot | Disabled, covered, inactive region, or `available()` false | Open the debug inspector and read the reason |
| State remains at initial values | Plain object passed instead of a reader | Convert to `() => ({ ... })` |
| Same id appears twice | Manual id collides across rows | Include the row key or use `namespace` |
| Router changes but the model still thinks it is on the old page | `page` disabled or router not supplied | Pass `page: { router }` and whitelist query keys |
| Model settings do not appear | Mode is `off` or not passed to the mounted surface | Set `modelSettings` on `<AgentDock>` or `createPling({ agent })` |
| Debug panel shows no calls | `debug` is off, or the call was cleared | Enable `debug` and reproduce one request |
| Surface connects but exposes no capabilities | `expose` does not match registered action ids | Inspect action ids in `<AgentPanel>` and keep `expose` explicit |
| No Agent token appears | `public-demo` is off, or `autoClaim` is false | Call `gateway.claim()` or enable `autoClaim` in `public-demo` only |
| A destructive call appears to run immediately | The host did not pass an approval source or confirm function | Pass `approval` or `confirm`; never auto-approve external writes |

## Evidence

- Complete learning path: [Vue 3 chapters](/vue/).
- Adapter implementation: `packages/vue/src`.
- Debug inspector: `packages/vue/src/components/AgentDebug.vue`.
- Model settings: `packages/vue/src/components/AgentModelSettings.vue`.
- Runnable example: `examples/recipes/vue3`.
- Compare the [React adapter](/reference/react-adapter), [Vanilla / jQuery adapter](/reference/vanilla-jquery-adapter), and [Vue 2.7 adapter](/reference/vue-2-adapter) support tables before sharing code between adapters.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/vue` `0.1.0-alpha.3` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Vue 3 in browsers with ES2022 modules; Node.js 20 or later for SSR and builds |
| Peer dependencies | `vue ^3` |
| Stability | Pre-1.0 alpha; a minor release may change the API |

This adapter does not support Vue 2; use the separate Vue 2.7 adapter. The directives, composables, component names, and props on this page are the public surface at this version.
