---
title: "原生 JS API"
status: navigation
release: 0.1
locale: zh
---
<!-- generated:api-index -->

# 原生 JS API

面向原生 JavaScript 与 jQuery 时代页面的 DOM API。声明方法接收元素并返回解绑函数；问答入口通过 pling.dock() 创建。

本页只列 `@plingjs/vanilla` 的入口，以及与它一起使用的共享包类型。

[API 总览](/zh/reference/api/) · [共享包 API](/zh/reference/api/shared)

| 包 | 对等依赖 | 版本 |
| --- | --- | --- |
| `@plingjs/vanilla` | — | `0.1.0-alpha.2` |

当前包版本为 `0.1.0-alpha.2`；稳定性为 **preview**。这是 pre-1.0 alpha，次要版本仍可能改变 API。

## 最小示例

```ts
import { createPling } from "@plingjs/vanilla";

const pling = createPling({ namespace: "todo" });
pling.tool(document.querySelector("#add"), {
  id: "add",
  desc: "添加一条待办",
});
```

## 入口与生命周期

创建应用级运行时、安装适配器，并释放它持有的观察器。

| API | 类型 | 参考 |
| --- | --- | --- |
| [createPling](#api-createpling) | 函数 | [参考](/zh/reference/vanilla-jquery-adapter) |
| [VanillaPling](#api-vanillapling) | 接口 | [参考](/zh/reference/vanilla-jquery-adapter) |
| [pling.destroy](#api-destroy) | 方法 | [参考](/zh/reference/vanilla-jquery-adapter) |

<a id="api-createpling"></a>

### `createPling`

创建应用级 Pling 实例，并返回对应适配器的运行时对象。

**导入**

`@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
createPling(options?: VanillaPlingOptions): VanillaPling
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `ui.locale` | `"en-US" \| "zh-CN" \| "auto" \| string` | 否 | `en-US` | 内置助手界面的语言。传 `auto` 时跟随浏览器语言。 |
| `ui.theme` | `"light" \| "dark" \| "auto" \| PlingThemeOverrides` | 否 | `light` | 内置界面的主题。传对象时可选择模式或覆盖设计令牌。 |
| `ui.theme.mode` | `"light" \| "dark" \| "auto"` | 否 | `light` | 主题传对象时指定的模式。`auto` 跟随操作系统外观。 |
| `ui.theme.tokens` | `Partial<PlingThemeTokens>` | 否 | — | 覆盖颜色、圆角、阴影、字体等单个设计令牌。未提供的键沿用所选明色或暗色主题的默认值。 |
| `ui.messages` | `PlingCatalogOverrides` | 否 | — | 为一个或多个语言补充或替换界面文案。 |
| `ui.messages.<locale>` | `Partial<Record<PlingMessageKey, string>>` | 否 | — | 某个 BCP 47 语言的文案覆盖。未提供的键回退到内置文案。 |
| `ui.classNames` | `PlingClassNames` | 否 | — | 为内置对话、浮窗、启动按钮和面板附加 class。 |
| `ui.classNames.dock` | `string` | 否 | — | 浮窗外壳的附加 class。 |
| `ui.classNames.panel` | `string` | 否 | — | 面板外壳的附加 class。 |
| `ui.classNames.launcher` | `string` | 否 | — | 启动按钮的附加 class。 |
| `ui.classNames.chat` | `string` | 否 | — | 对话界面的附加 class。 |
| `onWarn` | `(message: string) => void` | 否 | `console.warn` | 接收开发期告警和声明诊断。默认输出到 `console.warn`。 |
| `registry` | `Registry` | 否 | — | 使用已有动作注册表，而不是新建一个。不要与 `shared` 同时传入。 |
| `shared` | `PlingPage` | 否 | — | 接入多个框架孤岛共用的页面运行时。此时 `registry` 与 `scopes` 由页面统一持有。 |
| `namespace` | `string` | 否 | — | 为该适配器实例的动作与记录 id 加前缀，例如 `add` 变成 `todo/add`。 |
| `scopes` | `ScopeControllerOptions` | 否 | — | 覆盖可见性与命中测试行为。主要用于测试和特殊渲染宿主。 |
| `agent` | `AgentSetup` | 否 | — | 接线内置助手界面使用的模型、钩子、确认、连续性与观测能力。 |
| `derive` | `boolean \| DeriveOptions` | 否 | `false` | 开启可选的 L1 派生：从原生可点击元素推断动作。默认关闭；派生动作会标记为推断结果。 |
| `presence` | `boolean \| PresenceOptions` | 否 | `true` | 控制 agent 操作页面时的目标高亮。 |
| `revealSensitive` | `boolean` | 否 | `true` | 仅在渲染层把敏感值代号还原为真值。发给模型的请求和存储中仍保留代号。 |
| `defaultApproval` | `"danger" \| "kind"` | 否 | `"danger"` | 设置工具未写 `confirm` 时的声明期默认策略。`danger` 只询问危险动作；`kind` 按每个动作的风险等级决定。 |

**返回值**

适配器实例。Vue 3 与 React 返回 PlingElement；Vue 2.7 与原生 JS 返回 VanillaPling。

**默认行为**

- 未声明的控件不会成为动作；derive 默认关闭。
- 动作高亮默认开启。
- 聊天中还原敏感值默认开启。

**示例 1 · 原生 JS 初始化并声明一个动作**

```ts
import { createPling } from "@plingjs/vanilla";

const pling = createPling({ namespace: "todo" });
pling.tool(document.querySelector("#add"), {
  id: "add",
  desc: "添加一条待办",
  kind: "write",
});
```

**示例 2 · 通过同源网关调用模型**

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

**精确契约**

[查看对应参考页](/zh/reference/vanilla-jquery-adapter)


<a id="api-vanillapling"></a>

### `VanillaPling`

原生 JS 与 Vue 2.7 共用的 DOM 运行时，暴露 tool、action、record、scope、state、dock、derived 与 destroy。

**导入**

`@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
interface VanillaPling extends VanillaHost {
  tool(element: Element, options: ToolOptions): () => void;
  action(options: ActionOptions): () => void;
  record(element: Element, value: RecordValue | null | undefined): () => void;
  scope(element: Element, options: ScopeOptions): () => void;
  state(key: string, source: StateSource, options?: StateOptions | string): () => void;
  setActiveScopes(scopes: Iterable<string>): void;
  dock(options?: VanillaDockOptions): VanillaDock;
  derived(): DeriveController | null;
  destroy(): void;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `tool` | `(element: Element, options: ToolOptions) => () => void` | 否 | — | 把元素声明成动作，并返回解绑函数。 |
| `action` | `(options: ActionOptions) => () => void` | 否 | — | 声明一个没有 DOM 元素的动作。 |
| `record` | `(element: Element, value: RecordValue \| null \| undefined) => () => void` | 否 | — | 把一行数据声明成记录，并返回解绑函数。 |
| `scope` | `(element: Element, options: ScopeOptions) => () => void` | 否 | — | 声明页面区域，并返回解绑函数。 |
| `state` | `(key: string, source: StateSource, options?: StateOptions \| string) => () => void` | 否 | — | 暴露只读状态视图，并返回注销函数。 |
| `setActiveScopes` | `(scopes: Iterable<string>) => void` | 否 | — | 覆盖活跃区域集合。 |
| `dock` | `(options?: VanillaDockOptions) => VanillaDock` | 否 | — | 挂载原生浮动助手，并返回控制器。 |
| `derived` | `() => DeriveController \| null` | 否 | — | 返回可选的 L1 派生器。 |
| `destroy` | `() => void` | 否 | — | 解绑所有声明并销毁已挂载的浮窗。 |

**示例 1 · 声明并释放一个动作**

```ts
const unbind = pling.tool(button, { desc: "删除当前项", kind: "danger" });

// Later, when the row is removed:
unbind();
```

**精确契约**

[查看对应参考页](/zh/reference/vanilla-jquery-adapter)


<a id="api-destroy"></a>

### `pling.destroy`

停止观察器、派生动作、作用域、存在感、UI 订阅与已挂载的助手界面。

**导入**

`@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
pling.destroy(): void
```

**参数**

无。

**示例 1 · 释放运行时**

```ts
window.addEventListener("pagehide", () => pling.destroy(), { once: true });
```

**精确契约**

[查看对应参考页](/zh/reference/vanilla-jquery-adapter)


## 页面声明

声明动作、记录、区域、状态、页面反馈、任务入口与敏感值。

| API | 类型 | 参考 |
| --- | --- | --- |
| [元素动作](#api-element-action) | 声明 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [函数级动作](#api-function-action) | 声明 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [区域](#api-region) | 声明 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [记录](#api-record) | 声明 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [只读状态](#api-state) | 声明 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [sensitive](#api-sensitive) | 函数 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |

<a id="api-element-action"></a>

### `元素动作`

声明一个控件能做什么。说明是模型唯一的判断依据；执行仍经过可用性、确认与结果判据。

**导入**

`@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
pling.tool(element: Element, options: ToolOptions): () => void
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `element` | `Element` | 是 | — | 要暴露动作的元素。 |
| `options` | `ToolOptions` | 是 | — | 动作声明，包括原语覆盖与可选的注入执行函数。 |

**示例 1 · 原生声明**

```ts
pling.tool(document.querySelector("#add"), {
  id: "add",
  desc: "添加一条待办",
  run: () => add(),
});
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-function-action"></a>

### `函数级动作`

登记一个没有专属 DOM 控件的业务操作。

**导入**

`@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
pling.action(options: ActionOptions): () => void
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `options` | `ActionOptions` | 是 | — | 由代码实现、而不是绑定到 DOM 控件的动作。 |

**示例 1 · 登记动作**

```ts
pling.action({
  id: "clear_completed",
  desc: "清除所有已完成待办",
  run: () => clearCompleted(),
});
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-region"></a>

### `区域`

声明页面的结构区域及其可达性。区域解释上下文，不是权限边界。

**导入**

`@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
pling.scope(element: Element, options: ScopeOptions): () => void
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `element` | `Element` | 是 | — | 区域容器元素。 |
| `options` | `ScopeOptions` | 是 | — | 区域 id 以及可选的面向模型的元数据。 |

**示例 1 · 描述区域**

```ts
pling.scope(document.querySelector("#todos"), {
  id: "todos",
  label: "待办列表",
  role: "list",
});
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-record"></a>

### `记录`

为一行数据提供稳定身份与有界字段。记录是只读的。

**导入**

`@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
pling.record(element: Element, value: RecordValue | null | undefined): () => void
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `element` | `Element` | 是 | — | 表示这一行的元素。 |
| `value` | `RecordValue \| null \| undefined` | 是 | — | 行对象或显式记录包装。 |

**示例 1 · 暴露一行记录**

```ts
pling.record(rowElement, todo);
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-state"></a>

### `只读状态`

暴露当前 UI 状态的只读视图。状态没有 setter；写入必须声明成动作。

**导入**

`@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
pling.state(key: string, source: StateSource, options?: StateOptions | string): () => void
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `key` | `string` | 是 | — | 用于页面上下文与诊断的稳定状态名。 |
| `source` | `unknown \| (() => unknown) \| Ref<unknown> \| Record<string, unknown>` | 是 | — | 值、ref 或读取函数。推荐传函数，让每次快照都反映当前状态。 |
| `options` | `StateOptions \| string` | 否 | — | 说明对象或说明字符串。写清这组状态是什么。 |

**示例 1 · 暴露筛选与计数**

```ts
pling.state("todo", () => ({
  filter: currentFilter,
  total: todos.length,
}), { description: "当前筛选与总数" });
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-sensitive"></a>

### `sensitive`

标记一个值在出站时隐藏、遮罩、代号化或只给提示，同时保留字段名。

**导入**

`@plingjs/core`

**调用方式**

```ts
// Vanilla JS
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
| [ToolOptions](#api-tooloptions) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [ScopeOptions](#api-scopeoptions) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [RecordValue](#api-recordvalue) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [State options](#api-stateoptions) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [AgentSetup](#api-agentsetup) | 类型 | [参考](/zh/reference/agent-runtime-sessions-context-limits) |
| [Kind](#api-kind) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [ParamDeclaration](#api-paramdeclaration) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [Expectation](#api-expectation) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [HandoffStep](#api-handoffstep) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [FlowStep](#api-flowstep) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [RegionRole](#api-regionrole) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [PlingUiOptions](#api-plinguioptions) | 类型 | [参考](/zh/reference/ui-messages-theme-locale) |

<a id="api-tooloptions"></a>

### `ToolOptions`

所有适配器共享的动作声明结构。

**导入**

`@plingjs/vanilla` · `@plingjs/core`

**调用方式**

```ts
// Vanilla JS
type ToolOptions = AtomicToolOptions | ParamsToolOptions
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `desc` | `string` | 是 | — | 必填的面向模型说明，描述控件或操作做什么。这是模型选择工具时最主要的依据。 |
| `id` | `string` | 否 | `generated once per binding` | 稳定动作 id。仅一次性控件可以省略；列表行与流程应显式提供。 |
| `kind` | `"read" \| "write" \| "danger"` | 否 | `write` | 用于确认与审计的风险等级。省略时按 fail-closed 视为 `write`。 |
| `confirm` | `boolean \| "always"` | 否 | `derived from kind` | 覆盖确认推导。`false` 跳过确认，`true` 要求确认，`always` 每次询问且不提供长期允许。 |
| `action` | `"click" \| "fill" \| "select" \| "press" \| "hover"` | 否 | `inferred from element` | 覆盖动作原语推断。默认表单输入使用填写，其余元素使用点击。 |
| `key` | `string` | 否 | `Enter` | 原语为按键时使用的键名。 |
| `scope` | `string` | 否 | `nearest scope` | 显式区域 id。省略时继承最近声明的区域。 |
| `fidelity` | `"high" \| "auto" \| "low"` | 否 | `inferred` | 声明执行目标的可靠程度。显式设置后不再自动定位目标。 |
| `target` | `string` | 否 | — | 限定在声明元素内部查找具体目标的 CSS 选择器。 |
| `autoTarget` | `boolean` | 否 | `true` | 自动定位声明元素内部唯一的原生控件。 |
| `available` | `() => boolean \| string \| undefined` | 否 | — | 动作出现前检查的业务前置条件。返回字符串时，该字符串会作为不可用原因交给模型。 |
| `expect` | `Expectation` | 否 | — | 执行后检查的成功判据。不成立时返回 `EXPECTATION_FAILED`，不会把未完成当成功。 |
| `handoff` | `boolean \| string \| HandoffOptions` | 否 | — | 把这一步交给用户完成，而不是模拟操作。布尔值或字符串形式提供原因。 |
| `params` | `ParamDeclaration` | 条件必填 | — | 带参数表单使用的参数声明。存在时，`run` 收到校验后的参数对象，而不是单个原语值。 |
| `run` | `(valueOrArgs) => void \| Promise<void>` | 否 | — | 注入的执行实现。原子动作收到原语值；带参数动作收到完整参数对象。写了 `steps` 时不会运行。 |
| `steps` | `readonly FlowStep[]` | 否 | — | 把声明变成对模型可见的单个流程，按顺序执行已注册动作 id。不要与 `run` 同时使用。 |

**类型结构**

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

**示例 1 · 带参数的声明**

```ts
pling.tool(button, {
  id: "move_task",
  desc: "把待办移动到指定位置",
  params: [{ name: "position", label: "新位置", type: "number", min: 1 }],
  run: ({ position }) => moveTask(Number(position)),
});
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-scopeoptions"></a>

### `ScopeOptions`

区域声明结构。Vue 3 以 ScopeValue 暴露等价类型。

**导入**

`@plingjs/vanilla`

**调用方式**

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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 是 | — | 稳定区域 id。会写入 DOM，并由后代声明继承。 |
| `label` | `string` | 否 | — | 面向模型的短名称，例如“待办列表”。 |
| `description` | `string` | 否 | — | 说明区域的用途，以及其中动作适用的场景。 |
| `role` | `RegionRole` | 否 | — | `main`、`dialog`、`toolbar`、`list` 等结构角色。只影响阅读顺序与上下文，不构成权限边界。 |
| `parent` | `string` | 否 | — | 为传送门、浮层或挂到 body 的节点显式指定父区域 id。 |

**示例 1 · 区域元数据**

```ts
const scope = {
  id: "orders",
  label: "订单列表",
  description: "当前筛选结果，每行可以打开或删除",
  role: "list",
  parent: "main",
};
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-recordvalue"></a>

### `RecordValue`

一行数据，或带显式 id、label、fields 的完整记录声明。

**导入**

`@plingjs/core`

**调用方式**

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


<a id="api-stateoptions"></a>

### `State options`

只读状态视图的可选说明。

**导入**

`@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
interface StateOptions { description?: string }
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `description` | `string` | 否 | — | 说明状态视图及其单位或范围。描述的是一个有界视图，不是整个 store。 |

**示例 1 · 描述有界视图**

```ts
{ description: "当前筛选项、总条数与未完成条数" }
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-agentsetup"></a>

### `AgentSetup`

应用级运行时选项：模型覆盖、钩子、闸门、事件、跟踪与连续性。

**导入**

`@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
type AgentSetup = Omit<AgentRuntimeOptions, "config" | "registry" | "gate"> & {
  config?: AgentConfigOverrides;
  gate?: () => boolean;
}
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `config` | `AgentConfigOverrides` | 否 | — | 模型与运行时的局部配置。未写的字段从 `VITE_AGENT_*` 环境变量或框架默认值读取。 |
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

**示例 1 · 应用级助手接线**

```ts
const pling = createPling({
  agent: { config: { limits: { maxTurns: 12 } }, trace: true },
});
```

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-kind"></a>

### `Kind`

动作的风险等级，供确认策略使用。

**导入**

`@plingjs/core`

**调用方式**

```ts
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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
// Vanilla JS
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


## 助手界面

已挂载的对话与检查界面。它们渲染共享运行时，不创建第二个 Agent。

| API | 类型 | 参考 |
| --- | --- | --- |
| [VanillaDock](#api-vanilladock) | 接口 | [参考](/zh/reference/vanilla-jquery-adapter) |

<a id="api-vanilladock"></a>

### `VanillaDock`

pling.dock() 返回的 DOM 浮窗控制器：element、runtime、open、close、toggle、isOpen、destroy。

**导入**

`@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
pling.dock(options?: VanillaDockOptions): VanillaDock
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | `string` | 否 | — | 助手标题。 |
| `placeholder` | `string` | 否 | — | 输入框占位文案。 |
| `emptyHint` | `string` | 否 | — | 空状态文案。 |
| `quick` | `readonly string[]` | 否 | — | 推荐指令。 |
| `defaultOpen` | `boolean` | 否 | `false` | 浮窗是否默认展开。 |
| `config` | `AgentConfigOverrides` | 否 | — | 浮窗级模型覆盖。 |
| `llm` | `Llm` | 否 | — | 注入的模型函数。 |
| `hooks` | `HookRegistry` | 否 | — | 浮窗级工具钩子。 |
| `gate` | `() => boolean` | 否 | — | 确认通道开关。 |
| `registry` | `Registry` | 否 | — | 要操作的注册表。默认使用当前 Pling 实例的注册表。 |
| `onSessionEvent` | `(event: SessionEvent) => void` | 否 | — | 会话事件回调。 |
| `onOpenChange` | `(open: boolean) => void` | 否 | — | 浮窗展开或收起时调用。 |
| `navigate` | `(href: string) => void` | 否 | `window.location.replace` | 任务完成后的导航实现。 |
| `return.element` | `HTMLElement` | 否 | — | 浮窗持有的根元素。 |
| `return.runtime` | `AgentRuntime` | 否 | — | 驱动浮窗对话的运行时。 |
| `return.open()` | `void` | 否 | — | 展开浮窗。 |
| `return.close()` | `void` | 否 | — | 收起浮窗并保留对话。 |
| `return.toggle()` | `void` | 否 | — | 切换展开状态。 |
| `return.isOpen()` | `boolean` | 否 | — | 返回当前展开状态。 |
| `return.destroy()` | `void` | 否 | — | 移除浮窗并释放其运行时资源。 |

**示例 1 · 挂载并控制原生浮窗**

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

**精确契约**

[查看对应参考页](/zh/reference/vanilla-jquery-adapter)


## 页面身份与连续性

读取页面身份、在同源框架间共享运行时，并检查声明覆盖率。

| API | 类型 | 参考 |
| --- | --- | --- |
| [PlingPage](#api-plingpage) | 接口 | [参考](/zh/reference/continuity-and-projection) |
| [createPlingPage](#api-createplingpage) | 函数 | [参考](/zh/reference/continuity-and-projection) |
| [sharePlingPageWithFrame](#api-shareplingpagewithframe) | 函数 | [参考](/zh/reference/continuity-and-projection) |
| [plingPageFromParent](#api-plingpagefromparent) | 函数 | [参考](/zh/reference/continuity-and-projection) |
| [waitForPlingPageFromParent](#api-waitforplingpagefromparent) | 函数 | [参考](/zh/reference/continuity-and-projection) |

<a id="api-plingpage"></a>

### `PlingPage`

由多个框架岛或同源 iframe 共享的页面级运行时。

**导入**

`@plingjs/dom` · `@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
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

`@plingjs/dom` · `@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
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

`@plingjs/dom` · `@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
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

`@plingjs/dom` · `@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
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

`@plingjs/dom` · `@plingjs/vanilla`

**调用方式**

```ts
// Vanilla JS
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


## 版本与兼容性

| 包 | 版本 | 对等依赖 |
| --- | --- | --- |
| `@plingjs/vue` | `0.1.0-alpha.2` | `vue ^3` |
| `@plingjs/react` | `0.1.0-alpha.2` | `react >=18` |
| `@plingjs/vue2` | `0.1.0-alpha.2` | `vue ^2.7.0` |
| `@plingjs/vanilla` | `0.1.0-alpha.2` | — |

| 项目 | 值 |
| --- | --- |
| 引入版本 | `0.1.0-alpha.2` |
| 稳定性 | pre-1.0 alpha；次要版本可能改变 API |

## 机器可读副本

- [本页 JSON](/zh/api-index/vanilla.json)
- [API 总览 JSON](/zh/api-index.json)
