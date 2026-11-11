---
title: "Shared package API"
status: navigation
release: 0.1
locale: en
---
<!-- generated:api-index -->

# Shared package API

Runtime, page-continuity, testing, and diagnostic APIs shared by the four adapters. Import these from their owning package; no adapter re-implementation is involved.

This page covers public APIs in `@plingjs/core`, `@plingjs/agent`, `@plingjs/dom`, and `@plingjs/ui`.

[API overview](/reference/api/) · [Shared package API](/reference/api/shared)

| Package | Peer dependencies | Version |
| --- | --- | --- |
| `@plingjs/core` | — | `0.1.0-alpha.10` |

The current package version is `0.1.0-alpha.10`; stability is **preview**. This is a pre-1.0 alpha, so a minor release may still change the API.

## Minimal example

```ts
import { createExecutor, createPolicy } from "@plingjs/core";
import { createReplayLlm } from "@plingjs/agent";
```

## Page declarations

Declare actions, records, regions, state, feedback, task entrances, and sensitive values.

| API | Kind | Reference |
| --- | --- | --- |
| [sensitive](#api-sensitive) | Function | [Reference](/reference/core-declarations-actions-records-regions-state) |

<a id="api-sensitive"></a>

### `sensitive`

Marks a value for outbound masking, tokenization, or a hint while keeping the field name visible.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Shared package
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
| [RecordValue](#api-recordvalue) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Kind](#api-kind) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [ParamDeclaration](#api-paramdeclaration) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [Expectation](#api-expectation) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [HandoffStep](#api-handoffstep) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [FlowStep](#api-flowstep) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [RegionRole](#api-regionrole) | Type | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [PlingUiOptions](#api-plinguioptions) | Type | [Reference](/reference/ui-messages-theme-locale) |

<a id="api-recordvalue"></a>

### `RecordValue`

A row value or a full record declaration with explicit id, label, and fields.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Shared package
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


<a id="api-kind"></a>

### `Kind`

The action risk level used by approval policy.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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


## Agent runtime

Model configuration, sessions, approval and handoff, hooks, tracing, and shared runtime helpers.

| API | Kind | Reference |
| --- | --- | --- |
| [AgentRuntimeOptions](#api-agentruntimeoptions) | Type | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [AgentClock](#api-agentclock) | Type | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [ContextOptions](#api-contextoptions) | Type | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [AgentConfigOverrides](#api-agentconfigoverrides) | Type | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [HookRegistry](#api-hookregistry) | Class | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [SessionEvent](#api-sessionevent) | Type | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [AgentTraceOptions](#api-agenttraceoptions) | Type | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [waitFor](#api-waitfor) | Function | [Reference](/reference/core-declarations-actions-records-regions-state) |
| [describeFlow](#api-describeflow) | Function | [Reference](/reference/core-declarations-actions-records-regions-state) |

<a id="api-agentruntimeoptions"></a>

### `AgentRuntimeOptions`

The runtime contract behind AgentSetup: config, registry, model, events, hooks, gates, trace, and continuity.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
interface AgentRuntimeOptions {
  config: AgentConfig;
  registry?: Registry;
  taskCatalog?: TaskCatalog;
  context?: ContextOptions;
  clock?: AgentClock;
  llm?: Llm;
  responseLocale?: string | (() => string);
  telemetry?: Telemetry;
  trace?: boolean | AgentTraceOptions;
  settle?: () => Promise<void>;
  hooks?: HookRegistry;
  onEvent?: SessionEventListener;
  onApproval?: (pending: PendingApproval | null) => void;
  onHandoff?: (pending: PendingHandoff | null) => void;
  gate?: () => boolean;
  policy?: ConfirmGate;
  approvalTimeoutMs?: number;
  handoffTimeoutMs?: number;
  handoff?: HandoffGate;
  id?: string;
  onLeaseLost?: () => void;
  continuity?: ContinuitySetting;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `config` | `AgentConfig` | Yes | — | Fully resolved model and runtime configuration. |
| `registry` | `Registry` | No | — | Page capability registry. Omit it for a chat-only runtime. |
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

**Example 1 · Create a page-operating runtime**

```ts
const runtime = createAgentRuntime({
  config: resolveAgentConfig({ config: { model: "gpt-4.1-mini" } }),
  registry: pling.registry,
  hooks,
  trace: true,
});
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-agentclock"></a>

### `AgentClock`

Live time and timezone context included with every model request. It does not replace business-service validation.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
interface AgentClock {
  now?: () => Date;
  viewerTimeZone?: string | (() => string);
  businessTimeZone?: string | (() => string);
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `now` | `() => Date` | No | — | Returns a valid current instant. Re-read before each model request; defaults to the runtime clock. An invalid Date fails before the model request. |
| `viewerTimeZone` | `string \| (() => string)` | No | — | IANA timezone used to render the viewer's local time. Defaults to the runtime timezone; server runtimes should supply the authenticated user's timezone. |
| `businessTimeZone` | `string \| (() => string)` | No | — | IANA timezone used for business dates such as class schedules. Defaults to viewerTimeZone. |

**Example 1 · Configure the shop timezone**

```ts
createPling({
  agent: {
    clock: {
      businessTimeZone: "Asia/Shanghai",
    },
  },
});
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-contextoptions"></a>

### `ContextOptions`

Bounds the page context sent to the model and optionally provides a per-request clock.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
interface ContextOptions {
  maxActions?: number;
  maxRecords?: number;
  includeState?: boolean;
  maxIdsInHint?: number;
  maxUnavailable?: number;
  maxStateChars?: number;
  maxRecordChars?: number;
  maxScopes?: number;
  maxFeedback?: number;
  maxFeedbackChars?: number;
  maxPageChars?: number;
  clock?: AgentClock;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `maxActions` | `number` | No | — | Maximum actions rendered in the current page context. |
| `maxRecords` | `number` | No | — | Maximum record rows rendered in the current page context. |
| `includeState` | `boolean` | No | — | Whether read-only page state is included. |
| `maxUnavailable` | `number` | No | — | Maximum unavailable actions rendered in context. |
| `clock` | `AgentClock` | No | — | Live time and timezone context. When configured here, it is used for each model request. |

**Example 1 · Provide a per-request clock**

```ts
createAgentRuntime({
  config,
  registry,
  context: {
    clock: {
      viewerTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
      businessTimeZone: "Asia/Shanghai",
    },
  },
});
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-agentconfigoverrides"></a>

### `AgentConfigOverrides`

A partial model configuration. Unspecified fields continue to come from environment variables and defaults.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
type AgentConfigOverrides =
  Partial<Omit<AgentConfig, "limits" | "retry">> & {
    limits?: Partial<AgentLimits>;
    retry?: Partial<AgentRetryConfig>;
  };
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `baseUrl` | `string` | No | `""` | OpenAI-compatible API root. A relative path such as /llm/v1 routes through the application server and does not require a browser-side key. |
| `model` | `string` | No | `""` | Model name sent to the provider. |
| `apiKey` | `string` | No | `""` | Browser-visible provider key. Leave empty when using a relative proxy URL. |
| `temperature` | `number` | No | `0.3` | Sampling temperature for model responses. |
| `maxTokens` | `number` | No | `1024` | Maximum output tokens for one model response. This is not the conversation context budget. |
| `systemPrompt` | `string` | No | `""` | Application-specific instructions appended after the framework rules. It does not replace the framework rules. |
| `stream` | `boolean` | No | `true` | Uses streaming when the provider supports it. |
| `defaultApproval` | `"danger" \| "kind"` | No | `"danger"` | Declaration-time approval policy for tools that omit confirm. |
| `minActionIntervalMs` | `number` | No | `0` | Minimum delay between actions in the same model turn. Useful when UI transitions need to remain visible. |
| `retry.maxRetries` | `number` | No | `3` | Additional model-request retries after the first attempt. Valid range is 0–5. |
| `retry.baseDelayMs` | `number` | No | `500` | Initial exponential-backoff delay. |
| `retry.maxDelayMs` | `number` | No | `4000` | Maximum delay for one retry. |
| `limits.maxTurns` | `number` | No | `10` | Maximum model/tool round trips within one send. |
| `limits.contextTokens` | `number` | No | `8192` | Estimated conversation context budget. |
| `limits.reserveForOutput` | `number` | No | `1024` | Tokens reserved for the model response inside the context budget. |
| `limits.compactRatio` | `number` | No | `0.8` | History is compacted when estimated usage reaches this ratio of the usable budget. Valid range is (0, 1]. |
| `limits.keepRecent` | `number` | No | `6` | Recent history entries kept verbatim during compaction. |

**Example 1 · Override only the necessary fields**

```ts
const config = {
  model: "gpt-4.1-mini",
  maxTokens: 1600,
  limits: { maxTurns: 14, keepRecent: 8 },
  retry: { maxRetries: 2 },
};
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-hookregistry"></a>

### `HookRegistry`

PreToolUse and PostToolUse hooks for application policy, redaction, and audit without adding a second executor.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
class HookRegistry {
  addPreToolUse(handler: PreToolUseHandler): () => void;
  addPostToolUse(handler: PostToolUseHandler): () => void;
  firePreToolUse(payload: PreToolUsePayload): Promise<{ blocked: boolean; reason?: string }>;
  firePostToolUse(payload: PostToolUsePayload): Promise<ExecResult>;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `addPreToolUse(handler)` | `PreToolUseHandler` | No | — | Adds a hook before execution. Returns an unsubscribe function. Returning { blocked: true, reason } stops the tool. |
| `addPostToolUse(handler)` | `PostToolUseHandler` | No | — | Adds a hook after execution. It may return a replacement ExecResult for later hooks and the caller. |
| `payload.id` | `string` | No | — | Original page action id. |
| `payload.tool` | `string` | No | — | Model-facing legal tool name. |
| `payload.args` | `Record<string, unknown>` | No | — | Validated call arguments. |
| `payload.turn` | `number` | No | — | Current model/tool turn. |
| `payload.result` | `ExecResult` | No | — | Post-hook only: current execution result before this hook runs. |

**Example 1 · Block and rewrite tool results**

```ts
const hooks = new HookRegistry();
hooks.addPreToolUse(({ id }) => id === "delete_all" ? { blocked: true, reason: "批量删除已禁用" } : undefined);
hooks.addPostToolUse(({ result }) => redactResult(result));
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-sessionevent"></a>

### `SessionEvent`

The single event stream consumed by chat, activity, audit, and evaluation views.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
type SessionEvent =
  | { type: "user"; text: string }
  | { type: "assistant"; text: string }
  | { type: "assistant_delta"; text: string }
  | { type: "tool_call"; id: string; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; tool: string; result: ExecResult }
  | { type: "blocked"; id: string; tool: string; reason: string }
  | { type: "handoff"; id: string; tool: string; status: "requested" | "completed" | "cancelled" | "timeout"; reason: string }
  | { type: "notice"; text: string }
  | { type: "final"; text: string }
  | { type: "cancelled" }
  | { type: "error"; code: string; message: string; messageKey?: string; params?: MessageParams };
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `type: "user"` | `{ text: string }` | No | — | Echo of the user's input. |
| `type: "assistant"` | `{ text: string }` | No | — | Non-final assistant narration. |
| `type: "assistant_delta"` | `{ text: string }` | No | — | Streaming increment, not accumulated text. |
| `type: "tool_call"` | `{ id; tool; args }` | No | — | A tool is about to execute. |
| `type: "tool_result"` | `{ id; tool; result: ExecResult }` | No | — | The structured result of a tool call. |
| `type: "blocked"` | `{ id; tool; reason }` | No | — | A hook blocked the tool before execution. |
| `type: "handoff"` | `{ id; tool; status; reason }` | No | — | Human handoff requested or resolved. |
| `type: "notice"` | `{ text: string }` | No | — | Loop-level guidance such as a turn limit or empty response. |
| `type: "final"` | `{ text: string }` | No | — | Final assistant answer for this send. |
| `type: "cancelled"` | `{}` | No | — | The user cancelled the run. |
| `type: "error"` | `{ code; message; messageKey?; params? }` | No | — | A loop or model error. code remains the authoritative identifier. |

**Example 1 · Audit the event stream**

```ts
for await (const event of runtime.session.events) {
  if (event.type === "tool_result") audit(event);
}
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-agenttraceoptions"></a>

### `AgentTraceOptions`

Bounds the number of model calls retained by the read-only inspector.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
interface AgentTraceOptions { maxCalls?: number }
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `maxCalls` | `number` | No | `20` | Maximum model calls retained in the in-memory inspector. Omit it to use the default; lower values bound memory in long sessions. |

**Example 1 · Keep the last eight calls**

```ts
const trace = { maxCalls: 8 };
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-waitfor"></a>

### `waitFor`

Waits for an asynchronous UI condition inside a run or expectation.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Shared package
waitFor(check: () => boolean | Promise<boolean>, options?: WaitForOptions): Promise<boolean>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `check` | `() => boolean \| Promise<boolean>` | Yes | — | Predicate to evaluate. It is checked immediately and then at the configured interval. |
| `options.timeout` | `number` | No | `2000` | Maximum wait. Zero checks once without waiting. Timeout returns false rather than throwing. |
| `options.interval` | `number` | No | `30` | Delay between checks. |
| `options.now` | `() => number` | No | — | Clock injection for deterministic tests. |
| `options.sleep` | `(ms: number) => Promise<void>` | No | — | Sleep injection for deterministic tests. |
| `options.signal` | `AbortSignal` | No | — | Cancels the wait and returns false as soon as it is aborted. |

**Example 1 · Wait inside a custom runner**

```ts
await waitFor(() => document.querySelector(".saved"), { timeout: 1500 });
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


<a id="api-describeflow"></a>

### `describeFlow`

Produces a model-readable description of a compound action without executing it.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Shared package
describeFlow(report: FlowReport): string
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `report` | `FlowReport` | Yes | — | Result returned by a flow execution. The formatter reports completed, failed, skipped, handoff, and expectation states. |

**Example 1 · Render a flow receipt**

```ts
const text = describeFlow(result.resume?.report ?? report);
```

**Canonical reference**

[Open the corresponding reference](/reference/core-declarations-actions-records-regions-state)


## External Agent Surface

Vue wrappers for exposing declared capabilities through a Surface gateway. They manage credentials and transport; the capability allowlist and human approval stay in the application.

| API | Kind | Reference |
| --- | --- | --- |
| [SurfaceTask](#api-surfacetask) | Interface | [Reference](/reference/guided-task-api) |
| [SurfaceTaskField](#api-surfacetaskfield) | Interface | [Reference](/reference/guided-task-api) |
| [SurfaceTaskStep](#api-surfacetaskstep) | Interface | [Reference](/reference/guided-task-api) |

<a id="api-surfacetask"></a>

### `SurfaceTask`

A business task exposed to external agents. It explains which capabilities belong together, but it is not an authorization grant.

**Imports**

`@plingjs/surface`

**Signature**

```ts
// Shared package
interface SurfaceTask {
  id: string;
  title: string;
  description?: string;
  examples?: readonly string[];
  risk?: SurfaceEffect;
  fields?: readonly SurfaceTaskField[];
  steps?: readonly SurfaceTaskStep[];
  playbook?: readonly string[];
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Stable task id for external agents. |
| `title` | `string` | Yes | — | Human-facing task name. |
| `description` | `string` | No | — | What the task accomplishes and when it is appropriate. |
| `examples` | `readonly string[]` | No | — | Example requests an external agent can adapt. |
| `risk` | `"read" \| "write" \| "destructive"` | No | — | Risk hint. The actual capability and session scope still decide whether an invoke is allowed. |
| `fields` | `readonly SurfaceTaskField[]` | No | — | Descriptions of the values the task needs. |
| `steps` | `readonly SurfaceTaskStep[]` | No | — | Existing capabilities that make up the task. |
| `playbook` | `readonly string[]` | No | — | Ordered operating notes for an external agent. |

**Example 1 · Describe a task without granting it**

```ts
const tasks: SurfaceTask[] = [{
  id: "order.approve",
  title: "审批订单",
  steps: [{ action: "approve@order", label: "批准当前订单" }],
  risk: "destructive",
  playbook: ["先用 describe 读取订单字段", "确认订单状态后再调用审批能力"],
}];
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-surfacetaskfield"></a>

### `SurfaceTaskField`

A descriptive field in a Surface task. Agents still send values only through the existing capability input schema.

**Imports**

`@plingjs/surface`

**Signature**

```ts
// Shared package
interface SurfaceTaskField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "boolean" | "date" | "select" | "lookup";
  description?: string;
  required?: boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `name` | `string` | Yes | — | Field name used in the task description. |
| `label` | `string` | Yes | — | Human-facing field label. |
| `type` | `"text" \| "textarea" \| "number" \| "boolean" \| "date" \| "select" \| "lookup"` | No | — | Input kind hint. |
| `description` | `string` | No | — | What the value means or how to obtain it. |
| `required` | `boolean` | No | — | Whether the task normally needs this value. |

**Example 1 · Describe a lookup field**

```ts
const fields: SurfaceTaskField[] = [{
  name: "studentRef",
  label: "学员",
  type: "lookup",
  required: true,
  description: "先搜索学员，再把返回值传给后续能力。",
}];
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


<a id="api-surfacetaskstep"></a>

### `SurfaceTaskStep`

A descriptive step that names an existing capability. It never adds a second execution path.

**Imports**

`@plingjs/surface`

**Signature**

```ts
// Shared package
interface SurfaceTaskStep {
  action: string;
  label: string;
  summary?: string;
  optional?: boolean;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `action` | `string` | Yes | — | Existing capability id. |
| `label` | `string` | Yes | — | Human-facing step name. |
| `summary` | `string` | No | — | Why the step exists or what it checks. |
| `optional` | `boolean` | No | — | Whether the step can be skipped. |

**Example 1 · Name existing capabilities only**

```ts
const steps: SurfaceTaskStep[] = [
  { action: "search_orders", label: "搜索订单" },
  { action: "approve@order", label: "批准订单", optional: false },
];
```

**Canonical reference**

[Open the corresponding reference](/reference/guided-task-api)


## Page identity and continuity

Read page identity, share a runtime across frames, and inspect declared coverage.

| API | Kind | Reference |
| --- | --- | --- |
| [PlingPage](#api-plingpage) | Interface | [Reference](/reference/continuity-and-projection) |
| [createPlingPage](#api-createplingpage) | Function | [Reference](/reference/continuity-and-projection) |
| [sharePlingPageWithFrame](#api-shareplingpagewithframe) | Function | [Reference](/reference/continuity-and-projection) |
| [plingPageFromParent](#api-plingpagefromparent) | Function | [Reference](/reference/continuity-and-projection) |
| [waitForPlingPageFromParent](#api-waitforplingpagefromparent) | Function | [Reference](/reference/continuity-and-projection) |
| [inspectCoverage](#api-inspectcoverage) | Method | [Reference](/reference/vue-3-adapter) |

<a id="api-plingpage"></a>

### `PlingPage`

A page-level runtime shared by multiple framework islands or same-origin frames.

**Imports**

`@plingjs/dom`

**Signature**

```ts
// Shared package
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

`@plingjs/dom`

**Signature**

```ts
// Shared package
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

`@plingjs/dom`

**Signature**

```ts
// Shared package
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

`@plingjs/dom`

**Signature**

```ts
// Shared package
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

`@plingjs/dom`

**Signature**

```ts
// Shared package
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

`@plingjs/dom`

**Signature**

```ts
// Shared package
inspectCoverage(root: Element | null): CoverageReport
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

**Example 1 · Inspect a DOM root**

```ts
const report = inspectCoverage(document.querySelector("#app"));
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


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
| [createGuideActions](#api-createguideactions) | Function | [Reference](/reference/guided-task-api) |
| [GuideActionItem](#api-guideactionitem) | Interface | [Reference](/reference/guided-task-api) |

<a id="api-createtaskcontroller"></a>

### `createTaskController`

Creates a framework-independent task controller. The host supplies the only execution bridge through invoke.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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
// Shared package
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


## Testing and execution helpers

Deterministic model replay, evaluation, page-context rendering, and the core executor used by tests, external agents, and advanced hosts.

| API | Kind | Reference |
| --- | --- | --- |
| [createReplayLlm](#api-createreplayllm) | Function | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [EvalCase](#api-evalcase) | Type | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [runEvaluation](#api-runevaluation) | Function | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [createAgentLoop](#api-createagentloop) | Function | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [defaultSettle](#api-defaultsettle) | Function | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [renderPageContext](#api-renderpagecontext) | Function | [Reference](/reference/agent-runtime-sessions-context-limits) |
| [createExecutor](#api-createexecutor) | Function | [Reference](/reference/surface-protocol) |
| [createPolicy](#api-createpolicy) | Function | [Reference](/reference/surface-protocol) |

<a id="api-createreplayllm"></a>

### `createReplayLlm`

Creates a deterministic model from scripted turns. It exercises the real loop, tool dispatch, approvals, and failure path without a network call.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
createReplayLlm(turns: readonly ReplayTurn[]): ReplayLlm
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `turns[].content` | `string` | No | — | Assistant text returned for that turn. |
| `turns[].calls` | `readonly ReplayCall[]` | No | — | Tool calls requested in that turn. |
| `turns[].calls[].tool` | `string` | Yes | — | Original page action id. The replay adapter converts it to the model-facing tool name. |
| `turns[].calls[].args` | `Record<string, unknown>` | No | — | Arguments serialized into the tool call. |
| `turns[].calls[].id` | `string` | No | — | Explicit tool-call id. A deterministic id is generated when omitted. |

**Type shape**

```ts
interface ReplayCall {
  tool: string;
  args?: Record<string, unknown>;
  id?: string;
}

interface ReplayTurn {
  content?: string;
  calls?: readonly ReplayCall[];
}

interface ReplayLlm extends Llm {
  readonly received: readonly (readonly LlmMessage[])[];
  readonly toolsSeen: readonly (readonly LlmToolSchema[])[];
  readonly turn: number;
  reset(): void;
}
```

**Example 1 · Replay a two-step task**

```ts
const llm = createReplayLlm([
  { content: "先添加待办。", calls: [{ tool: "add_task", args: { text: "准备发布" } }] },
  { content: "已经添加。" },
]);
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-evalcase"></a>

### `EvalCase`

One evaluation case: input, expected and forbidden actions, an optional tool-error budget, and a business-state check.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
interface EvalCase {
  name?: string;
  input: string;
  expectIncludes?: readonly string[];
  expectTools?: readonly string[];
  expectNotTools?: readonly string[];
  maxToolErrors?: number;
  verify?: () => boolean | Promise<boolean>;
}
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `name` | `string` | No | — | Display name. Defaults to the input text. |
| `input` | `string` | Yes | — | User message sent to the evaluated agent run. |
| `expectIncludes` | `readonly string[]` | No | — | Strings that must appear in the final answer. |
| `expectTools` | `readonly string[]` | No | — | Action ids that must be called. |
| `expectNotTools` | `readonly string[]` | No | — | Action ids that must not be called. |
| `maxToolErrors` | `number` | No | — | Maximum number of tool errors allowed for the case. |
| `verify` | `() => boolean \| Promise<boolean>` | No | — | Business-state assertion executed after the run. |

**Example 1 · Assert a completed task**

```ts
const testCase = {
  name: "完成第一条待办",
  input: "把第一条待办标记为完成",
  expectTools: ["toggle_task"],
  expectNotTools: ["delete_task"],
  verify: () => todos[0].done === true,
};
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-runevaluation"></a>

### `runEvaluation`

Runs a set of EvalCase entries through one host callback, resets state between cases, and returns a pass/fail report.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
runEvaluation(options: EvaluateOptions): Promise<EvalReport>
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `run` | `(input: string) => Promise<string>` | Yes | — | Executes one case and returns the final assistant answer. |
| `hooks` | `HookRegistry` | Yes | — | Hooks whose pre/post events are observed for this evaluation. |
| `cases` | `readonly EvalCase[]` | Yes | — | Cases to run in order. |
| `reset` | `() => void \| Promise<void>` | No | — | Resets application state between cases. |
| `measure` | `() => EvalMetrics` | No | — | Returns tokens, duration, cost, or other numeric metrics per case. |
| `events` | `() => readonly SessionEvent[]` | No | — | Returns the event stream for the most recent run. |

**Type shape**

```ts
interface EvaluateOptions {
  run: (input: string) => Promise<string>;
  hooks: HookRegistry;
  cases: readonly EvalCase[];
  reset?: () => void | Promise<void>;
  measure?: () => EvalMetrics;
  events?: () => readonly SessionEvent[];
}
```

**Example 1 · Run a small deterministic suite**

```ts
const report = await runEvaluation({
  run: (input) => session.send(input),
  hooks,
  cases: [completeFirstTodo],
  reset: () => store.reset(),
});
console.log(formatReport(report));
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-createagentloop"></a>

### `createAgentLoop`

Creates the lower-level conversation loop for tests and custom hosts. Most applications should use AgentSetup or createAgentRuntime instead.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
createAgentLoop(options: LoopOptions): AgentLoop
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `llm` | `Llm` | Yes | — | Model call implementation. |
| `registry` | `Registry` | No | — | Page capability registry. Omit it for a chat-only loop. |
| `policy` | `ConfirmGate` | No | — | Approval gate. Omit it for fail-closed behavior when a tool needs approval. |
| `handoff` | `HandoffGate` | No | — | Human-handoff gate. Omit it to fail handoff tools rather than simulate them. |
| `systemPrompt` | `string` | No | — | Additional system instructions. Framework rules remain in force. |
| `responseLocale` | `string \| (() => string)` | No | — | Response-language hint; a function is re-read each turn. |
| `context` | `ContextOptions` | No | — | Bounds page context and may configure the live clock used before each model request. |
| `history` | `HistoryOptions` | No | — | Context budget, compaction threshold, recent retention, and tool-result cap. |
| `historyState` | `HistorySnapshot` | No | — | Restores a summary and message list from a checkpoint. System context is rebuilt for the current page. |
| `hooks` | `HookRegistry` | No | — | Tool lifecycle hooks. |
| `telemetry` | `Telemetry` | No | — | Token, duration, cost, and retry metrics. |
| `trace` | `AgentTraceRecorder` | No | — | Bounded request trace for diagnostics. |
| `maxTurns` | `number` | No | `10` | Maximum model/tool round trips in one run. |
| `loopThreshold` | `number` | No | — | Repeated identical tool calls before LOOP_DETECTED. |
| `errorBudget` | `number` | No | — | Cumulative tool failures before the loop asks the model to answer directly. |
| `maxNudges` | `number` | No | — | Consecutive empty model replies allowed before stopping. |
| `settle` | `() => Promise<void>` | No | — | Waits for DOM, animation, and navigation to settle before snapshots. |
| `minActionIntervalMs` | `number` | No | `0` | Minimum delay between actions in one model turn. |
| `sleep` | `(ms: number) => Promise<void>` | No | — | Sleep injection for deterministic tests. |
| `shouldStop` | `() => boolean` | No | — | Cooperative cancellation checked at safe points. |
| `observe` | `(id: string, args: Record<string, unknown>) => void \| Promise<void>` | No | — | Post-action observation hook supplied to the executor. |
| `evidence` | `boolean` | No | `true` | Captures before/after snapshots and attaches changed evidence. |
| `onEvent` | `(event: SessionEvent) => void` | No | — | Session event callback. |
| `now` | `() => number` | No | — | Clock injection for deterministic tests. |

**Example 1 · Create a page-operating loop**

```ts
const loop = createAgentLoop({
  llm,
  registry: pling.registry,
  policy: createPolicy(confirm),
  maxTurns: 12,
  evidence: true,
});
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-defaultsettle"></a>

### `defaultSettle`

Waits for DOM updates, one browser frame, and a short idle window before the next page snapshot is read.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
defaultSettle(): Promise<void>
```

**Parameters**

None.

**Example 1 · Use the browser settle strategy**

```ts
const settle = defaultSettle;
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-renderpagecontext"></a>

### `renderPageContext`

Renders the bounded page context sent to the model: regions, actions, records, state, feedback, and page identity.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
renderPageContext(snapshot: Snapshot, options?: ContextOptions): string
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `snapshot` | `Snapshot` | Yes | — | Bounded page snapshot produced by the registry. |
| `options.maxActions` | `number` | No | `40` | Maximum actions listed, default 40. |
| `options.maxRecords` | `number` | No | `20` | Maximum record rows listed, default 20. |
| `options.includeState` | `boolean` | No | `true` | Whether read-only state views are included. |
| `options.maxIdsInHint` | `number` | No | `30` | Maximum action ids repeated in hints, default 30. |
| `options.maxUnavailable` | `number` | No | `6` | Maximum unavailable actions listed, default 6. |
| `options.maxStateChars` | `number` | No | `1200` | Character budget for state, default 1200. |
| `options.maxRecordChars` | `number` | No | `1500` | Character budget for records, default 1500. |
| `options.maxScopes` | `number` | No | `24` | Maximum page regions listed, default 24. |
| `options.maxFeedback` | `number` | No | `8` | Maximum feedback entries listed, default 8. |
| `options.maxFeedbackChars` | `number` | No | `800` | Character budget for feedback, default 800. |
| `options.maxPageChars` | `number` | No | `500` | Character budget for page identity, default 500. |
| `options.clock` | `AgentClock` | No | — | Adds the current instant and viewer/business local times to this page context. |

**Example 1 · Render a smaller context**

```ts
const text = renderPageContext(registry.snapshot(), {
  maxActions: 20,
  maxRecords: 8,
  maxStateChars: 600,
});
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


<a id="api-createexecutor"></a>

### `createExecutor`

Creates the shared executor used by the in-page agent and external Surface hosts. It is the only path that applies policy, availability, execution, and success checks.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Shared package
createExecutor(options: ExecutorOptions): Executor
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `registry` | `Registry` | Yes | — | Registry that resolves actions and computes snapshots. |
| `policy` | `ConfirmGate` | Yes | — | Approval gate applied before an action executes. |
| `handoff` | `HandoffGate` | No | — | Human-handoff gate for tools declared with handoff. |
| `observe` | `(id: string, args: Record<string, unknown>) => void \| Promise<void>` | No | — | Observation window after execution, for routes, async rendering, or animation. |
| `evidence` | `boolean` | No | `true` | Captures changed evidence and includes it in successful results. |
| `settle` | `() => Promise<void>` | No | — | Wait used before the after-snapshot. |
| `betweenSteps` | `() => Promise<void>` | No | — | Optional pause between steps in a flow. |
| `return.execute` | `(id: string, argsJson?: string) => Promise<ExecResult>` | No | — | Executes one action and never throws action errors to the caller. |

**Type shape**

```ts
interface ExecutorOptions {
  registry: Registry;
  policy: ConfirmGate;
  handoff?: HandoffGate;
  observe?: (id: string, args: Record<string, unknown>) => void | Promise<void>;
  evidence?: boolean;
  settle?: () => Promise<void>;
  betweenSteps?: () => Promise<void>;
}
```

**Example 1 · Execute through the shared pipeline**

```ts
const executor = createExecutor({
  registry: pling.registry,
  policy: createPolicy(confirm),
});

const result = await executor.execute("add", JSON.stringify({ text: "准备发布" }));
```

**Canonical reference**

[Open the corresponding reference](/reference/surface-protocol)


<a id="api-createpolicy"></a>

### `createPolicy`

Creates a confirmation policy. With no confirmation channel it fails closed and denies actions that require approval.

**Imports**

`@plingjs/core`

**Signature**

```ts
// Shared package
createPolicy(confirm?: Confirm | null): Policy
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `confirm` | `Confirm \| null` | No | `null` | Approval callback. Null means no confirmation channel; actions requiring approval fail closed. |
| `request.id` | `string` | No | — | Action id being approved. |
| `request.kind` | `Kind` | No | — | Action risk level. |
| `request.approval` | `Approval` | No | — | Resolved approval policy for this action. |
| `request.description` | `string` | No | — | Model-facing description shown to the approver. |
| `request.args` | `Record<string, unknown>` | No | — | Validated call arguments. |
| `request.flow.steps` | `readonly string[]` | No | — | Step ids for a one-approval composite flow. |

**Example 1 · Connect a confirmation dialog**

```ts
const policy = createPolicy(async (request) => {
  return window.confirm(request.description) ? true : false;
});
```

**Canonical reference**

[Open the corresponding reference](/reference/surface-protocol)


## Diagnostics and errors

Stable error codes and localized rendering helpers. Codes remain authoritative across locales.

| API | Kind | Reference |
| --- | --- | --- |
| [describePlingError](#api-describeplingerror) | Function | [Reference](/reference/error-codes-and-diagnostics) |
| [describePlingDiagnostic](#api-describeplingdiagnostic) | Function | [Reference](/reference/error-codes-and-diagnostics) |
| [resolveAgentConfig](#api-resolveagentconfig) | Function | [Reference](/reference/agent-runtime-sessions-context-limits) |

<a id="api-describeplingerror"></a>

### `describePlingError`

Renders a Pling error through the shared message catalog while preserving the machine-readable code.

**Imports**

`@plingjs/ui`

**Signature**

```ts
// Shared package
describePlingError(error: PlingErrorText, t: PlingTranslator): string
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `error.code` | `string` | Yes | — | Stable machine-readable error code. The code is preserved in the rendered summary. |
| `error.message` | `string` | No | — | Developer detail added after the localized label when it adds information. |
| `error.messageKey` | `string` | No | — | Fully localized catalog key, used before the generic code mapping. |
| `error.params` | `MessageParams` | No | — | Interpolation values for the catalog message. |
| `t` | `PlingTranslator` | Yes | — | Translator that receives a message key and interpolation values. |

**Example 1 · Render a localized error**

```ts
const text = describePlingError(
  { code: "EXPECTATION_FAILED", message: "未等到新行出现" },
  pling.ui.t,
);
```

**Canonical reference**

[Open the corresponding reference](/reference/error-codes-and-diagnostics)


<a id="api-describeplingdiagnostic"></a>

### `describePlingDiagnostic`

Renders a structured configuration diagnostic, including missing model fields and invalid limits.

**Imports**

`@plingjs/ui`

**Signature**

```ts
// Shared package
describePlingDiagnostic(diagnostic: PlingDiagnosticText, t: PlingTranslator): string
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `diagnostic.ready` | `boolean` | Yes | — | When true, the function returns an empty string. |
| `diagnostic.code` | `string` | No | — | Stable diagnostic code such as MODEL_BASE_URL_MISSING or LIMITS_INVALID. |
| `diagnostic.params` | `MessageParams` | No | — | Non-sensitive interpolation values such as the environment variable name. |
| `diagnostic.hint` | `string` | No | — | Developer-facing fallback used only when no structured code exists. |
| `t` | `PlingTranslator` | Yes | — | Translator used for the diagnostic catalog. |

**Example 1 · Render configuration guidance**

```ts
const hint = describePlingDiagnostic(
  { ready: false, code: "MODEL_NAME_MISSING", params: { env: "VITE_AGENT_MODEL" } },
  pling.ui.t,
);
```

**Canonical reference**

[Open the corresponding reference](/reference/error-codes-and-diagnostics)


<a id="api-resolveagentconfig"></a>

### `resolveAgentConfig`

Merges defaults, environment variables, and explicit overrides into the final model configuration.

**Imports**

`@plingjs/agent`

**Signature**

```ts
// Shared package
resolveAgentConfig(options?: { env?; config? }): AgentConfig
```

**Parameters and options**

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options.env` | `Record<string, unknown>` | No | — | Environment-like object. Browser adapters normally pass import.meta.env; Node callers can pass process.env. |
| `options.config` | `AgentConfigOverrides` | No | — | Explicit overrides applied after defaults and environment values. |

**Example 1 · Resolve configuration outside an adapter**

```ts
const config = resolveAgentConfig({
  env: import.meta.env,
  config: { model: "gpt-4.1-mini", limits: { maxTurns: 12 } },
});
```

**Canonical reference**

[Open the corresponding reference](/reference/agent-runtime-sessions-context-limits)


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

- [JSON for this page](/api-index/shared.json)
- [API overview JSON](/api-index.json)
