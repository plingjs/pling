---
title: "共享包 API"
status: navigation
release: 0.1
locale: zh
---
<!-- generated:api-index -->

# 共享包 API

四个适配器共用的运行时、页面连续性、测试与诊断 API。请从对应的共享包导入；这里没有第二套适配器实现。

本页覆盖 `@plingjs/core`、`@plingjs/agent`、`@plingjs/dom` 与 `@plingjs/ui` 中的共享公开 API。

[API 总览](/zh/reference/api/) · [共享包 API](/zh/reference/api/shared)

| 包 | 对等依赖 | 版本 |
| --- | --- | --- |
| `@plingjs/core` | — | `0.1.0-alpha.3` |

当前包版本为 `0.1.0-alpha.3`；稳定性为 **preview**。这是 pre-1.0 alpha，次要版本仍可能改变 API。

## 最小示例

```ts
import { createExecutor, createPolicy } from "@plingjs/core";
import { createReplayLlm } from "@plingjs/agent";
```

## 页面声明

声明动作、记录、区域、状态、页面反馈、任务入口与敏感值。

| API | 类型 | 参考 |
| --- | --- | --- |
| [sensitive](#api-sensitive) | 函数 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |

<a id="api-sensitive"></a>

### `sensitive`

标记一个值在出站时隐藏、遮罩、代号化或只给提示，同时保留字段名。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
sensitive<T>(value: T, options?: SensitivityMode | SensitiveOptions): SensitiveValue<T>
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `value` | `T` | 是 | — | 会进入页面上下文与模型对话的值。 |
| `options` | `"masked" \| "hidden" \| SensitiveOptions` | 否 | `"masked"` | 控制模型看到占位代号还是不看到值。真值仍留在浏览器内。 |

**示例 1 · 脱敏电话号码**

```ts
const phone = sensitive(customer.phone, "masked");
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


## 共享选项类型

声明所引用的选项结构。适配器使用不同名称时，会同时列出别名。

| API | 类型 | 参考 |
| --- | --- | --- |
| [RecordValue](#api-recordvalue) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [Kind](#api-kind) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [ParamDeclaration](#api-paramdeclaration) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [Expectation](#api-expectation) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [HandoffStep](#api-handoffstep) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [FlowStep](#api-flowstep) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [RegionRole](#api-regionrole) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [PlingUiOptions](#api-plinguioptions) | 类型 | [参考](/zh/reference/ui-messages-theme-locale) |

<a id="api-recordvalue"></a>

### `RecordValue`

一行数据，或带显式 id、label、fields 的完整记录声明。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
type RecordValue =
  | object
  | {
      data: object;
      id?: string | number;
      label?: string;
      fields?: Record<string, unknown>;
    }
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `plain object.id \| key` | `string \| number` | 否 | — | 直接把行对象作为记录时，默认从 `id` 或 `key` 读取主键。 |
| `envelope.data` | `object` | 条件必填 | — | 使用显式记录包装时承载的行数据。 |
| `envelope.id` | `string \| number` | 否 | — | 主键字段不叫 `id` / `key` 时用它覆盖。 |
| `envelope.label` | `string` | 否 | — | 给人也给模型看的行说明。 |
| `envelope.fields` | `Record<string, unknown>` | 否 | — | 模型可见字段白名单。不写时暴露除主键外的全部行字段。 |

**示例 1 · 显式字段白名单**

```ts
const value = {
  data: order,
  id: order.code,
  label: `订单 ${order.code}`,
  fields: { customer: order.customer, total: order.total },
};
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-kind"></a>

### `Kind`

动作的风险等级，供确认策略使用。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
type Kind = "read" | "write" | "danger"
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `read` | `"read"` | 否 | — | 不改变业务状态。查看、导航和检查属于这一档。 |
| `write` | `"write"` | 否 | — | 改变业务状态，但不是破坏性或不可逆操作。 |
| `danger` | `"danger"` | 否 | — | 破坏性、不可逆或影响较大的操作。确认策略默认更严格。 |

**示例 1 · 选择风险等级**

```ts
pling.tool(deleteButton, { desc: "删除此订单", kind: "danger" });
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-paramdeclaration"></a>

### `ParamDeclaration`

用于校验动作参数的数组简写或 JSON Schema。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
type ParamDeclaration = readonly ToolParam[] | JsonSchema
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `[].name` | `string` | 是 | — | `run` 收到的参数键，也是模型看到的参数名。 |
| `[].label` | `string` | 是 | — | 必填的参数说明，是模型唯一可依赖的语义提示。 |
| `[].type` | `"string" \| "number" \| "boolean"` | 否 | `"string"` | 参数类型。会把明显的字符串形式规整为对应类型，并拒绝无效值。 |
| `[].optional` | `boolean` | 否 | `false` | 把参数标为可选。参数默认必填。 |
| `[].values` | `readonly (string \| number)[]` | 否 | — | 静态封闭值集合。模型只能从已知值里选择时使用。 |
| `[].options` | `() => readonly ParamOption[]` | 否 | — | 动态值集合，每次快照与执行前重新读取。 |
| `[].min \| [].max` | `number \| (() => number)` | 否 | — | 数字参数的上下界，也支持动态边界。 |
| `[].minLength \| [].maxLength` | `number` | 否 | — | 字符串长度边界。 |
| `[].pattern` | `RegExp \| string` | 否 | — | 字符串参数的正则约束。 |
| `[].format` | `"date"` | 否 | — | 语义格式校验。`date` 还要求是真实存在的日期。 |
| `JSON Schema.type` | `"object"` | 条件必填 | `"object"` | 直接传 JSON Schema 时，根类型必须是对象。 |
| `JSON Schema.properties` | `Record<string, unknown>` | 否 | — | 直接 JSON Schema 形式的属性定义。 |
| `JSON Schema.required` | `string[]` | 否 | — | 直接 JSON Schema 形式的必填属性名。 |

**示例 1 · 参数简写**

```ts
const params = [
  { name: "orderId", label: "订单号", pattern: /^SO-\d{4}$/ },
  { name: "note", label: "新备注", maxLength: 200 },
  { name: "notify", label: "是否通知客户", type: "boolean", optional: true },
];
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-expectation"></a>

### `Expectation`

动作结束后检查的成功条件。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
interface Expectation {
  desc?: string;
  check(): boolean | Promise<boolean>;
  timeout?: number;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `desc` | `string` | 否 | — | 对预期结果的人话说明。会出现在成功与失败回执里。 |
| `check` | `() => boolean \| Promise<boolean>` | 是 | — | 执行后求值的判断函数。函数自身异常会原样抛出，不会被吞掉。 |
| `timeout` | `number` | 否 | `2000` | 成立前的最长等待时间；超过后报告 `EXPECTATION_FAILED`。 |

**示例 1 · 确认新记录真的出现**

```ts
const expect = {
  desc: "新待办出现在列表中",
  check: () => todos.some((todo) => todo.text === "准备发布"),
  timeout: 3000,
};
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-handoffstep"></a>

### `HandoffStep`

人工接力时展示给用户的一条步骤说明。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
interface HandoffStep {
  text: string;
  highlight?: string;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `text` | `string` | 是 | — | 交给接手人看的操作说明。 |
| `highlight` | `string` | 否 | — | 可选的高亮目标：引导目标 id 或动作 id。 |

**示例 1 · 引导人工步骤**

```ts
const steps = [
  { text: "填写短信验证码", highlight: "captcha" },
  { text: "点击提交", highlight: "submit" },
];
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-flowstep"></a>

### `FlowStep`

复合动作中的一步。步骤不是第二条执行通道。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
interface FlowStep {
  action: string;
  args?: Record<string, unknown> | ((params: Record<string, unknown>) => Record<string, unknown>);
  expect?: Expectation;
  desc?: string;
  optional?: boolean;
  idempotent?: boolean;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `action` | `string` | 是 | — | 要执行的已注册动作 id，可包含 `{{参数}}` 占位符。 |
| `args` | `Record<string, unknown> \| ((params) => Record<string, unknown>)` | 否 | — | 步骤参数。字符串可引用流程参数；函数形式收到完整参数对象。 |
| `expect` | `Expectation` | 否 | — | 覆盖该步骤动作自身声明的成功判据。 |
| `desc` | `string` | 否 | — | 用于进度与回执的人话步骤说明。 |
| `optional` | `boolean` | 否 | `false` | 可选步骤失败时跳过，不中断整个流程。 |
| `idempotent` | `boolean` | 否 | `false` | 允许执行后或判据失败后重试。执行前失败本身就可以重试。 |

**示例 1 · 在步骤中引用参数**

```ts
const steps = [
  { action: "edit@order:{{orderId}}", desc: "打开订单" },
  { action: "dialog_note", args: { text: "{{note}}" }, desc: "填写备注" },
  { action: "dialog_save", desc: "保存" },
];
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-regionrole"></a>

### `RegionRole`

区域的结构角色。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `role` | `"page" \| "header" \| "nav" \| "main" \| "aside" \| "section" \| "form" \| "dialog" \| "toolbar" \| "list" \| "footer"` | 是 | — | 为同名动作提供结构上下文。它不会授予或限制权限。 |

**示例 1 · 区分两个确认按钮**

```ts
pling.scope(dialog, { id: "edit_dialog", role: "dialog", label: "编辑订单" });
pling.scope(toolbar, { id: "bulk_toolbar", role: "toolbar", label: "批量操作" });
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-plinguioptions"></a>

### `PlingUiOptions`

共享助手界面的语言、主题、文案覆盖与类名。

**导入**

`@plingjs/ui`

**调用方式**

```ts
// 共享包
interface PlingUiOptions {
  locale?: PlingLocale;
  theme?: PlingTheme;
  messages?: PlingCatalogOverrides;
  classNames?: PlingClassNames;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `locale` | `"en-US" \| "zh-CN" \| "auto" \| string` | 否 | `en-US` | 内置助手界面的语言。传 `auto` 时跟随浏览器语言。 |
| `theme` | `"light" \| "dark" \| "auto" \| PlingThemeOverrides` | 否 | `light` | 内置界面的主题。传对象时可选择模式或覆盖设计令牌。 |
| `theme.mode` | `"light" \| "dark" \| "auto"` | 否 | `light` | 主题传对象时指定的模式。`auto` 跟随操作系统外观。 |
| `theme.tokens` | `Partial<PlingThemeTokens>` | 否 | — | 覆盖颜色、圆角、阴影、字体等单个设计令牌。未提供的键沿用所选明色或暗色主题的默认值。 |
| `messages` | `PlingCatalogOverrides` | 否 | — | 为一个或多个语言补充或替换界面文案。 |
| `messages.<locale>` | `Partial<Record<PlingMessageKey, string>>` | 否 | — | 某个 BCP 47 语言的文案覆盖。未提供的键回退到内置文案。 |
| `classNames` | `PlingClassNames` | 否 | — | 为内置对话、浮窗、启动按钮和面板附加 class。 |
| `classNames.dock` | `string` | 否 | — | 浮窗外壳的附加 class。 |
| `classNames.panel` | `string` | 否 | — | 面板外壳的附加 class。 |
| `classNames.launcher` | `string` | 否 | — | 启动按钮的附加 class。 |
| `classNames.chat` | `string` | 否 | — | 对话界面的附加 class。 |

**示例 1 · 中文界面与令牌覆盖**

```ts
const ui = {
  locale: "zh-CN",
  theme: { mode: "light", tokens: { colorPrimary: "#0b6bcb" } },
  classNames: { dock: "product-assistant" },
};
```

**精确契约**

[查看对应参考页](/zh/reference/ui-messages-theme-locale)


## Agent 运行时

模型配置、会话、确认与人工接力、钩子、跟踪，以及共享运行时辅助函数。

| API | 类型 | 参考 |
| --- | --- | --- |
| [AgentRuntimeOptions](#api-agentruntimeoptions) | 类型 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [AgentConfigOverrides](#api-agentconfigoverrides) | 类型 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [HookRegistry](#api-hookregistry) | 类 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [SessionEvent](#api-sessionevent) | 类型 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [AgentTraceOptions](#api-agenttraceoptions) | 类型 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [waitFor](#api-waitfor) | 函数 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [describeFlow](#api-describeflow) | 函数 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |

<a id="api-agentruntimeoptions"></a>

### `AgentRuntimeOptions`

AgentSetup 背后的运行时契约：配置、注册表、模型、事件、钩子、闸门、跟踪与连续性。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `config` | `AgentConfig` | 是 | — | 已经解析完成的模型与运行时配置。 |
| `registry` | `Registry` | 否 | — | 页面能力注册表。纯聊天运行时可省略。 |
| `llm` | `Llm` | 否 | — | 注入模型调用函数。可用于测试模型、服务端代理或非 OpenAI 兼容传输。 |
| `responseLocale` | `string \| (() => string)` | 否 | — | 拼接回答语言约束时使用的语言。传函数时，每次模型请求前重新读取。 |
| `telemetry` | `Telemetry` | 否 | — | 收集当前运行时的 token、耗时、成本与重试指标。 |
| `trace` | `boolean \| AgentTraceOptions` | 否 | `false` | 在内存中保留有界的模型请求记录，供只读诊断面板查看。默认关闭。 |
| `settle` | `() => Promise<void>` | 否 | — | 替换动作之间的页面落定等待。主要用于确定性测试和非浏览器宿主。 |
| `hooks` | `HookRegistry` | 否 | — | 由该应用运行时创建的界面共用的工具生命周期钩子。 |
| `onEvent` | `(event: SessionEvent) => void` | 否 | — | 接收与对话、运行视图相同的会话事件流。 |
| `onApproval` | `(pending: PendingApproval \| null) => void` | 否 | — | 确认请求出现或清除时调用。可用来接自己的确认界面。 |
| `onHandoff` | `(pending: PendingHandoff \| null) => void` | 否 | — | 人工接力请求出现或清除时调用。 |
| `policy` | `ConfirmGate` | 否 | — | 替换默认确认闸门。传入后不再使用内置闸门和对话中的确认按钮。 |
| `approvalTimeoutMs` | `number` | 否 | `60000` | 等待人工确认的最长时间；超时按拒绝处理。 |
| `handoffTimeoutMs` | `number` | 否 | `300000` | 人工接力的默认等待时间。单个工具的 `handoff.timeout` 可以覆盖。 |
| `handoff` | `HandoffGate` | 否 | — | 用自定义通道替换内置人工接力队列。 |
| `id` | `string` | 否 | — | 多会话宿主使用的稳定会话 id。 |
| `onLeaseLost` | `() => void` | 否 | — | 共享会话租约被另一个标签页或宿主接管时调用。 |
| `continuity` | `ContinuitySetting` | 否 | — | 开启跨整页导航的有界对话连续性。`"tab"` 使用 sessionStorage；省略即关闭。 |
| `gate` | `() => boolean` | 否 | `true` | 返回 `false` 时关闭该应用的内置确认通道。默认开启。 |

**示例 1 · 创建可操作页面的运行时**

```ts
const runtime = createAgentRuntime({
  config: resolveAgentConfig({ config: { model: "gpt-4.1-mini" } }),
  registry: pling.registry,
  hooks,
  trace: true,
});
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-agentconfigoverrides"></a>

### `AgentConfigOverrides`

部分模型配置。未指定的字段继续来自环境变量与默认值。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
type AgentConfigOverrides =
  Partial<Omit<AgentConfig, "limits" | "retry">> & {
    limits?: Partial<AgentLimits>;
    retry?: Partial<AgentRetryConfig>;
  };
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `baseUrl` | `string` | 否 | `""` | OpenAI 兼容接口根地址。`/llm/v1` 这类相对路径会经过应用服务器，不需要浏览器侧密钥。 |
| `model` | `string` | 否 | `""` | 发给模型服务商模型名。 |
| `apiKey` | `string` | 否 | `""` | 浏览器可见的服务商密钥。使用相对代理地址时应留空。 |
| `temperature` | `number` | 否 | `0.3` | 模型回答的采样温度。 |
| `maxTokens` | `number` | 否 | `1024` | 单次模型响应的最大输出 token。它不是整个对话的上下文预算。 |
| `systemPrompt` | `string` | 否 | `""` | 追加在框架规则之后的应用说明。不会替换框架规则。 |
| `stream` | `boolean` | 否 | `true` | 服务商支持时使用流式响应。 |
| `defaultApproval` | `"danger" \| "kind"` | 否 | `"danger"` | 工具未写 `confirm` 时的声明期确认策略。 |
| `minActionIntervalMs` | `number` | 否 | `0` | 同一模型轮次内两个动作之间的最小间隔。需要让界面过渡可见时使用。 |
| `retry.maxRetries` | `number` | 否 | `3` | 首次请求之外的重试次数。有效范围 0–5。 |
| `retry.baseDelayMs` | `number` | 否 | `500` | 指数退避的初始延迟。 |
| `retry.maxDelayMs` | `number` | 否 | `4000` | 单次重试的最大延迟。 |
| `limits.maxTurns` | `number` | 否 | `10` | 一次发送内最大的模型/工具往返轮数。 |
| `limits.contextTokens` | `number` | 否 | `8192` | 估算的对话上下文预算。 |
| `limits.reserveForOutput` | `number` | 否 | `1024` | 上下文预算中预留给模型输出的 token。 |
| `limits.compactRatio` | `number` | 否 | `0.8` | 估算用量达到可用预算的该比例时压缩历史。有效范围 `(0, 1]`。 |
| `limits.keepRecent` | `number` | 否 | `6` | 压缩历史时原样保留的最近条目数。 |

**示例 1 · 只覆盖必要的字段**

```ts
const config = {
  model: "gpt-4.1-mini",
  maxTokens: 1600,
  limits: { maxTurns: 14, keepRecent: 8 },
  retry: { maxRetries: 2 },
};
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-hookregistry"></a>

### `HookRegistry`

PreToolUse 与 PostToolUse 钩子，用于应用策略、脱敏与审计，不引入第二套执行器。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
class HookRegistry {
  addPreToolUse(handler: PreToolUseHandler): () => void;
  addPostToolUse(handler: PostToolUseHandler): () => void;
  firePreToolUse(payload: PreToolUsePayload): Promise<{ blocked: boolean; reason?: string }>;
  firePostToolUse(payload: PostToolUsePayload): Promise<ExecResult>;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `addPreToolUse(handler)` | `PreToolUseHandler` | 否 | — | 增加执行前钩子，返回移除函数。返回 `{ blocked: true, reason }` 会阻止工具执行。 |
| `addPostToolUse(handler)` | `PostToolUseHandler` | 否 | — | 增加执行后钩子。可返回替换后的 `ExecResult`，供后续钩子与调用方使用。 |
| `payload.id` | `string` | 否 | — | 页面声明里的原始动作 id。 |
| `payload.tool` | `string` | 否 | — | 发给模型的合法化工具名。 |
| `payload.args` | `Record<string, unknown>` | 否 | — | 校验后的调用参数。 |
| `payload.turn` | `number` | 否 | — | 当前模型/工具轮次。 |
| `payload.result` | `ExecResult` | 否 | — | 仅执行后钩子：当前钩子运行前的执行结果。 |

**示例 1 · 拦截并改写工具结果**

```ts
const hooks = new HookRegistry();
hooks.addPreToolUse(({ id }) => id === "delete_all" ? { blocked: true, reason: "批量删除已禁用" } : undefined);
hooks.addPostToolUse(({ result }) => redactResult(result));
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-sessionevent"></a>

### `SessionEvent`

对话、运行记录、审计与评测视图共同消费的单一事件流。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `type: "user"` | `{ text: string }` | 否 | — | 用户输入回显。 |
| `type: "assistant"` | `{ text: string }` | 否 | — | 非最终的助手说明。 |
| `type: "assistant_delta"` | `{ text: string }` | 否 | — | 流式增量，不是累计文本。 |
| `type: "tool_call"` | `{ id; tool; args }` | 否 | — | 工具即将执行。 |
| `type: "tool_result"` | `{ id; tool; result: ExecResult }` | 否 | — | 工具调用的结构化结果。 |
| `type: "blocked"` | `{ id; tool; reason }` | 否 | — | 钩子在执行前阻止了工具。 |
| `type: "handoff"` | `{ id; tool; status; reason }` | 否 | — | 人工接力的请求或结果。 |
| `type: "notice"` | `{ text: string }` | 否 | — | 轮数上限、空回复等循环级提示。 |
| `type: "final"` | `{ text: string }` | 否 | — | 本次发送的最终助手回答。 |
| `type: "cancelled"` | `{}` | 否 | — | 用户取消了本次运行。 |
| `type: "error"` | `{ code; message; messageKey?; params? }` | 否 | — | 循环或模型错误。`code` 仍是权威标识。 |

**示例 1 · 审计事件流**

```ts
for await (const event of runtime.session.events) {
  if (event.type === "tool_result") audit(event);
}
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-agenttraceoptions"></a>

### `AgentTraceOptions`

限制只读调试器保留的模型调用数量。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface AgentTraceOptions { maxCalls?: number }
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `maxCalls` | `number` | 否 | `20` | 内存诊断器保留的最大模型调用数。省略时使用默认值；长会话可调低以限制内存。 |

**示例 1 · 只保留最近八次调用**

```ts
const trace = { maxCalls: 8 };
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-waitfor"></a>

### `waitFor`

在 run 或结果判据中等待异步 UI 条件成立。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
waitFor(check: () => boolean | Promise<boolean>, options?: WaitForOptions): Promise<boolean>
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `check` | `() => boolean \| Promise<boolean>` | 是 | — | 要判断的条件。先立即检查一次，之后按间隔轮询。 |
| `options.timeout` | `number` | 否 | `2000` | 最长等待时间。传 `0` 只检查一次。超时返回 `false`，不抛异常。 |
| `options.interval` | `number` | 否 | `30` | 两次检查之间的延迟。 |
| `options.now` | `() => number` | 否 | — | 供确定性测试注入时钟。 |
| `options.sleep` | `(ms: number) => Promise<void>` | 否 | — | 供确定性测试注入等待函数。 |
| `options.signal` | `AbortSignal` | 否 | — | 取消等待；一旦中止立即返回 `false`。 |

**示例 1 · 在自定义执行函数中等待**

```ts
await waitFor(() => document.querySelector(".saved"), { timeout: 1500 });
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-describeflow"></a>

### `describeFlow`

生成复合动作的模型可读说明，不执行动作。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
describeFlow(report: FlowReport): string
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `report` | `FlowReport` | 是 | — | 流程执行返回的结果。格式化后会报告完成、失败、跳过、人工接力与成功判据状态。 |

**示例 1 · 渲染流程回执**

```ts
const text = describeFlow(result.resume?.report ?? report);
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


## 页面身份与连续性

读取页面身份、在同源框架间共享运行时，并检查声明覆盖率。

| API | 类型 | 参考 |
| --- | --- | --- |
| [PlingPage](#api-plingpage) | 接口 | [参考](/zh/reference/continuity-and-projection) |
| [createPlingPage](#api-createplingpage) | 函数 | [参考](/zh/reference/continuity-and-projection) |
| [sharePlingPageWithFrame](#api-shareplingpagewithframe) | 函数 | [参考](/zh/reference/continuity-and-projection) |
| [plingPageFromParent](#api-plingpagefromparent) | 函数 | [参考](/zh/reference/continuity-and-projection) |
| [waitForPlingPageFromParent](#api-waitforplingpagefromparent) | 函数 | [参考](/zh/reference/continuity-and-projection) |
| [inspectCoverage](#api-inspectcoverage) | 方法 | [参考](/zh/reference/vue-3-adapter) |

<a id="api-plingpage"></a>

### `PlingPage`

由多个框架岛或同源 iframe 共享的页面级运行时。

**导入**

`@plingjs/dom`

**调用方式**

```ts
// 共享包
interface PlingPage {
  readonly registry: Registry;
  readonly scopes: ScopeController;
  readonly feedback: FeedbackCollector;
  destroy(): void;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `registry` | `Registry` | 否 | — | 共享的动作、记录、状态与反馈注册表。 |
| `scopes` | `ScopeController` | 否 | — | 共享的区域可见性与遮挡控制器。 |
| `feedback` | `FeedbackCollector` | 否 | — | 每个页面只观察一次文档的反馈收集器。 |
| `destroy()` | `void` | 否 | — | 停止页面观察器并清空自动区域。适配器应先释放自己的声明。 |

**示例 1 · 共享一个页面运行时**

```ts
const page = createPlingPage();
const vuePling = createPling({ shared: page });
const reactPling = createPling({ shared: page });
```

**精确契约**

[查看对应参考页](/zh/reference/continuity-and-projection)


<a id="api-createplingpage"></a>

### `createPlingPage`

创建共享注册表、作用域与页面身份，适配器可通过 shared 加入。

**导入**

`@plingjs/dom`

**调用方式**

```ts
// 共享包
createPlingPage(options?: PlingPageOptions): PlingPage
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `options.registry` | `Registry` | 否 | — | 要共享的已有注册表。省略时新建一个。 |
| `options.scopes` | `ScopeControllerOptions` | 否 | — | 共享页面的可见性与命中测试覆盖项。 |

**示例 1 · 创建混合框架页面运行时**

```ts
const page = createPlingPage();

// Pass the same page to Vue, React, or Vanilla islands:
const pling = createPling({ shared: page, namespace: "orders" });
```

**精确契约**

[查看对应参考页](/zh/reference/continuity-and-projection)


<a id="api-shareplingpagewithframe"></a>

### `sharePlingPageWithFrame`

把页面运行时共享给同源 iframe，并返回清理函数。

**导入**

`@plingjs/dom`

**调用方式**

```ts
// 共享包
sharePlingPageWithFrame(frame: HTMLIFrameElement, page: PlingPage): () => void
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `frame` | `HTMLIFrameElement` | 是 | — | 接收共享页面运行时的同源 iframe。 |
| `page` | `PlingPage` | 是 | — | 由 `createPlingPage` 创建的运行时。 |

**示例 1 · 向同源 iframe 共享运行时**

```ts
const page = createPlingPage();
const stop = sharePlingPageWithFrame(iframe, page);

// On teardown:
stop();
page.destroy();
```

**精确契约**

[查看对应参考页](/zh/reference/continuity-and-projection)


<a id="api-plingpagefromparent"></a>

### `plingPageFromParent`

当前文档是嵌入 frame 时，从父窗口读取共享页面运行时。

**导入**

`@plingjs/dom`

**调用方式**

```ts
// 共享包
plingPageFromParent(win?: Window): PlingPage | undefined
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `win` | `Window` | 否 | `window` | 要检查父窗口的窗口对象。默认当前窗口。 |

**示例 1 · 同步读取共享页面运行时**

```ts
const page = plingPageFromParent();
if (page) createPling({ shared: page });
```

**精确契约**

[查看对应参考页](/zh/reference/continuity-and-projection)


<a id="api-waitforplingpagefromparent"></a>

### `waitForPlingPageFromParent`

等待父 frame 发布页面运行时。

**导入**

`@plingjs/dom`

**调用方式**

```ts
// 共享包
waitForPlingPageFromParent(options?: WaitForFramePageOptions): Promise<PlingPage>
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `options.window` | `Window` | 否 | `window` | 要监听的子窗口。默认当前窗口。 |
| `options.timeoutMs` | `number` | 否 | `5000` | 最长等待时间。传 `0` 表示一直等；其他正数超时后 Promise 会拒绝。 |

**示例 1 · 等待父页面运行时**

```ts
const page = await waitForPlingPageFromParent({ timeoutMs: 8000 });
createPling({ shared: page });
```

**精确契约**

[查看对应参考页](/zh/reference/continuity-and-projection)


<a id="api-inspectcoverage"></a>

### `inspectCoverage`

扫描已挂载页面中尚未声明的交互控件。它只报告，不注册动作。

**导入**

`@plingjs/dom`

**调用方式**

```ts
// 共享包
inspectCoverage(root: Element | null): CoverageReport
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `root` | `Element \| null` | 否 | — | 要扫描的应用根。Vue 使用挂载根；React 与原生调用方可传任意根元素。 |
| `return.total` | `number` | 否 | — | 根元素内识别到的可操作控件总数。 |
| `return.declared` | `number` | 否 | — | 有直接声明的控件数。 |
| `return.derived` | `number` | 否 | — | 由可选 L1 派生生成的动作数。 |
| `return.grouped` | `number` | 否 | — | 由祖先声明覆盖的控件数。需要人工复核映射关系。 |
| `return.missing` | `number` | 否 | — | 祖先链上没有任何声明的可操作控件数。 |
| `return.coveragePercent` | `number \| null` | 否 | — | 覆盖控件数除以总数；没有控件时为 `null`。 |
| `return.targets` | `CoverageTarget[]` | 否 | — | 分组与缺失控件列表，包含标签和附近动作 id。 |

**示例 1 · 检查 DOM 根元素**

```ts
const report = inspectCoverage(document.querySelector("#app"));
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


## 测试与执行辅助

用于测试、外部 Agent 与高级宿主的确定性模型回放、评测、页面上下文渲染与核心执行器。

| API | 类型 | 参考 |
| --- | --- | --- |
| [createReplayLlm](#api-createreplayllm) | 函数 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [EvalCase](#api-evalcase) | 类型 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [runEvaluation](#api-runevaluation) | 函数 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [createAgentLoop](#api-createagentloop) | 函数 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [defaultSettle](#api-defaultsettle) | 函数 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [renderPageContext](#api-renderpagecontext) | 函数 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [createExecutor](#api-createexecutor) | 函数 | [参考](/zh/reference/surface-protocol) |
| [createPolicy](#api-createpolicy) | 函数 | [参考](/zh/reference/surface-protocol) |

<a id="api-createreplayllm"></a>

### `createReplayLlm`

用预先写好的轮次创建确定性模型。它走真实的循环、工具分发、确认与失败路径，但不需要网络。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
createReplayLlm(turns: readonly ReplayTurn[]): ReplayLlm
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `turns[].content` | `string` | 否 | — | 该轮返回的助手文本。 |
| `turns[].calls` | `readonly ReplayCall[]` | 否 | — | 该轮请求的工具调用。 |
| `turns[].calls[].tool` | `string` | 是 | — | 页面原始动作 id。replay 适配器会转换为模型工具名。 |
| `turns[].calls[].args` | `Record<string, unknown>` | 否 | — | 序列化进工具调用的参数。 |
| `turns[].calls[].id` | `string` | 否 | — | 显式工具调用 id。省略时生成确定性 id。 |

**类型结构**

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

**示例 1 · 回放两步任务**

```ts
const llm = createReplayLlm([
  { content: "先添加待办。", calls: [{ tool: "add_task", args: { text: "准备发布" } }] },
  { content: "已经添加。" },
]);
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-evalcase"></a>

### `EvalCase`

一条评测用例：输入、期望与禁止调用的动作、可选工具错误预算，以及业务状态检查。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `name` | `string` | 否 | — | 显示名称。默认使用输入文本。 |
| `input` | `string` | 是 | — | 发给被评估 agent 运行的用户消息。 |
| `expectIncludes` | `readonly string[]` | 否 | — | 最终回答中必须出现的字符串。 |
| `expectTools` | `readonly string[]` | 否 | — | 必须调用的动作 id。 |
| `expectNotTools` | `readonly string[]` | 否 | — | 不得调用的动作 id。 |
| `maxToolErrors` | `number` | 否 | — | 该用例允许的最大工具错误数。 |
| `verify` | `() => boolean \| Promise<boolean>` | 否 | — | 运行结束后执行的业务状态断言。 |

**示例 1 · 断言任务完成**

```ts
const testCase = {
  name: "完成第一条待办",
  input: "把第一条待办标记为完成",
  expectTools: ["toggle_task"],
  expectNotTools: ["delete_task"],
  verify: () => todos[0].done === true,
};
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-runevaluation"></a>

### `runEvaluation`

通过同一个宿主回调运行一组 EvalCase，在用例之间重置状态，并返回通过/失败报告。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
runEvaluation(options: EvaluateOptions): Promise<EvalReport>
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `run` | `(input: string) => Promise<string>` | 是 | — | 执行一个用例并返回最终助手回答。 |
| `hooks` | `HookRegistry` | 是 | — | 评估期间用于观察执行前/后事件的钩子注册表。 |
| `cases` | `readonly EvalCase[]` | 是 | — | 按顺序运行的用例。 |
| `reset` | `() => void \| Promise<void>` | 否 | — | 用例之间重置应用状态。 |
| `measure` | `() => EvalMetrics` | 否 | — | 返回每个用例的 token、耗时、成本或其他数值指标。 |
| `events` | `() => readonly SessionEvent[]` | 否 | — | 返回最近一次运行的事件流。 |

**类型结构**

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

**示例 1 · 运行小型确定性用例集**

```ts
const report = await runEvaluation({
  run: (input) => session.send(input),
  hooks,
  cases: [completeFirstTodo],
  reset: () => store.reset(),
});
console.log(formatReport(report));
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-createagentloop"></a>

### `createAgentLoop`

为测试与自定义宿主创建较低层的对话循环。大多数应用应使用 AgentSetup 或 createAgentRuntime。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
createAgentLoop(options: LoopOptions): AgentLoop
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `llm` | `Llm` | 是 | — | 模型调用实现。 |
| `registry` | `Registry` | 否 | — | 页面能力注册表。纯聊天循环可省略。 |
| `policy` | `ConfirmGate` | 否 | — | 确认闸门。省略时，需要确认的工具按 fail-closed 拒绝。 |
| `handoff` | `HandoffGate` | 否 | — | 人工接力通道。省略时人工接力工具会失败，而不是被模拟执行。 |
| `systemPrompt` | `string` | 否 | — | 附加系统说明。框架规则仍然有效。 |
| `responseLocale` | `string \| (() => string)` | 否 | — | 回答语言提示；传函数时每轮重新读取。 |
| `context` | `ContextOptions` | 否 | — | 模型上下文中动作、记录、状态、区域、反馈与页面身份的有界设置。 |
| `history` | `HistoryOptions` | 否 | — | 上下文预算、压缩水位、最近条目保留数与工具结果上限。 |
| `historyState` | `HistorySnapshot` | 否 | — | 从检查点恢复摘要与消息；系统上下文会按当前页面重建。 |
| `hooks` | `HookRegistry` | 否 | — | 工具生命周期钩子。 |
| `telemetry` | `Telemetry` | 否 | — | token、耗时、成本与重试指标。 |
| `trace` | `AgentTraceRecorder` | 否 | — | 用于诊断的有界请求记录。 |
| `maxTurns` | `number` | 否 | `10` | 一次运行内最大的模型/工具往返轮数。 |
| `loopThreshold` | `number` | 否 | — | 相同工具与参数重复达到多少次后报告 `LOOP_DETECTED`。 |
| `errorBudget` | `number` | 否 | — | 累计多少次工具失败后，要求模型直接回答。 |
| `maxNudges` | `number` | 否 | — | 模型连续空回复多少次后停止。 |
| `settle` | `() => Promise<void>` | 否 | — | 取快照前等待 DOM、动画与导航落定。 |
| `minActionIntervalMs` | `number` | 否 | `0` | 同一模型轮次内动作之间的最小间隔。 |
| `sleep` | `(ms: number) => Promise<void>` | 否 | — | 供确定性测试注入等待函数。 |
| `shouldStop` | `() => boolean` | 否 | — | 在安全点检查协作式取消。 |
| `observe` | `(id: string, args: Record<string, unknown>) => void \| Promise<void>` | 否 | — | 传给执行器的动作后观察钩子。 |
| `evidence` | `boolean` | 否 | `true` | 抓取动作前后快照并附带变更证据。 |
| `onEvent` | `(event: SessionEvent) => void` | 否 | — | 会话事件回调。 |
| `now` | `() => number` | 否 | — | 供确定性测试注入时钟。 |

**示例 1 · 创建页面操作循环**

```ts
const loop = createAgentLoop({
  llm,
  registry: pling.registry,
  policy: createPolicy(confirm),
  maxTurns: 12,
  evidence: true,
});
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-defaultsettle"></a>

### `defaultSettle`

在读取下一份页面快照前，等待 DOM 更新、一个浏览器帧与短暂的静默窗口。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
defaultSettle(): Promise<void>
```

**参数**

无。

**示例 1 · 使用浏览器落定策略**

```ts
const settle = defaultSettle;
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-renderpagecontext"></a>

### `renderPageContext`

渲染发给模型的有界页面上下文：区域、动作、记录、状态、反馈与页面身份。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
renderPageContext(snapshot: Snapshot, options?: ContextOptions): string
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `snapshot` | `Snapshot` | 是 | — | 注册表生成的有界页面快照。 |
| `options.maxActions` | `number` | 否 | `40` | 最多列出的动作数，默认 40。 |
| `options.maxRecords` | `number` | 否 | `20` | 最多列出的记录行数，默认 20。 |
| `options.includeState` | `boolean` | 否 | `true` | 是否包含只读状态视图。 |
| `options.maxIdsInHint` | `number` | 否 | `30` | 提示中最多重复的动作 id 数，默认 30。 |
| `options.maxUnavailable` | `number` | 否 | `6` | 最多列出的不可用动作数，默认 6。 |
| `options.maxStateChars` | `number` | 否 | `1200` | 状态段的字符预算，默认 1200。 |
| `options.maxRecordChars` | `number` | 否 | `1500` | 记录段的字符预算，默认 1500。 |
| `options.maxScopes` | `number` | 否 | `24` | 最多列出的页面区域数，默认 24。 |
| `options.maxFeedback` | `number` | 否 | `8` | 最多列出的反馈条目数，默认 8。 |
| `options.maxFeedbackChars` | `number` | 否 | `800` | 反馈段的字符预算，默认 800。 |
| `options.maxPageChars` | `number` | 否 | `500` | 页面身份段的字符预算，默认 500。 |

**示例 1 · 渲染更小的上下文**

```ts
const text = renderPageContext(registry.snapshot(), {
  maxActions: 20,
  maxRecords: 8,
  maxStateChars: 600,
});
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-createexecutor"></a>

### `createExecutor`

创建页面内 Agent 与外部 Surface 宿主共用的执行器。只有这条路径会统一应用权限、可用性、执行与成功判据。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
createExecutor(options: ExecutorOptions): Executor
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `registry` | `Registry` | 是 | — | 解析动作并生成快照的注册表。 |
| `policy` | `ConfirmGate` | 是 | — | 动作执行前应用的确认闸门。 |
| `handoff` | `HandoffGate` | 否 | — | 声明了人工接力的工具使用的接力通道。 |
| `observe` | `(id: string, args: Record<string, unknown>) => void \| Promise<void>` | 否 | — | 执行后的观察窗口，用于路由、异步渲染或动画。 |
| `evidence` | `boolean` | 否 | `true` | 抓取变更证据并放进成功结果。 |
| `settle` | `() => Promise<void>` | 否 | — | 取执行后快照前使用的落定等待。 |
| `betweenSteps` | `() => Promise<void>` | 否 | — | 复合流程步骤之间的可选停等。 |
| `return.execute` | `(id: string, argsJson?: string) => Promise<ExecResult>` | 否 | — | 执行一个动作；动作错误会作为结构化结果返回，不向调用方抛出。 |

**类型结构**

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

**示例 1 · 通过共享执行管线执行**

```ts
const executor = createExecutor({
  registry: pling.registry,
  policy: createPolicy(confirm),
});

const result = await executor.execute("add", JSON.stringify({ text: "准备发布" }));
```

**精确契约**

[查看对应参考页](/zh/reference/surface-protocol)


<a id="api-createpolicy"></a>

### `createPolicy`

创建确认策略。没有确认通道时按 fail-closed 处理，拒绝需要批准的动作。

**导入**

`@plingjs/core`

**调用方式**

```ts
// 共享包
createPolicy(confirm?: Confirm | null): Policy
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `confirm` | `Confirm \| null` | 否 | `null` | 确认回调。传 `null` 表示没有确认通道；需要确认的动作按 fail-closed 拒绝。 |
| `request.id` | `string` | 否 | — | 等待确认的动作 id。 |
| `request.kind` | `Kind` | 否 | — | 动作风险等级。 |
| `request.approval` | `Approval` | 否 | — | 该动作解析后的确认策略。 |
| `request.description` | `string` | 否 | — | 展示给批准人的动作说明。 |
| `request.args` | `Record<string, unknown>` | 否 | — | 校验后的调用参数。 |
| `request.flow.steps` | `readonly string[]` | 否 | — | 复合流程一次确认时包含的步骤 id。 |

**示例 1 · 接入确认对话框**

```ts
const policy = createPolicy(async (request) => {
  return window.confirm(request.description) ? true : false;
});
```

**精确契约**

[查看对应参考页](/zh/reference/surface-protocol)


## 诊断与错误

稳定错误码与本地化渲染辅助函数。跨语言时以错误码为准。

| API | 类型 | 参考 |
| --- | --- | --- |
| [describePlingError](#api-describeplingerror) | 函数 | [参考](/zh/reference/error-codes-and-diagnostics) |
| [describePlingDiagnostic](#api-describeplingdiagnostic) | 函数 | [参考](/zh/reference/error-codes-and-diagnostics) |
| [resolveAgentConfig](#api-resolveagentconfig) | 函数 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |

<a id="api-describeplingerror"></a>

### `describePlingError`

通过共享文案目录渲染 Pling 错误，同时保留机器可读错误码。

**导入**

`@plingjs/ui`

**调用方式**

```ts
// 共享包
describePlingError(error: PlingErrorText, t: PlingTranslator): string
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `error.code` | `string` | 是 | — | 稳定的机器可读错误码。渲染摘要中会保留该错误码。 |
| `error.message` | `string` | 否 | — | 开发者细节；只有提供额外信息时才追加在本地化标签之后。 |
| `error.messageKey` | `string` | 否 | — | 完全本地化的文案 key，优先于通用错误码映射。 |
| `error.params` | `MessageParams` | 否 | — | 文案插值参数。 |
| `t` | `PlingTranslator` | 是 | — | 接收文案 key 与插值参数的翻译函数。 |

**示例 1 · 渲染本地化错误**

```ts
const text = describePlingError(
  { code: "EXPECTATION_FAILED", message: "未等到新行出现" },
  pling.ui.t,
);
```

**精确契约**

[查看对应参考页](/zh/reference/error-codes-and-diagnostics)


<a id="api-describeplingdiagnostic"></a>

### `describePlingDiagnostic`

渲染结构化配置诊断，包括缺失的模型字段与无效限额。

**导入**

`@plingjs/ui`

**调用方式**

```ts
// 共享包
describePlingDiagnostic(diagnostic: PlingDiagnosticText, t: PlingTranslator): string
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `diagnostic.ready` | `boolean` | 是 | — | 为 `true` 时返回空字符串。 |
| `diagnostic.code` | `string` | 否 | — | 稳定诊断码，例如 `MODEL_BASE_URL_MISSING` 或 `LIMITS_INVALID`。 |
| `diagnostic.params` | `MessageParams` | 否 | — | 非敏感插值参数，例如环境变量名。 |
| `diagnostic.hint` | `string` | 否 | — | 没有结构化诊断码时使用的开发者兜底说明。 |
| `t` | `PlingTranslator` | 是 | — | 用于诊断文案目录的翻译函数。 |

**示例 1 · 渲染配置提示**

```ts
const hint = describePlingDiagnostic(
  { ready: false, code: "MODEL_NAME_MISSING", params: { env: "VITE_AGENT_MODEL" } },
  pling.ui.t,
);
```

**精确契约**

[查看对应参考页](/zh/reference/error-codes-and-diagnostics)


<a id="api-resolveagentconfig"></a>

### `resolveAgentConfig`

合并默认值、环境变量与显式覆盖，得到最终模型配置。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
resolveAgentConfig(options?: { env?; config? }): AgentConfig
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `options.env` | `Record<string, unknown>` | 否 | — | 类环境变量对象。浏览器适配器通常传 `import.meta.env`；Node 调用方可传 `process.env`。 |
| `options.config` | `AgentConfigOverrides` | 否 | — | 在默认值与环境变量之后应用的显式覆盖。 |

**示例 1 · 在适配器之外解析配置**

```ts
const config = resolveAgentConfig({
  env: import.meta.env,
  config: { model: "gpt-4.1-mini", limits: { maxTurns: 12 } },
});
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


## 版本与兼容性

| 包 | 版本 | 对等依赖 |
| --- | --- | --- |
| `@plingjs/vue` | `0.1.0-alpha.3` | `vue ^3` |
| `@plingjs/react` | `0.1.0-alpha.3` | `react >=18` |
| `@plingjs/vue2` | `0.1.0-alpha.3` | `vue ^2.7.0` |
| `@plingjs/vanilla` | `0.1.0-alpha.3` | — |

| 项目 | 值 |
| --- | --- |
| 引入版本 | `0.1.0-alpha.2` |
| 稳定性 | pre-1.0 alpha；次要版本可能改变 API |

## 机器可读副本

- [本页 JSON](/zh/api-index/shared.json)
- [API 总览 JSON](/zh/api-index.json)
