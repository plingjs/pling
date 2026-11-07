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
| `@plingjs/core` | — | `0.1.0-alpha.8` |

当前包版本为 `0.1.0-alpha.8`；稳定性为 **preview**。这是 pre-1.0 alpha，次要版本仍可能改变 API。

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


## 外部 Agent Surface

通过 Surface 网关开放已声明能力的 Vue 封装。它们管理凭证与传输；能力 allowlist 与真人审批仍归应用所有。

| API | 类型 | 参考 |
| --- | --- | --- |
| [SurfaceTask](#api-surfacetask) | 接口 | [参考](/zh/reference/guided-task-api) |
| [SurfaceTaskField](#api-surfacetaskfield) | 接口 | [参考](/zh/reference/guided-task-api) |
| [SurfaceTaskStep](#api-surfacetaskstep) | 接口 | [参考](/zh/reference/guided-task-api) |

<a id="api-surfacetask"></a>

### `SurfaceTask`

向外部 Agent 说明的业务任务。它解释哪些能力配合完成一件事，但不是授权。

**导入**

`@plingjs/surface`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 是 | — | 面向外部 Agent 的稳定任务 id。 |
| `title` | `string` | 是 | — | 面向人的任务名称。 |
| `description` | `string` | 否 | — | 任务完成什么，以及何时适用。 |
| `examples` | `readonly string[]` | 否 | — | 外部 Agent 可参考的示例说法。 |
| `risk` | `"read" \| "write" \| "destructive"` | 否 | — | 风险提示。真正能否调用仍由能力与会话范围决定。 |
| `fields` | `readonly SurfaceTaskField[]` | 否 | — | 任务所需字段的说明。 |
| `steps` | `readonly SurfaceTaskStep[]` | 否 | — | 组成该任务的已有能力。 |
| `playbook` | `readonly string[]` | 否 | — | 给外部 Agent 的有序操作提示。 |

**示例 1 · 描述任务，但不授予权限**

```ts
const tasks: SurfaceTask[] = [{
  id: "order.approve",
  title: "审批订单",
  steps: [{ action: "approve@order", label: "批准当前订单" }],
  risk: "destructive",
  playbook: ["先用 describe 读取订单字段", "确认订单状态后再调用审批能力"],
}];
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-surfacetaskfield"></a>

### `SurfaceTaskField`

Surface 任务中的描述性字段。Agent 仍只能通过现有能力的输入协议传值。

**导入**

`@plingjs/surface`

**调用方式**

```ts
// 共享包
interface SurfaceTaskField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "boolean" | "date" | "select" | "lookup";
  description?: string;
  required?: boolean;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `name` | `string` | 是 | — | 任务说明中的字段名。 |
| `label` | `string` | 是 | — | 面向人的字段名。 |
| `type` | `"text" \| "textarea" \| "number" \| "boolean" \| "date" \| "select" \| "lookup"` | 否 | — | 输入类型提示。 |
| `description` | `string` | 否 | — | 字段值的含义或获取方式。 |
| `required` | `boolean` | 否 | — | 任务通常是否需要该值。 |

**示例 1 · 描述查找字段**

```ts
const fields: SurfaceTaskField[] = [{
  name: "studentRef",
  label: "学员",
  type: "lookup",
  required: true,
  description: "先搜索学员，再把返回值传给后续能力。",
}];
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-surfacetaskstep"></a>

### `SurfaceTaskStep`

描述性步骤，只引用已有能力，不增加第二套执行路径。

**导入**

`@plingjs/surface`

**调用方式**

```ts
// 共享包
interface SurfaceTaskStep {
  action: string;
  label: string;
  summary?: string;
  optional?: boolean;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `action` | `string` | 是 | — | 已有能力 id。 |
| `label` | `string` | 是 | — | 面向人的步骤名。 |
| `summary` | `string` | 否 | — | 为什么执行这一步，或它在检查什么。 |
| `optional` | `boolean` | 否 | — | 该步骤是否可跳过。 |

**示例 1 · 只引用已有能力**

```ts
const steps: SurfaceTaskStep[] = [
  { action: "search_orders", label: "搜索订单" },
  { action: "approve@order", label: "批准订单", optional: false },
];
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


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


## 引导任务

收集用户决策、按固定顺序调用已有动作，并用同一份运行快照渲染的任务层。任务目录判断当前上下文可用的任务，引导定义决定如何向用户解释当前任务；两者都不复制执行或权限逻辑。

| API | 类型 | 参考 |
| --- | --- | --- |
| [createTaskController](#api-createtaskcontroller) | 函数 | [参考](/zh/reference/guided-task-api) |
| [createTaskCatalog](#api-createtaskcatalog) | 函数 | [参考](/zh/reference/guided-task-api) |
| [TaskCatalog](#api-taskcatalog) | 接口 | [参考](/zh/reference/guided-task-api) |
| [GuidedTaskRegistration](#api-guidedtaskregistration) | 接口 | [参考](/zh/reference/guided-task-api) |
| [GuidedTaskActivationOptions](#api-guidedtaskactivationoptions) | 接口 | [参考](/zh/reference/guided-task-api) |
| [ActiveGuidedTask](#api-activeguidedtask) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskGuideDefinition](#api-taskguidedefinition) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskGuideField](#api-taskguidefield) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskGuideStep](#api-taskguidestep) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskGuideAction](#api-taskguideaction) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskGuideRow](#api-taskguiderow) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskGuideDone](#api-taskguidedone) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskGuideCommand](#api-taskguidecommand) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskGuideState](#api-taskguidestate) | 接口 | [参考](/zh/reference/guided-task-api) |
| [GuidedTaskView](#api-guidedtaskview) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskDefinition](#api-taskdefinition) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskBinding](#api-taskbinding) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskRecordBinding](#api-taskrecordbinding) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskField](#api-taskfield) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskLookup](#api-tasklookup) | 类型 | [参考](/zh/reference/guided-task-api) |
| [TaskLookupContext](#api-tasklookupcontext) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskStep](#api-taskstep) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskStepSnapshot](#api-taskstepsnapshot) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskRunStatus](#api-taskrunstatus) | 类型 | [参考](/zh/reference/guided-task-api) |
| [TaskWaitingFor](#api-taskwaitingfor) | 类型 | [参考](/zh/reference/guided-task-api) |
| [TaskRunContext](#api-taskruncontext) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskRunSnapshot](#api-taskrunsnapshot) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskController](#api-taskcontroller) | 接口 | [参考](/zh/reference/guided-task-api) |
| [TaskChoice](#api-taskchoice) | 接口 | [参考](/zh/reference/guided-task-api) |
| [QuickTask](#api-quicktask) | 接口 | [参考](/zh/reference/guided-task-api) |
| [QuickTaskItem](#api-quicktaskitem) | 类型 | [参考](/zh/reference/guided-task-api) |
| [TaskInvoke](#api-taskinvoke) | 类型 | [参考](/zh/reference/guided-task-api) |
| [createGuideActions](#api-createguideactions) | 函数 | [参考](/zh/reference/guided-task-api) |
| [GuideActionItem](#api-guideactionitem) | 接口 | [参考](/zh/reference/guided-task-api) |

<a id="api-createtaskcontroller"></a>

### `createTaskController`

创建框架无关的任务控制器。宿主通过 `invoke` 提供唯一的执行桥。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
createTaskController(options: TaskControllerOptions): TaskController
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `options.invoke` | `TaskInvoke` | 是 | — | 唯一的执行桥。它应调用现有执行器、受治理的 Surface 或业务服务。 |
| `options.now` | `() => number` | 否 | `Date.now` | 用于 `startedAt` 与 `finishedAt` 的时钟。测试中可注入确定性时钟。 |

**示例 1 · 通过现有执行器运行固定任务**

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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-createtaskcatalog"></a>

### `createTaskCatalog`

创建当前页面的引导任务目录。它按路由与活跃作用域筛选任务，同一时刻激活一个引导，并把窄动作 `pling_start_task` 绑定到当前注册表。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
createTaskCatalog(options?: TaskCatalogOptions): TaskCatalog
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `options.registry` | `Registry` | 否 | — | 用于路由变化并绑定窄动作 `pling_start_task` 与 `pling_update_task` 的注册表。 |
| `options.isScopeActive` | `(scope: string) => boolean` | 否 | — | 登记项按作用域筛选时使用的查询函数。Vue 会传入带命名空间的注册表查询。 |
| `options.getPage` | `() => PageView \| undefined` | 否 | — | 页面身份覆盖。默认读取 `registry.getPage()`。 |
| `options.actionId` | `string` | 否 | `"pling_start_task"` | 首选的模型动作 id。共享注册表时，第一个目录使用该 id，后续目录自动改用 `pling_start_task_2` 等后缀。 |

**示例 1 · 为当前路由登记一个任务**

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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskcatalog"></a>

### `TaskCatalog`

当前页面的任务目录：登记定义、查询此刻可用的任务、至多激活一个引导、转发引导命令，并通知渲染方。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `actionId` | `readonly string` | 否 | — | 当前目录实际绑定的模型动作 id。多个运行时共享注册表时，应读取它而不是假定一定是 `pling_start_task`。 |
| `updateActionId` | `readonly string` | 否 | — | 更新当前任务工作记忆的实际模型动作 id。它只接受任务声明过且允许 Agent 写入的字段。 |
| `focusActionId` | `readonly string` | 否 | — | 指向已声明引导字段的实际模型动作 id。它不写入值；active 引导没有字段时不可用。 |
| `reviewActionId` | `readonly string` | 否 | — | 打开页面只读核对的实际模型动作 id。只有 `guide.agent.review` 声明命令时才可用。 |
| `proposeSaveActionId` | `readonly string` | 否 | — | 打开页面确认步骤的实际模型动作 id。它不执行写入；只有 `guide.agent.proposeSave` 声明命令时才可用。 |
| `cancelActionId` | `readonly string` | 否 | — | 结束 active 引导的实际模型动作 id。只有 `guide.agent.cancel` 或 `guide.cancel` 声明命令时才可用。 |
| `define(registration)` | `() => void` | 否 | — | 登记任务并返回注销函数。 |
| `get(id)` | `GuidedTaskRegistration \| undefined` | 否 | — | 返回一个登记项，即使它当前因路由或作用域不匹配而不可用。 |
| `list()` | `readonly GuidedTaskRegistration[]` | 否 | — | 返回该目录登记的全部任务。 |
| `available()` | `readonly GuidedTaskRegistration[]` | 否 | — | 返回当前页面路由与作用域都匹配的登记项。 |
| `active()` | `ActiveGuidedTask \| null` | 否 | — | 返回当前展示给用户的唯一任务，或 `null`。 |
| `activate(id, options?)` | `ActiveGuidedTask` | 否 | — | 显式启动或恢复已登记任务。字段值会在激活前校验。 |
| `deactivate()` | `void` | 否 | — | 清除 active 引导，并让当前上下文暂时不再自动启动。 |
| `command(command)` | `boolean` | 否 | — | 把引导命令转发给 active 登记项的 `onCommand`。无人接收时返回 `false`。 |
| `views()` | `readonly GuidedTaskView[]` | 否 | — | 当前所有可用任务的紧凑只读说明。 |
| `refresh()` | `void` | 否 | — | 通知订阅者页面实时状态或任务快照已变化。 |
| `subscribe(listener)` | `() => void` | 否 | — | 订阅可用性、激活状态与 active 控制器的快照变化；返回的函数用于取消订阅。 |
| `destroy()` | `void` | 否 | — | 注销模型动作、清除订阅，并释放该目录持有的控制器登记。 |

**示例 1 · 读取 active 任务，不另建一份 UI 状态**

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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-guidedtaskregistration"></a>

### `GuidedTaskRegistration`

任务目录中的一项登记：可执行定义、可选引导、决定可用性的路由与作用域、显式运行是否跨上下文保留、实时状态，以及生命周期钩子。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 否 | — | 登记 id。默认使用 `definition.id`；显式提供时必须与定义一致。 |
| `definition` | `TaskDefinition` | 是 | — | 可执行的一半：字段、动作、规则与可选确认。 |
| `guide` | `TaskGuideDefinition` | 否 | — | 面向人的一半。任务不需要内置引导时可以省略。 |
| `controller` | `TaskController` | 否 | — | 持有运行快照。在 `define()` 时提供，目录还会把定义登记到该控制器。 |
| `route` | `GuidedTaskRoute` | 否 | — | 精确路径、路由名、可接受路由列表或判定函数。省略表示所有路由可用。 |
| `scope` | `string \| readonly string[]` | 否 | — | 列出的场景作用域必须全部活跃，任务才可用。 |
| `autoStart` | `boolean` | 否 | `false` | 路由与作用域匹配时自动激活引导。只选择一个自动任务，按登记顺序决定。 |
| `keepActive` | `boolean` | 否 | `false` | 显式启动的任务在路由或作用域暂时不匹配时继续保持活动；`deactivate()` 仍会结束它。 |
| `initialValues` | `TaskValues \| (() => TaskValues)` | 否 | — | 自动或显式启动前载入的字段值。 |
| `binding` | `TaskBinding \| (() => TaskBinding)` | 否 | — | 已选记录等页面事实。选择可能变化时使用函数。 |
| `state` | `() => TaskGuideState` | 否 | — | 实时渲染状态。未提供 `snapshot` 时读取控制器快照。 |
| `onActivate` | `(task) => void \| Promise<void>` | 否 | — | 激活后调用；用于同步业务表单、打开弹窗或指向字段。 |
| `onDeactivate` | `(task) => void` | 否 | — | 任务不再是 active 时调用。 |
| `onCommand` | `(command, task) => void \| Promise<void>` | 否 | — | 接收引导按钮发出的业务命令名。 |

**示例 1 · 只在表单作用域可见时登记任务**

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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-guidedtaskactivationoptions"></a>

### `GuidedTaskActivationOptions`

激活前已经拿到的字段值。未知字段会在 active 状态改变前被拒绝。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface GuidedTaskActivationOptions {
  values?: TaskValues;
  startedBy?: "page" | "agent";
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `values` | `TaskValues` | 否 | — | 用户或调用方已经提供的字段值。只接受定义中声明过的字段名。 |
| `startedBy` | `"page" \| "agent"` | 否 | `"page"` | 记录任务由页面还是模型开启。模型动作会写成 `agent`。 |

**示例 1 · 带用户已说出的字段值激活**

```ts
catalog.activate("course.create", {
  values: { name: "瑜伽基础", teacherId: "teacher_18" },
  startedBy: "agent",
});
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-activeguidedtask"></a>

### `ActiveGuidedTask`

当前展示给用户的唯一任务：定义、可选引导、可选控制器、实时渲染状态，以及它由页面还是模型开启。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface ActiveGuidedTask {
  id: string;
  definition: TaskDefinition;
  guide?: TaskGuideDefinition;
  controller?: TaskController;
  state: TaskGuideState;
  startedBy: "page" | "agent";
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 否 | — | 稳定任务 id。 |
| `definition` | `TaskDefinition` | 否 | — | 本次运行使用的可执行定义。 |
| `guide` | `TaskGuideDefinition` | 否 | — | 当前渲染的引导；登记项未提供时不存在。 |
| `controller` | `TaskController` | 否 | — | 持有快照的控制器；未提供时不存在。 |
| `state` | `TaskGuideState` | 否 | — | 读取时由登记项返回的实时状态。 |
| `startedBy` | `"page" \| "agent"` | 否 | — | 本次运行由页面上下文还是模型开启。 |

**示例 1 · 渲染当前 active 的引导**

```ts
const active = catalog.active();
if (active?.guide) {
  const { snapshot, step, busy, error, completed } = active.state;
  renderGuide(active.guide, { snapshot, step, busy, error, completed });
}
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskguidedefinition"></a>

### `TaskGuideDefinition`

任务面向人的一半：欢迎文案、有序步骤、只读摘要、按钮命令、完成文案与人工接力点。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `taskId` | `string` | 是 | — | 必须与这份引导所解释的任务定义 id 一致。 |
| `title` | `string` | 是 | — | 引导卡的标题。 |
| `welcome` | `string` | 否 | — | 步骤轨前方的引导说明。 |
| `footer` | `string` | 否 | — | 引导正文下的小字说明，例如安全或时间提示。 |
| `cancel` | `TaskGuideAction` | 否 | — | 可选的标题栏离开任务操作。渲染器只发出命令，由页面决定如何结束任务。 |
| `stepSubtitle` | `string` | 否 | — | 步骤副标题模板，支持 `{step}` 与 `{total}`。 |
| `avatar` | `string` | 否 | — | 内置渲染器使用的短头像文字或首字母。 |
| `agent` | `{ focusField?, review?, proposeSave?, cancel? }` | 否 | — | 模型可以触发的页面命令。声明 `review` 才会启用 `pling_review_task`，声明 `proposeSave` 才会启用 `pling_propose_save`，声明 `cancel` 才会启用 `pling_cancel_task`；省略时对应工具不可用。`focusField(field)` 可以覆盖默认的 `focus-<field>` 命令，但 `pling_focus_field` 仍只作用于引导声明的字段。这些命令都不执行业务写入；`proposeSave` 只打开确认界面。 |
| `labels` | `TaskGuideLabels` | 否 | — | 覆盖运行中、已完成、当前、完成、未开始、已跳过与错误文案。 |
| `fields` | `TaskGuideFields` | 否 | — | 由页面状态或最新快照解析的紧凑字段列表。内置渲染器用它显示横向进度轨道；省略时显示完整步骤卡。 |
| `steps` | `readonly TaskGuideStep[]` | 是 | — | 面向人的有序步骤。契约要求至少一项。 |
| `done` | `TaskGuideDone` | 否 | — | 完成状态文案与可选后续命令。 |

**示例 1 · 把同一个任务讲给人听**

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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskguidefield"></a>

### `TaskGuideField`

紧凑字段轨道中的一个节点。它报告哪些值已填入、已有建议或被明确跳过；默认发出 `focus-<field>`，业务也可以覆盖命令。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `field` | `string` | 是 | — | 页面与默认 `focus-<field>` 命令使用的稳定字段 id。 |
| `label` | `string` | 是 | — | 字段轨道中展示的字段名称。 |
| `required` | `boolean` | 否 | `false` | 缺少该值时任务是否无法完成。 |
| `filled` | `boolean` | 否 | `false` | 页面是否已经有这个字段的值。 |
| `skipped` | `boolean` | 否 | `false` | 用户是否明确跳过了这个可选字段。轨道会用短横线与“已跳过”标记。 |
| `suggested` | `boolean` | 否 | `false` | 是否已有建议值但尚未写入页面。 |
| `command` | `string` | 否 | — | 覆盖点击节点时默认发出的 `focus-<field>` 命令。 |

**示例 1 · 把进度交给字段轨道，而不是再造一份表单**

```ts
const fields = [
  { field: "name", label: "课程名称", required: true, filled: true },
  { field: "note", label: "约课须知", skipped: true },
  { field: "cover", label: "课程封面", required: true, suggested: false },
];
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskguidestep"></a>

### `TaskGuideStep`

一个引导步骤。它可以显示只读摘要、引导用户在页面上操作，或发出业务自有命令，但不会获得第二套执行路径。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 否 | — | 用于页面恢复进度的稳定步骤 id。 |
| `label` | `string` | 否 | — | 步骤轨中的短标签。 |
| `title` | `string` | 否 | — | 详情卡中的步骤标题。 |
| `description` | `string` | 否 | — | 说明当前发生什么，或用户接下来该做什么。 |
| `rowsTitle` | `string \| (snapshot) => string` | 否 | — | 只读摘要上方的可选标题。 |
| `rows` | `TaskGuideRows` | 否 | — | 按当前任务快照解析的只读摘要行。 |
| `handoff` | `TaskGuideHandoff` | 否 | — | 说明某一必须由用户在页面上完成的接力点。 |
| `primary` | `TaskGuideAction` | 否 | — | 当前步骤的主业务命令。 |
| `secondary` | `TaskGuideAction` | 否 | — | 可选的次要命令，例如返回或跳过。 |

**示例 1 · 指向现有表单字段**

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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskguideaction"></a>

### `TaskGuideAction`

引导按钮的文案与业务自有命令名。渲染器只转发命令，不猜测它的含义。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface TaskGuideAction {
  label: string;
  command: string;
  busyLabel?: string;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `label` | `string` | 否 | — | 展示给用户的按钮文案。 |
| `command` | `string` | 否 | — | 转发给 `onCommand` 的业务自有命令名。渲染器不解释它的含义。 |
| `busyLabel` | `string` | 否 | — | 命令运行中的可选按钮文案。 |

**示例 1 · 用命令转发，不另建执行路径**

```ts
const save: TaskGuideAction = {
  label: "保存并继续",
  busyLabel: "正在保存…",
  command: "course.save",
};
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskguiderow"></a>

### `TaskGuideRow`

一行只读摘要。它可以区分页面当前值与尚未写入的建议值，并可携带行级业务命令。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `label` | `string` | 是 | — | 左侧标签，例如字段名或业务事实。 |
| `value` | `string \| number \| boolean \| null \| undefined` | 是 | — | 要显示的值。渲染器只负责格式化，不修改页面。 |
| `format` | `"text" \| "stars" \| "check" \| "number"` | 否 | `"text"` | 显示提示。`stars` 渲染 1–5 星评分，`check` 渲染选中/未选中标记。 |
| `status` | `"current" \| "suggested" \| "missing"` | 否 | — | 值来自哪里：页面当前值、尚未写入的建议值，或仍缺失。 |
| `badge` | `string` | 否 | — | 业务自有的短标记，例如“已填入”“建议”“待填写”。 |
| `note` | `string` | 否 | — | 标签下方的来源或帮助文字。用来解释建议值，不要重复值本身。 |
| `action` | `TaskGuideAction` | 否 | — | 可选的行级命令，通常是“采用建议”或“定位字段”。它与其他命令走同一个 `onCommand` 路径。 |

**示例 1 · 展示建议值，但不假装它已经写入页面**

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

**示例 2 · 展示页面里已经存在的值**

```ts
const row: TaskGuideRow = {
  label: "授课老师",
  value: "周敏",
  status: "current",
  badge: "已填入",
  action: { label: "定位", command: "focus-teacher" },
};
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskguidedone"></a>

### `TaskGuideDone`

任务成功后的完成状态，包括最终摘要与可选的后续命令。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface TaskGuideDone {
  title: string | ((snapshot: TaskRunSnapshot | null) => string);
  description: string | ((snapshot: TaskRunSnapshot | null) => string);
  rows?: TaskGuideRows;
  actions?: readonly TaskGuideAction[];
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | `string \| (snapshot) => string` | 否 | — | 完成标题，可根据最终快照生成。 |
| `description` | `string \| (snapshot) => string` | 否 | — | 说明具体改了什么完成文案。 |
| `rows` | `TaskGuideRows` | 否 | — | 最终只读摘要行。 |
| `actions` | `readonly TaskGuideAction[]` | 否 | — | 完成后可用的后续业务命令。 |

**示例 1 · 把创建结果作为完成回执**

```ts
const done: TaskGuideDone = {
  title: "课程已创建",
  description: (snapshot) => "已创建：" + (snapshot?.values.name ?? "新课程"),
  actions: [{ label: "继续添加老师", command: "teacher.add" }],
};
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskguidecommand"></a>

### `TaskGuideCommand`

引导发出的命令，并带上页面决定下一步所需的步骤与完成上下文。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface TaskGuideCommand {
  action: TaskGuideAction;
  step: TaskGuideStep | null;
  stepIndex: number;
  done: boolean;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `action` | `TaskGuideAction` | 否 | — | 发出该命令的按钮定义。 |
| `step` | `TaskGuideStep \| null` | 否 | — | 发出命令时的当前步骤；完成卡发出时为 `null`。 |
| `stepIndex` | `number` | 否 | — | 当前步骤的零基下标。完成动作为 `-1`。 |
| `done` | `boolean` | 否 | — | 命令是否来自完成状态。 |

**示例 1 · 在页面中分发引导命令**

```ts
function onCommand(command: TaskGuideCommand): void {
  if (command.done) return finishCourseFlow(command.action.command);
  if (command.action.command === "name.done") pointAtTeacherField();
}
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskguidestate"></a>

### `TaskGuideState`

登记项返回的实时渲染状态：任务快照、当前步骤、忙碌状态、错误与完成标记。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface TaskGuideState {
  snapshot?: TaskRunSnapshot | null;
  step?: number;
  busy?: boolean;
  error?: string;
  completed?: boolean;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `snapshot` | `TaskRunSnapshot \| null` | 否 | — | 当前任务运行快照。省略时目录读取 `controller.snapshot()`。 |
| `step` | `number` | 否 | `1` | 从 1 开始的当前引导步骤。 |
| `busy` | `boolean` | 否 | `false` | 页面是否正在完成当前步骤。 |
| `error` | `string` | 否 | — | 显示在引导旁的业务错误。 |
| `completed` | `boolean` | 否 | `false` | 把引导切换到完成状态。 |

**示例 1 · 暴露实时页面状态，不另存一份**

```ts
state: () => ({
  snapshot: controller.snapshot(),
  step: currentStep.value,
  busy: saving.value,
  error: error.value,
  completed: saved.value,
})
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-guidedtaskview"></a>

### `GuidedTaskView`

供模型上下文与任务列表使用的紧凑只读任务说明，由定义与可选引导派生。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface GuidedTaskView {
  id: string;
  title: string;
  description?: string;
  examples?: readonly string[];
  guideTitle?: string;
  stepTitles?: readonly string[];
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 否 | — | 任务 id。 |
| `title` | `string` | 否 | — | 面向人的任务标题。 |
| `description` | `string` | 否 | — | 任务做什么以及何时选择它。 |
| `examples` | `readonly string[]` | 否 | — | 该任务的示例请求。 |
| `guideTitle` | `string` | 否 | — | 可选引导的标题。 |
| `stepTitles` | `readonly string[]` | 否 | — | 用于紧凑上下文的引导步骤标题。 |

**示例 1 · 构建紧凑的任务选择器**

```ts
for (const task of catalog.views()) {
  console.log(task.id, task.title, task.stepTitles?.length ?? 0);
}
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskdefinition"></a>

### `TaskDefinition`

一个引导任务：目标、约束、成功判据、工作记忆字段，以及可选的确定性步骤或 Agent 提示词。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 是 | — | 稳定任务 id，在同一控制器内唯一。 |
| `title` | `string` | 是 | — | 任务卡上显示的任务名称。 |
| `description` | `string` | 否 | — | 任务做什么，以及用户在什么场景下该选它。 |
| `objective` | `string` | 否 | — | 任务要达成的结果。它是助手推理时使用的目标，不是步骤清单。 |
| `constraints` | `readonly string[]` | 否 | — | 助手协助时必须守住的边界，例如只能由页面上传或必须回读验证。 |
| `successCriteria` | `readonly string[]` | 否 | — | 任务真正完成时必须可观察到的条件。 |
| `requiresRecord` | `boolean` | 否 | `false` | 为 `true` 时，`start()` 必须拿到页面提供的记录。通用任务列表应把它当作从行或详情页打开的入口，而不是直接启动。 |
| `examples` | `readonly string[]` | 否 | — | 任务卡上的示例说法。点击只填入表单，不直接执行写操作。 |
| `fields` | `readonly TaskField[]` | 否 | — | 当前工作记忆，以及可能需要人做出的决定。缺失必填项不规定对话必须按某个脚本顺序进行。 |
| `risk` | `"read" \| "write" \| "danger"` | 否 | — | 任务级风险提示。真正的权限仍由底层动作执行。 |
| `steps` | `readonly TaskStep[]` | 否 | — | 确定性的业务动作调用。它们负责执行写入，不控制对话下一句问什么。 |
| `prompt` | `string \| ((values) => string)` | 否 | — | Agent 模式模板。没有 `steps` 时必须提供。 |
| `confirm` | `boolean \| "always"` | 否 | — | 任务级确认偏好；动作策略仍是最终依据。 |

**示例 1 · 描述任务，不复制执行器**

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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskbinding"></a>

### `TaskBinding`

任务启动时由页面提供的上下文。它与用户可编辑的字段分开，避免记录 id 意外变成表单字段。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface TaskBinding {
  record?: TaskRecordBinding;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `record` | `TaskRecordBinding` | 否 | — | 宿主在任务打开前选中的记录。它是页面事实，不是表单字段。 |

**示例 1 · 把课表行绑定到任务**

```ts
panel.open("lesson.note", {}, {
  record: { id: "lesson_42", label: "瑜伽基础 · 2026-03-16 10:00" },
});
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskrecordbinding"></a>

### `TaskRecordBinding`

页面已经选中的记录，例如课表的一行或详情页。任务直接使用它的 id，不再要求用户输入。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface TaskRecordBinding {
  id: string;
  label?: string;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 是 | — | 现有业务动作接受的稳定引用。它应指向用户在页面上选中的同一条记录。 |
| `label` | `string` | 否 | — | 用于诊断与可选任务标题的展示名称。 |

**示例 1 · 使用绑定 id，不再重复询问**

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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskfield"></a>

### `TaskField`

任务工作记忆中的一项：可能需要用户做出的决定、推荐值，或 Agent 不可写的页面专属值。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `name` | `string` | 是 | — | 字段值中的键名，步骤参数函数也用它取值。 |
| `label` | `string` | 是 | — | 展示给用户的字段名。 |
| `type` | `"text" \| "textarea" \| "number" \| "boolean" \| "date" \| "select" \| "lookup"` | 否 | `"text"` | 输入控件类型。默认 `text`。 |
| `optional` | `boolean` | 否 | `false` | 允许留空。字段默认必填。 |
| `placeholder` | `string` | 否 | — | 输入占位符或选择提示。 |
| `help` | `string` | 否 | — | 字段旁的简短说明。 |
| `defaultValue` | `TaskValue` | 否 | — | 运行开始时的初始值。 |
| `values` | `readonly TaskChoice[]` | 否 | — | `select` 字段使用的小型封闭选项集。 |
| `recommended` | `TaskValue` | 否 | — | 仅在用户明确委托这一项选择时，模型可以使用的建议值。它不会被自动写入。 |
| `lookup` | `TaskLookup` | 否 | — | 大集合的异步搜索。界面与 Agent 工具应共用这一函数。 |
| `min` | `number` | 否 | — | 数值字段的最小值。模型建议的值写入任务快照之前会先校验。 |
| `max` | `number` | 否 | — | 数值字段的最大值。模型建议的值写入任务快照之前会先校验。 |
| `minLength` | `number` | 否 | — | 文本值的最小长度，按去除首尾空白后的字符数计算。 |
| `maxLength` | `number` | 否 | — | 文本值的最大长度，按去除首尾空白后的字符数计算。 |
| `pattern` | `string` | 否 | — | 不带分隔符的正则表达式源码，用于校验文本值。需要整值匹配时请写锚点，例如 `^[1-9]\\d*$`。 |
| `validate` | `(value, values) => string \| null \| undefined` | 否 | — | 模型建议的值写入之前执行的业务校验。返回简短的、可直接展示给用户的拒绝原因；通过时返回空。它只校验值，不应做意图分类或产生副作用。 |
| `searchAction` | `string` | 否 | — | 为该查找暴露给模型的动作 id。默认 `search_<name>`；多个任务共用同一搜索实现时应复用同一个 id。 |
| `minChars` | `number` | 否 | `1` | 触发搜索所需的最少字符数。小于 1 的值会按 1 处理。 |
| `agentWritable` | `boolean` | 否 | `true` | 模型是否可以通过任务更新动作写入该字段。上传、签名、验证码等页面专属值设为 `false`。 |

**示例 1 · 区分同名学员**

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

**示例 2 · 在值写进页面之前拒绝非法值**

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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-tasklookup"></a>

### `TaskLookup`

任务界面与自动注册的搜索动作共用的搜索实现。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
type TaskLookup = (query: string, context: TaskLookupContext) => Promise<readonly TaskChoice[]> | readonly TaskChoice[]
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `query` | `string` | 否 | — | 用户输入或模型发送的文本。 |
| `context` | `TaskLookupContext` | 否 | — | 异步搜索的可选取消上下文。 |

**示例 1 · 界面与模型共用一份搜索**

```ts
const lookupStudents: TaskLookup = async (query, { signal }) => {
  const rows = await api.searchStudents(query, { signal });
  return rows.map((row) => ({ value: row.id, label: row.name, description: row.phoneMasked }));
};
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-tasklookupcontext"></a>

### `TaskLookupContext`

异步查找可使用的取消信号。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface TaskLookupContext {
  signal?: AbortSignal;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `signal` | `AbortSignal` | 否 | — | 用户关闭面板或新查询替换旧查询时中止。 |

**示例 1 · 在异步查找中响应取消**

```ts
const lookup: TaskLookup = async (query, context) => {
  const response = await fetch("/api/students?q=" + encodeURIComponent(query), {
    signal: context.signal,
  });
  return response.json();
};
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskstep"></a>

### `TaskStep`

确定性任务中的一次已有动作调用。参数可以是静态值、来自已填字段，或使用打开任务前选中的页面记录。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 否 | — | 稳定步骤 id。省略时使用从 1 开始的序号。 |
| `label` | `string` | 是 | — | 展示给用户的步骤名。 |
| `summary` | `string` | 否 | — | 为什么执行这一步，或它在检查什么。 |
| `action` | `string` | 是 | — | 已注册动作或受治理业务操作的 id。 |
| `args` | `object \| ((values, binding) => object)` | 否 | — | 静态参数、从已填字段生成参数的函数，或同时读取绑定记录的参数函数。 |
| `optional` | `boolean` | 否 | `false` | 为 `true` 时，失败记为跳过，后续步骤继续。 |
| `handoff` | `boolean \| string` | 否 | — | 把该步骤标记为人工完成。运行进入等待接力状态，由宿主完成真正的校验。 |

**示例 1 · 先检查再写入**

```ts
const steps: TaskStep[] = [
  { label: "检查时段", action: "check_slot", args: (values) => ({ slot: values.slot }) },
  { label: "创建课程", action: "create_lesson", args: (values) => ({ slot: values.slot }) },
];
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskstepsnapshot"></a>

### `TaskStepSnapshot`

一个渲染步骤：动作、状态、可选的人工接力标记、失败与结果。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `index` | `number` | 否 | — | 在步骤列表中的位置，从 1 开始。 |
| `id` | `string` | 否 | — | 稳定的步骤 id；省略时按序号生成。 |
| `label` | `string` | 否 | — | 展示给用户的步骤名。 |
| `summary` | `string` | 否 | — | 为什么执行这一步，或它在检查什么。 |
| `action` | `string` | 否 | — | 该步骤调用或将要调用的动作 id。 |
| `status` | `"pending" \| "running" \| "ok" \| "skipped" \| "failed"` | 否 | — | 当前步骤状态。 |
| `optional` | `boolean` | 否 | — | 失败后是否允许继续。 |
| `handoff` | `boolean \| string` | 否 | — | 步骤必须由人完成时出现。 |
| `error` | `TaskRunError` | 否 | — | 失败或跳过步骤的错误码与消息。 |
| `result` | `unknown` | 否 | — | 执行桥返回的不透明结果。 |

**示例 1 · 直接渲染进度，不另造状态**

```ts
for (const step of snapshot.steps) {
  row.dataset.status = step.status;
  row.textContent = step.index + ". " + step.label;
  if (step.error) note.textContent = step.error.message;
}
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskrunstatus"></a>

### `TaskRunStatus`

任务运行的生命周期。`planned`、`running` 与 `verifying` 分别表示已确定的计划、正在执行，以及动作返回后的检查。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
type TaskRunStatus = "collecting" | "ready" | "planned" | "running" | "waiting" | "verifying" | "done" | "failed" | "cancelled"
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `collecting` | `"collecting"` | 否 | — | 仍缺少必填值。 |
| `ready` | `"ready"` | 否 | — | 字段已齐全，尚未开始执行。 |
| `planned` | `"planned"` | 否 | — | 计划已经确定并可见；仍可能在等待任务级确认。 |
| `running` | `"running"` | 否 | — | 某个步骤正在执行。 |
| `waiting` | `"waiting"` | 否 | — | 正在等待确认或人工接力。查看 `waitingFor`。 |
| `verifying` | `"verifying"` | 否 | — | 动作已返回，宿主正在核对结果。它不是重复的 running 状态。 |
| `done` | `"done"` | 否 | — | 所有必需步骤已完成。 |
| `failed` | `"failed"` | 否 | — | 某个必需步骤失败。 |
| `cancelled` | `"cancelled"` | 否 | — | 用户或新的运行取消了本次运行。 |

**示例 1 · 处理等待状态时读取原因**

```ts
if (snapshot.status === "waiting") {
  showPrompt(snapshot.waitingFor === "confirmation"
    ? "Review the plan, then confirm."
    : "Complete this step in the page.");
}
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskwaitingfor"></a>

### `TaskWaitingFor`

运行在等待什么：任务级确认，或必须由用户亲自完成的步骤。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
type TaskWaitingFor = "confirmation" | "handoff"
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `confirmation` | `"confirmation"` | 否 | — | 任务级确认尚未完成。用户批准后调用 `confirm()`。 |
| `handoff` | `"handoff"` | 否 | — | 用户必须在页面上亲自完成该步骤，由宿主核对结果。 |

**示例 1 · 区分两种等待**

```ts
switch (snapshot.waitingFor) {
  case "confirmation": return renderConfirm(snapshot);
  case "handoff": return renderHandoff(snapshot.steps.find((step) => step.status === "running"));
  default: return renderProgress(snapshot);
}
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskruncontext"></a>

### `TaskRunContext`

传给 `invoke` 与可选进度上报器的上下文。`report()` 可把长步骤标记为核对中或等待人工接力。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface TaskRunContext {
  taskId: string;
  values: TaskValues;
  binding: TaskBinding;
  signal: AbortSignal;
  report(status: "running" | "waiting" | "verifying", waitingFor?: TaskWaitingFor): void;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `taskId` | `string` | 否 | — | 当前运行的任务定义 id。 |
| `values` | `TaskValues` | 否 | — | 调用前复制的已填字段快照。 |
| `binding` | `TaskBinding` | 否 | — | 运行开始时提供的页面事实快照。 |
| `signal` | `AbortSignal` | 否 | — | 运行被取消或替换时中止。 |
| `report` | `(status, waitingFor?) => void` | 否 | — | 把长步骤标记为运行中、等待或核对中。已过期的运行会忽略该调用。 |

**示例 1 · 在长执行桥中上报人工接力**

```ts
const invoke: TaskInvoke = async (action, args, context) => {
  if (action === "confirm_payment") context.report("waiting", "handoff");
  return executor.execute(action, JSON.stringify(args), { signal: context.signal });
};
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskrunsnapshot"></a>

### `TaskRunSnapshot`

一次任务运行的完整渲染状态：字段值、绑定的页面记录、状态、步骤进度、提示词、确认、错误与时间戳。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `taskId` | `string` | 否 | — | 本次运行对应的任务定义 id。 |
| `status` | `TaskRunStatus` | 否 | — | 当前运行状态，包括 `planned` 与 `verifying`。 |
| `values` | `TaskValues` | 否 | — | 当前字段值。把它们当作用户输入，而不是可信的服务端事实。 |
| `binding` | `TaskBinding` | 否 | — | 启动时由宿主提供页面记录或其他绑定时出现。 |
| `steps` | `readonly TaskStepSnapshot[]` | 否 | — | 每一步的状态、面向用户的错误与返回结果。 |
| `prompt` | `string` | 否 | — | Agent 模式根据字段值生成的提示词。 |
| `waitingFor` | `TaskWaitingFor` | 否 | — | 状态为等待时出现：确认或人工接力。 |
| `confirmation` | `{ required: true; confirmed: boolean }` | 否 | — | 任务定义要求任务级确认时出现。 |
| `error` | `TaskRunError` | 否 | — | 运行或必需步骤失败时的错误码与消息。 |
| `startedAt` | `number` | 否 | — | 来自注入时钟的毫秒时间戳。 |
| `finishedAt` | `number` | 否 | — | 完成、失败或取消后出现。 |

**示例 1 · 用同一份快照渲染**

```ts
controller.subscribe((snapshot) => {
  progress.textContent = snapshot.status;
  for (const step of snapshot.steps) {
    renderStep(step.label, step.status, step.error?.message);
  }
});
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskcontroller"></a>

### `TaskController`

注册任务定义并持有一个活动运行。启动另一个任务会取消前一个运行。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `register` | `(definition) => () => void` | 否 | — | 注册任务定义并返回注销函数。重复 id 会抛错。 |
| `start` | `(id, values?, binding?) => TaskRunSnapshot` | 否 | — | 启动运行、应用默认值、记录页面绑定，并取消此前的活动运行。`requiresRecord` 为 `true` 且没有记录 id 时抛错。 |
| `setValue` | `(name, value) => TaskRunSnapshot` | 否 | — | 在收集或就绪阶段更新字段。开始执行后再修改会抛错。 |
| `plan` | `() => TaskRunSnapshot` | 否 | — | 把当前字段值冻结为 `planned` 状态，不调用执行桥。缺少必填字段时返回 `TASK_FIELDS_REQUIRED`。 |
| `confirm` | `() => TaskRunSnapshot` | 否 | — | 完成待处理的任务级确认。运行不在等待确认时抛错。 |
| `run` | `() => Promise<TaskRunSnapshot>` | 否 | — | 执行固定步骤，或返回 Agent 模式提示词。 |
| `cancel` | `() => TaskRunSnapshot` | 否 | — | 中止当前步骤并把运行标记为取消。 |
| `subscribe` | `(listener) => () => void` | 否 | — | 每次状态变化后接收一份快照。 |

**示例 1 · 先收集字段，再运行**

```ts
controller.start("student.cards");
controller.setValue("studentRef", "stu_1");
controller.plan();
const run = await controller.run();
if (run.error?.code === "TASK_FIELDS_REQUIRED") showMissingFields(run);
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskchoice"></a>

### `TaskChoice`

一个可选项。`value` 是动作真正需要的引用，`label` 与 `description` 是用户看到的内容。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
interface TaskChoice {
  value: string;
  label: string;
  description?: string;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `value` | `string` | 是 | — | 传给动作的稳定引用，例如学员 id。 |
| `label` | `string` | 是 | — | 展示给用户、也提供给模型选择的名称。 |
| `description` | `string` | 否 | — | 用于区分同名项的补充信息，例如脱敏手机号。 |

**示例 1 · 能区分重名的选项**

```ts
const choice: TaskChoice = {
  value: "stu_2",
  label: "李娜",
  description: "139****5678 · 最近上课 10 月 18 日",
};
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-quicktask"></a>

### `QuickTask`

推荐任务按钮的结构化写法；普通字符串仍是单行简写。

**导入**

`@plingjs/ui`

**调用方式**

```ts
// 共享包
interface QuickTask {
  label: string;
  prompt: string;
  description?: string;
  disabled?: boolean;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `label` | `string` | 是 | — | 助手入口上显示的短标签。 |
| `prompt` | `string` | 是 | — | 用户点击入口时发送的完整提示词。 |
| `description` | `string` | 否 | — | 悬停时或辅助技术可读的补充说明。 |
| `disabled` | `boolean` | 否 | `false` | 保留入口可见，但暂时不可用。 |

**示例 1 · 按钮短，提示词具体**

```ts
const quick: QuickTask[] = [{
  label: "标记第一条完成",
  prompt: "把第 1 条待办标记为完成，然后新增两条待办：买牛奶、整理书桌。",
  description: "会先完成第一条，再创建两条新待办。",
}];
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-quicktaskitem"></a>

### `QuickTaskItem`

助手入口接受的快捷任务项：字符串提示词，或结构化的 `QuickTask`。

**导入**

`@plingjs/ui`

**调用方式**

```ts
// 共享包
type QuickTaskItem = string | QuickTask
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `item` | `string \| QuickTask` | 否 | — | 普通字符串保留单行简写；对象可分别提供标签、提示词与说明。 |

**示例 1 · 混合简写与结构化入口**

```ts
const quick: QuickTaskItem[] = [
  "显示本周未完成的订单",
  { label: "整理今日待办", prompt: "检查今天的待办，把已完成的归档。" },
];
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-taskinvoke"></a>

### `TaskInvoke`

宿主执行桥。它应调用现有执行器、Surface 或业务服务，可返回 `void`、`{ ok }` 或 `ExecResult`。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// 共享包
type TaskInvoke = (action: string, args: Record<string, unknown>, context: TaskRunContext) => unknown | Promise<unknown>
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `action` | `string` | 否 | — | 当前步骤中的动作 id。 |
| `args` | `Record<string, unknown>` | 否 | — | 本次调用已解析的参数。 |
| `context` | `TaskRunContext` | 否 | — | 任务 id、字段值、页面绑定、取消信号，以及用于长步骤状态上报的 `report()`。 |

**示例 1 · 把任务执行桥接到现有执行器**

```ts
const invoke: TaskInvoke = async (action, args, context) => {
  if (context.signal.aborted) throw new Error("Cancelled");
  return executor.execute(action, JSON.stringify(args));
};
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-createguideactions"></a>

### `createGuideActions`

渲染所有适配器共用的紧凑引导任务操作行。按钮只保留短动作；长推荐变成单行省略预览，完整值保留在 `title` 与 `aria-label` 中。

**导入**

`@plingjs/dom`

**调用方式**

```ts
// 共享包
createGuideActions(options: GuideActionsOptions): GuideActions
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `options.items` | `readonly GuideActionItem[]` | 是 | — | 要依次展示的操作。渲染器不会自动追加隐式操作。 |
| `options.onCommand` | `(command: string) => void` | 是 | — | 接收宿主声明的业务命令。渲染器本身不执行业务逻辑。 |
| `options.hint` | `string` | 否 | — | 操作行上方的可选提示，例如“保存前再核对一次”。为空时隐藏。 |
| `options.ariaLabel` | `string` | 否 | — | 操作组的无障碍名称。默认使用本地化的“任务操作”文案。 |
| `options.locale` | `string` | 否 | — | 框架自有兜底文案的语言。业务文案不会被渲染器翻译。 |

**示例 1 · 渲染带长推荐内容的紧凑操作行**

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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-guideactionitem"></a>

### `GuideActionItem`

紧凑操作行中的一项：短标签、业务自定义命令、可选类型，以及作为预览而不是标签的长推荐。

**导入**

`@plingjs/dom`

**调用方式**

```ts
// 共享包
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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 是 | — | 用于测试与宿主记录的稳定 id，不会发送给模型。 |
| `label` | `string` | 是 | — | 按钮上的短动作，例如“自动填写”“定位 · 课程名称”。 |
| `command` | `string` | 是 | — | 点击时发出的业务命令，由宿主决定其含义。 |
| `kind` | `"primary" \| "secondary" \| "suggestion" \| "skip"` | 否 | — | 视觉强调。只有 `suggestion` 会渲染预览文本。 |
| `preview` | `string` | 否 | — | 长推荐的单行省略预览。完整值保留在 `title` 与 `aria-label` 中。 |
| `ariaLabel` | `string` | 否 | — | 当可见标签省略字段名或预览被截断时使用的无障碍名称。 |
| `disabled` | `boolean` | 否 | — | 写入进行中时禁用操作。禁用按钮不会发出命令。 |

**示例 1 · 不要把手值拼进标签**

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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


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
| `@plingjs/vue` | `0.1.0-alpha.8` | `vue ^3` |
| `@plingjs/react` | `0.1.0-alpha.8` | `react >=16.3` |
| `@plingjs/vue2` | `0.1.0-alpha.8` | `vue ^2.7.0` |
| `@plingjs/vanilla` | `0.1.0-alpha.8` | — |

| 项目 | 值 |
| --- | --- |
| 引入版本 | `0.1.0-alpha.2` |
| 稳定性 | pre-1.0 alpha；次要版本可能改变 API |

## 机器可读副本

- [本页 JSON](/zh/api-index/shared.json)
- [API 总览 JSON](/zh/api-index.json)
