---
title: "Vanilla JS API"
status: navigation
release: 0.1
locale: en
---
<!-- generated:api-index -->

# Vanilla JS API

The DOM-first API for plain JavaScript and jQuery-era pages. Declarations take an element and return an unbind function; the dock is created with pling.dock().

This page lists only `@plingjs/vanilla` entry points, plus the shared-package types used with them.

[API overview](/reference/api/) · [Shared package API](/reference/api/shared)

| Package | Peer dependencies | Version |
| --- | --- | --- |
| `@plingjs/vanilla` | — | `0.1.0-alpha.10` |

The current package version is `0.1.0-alpha.10`; stability is **preview**. This is a pre-1.0 alpha, so a minor release may still change the API.

## Minimal example

```ts
import { createPling } from "@plingjs/vanilla";

const pling = createPling({ namespace: "todo" });
pling.tool(document.querySelector("#add"), {
  id: "add",
  desc: "添加一条待办",
});
```

## Entry and lifecycle

Create the application runtime, install the adapter, and release its observers.

| API | Kind | Reference |
| --- | --- | --- |
| [createPling](#api-createpling) | Function | [Reference](/reference/vanilla-jquery-adapter) |
| [VanillaPling](#api-vanillapling) | Interface | [Reference](/reference/vanilla-jquery-adapter) |
| [pling.destroy](#api-destroy) | Method | [Reference](/reference/vanilla-jquery-adapter) |

<a id="api-createpling"></a>

### `createPling`

Creates the application-level Pling instance and returns the adapter-specific runtime object.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
createPling(options?: VanillaPlingOptions): VanillaPling
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

**Example 1 · Vanilla setup with one declared action**

```ts
import { createPling } from "@plingjs/vanilla";

const pling = createPling({ namespace: "todo" });
pling.tool(document.querySelector("#add"), {
  id: "add",
  desc: "添加一条待办",
  kind: "write",
});
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

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


<a id="api-vanillapling"></a>

### `VanillaPling`

The DOM-first runtime used by Vanilla JS and Vue 2.7. It exposes declarations, feedback, task routing, page identity, coverage, the dock, and the Surface gateway.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
interface VanillaPling extends VanillaHost {
  feedback: FeedbackCollector;
  page: PageTracker;
  task: PlingTaskController;
  ask(prompt: string, options?: PlingAskOptions): Promise<void>;
  tool(element: Element, options: ToolOptions): () => void;
  action(options: ActionOptions): () => void;
  record(element: Element, value: RecordValue | null | undefined): () => void;
  scope(element: Element, options: ScopeOptions): () => void;
  state(key: string, source: StateSource, options?: StateOptions | string): () => void;
  declareFeedback(element: Element, value: FeedbackValue | readonly FeedbackValue[]): () => void;
  declareTask(element: HTMLElement, value: TaskValue): () => void;
  guideTarget(element: Element, id: string, metadata?: { label?: string; description?: string }): () => void;
  setActiveScopes(scopes: Iterable<string>): void;
  dock(options?: VanillaDockOptions): VanillaDock;
  surfaceGateway(options: VanillaSurfaceGatewayOptions): VanillaSurfaceGateway;
  inspectCoverage(root?: Element | null): CoverageReport;
  derived(): DeriveController | null;
  destroy(): void;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `feedback` | `FeedbackCollector` | No | — | Page-level feedback collector, including ARIA validation messages. |
| `page` | `PageTracker` | No | — | Tracks path, title, router-like identity, and allowlisted query parameters. |
| `task` | `PlingTaskController` | No | — | Task routing controller shared by declareTask and the dock. |
| `ask` | `(prompt: string, options?: PlingAskOptions) => Promise<void>` | No | — | Routes a human-authored task to a mounted assistant surface. |
| `tool` | `(element: Element, options: ToolOptions) => () => void` | No | — | Declares an element action and returns an unbind function. |
| `action` | `(options: ActionOptions) => () => void` | No | — | Declares an action with no DOM element. |
| `record` | `(element: Element, value: RecordValue \| null \| undefined) => () => void` | No | — | Declares a row record and returns an unbind function. |
| `scope` | `(element: Element, options: ScopeOptions) => () => void` | No | — | Declares a page region and returns an unbind function. |
| `state` | `(key: string, source: StateSource, options?: StateOptions \| string) => () => void` | No | — | Exposes a read-only state view and returns an unregister function. |
| `declareFeedback` | `(element: Element, value: FeedbackValue \| readonly FeedbackValue[]) => () => void` | No | — | Declares user-visible feedback without creating an action. |
| `declareTask` | `(element: HTMLElement, value: string \| TaskOptions) => () => void` | No | — | Turns an element into a human-facing task entrance. |
| `guideTarget` | `(element: Element, id: string) => () => void` | No | — | Highlights a handoff target without registering it as an action. |
| `setActiveScopes` | `(scopes: Iterable<string>) => void` | No | — | Overrides the active region set. |
| `dock` | `(options?: VanillaDockOptions) => VanillaDock` | No | — | Mounts the native floating assistant and returns its controller. |
| `surfaceGateway` | `(options: VanillaSurfaceGatewayOptions) => VanillaSurfaceGateway` | No | — | Creates an external-Agent Surface gateway over an explicit capability allowlist. |
| `inspectCoverage` | `(root?: Element \| null) => CoverageReport` | No | — | Scans a root for interactive controls without declarations. It never registers actions. |
| `derived` | `() => DeriveController \| null` | No | — | Returns the optional L1 deriver. |
| `destroy` | `() => void` | No | — | Unbinds all declarations and destroys every mounted dock. |

**Example 1 · Declare and release a tool**

```ts
const unbind = pling.tool(button, { desc: "删除当前项", kind: "danger" });

// Later, when the row is removed:
unbind();
```

**Example 2 · Wire the complete page runtime**

```ts
const pling = createPling({
  agent: { config: { baseUrl: "/llm/v1", model: "your-model" } },
  page: { queryKeys: ["tab"] },
});

pling.declareFeedback(field, { message: "名称不能为空", field: "name" });
pling.declareTask(document.querySelector("#ask"), "检查当前订单");
pling.dock({ debug: true, modelSettings: "readonly" });
```

**Canonical reference**

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


<a id="api-destroy"></a>

### `pling.destroy`

Stops observers, derived actions, scopes, presence, UI subscriptions, and mounted assistant surfaces.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
pling.destroy(): void
```

**Parameters**

None.

**Example 1 · Release the runtime**

```ts
window.addEventListener("pagehide", () => pling.destroy(), { once: true });
```

**Canonical reference**

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


## Page declarations

Declare actions, records, regions, state, feedback, task entrances, and sensitive values.

| API | Kind | Reference |
| --- | --- | --- |
| [Element action](#api-element-action) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Function-level action](#api-function-action) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Region](#api-region) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Record](#api-record) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Read-only state](#api-state) | Declaration | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Page feedback](#api-feedback) | Declaration | [Reference](/reference/vanilla-jquery-adapter) |
| [Task entrance](#api-task-entry) | Declaration | [Reference](/reference/vanilla-jquery-adapter) |
| [Guide target](#api-guide-target) | Declaration | [Reference](/reference/vanilla-jquery-adapter) |
| [sensitive](#api-sensitive) | Function | [Reference](/reference/core-declarations-actions-records-regions-state) |

<a id="api-element-action"></a>

### `Element action`

Declares what a control does. The description is the model's only explanation; execution still goes through availability, approval, and expectations.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
pling.tool(element: Element, options: ToolOptions): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `element` | `Element` | Yes | — | Element whose action should be exposed. |
| `options` | `ToolOptions` | Yes | — | Action declaration, including the primitive override and optional injected runner. |

**Example 1 · Vanilla declaration**

```ts
pling.tool(document.querySelector("#add"), {
  id: "add",
  desc: "添加一条待办",
  run: () => add(),
});
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-function-action"></a>

### `Function-level action`

Registers a business operation that has no dedicated DOM control.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
pling.action(options: ActionOptions): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options` | `ActionOptions` | Yes | — | An action implemented in code rather than bound to a DOM control. |

**Example 1 · Register an action**

```ts
pling.action({
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

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
pling.scope(element: Element, options: ScopeOptions): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `element` | `Element` | Yes | — | Container element for the region. |
| `options` | `ScopeOptions` | Yes | — | Region id and optional model-facing metadata. |

**Example 1 · Describe a region**

```ts
pling.scope(document.querySelector("#todos"), {
  id: "todos",
  label: "待办列表",
  role: "list",
});
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-record"></a>

### `Record`

Gives one row a stable identity and a bounded set of readable fields. Records are read-only.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
pling.record(element: Element, value: RecordValue | null | undefined): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `element` | `Element` | Yes | — | Element that represents the row. |
| `value` | `RecordValue \| null \| undefined` | Yes | — | The row object or an explicit record envelope. |

**Example 1 · Expose a row**

```ts
pling.record(rowElement, todo);
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-state"></a>

### `Read-only state`

Exposes a derived view of current UI state. State has no setter; writes must be declared as actions.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
pling.state(key: string, source: StateSource, options?: StateOptions | string): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `key` | `string` | Yes | — | Stable state-view name used in page context and diagnostics. |
| `source` | `unknown \| (() => unknown) \| Ref<unknown> \| Record<string, unknown>` | Yes | — | A value, ref, or read function. Prefer a function so the snapshot reflects current state. |
| `options` | `StateOptions \| string` | No | — | A description object or a description string. Name the view and explain what it means. |

**Example 1 · Expose filters and counts**

```ts
pling.state("todo", () => ({
  filter: currentFilter,
  total: todos.length,
}), { description: "当前筛选与总数" });
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-feedback"></a>

### `Page feedback`

Publishes user-visible feedback or a short page-level explanation without turning it into an action.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
pling.declareFeedback(element: Element, value: FeedbackValue | readonly FeedbackValue[]): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `element` | `Element` | Yes | — | Element that anchors the feedback and supplies its region. |
| `value` | `FeedbackValue \| readonly FeedbackValue[]` | Yes | — | A string, or an object with message, field, severity, scope, and id. Use functions for fields that change. |

**Example 1 · Expose a form error**

```ts
pling.declareFeedback(field, {
  message: error,
  field: "email",
  severity: "error",
});
```

**Canonical reference**

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


<a id="api-task-entry"></a>

### `Task entrance`

Routes a human-authored instruction to the mounted assistant. It is not exposed to the model as an action.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
pling.declareTask(element: HTMLElement, value: string | TaskOptions): () => void
pling.ask(prompt: string, options?: PlingAskOptions): Promise<void>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `element` | `HTMLElement` | Yes | — | Element that behaves as the task entrance. |
| `value` | `string \| TaskOptions` | Yes | — | A prompt string, or an object with prompt, surface, and disabled. |

**Example 1 · Route a human task**

```ts
pling.declareTask(document.querySelector("#ask"), {
  prompt: "整理今天的待办并标出最紧急的一项",
  surface: "dock",
});
```

**Canonical reference**

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


<a id="api-guide-target"></a>

### `Guide target`

Registers a locate-only visual target that the assistant can point out but cannot execute.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
pling.guideTarget(element: Element, id: string, metadata?: { label?: string; description?: string }): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `element` | `Element` | Yes | — | Element to point out. It must remain mounted until the target is unregistered. |
| `metadata` | `{ label?: string; description?: string }` | No | — | Optional human-facing name and description. |

**Example 1 · Register a locate-only control**

```ts
const removeTarget = pling.guideTarget(addTeacherButton, "teachers.add", {
  label: "新增老师",
  description: "打开老师档案表单",
});

// When the button is removed:
removeTarget();
```

**Canonical reference**

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


<a id="api-sensitive"></a>

### `sensitive`

Marks a value for outbound masking, tokenization, or a hint while keeping the field name visible.

**Imports**

`@plingjs/core` · `@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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
| [ModelSettingsSetting](#api-modelsettingssetting) | Type | [Reference](/reference/vanilla-jquery-adapter) |

<a id="api-tooloptions"></a>

### `ToolOptions`

The action declaration shape shared by every adapter.

**Imports**

`@plingjs/vanilla` · `@plingjs/core`

**Signature**

```ts
// Vanilla JS
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

```ts
pling.tool(button, {
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

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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

`@plingjs/core` · `@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
interface StateOptions { description?: string }
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

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
type AgentSetup = Omit<AgentRuntimeOptions, "config" | "registry" | "gate"> & {
  config?: AgentConfigOverrides;
  gate?: () => boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `config` | `AgentConfigOverrides` | No | — | Partial model and runtime configuration. Omitted fields are read from VITE_AGENT_* environment variables or framework defaults. |
| `context` | `ContextOptions` | No | — | Bounds the page information included in model context, including the live clock. |
| `clock` | `AgentClock` | No | — | Adds the current instant, viewer timezone, and business timezone to every model request. This is context only; business services remain authoritative for writes. |
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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

`@plingjs/core` · `@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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

`@plingjs/ui` · `@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


## Assistant surfaces

Mounted conversation and inspection surfaces. They render the shared runtime; they do not create a second agent.

| API | Kind | Reference |
| --- | --- | --- |
| [VanillaDock](#api-vanilladock) | Interface | [Reference](/reference/vanilla-jquery-adapter) |
| [createPlingUi](#api-createplingui) | Function | [Reference](/reference/ui-messages-theme-locale) |

<a id="api-vanilladock"></a>

### `VanillaDock`

The DOM dock controller returned by pling.dock(): element, runtime, open, close, toggle, isOpen, destroy.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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
| `sidebarMode` | `"overlay" \| "fused"` | No | `"fused"` | Sidebar layers above the page or participates in the application grid. `fused` is the default; choose `overlay` explicitly. Applies only when layout is sidebar. |
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

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


<a id="api-createplingui"></a>

### `createPlingUi`

Creates the shared locale, theme, and message controller behind a built-in assistant surface.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
createPlingUi(options?: PlingUiOptions, defaultLocale?: string): VanillaUiController
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
| [pling.surfaceGateway](#api-createsurfacegateway) | Method | [Reference](/reference/vanilla-jquery-adapter) |
| [createSurfaceAccessPanel](#api-createsurfaceaccesspanel) | Function | [Reference](/reference/vanilla-jquery-adapter) |

<a id="api-createsurfacegateway"></a>

### `pling.surfaceGateway`

Creates the plain-DOM Surface gateway controller for an explicit capability allowlist. It shares the page registry and never infers capabilities from the DOM.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
pling.surfaceGateway(options: VanillaSurfaceGatewayOptions): VanillaSurfaceGateway
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `app` | `string` | Yes | — | Stable application name sent in the bridge hello. |
| `expose` | `SurfaceExpose` | Yes | — | Explicit capability allowlist. The adapter never infers capabilities from the DOM or registry. |
| `mode` | `"public-demo" \| "bff"` | Yes | — | public-demo creates a page session from the browser; bff requires getPageSession backed by the application server. |
| `gatewayUrl` | `string` | No | — | Gateway origin for public-demo mode. |
| `getPageSession` | `() => Promise<SurfacePageSession>` | No | — | Required in bff mode. The server verifies the user session and returns a short-lived page session. |
| `gatewayClient` | `SurfaceGatewayClient` | No | — | Injected HTTP client for tests or a custom BFF contract. |
| `approval` | `SurfaceApprovalSource & { confirm?: Confirm }` | No | — | Human approval source shared with the Surface bridge. |
| `confirm` | `Confirm \| null` | No | — | Confirmation function used by the Surface executor. Defaults to approval.confirm, then null (fail closed). |
| `autoConnect` | `boolean` | No | `true` | Connects immediately when true. |
| `autoClaim` | `boolean` | No | `true (public-demo only)` | Claims an Agent token automatically. Defaults to true only in public-demo mode. |
| `agentId` | `string` | No | — | Agent id recorded when claiming a public-demo pairing. |
| `tenantId` | `string` | No | — | Optional tenant hint for the public-demo page-session endpoint. |
| `clientKey` | `string` | No | — | Optional client hint for the public-demo page-session endpoint. |
| `reconnectMs` | `number` | No | `1500` | Delay before reconnecting the page WebSocket. |
| `webSocket` | `SurfaceWebSocketFactory` | No | — | WebSocket implementation injection for tests or non-browser hosts. |
| `surface` | `Omit<CreatePlingSurfaceOptions, "app" \| "expose" \| "confirm" \| "session">` | No | — | Extra Surface options such as recordLimit, rateLimit, replay, audit, or custom settle. |

**Example 1 · Public demo with an explicit allowlist**

```ts
const gateway = pling.surfaceGateway({
  app: "orders",
  expose: ["orders.overview", "orders.update_note"],
  mode: "public-demo",
  gatewayUrl: "https://surface.example.com",
});
```

**Example 2 · Production BFF session**

```ts
const gateway = pling.surfaceGateway({
  app: "orders",
  expose: ["orders.overview", "orders.update_note"],
  mode: "bff",
  getPageSession: async () => {
    const response = await fetch("/api/surface/page-session", { method: "POST" });
    if (!response.ok) throw new Error("Surface session unavailable");
    return response.json();
  },
});
```

**Canonical reference**

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


<a id="api-createsurfaceaccesspanel"></a>

### `createSurfaceAccessPanel`

Mounts the plain-DOM counterpart of the Vue access panel: connection state, pairing, a copyable Agent token, the active scope, and revocation.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
createSurfaceAccessPanel(gateway: VanillaSurfaceGateway, options?: SurfaceAccessPanelOptions): SurfaceAccessPanel
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `gateway` | `VanillaSurfaceGateway` | Yes | — | Controller returned by pling.surfaceGateway(). The panel renders its state but never creates capabilities or tokens by itself. |
| `title` | `string` | No | — | Panel title. Defaults to the localized External Agent label. |
| `ui` | `PlingUiController` | No | — | Optional UI controller for locale, theme, and shared class names. |
| `mount` | `Element` | No | — | Mount target. When omitted, the caller mounts the returned element. |

**Example 1 · Render the access panel**

```ts
const panel = createSurfaceAccessPanel(gateway, { mount: document.querySelector("#access") });

// On teardown:
panel.destroy();
```

**Canonical reference**

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


## Page identity and continuity

Read page identity, share a runtime across frames, and inspect declared coverage.

| API | Kind | Reference |
| --- | --- | --- |
| [PageOptions](#api-pageoptions) | Type | [Reference](/reference/vanilla-jquery-adapter) |
| [PlingPage](#api-plingpage) | Interface | [Reference](/reference/continuity-and-projection) |
| [createPlingPage](#api-createplingpage) | Function | [Reference](/reference/continuity-and-projection) |
| [sharePlingPageWithFrame](#api-shareplingpagewithframe) | Function | [Reference](/reference/continuity-and-projection) |
| [plingPageFromParent](#api-plingpagefromparent) | Function | [Reference](/reference/continuity-and-projection) |
| [waitForPlingPageFromParent](#api-waitforplingpagefromparent) | Function | [Reference](/reference/continuity-and-projection) |
| [inspectCoverage](#api-inspectcoverage) | Method | [Reference](/reference/vanilla-jquery-adapter) |

<a id="api-pageoptions"></a>

### `PageOptions`

Controls automatic page identity, router integration, query allowlisting, hash handling, and title overrides.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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
| `router` | `PageRouterLike` | No | — | Router-like object that supplies currentRoute name, params, hash, and meta.title. Vanilla does not discover a router implicitly. |
| `queryKeys` | `readonly string[]` | No | `[]` | Allowlist of query parameters exposed to the model. Query parameters are hidden by default. |
| `hash` | `boolean` | No | `true` | Includes safe hash fragments. Hash values that resemble query strings are ignored. |
| `title` | `() => string \| undefined` | No | — | Title override or fallback. It takes precedence over route meta.title and document.title. |

**Example 1 · Expose route identity without tokens**

```ts
createPling({
  page: {
    queryKeys: ["tab"],
    router: { currentRoute },
  },
});
```

**Canonical reference**

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


<a id="api-plingpage"></a>

### `PlingPage`

A page-level runtime shared by multiple framework islands or same-origin frames.

**Imports**

`@plingjs/dom` · `@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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

`@plingjs/dom` · `@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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

`@plingjs/dom` · `@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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

`@plingjs/dom` · `@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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

`@plingjs/dom` · `@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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

Classifies recognized native and ARIA controls as declared, derived, grouped, locate-only, or missing. It never registers actions and cannot detect arbitrary non-semantic event handlers.

**Imports**

`@plingjs/vanilla` · `@plingjs/dom`

**Signature**

```ts
// Vanilla JS
pling.inspectCoverage(root?: Element | null): CoverageReport
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `root` | `Element \| null` | No | — | Application root to scan. Vue uses its mount root; React and DOM callers may pass any root. |
| `return.total` | `number` | No | — | Recognized native controls and elements with supported interactive ARIA roles. Custom click handlers without semantic markup cannot be detected. |
| `return.declared` | `number` | No | — | Controls with a direct declaration. |
| `return.derived` | `number` | No | — | Controls produced by optional L1 derivation. |
| `return.grouped` | `number` | No | — | Controls covered by a declaration on an ancestor. Review these manually. |
| `return.locatable` | `number` | No | — | Controls registered for pointing and highlighting only; the user must operate them. |
| `return.missing` | `number` | No | — | Actionable controls with no declaration in their ancestry. |
| `return.coveragePercent` | `number \| null` | No | — | Controls with an explicit, derived, grouped, or locate-only treatment divided by total; this is declaration coverage, not the percentage of controls the agent can execute. Null when there are no controls. |
| `return.targets` | `CoverageTarget[]` | No | — | Grouped, locate-only, and missing controls with labels, target ids, or nearby action ids. |

**Example 1 · Inspect Vanilla coverage**

```ts
const report = pling.inspectCoverage(document.querySelector("main"));
console.log(report.coveragePercent, report.targets);
```

**Canonical reference**

[Open the corresponding reference](/reference/vanilla-jquery-adapter)


## Guided tasks

Goals and advanced tasks. A goal declares an outcome, boundaries and success criteria; fields and execution stay on the real page. Advanced tasks add field schemas, lookups and fixed steps only when page actions cannot express the requirement.

| API | Kind | Reference |
| --- | --- | --- |
| [createTaskController](#api-createtaskcontroller) | Function | [Reference](/reference/guided-task-api) |
| [createTaskCatalog](#api-createtaskcatalog) | Function | [Reference](/reference/guided-task-api) |
| [TaskCatalog](#api-taskcatalog) | Interface | [Reference](/reference/guided-task-api) |
| [TaskGoalInput](#api-taskgoalinput) | Interface | [Reference](/reference/guided-task-api) |
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
| [registerTaskLookupActions](#api-registertasklookupactions) | Function | [Reference](/reference/guided-task-api) |
| [TaskLookupActionOptions](#api-tasklookupactionoptions) | Interface | [Reference](/reference/guided-task-api) |
| [TaskLookupResult](#api-tasklookupresult) | Interface | [Reference](/reference/guided-task-api) |
| [createTaskPanel](#api-createtaskpanel) | Function | [Reference](/reference/guided-task-api) |
| [createTaskCard](#api-createtaskcard) | Function | [Reference](/reference/guided-task-api) |
| [createTaskGuide](#api-createtaskguide) | Function | [Reference](/reference/guided-task-api) |
| [GuidedTaskGuide](#api-guidedtaskguide) | Interface | [Reference](/reference/guided-task-api) |
| [createGuideActions](#api-createguideactions) | Function | [Reference](/reference/guided-task-api) |
| [GuideActionItem](#api-guideactionitem) | Interface | [Reference](/reference/guided-task-api) |
| [GuidedTaskPanelOptions](#api-guidedtaskpaneloptions) | Interface | [Reference](/reference/guided-task-api) |
| [GuidedTaskPanel](#api-guidedtaskpanel) | Interface | [Reference](/reference/guided-task-api) |

<a id="api-createtaskcontroller"></a>

### `createTaskController`

Creates a framework-independent task controller. The host supplies the only execution bridge through invoke.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vanilla JS
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
// Vanilla JS
createTaskCatalog(options?: TaskCatalogOptions): TaskCatalog
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options.registry` | `Registry` | No | — | Registry used for route changes and for binding the narrow pling_start_task and pling_update_task actions. |
| `options.isScopeActive` | `(scope: string) => boolean` | No | — | Scope lookup used by registration-level scope restrictions. Vue passes its namespaced registry lookup. |
| `options.getPage` | `() => PageView \| undefined` | No | — | Page identity override. Defaults to registry.getPage(). |
| `options.actionId` | `string` | No | `"pling_start_task"` | Preferred model action id. A shared registry keeps the first catalog on this id and assigns later catalogs suffixes such as pling_start_task_2. |

**Example 1 · Register a goal that survives a closed dialog**

```ts
catalog.goal({
  id: "course.create",
  title: "创建课程",
  goal: "打开真实表单，填写用户给出的信息，保存后回读课程库确认新课程在第一位。",
  constraints: ["页面动作是唯一入口；封面由用户上传。"],
  successCriteria: ["新课程出现在课程库第一位"],
});
```

**Example 2 · Register one advanced task for the current route**

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

The current page's task catalog: register goals or advanced tasks, query what is available now, activate at most one guide, complete a goal, forward guide commands, and notify renderers.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vanilla JS
interface TaskCatalog {
  readonly actionId: string;
  readonly updateActionId: string;
  readonly focusActionId: string;
  readonly reviewActionId: string;
  readonly proposeSaveActionId: string;
  readonly cancelActionId: string;
  readonly completeActionId: string;
  goal(input: TaskGoalInput): () => void;
  define(registration: GuidedTaskRegistration): () => void;
  get(id: string): GuidedTaskRegistration | undefined;
  list(): readonly GuidedTaskRegistration[];
  available(): readonly GuidedTaskRegistration[];
  active(): ActiveGuidedTask | null;
  activate(id: string, options?: GuidedTaskActivationOptions): ActiveGuidedTask;
  deactivate(): void;
  command(command: TaskGuideCommand): boolean;
  complete(): boolean;
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
| `focusActionId` | `readonly string` | No | — | The actual model action id that points at a declared guide field. It never writes a value and is unavailable when the active guide has no fields. |
| `reviewActionId` | `readonly string` | No | — | The actual model action id that opens the page's read-only review. It is unavailable unless `guide.agent.review` declares a command. |
| `proposeSaveActionId` | `readonly string` | No | — | The actual model action id that opens the page's confirmation step. It never writes and is unavailable unless `guide.agent.proposeSave` declares a command. |
| `cancelActionId` | `readonly string` | No | — | The actual model action id that ends the active guide. It is unavailable unless `guide.agent.cancel` or `guide.cancel` declares a command. |
| `completeActionId` | `readonly string` | No | — | The actual model action id that marks a goal-only task complete. It writes no business data. |
| `goal(input)` | `() => void` | No | — | Registers the minimal goal path and returns an unregister function. It accepts no fields, steps, controller, form tools or business callbacks. |
| `complete()` | `boolean` | No | — | Marks the active goal-only task complete. Returns false for advanced tasks, which use their own completion state. |
| `define(registration)` | `() => void` | No | — | Adds an advanced task registration and returns an unregister function. |
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


<a id="api-taskgoalinput"></a>

### `TaskGoalInput`

The minimal task declaration: id, title, outcome, boundaries, success criteria, examples and optional route/scope continuity. It has no fields, steps, controller or business callbacks.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Vanilla JS
interface TaskGoalInput {
  id: string;
  title: string;
  goal: string;
  description?: string;
  constraints?: readonly string[];
  successCriteria?: readonly string[];
  examples?: readonly string[];
  risk?: Kind;
  route?: GuidedTaskRoute;
  scope?: string | readonly string[];
  keepActive?: boolean;
  labels?: TaskGuideLabels;
  cancelLabel?: string;
  stepSubtitle?: string;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Stable goal id, unique in the catalog. |
| `title` | `string` | Yes | — | Human-facing goal name. |
| `goal` | `string` | Yes | — | The outcome to reach. Must not be empty. |
| `description` | `string` | No | — | Extra description for the card or task list. Defaults to goal. |
| `constraints` | `readonly string[]` | No | — | Boundaries the model must keep, such as “page actions are the only entry”. |
| `successCriteria` | `readonly string[]` | No | — | Observable conditions that must hold before completion. |
| `examples` | `readonly string[]` | No | — | Sample sentences a person might say. |
| `risk` | `"read" \| "write" \| "danger"` | No | `"write"` | Goal-level risk hint. Actions still apply their own risk rules. |
| `route` | `GuidedTaskRoute` | No | — | Exact path, route name, list or predicate that limits where the goal can start. |
| `scope` | `string \| readonly string[]` | No | — | Every listed region must be active before the goal is available. |
| `keepActive` | `boolean` | No | `true` | Keep an explicitly started goal when its route or scope temporarily stops matching. |
| `labels` | `TaskGuideLabels` | No | — | Overrides for running, completed and related labels. |
| `cancelLabel` | `string` | No | `"Cancel task"` | Cancel button label. |
| `stepSubtitle` | `string` | No | — | Subtitle for the compact goal card. |

**Example 1 · Register a goal without a field schema**

```ts
const disposeGoal = pling.task.goal({
  id: "course.create",
  title: "创建课程",
  goal: "打开真实表单，填写用户给出的信息，保存后回读课程库确认新课程在第一位。",
  constraints: [
    "页面上的动作是唯一操作入口。",
    "封面必须由用户亲自上传。",
  ],
  successCriteria: [
    "新课程出现在课程库第一位",
    "保存动作已回读课程库并确认了这条新记录",
  ],
  examples: ["创建孕妇瑜伽，陈静，2 星，月卡，介绍自动填写"],
});

onBeforeUnmount(disposeGoal);
```

**Example 2 · Keep the goal available only on one route**

```ts
catalog.goal({
  id: "course.create",
  title: "创建课程",
  goal: "在课程管理里新建一门课程。",
  route: "/courses",
  scope: "course-catalogue",
});
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
interface ActiveGuidedTask {
  id: string;
  definition: TaskDefinition;
  guide?: TaskGuideDefinition;
  controller?: TaskController;
  state: TaskGuideState;
  startedBy: "page" | "agent";
  goal?: boolean;
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
| `goal` | `boolean` | No | — | True for a compact goal created by goal(). A goal has no controller and no field schema. |

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
// Vanilla JS
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
| `agent` | `{ focusField?, review?, proposeSave?, cancel? }` | No | — | Page-owned commands the model may trigger. `review` enables `pling_review_task`, `proposeSave` enables `pling_propose_save`, and `cancel` enables `pling_cancel_task`; each tool is unavailable when its command is omitted. `focusField(field)` overrides the default `focus-<field>` command while `pling_focus_field` stays limited to declared guide fields. None of these commands performs a business write; `proposeSave` opens the confirmation surface only. |
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
  agent: {
    review: "review-task",
    proposeSave: "propose-save",
    cancel: "cancel-task",
  },
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
| `min` | `number` | No | — | Minimum for a numeric field. Enforced before a model-proposed value reaches the task snapshot. |
| `max` | `number` | No | — | Maximum for a numeric field. Enforced before a model-proposed value reaches the task snapshot. |
| `minLength` | `number` | No | — | Minimum length for a text value. Counted on the trimmed string. |
| `maxLength` | `number` | No | — | Maximum length for a text value. Counted on the trimmed string. |
| `pattern` | `string` | No | — | Regular expression source without delimiters, tested against a text value. Use anchors when the whole value must match, for example `^[1-9]\\d*$`. |
| `validate` | `(value, values) => string \| null \| undefined` | No | — | Business-level check run before a model-proposed value is written. Return a short human-readable reason to reject it, or nothing when valid. This validates a value; it must not classify intent or trigger side effects. |
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

**Example 2 · Reject an impossible value before it reaches the page**

```ts
const difficulty: TaskField = {
  name: "difficulty",
  label: "难度",
  type: "number",
  optional: true,
  min: 1,
  max: 5,
};

const teacher: TaskField = {
  name: "teacherId",
  label: "授课老师",
  type: "lookup",
  lookup: searchTeachers,
  validate: (value) =>
    teachers.some((item) => item.id === value)
      ? null
      : "请从搜索结果中选择老师。",
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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


<a id="api-registertasklookupactions"></a>

### `registerTaskLookupActions`

Registers every lookup field as a narrow read action so the model can search by a human name instead of inventing ids. The UI and model call the same lookup.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
registerTaskLookupActions(host: Pick<VanillaHost, "registry" | "warn">, definitions: readonly TaskDefinition[], options?: TaskLookupActionOptions): () => void
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `host` | `Pick<VanillaHost, "registry" \| "warn">` | Yes | — | Registry and warning sink that receive the generated read actions. |
| `definitions` | `readonly TaskDefinition[]` | Yes | — | Task definitions whose lookup fields should become actions. |
| `options.maxResults` | `number` | No | `8` | Maximum candidates returned to the model. Defaults to 8 and is clamped to 1–50. |
| `options.actionId` | `(field, task) => string` | No | — | Override the generated action id. |
| `options.description` | `(field, task) => string` | No | — | Override the model-facing description. |
| `options.onWarning` | `(message) => void` | No | — | Receives non-fatal conflicts, such as two fields claiming one action id. |

**Example 1 · Expose lookups as search actions**

```ts
const off = registerTaskLookupActions(pling, [
  {
    id: "lesson.note",
    title: "写课程备注",
    requiresRecord: true,
    fields: [{ name: "note", label: "备注", type: "textarea" }],
    steps: [{ label: "保存备注", action: "update_lesson_note" }],
  },
]);

// The model can now call search_studentRef before a write that needs the id.
off();
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-tasklookupactionoptions"></a>

### `TaskLookupActionOptions`

Result limit, action-id override, description override, and warning hook for generated lookup actions.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
interface TaskLookupActionOptions {
  maxResults?: number;
  actionId?: (field: TaskField, task: TaskDefinition) => string;
  description?: (field: TaskField, task: TaskDefinition) => string;
  onWarning?: (message: string) => void;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `maxResults` | `number` | No | `8` | Maximum candidates returned to the model. |
| `actionId` | `(field, task) => string` | No | — | Override the id derived from the field. |
| `description` | `(field, task) => string` | No | — | Override the model-facing description. |
| `onWarning` | `(message) => void` | No | — | Receives non-fatal binding conflicts. |

**Example 1 · Reuse one search across tasks**

```ts
registerTaskLookupActions(pling, tasks, {
  actionId: (field, task) => task.id.startsWith("lesson.") ? "search_lessons" : "search_" + field.name,
  maxResults: 5,
});
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-tasklookupresult"></a>

### `TaskLookupResult`

The normalized result of a lookup action: the query, the minimum length when it was too short, and at most maxResults choices.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
interface TaskLookupResult {
  query: string;
  minChars?: number;
  choices: TaskChoice[];
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `query` | `string` | No | — | Normalized query that was executed. |
| `minChars` | `number` | No | — | Present when the query was too short; no search was run. |
| `choices` | `TaskChoice[]` | No | — | At most maxResults candidates for the model to choose from. |

**Example 1 · Read the narrowed result**

```ts
const result = await search_students({ query: "李" });
if (result.minChars) return askForMoreCharacters(result.minChars);
const [first, second] = result.choices;
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-createtaskpanel"></a>

### `createTaskPanel`

Renders a task controller as a standalone framework-independent DOM workspace. Agent-mode prompts are handed back through onPrompt or a DOM event.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
createTaskPanel(controller: TaskController, options?: GuidedTaskPanelOptions): GuidedTaskPanel
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `controller` | `TaskController` | Yes | — | Task controller whose snapshots the panel renders. |
| `options.locale` | `string` | No | `"en-US"` | Locale for panel-owned labels. Task titles and field labels remain application-defined. |
| `options.t` | `(key, params?) => string` | No | — | Optional translator, for example pling.ui.t. |
| `options.title` | `string` | No | — | Heading above the task list. |
| `options.variant` | `"panel" \| "card"` | No | `"panel"` | Standalone workspace or the compact conversation card. createTaskCard() sets card for you. |
| `options.catalog` | `boolean` | No | `true` | In card mode, show task entries while no run is active. Set false when the page already has its own entrances. |
| `options.initialTask` | `string` | No | — | Open a task immediately instead of the list. |
| `options.onPrompt` | `(prompt, snapshot) => void` | No | — | Receives agent-mode prompts for handoff to the existing assistant. |
| `options.onComplete` | `(snapshot) => void` | No | — | Called after a deterministic run finishes, fails, or is cancelled. |

**Example 1 · Mount the reference task panel**

```ts
import { createTaskPanel } from "@plingjs/vanilla";

const panel = createTaskPanel(controller, {
  locale: "zh-CN",
  initialTask: "course.schedule",
  onPrompt: (prompt) => pling.ask(prompt),
});
document.querySelector("#task-host")!.append(panel.element);
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-createtaskcard"></a>

### `createTaskCard`

Renders a task controller as a compact DOM card for the assistant transcript. It shares the same run controller as createTaskPanel.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
createTaskCard(controller: TaskController, options?: Omit<GuidedTaskPanelOptions, "variant">): GuidedTaskPanel
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `controller` | `TaskController` | Yes | — | Task controller whose snapshots the card renders. |
| `options.locale` | `string` | No | `"en-US"` | Locale for card-owned labels. Task titles and field labels remain application-defined. |
| `options.t` | `(key, params?) => string` | No | — | Optional translator, for example pling.ui.t. |
| `options.title` | `string` | No | — | Heading above the task card. |
| `options.catalog` | `boolean` | No | `true` | Whether the task catalog is visible while no run is active. Set false when entrances live on the page. |
| `options.initialTask` | `string` | No | — | Open a task immediately instead of the catalog. |
| `options.onPrompt` | `(prompt, snapshot) => void` | No | — | Receives agent-mode prompts for the existing assistant. |
| `options.onComplete` | `(snapshot) => void` | No | — | Called after a deterministic run finishes, fails, or is cancelled. |

**Example 1 · Put the task card in the conversation**

```ts
import { createTaskCard } from "@plingjs/vanilla";

const card = createTaskCard(controller, {
  locale: "zh-CN",
  catalog: false,
  onPrompt: (prompt) => pling.ask(prompt),
});

pling.dock({ layout: "sidebar", sidebarMode: "fused", task: card.element });
card.open("lesson.note", {}, { record: { id: lesson.id, label: lesson.course } });
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-createtaskguide"></a>

### `createTaskGuide`

Creates the reference DOM renderer for a TaskGuideDefinition. It renders steps, read-only summaries, handoff copy, and command buttons; it never executes a business action itself.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
createTaskGuide(options: CreateTaskGuideOptions): GuidedTaskGuide
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options.definition` | `TaskGuideDefinition` | Yes | — | Human-facing steps and completion copy to render. |
| `options.snapshot` | `TaskRunSnapshot \| null` | No | `null` | Initial task snapshot for dynamic rows and completion data. |
| `options.step` | `number` | No | `1` | One-based initial step. |
| `options.initialStep` | `number` | No | — | Backward-compatible alias for the initial step. |
| `options.onCommand` | `(command: TaskGuideCommand) => void` | Yes | — | Receives command names from primary, secondary, and completion buttons. |

**Example 1 · Render a guide in a normal DOM container**

```ts
import { createTaskGuide } from "@plingjs/vanilla";

const guide = createTaskGuide({
  definition: courseGuide,
  snapshot: tasks.snapshot(),
  onCommand: (command) => runCourseCommand(command),
});

document.querySelector("#task-guide")!.replaceChildren(guide.element);
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-guidedtaskguide"></a>

### `GuidedTaskGuide`

The mounted guide, with methods to update the snapshot, step, busy state, error, completion state, and to destroy its DOM.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
interface GuidedTaskGuide {
  readonly element: HTMLElement;
  setSnapshot(snapshot: TaskRunSnapshot | null): void;
  setStep(step: number): void;
  setBusy(busy: boolean): void;
  setError(message: string): void;
  complete(): void;
  reset(): void;
  refresh(): void;
  destroy(): void;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `element` | `readonly HTMLElement` | No | — | Host element produced by the renderer. |
| `setSnapshot(snapshot)` | `void` | No | — | Re-renders dynamic rows from a new task snapshot. |
| `setStep(step)` | `void` | No | — | Moves the guide to a one-based step. |
| `setBusy(busy)` | `void` | No | — | Disables commands and shows the active command's busy label. |
| `setError(message)` | `void` | No | — | Shows or clears a business-facing error. |
| `complete()` | `void` | No | — | Switches to the completion card. |
| `reset()` | `void` | No | — | Returns from completion to the step view. |
| `refresh()` | `void` | No | — | Re-renders from the current snapshot and step. |
| `destroy()` | `void` | No | — | Releases DOM listeners and removes the host content when appropriate. |

**Example 1 · Update one step without rebuilding the guide**

```ts
guide.setSnapshot(tasks.snapshot());
guide.setStep(2);
guide.setBusy(true);
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-createguideactions"></a>

### `createGuideActions`

Renders the compact guided-task action row used by every adapter. A short verb carries the action; a long recommendation becomes a one-line ellipsised preview with the full value in title and aria-label.

**Imports**

`@plingjs/dom` · `@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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

`@plingjs/dom` · `@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
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


<a id="api-guidedtaskpaneloptions"></a>

### `GuidedTaskPanelOptions`

Locale, presentation variant, catalog visibility, task entry, prompt handoff, and completion callbacks for the reference DOM renderer.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
interface GuidedTaskPanelOptions {
  locale?: string;
  t?: (key: string, params?: MessageParams) => string;
  title?: string;
  variant?: "panel" | "card";
  catalog?: boolean;
  initialTask?: string;
  onPrompt?: (prompt: string, snapshot: TaskRunSnapshot) => void;
  onComplete?: (snapshot: TaskRunSnapshot) => void;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `locale` | `string` | No | `"en-US"` | Locale for panel-owned labels; defaults to en-US. |
| `t` | `(key, params?) => string` | No | — | Translator used instead of the built-in catalog. |
| `title` | `string` | No | — | Custom heading above the task list. |
| `variant` | `"panel" \| "card"` | No | `"panel"` | Standalone workspace or compact conversation card. |
| `catalog` | `boolean` | No | `true` | Card mode: show task entries while no run is active. |
| `initialTask` | `string` | No | — | Task id to open on mount. |
| `onPrompt` | `(prompt, snapshot) => void` | No | — | Handoff callback for agent-mode tasks. |
| `onComplete` | `(snapshot) => void` | No | — | Completion callback for deterministic tasks. |

**Example 1 · Forward prompts into the assistant dock**

```ts
const options: GuidedTaskPanelOptions = {
  onPrompt: (prompt) => pling.ask(prompt),
  onComplete: (snapshot) => console.log(snapshot.status),
};
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-guidedtaskpanel"></a>

### `GuidedTaskPanel`

The mounted DOM renderer and its open, close, refresh, catalog, and destroy lifecycle.

**Imports**

`@plingjs/vanilla`

**Signature**

```ts
// Vanilla JS
interface GuidedTaskPanel {
  readonly element: HTMLElement;
  open(taskId: string, values?: TaskValues, binding?: TaskBinding): void;
  close(): void;
  refresh(): void;
  setCatalog(visible: boolean): void;
  destroy(): void;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `element` | `HTMLElement` | No | — | The mounted panel element. |
| `open` | `(taskId, values?, binding?) => void` | No | — | Opens one task with optional initial values and page bindings. Pass the selected record for tasks with requiresRecord. |
| `close` | `() => void` | No | — | Hides the panel without destroying its controller. |
| `refresh` | `() => void` | No | — | Re-renders from the controller's current snapshot. |
| `setCatalog` | `(visible: boolean) => void` | No | — | Shows or hides the task catalog without losing the current run. |
| `destroy` | `() => void` | No | — | Removes listeners and the panel element. |

**Example 1 · Control panel lifecycle**

```ts
panel.open("teacher.create");
panel.close();
panel.destroy();
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


## Version and compatibility

| Package | Version | Peer dependencies |
| --- | --- | --- |
| `@plingjs/vue` | `0.1.0-alpha.10` | `vue ^3` |
| `@plingjs/react` | `0.1.0-alpha.10` | `react >=16.3` |
| `@plingjs/vue2` | `0.1.0-alpha.10` | `vue ^2.7.0` |
| `@plingjs/vanilla` | `0.1.0-alpha.10` | — |

| Item | Value |
| --- | --- |
| Introduced | `0.1.0-alpha.2` |
| Stability | Pre-1.0 alpha; a minor release may change the API |

## Machine-readable copy

- [JSON for this page](/api-index/vanilla.json)
- [API overview JSON](/api-index.json)
