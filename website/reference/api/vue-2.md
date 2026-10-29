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
| `@plingjs/vue2` | vue ^2.7.0 | `0.1.0-alpha.3` |

The current package version is `0.1.0-alpha.3`; stability is **preview**. This is a pre-1.0 alpha, so a minor release may still change the API.

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

The DOM-first runtime used by Vanilla JS and Vue 2.7. It exposes tool, action, record, scope, state, dock, derived, and destroy.

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

- [JSON for this page](/api-index/vue-2.json)
- [API overview JSON](/api-index.json)
