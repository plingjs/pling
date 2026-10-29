---
title: "React API"
status: navigation
release: 0.1
locale: en
---
<!-- generated:api-index -->

# React API

The complete React surface: provider setup, declaration hooks, components, and the shared option types they use. Every signature below is the React form.

This page lists only `@plingjs/react` entry points, plus the shared-package types used with them.

[API overview](/reference/api/) · [Shared package API](/reference/api/shared)

| Package | Peer dependencies | Version |
| --- | --- | --- |
| `@plingjs/react` | react >=18 | `0.1.0-alpha.2` |

The current package version is `0.1.0-alpha.2`; stability is **preview**. This is a pre-1.0 alpha, so a minor release may still change the API.

## Minimal example

```ts
import { createPling, PlingProvider, AgentDock } from "@plingjs/react";

const pling = createPling({ namespace: "todo" });

<PlingProvider pling={pling}>
  <AgentDock />
</PlingProvider>;
```

## Entry and lifecycle

Create the application runtime, install the adapter, and release its observers.

| API | Kind | Reference |
| --- | --- | --- |
| [createPling](#api-createpling) | Function | [Reference](/reference/react-adapter) |
| [PlingProvider](#api-plingprovider) | Component | [Reference](/reference/react-adapter) |
| [usePling](#api-usepling) | Function | [Reference](/reference/react-adapter) |
| [usePlingUi](#api-useplingui) | Function | [Reference](/reference/react-adapter) |
| [PlingElement](#api-plingelement) | Interface | [Reference](/reference/react-adapter) |
| [pling.destroy](#api-destroy) | Method | [Reference](/reference/react-adapter) |

<a id="api-createpling"></a>

### `createPling`

Creates the application-level Pling instance and returns the adapter-specific runtime object.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
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

**Returns**

The adapter instance. Vue 3 and React return PlingElement; Vue 2.7 and Vanilla return VanillaPling.

**Defaults**

- No declaration means no action; derive is off by default.
- Presence is on by default.
- revealSensitive is true by default.

**Example 1 · React application setup**

```tsx
import { createRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";

const pling = createPling({ namespace: "todo" });

createRoot(document.getElementById("root")!).render(
  <PlingProvider pling={pling}>
    <App />
  </PlingProvider>,
);
```

**Example 2 · Route model calls through a same-origin gateway**

```tsx
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

[Open the corresponding reference](/reference/react-adapter)


<a id="api-plingprovider"></a>

### `PlingProvider`

Publishes a Pling instance to the React tree. Every React declaration hook reads from this provider.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
PlingProvider({ pling, children }: PlingProviderProps): ReactElement
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `pling` | `PlingElement` | Yes | — | Application runtime returned by createPling. |
| `children` | `ReactNode` | No | — | React subtree that can call Pling hooks and mount assistant components. |

**Example 1 · Scope the runtime to the React tree**

```tsx
const pling = createPling();

root.render(
  <PlingProvider pling={pling}>
    <App />
  </PlingProvider>,
);
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


<a id="api-usepling"></a>

### `usePling`

Reads the nearest Pling instance from the framework tree.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
usePling(): PlingElement
```

**Parameters**

None.

**Example 1 · Read the provider runtime**

```tsx
const pling = usePling();

const report = pling.inspectCoverage();
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


<a id="api-useplingui"></a>

### `usePlingUi`

Subscribes a React component to the shared locale, theme, CSS variables, and message snapshot.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
usePlingUi(): PlingUiSnapshot
```

**Parameters**

None.

**Example 1 · Re-render when locale or theme changes**

```tsx
function Toolbar() {
  const ui = usePlingUi();
  return <span>{ui.locale} · {ui.resolvedTheme}</span>;
}
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


<a id="api-plingelement"></a>

### `PlingElement`

The Vue 3 and React application runtime: registry, UI controller, page tracker, task routing, coverage, and cleanup.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
interface PlingElement {
  ui: PlingUiController;
  registry: Registry;
  feedback: FeedbackCollector;
  scopes: ScopeController;
  setActiveScopes(scopes: Iterable<string>): void;
  presence: PresenceController | null;
  derived(): DeriveController | null;
  task: PlingTaskController;
  ask(prompt: string, options?: PlingAskOptions): Promise<void>;
  inspectCoverage(root?: Element | null): CoverageReport;
  destroy(): void;
  warn(message: string): void;
  agent?: AgentSetup;
  revealSensitive: boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `ui` | `PlingUiController` | No | — | Locale, theme, catalog, and CSS-variable controller. |
| `registry` | `Registry` | No | — | Shared action, record, state, and feedback registry. |
| `feedback` | `FeedbackCollector` | No | — | Page-level feedback collector shared by the application. |
| `scopes` | `ScopeController` | No | — | Region visibility, viewport, and occlusion controller. |
| `setActiveScopes` | `(scopes: Iterable<string>) => void` | No | — | Manually replaces the active region set. |
| `presence` | `PresenceController \| null` | No | — | Target highlighting controller; null when presence is disabled. |
| `derived` | `() => DeriveController \| null` | No | — | Returns the optional L1 deriver. |
| `task` | `PlingTaskController` | No | — | Task routing controller used by built-in surfaces. |
| `ask` | `(prompt: string, options?: PlingAskOptions) => Promise<void>` | No | — | Routes a human-authored task to a mounted assistant surface. |
| `inspectCoverage` | `(root?: Element \| null) => CoverageReport` | No | — | Scans a root element for actionable controls without declarations. |
| `destroy` | `() => void` | No | — | Stops observers and releases declarations owned by this runtime. |
| `warn` | `(message: string) => void` | No | — | Emits a framework warning through the configured channel. |
| `agent` | `AgentSetup` | No | — | Application-level assistant wiring, when supplied to createPling. |
| `revealSensitive` | `boolean` | No | — | Whether the rendered chat restores sensitive tokens. |

**Example 1 · Inspect what the page exposes**

```tsx
const pling = createPling();

console.table(pling.inspectCoverage().targets);
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


<a id="api-destroy"></a>

### `pling.destroy`

Stops observers, derived actions, scopes, presence, UI subscriptions, and mounted assistant surfaces.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
pling.destroy(): void
```

**Parameters**

None.

**Example 1 · Release the runtime**

```tsx
useEffect(() => () => pling.destroy(), []);
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


## Page declarations

Declare actions, records, regions, state, feedback, task entrances, and sensitive values.

| API | Kind | Reference |
| --- | --- | --- |
| [Element action](#api-element-action) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Function-level action](#api-function-action) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Region](#api-region) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Record](#api-record) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Read-only state](#api-state) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [exposePlingState](#api-expose-state) | Function | [Reference](/reference/react-adapter) |
| [Page feedback](#api-feedback) | Declaration | [Reference](/reference/react-adapter) |
| [Task entrance](#api-task-entry) | Declaration | [Reference](/reference/react-adapter) |
| [Guide target](#api-guide-target) | Declaration | [Reference](/reference/react-adapter) |
| [sensitive](#api-sensitive) | Function | [Reference](/reference/core-declarations-actions-records-regions-state) |

<a id="api-element-action"></a>

### `Element action`

Declares what a control does. The description is the model's only explanation; execution still goes through availability, approval, and expectations.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
usePlingTool<T extends Element = HTMLElement>(options: PlingToolOptions): RefCallback<T>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options` | `PlingToolOptions` | Yes | — | The same fields as ToolOptions; the hook returns a ref callback to attach to the element. |

**Example 1 · Declare an element action**

```tsx
const addRef = usePlingTool({
  id: "add",
  desc: "添加一条待办",
  kind: "write",
  run: () => add(),
});

return <button ref={addRef}>添加</button>;
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-function-action"></a>

### `Function-level action`

Registers a business operation that has no dedicated DOM control.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
useAgentTool(options: AgentToolOptions): void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options` | `AgentToolOptions` | Yes | — | Id, description, risk, availability, parameters, expectation, and implementation. |

**Example 1 · Register an application action**

```tsx
useAgentTool({
  id: "clear_completed",
  desc: "清除所有已完成待办",
  kind: "write",
  run: () => clearCompleted(),
});
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-region"></a>

### `Region`

Declares a structural region and its reachability. Regions explain context; they are not permission boundaries.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
usePlingScope<T extends Element = HTMLElement>(options: PlingScopeOptions): RefCallback<T>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options` | `PlingScopeOptions` | Yes | — | Region id and optional model-facing metadata. |

**Example 1 · Describe a list region**

```tsx
const scopeRef = usePlingScope({ id: "todos", label: "待办列表", role: "list" });

return <section ref={scopeRef}>...</section>;
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-record"></a>

### `Record`

Gives one row a stable identity and a bounded set of readable fields. Records are read-only.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
usePlingRecord<T extends Element = HTMLElement>(value: RecordValue | null | undefined): RefCallback<T>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `value` | `RecordValue \| null \| undefined` | Yes | — | The row value. The hook returns a ref callback for the row element. |

**Example 1 · Expose a row**

```tsx
function TodoRow({ todo }: { todo: Todo }) {
  const recordRef = usePlingRecord({ data: todo, fields: { text: todo.text, done: todo.done } });
  return <li ref={recordRef}>{todo.text}</li>;
}
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-state"></a>

### `Read-only state`

Exposes a derived view of current UI state. State has no setter; writes must be declared as actions.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
usePlingState(key: string, source: PlingStateSource, options?: PlingStateOptions | string): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `key` | `string` | Yes | — | Stable state-view name used in page context and diagnostics. |
| `source` | `unknown \| (() => unknown) \| Ref<unknown> \| Record<string, unknown>` | Yes | — | A value, ref, or read function. Prefer a function so the snapshot reflects current state. |
| `options` | `StateOptions \| string` | No | — | A description object or a description string. Name the view and explain what it means. |

**Example 1 · Expose filters and counts**

```tsx
usePlingState("todo", () => ({
  filter,
  total: todos.length,
  remaining: todos.filter((todo) => !todo.done).length,
}), { description: "当前筛选与未完成数量" });
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-expose-state"></a>

### `exposePlingState`

Registers a read-only state view outside the React component tree. It returns an unregister function.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
exposePlingState(pling: Pick<PlingElement, "registry">, key: string, source: PlingStateSource, options?: PlingStateOptions | string): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `pling` | `Pick<PlingElement, "registry">` | Yes | — | Runtime or any object with the same registry property. |
| `key` | `string` | Yes | — | Stable state-view name. |
| `source` | `PlingStateSource` | Yes | — | Value or read function evaluated for each snapshot. |
| `options` | `PlingStateOptions \| string` | No | — | Model-facing description. |

**Example 1 · Expose state outside React**

```tsx
const off = exposePlingState(pling, "filters", () => ({
  status: store.getState().status,
  count: store.getState().visible.length,
}), { description: "列表筛选与可见条数" });
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


<a id="api-feedback"></a>

### `Page feedback`

Publishes user-visible feedback or a short page-level explanation without turning it into an action.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
usePlingFeedback(value: PlingFeedbackInput, options?: PlingFeedbackOptions): void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `value` | `PlingFeedbackInput` | Yes | — | Feedback value or array of values. |
| `options` | `PlingFeedbackOptions` | No | — | Fallback id and scope for the feedback declarations. |

**Example 1 · Expose a form error**

```tsx
usePlingFeedback(error ? { message: error, field: "email", severity: "error" } : null);
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


<a id="api-task-entry"></a>

### `Task entrance`

Routes a human-authored instruction to the mounted assistant. It is not exposed to the model as an action.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
pling.ask(prompt: string, options?: PlingAskOptions): Promise<void>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `prompt` | `string` | Yes | — | Natural-language task sent to the mounted assistant surface. |
| `options.surface` | `string` | No | — | Named surface id. Omit it when only one surface is mounted. |
| `options.source` | `Element` | No | — | Element that triggered the task, for custom hosts and diagnostics. |

**Example 1 · Route a human task**

```tsx
await pling.ask("整理今天的待办并标出最紧急的一项", { surface: "dock" });
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


<a id="api-guide-target"></a>

### `Guide target`

Highlights a non-action target while a person completes a handoff step.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
usePlingGuideTarget<T extends Element = HTMLElement>(id: string): RefCallback<T>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Guide target id referenced by a HandoffStep.highlight value. |

**Example 1 · Highlight a handoff target**

```tsx
const captchaRef = usePlingGuideTarget<HTMLInputElement>("captcha");

return <input ref={captchaRef} />;
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


<a id="api-sensitive"></a>

### `sensitive`

Marks a value for outbound masking, tokenization, or a hint while keeping the field name visible.

**Imports**

`@plingjs/core` · `@plingjs/react`

**Signature**

```ts
// React
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

<a id="api-tooloptions"></a>

### `ToolOptions`

The action declaration shape shared by every adapter.

**Imports**

`@plingjs/react` · `@plingjs/core`

**Signature**

```ts
// React
type PlingToolOptions = AtomicToolOptions | ParamsToolOptions
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

```tsx
const moveRef = usePlingTool({
  id: "move_task",
  desc: "把待办移动到指定位置",
  params: [{ name: "position", label: "新位置", type: "number", min: 1 }],
  run: ({ position }) => moveTask(Number(position)),
});
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-scopeoptions"></a>

### `ScopeOptions`

The region declaration shape. Vue 3 exposes the equivalent value as ScopeValue.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
interface PlingScopeOptions {
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
// React
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

`@plingjs/react`

**Signature**

```ts
// React
interface PlingStateOptions { description?: string }
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

`@plingjs/react`

**Signature**

```ts
// React
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
  agent: {
    config: { limits: { maxTurns: 12 } },
    trace: true,
    gate: () => true,
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
// React
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
// React
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

`@plingjs/react`

**Signature**

```ts
// React
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
// React
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
// React
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
// React
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
// React
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
// React
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
| [AgentDock](#api-agentdock) | Component | [Reference](/reference/react-adapter) |
| [AgentInline](#api-agentinline) | Component | [Reference](/reference/react-adapter) |
| [AgentChat](#api-agentchat) | Component | [Reference](/reference/react-adapter) |
| [AgentDebug](#api-agentdebug) | Component | [Reference](/reference/react-adapter) |

<a id="api-agentdock"></a>

### `AgentDock`

Floating or sidebar assistant surface. Owns placement, task registration, open state, and the activity view.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
<AgentDock />
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `className` | `string` | No | — | Extra class for the outer shell, commonly used for page-grid sizing. |
| `title` | `string` | No | — | Assistant title. Defaults to the localized catalog value. |
| `placeholder` | `string` | No | — | Composer placeholder. |
| `emptyHint` | `string` | No | — | Message shown before the first turn. |
| `quick` | `readonly string[]` | No | `[]` | Suggested prompts that remain available between runs. |
| `defaultOpen` | `boolean` | No | `false` | Whether the surface starts open. |
| `config` | `AgentConfigOverrides` | No | — | Overrides model and runtime settings for this surface only. |
| `llm` | `Llm` | No | — | Injected model function for this surface. Overrides application-level agent.llm. |
| `hooks` | `HookRegistry` | No | — | Tool hooks for this surface. Falls back to application-level hooks. |
| `gate` | `() => boolean` | No | — | Confirmation-channel switch for this surface. |
| `registry` | `Registry` | No | — | Action registry to operate. Defaults to the provider registry. |
| `debug` | `boolean \| AgentTraceOptions` | No | `false` | Enables the read-only request inspector inside Activity. Disabled by default. |
| `onSessionEvent` | `(event: SessionEvent) => void` | No | — | Receives every session event for audit or custom UI. |
| `onOpenChange` | `(open: boolean) => void` | No | — | Called when the dock opens or closes. |
| `navigate` | `(href: string) => void` | No | `window.location.replace` | Navigation implementation after a completed task. |
| `layout` | `"dock" \| "sidebar" \| "inline"` | No | `"dock"` | Floating dock, viewport-edge sidebar, or inline grid surface. |
| `side` | `"left" \| "right"` | No | `"right"` | Sidebar edge when layout is sidebar. |
| `launcherPlacement` | `"bottom" \| "center"` | No | `"bottom"` | Position of the collapsed sidebar launcher. |
| `launcherLabel` | `string` | No | — | Custom label for the collapsed launcher. |
| `surfaceId` | `string` | No | `"dock"` | Named surface used by pling.ask({ surface }). Built-in docks default to dock. |
| `ref.send(prompt)` | `(prompt: string) => Promise<void>` | No | — | Imperative handle that opens the dock and sends a prompt. |
| `ref.ask(prompt, options)` | `(prompt: string, options?: PlingAskOptions) => Promise<void>` | No | — | Imperative handle with optional named-surface routing. |

**Example 1 · One-tag React dock**

```tsx
<AgentDock
  title="待办助手"
  quick={["把第一条待办标记完成"]}
  debug
  onSessionEvent={audit}
/>
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


<a id="api-agentinline"></a>

### `AgentInline`

Embeds the conversation in a business column instead of a floating surface.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
<AgentInline />
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `className` | `string` | No | — | Extra class for the grid surface. |
| `title` | `string` | No | — | Assistant title. |
| `placeholder` | `string` | No | — | Composer placeholder. |
| `emptyHint` | `string` | No | — | Empty-state copy. |
| `quick` | `readonly string[]` | No | — | Suggested prompts. |
| `config` | `AgentConfigOverrides` | No | — | Surface-level model overrides. |
| `llm` | `Llm` | No | — | Injected model function. |
| `hooks` | `HookRegistry` | No | — | Surface-level tool hooks. |
| `gate` | `() => boolean` | No | — | Confirmation-channel switch. |
| `registry` | `Registry` | No | — | Registry to operate. |
| `debug` | `boolean \| AgentTraceOptions` | No | — | Enables the read-only request inspector. |
| `onSessionEvent` | `(event: SessionEvent) => void` | No | — | Session event callback. |
| `navigate` | `(href: string) => void` | No | — | Post-task navigation implementation. |
| `surfaceId` | `string` | No | `"inline"` | Task-routing name. Inline surfaces default to inline. |

**Example 1 · Reserve a workbench column**

```tsx
<div className="workspace">
  <main>...</main>
  <AgentInline title="操作助手" />
</div>
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


<a id="api-agentchat"></a>

### `AgentChat`

Renders a conversation and confirmation state without owning placement or the session.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
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
| `ui` | `PlingUiController` | No | — | Locale and theme controller. Defaults to an English standalone controller. |
| `className` | `string` | No | — | Extra class for the outer chat surface. |
| `tools` | `boolean` | No | `false` | Includes raw tool-call lines in the transcript. |
| `reveal` | `(text: string) => string` | No | — | Render-only text transform. |
| `resume` | `{ goal?: string; interrupted?: boolean } \| null` | No | `null` | Shows the continue-previous-task banner. |
| `actions` | `ReactNode` | No | — | Toolbar content in the header. |
| `footer` | `ReactNode` | No | — | Content rendered above the composer. |
| `onSend` | `(text: string) => void` | No | — | User submitted a message. |
| `onReply` | `(decision: boolean \| "always") => void` | No | — | User answered an approval request. |
| `onHandoff` | `(done: boolean) => void` | No | — | User completed or cancelled a handoff. |
| `onHandoffStep` | `(delta: number) => void` | No | — | User moved between handoff steps. |
| `onResume` | `() => void` | No | — | User accepted the resume banner. |
| `onDismissResume` | `() => void` | No | — | User dismissed the resume banner. |
| `onStop` | `() => void` | No | — | User requested cancellation while running. |

**Example 1 · Render an externally managed chat**

```tsx
<AgentChat
  events={events}
  running={running}
  pending={pending}
  onSend={send}
  onReply={reply}
/>
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


<a id="api-agentdebug"></a>

### `AgentDebug`

React read-only inspector for the runtime already driving a conversation.

**Imports**

`@plingjs/react`

**Signature**

```ts
// React
<AgentDebug runtime={runtime} registry={registry} />
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `runtime` | `AgentRuntime` | Yes | — | The runtime that is already driving the current conversation. The component never creates a second runtime. |
| `registry` | `Registry` | Yes | — | Registry whose snapshot and coverage should be inspected. |

**Example 1 · Inspect the active conversation**

```tsx
<AgentDebug runtime={runtime} registry={pling.registry} />
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


## Page identity and continuity

Read page identity, share a runtime across frames, and inspect declared coverage.

| API | Kind | Reference |
| --- | --- | --- |
| [PlingPage](#api-plingpage) | Interface | [Reference](/reference/continuity-and-projection) |
| [createPlingPage](#api-createplingpage) | Function | [Reference](/reference/continuity-and-projection) |
| [sharePlingPageWithFrame](#api-shareplingpagewithframe) | Function | [Reference](/reference/continuity-and-projection) |
| [plingPageFromParent](#api-plingpagefromparent) | Function | [Reference](/reference/continuity-and-projection) |
| [waitForPlingPageFromParent](#api-waitforplingpagefromparent) | Function | [Reference](/reference/continuity-and-projection) |
| [inspectCoverage](#api-inspectcoverage) | Method | [Reference](/reference/react-adapter) |

<a id="api-plingpage"></a>

### `PlingPage`

A page-level runtime shared by multiple framework islands or same-origin frames.

**Imports**

`@plingjs/dom` · `@plingjs/react`

**Signature**

```ts
// React
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

`@plingjs/dom` · `@plingjs/react`

**Signature**

```ts
// React
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

`@plingjs/dom` · `@plingjs/react`

**Signature**

```ts
// React
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

`@plingjs/dom` · `@plingjs/react`

**Signature**

```ts
// React
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

`@plingjs/dom` · `@plingjs/react`

**Signature**

```ts
// React
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

`@plingjs/react` · `@plingjs/dom`

**Signature**

```ts
// React
pling.inspectCoverage(root?: Element | null): CoverageReport
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

**Example 1 · Inspect React coverage**

```tsx
const report = pling.inspectCoverage(document.getElementById("root"));
```

**Canonical reference**

[Open the corresponding reference](/reference/react-adapter)


## Version and compatibility

| Package | Version | Peer dependencies |
| --- | --- | --- |
| `@plingjs/vue` | `0.1.0-alpha.2` | `vue ^3` |
| `@plingjs/react` | `0.1.0-alpha.2` | `react >=18` |
| `@plingjs/vue2` | `0.1.0-alpha.2` | `vue ^2.7.0` |
| `@plingjs/vanilla` | `0.1.0-alpha.2` | — |

| Item | Value |
| --- | --- |
| Introduced | `0.1.0-alpha.2` |
| Stability | Pre-1.0 alpha; a minor release may change the API |

## Machine-readable copy

- [JSON for this page](/api-index/react.json)
- [API overview JSON](/api-index.json)
