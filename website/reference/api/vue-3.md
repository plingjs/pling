---
title: "Vue 3 API"
status: navigation
release: 0.1
locale: en
---
<!-- generated:api-index -->

# Vue 3 API

The complete Vue 3 surface: application setup, directives, composables, components, and the shared option types they use. Every signature below is the Vue 3 form.

This page lists only `@plingjs/vue` entry points, plus the shared-package types used with them.

[API overview](/reference/api/) · [Shared package API](/reference/api/shared)

| Package | Peer dependencies | Version |
| --- | --- | --- |
| `@plingjs/vue` | vue ^3 | `0.1.0-alpha.3` |

The current package version is `0.1.0-alpha.3`; stability is **preview**. This is a pre-1.0 alpha, so a minor release may still change the API.

## Minimal example

```ts
import { createPling, AgentDock } from "@plingjs/vue";

const pling = createPling({ namespace: "todo" });
app.use(pling.plugin);
```

## Entry and lifecycle

Create the application runtime, install the adapter, and release its observers.

| API | Kind | Reference |
| --- | --- | --- |
| [createPling](#api-createpling) | Function | [Reference](/reference/vue-3-adapter) |
| [usePling](#api-usepling) | Function | [Reference](/reference/vue-3-adapter) |
| [pling.plugin](#api-plugin) | Plugin | [Reference](/reference/vue-3-adapter) |
| [PlingElement](#api-plingelement) | Interface | [Reference](/reference/vue-3-adapter) |
| [pling.destroy](#api-destroy) | Method | [Reference](/reference/vue-3-adapter) |

<a id="api-createpling"></a>

### `createPling`

Creates the application-level Pling instance and returns the adapter-specific runtime object.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
createPling(options?: PlingOptions): PlingElement;
createPling(registry: Registry | undefined, options?: PlingOptions): PlingElement;
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `ui.locale` | `"en-US" \| "zh-CN" \| "auto" \| string` | No | `en-US` | Language used by the built-in assistant UI. "auto" follows the browser language. |
| `ui.theme` | `"light" \| "dark" \| "auto" \| PlingThemeOverrides` | No | `light` | Theme for the built-in surfaces. An object can override tokens or choose a mode. |
| `ui.theme.mode` | `"light" \| "dark" \| "auto"` | No | `light` | Explicit mode when the theme is an object. "auto" follows the operating-system preference. |
| `ui.theme.tokens` | `Partial<PlingThemeTokens>` | No | — | Overrides individual design tokens such as colours, radii, shadows, and font families. Keys not supplied keep the selected light or dark defaults. |
| `ui.messages` | `PlingCatalogOverrides` | No | — | Adds or replaces message catalog entries for one or more locales. |
| `ui.messages.<locale>` | `Partial<Record<PlingMessageKey, string>>` | No | — | Message overrides for one BCP 47 locale. Missing keys fall back to the built-in catalog. |
| `ui.classNames` | `PlingClassNames` | No | — | Extra class names applied to the built-in chat, dock, launcher, and panel. |
| `ui.classNames.dock` | `string` | No | — | Extra class for the dock shell. |
| `ui.classNames.panel` | `string` | No | — | Extra class for the panel shell. |
| `ui.classNames.launcher` | `string` | No | — | Extra class for the launcher button. |
| `ui.classNames.chat` | `string` | No | — | Extra class for the chat surface. |
| `onWarn` | `(message: string) => void` | No | `console.warn` | Receives development warnings and declaration diagnostics. Defaults to console.warn. |
| `registry` | `Registry` | No | — | Uses an existing action registry instead of creating one. Do not combine it with shared. |
| `shared` | `PlingPage` | No | — | Joins a page runtime shared by several framework islands. registry and scopes are then owned by that page runtime. |
| `namespace` | `string` | No | — | Prefixes action and record ids for this adapter instance, for example add becomes todo/add. |
| `scopes` | `ScopeControllerOptions` | No | — | Overrides visibility and hit-testing behavior. Intended for tests and unusual rendering hosts. |
| `agent` | `AgentSetup` | No | — | Wires the model, hooks, confirmation, continuity, and observability used by built-in assistant surfaces. |
| `derive` | `boolean \| DeriveOptions` | No | `false` | Enables optional L1 derivation from native clickable elements. Disabled by default; derived actions are marked as guesses. |
| `presence` | `boolean \| PresenceOptions` | No | `true` | Controls target highlighting while the agent operates the page. |
| `revealSensitive` | `boolean` | No | `true` | Restores sensitive-value tokens to their real values in the rendered chat only. Model requests and storage keep the tokens. |
| `diagnostics` | `boolean` | No | `import.meta.env.DEV` | Scans the mounted root once for actionable controls without declarations and reports coverage through onWarn. Enabled by default only in Vite dev mode. |
| `page` | `false \| PageOptions` | No | `location + document.title` | Controls page identity collection. Defaults to location plus document.title; pass false to disable it. |

**Returns**

The adapter instance. Vue 3 and React return PlingElement; Vue 2.7 and Vanilla return VanillaPling.

**Defaults**

- No declaration means no action; derive is off by default.
- Presence is on by default.
- revealSensitive is true by default.

**Example 1 · Vue 3 application setup**

```ts
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";

const pling = createPling({
  namespace: "todo",
  agent: {
    config: { limits: { maxTurns: 12 } },
    trace: true,
  },
});

createApp(App).use(pling.plugin).mount("#app");
```

**Example 2 · Route model calls through a same-origin gateway**

```ts
const pling = createPling({
  agent: {
    config: {
      baseUrl: "/llm/v1",
      model: "gpt-4.1-mini",
    },
    trace: true,
  },
});
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-usepling"></a>

### `usePling`

Reads the nearest Pling instance from the framework tree.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
usePling(): PlingElement
```

**Parameters**

None.

**Example 1 · Read the injected runtime**

```ts
const pling = usePling();

onMounted(() => pling.inspectCoverage());
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-plugin"></a>

### `pling.plugin`

Installs Vue directives and the runtime injection key. React uses PlingProvider instead.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
createApp(App).use(pling.plugin)
```

**Parameters**

None.

**Example 1 · Install Vue 3 directives**

```ts
createApp(App).use(pling.plugin).mount("#app");
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-plingelement"></a>

### `PlingElement`

The Vue 3 and React application runtime: registry, UI controller, page tracker, task routing, coverage, and cleanup.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
interface PlingElement {
  registry: Registry;
  ui: PlingUiController;
  feedback: FeedbackCollector;
  page: PageTracker;
  plugin: { install(app: App): void };
  ask(prompt: string, options?: PlingAskOptions): Promise<void>;
  task: PlingTaskController;
  derived(): DeriveController | null;
  inspectCoverage(): CoverageReport;
  scopes: ScopeController;
  setActiveScopes(scopes: Iterable<string>): void;
  destroy(): void;
  agent?: AgentSetup;
  revealSensitive: boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `registry` | `Registry` | No | — | Shared action, record, state, and feedback registry. |
| `ui` | `PlingUiController` | No | — | Locale, theme, catalog, and CSS-variable controller. |
| `feedback` | `FeedbackCollector` | No | — | Page-level feedback collector shared by the application. |
| `page` | `PageTracker` | No | — | Tracks route, path, title, and selected query parameters. |
| `plugin` | `{ install(app: App): void }` | No | — | Vue plugin that registers directives and the injection key. |
| `ask` | `(prompt: string, options?: PlingAskOptions) => Promise<void>` | No | — | Routes a human-authored task to a mounted assistant surface. |
| `task` | `PlingTaskController` | No | — | Task routing controller used by built-in surfaces. |
| `derived` | `() => DeriveController \| null` | No | — | Returns the optional L1 deriver. It is null unless derive was enabled. |
| `inspectCoverage` | `() => CoverageReport` | No | — | Scans the mounted root for actionable controls without declarations. |
| `scopes` | `ScopeController` | No | — | Region visibility, viewport, and occlusion controller. |
| `setActiveScopes` | `(scopes: Iterable<string>) => void` | No | — | Manually replaces the active region set when automatic detection is not suitable. |
| `destroy` | `() => void` | No | — | Stops observers and releases declarations owned by this runtime. |
| `agent` | `AgentSetup` | No | — | Application-level assistant wiring, when supplied to createPling. |
| `revealSensitive` | `boolean` | No | — | Whether the rendered chat restores sensitive tokens. |

**Example 1 · Inspect what the page exposes**

```ts
const pling = createPling();

console.table(pling.inspectCoverage().targets);
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-destroy"></a>

### `pling.destroy`

Stops observers, derived actions, scopes, presence, UI subscriptions, and mounted assistant surfaces.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
pling.destroy(): void
```

**Parameters**

None.

**Example 1 · Release the runtime**

```ts
onBeforeUnmount(() => pling.destroy());
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


## Page declarations

Declare actions, records, regions, state, feedback, task entrances, and sensitive values.

| API | Kind | Reference |
| --- | --- | --- |
| [Element action](#api-element-action) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Function-level action](#api-function-action) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Region](#api-region) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Record](#api-record) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Read-only state](#api-state) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Store state](#api-store-state) | Declaration | [Reference](/reference/vue-3-adapter) |
| [Page feedback](#api-feedback) | Declaration | [Reference](/reference/vue-3-adapter) |
| [Task entrance](#api-task-entry) | Declaration | [Reference](/reference/vue-3-adapter) |
| [Guide target](#api-guide-target) | Declaration | [Reference](/reference/vue-3-adapter) |
| [sensitive](#api-sensitive) | Function | [Reference](/reference/core-declarations-actions-records-regions-state) |

<a id="api-element-action"></a>

### `Element action`

Declares what a control does. The description is the model's only explanation; execution still goes through availability, approval, and expectations.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
v-tool="string | ToolOptions | ToolOptions[]"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `v-tool` | `string \| ToolOptions \| ToolOptions[]` | Yes | — | A string is a description shorthand. Use an object or array when you need a stable id, risk level, parameters, flow steps, expectations, or a custom run function. |

**Example 1 · String shorthand**

```ts
<button v-tool="'添加一条待办'">添加</button>
```

**Example 2 · Stable id and injected run**

```vue
<button v-tool="{
  id: 'add',
  desc: '添加一条待办',
  kind: 'write',
  available: () => draft.trim() ? true : '先输入待办内容',
  run: () => add(),
}">添加</button>
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-function-action"></a>

### `Function-level action`

Registers a business operation that has no dedicated DOM control.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
useAgentTool(options: AgentToolOptions): void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options` | `AgentToolOptions` | Yes | — | Id, description, risk, availability, parameters, expectation, and implementation. |

**Example 1 · Register an application action**

```ts
useAgentTool({
  id: "clear_completed",
  desc: "清除所有已完成待办",
  kind: "write",
  available: () => remaining.value < all.value || "没有已完成待办",
  run: () => clearCompleted(),
});
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-region"></a>

### `Region`

Declares a structural region and its reachability. Regions explain context; they are not permission boundaries.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
v-scope="string | { id; label?; description?; role?; parent? }"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `v-scope` | `string \| ScopeValue` | Yes | — | A string is a stable region id. The object form adds a label, description, structural role, or explicit parent. |

**Example 1 · Describe a list region**

```ts
<section v-scope="{ id: 'todos', label: '待办列表', role: 'list' }">...</section>
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-record"></a>

### `Record`

Gives one row a stable identity and a bounded set of readable fields. Records are read-only.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
v-record="RecordValue | null | undefined"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `v-record` | `RecordValue \| null \| undefined` | Yes | — | The row object, or a { data, id, label, fields } envelope that limits what the model can read. |

**Example 1 · Expose only selected fields**

```ts
<li v-for="todo in todos" :key="todo.id" v-record="{
  data: todo,
  label: `待办：${todo.text}`,
  fields: { text: todo.text, done: todo.done },
}">...</li>
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-state"></a>

### `Read-only state`

Exposes a derived view of current UI state. State has no setter; writes must be declared as actions.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
useAgentState(key: string, source: StateSource, options?: AgentStateOptions | string): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `key` | `string` | Yes | — | Stable state-view name used in page context and diagnostics. |
| `source` | `unknown \| (() => unknown) \| Ref<unknown> \| Record<string, unknown>` | Yes | — | A value, ref, or read function. Prefer a function so the snapshot reflects current state. |
| `options` | `StateOptions \| string` | No | — | A description object or a description string. Name the view and explain what it means. |

**Example 1 · Expose filters and counts**

```ts
useAgentState("todo", () => ({
  filter: filter.value,
  total: todos.value.length,
  remaining: todos.value.filter((todo) => !todo.done).length,
}), { description: "当前筛选与未完成数量" });
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-store-state"></a>

### `Store state`

Selects named fields from a Pinia or Vuex store. It never exposes the whole store.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
useAgentStoreState<S extends object>(key: string, store: S, read: AgentStoreRead<S>, options?: AgentStateOptions | string): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `key` | `string` | Yes | — | Stable state-view name. |
| `store` | `S extends object` | Yes | — | Pinia or Vuex store-like object. |
| `read` | `readonly string[] \| ((store: S) => unknown)` | Yes | — | An allowlist of fields or a selector that returns a bounded view. |
| `options` | `AgentStateOptions \| string` | No | — | Description shown with the state in model context. |

**Example 1 · Expose a store allowlist**

```ts
const cart = useCartStore();
useAgentStoreState("cart", cart, ["count", "total"], "购物车件数与小计");
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-feedback"></a>

### `Page feedback`

Publishes user-visible feedback or a short page-level explanation without turning it into an action.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
v-feedback="FeedbackValue | FeedbackValue[]"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `v-feedback` | `FeedbackValue \| FeedbackValue[]` | Yes | — | A string, or an object with message, field, severity, scope, and id. Use functions for fields that change. |

**Example 1 · Expose a form error**

```ts
<p v-feedback="error ? { message: error, field: 'email', severity: 'error' } : null" />
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-task-entry"></a>

### `Task entrance`

Routes a human-authored instruction to the mounted assistant. It is not exposed to the model as an action.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
v-task="string | TaskOptions"
pling.ask(prompt: string, options?: PlingAskOptions): Promise<void>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `v-task` | `string \| TaskOptions` | Yes | — | A prompt string, or an object with prompt, surface, and disabled. |

**Example 1 · Route a human task**

```ts
<button v-task="'整理今天的待办并标出最紧急的一项'">让助手整理</button>
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-guide-target"></a>

### `Guide target`

Highlights a non-action target while a person completes a handoff step.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
v-guide-target="string"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Guide target id referenced by a HandoffStep.highlight value. |

**Example 1 · Highlight a handoff target**

```ts
<input v-guide-target="'captcha'" />
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-sensitive"></a>

### `sensitive`

Marks a value for outbound masking, tokenization, or a hint while keeping the field name visible.

**Imports**

`@plingjs/core` · `@plingjs/vue`

**Signature**

```ts
// Vue 3
sensitive<T>(value: T, options?: SensitivityMode | SensitiveOptions): SensitiveValue<T>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `value` | `T` | Yes | — | Value that enters page context and the model transcript. |
| `options` | `"masked" \| "hidden" \| SensitiveOptions` | No | `"masked"` | Controls whether the model sees a placeholder or no value. The real value remains in the browser. |

**Example 1 · Mask a phone number**

```ts
const phone = sensitive(customer.phone, "masked");
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


## Shared option types

The option shapes referenced by declarations. Adapter aliases are listed where the name differs.

| API | Kind | Reference |
| --- | --- | --- |
| [ToolOptions](#api-tooloptions) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [ScopeOptions](#api-scopeoptions) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [RecordValue](#api-recordvalue) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [State options](#api-stateoptions) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [AgentSetup](#api-agentsetup) | Type | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [Kind](#api-kind) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [ParamDeclaration](#api-paramdeclaration) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [AgentToolOptions](#api-agenttooloptions) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Expectation](#api-expectation) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [HandoffStep](#api-handoffstep) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [FlowStep](#api-flowstep) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [RegionRole](#api-regionrole) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [PlingUiOptions](#api-plinguioptions) | Type | [Reference](/reference/ui-messages-theme-locale) |
| [ModelSettingsSetting](#api-modelsettingssetting) | Type | [Reference](/reference/vue-3-adapter) |

<a id="api-tooloptions"></a>

### `ToolOptions`

The action declaration shape shared by every adapter.

**Imports**

`@plingjs/vue` · `@plingjs/core`

**Signature**

```ts
// Vue 3
type ToolOptions = AtomicToolOptions | ParamsToolOptions
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `desc` | `string` | Yes | — | Required model-facing description of what the control or operation does. This is the primary signal used to select the tool. |
| `id` | `string` | No | `generated once per binding` | Stable action id. Omit only for one-off controls; list rows and flows should use stable ids. |
| `kind` | `"read" \| "write" \| "danger"` | No | `write` | Risk level used for approval and auditing. Omitted values are fail-closed and treated as write. |
| `confirm` | `boolean \| "always"` | No | `derived from kind` | Overrides approval derivation. false skips confirmation, true requires it, and always never offers a persistent allow option. |
| `action` | `"click" \| "fill" \| "select" \| "press" \| "hover"` | No | `inferred from element` | Overrides primitive inference. By default form inputs use fill and other elements use click. |
| `key` | `string` | No | `Enter` | Key used by an action whose primitive is press. |
| `scope` | `string` | No | `nearest scope` | Explicit region id. Omitted values inherit the nearest declared scope. |
| `fidelity` | `"high" \| "auto" \| "low"` | No | `inferred` | Declares how trustworthy the execution target is. Setting it stops automatic target relocation. |
| `target` | `string` | No | — | CSS selector, scoped to the declared element, used to choose the concrete target. |
| `autoTarget` | `boolean` | No | `true` | Automatically locates a unique native control inside the declared element. |
| `available` | `() => boolean \| string \| undefined` | No | — | Business precondition checked before the action appears as available. A returned string is shown to the model as the reason. |
| `expect` | `Expectation` | No | — | Success criterion checked after execution. Failure produces EXPECTATION_FAILED instead of a false success. |
| `handoff` | `boolean \| string \| HandoffOptions` | No | — | Hands the step to the user instead of simulating it. The boolean or string form supplies the reason. |
| `params` | `ParamDeclaration` | Conditional | — | Parameter schema for the parameterized form. When present, run receives the validated parameter object rather than a single primitive value. |
| `run` | `(valueOrArgs) => void \| Promise<void>` | No | — | Injected implementation. Atomic actions receive the primitive value; parameterized actions receive the full argument object. Ignored when steps is present. |
| `steps` | `readonly FlowStep[]` | No | — | Turns the declaration into a single model-facing flow that executes registered action ids in order. Do not combine it with run. |

**Type shape**

```ts
interface ToolOptionsBase {
  desc: string;
  id?: string;
  kind?: "read" | "write" | "danger";
  confirm?: boolean | "always";
  action?: "click" | "fill" | "select" | "press" | "hover";
  key?: string;
  scope?: string;
  fidelity?: Fidelity;
  target?: string;
  autoTarget?: boolean;
  available?: () => boolean | string | undefined;
  expect?: Expectation;
  handoff?: boolean | string | { reason?; expect?; steps?; timeout? };
}

type ToolOptions =
  | { params?: undefined; run?: (value?: unknown) => void | Promise<void> }
  | { params: ParamDeclaration; run?: (args: Record<string, unknown>) => void | Promise<void> };
```

**Example 1 · Parameterized declaration**

```ts
const move = {
  id: "move_task",
  desc: "把待办移动到指定位置",
  kind: "write",
  params: [{ name: "position", label: "新位置", type: "number", min: 1 }],
  run: ({ position }) => moveTask(Number(position)),
};

// <button v-tool="move">上移</button>
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-scopeoptions"></a>

### `ScopeOptions`

The region declaration shape. Vue 3 exposes the equivalent value as ScopeValue.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
type ScopeValue = string | {
  id: string;
  label?: string;
  description?: string;
  role?: RegionRole;
  parent?: string;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Stable region id. It is written to the DOM and inherited by descendant declarations. |
| `label` | `string` | No | — | Short model-facing name, for example 待办列表. |
| `description` | `string` | No | — | Explains what the region is for and when actions inside it apply. |
| `role` | `RegionRole` | No | — | Structural role such as main, dialog, toolbar, or list. It affects reading order and context, not permissions. |
| `parent` | `string` | No | — | Explicit parent region id for portals, overlays, or detach-to-body cases. |

**Example 1 · Region metadata**

```ts
const scope = {
  id: "orders",
  label: "订单列表",
  description: "当前筛选结果，每行可以打开或删除",
  role: "list",
  parent: "main",
};
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-recordvalue"></a>

### `RecordValue`

A row value or a full record declaration with explicit id, label, and fields.

**Imports**

`@plingjs/core` · `@plingjs/vue`

**Signature**

```ts
// Vue 3
type RecordValue =
  | object
  | {
      data: object;
      id?: string | number;
      label?: string;
      fields?: Record<string, unknown>;
    }
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `plain object.id \| key` | `string \| number` | No | — | Default primary key when the row itself is passed as a plain object. |
| `envelope.data` | `object` | Conditional | — | Row data wrapped in the explicit record envelope. |
| `envelope.id` | `string \| number` | No | — | Overrides the primary key when the field is not named id or key. |
| `envelope.label` | `string` | No | — | Human- and model-readable row label. |
| `envelope.fields` | `Record<string, unknown>` | No | — | Allowlist of fields visible to the model. Without it, all row fields except the primary key are exposed. |

**Example 1 · Explicit field allowlist**

```ts
const value = {
  data: order,
  id: order.code,
  label: `订单 ${order.code}`,
  fields: { customer: order.customer, total: order.total },
};
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-stateoptions"></a>

### `State options`

Optional description for a read-only state view.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
interface AgentStateOptions { description?: string }
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `description` | `string` | No | — | Explains the state view and its units or bounds. Describe a view, not the entire store. |

**Example 1 · Describe a bounded view**

```ts
{ description: "当前筛选项、总条数与未完成条数" }
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-agentsetup"></a>

### `AgentSetup`

Application-level runtime options: model overrides, hooks, gates, event handling, trace, and continuity.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
type AgentSetup = Omit<AgentRuntimeOptions, "config" | "registry" | "gate"> & {
  config?: AgentConfigOverrides;
  modelSettings?: ModelSettingsSetting;
  gate?: () => boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `config` | `AgentConfigOverrides` | No | — | Partial model and runtime configuration. Omitted fields are read from VITE_AGENT_* environment variables or framework defaults. |
| `llm` | `Llm` | No | — | Injects the model call function. Use it for a test model, a server proxy, or a non-OpenAI-compatible transport. |
| `responseLocale` | `string \| (() => string)` | No | — | Locale used when composing the response-language instruction. A function is re-read before each model request. |
| `telemetry` | `Telemetry` | No | — | Collects token, duration, cost, and retry metrics for the current runtime. |
| `trace` | `boolean \| AgentTraceOptions` | No | `false` | Keeps a bounded in-memory trace of model requests for the read-only inspector. Disabled by default. |
| `settle` | `() => Promise<void>` | No | — | Replaces the page-settle wait used between actions. Most useful in deterministic tests and non-browser hosts. |
| `hooks` | `HookRegistry` | No | — | Tool lifecycle hooks shared by every surface created from this application runtime. |
| `onEvent` | `(event: SessionEvent) => void` | No | — | Receives the same session event stream that powers the chat and activity views. |
| `onApproval` | `(pending: PendingApproval \| null) => void` | No | — | Called when an approval request appears or clears. Use it to connect a custom approval UI. |
| `onHandoff` | `(pending: PendingHandoff \| null) => void` | No | — | Called when a human-handoff request appears or clears. |
| `policy` | `ConfirmGate` | No | — | Replaces the default approval gate. When provided, the built-in gate and chat approval buttons are not used. |
| `approvalTimeoutMs` | `number` | No | `60000` | Time to wait for a human approval before treating it as denied. |
| `handoffTimeoutMs` | `number` | No | `300000` | Default time to wait for a human handoff. A tool-level handoff.timeout overrides it. |
| `handoff` | `HandoffGate` | No | — | Replaces the built-in handoff queue with a custom channel. |
| `id` | `string` | No | — | Stable session id for multi-session hosts. |
| `onLeaseLost` | `() => void` | No | — | Called when another tab or host takes over the shared session lease. |
| `continuity` | `ContinuitySetting` | No | — | Enables bounded conversation continuity across full-page navigation. "tab" uses sessionStorage. Omit to disable it. |
| `gate` | `() => boolean` | No | `true` | Returns false to disable the built-in confirmation channel for this application. Defaults to enabled. |
| `modelSettings` | `ModelSettingsSetting` | No | `off` | Exposes model connection settings in the Activity view. "readonly" shows application settings; "byok" allows user-entered endpoint, model, and key on trusted pages. |

**Example 1 · Application-level assistant setup**

```ts
const pling = createPling({
  agent: {
    config: { limits: { maxTurns: 12 } },
    trace: true,
    gate: () => true,
    modelSettings: { mode: "byok", persist: "session" },
  },
});
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-kind"></a>

### `Kind`

The action risk level used by approval policy.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Vue 3
type Kind = "read" | "write" | "danger"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `read` | `"read"` | No | — | No business state change. Visibility, navigation, and inspection belong here. |
| `write` | `"write"` | No | — | Changes business state but is not destructive or irreversible. |
| `danger` | `"danger"` | No | — | Destructive, irreversible, or high-impact. Approval defaults to stricter handling. |

**Example 1 · Choose a risk level**

```ts
pling.tool(deleteButton, { desc: "删除此订单", kind: "danger" });
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-paramdeclaration"></a>

### `ParamDeclaration`

Array shorthand or JSON Schema used to validate action arguments.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Vue 3
type ParamDeclaration = readonly ToolParam[] | JsonSchema
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `[].name` | `string` | Yes | — | Argument key received by run and visible to the model. |
| `[].label` | `string` | Yes | — | Required explanation of the argument. It is the model's only semantic hint. |
| `[].type` | `"string" \| "number" \| "boolean"` | No | `"string"` | Argument type. Includes coercion from obvious string forms and rejects invalid values. |
| `[].optional` | `boolean` | No | `false` | Marks the argument optional. Arguments are required by default. |
| `[].values` | `readonly (string \| number)[]` | No | — | Closed static value set. Use it when the model must choose from known values. |
| `[].options` | `() => readonly ParamOption[]` | No | — | Dynamic value set, re-read for each snapshot and execution. |
| `[].min \| [].max` | `number \| (() => number)` | No | — | Numeric bounds for number arguments, including dynamic bounds. |
| `[].minLength \| [].maxLength` | `number` | No | — | String length bounds. |
| `[].pattern` | `RegExp \| string` | No | — | Regular-expression constraint for a string argument. |
| `[].format` | `"date"` | No | — | Semantic format validation. A date must be a real calendar date. |
| `JSON Schema.type` | `"object"` | Conditional | `"object"` | The direct JSON Schema form must describe an object. |
| `JSON Schema.properties` | `Record<string, unknown>` | No | — | Property schemas for the direct JSON Schema form. |
| `JSON Schema.required` | `string[]` | No | — | Required property names for the direct JSON Schema form. |

**Example 1 · Compact parameter declaration**

```ts
const params = [
  { name: "orderId", label: "订单号", pattern: /^SO-\d{4}$/ },
  { name: "note", label: "新备注", maxLength: 200 },
  { name: "notify", label: "是否通知客户", type: "boolean", optional: true },
];
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-agenttooloptions"></a>

### `AgentToolOptions`

The declaration shape for a function-level action: stable id, model-facing description, optional schema, availability, expectation, and implementation.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
interface AgentToolOptions {
  id: string;
  desc: string;
  kind?: Kind;
  confirm?: boolean | "always";
  params?: ParamDeclaration;
  available?: () => boolean | string;
  expect?: Expectation;
  run: (args: Record<string, unknown>) => unknown;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Globally unique action id used by the model. |
| `desc` | `string` | Yes | — | Required semantic description of the operation. |
| `kind` | `Kind` | No | `write` | Risk level. Omitted values are fail-closed and treated as write. |
| `confirm` | `boolean \| "always"` | No | `derived from kind` | Overrides the normal approval policy. |
| `params` | `ParamDeclaration` | No | — | Argument schema and validation; run receives the normalized object. |
| `available` | `() => boolean \| string` | No | — | Precondition check. A string is returned to the model as the unavailability reason. |
| `expect` | `Expectation` | No | — | Success criterion checked after run completes. |
| `run` | `(args: Record<string, unknown>) => unknown` | Yes | — | Validated implementation. Sensitive placeholders are restored before it runs. |

**Example 1 · Function action with parameters**

```ts
useAgentTool({
  id: "set_priority",
  desc: "设置订单优先级",
  kind: "write",
  params: [{ name: "level", label: "优先级", values: ["low", "normal", "high"] }],
  run: ({ level }) => setPriority(String(level)),
});
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-expectation"></a>

### `Expectation`

A success condition checked after an action finishes.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Vue 3
interface Expectation {
  desc?: string;
  check(): boolean | Promise<boolean>;
  timeout?: number;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `desc` | `string` | No | — | Human-readable statement of the expected outcome. It is included in success and failure receipts. |
| `check` | `() => boolean \| Promise<boolean>` | Yes | — | Predicate evaluated after execution. Exceptions remain developer errors and are not swallowed. |
| `timeout` | `number` | No | `2000` | Maximum wait in milliseconds before reporting EXPECTATION_FAILED. |

**Example 1 · Verify a new row exists**

```ts
const expect = {
  desc: "新待办出现在列表中",
  check: () => todos.some((todo) => todo.text === "准备发布"),
  timeout: 3000,
};
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-handoffstep"></a>

### `HandoffStep`

One instruction shown to a person during human handoff.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Vue 3
interface HandoffStep {
  text: string;
  highlight?: string;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `text` | `string` | Yes | — | Instruction shown to the person who takes over. |
| `highlight` | `string` | No | — | Optional guide-target id or action id to highlight while the step is active. |

**Example 1 · Guide a human step**

```ts
const steps = [
  { text: "填写短信验证码", highlight: "captcha" },
  { text: "点击提交", highlight: "submit" },
];
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-flowstep"></a>

### `FlowStep`

One step in a compound action. Flow steps are not a second execution channel.

**Imports**

`@plingjs/core` · `@plingjs/vue`

**Signature**

```ts
// Vue 3
interface FlowStep {
  action: string;
  args?: Record<string, unknown> | ((params: Record<string, unknown>) => Record<string, unknown>);
  expect?: Expectation;
  desc?: string;
  optional?: boolean;
  idempotent?: boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `action` | `string` | Yes | — | Registered action id to execute. It may contain {{parameter}} placeholders. |
| `args` | `Record<string, unknown> \| ((params) => Record<string, unknown>)` | No | — | Step arguments. Strings may reference flow parameters; a function receives the complete parameter object. |
| `expect` | `Expectation` | No | — | Overrides the step action's own success criterion. |
| `desc` | `string` | No | — | Human-readable step description used in progress and receipts. |
| `optional` | `boolean` | No | `false` | A failed optional step is skipped instead of aborting the flow. |
| `idempotent` | `boolean` | No | `false` | Allows safe retry after an execution or expectation failure. Pre-execution failures are always retryable. |

**Example 1 · Reference a parameter in a step**

```ts
const steps = [
  { action: "edit@order:{{orderId}}", desc: "打开订单" },
  { action: "dialog_note", args: { text: "{{note}}" }, desc: "填写备注" },
  { action: "dialog_save", desc: "保存" },
];
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-regionrole"></a>

### `RegionRole`

The structural role of a region.

**Imports**

`@plingjs/core` · `@plingjs/vue`

**Signature**

```ts
// Vue 3
type RegionRole =
  | "page"
  | "header"
  | "nav"
  | "main"
  | "aside"
  | "section"
  | "form"
  | "dialog"
  | "toolbar"
  | "list"
  | "footer"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `role` | `"page" \| "header" \| "nav" \| "main" \| "aside" \| "section" \| "form" \| "dialog" \| "toolbar" \| "list" \| "footer"` | Yes | — | Adds structural context for disambiguating actions with similar names. It does not grant or restrict permissions. |

**Example 1 · Disambiguate two confirm buttons**

```ts
pling.scope(dialog, { id: "edit_dialog", role: "dialog", label: "编辑订单" });
pling.scope(toolbar, { id: "bulk_toolbar", role: "toolbar", label: "批量操作" });
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-plinguioptions"></a>

### `PlingUiOptions`

Locale, theme, message overrides, and class names for the shared assistant UI.

**Imports**

`@plingjs/ui` · `@plingjs/vue`

**Signature**

```ts
// Vue 3
interface PlingUiOptions {
  locale?: PlingLocale;
  theme?: PlingTheme;
  messages?: PlingCatalogOverrides;
  classNames?: PlingClassNames;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `locale` | `"en-US" \| "zh-CN" \| "auto" \| string` | No | `en-US` | Language used by the built-in assistant UI. "auto" follows the browser language. |
| `theme` | `"light" \| "dark" \| "auto" \| PlingThemeOverrides` | No | `light` | Theme for the built-in surfaces. An object can override tokens or choose a mode. |
| `theme.mode` | `"light" \| "dark" \| "auto"` | No | `light` | Explicit mode when the theme is an object. "auto" follows the operating-system preference. |
| `theme.tokens` | `Partial<PlingThemeTokens>` | No | — | Overrides individual design tokens such as colours, radii, shadows, and font families. Keys not supplied keep the selected light or dark defaults. |
| `messages` | `PlingCatalogOverrides` | No | — | Adds or replaces message catalog entries for one or more locales. |
| `messages.<locale>` | `Partial<Record<PlingMessageKey, string>>` | No | — | Message overrides for one BCP 47 locale. Missing keys fall back to the built-in catalog. |
| `classNames` | `PlingClassNames` | No | — | Extra class names applied to the built-in chat, dock, launcher, and panel. |
| `classNames.dock` | `string` | No | — | Extra class for the dock shell. |
| `classNames.panel` | `string` | No | — | Extra class for the panel shell. |
| `classNames.launcher` | `string` | No | — | Extra class for the launcher button. |
| `classNames.chat` | `string` | No | — | Extra class for the chat surface. |

**Example 1 · Chinese UI with a token override**

```ts
const ui = {
  locale: "zh-CN",
  theme: { mode: "light", tokens: { colorPrimary: "#0b6bcb" } },
  classNames: { dock: "product-assistant" },
};
```

**Canonical reference**

[Open the corresponding reference](/reference/ui-messages-theme-locale)


<a id="api-modelsettingssetting"></a>

### `ModelSettingsSetting`

Controls whether the activity view exposes application-managed or user-supplied model settings.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
type ModelSettingsSetting =
  | "off"
  | "readonly"
  | "byok"
  | {
      mode: "off" | "readonly" | "byok";
      persist?: "memory" | "session";
    }
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mode` | `"off" \| "readonly" \| "byok"` | Yes | — | Off hides model settings; readonly displays application-managed settings; byok permits user-entered endpoint, model, and key. |
| `persist` | `"memory" \| "session"` | No | `memory` | For byok, keeps entered settings for the runtime only or in sessionStorage until the tab closes. Storage is never used for application-managed mode. |

**Example 1 · Allow BYOK on a trusted page**

```ts
createPling({
  agent: { modelSettings: { mode: "byok", persist: "session" } },
});
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


## Assistant surfaces

Mounted conversation and inspection surfaces. They render the shared runtime; they do not create a second agent.

| API | Kind | Reference |
| --- | --- | --- |
| [AgentDock](#api-agentdock) | Component | [Reference](/reference/vue-3-adapter) |
| [AgentInline](#api-agentinline) | Component | [Reference](/reference/vue-3-adapter) |
| [AgentChat](#api-agentchat) | Component | [Reference](/reference/vue-3-adapter) |
| [AgentPanel](#api-agentpanel) | Component | [Reference](/reference/vue-3-adapter) |
| [createPlingUi](#api-createplingui) | Function | [Reference](/reference/ui-messages-theme-locale) |

<a id="api-agentdock"></a>

### `AgentDock`

Floating or sidebar assistant surface. Owns placement, task registration, open state, and the activity view.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
<AgentDock />
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | `string` | No | — | Assistant title. Defaults to the localized catalog value. |
| `placeholder` | `string` | No | — | Composer placeholder. |
| `emptyHint` | `string` | No | — | Message shown before the first turn. |
| `quick` | `readonly string[]` | No | `[]` | Suggested prompts that remain available between runs. |
| `defaultOpen` | `boolean` | No | `false` | Whether the surface starts open. |
| `config` | `AgentConfigOverrides` | No | — | Overrides model and runtime settings for this surface only. |
| `llm` | `Llm` | No | — | Injected model function for this surface. Overrides application-level agent.llm. |
| `hooks` | `HookRegistry` | No | — | Tool hooks for this surface. Falls back to application-level hooks. |
| `gate` | `() => boolean` | No | — | Confirmation-channel switch for this surface. |
| `registry` | `Registry` | No | — | Action registry to operate. Defaults to the injected Pling registry. |
| `navigate` | `(href: string) => void` | No | — | Navigation implementation after a completed task. Defaults to window.location.replace. |
| `layout` | `"dock" \| "sidebar"` | No | `"dock"` | Floating corner layout or viewport-edge sidebar. |
| `side` | `"left" \| "right"` | No | `"right"` | Sidebar edge when layout is sidebar. |
| `launcherPlacement` | `"bottom" \| "center"` | No | `"bottom"` | Position of the collapsed sidebar launcher. |
| `launcherLabel` | `string` | No | — | Custom label for the collapsed launcher. |
| `debug` | `boolean \| AgentTraceOptions` | No | `false` | Enables the read-only request inspector inside Activity. Disabled by default. |
| `modelSettings` | `ModelSettingsSetting` | No | `off` | Shows application model settings or permits BYOK in Activity. |
| `@event` | `(event: SessionEvent) => void` | No | — | Emitted for every session event. |
| `@open` | `(open: boolean) => void` | No | — | Emitted when the dock opens or closes. |

**Example 1 · One-tag Vue 3 dock**

```ts
<AgentDock
  title="待办助手"
  :quick="['把第一条待办标记完成']"
  :debug="true"
  @event="audit"
/>
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-agentinline"></a>

### `AgentInline`

Embeds the conversation in a business column instead of a floating surface.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
<AgentInline />
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | `string` | No | — | Assistant title. |
| `placeholder` | `string` | No | — | Composer placeholder. |
| `emptyHint` | `string` | No | — | Empty-state copy. |
| `quick` | `readonly string[]` | No | `[]` | Suggested prompts. |
| `config` | `AgentConfigOverrides` | No | — | Surface-level model overrides. |
| `llm` | `Llm` | No | — | Injected model function. |
| `hooks` | `HookRegistry` | No | — | Surface-level tool hooks. |
| `gate` | `() => boolean` | No | — | Confirmation-channel switch. |
| `registry` | `Registry` | No | — | Registry to operate. |
| `navigate` | `(href: string) => void` | No | — | Post-task navigation implementation. |
| `visible` | `boolean` | No | `true` | Controls visibility without unmounting, so conversation state survives collapse. |
| `variant` | `"dock" \| "inline"` | No | `"inline"` | Compact dock width or a normal inline layout. |
| `manageSurface` | `boolean` | No | `true` | Registers this component with the page task router. Docks set it to false because the shell owns routing. |
| `surfaceId` | `string` | No | `"inline"` | Task-routing name when manageSurface is enabled. |
| `collapsible` | `boolean` | No | `false` | Shows the collapse control used by the dock shell. |
| `debug` | `boolean \| AgentTraceOptions` | No | `false` | Enables the read-only request inspector. |
| `modelSettings` | `ModelSettingsSetting` | No | `off` | Model settings entry in Activity. |
| `@event` | `(event: SessionEvent) => void` | No | — | Session event stream. |
| `@collapse` | `() => void` | No | — | Requests that the parent shell collapse the surface. |
| `@status` | `(status: { running; resume }) => void` | No | — | Reports running state and resume availability. |

**Example 1 · Reserve a workbench column**

```ts
<div class="workspace">
  <main>...</main>
  <AgentInline title="操作助手" />
</div>
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-agentchat"></a>

### `AgentChat`

Renders a conversation and confirmation state without owning placement or the session.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
<AgentChat />
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | `string` | No | — | Chat header title. |
| `events` | `readonly SessionEvent[]` | No | `[]` | Event transcript to render. |
| `running` | `boolean` | No | `false` | Disables input and shows the running state. |
| `pending` | `PendingApproval \| null` | No | `null` | Current approval request. |
| `pendingHandoff` | `PendingHandoff \| null` | No | — | Current human-handoff request. |
| `placeholder` | `string` | No | — | Composer placeholder. |
| `emptyHint` | `string` | No | — | Empty-state copy. |
| `tools` | `boolean` | No | `false` | Includes raw tool-call lines in the transcript. |
| `reveal` | `(text: string) => string` | No | — | Render-only text transform, commonly used to reveal sensitive tokens. |
| `resume` | `{ goal?: string; interrupted?: boolean } \| null` | No | `null` | Shows the continue-previous-task banner. |
| `@send` | `(text: string) => void` | No | — | User submitted a message. |
| `@reply` | `(decision: boolean \| "always") => void` | No | — | User answered an approval request. |
| `@handoff` | `(done: boolean) => void` | No | — | User completed or cancelled a handoff. |
| `@handoffStep` | `(delta: number) => void` | No | — | User moved between handoff steps. |
| `#footer` | `slot` | No | — | Additional content rendered above the composer. |

**Example 1 · Render an externally managed chat**

```ts
<AgentChat
  :events="events"
  :running="running"
  :pending="pending"
  @send="send"
  @reply="reply"
/>
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-agentpanel"></a>

### `AgentPanel`

Development-only snapshot view of what the agent can currently see.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
<AgentPanel />
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | `string` | No | — | Panel title. Defaults to the localized panel title. |
| `policy` | `Policy` | No | — | Permission policy used by the panel's manual execution controls. Defaults to auto-approve for debugging only. |
| `@executed` | `(event: ExecutedEvent) => void` | No | — | Emitted after an action is executed from the panel. |
| `#compose` | `{ execute, snapshot }` | No | — | Slot that exposes the panel executor and current snapshot for custom controls. |

**Example 1 · Inspect declarations and coverage**

```ts
<AgentPanel @executed="audit" />
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-createplingui"></a>

### `createPlingUi`

Creates the shared locale, theme, and message controller behind the Vue surface.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
createPlingUi(options?: PlingUiOptions, defaultLocale?: string): PlingUiController
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `locale` | `"en-US" \| "zh-CN" \| "auto" \| string` | No | `en-US` | Language used by the built-in assistant UI. "auto" follows the browser language. |
| `theme` | `"light" \| "dark" \| "auto" \| PlingThemeOverrides` | No | `light` | Theme for the built-in surfaces. An object can override tokens or choose a mode. |
| `theme.mode` | `"light" \| "dark" \| "auto"` | No | `light` | Explicit mode when the theme is an object. "auto" follows the operating-system preference. |
| `theme.tokens` | `Partial<PlingThemeTokens>` | No | — | Overrides individual design tokens such as colours, radii, shadows, and font families. Keys not supplied keep the selected light or dark defaults. |
| `messages` | `PlingCatalogOverrides` | No | — | Adds or replaces message catalog entries for one or more locales. |
| `messages.<locale>` | `Partial<Record<PlingMessageKey, string>>` | No | — | Message overrides for one BCP 47 locale. Missing keys fall back to the built-in catalog. |
| `classNames` | `PlingClassNames` | No | — | Extra class names applied to the built-in chat, dock, launcher, and panel. |
| `classNames.dock` | `string` | No | — | Extra class for the dock shell. |
| `classNames.panel` | `string` | No | — | Extra class for the panel shell. |
| `classNames.launcher` | `string` | No | — | Extra class for the launcher button. |
| `classNames.chat` | `string` | No | — | Extra class for the chat surface. |
| `defaultLocale` | `string` | No | `en-US` | Fallback locale used when ui.locale is not supplied. |

**Example 1 · Create a standalone UI controller**

```ts
const ui = createPlingUi({ locale: "zh-CN", theme: "auto" });
ui.setTheme("dark");
console.log(ui.t("chat.send"));
```

**Canonical reference**

[Open the corresponding reference](/reference/ui-messages-theme-locale)


## External Agent Surface

Vue wrappers for exposing declared capabilities through a Surface gateway. They manage credentials and transport; the capability allowlist and human approval stay in the application.

| API | Kind | Reference |
| --- | --- | --- |
| [useSurfaceGateway](#api-usesurfacegateway) | Function | [Reference](/reference/vue-3-adapter) |
| [SurfaceAccessPanel](#api-surfaceaccesspanel) | Component | [Reference](/reference/vue-3-adapter) |

<a id="api-usesurfacegateway"></a>

### `useSurfaceGateway`

Creates and owns the page session, WebSocket, Surface bridge, pairing, claim, and revocation lifecycle for one Vue component scope.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
useSurfaceGateway(options: UseSurfaceGatewayOptions): SurfaceGatewayController
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `app` | `string` | Yes | — | Stable application name sent in the bridge hello. |
| `expose` | `SurfaceExpose` | Yes | — | Explicit capability allowlist. The composable never infers capabilities from the DOM or registry. |
| `mode` | `"public-demo" \| "bff"` | Yes | — | public-demo creates a page session from the browser and may show an Agent token. bff requires getPageSession and must be backed by an authenticated application server. |
| `gatewayUrl` | `string` | No | — | Gateway origin for public-demo mode, for example https://surface.example.com. |
| `getPageSession` | `() => Promise<SurfacePageSession>` | No | — | Required in bff mode. The application server verifies the user session and returns only a short-lived page session. |
| `gatewayClient` | `SurfaceGatewayClient` | No | — | Injected HTTP client for tests or a custom BFF contract. |
| `approval` | `SurfaceApprovalSource & { confirm?: Confirm }` | No | — | Human approval source. Its subscribe callback relays pending state; the page still owns the decision UI. |
| `confirm` | `Confirm \| null` | No | — | Confirmation function used by the Surface executor. Defaults to approval.confirm, then null (fail closed). |
| `autoConnect` | `boolean` | No | `true` | Connects when the component mounts. Set false when the host owns an explicit connect button. |
| `autoClaim` | `boolean` | No | `true (public-demo only)` | Claims an Agent token automatically. Defaults to true only in public-demo mode. |
| `agentId` | `string` | No | — | Agent id recorded when claiming a public-demo pairing. |
| `tenantId` | `string` | No | — | Optional tenant hint for the public-demo page-session endpoint. |
| `clientKey` | `string` | No | — | Optional client hint for the public-demo page-session endpoint. |
| `reconnectMs` | `number` | No | `1500` | Delay before reconnecting the page WebSocket. |
| `webSocket` | `SurfaceWebSocketFactory` | No | — | WebSocket implementation injection for tests or non-browser hosts. |
| `surface` | `Partial<CreatePlingSurfaceOptions>` | No | — | Extra Surface options such as recordLimit, rateLimit, replay, audit, or custom settle. |

**Example 1 · Public demo with an explicit allowlist**

```ts
const gateway = useSurfaceGateway({
  app: "orders",
  expose: ["orders.overview", "orders.update_note"],
  mode: "public-demo",
  gatewayUrl: "https://surface.example.com",
  approval,
});

const surface = computed(() => gateway.surface.value);
```

**Example 2 · Production BFF session**

```ts
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
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-surfaceaccesspanel"></a>

### `SurfaceAccessPanel`

Optional Vue panel for connection state, pairing, a copyable Agent token, the current scope, and revocation. It renders a controller; it does not create capabilities.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
<SurfaceAccessPanel :gateway="gateway" title="External Agent" />
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `gateway` | `SurfaceGatewayController` | Yes | — | Controller returned by useSurfaceGateway. The component renders its state but never creates capabilities or tokens by itself. |
| `title` | `string` | No | — | Panel title. Defaults to the localized External Agent label. |

**Example 1 · Render the optional access panel**

```ts
<SurfaceAccessPanel :gateway="gateway" title="外部 Agent" />
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


## Page identity and continuity

Read page identity, share a runtime across frames, and inspect declared coverage.

| API | Kind | Reference |
| --- | --- | --- |
| [PageOptions](#api-pageoptions) | Type | [Reference](/reference/vue-3-adapter) |
| [PlingPage](#api-plingpage) | Interface | [Reference](/reference/continuity-and-projection) |
| [createPlingPage](#api-createplingpage) | Function | [Reference](/reference/continuity-and-projection) |
| [sharePlingPageWithFrame](#api-shareplingpagewithframe) | Function | [Reference](/reference/continuity-and-projection) |
| [plingPageFromParent](#api-plingpagefromparent) | Function | [Reference](/reference/continuity-and-projection) |
| [waitForPlingPageFromParent](#api-waitforplingpagefromparent) | Function | [Reference](/reference/continuity-and-projection) |
| [inspectCoverage](#api-inspectcoverage) | Method | [Reference](/reference/vue-3-adapter) |

<a id="api-pageoptions"></a>

### `PageOptions`

Controls automatic page identity, router integration, query allowlisting, hash handling, and title overrides.

**Imports**

`@plingjs/vue`

**Signature**

```ts
// Vue 3
interface PageOptions {
  enabled?: boolean;
  router?: PageRouterLike;
  queryKeys?: readonly string[];
  hash?: boolean;
  title?: () => string | undefined;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `enabled` | `boolean` | No | `true` | Enables page identity collection. createPling({ page: false }) is the shorthand for disabling it. |
| `router` | `PageRouterLike` | No | — | Vue Router-like object that supplies route name, params, hash, and meta.title. If omitted, the adapter tries $router after mount. |
| `queryKeys` | `readonly string[]` | No | `[]` | Allowlist of query parameters exposed to the model. Query parameters are hidden by default. |
| `hash` | `boolean` | No | `true` | Includes safe hash fragments. Hash values that resemble query strings are ignored. |
| `title` | `() => string \| undefined` | No | — | Title override or fallback. It takes precedence over route meta.title and document.title. |

**Example 1 · Expose route identity without tokens**

```ts
createPling({
  page: {
    queryKeys: ["tab"],
    title: () => route.meta.title as string | undefined,
  },
});
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


<a id="api-plingpage"></a>

### `PlingPage`

A page-level runtime shared by multiple framework islands or same-origin frames.

**Imports**

`@plingjs/dom` · `@plingjs/vue`

**Signature**

```ts
// Vue 3
interface PlingPage {
  readonly registry: Registry;
  readonly scopes: ScopeController;
  readonly feedback: FeedbackCollector;
  destroy(): void;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `registry` | `Registry` | No | — | Shared action, record, state, and feedback registry. |
| `scopes` | `ScopeController` | No | — | Shared region visibility and occlusion controller. |
| `feedback` | `FeedbackCollector` | No | — | Page-level feedback collector that observes the document once. |
| `destroy()` | `void` | No | — | Stops page observers and clears automatic scopes. Adapters should destroy their declarations first. |

**Example 1 · Share one page runtime**

```ts
const page = createPlingPage();
const vuePling = createPling({ shared: page });
const reactPling = createPling({ shared: page });
```

**Canonical reference**

[Open the corresponding reference](/reference/continuity-and-projection)


<a id="api-createplingpage"></a>

### `createPlingPage`

Creates the shared registry, scopes, and page identity that adapters can join with shared.

**Imports**

`@plingjs/dom` · `@plingjs/vue`

**Signature**

```ts
// Vue 3
createPlingPage(options?: PlingPageOptions): PlingPage
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options.registry` | `Registry` | No | — | Existing registry to share. A new registry is created when omitted. |
| `options.scopes` | `ScopeControllerOptions` | No | — | Visibility and hit-testing overrides for the shared page. |

**Example 1 · Create a mixed-framework page runtime**

```ts
const page = createPlingPage();

// Pass the same page to Vue, React, or Vanilla islands:
const pling = createPling({ shared: page, namespace: "orders" });
```

**Canonical reference**

[Open the corresponding reference](/reference/continuity-and-projection)


<a id="api-shareplingpagewithframe"></a>

### `sharePlingPageWithFrame`

Shares a page runtime with a same-origin iframe and returns a cleanup function.

**Imports**

`@plingjs/dom` · `@plingjs/vue`

**Signature**

```ts
// Vue 3
sharePlingPageWithFrame(frame: HTMLIFrameElement, page: PlingPage): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `frame` | `HTMLIFrameElement` | Yes | — | Same-origin iframe that should receive the shared page runtime. |
| `page` | `PlingPage` | Yes | — | Runtime created by createPlingPage. |

**Example 1 · Share a runtime with a same-origin frame**

```ts
const page = createPlingPage();
const stop = sharePlingPageWithFrame(iframe, page);

// On teardown:
stop();
page.destroy();
```

**Canonical reference**

[Open the corresponding reference](/reference/continuity-and-projection)


<a id="api-plingpagefromparent"></a>

### `plingPageFromParent`

Reads a shared page runtime from the parent window when the current document is an embedded frame.

**Imports**

`@plingjs/dom` · `@plingjs/vue`

**Signature**

```ts
// Vue 3
plingPageFromParent(win?: Window): PlingPage | undefined
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `win` | `Window` | No | `window` | Window whose parent should be checked. Defaults to the current window. |

**Example 1 · Read a shared page synchronously**

```ts
const page = plingPageFromParent();
if (page) createPling({ shared: page });
```

**Canonical reference**

[Open the corresponding reference](/reference/continuity-and-projection)


<a id="api-waitforplingpagefromparent"></a>

### `waitForPlingPageFromParent`

Waits for a parent frame to publish its page runtime.

**Imports**

`@plingjs/dom` · `@plingjs/vue`

**Signature**

```ts
// Vue 3
waitForPlingPageFromParent(options?: WaitForFramePageOptions): Promise<PlingPage>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options.window` | `Window` | No | `window` | Child window to listen on. Defaults to the current window. |
| `options.timeoutMs` | `number` | No | `5000` | Maximum wait. Zero waits indefinitely. Rejects when another positive timeout expires. |

**Example 1 · Wait for the parent runtime**

```ts
const page = await waitForPlingPageFromParent({ timeoutMs: 8000 });
createPling({ shared: page });
```

**Canonical reference**

[Open the corresponding reference](/reference/continuity-and-projection)


<a id="api-inspectcoverage"></a>

### `inspectCoverage`

Scans the mounted page for interactive controls that have no declaration. It reports; it never registers an action.

**Imports**

`@plingjs/vue` · `@plingjs/dom`

**Signature**

```ts
// Vue 3
pling.inspectCoverage(): CoverageReport
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `root` | `Element \| null` | No | — | Application root to scan. Vue uses its mount root; React and DOM callers may pass any root. |
| `return.total` | `number` | No | — | Recognized actionable controls in the root. |
| `return.declared` | `number` | No | — | Controls with a direct declaration. |
| `return.derived` | `number` | No | — | Controls produced by optional L1 derivation. |
| `return.grouped` | `number` | No | — | Controls covered by a declaration on an ancestor. Review these manually. |
| `return.missing` | `number` | No | — | Actionable controls with no declaration in their ancestry. |
| `return.coveragePercent` | `number \| null` | No | — | Covered controls divided by total; null when there are no controls. |
| `return.targets` | `CoverageTarget[]` | No | — | Grouped and missing controls with labels and nearby action ids. |

**Example 1 · Inspect Vue coverage**

```ts
const report = pling.inspectCoverage();
console.log(report.coveragePercent, report.targets);
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


## Version and compatibility

| Package | Version | Peer dependencies |
| --- | --- | --- |
| `@plingjs/vue` | `0.1.0-alpha.3` | `vue ^3` |
| `@plingjs/react` | `0.1.0-alpha.3` | `react >=18` |
| `@plingjs/vue2` | `0.1.0-alpha.3` | `vue ^2.7.0` |
| `@plingjs/vanilla` | `0.1.0-alpha.3` | — |

| Item | Value |
| --- | --- |
| Introduced | `0.1.0-alpha.2` |
| Stability | Pre-1.0 alpha; a minor release may change the API |

## Machine-readable copy

- [JSON for this page](/api-index/vue-3.json)
- [API overview JSON](/api-index.json)
