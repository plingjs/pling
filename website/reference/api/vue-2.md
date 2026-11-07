---
title: "Vue 2.7 API"
status: navigation
release: 0.1
locale: en
---
<!-- generated:api-index -->

# Vue 2.7 API

The Vue 2.7 adapter keeps the DOM-first runtime and exposes directives plus the shared DOM dock. Every signature below is the Vue 2.7 form.

This page lists only `@plingjs/vue2` entry points, plus the shared-package types used with them.

[API overview](/reference/api/) · [Shared package API](/reference/api/shared)

| Package | Peer dependencies | Version |
| --- | --- | --- |
| `@plingjs/vue2` | vue ^2.7.0 | `0.1.0-alpha.7` |

The current package version is `0.1.0-alpha.7`; stability is **preview**. This is a pre-1.0 alpha, so a minor release may still change the API.

## Minimal example

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({ namespace: "todo" });
Vue.use(pling.plugin);
pling.dock();
```

## Entry and lifecycle

Create the application runtime, install the adapter, and release its observers.

| API | Kind | Reference |
| --- | --- | --- |
| [createPling](#api-createpling) | Function | [Reference](/reference/vue-2-adapter) |
| [usePling](#api-usepling) | Function | [Reference](/reference/vue-2-adapter) |
| [pling.plugin](#api-plugin) | Plugin | [Reference](/reference/vue-2-adapter) |
| [VanillaPling](#api-vanillapling) | Interface | [Reference](/reference/vue-2-adapter) |
| [pling.destroy](#api-destroy) | Method | [Reference](/reference/vue-2-adapter) |

<a id="api-createpling"></a>

### `createPling`

Creates the application-level Pling instance and returns the adapter-specific runtime object.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
createPling(options?: Vue2PlingOptions): Vue2Pling
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
| `defaultApproval` | `"danger" \| "kind"` | No | `"danger"` | Sets the declaration-time default when a tool omits confirm. "danger" asks only for danger actions; "kind" uses the risk level of every action. |

**Returns**

The adapter instance. Vue 3 and React return PlingElement; Vue 2.7 and Vanilla return VanillaPling.

**Defaults**

- No declaration means no action; derive is off by default.
- Presence is on by default.
- revealSensitive is true by default.

**Example 1 · Vue 2.7 application setup**

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({ namespace: "todo" });
Vue.use(pling.plugin);

new Vue({ render: (h) => h(App) }).$mount("#app");
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

[Open the corresponding reference](/reference/vue-2-adapter)


<a id="api-usepling"></a>

### `usePling`

Reads the nearest Pling instance from the framework tree.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
usePling(): Vue2Pling
```

**Parameters**

None.

**Example 1 · Read the installed runtime**

```ts
const pling = usePling();
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-2-adapter)


<a id="api-plugin"></a>

### `pling.plugin`

Installs Vue directives and the runtime injection key. React uses PlingProvider instead.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
Vue.use(pling.plugin)
```

**Parameters**

None.

**Example 1 · Install Vue 2.7 directives**

```ts
Vue.use(pling.plugin);
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-2-adapter)


<a id="api-vanillapling"></a>

### `VanillaPling`

The DOM-first runtime used by Vanilla JS and Vue 2.7. It exposes declarations, feedback, task routing, page identity, coverage, the dock, and the Surface gateway.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
interface Vue2Pling extends VanillaPling {
  plugin: { install(Vue: VueConstructor): void };
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `plugin` | `{ install(Vue: VueConstructor): void }` | No | — | Installs the Vue 2.7 directives and $pling property. |

**Example 1 · Install the Vue 2.7 plugin**

```ts
Vue.use(pling.plugin);
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-2-adapter)


<a id="api-destroy"></a>

### `pling.destroy`

Stops observers, derived actions, scopes, presence, UI subscriptions, and mounted assistant surfaces.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
pling.destroy(): void
```

**Parameters**

None.

**Example 1 · Release the runtime**

```ts
beforeDestroy() {
  this.$pling.destroy();
}
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-2-adapter)


## Page declarations

Declare actions, records, regions, state, feedback, task entrances, and sensitive values.

| API | Kind | Reference |
| --- | --- | --- |
| [Element action](#api-element-action) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Function-level action](#api-function-action) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Region](#api-region) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Record](#api-record) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Read-only state](#api-state) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Store state](#api-store-state) | Declaration | [Reference](/reference/vue-2-adapter) |
| [sensitive](#api-sensitive) | Function | [Reference](/reference/core-declarations-actions-records-regions-state) |

<a id="api-element-action"></a>

### `Element action`

Declares what a control does. The description is the model's only explanation; execution still goes through availability, approval, and expectations.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
v-tool="string | ToolOptions | readonly ToolOptions[]"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `v-tool` | `string \| ToolOptions \| readonly ToolOptions[]` | Yes | — | A description shorthand or one or more declarations for the same element. |

**Example 1 · Vue 2.7 directive**

```vue
<button v-tool="{ id: 'add', desc: '添加一条待办', run: () => add() }">添加</button>
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-function-action"></a>

### `Function-level action`

Registers a business operation that has no dedicated DOM control.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
pling.action(options: ActionOptions): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options` | `ActionOptions` | Yes | — | An action implemented in code rather than bound to a DOM control. |

**Example 1 · Register an action**

```ts
const unbind = pling.action({
  id: "clear_completed",
  desc: "清除所有已完成待办",
  run: () => clearCompleted(),
});
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-region"></a>

### `Region`

Declares a structural region and its reachability. Regions explain context; they are not permission boundaries.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
v-scope="string | ScopeOptions"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `v-scope` | `string \| ScopeOptions` | Yes | — | Region id or metadata object. |

**Example 1 · Describe a region**

```vue
<section v-scope="{ id: 'todos', label: '待办列表' }">...</section>
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-record"></a>

### `Record`

Gives one row a stable identity and a bounded set of readable fields. Records are read-only.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
v-record="RecordValue | null | undefined"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `v-record` | `RecordValue \| null \| undefined` | Yes | — | The row object or an explicit record envelope. |

**Example 1 · Expose a row**

```vue
<li v-for="todo in todos" :key="todo.id" v-record="todo">...</li>
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-state"></a>

### `Read-only state`

Exposes a derived view of current UI state. State has no setter; writes must be declared as actions.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
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
useAgentState("todo", () => ({ filter: this.filter, total: this.todos.length }));
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-store-state"></a>

### `Store state`

Selects named fields from a Pinia or Vuex store. It never exposes the whole store.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
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
const cart = this.$store.state.cart;
useAgentStoreState("cart", cart, ["count", "total"], "购物车件数与小计");
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-2-adapter)


<a id="api-sensitive"></a>

### `sensitive`

Marks a value for outbound masking, tokenization, or a hint while keeping the field name visible.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Vue 2.7
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
| [Expectation](#api-expectation) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [HandoffStep](#api-handoffstep) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [FlowStep](#api-flowstep) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [RegionRole](#api-regionrole) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [PlingUiOptions](#api-plinguioptions) | Type | [Reference](/reference/ui-messages-theme-locale) |

<a id="api-tooloptions"></a>

### `ToolOptions`

The action declaration shape shared by every adapter.

**Imports**

`@plingjs/vue2` · `@plingjs/core`

**Signature**

```ts
// Vue 2.7
type ToolOptions = AtomicToolOptions | ParamsToolOptions
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `desc` | `string` | Yes | — | Required model-facing description of what the control or operation does. This is the primary signal used to select the tool. |
| `id` | `string` | No | `generated once per binding` | Stable action id. Omit only for one-off controls; list rows and flows should use stable ids. |
| `kind` | `"read" \| "write" \| "danger"` | No | `write` | Risk level used for approval and auditing. Omitted values are fail-closed and treated as write. |
| `confirm` | `boolean \| "always"` | No | `derived from kind` | Overrides approval derivation. false skips confirmation, true requires it, and always never offers a persistent allow option. |
| `modelVisible` | `boolean` | No | `true` | Keeps the action out of the model tool list and snapshot while page code and task steps can still invoke it. This is a visibility boundary, not a permission check. |
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
  label?: string;
  summary?: string;
  examples?: readonly string[];
  successHint?: string;
  playbook?: readonly string[];
  id?: string;
  kind?: "read" | "write" | "danger";
  confirm?: boolean | "always";
  modelVisible?: boolean;
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

```js
const move = {
  id: "move_task",
  desc: "把待办移动到指定位置",
  params: [{ name: "position", label: "新位置", type: "number", min: 1 }],
  run: ({ position }) => moveTask(Number(position)),
};
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-scopeoptions"></a>

### `ScopeOptions`

The region declaration shape. Vue 3 exposes the equivalent value as ScopeValue.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
interface ScopeOptions {
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

`@plingjs/core`

**Signature**

```ts
// Vue 2.7
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

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
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

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
type AgentSetup = Omit<AgentRuntimeOptions, "config" | "registry" | "gate"> & {
  config?: AgentConfigOverrides;
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

**Example 1 · Application-level assistant setup**

```ts
const pling = createPling({
  agent: { config: { limits: { maxTurns: 12 } }, trace: true },
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
// Vue 2.7
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
// Vue 2.7
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


<a id="api-expectation"></a>

### `Expectation`

A success condition checked after an action finishes.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Vue 2.7
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
// Vue 2.7
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

`@plingjs/core`

**Signature**

```ts
// Vue 2.7
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

`@plingjs/core`

**Signature**

```ts
// Vue 2.7
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

`@plingjs/ui`

**Signature**

```ts
// Vue 2.7
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


## Assistant surfaces

Mounted conversation and inspection surfaces. They render the shared runtime; they do not create a second agent.

| API | Kind | Reference |
| --- | --- | --- |
| [VanillaDock](#api-vanilladock) | Interface | [Reference](/reference/vue-2-adapter) |

<a id="api-vanilladock"></a>

### `VanillaDock`

The DOM dock controller returned by pling.dock(): element, runtime, open, close, toggle, isOpen, destroy.

**Imports**

`@plingjs/vue2`

**Signature**

```ts
// Vue 2.7
pling.dock(options?: VanillaDockOptions): VanillaDock
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | `string` | No | — | Assistant title. |
| `placeholder` | `string` | No | — | Composer placeholder. |
| `emptyHint` | `string` | No | — | Empty-state copy. |
| `quick` | `readonly string[]` | No | — | Suggested prompts. |
| `defaultOpen` | `boolean` | No | `false` | Whether the dock starts open. |
| `config` | `AgentConfigOverrides` | No | — | Dock-level model overrides. |
| `llm` | `Llm` | No | — | Injected model function. |
| `hooks` | `HookRegistry` | No | — | Dock-level tool hooks. |
| `gate` | `() => boolean` | No | — | Confirmation-channel switch. |
| `registry` | `Registry` | No | — | Registry to operate. Defaults to this Pling instance. |
| `onSessionEvent` | `(event: SessionEvent) => void` | No | — | Session event callback. |
| `onOpenChange` | `(open: boolean) => void` | No | — | Called when the dock opens or closes. |
| `navigate` | `(href: string) => void` | No | `window.location.replace` | Post-task navigation implementation. |
| `surfaceId` | `string` | No | `"dock"` | Surface id registered with the task router so pling.ask({ surface }) can target this dock. |
| `layout` | `"dock" \| "sidebar" \| "inline"` | No | `"dock"` | Floating corner, viewport-edge sidebar, or a permanently visible panel mounted in the page. |
| `sidebarMode` | `"overlay" \| "fused"` | No | `"overlay"` | Sidebar layers above the page or participates in the application grid. Applies only when layout is sidebar. |
| `side` | `"left" \| "right"` | No | `"right"` | Sidebar edge when layout is sidebar. |
| `launcherPlacement` | `"bottom" \| "center"` | No | `"bottom"` | Position of the collapsed sidebar launcher. |
| `launcherLabel` | `string` | No | — | Custom label for the closed launcher. |
| `mount` | `Element` | No | `document.body` | Mount target for the assistant shell. Defaults to document.body. |
| `task` | `HTMLElement \| (() => HTMLElement \| null)` | No | — | Guided task card or task host rendered inside the conversation transcript. Return the same card from createTaskCard(). |
| `debug` | `boolean \| AgentTraceOptions` | No | `false` | Shows the read-only request inspector in the Activity tab and bounds retained calls. |
| `modelSettings` | `ModelSettingsSetting` | No | `"off"` | Shows application-managed settings or permits BYOK in the Activity tab. |
| `return.element` | `HTMLElement` | No | — | Root element owned by the dock. |
| `return.runtime` | `AgentRuntime` | No | — | Runtime driving the dock conversation. |
| `return.open()` | `void` | No | — | Opens the dock. |
| `return.close()` | `void` | No | — | Closes the dock while preserving its conversation. |
| `return.toggle()` | `void` | No | — | Toggles the open state. |
| `return.isOpen()` | `boolean` | No | — | Returns the current open state. |
| `return.destroy()` | `void` | No | — | Removes the dock and releases its runtime resources. |

**Example 1 · Mount and control the native dock**

```ts
const dock = pling.dock({
  title: "待办助手",
  defaultOpen: false,
  onOpenChange: (open) => console.log(open),
});

// Later:
dock.open();
// On teardown:
dock.destroy();
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-2-adapter)


## Guided tasks

Tasks that collect user decisions, call existing actions in a fixed order, and render one shared run snapshot. The catalog decides which tasks are available in the current context; the guide decides how the active task is explained without duplicating execution or permissions.

| API | Kind | Reference |
| --- | --- | --- |
| [createTaskController](#api-createtaskcontroller) | Function | [Reference](/reference/guided-task-api) |
| [createTaskCatalog](#api-createtaskcatalog) | Function | [Reference](/reference/guided-task-api) |
| [TaskCatalog](#api-taskcatalog) | Interface | [Reference](/reference/guided-task-api) |
| [GuidedTaskRegistration](#api-guidedtaskregistration) | Interface | [Reference](/reference/guided-task-api) |
| [GuidedTaskActivationOptions](#api-guidedtaskactivationoptions) | Interface | [Reference](/reference/guided-task-api) |
| [ActiveGuidedTask](#api-activeguidedtask) | Interface | [Reference](/reference/guided-task-api) |
| [TaskGuideDefinition](#api-taskguidedefinition) | Interface | [Reference](/reference/guided-task-api) |
| [TaskGuideField](#api-taskguidefield) | Interface | [Reference](/reference/guided-task-api) |
| [TaskGuideStep](#api-taskguidestep) | Interface | [Reference](/reference/guided-task-api) |
| [TaskGuideAction](#api-taskguideaction) | Interface | [Reference](/reference/guided-task-api) |
| [TaskGuideRow](#api-taskguiderow) | Interface | [Reference](/reference/guided-task-api) |
| [TaskGuideDone](#api-taskguidedone) | Interface | [Reference](/reference/guided-task-api) |
| [TaskGuideCommand](#api-taskguidecommand) | Interface | [Reference](/reference/guided-task-api) |
| [TaskGuideState](#api-taskguidestate) | Interface | [Reference](/reference/guided-task-api) |
| [GuidedTaskView](#api-guidedtaskview) | Interface | [Reference](/reference/guided-task-api) |
| [TaskDefinition](#api-taskdefinition) | Interface | [Reference](/reference/guided-task-api) |
| [TaskBinding](#api-taskbinding) | Interface | [Reference](/reference/guided-task-api) |
| [TaskRecordBinding](#api-taskrecordbinding) | Interface | [Reference](/reference/guided-task-api) |
| [TaskField](#api-taskfield) | Interface | [Reference](/reference/guided-task-api) |
| [TaskLookup](#api-tasklookup) | Type | [Reference](/reference/guided-task-api) |
| [TaskLookupContext](#api-tasklookupcontext) | Interface | [Reference](/reference/guided-task-api) |
| [TaskStep](#api-taskstep) | Interface | [Reference](/reference/guided-task-api) |
| [TaskStepSnapshot](#api-taskstepsnapshot) | Interface | [Reference](/reference/guided-task-api) |
| [TaskRunStatus](#api-taskrunstatus) | Type | [Reference](/reference/guided-task-api) |
| [TaskWaitingFor](#api-taskwaitingfor) | Type | [Reference](/reference/guided-task-api) |
| [TaskRunContext](#api-taskruncontext) | Interface | [Reference](/reference/guided-task-api) |
| [TaskRunSnapshot](#api-taskrunsnapshot) | Interface | [Reference](/reference/guided-task-api) |
| [TaskController](#api-taskcontroller) | Interface | [Reference](/reference/guided-task-api) |
| [TaskChoice](#api-taskchoice) | Interface | [Reference](/reference/guided-task-api) |
| [QuickTask](#api-quicktask) | Interface | [Reference](/reference/guided-task-api) |
| [QuickTaskItem](#api-quicktaskitem) | Type | [Reference](/reference/guided-task-api) |
| [TaskInvoke](#api-taskinvoke) | Type | [Reference](/reference/guided-task-api) |
| [createGuideActions](#api-createguideactions) | Function | [Reference](/reference/guided-task-api) |
| [GuideActionItem](#api-guideactionitem) | Interface | [Reference](/reference/guided-task-api) |

<a id="api-createtaskcontroller"></a>

### `createTaskController`

Creates a framework-independent task controller. The host supplies the only execution bridge through invoke.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
createTaskController(options: TaskControllerOptions): TaskController
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options.invoke` | `TaskInvoke` | Yes | — | The only execution bridge. It should call the existing executor, a governed Surface, or an application service. |
| `options.now` | `() => number` | No | `Date.now` | Clock used for startedAt and finishedAt. Inject a deterministic clock in tests. |

**Example 1 · Run a fixed task through an existing executor**

```ts
import { createTaskController } from "@plingjs/agent";

const tasks = createTaskController({
  invoke: (action, args, context) => executor.execute(action, JSON.stringify(args), context),
});

tasks.register({
  id: "student.cards",
  title: "查看会员卡",
  fields: [{ name: "studentRef", label: "学员", type: "lookup", lookup: searchStudents }],
  steps: [{
    label: "读取会员卡",
    action: "get_student_cards",
    args: (values) => ({ studentId: values.studentRef }),
  }],
});
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-createtaskcatalog"></a>

### `createTaskCatalog`

Creates the page's guided-task catalog. It selects tasks by route and active scope, activates one guide at a time, and binds the narrow pling_start_task action to the current registry.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
createTaskCatalog(options?: TaskCatalogOptions): TaskCatalog
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options.registry` | `Registry` | No | — | Registry used for route changes and for binding the narrow pling_start_task and pling_update_task actions. |
| `options.isScopeActive` | `(scope: string) => boolean` | No | — | Scope lookup used by registration-level scope restrictions. Vue passes its namespaced registry lookup. |
| `options.getPage` | `() => PageView \| undefined` | No | — | Page identity override. Defaults to registry.getPage(). |
| `options.actionId` | `string` | No | `"pling_start_task"` | Preferred model action id. A shared registry keeps the first catalog on this id and assigns later catalogs suffixes such as pling_start_task_2. |

**Example 1 · Register one task for the current route**

```ts
import { createTaskCatalog, createTaskController } from "@plingjs/agent";

const tasks = createTaskController({
  invoke: (action, args) => executor.execute(action, JSON.stringify(args)),
});

const catalog = createTaskCatalog({ registry: pling.registry });
const off = catalog.define({
  definition: courseDefinition,
  guide: courseGuide,
  controller: tasks,
  route: "/courses/new",
  autoStart: true,
  state: () => ({ snapshot: tasks.snapshot(), step: currentStep.value }),
});

// Later: off() removes the registration and any active guide it owns.
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskcatalog"></a>

### `TaskCatalog`

The current page's task directory: register definitions, query what is available now, activate at most one guide, forward guide commands, and notify renderers.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskCatalog {
  readonly actionId: string;
  readonly updateActionId: string;
  define(registration: GuidedTaskRegistration): () => void;
  get(id: string): GuidedTaskRegistration | undefined;
  list(): readonly GuidedTaskRegistration[];
  available(): readonly GuidedTaskRegistration[];
  active(): ActiveGuidedTask | null;
  activate(id: string, options?: GuidedTaskActivationOptions): ActiveGuidedTask;
  deactivate(): void;
  command(command: TaskGuideCommand): boolean;
  views(): readonly GuidedTaskView[];
  refresh(): void;
  subscribe(listener: () => void): () => void;
  destroy(): void;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `actionId` | `readonly string` | No | — | The actual model action id bound by this catalog. Read it instead of assuming pling_start_task when several runtimes share a registry. |
| `updateActionId` | `readonly string` | No | — | The actual model action id for updating the active task's working memory. It accepts only declared, agent-writable fields. |
| `define(registration)` | `() => void` | No | — | Adds a task registration and returns an unregister function. |
| `get(id)` | `GuidedTaskRegistration \| undefined` | No | — | Returns one registration even when its route or scope is currently unavailable. |
| `list()` | `readonly GuidedTaskRegistration[]` | No | — | Returns every registration owned by this catalog. |
| `available()` | `readonly GuidedTaskRegistration[]` | No | — | Returns the registrations whose route and scopes match the current page. |
| `active()` | `ActiveGuidedTask \| null` | No | — | Returns the one task currently shown to the user, or null. |
| `activate(id, options?)` | `ActiveGuidedTask` | No | — | Starts or resumes a registered task explicitly. Values are validated before activation. |
| `deactivate()` | `void` | No | — | Clears the active guide and suppresses immediate auto-start for the current context. |
| `command(command)` | `boolean` | No | — | Forwards a guide command to the active registration's onCommand handler. Returns false when nobody accepted it. |
| `views()` | `readonly GuidedTaskView[]` | No | — | Compact read-only descriptions of every currently available task. |
| `refresh()` | `void` | No | — | Notifies subscribers that live page state or a task snapshot changed. |
| `subscribe(listener)` | `() => void` | No | — | Subscribes to availability, activation, and active controller snapshot changes. The returned function unsubscribes. |
| `destroy()` | `void` | No | — | Unregisters the model action, clears subscriptions, and releases controller registrations owned by this catalog. |

**Example 1 · Read the active task instead of keeping a second UI store**

```ts
const current = catalog.active();
if (current?.guide) {
  renderGuide(current.guide, current.state);
}

const task = catalog.activate("course.create", {
  values: { name: "瑜伽基础" },
});
console.log(task.startedBy); // "page"
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-guidedtaskregistration"></a>

### `GuidedTaskRegistration`

One catalog entry: an executable definition, an optional guide, the route and scopes that make it available, whether an explicit run survives context changes, live state, and lifecycle hooks.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface GuidedTaskRegistration {
  id?: string;
  definition: TaskDefinition;
  guide?: TaskGuideDefinition;
  controller?: TaskController;
  route?: GuidedTaskRoute;
  scope?: string | readonly string[];
  autoStart?: boolean;
  keepActive?: boolean;
  initialValues?: TaskValues | (() => TaskValues);
  binding?: TaskBinding | (() => TaskBinding);
  state?: () => TaskGuideState;
  onActivate?: (task: ActiveGuidedTask) => void | Promise<void>;
  onDeactivate?: (task: ActiveGuidedTask) => void;
  onCommand?: (command: TaskGuideCommand, task: ActiveGuidedTask) => void | Promise<void>;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | No | — | Registration id. Defaults to definition.id and must match it when supplied. |
| `definition` | `TaskDefinition` | Yes | — | The executable half: fields, actions, rules, and optional confirmation. |
| `guide` | `TaskGuideDefinition` | No | — | The human-facing half. Omit it for a task that runs without a built-in guide. |
| `controller` | `TaskController` | No | — | Owns the running snapshot. When supplied during define(), the catalog also registers the definition with it. |
| `route` | `GuidedTaskRoute` | No | — | Exact path, route name, list of accepted routes, or predicate. Omit for every route. |
| `scope` | `string \| readonly string[]` | No | — | All listed scene scopes must be active for the task to become available. |
| `autoStart` | `boolean` | No | `false` | Activates the guide when route and scope match. Only one automatic task is chosen, in registration order. |
| `keepActive` | `boolean` | No | `false` | Keeps an explicitly started task active while its route or scope temporarily stops matching. `deactivate()` still ends it. |
| `initialValues` | `TaskValues \| (() => TaskValues)` | No | — | Values loaded before an automatic or explicit run starts. |
| `binding` | `TaskBinding \| (() => TaskBinding)` | No | — | Page facts such as the selected record. Use a function when the selection can change. |
| `state` | `() => TaskGuideState` | No | — | Live render state. When snapshot is omitted, the controller snapshot is used. |
| `onActivate` | `(task) => void \| Promise<void>` | No | — | Called after activation; use it to sync the business form, open a dialog, or point at a field. |
| `onDeactivate` | `(task) => void` | No | — | Called when the run stops being active. |
| `onCommand` | `(command, task) => void \| Promise<void>` | No | — | Receives business command names emitted by guide buttons. |

**Example 1 · Register the task only while its form scope is visible**

```ts
catalog.define({
  definition: courseDefinition,
  guide: courseGuide,
  controller,
  route: "/courses/new",
  scope: "create-course-form",
  autoStart: true,
  initialValues: () => currentDraft.value,
  state: () => ({ step: currentStep.value, busy: saving.value }),
  onActivate: (task) => applyTaskValues(task.state.snapshot?.values),
  onCommand: (command) => runCourseCommand(command),
});
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-guidedtaskactivationoptions"></a>

### `GuidedTaskActivationOptions`

Optional values already supplied before activation. Unknown fields are rejected before the active state changes.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface GuidedTaskActivationOptions {
  values?: TaskValues;
  startedBy?: "page" | "agent";
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `values` | `TaskValues` | No | — | Values already supplied by the user or caller. Only field names declared by the definition are accepted. |
| `startedBy` | `"page" \| "agent"` | No | `"page"` | Records whether the page or the model opened the run. Model action calls set this to agent. |

**Example 1 · Activate with previously spoken values**

```ts
catalog.activate("course.create", {
  values: { name: "瑜伽基础", teacherId: "teacher_18" },
  startedBy: "agent",
});
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-activeguidedtask"></a>

### `ActiveGuidedTask`

The one task currently presented to the user: definition, optional guide, optional controller, live render state, and whether the page or the model opened it.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface ActiveGuidedTask {
  id: string;
  definition: TaskDefinition;
  guide?: TaskGuideDefinition;
  controller?: TaskController;
  state: TaskGuideState;
  startedBy: "page" | "agent";
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | No | — | Stable task id. |
| `definition` | `TaskDefinition` | No | — | The executable definition resolved for this run. |
| `guide` | `TaskGuideDefinition` | No | — | The guide currently being rendered, when the registration has one. |
| `controller` | `TaskController` | No | — | The controller that owns the snapshot, when supplied. |
| `state` | `TaskGuideState` | No | — | Live state returned by the registration at read time. |
| `startedBy` | `"page" \| "agent"` | No | — | Whether page context or the model opened this run. |

**Example 1 · Render whichever guide is currently active**

```ts
const active = catalog.active();
if (active?.guide) {
  const { snapshot, step, busy, error, completed } = active.state;
  renderGuide(active.guide, { snapshot, step, busy, error, completed });
}
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskguidedefinition"></a>

### `TaskGuideDefinition`

The human-facing half of a task: welcome copy, ordered steps, read-only summaries, button commands, completion copy, and handoff points.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskGuideDefinition {
  taskId: string;
  title: string;
  welcome?: string;
  footer?: string;
  cancel?: TaskGuideAction;
  stepSubtitle?: string;
  avatar?: string;
  labels?: TaskGuideLabels;
  fields?: TaskGuideFields;
  steps: readonly TaskGuideStep[];
  done?: TaskGuideDone;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `taskId` | `string` | Yes | — | Must match the id of the task definition this guide explains. |
| `title` | `string` | Yes | — | Heading for the guide card. |
| `welcome` | `string` | No | — | Introductory sentence shown before the step rail. |
| `footer` | `string` | No | — | Small note under the guide body, such as a safety or timing hint. |
| `cancel` | `TaskGuideAction` | No | — | Optional header action that lets the person leave the task. The renderer emits the command; the page decides how to end the run. |
| `stepSubtitle` | `string` | No | — | Subtitle template supporting {step} and {total}. |
| `avatar` | `string` | No | — | Short avatar text or initials used by the built-in renderer. |
| `labels` | `TaskGuideLabels` | No | — | Overrides for running, completed, current, done, pending, skipped, and error labels. |
| `fields` | `TaskGuideFields` | No | — | Compact field list resolved from page state or the latest snapshot. The built-in renderer uses it for the horizontal progress rail; skip it for a full step card. |
| `steps` | `readonly TaskGuideStep[]` | Yes | — | Ordered human-facing steps. At least one is required by the contract. |
| `done` | `TaskGuideDone` | No | — | Final state copy and optional follow-up commands. |

**Example 1 · Describe the same task to a person**

```ts
const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "新建课程",
  welcome: "我会陪你确认课程信息，并填入右侧表单。",
  stepSubtitle: "第 {step} 步，共 {total} 步",
  steps: courseSteps,
  done: {
    title: "课程已创建",
    description: "列表里的第一条就是新课程。",
  },
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskguidefield"></a>

### `TaskGuideField`

One node in the compact field rail. It reports which values are filled, suggested, or explicitly skipped, and emits `focus-<field>` unless the business supplies another command.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskGuideField {
  field: string;
  label: string;
  required?: boolean;
  filled?: boolean;
  skipped?: boolean;
  suggested?: boolean;
  command?: string;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `field` | `string` | Yes | — | Stable field id used by the page and by the default `focus-<field>` command. |
| `label` | `string` | Yes | — | Human-readable field name shown in the rail. |
| `required` | `boolean` | No | `false` | Whether the task cannot complete without this value. |
| `filled` | `boolean` | No | `false` | Whether the page already holds a value for this field. |
| `skipped` | `boolean` | No | `false` | Whether the person explicitly skipped this optional field. The rail marks it with a dash and the skipped label. |
| `suggested` | `boolean` | No | `false` | Whether a recommendation exists but has not been written to the page. |
| `command` | `string` | No | — | Overrides the default `focus-<field>` command emitted when the node is clicked. |

**Example 1 · Expose progress without turning the rail into another form**

```ts
const fields = [
  { field: "name", label: "课程名称", required: true, filled: true },
  { field: "note", label: "约课须知", skipped: true },
  { field: "cover", label: "课程封面", required: true, suggested: false },
];
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskguidestep"></a>

### `TaskGuideStep`

One guided step. It can show read-only rows, point a person at the page, or emit a business-owned command without gaining a second execution path.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskGuideStep {
  id: string;
  label: string;
  title: string;
  description: string;
  rowsTitle?: string | ((snapshot: TaskRunSnapshot | null) => string);
  rows?: TaskGuideRows;
  handoff?: TaskGuideHandoff;
  primary?: TaskGuideAction;
  secondary?: TaskGuideAction;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | No | — | Stable step id used by the page to restore progress. |
| `label` | `string` | No | — | Short label in the step rail. |
| `title` | `string` | No | — | Step heading in the detail card. |
| `description` | `string` | No | — | Explanation of what is happening or what the person should do next. |
| `rowsTitle` | `string \| (snapshot) => string` | No | — | Optional heading above a read-only summary. |
| `rows` | `TaskGuideRows` | No | — | Read-only rows resolved from the current task snapshot. |
| `handoff` | `TaskGuideHandoff` | No | — | Copy that explains a point where the person must act on the page. |
| `primary` | `TaskGuideAction` | No | — | Primary business command shown on this step. |
| `secondary` | `TaskGuideAction` | No | — | Optional secondary command such as back or skip. |

**Example 1 · Point at an existing form field**

```ts
const step: TaskGuideStep = {
  id: "name",
  label: "课程名称",
  title: "先填写课程名称",
  description: "我已经定位到右侧的名称输入框。",
  handoff: { title: "由你确认名称", description: "填写后回到对话，我会继续检查。" },
  primary: { label: "我已填好", command: "name.done" },
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskguideaction"></a>

### `TaskGuideAction`

A guide button label plus a business-owned command name. The renderer forwards the command and never guesses what it means.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskGuideAction {
  label: string;
  command: string;
  busyLabel?: string;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `label` | `string` | No | — | Button text shown to the user. |
| `command` | `string` | No | — | Business-owned command name forwarded to onCommand. The renderer does not interpret it. |
| `busyLabel` | `string` | No | — | Optional button text while the command is running. |

**Example 1 · Use a command instead of a second action path**

```ts
const save: TaskGuideAction = {
  label: "保存并继续",
  busyLabel: "正在保存…",
  command: "course.save",
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskguiderow"></a>

### `TaskGuideRow`

One read-only summary row. It can distinguish an existing page value from a suggestion that has not been written yet, and can carry a row-level business command.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskGuideRow {
  label: string;
  value: TaskGuideRowValue;
  format?: TaskGuideRowFormat;
  status?: TaskGuideRowStatus;
  badge?: string;
  note?: string;
  action?: TaskGuideAction;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `label` | `string` | Yes | — | Left-hand label, such as a field or business fact. |
| `value` | `string \| number \| boolean \| null \| undefined` | Yes | — | The value to display. The renderer formats it; it never edits the page. |
| `format` | `"text" \| "stars" \| "check" \| "number"` | No | `"text"` | Display hint. `stars` renders a 1–5 rating and `check` renders a selected/not-selected mark. |
| `status` | `"current" \| "suggested" \| "missing"` | No | — | Where the value came from: already in the page, a suggestion not yet written, or still missing. |
| `badge` | `string` | No | — | Short business-owned badge such as “In page”, “Suggested”, or “Needs input”. |
| `note` | `string` | No | — | Provenance or helper text shown under the label. Use it to explain a suggestion, not to repeat the value. |
| `action` | `TaskGuideAction` | No | — | Optional row-level command, usually “Use suggestion” or “Locate field”. It uses the same onCommand path as every other command. |

**Example 1 · Show a suggestion without pretending it is the page value**

```ts
const row: TaskGuideRow = {
  label: "课程名称",
  value: "瑜伽基础",
  status: "suggested",
  badge: "建议",
  note: "来自示例模板，尚未写入页面",
  action: { label: "采用", command: "apply-name" },
};
```

**Example 2 · Show a value that already exists in the page**

```ts
const row: TaskGuideRow = {
  label: "授课老师",
  value: "周敏",
  status: "current",
  badge: "已填入",
  action: { label: "定位", command: "focus-teacher" },
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskguidedone"></a>

### `TaskGuideDone`

The completion state shown after the task succeeds, including a final summary and optional follow-up commands.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskGuideDone {
  title: string | ((snapshot: TaskRunSnapshot | null) => string);
  description: string | ((snapshot: TaskRunSnapshot | null) => string);
  rows?: TaskGuideRows;
  actions?: readonly TaskGuideAction[];
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | `string \| (snapshot) => string` | No | — | Completion heading, optionally derived from the final snapshot. |
| `description` | `string \| (snapshot) => string` | No | — | Completion detail that explains what changed. |
| `rows` | `TaskGuideRows` | No | — | Final read-only summary rows. |
| `actions` | `readonly TaskGuideAction[]` | No | — | Follow-up business commands available after completion. |

**Example 1 · Show the created record as the result**

```ts
const done: TaskGuideDone = {
  title: "课程已创建",
  description: (snapshot) => "已创建：" + (snapshot?.values.name ?? "新课程"),
  actions: [{ label: "继续添加老师", command: "teacher.add" }],
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskguidecommand"></a>

### `TaskGuideCommand`

A command emitted by the guide, with the step and completion context the page needs to decide what to do next.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskGuideCommand {
  action: TaskGuideAction;
  step: TaskGuideStep | null;
  stepIndex: number;
  done: boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `action` | `TaskGuideAction` | No | — | The button definition that emitted the command. |
| `step` | `TaskGuideStep \| null` | No | — | The step that was active, or null when the command came from the completion card. |
| `stepIndex` | `number` | No | — | Zero-based index of the active step. The value is -1 for a completion action. |
| `done` | `boolean` | No | — | Whether the command came from the completion state. |

**Example 1 · Route guide commands in the page**

```ts
function onCommand(command: TaskGuideCommand): void {
  if (command.done) return finishCourseFlow(command.action.command);
  if (command.action.command === "name.done") pointAtTeacherField();
}
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskguidestate"></a>

### `TaskGuideState`

Live render state returned by a registration: the task snapshot, current step, busy state, error, and completion flag.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskGuideState {
  snapshot?: TaskRunSnapshot | null;
  step?: number;
  busy?: boolean;
  error?: string;
  completed?: boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `snapshot` | `TaskRunSnapshot \| null` | No | — | Current task run. Omit it to let the catalog read controller.snapshot(). |
| `step` | `number` | No | `1` | One-based active guide step. |
| `busy` | `boolean` | No | `false` | Whether the page is currently completing the step. |
| `error` | `string` | No | — | Business-facing error to keep next to the guide. |
| `completed` | `boolean` | No | `false` | Switches the guide to its completion state. |

**Example 1 · Expose live page state without duplicating it**

```ts
state: () => ({
  snapshot: controller.snapshot(),
  step: currentStep.value,
  busy: saving.value,
  error: error.value,
  completed: saved.value,
})
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-guidedtaskview"></a>

### `GuidedTaskView`

A compact, read-only task description for model context and task lists. It is derived from the definition and optional guide.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface GuidedTaskView {
  id: string;
  title: string;
  description?: string;
  examples?: readonly string[];
  guideTitle?: string;
  stepTitles?: readonly string[];
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | No | — | Task id. |
| `title` | `string` | No | — | Human-facing task title. |
| `description` | `string` | No | — | What the task does and when to choose it. |
| `examples` | `readonly string[]` | No | — | Example requests for this task. |
| `guideTitle` | `string` | No | — | Title of the optional guide. |
| `stepTitles` | `readonly string[]` | No | — | Ordered guide step titles for compact context. |

**Example 1 · Build a compact task picker**

```ts
for (const task of catalog.views()) {
  console.log(task.id, task.title, task.stepTitles?.length ?? 0);
}
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskdefinition"></a>

### `TaskDefinition`

A guided task as a goal, constraints, success criteria, working-memory fields, and optional deterministic steps or an agent prompt.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskDefinition {
  id: string;
  title: string;
  description?: string;
  objective?: string;
  constraints?: readonly string[];
  successCriteria?: readonly string[];
  requiresRecord?: boolean;
  examples?: readonly string[];
  fields?: readonly TaskField[];
  risk?: Kind;
  steps?: readonly TaskStep[];
  prompt?: string | ((values: TaskValues) => string);
  confirm?: boolean | "always";
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Stable task id, unique inside one controller. |
| `title` | `string` | Yes | — | Human-facing task name shown on the task card. |
| `description` | `string` | No | — | What the task does and when a user should choose it. |
| `objective` | `string` | No | — | The outcome the task is trying to achieve. This is the goal the assistant reasons about, not a step list. |
| `constraints` | `readonly string[]` | No | — | Boundaries the assistant must respect while helping, such as page-only uploads or mandatory read-back verification. |
| `successCriteria` | `readonly string[]` | No | — | Observable conditions that mean the task is genuinely complete. |
| `requiresRecord` | `boolean` | No | `false` | When true, start() requires a record supplied by the page. Generic task lists should treat the task as an entry point opened from a row or detail page. |
| `examples` | `readonly string[]` | No | — | Example requests shown on the card. Clicking one fills the form; it does not execute a write. |
| `fields` | `readonly TaskField[]` | No | — | Current working memory and decisions that may require a person. Missing required fields do not prescribe a scripted order. |
| `risk` | `"read" \| "write" \| "danger"` | No | — | Task-level risk hint. The underlying action still owns enforcement. |
| `steps` | `readonly TaskStep[]` | No | — | Deterministic business action calls. They execute the write; they do not control the conversation's next question. |
| `prompt` | `string \| ((values) => string)` | No | — | Agent-mode template. Required when steps is absent. |
| `confirm` | `boolean \| "always"` | No | — | Task-level confirmation preference; action policy remains authoritative. |

**Example 1 · Describe a task without duplicating the executor**

```ts
const task: TaskDefinition = {
  id: "teacher.create",
  title: "新增老师",
  description: "创建老师，并可选地为他安排第一节课。",
  fields: [
    { name: "name", label: "姓名" },
    { name: "phone", label: "手机号", type: "text" },
  ],
  steps: [{
    label: "创建老师",
    action: "create_teacher",
    args: (values) => ({ name: values.name, phone: values.phone }),
  }],
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskbinding"></a>

### `TaskBinding`

Page facts supplied when a task starts. They are separate from user-editable values so a record id never becomes a form field.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskBinding {
  record?: TaskRecordBinding;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `record` | `TaskRecordBinding` | No | — | The record selected by the host before the task opens. It is a page fact, not a form field. |

**Example 1 · Bind a lesson row to its task**

```ts
panel.open("lesson.note", {}, {
  record: { id: "lesson_42", label: "瑜伽基础 · 2026-03-16 10:00" },
});
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskrecordbinding"></a>

### `TaskRecordBinding`

The record already selected by the page, such as a lesson row or a detail page. The task uses its id but does not ask the user to type it.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskRecordBinding {
  id: string;
  label?: string;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Stable reference accepted by the existing business actions. It should identify the same record the user selected on the page. |
| `label` | `string` | No | — | Human-facing label used for diagnostics and optional task headers. |

**Example 1 · Use the bound id without asking for it**

```ts
const updateNote: TaskStep = {
  label: "保存备注",
  action: "update_lesson_note",
  args: (values, binding) => ({
    lessonId: binding.record?.id,
    note: values.note,
  }),
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskfield"></a>

### `TaskField`

One item in task working memory: a decision the user may need to make, a recommendation, or a page-only value the agent cannot write.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "boolean" | "date" | "select" | "lookup";
  optional?: boolean;
  placeholder?: string;
  help?: string;
  defaultValue?: TaskValue;
  values?: readonly TaskChoice[];
  recommended?: TaskValue;
  lookup?: TaskLookup;
  searchAction?: string;
  minChars?: number;
  agentWritable?: boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `name` | `string` | Yes | — | Key used in values and step argument functions. |
| `label` | `string` | Yes | — | Label shown to the user. |
| `type` | `"text" \| "textarea" \| "number" \| "boolean" \| "date" \| "select" \| "lookup"` | No | `"text"` | Input control. Defaults to text. |
| `optional` | `boolean` | No | `false` | Allows an empty value. Fields are required by default. |
| `placeholder` | `string` | No | — | Input placeholder or select prompt. |
| `help` | `string` | No | — | Short explanation shown next to the field. |
| `defaultValue` | `TaskValue` | No | — | Initial value when a run starts. |
| `values` | `readonly TaskChoice[]` | No | — | Small closed choice set for select fields. |
| `recommended` | `TaskValue` | No | — | A suggestion the model may use only when the person explicitly delegates this choice. It is not written automatically. |
| `lookup` | `TaskLookup` | No | — | Async search for a large collection. UI and agent tooling should share this function. |
| `searchAction` | `string` | No | — | Action id exposed to the model for this lookup. Defaults to `search_<name>`; reuse one id when several tasks share a search implementation. |
| `minChars` | `number` | No | `1` | Minimum query length before lookup runs. Values below one are clamped to one. |
| `agentWritable` | `boolean` | No | `true` | Whether the model may write this field through the task update action. Set false for page-owned values such as an upload, signature, or one-time code. |

**Example 1 · Distinguish two students with the same name**

```ts
const studentField: TaskField = {
  name: "studentRef",
  label: "学员",
  type: "lookup",
  minChars: 2,
  lookup: async (query) => api.searchStudents(query).then((rows) => rows.map((row) => ({
    value: row.id,
    label: row.name,
    description: row.phoneMasked,
  }))),
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-tasklookup"></a>

### `TaskLookup`

The search implementation shared by the task UI and the automatically registered search action.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
type TaskLookup = (query: string, context: TaskLookupContext) => Promise<readonly TaskChoice[]> | readonly TaskChoice[]
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `query` | `string` | No | — | Text entered by the user or sent by the model. |
| `context` | `TaskLookupContext` | No | — | Optional cancellation context for asynchronous searches. |

**Example 1 · One search implementation for UI and model**

```ts
const lookupStudents: TaskLookup = async (query, { signal }) => {
  const rows = await api.searchStudents(query, { signal });
  return rows.map((row) => ({ value: row.id, label: row.name, description: row.phoneMasked }));
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-tasklookupcontext"></a>

### `TaskLookupContext`

Optional cancellation signal for an asynchronous lookup.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskLookupContext {
  signal?: AbortSignal;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `signal` | `AbortSignal` | No | — | Aborted when the user closes the panel or a newer query replaces this one. |

**Example 1 · Respect cancellation in an async lookup**

```ts
const lookup: TaskLookup = async (query, context) => {
  const response = await fetch("/api/students?q=" + encodeURIComponent(query), {
    signal: context.signal,
  });
  return response.json();
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskstep"></a>

### `TaskStep`

One existing action call in a deterministic task. Arguments can be static, come from collected values, or use the record selected before the task opened.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskStep {
  id?: string;
  label: string;
  summary?: string;
  action: string;
  args?: Record<string, unknown> | ((values: TaskValues, binding: TaskBinding) => Record<string, unknown>);
  optional?: boolean;
  handoff?: boolean | string;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | No | — | Stable step id. Defaults to its 1-based index. |
| `label` | `string` | Yes | — | Human-facing step name. |
| `summary` | `string` | No | — | Why the step exists or what it checks. |
| `action` | `string` | Yes | — | Registered action or governed business operation id. |
| `args` | `object \| ((values, binding) => object)` | No | — | Static arguments, a template from collected values, or a function that also reads the bound record. |
| `optional` | `boolean` | No | `false` | When true, a failure becomes skipped and later steps continue. |
| `handoff` | `boolean \| string` | No | — | Marks this step as human work. The run waits for handoff and the host performs the actual verification. |

**Example 1 · Check before writing**

```ts
const steps: TaskStep[] = [
  { label: "检查时段", action: "check_slot", args: (values) => ({ slot: values.slot }) },
  { label: "创建课程", action: "create_lesson", args: (values) => ({ slot: values.slot }) },
];
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskstepsnapshot"></a>

### `TaskStepSnapshot`

One rendered step: its action, status, optional handoff marker, failure, and result.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskStepSnapshot {
  index: number;
  id: string;
  label: string;
  summary?: string;
  action: string;
  status: "pending" | "running" | "ok" | "skipped" | "failed";
  optional: boolean;
  handoff?: boolean | string;
  error?: TaskRunError;
  result?: unknown;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `index` | `number` | No | — | 1-based position in the step list. |
| `id` | `string` | No | — | Stable step id, generated from the index when omitted. |
| `label` | `string` | No | — | Human-facing step name. |
| `summary` | `string` | No | — | Why the step exists or what it checks. |
| `action` | `string` | No | — | Action id this step invoked or will invoke. |
| `status` | `"pending" \| "running" \| "ok" \| "skipped" \| "failed"` | No | — | Current step state. |
| `optional` | `boolean` | No | — | Whether a failure is allowed to continue. |
| `handoff` | `boolean \| string` | No | — | Present when the step must be completed by a person. |
| `error` | `TaskRunError` | No | — | Failure code and message for a failed or skipped step. |
| `result` | `unknown` | No | — | Opaque value returned by the execution bridge. |

**Example 1 · Render progress without inventing state**

```ts
for (const step of snapshot.steps) {
  row.dataset.status = step.status;
  row.textContent = step.index + ". " + step.label;
  if (step.error) note.textContent = step.error.message;
}
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskrunstatus"></a>

### `TaskRunStatus`

The run lifecycle. planned, running, and verifying separate an approved plan, active work, and the check after an action returns.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
type TaskRunStatus = "collecting" | "ready" | "planned" | "running" | "waiting" | "verifying" | "done" | "failed" | "cancelled"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `collecting` | `"collecting"` | No | — | Required values are still missing. |
| `ready` | `"ready"` | No | — | Values are complete; execution has not started. |
| `planned` | `"planned"` | No | — | The plan is fixed and visible; a task-level confirmation may still be pending. |
| `running` | `"running"` | No | — | A step is in progress. |
| `waiting` | `"waiting"` | No | — | Waiting for confirmation or a human handoff. Check waitingFor. |
| `verifying` | `"verifying"` | No | — | An action returned and the host is checking the result. It is not a repeated running state. |
| `done` | `"done"` | No | — | All required steps completed. |
| `failed` | `"failed"` | No | — | A required step failed. |
| `cancelled` | `"cancelled"` | No | — | The user or a new run cancelled this run. |

**Example 1 · Handle waiting without guessing**

```ts
if (snapshot.status === "waiting") {
  showPrompt(snapshot.waitingFor === "confirmation"
    ? "Review the plan, then confirm."
    : "Complete this step in the page.");
}
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskwaitingfor"></a>

### `TaskWaitingFor`

Why a run is waiting: a task-level confirmation, or a step the user must complete in person.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
type TaskWaitingFor = "confirmation" | "handoff"
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `confirmation` | `"confirmation"` | No | — | A task-level confirmation is pending. Call confirm() after the user approves. |
| `handoff` | `"handoff"` | No | — | The user must complete the step in the page. The host verifies the result. |

**Example 1 · Distinguish two kinds of waiting**

```ts
switch (snapshot.waitingFor) {
  case "confirmation": return renderConfirm(snapshot);
  case "handoff": return renderHandoff(snapshot.steps.find((step) => step.status === "running"));
  default: return renderProgress(snapshot);
}
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskruncontext"></a>

### `TaskRunContext`

Context passed to invoke and to the optional progress reporter. report() can mark a long step as verifying or waiting for handoff.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskRunContext {
  taskId: string;
  values: TaskValues;
  binding: TaskBinding;
  signal: AbortSignal;
  report(status: "running" | "waiting" | "verifying", waitingFor?: TaskWaitingFor): void;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `taskId` | `string` | No | — | Definition id of the active run. |
| `values` | `TaskValues` | No | — | Snapshot of collected values, copied before invoke. |
| `binding` | `TaskBinding` | No | — | Snapshot of page facts supplied when the run started. |
| `signal` | `AbortSignal` | No | — | Aborted when the run is cancelled or replaced. |
| `report` | `(status, waitingFor?) => void` | No | — | Marks a long step as running, waiting, or verifying. Stale runs ignore it. |

**Example 1 · Report a handoff from a long-running bridge**

```ts
const invoke: TaskInvoke = async (action, args, context) => {
  if (action === "confirm_payment") context.report("waiting", "handoff");
  return executor.execute(action, JSON.stringify(args), { signal: context.signal });
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskrunsnapshot"></a>

### `TaskRunSnapshot`

The complete render state of one task run: values, bound page record, status, step progress, prompt, confirmation, error, and timestamps.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskRunSnapshot {
  taskId: string;
  title: string;
  mode: TaskMode;
  status: TaskRunStatus;
  fields: readonly TaskField[];
  values: TaskValues;
  binding?: TaskBinding;
  steps: readonly TaskStepSnapshot[];
  prompt?: string;
  waitingFor?: TaskWaitingFor;
  confirmation?: { required: true; confirmed: boolean };
  error?: TaskRunError;
  startedAt?: number;
  finishedAt?: number;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `taskId` | `string` | No | — | Definition id for this run. |
| `status` | `TaskRunStatus` | No | — | The current run state, including planned and verifying. |
| `values` | `TaskValues` | No | — | Current field values. Treat them as user input, not trusted server facts. |
| `binding` | `TaskBinding` | No | — | Present when the host supplied a page record or other binding at start(). |
| `steps` | `readonly TaskStepSnapshot[]` | No | — | Per-step status, human-readable error, and returned result. |
| `prompt` | `string` | No | — | Agent-mode prompt generated from values. |
| `waitingFor` | `TaskWaitingFor` | No | — | Present while status is waiting: confirmation or handoff. |
| `confirmation` | `{ required: true; confirmed: boolean }` | No | — | Present when the definition asks for task-level confirmation. |
| `error` | `TaskRunError` | No | — | Failure code and message when the run or a required step fails. |
| `startedAt` | `number` | No | — | Millisecond timestamp from the injected clock. |
| `finishedAt` | `number` | No | — | Present after completion, failure, or cancellation. |

**Example 1 · Render from one snapshot**

```ts
controller.subscribe((snapshot) => {
  progress.textContent = snapshot.status;
  for (const step of snapshot.steps) {
    renderStep(step.label, step.status, step.error?.message);
  }
});
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskcontroller"></a>

### `TaskController`

Registers definitions and owns one active run. Start another task to cancel the previous run.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskController {
  register(definition: TaskDefinition): () => void;
  get(id: string): TaskDefinition | undefined;
  list(): readonly TaskDefinition[];
  start(id: string, values?: TaskValues, binding?: TaskBinding): TaskRunSnapshot;
  setValue(name: string, value: TaskValue): TaskRunSnapshot;
  plan(): TaskRunSnapshot;
  confirm(): TaskRunSnapshot;
  run(): Promise<TaskRunSnapshot>;
  cancel(): TaskRunSnapshot;
  reset(): void;
  snapshot(): TaskRunSnapshot | null;
  subscribe(listener: (snapshot: TaskRunSnapshot) => void): () => void;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `register` | `(definition) => () => void` | No | — | Adds a definition and returns its unregister function. Duplicate ids throw. |
| `start` | `(id, values?, binding?) => TaskRunSnapshot` | No | — | Starts a run, applies defaults, records page bindings, and cancels the previous active run. Throws when requiresRecord is true and no record id is supplied. |
| `setValue` | `(name, value) => TaskRunSnapshot` | No | — | Updates a field while collecting or ready. Mutating after execution throws. |
| `plan` | `() => TaskRunSnapshot` | No | — | Freezes the current values into planned state without invoking the bridge. Missing fields return TASK_FIELDS_REQUIRED. |
| `confirm` | `() => TaskRunSnapshot` | No | — | Completes a pending task-level confirmation. Throws when the run is not waiting for confirmation. |
| `run` | `() => Promise<TaskRunSnapshot>` | No | — | Executes fixed steps or returns the agent-mode prompt. |
| `cancel` | `() => TaskRunSnapshot` | No | — | Aborts the active step and marks the run cancelled. |
| `subscribe` | `(listener) => () => void` | No | — | Receives a snapshot after every state transition. |

**Example 1 · Collect fields, then run**

```ts
controller.start("student.cards");
controller.setValue("studentRef", "stu_1");
controller.plan();
const run = await controller.run();
if (run.error?.code === "TASK_FIELDS_REQUIRED") showMissingFields(run);
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskchoice"></a>

### `TaskChoice`

A selectable reference. The value is what the action needs; the label and description are what the user sees.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
interface TaskChoice {
  value: string;
  label: string;
  description?: string;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `value` | `string` | Yes | — | Stable reference passed to the action, such as a student id. |
| `label` | `string` | Yes | — | Name shown to the user and offered to the model. |
| `description` | `string` | No | — | Optional detail that separates duplicate names, such as a masked phone number. |

**Example 1 · A duplicate-safe choice**

```ts
const choice: TaskChoice = {
  value: "stu_2",
  label: "李娜",
  description: "139****5678 · 最近上课 10 月 18 日",
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-quicktask"></a>

### `QuickTask`

The structured form of a recommended task button; a plain string remains the one-line shorthand.

**Imports**

`@plingjs/ui`

**Signature**

```ts
// Vue 2.7
interface QuickTask {
  label: string;
  prompt: string;
  description?: string;
  disabled?: boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `label` | `string` | Yes | — | Short label shown on the assistant surface. |
| `prompt` | `string` | Yes | — | Full prompt sent when the user presses the entry. |
| `description` | `string` | No | — | Optional explanation available on hover or to assistive technology. |
| `disabled` | `boolean` | No | `false` | Keeps the entry visible but temporarily unavailable. |

**Example 1 · Keep the button short and the prompt specific**

```ts
const quick: QuickTask[] = [{
  label: "标记第一条完成",
  prompt: "把第 1 条待办标记为完成，然后新增两条待办：买牛奶、整理书桌。",
  description: "会先完成第一条，再创建两条新待办。",
}];
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-quicktaskitem"></a>

### `QuickTaskItem`

A quick-task entry accepted by assistant surfaces: either a string prompt or a structured QuickTask.

**Imports**

`@plingjs/ui`

**Signature**

```ts
// Vue 2.7
type QuickTaskItem = string | QuickTask
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `item` | `string \| QuickTask` | No | — | A plain string keeps the one-line shorthand; an object supplies a separate label, prompt, and description. |

**Example 1 · Mix shorthand and structured entries**

```ts
const quick: QuickTaskItem[] = [
  "显示本周未完成的订单",
  { label: "整理今日待办", prompt: "检查今天的待办，把已完成的归档。" },
];
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-taskinvoke"></a>

### `TaskInvoke`

The host execution bridge. It should call the existing executor, Surface, or business service and may return void, { ok }, or ExecResult.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vue 2.7
type TaskInvoke = (action: string, args: Record<string, unknown>, context: TaskRunContext) => unknown | Promise<unknown>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `action` | `string` | No | — | Action id from the current step. |
| `args` | `Record<string, unknown>` | No | — | Resolved arguments for this invocation. |
| `context` | `TaskRunContext` | No | — | Task id, values, page binding, abort signal, and a report() function for long-running sub-states. |

**Example 1 · Adapt the task bridge to an executor**

```ts
const invoke: TaskInvoke = async (action, args, context) => {
  if (context.signal.aborted) throw new Error("Cancelled");
  return executor.execute(action, JSON.stringify(args));
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-createguideactions"></a>

### `createGuideActions`

Renders the compact guided-task action row used by every adapter. A short verb carries the action; a long recommendation becomes a one-line ellipsised preview with the full value in title and aria-label.

**Imports**

`@plingjs/dom`

**Signature**

```ts
// Vue 2.7
createGuideActions(options: GuideActionsOptions): GuideActions
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options.items` | `readonly GuideActionItem[]` | Yes | — | Actions to show, in order. The renderer never adds an implicit action. |
| `options.onCommand` | `(command: string) => void` | Yes | — | Receives the opaque command declared by the host. The renderer does not execute business logic. |
| `options.hint` | `string` | No | — | Optional line above the row, such as “Check once before saving”. Hidden when empty. |
| `options.ariaLabel` | `string` | No | — | Accessible name for the action group. Defaults to the localized “Task actions” catalog entry. |
| `options.locale` | `string` | No | — | Locale for framework-owned fallback labels. Business copy is never translated by the renderer. |

**Example 1 · Render a compact row with a long recommendation**

```ts
import { createGuideActions } from "@plingjs/dom";

const row = createGuideActions({
  ariaLabel: "Booking note actions",
  onCommand: (command) => runCourseCommand(command),
  items: [
    {
      id: "locate-note",
      label: "Point to the field",
      command: "focus-note",
      kind: "primary",
    },
    {
      id: "use-note",
      label: "Fill it in",
      preview: "Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
      ariaLabel: "Fill in booking notes: Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
      command: "apply-note",
      kind: "suggestion",
    },
    { id: "skip-note", label: "Skip", command: "skip-note", kind: "skip" },
  ],
});

document.querySelector("#course-actions")!.replaceChildren(row.element);
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-guideactionitem"></a>

### `GuideActionItem`

One action in the compact row: a short label, an opaque business command, an optional kind, and the long recommendation kept as a preview rather than a label.

**Imports**

`@plingjs/dom`

**Signature**

```ts
// Vue 2.7
interface GuideActionItem {
  id: string;
  label: string;
  command: string;
  kind?: "primary" | "secondary" | "suggestion" | "skip";
  preview?: string;
  ariaLabel?: string;
  disabled?: boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Stable id for tests and host bookkeeping. It is not sent to the model. |
| `label` | `string` | Yes | — | Short verb shown on the button, for example “Fill it in” or “Point to · Course name”. |
| `command` | `string` | Yes | — | Business-owned command emitted on click. The host decides what it means. |
| `kind` | `"primary" \| "secondary" \| "suggestion" \| "skip"` | No | — | Visual emphasis. A suggestion is the only kind that renders preview text. |
| `preview` | `string` | No | — | Long recommendation rendered as a single-line, ellipsised preview. The full value stays in title and aria-label. |
| `ariaLabel` | `string` | No | — | Accessible name when the visible label omits the field name or the preview is truncated. |
| `disabled` | `boolean` | No | — | Disables the action while a write is running. Disabled buttons never emit a command. |

**Example 1 · Keep the value out of the label**

```ts
{
  id: "use-note",
  label: "Fill it in",
  preview: "Please arrive 10 minutes early…",
  ariaLabel: "Fill in booking notes: Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
  command: "apply-note",
  kind: "suggestion",
}
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


## Version and compatibility

| Package | Version | Peer dependencies |
| --- | --- | --- |
| `@plingjs/vue` | `0.1.0-alpha.7` | `vue ^3` |
| `@plingjs/react` | `0.1.0-alpha.7` | `react >=16.3` |
| `@plingjs/vue2` | `0.1.0-alpha.7` | `vue ^2.7.0` |
| `@plingjs/vanilla` | `0.1.0-alpha.7` | — |

| Item | Value |
| --- | --- |
| Introduced | `0.1.0-alpha.2` |
| Stability | Pre-1.0 alpha; a minor release may change the API |

## Machine-readable copy

- [JSON for this page](/api-index/vue-2.json)
- [API overview JSON](/api-index.json)
