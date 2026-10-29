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
| `@plingjs/core` | — | `0.1.0-alpha.2` |

The current package version is `0.1.0-alpha.2`; stability is **preview**. This is a pre-1.0 alpha, so a minor release may still change the API.

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

Scans the mounted page for interactive controls that have no declaration. It reports; it never registers an action.

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
| `return.total` | `number` | No | — | Recognized actionable controls in the root. |
| `return.declared` | `number` | No | — | Controls with a direct declaration. |
| `return.derived` | `number` | No | — | Controls produced by optional L1 derivation. |
| `return.grouped` | `number` | No | — | Controls covered by a declaration on an ancestor. Review these manually. |
| `return.missing` | `number` | No | — | Actionable controls with no declaration in their ancestry. |
| `return.coveragePercent` | `number \| null` | No | — | Covered controls divided by total; null when there are no controls. |
| `return.targets` | `CoverageTarget[]` | No | — | Grouped and missing controls with labels and nearby action ids. |

**Example 1 · Inspect a DOM root**

```ts
const report = inspectCoverage(document.querySelector("#app"));
```

**Canonical reference**

[Open the corresponding reference](/reference/vue-3-adapter)


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
| `context` | `ContextOptions` | No | — | Bounds for actions, records, state, scopes, feedback, and page identity in model context. |
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
| `@plingjs/vue` | `0.1.0-alpha.2` | `vue ^3` |
| `@plingjs/react` | `0.1.0-alpha.2` | `react >=18` |
| `@plingjs/vue2` | `0.1.0-alpha.2` | `vue ^2.7.0` |
| `@plingjs/vanilla` | `0.1.0-alpha.2` | — |

| Item | Value |
| --- | --- |
| Introduced | `0.1.0-alpha.2` |
| Stability | Pre-1.0 alpha; a minor release may change the API |

## Machine-readable copy

- [JSON for this page](/api-index/shared.json)
- [API overview JSON](/api-index.json)
