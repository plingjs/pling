---
title: "Vue 3 API"
status: navigation
release: 0.1
locale: zh
---
<!-- generated:api-index -->

# Vue 3 API

Vue 3 的完整 API：应用初始化、指令、组合式函数、组件，以及它们使用的共享选项类型。下面出现的签名都按 Vue 3 的写法给出。

本页只列 `@plingjs/vue` 的入口，以及与它一起使用的共享包类型。

[API 总览](/zh/reference/api/) · [共享包 API](/zh/reference/api/shared)

| 包 | 对等依赖 | 版本 |
| --- | --- | --- |
| `@plingjs/vue` | vue ^3 | `0.1.0-alpha.2` |

当前包版本为 `0.1.0-alpha.2`；稳定性为 **preview**。这是 pre-1.0 alpha，次要版本仍可能改变 API。

## 最小示例

```ts
import { createPling, AgentDock } from "@plingjs/vue";

const pling = createPling({ namespace: "todo" });
app.use(pling.plugin);
```

## 入口与生命周期

创建应用级运行时、安装适配器，并释放它持有的观察器。

| API | 类型 | 参考 |
| --- | --- | --- |
| [createPling](#api-createpling) | 函数 | [参考](/zh/reference/vue-3-adapter) |
| [usePling](#api-usepling) | 函数 | [参考](/zh/reference/vue-3-adapter) |
| [pling.plugin](#api-plugin) | 插件 | [参考](/zh/reference/vue-3-adapter) |
| [PlingElement](#api-plingelement) | 接口 | [参考](/zh/reference/vue-3-adapter) |
| [pling.destroy](#api-destroy) | 方法 | [参考](/zh/reference/vue-3-adapter) |

<a id="api-createpling"></a>

### `createPling`

创建应用级 Pling 实例，并返回对应适配器的运行时对象。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
createPling(options?: PlingOptions): PlingElement;
createPling(registry: Registry | undefined, options?: PlingOptions): PlingElement;
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
| `diagnostics` | `boolean` | 否 | `import.meta.env.DEV` | 挂载后扫描一次未声明的可操作控件，并通过 `onWarn` 报告覆盖率。仅在 Vite 开发模式下默认开启。 |
| `page` | `false \| PageOptions` | 否 | `location + document.title` | 控制页面身份收集。默认读取 `location` 与 `document.title`；传 `false` 关闭。 |

**返回值**

适配器实例。Vue 3 与 React 返回 PlingElement；Vue 2.7 与原生 JS 返回 VanillaPling。

**默认行为**

- 未声明的控件不会成为动作；derive 默认关闭。
- 动作高亮默认开启。
- 聊天中还原敏感值默认开启。

**示例 1 · Vue 3 应用初始化**

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

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-usepling"></a>

### `usePling`

从当前框架组件树中读取最近的 Pling 实例。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
usePling(): PlingElement
```

**参数**

无。

**示例 1 · 读取注入的运行时**

```ts
const pling = usePling();

onMounted(() => pling.inspectCoverage());
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-plugin"></a>

### `pling.plugin`

安装 Vue 指令与运行时注入键。React 使用 PlingProvider。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
createApp(App).use(pling.plugin)
```

**参数**

无。

**示例 1 · 安装 Vue 3 指令**

```ts
createApp(App).use(pling.plugin).mount("#app");
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-plingelement"></a>

### `PlingElement`

Vue 3 与 React 的应用级运行时：注册表、UI 控制器、页面身份、任务路由、覆盖率与清理。

**导入**

`@plingjs/vue`

**调用方式**

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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `registry` | `Registry` | 否 | — | 共享的动作、记录、状态与反馈注册表。 |
| `ui` | `PlingUiController` | 否 | — | 语言、主题、文案目录与 CSS 变量控制器。 |
| `feedback` | `FeedbackCollector` | 否 | — | 应用共用的页面级反馈收集器。 |
| `page` | `PageTracker` | 否 | — | 跟踪路由、路径、标题与白名单查询参数。 |
| `plugin` | `{ install(app: App): void }` | 否 | — | 注册指令与注入键的 Vue 插件。 |
| `ask` | `(prompt: string, options?: PlingAskOptions) => Promise<void>` | 否 | — | 把用户发起的任务交给已挂载的助手界面。 |
| `task` | `PlingTaskController` | 否 | — | 内置界面使用的任务路由控制器。 |
| `derived` | `() => DeriveController \| null` | 否 | — | 返回可选的 L1 派生器。未开启 `derive` 时为 `null`。 |
| `inspectCoverage` | `() => CoverageReport` | 否 | — | 扫描挂载根，报告未声明的可操作控件。 |
| `scopes` | `ScopeController` | 否 | — | 区域可见性、视口与遮挡控制器。 |
| `setActiveScopes` | `(scopes: Iterable<string>) => void` | 否 | — | 自动判定不适用时，手动替换活跃区域集合。 |
| `destroy` | `() => void` | 否 | — | 停止观察器并释放该运行时持有的声明。 |
| `agent` | `AgentSetup` | 否 | — | 传给 `createPling` 的应用级助手接线。 |
| `revealSensitive` | `boolean` | 否 | — | 渲染对话时是否还原敏感值代号。 |

**示例 1 · 查看页面暴露了什么**

```ts
const pling = createPling();

console.table(pling.inspectCoverage().targets);
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-destroy"></a>

### `pling.destroy`

停止观察器、派生动作、作用域、存在感、UI 订阅与已挂载的助手界面。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
pling.destroy(): void
```

**参数**

无。

**示例 1 · 释放运行时**

```ts
onBeforeUnmount(() => pling.destroy());
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


## 页面声明

声明动作、记录、区域、状态、页面反馈、任务入口与敏感值。

| API | 类型 | 参考 |
| --- | --- | --- |
| [元素动作](#api-element-action) | 声明 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [函数级动作](#api-function-action) | 声明 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [区域](#api-region) | 声明 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [记录](#api-record) | 声明 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [只读状态](#api-state) | 声明 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [Store 状态](#api-store-state) | 声明 | [参考](/zh/reference/vue-3-adapter) |
| [页面反馈](#api-feedback) | 声明 | [参考](/zh/reference/vue-3-adapter) |
| [任务入口](#api-task-entry) | 声明 | [参考](/zh/reference/vue-3-adapter) |
| [引导目标](#api-guide-target) | 声明 | [参考](/zh/reference/vue-3-adapter) |
| [sensitive](#api-sensitive) | 函数 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |

<a id="api-element-action"></a>

### `元素动作`

声明一个控件能做什么。说明是模型唯一的判断依据；执行仍经过可用性、确认与结果判据。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
v-tool="string | ToolOptions | ToolOptions[]"
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `v-tool` | `string \| ToolOptions \| ToolOptions[]` | 是 | — | 字符串是一句说明的简写。需要稳定 id、风险等级、参数、流程、成功判据或自定义执行时，传对象或数组。 |

**示例 1 · 字符串简写**

```ts
<button v-tool="'添加一条待办'">添加</button>
```

**示例 2 · 稳定 id 与注入执行**

```vue
<button v-tool="{
  id: 'add',
  desc: '添加一条待办',
  kind: 'write',
  available: () => draft.trim() ? true : '先输入待办内容',
  run: () => add(),
}">添加</button>
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-function-action"></a>

### `函数级动作`

登记一个没有专属 DOM 控件的业务操作。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
useAgentTool(options: AgentToolOptions): void
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `options` | `AgentToolOptions` | 是 | — | id、说明、风险、可用性、参数、成功判据与实现。 |

**示例 1 · 登记应用级动作**

```ts
useAgentTool({
  id: "clear_completed",
  desc: "清除所有已完成待办",
  kind: "write",
  available: () => remaining.value < all.value || "没有已完成待办",
  run: () => clearCompleted(),
});
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-region"></a>

### `区域`

声明页面的结构区域及其可达性。区域解释上下文，不是权限边界。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
v-scope="string | { id; label?; description?; role?; parent? }"
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `v-scope` | `string \| ScopeValue` | 是 | — | 字符串是稳定区域 id。对象形式可补区域名、说明、结构角色或显式父区域。 |

**示例 1 · 描述列表区域**

```ts
<section v-scope="{ id: 'todos', label: '待办列表', role: 'list' }">...</section>
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-record"></a>

### `记录`

为一行数据提供稳定身份与有界字段。记录是只读的。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
v-record="RecordValue | null | undefined"
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `v-record` | `RecordValue \| null \| undefined` | 是 | — | 行对象，或 `{ data, id, label, fields }` 包装对象，用来限制模型可读字段。 |

**示例 1 · 只暴露选定字段**

```ts
<li v-for="todo in todos" :key="todo.id" v-record="{
  data: todo,
  label: `待办：${todo.text}`,
  fields: { text: todo.text, done: todo.done },
}">...</li>
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-state"></a>

### `只读状态`

暴露当前 UI 状态的只读视图。状态没有 setter；写入必须声明成动作。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
useAgentState(key: string, source: StateSource, options?: AgentStateOptions | string): () => void
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `key` | `string` | 是 | — | 用于页面上下文与诊断的稳定状态名。 |
| `source` | `unknown \| (() => unknown) \| Ref<unknown> \| Record<string, unknown>` | 是 | — | 值、ref 或读取函数。推荐传函数，让每次快照都反映当前状态。 |
| `options` | `StateOptions \| string` | 否 | — | 说明对象或说明字符串。写清这组状态是什么。 |

**示例 1 · 暴露筛选与计数**

```ts
useAgentState("todo", () => ({
  filter: filter.value,
  total: todos.value.length,
  remaining: todos.value.filter((todo) => !todo.done).length,
}), { description: "当前筛选与未完成数量" });
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-store-state"></a>

### `Store 状态`

从 Pinia 或 Vuex 中显式选择字段，不会把整个 store 暴露给模型。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
useAgentStoreState<S extends object>(key: string, store: S, read: AgentStoreRead<S>, options?: AgentStateOptions | string): () => void
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `key` | `string` | 是 | — | 稳定状态名。 |
| `store` | `S extends object` | 是 | — | Pinia 或 Vuex 风格的 store 对象。 |
| `read` | `readonly string[] \| ((store: S) => unknown)` | 是 | — | 字段白名单，或返回有界视图的 selector。 |
| `options` | `AgentStateOptions \| string` | 否 | — | 随状态一起进入模型上下文的说明。 |

**示例 1 · 暴露 store 字段白名单**

```ts
const cart = useCartStore();
useAgentStoreState("cart", cart, ["count", "total"], "购物车件数与小计");
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-feedback"></a>

### `页面反馈`

发布用户可见的反馈或页面级说明，不把它变成动作。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
v-feedback="FeedbackValue | FeedbackValue[]"
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `v-feedback` | `FeedbackValue \| FeedbackValue[]` | 是 | — | 字符串，或包含 `message`、`field`、`severity`、`scope`、`id` 的对象。变化的值可用函数读取。 |

**示例 1 · 暴露表单错误**

```ts
<p v-feedback="error ? { message: error, field: 'email', severity: 'error' } : null" />
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-task-entry"></a>

### `任务入口`

把人写的任务交给已挂载的助手。它不会作为动作暴露给模型。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
v-task="string | TaskOptions"
pling.ask(prompt: string, options?: PlingAskOptions): Promise<void>
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `v-task` | `string \| TaskOptions` | 是 | — | 提示词字符串，或包含 `prompt`、`surface`、`disabled` 的对象。 |

**示例 1 · 转交一条用户任务**

```ts
<button v-task="'整理今天的待办并标出最紧急的一项'">让助手整理</button>
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-guide-target"></a>

### `引导目标`

人工接力时高亮一个并非动作的目标元素。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
v-guide-target="string"
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 是 | — | 被 `HandoffStep.highlight` 引用的引导目标 id。 |

**示例 1 · 高亮人工接力目标**

```ts
<input v-guide-target="'captcha'" />
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-sensitive"></a>

### `sensitive`

标记一个值在出站时隐藏、遮罩、代号化或只给提示，同时保留字段名。

**导入**

`@plingjs/core` · `@plingjs/vue`

**调用方式**

```ts
// Vue 3
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
| [AgentToolOptions](#api-agenttooloptions) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [Expectation](#api-expectation) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [HandoffStep](#api-handoffstep) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [FlowStep](#api-flowstep) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [RegionRole](#api-regionrole) | 类型 | [参考](/zh/reference/core-declarations-actions-records-regions-state) |
| [PlingUiOptions](#api-plinguioptions) | 类型 | [参考](/zh/reference/ui-messages-theme-locale) |
| [ModelSettingsSetting](#api-modelsettingssetting) | 类型 | [参考](/zh/reference/vue-3-adapter) |

<a id="api-tooloptions"></a>

### `ToolOptions`

所有适配器共享的动作声明结构。

**导入**

`@plingjs/vue` · `@plingjs/core`

**调用方式**

```ts
// Vue 3
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
const move = {
  id: "move_task",
  desc: "把待办移动到指定位置",
  kind: "write",
  params: [{ name: "position", label: "新位置", type: "number", min: 1 }],
  run: ({ position }) => moveTask(Number(position)),
};

// <button v-tool="move">上移</button>
```

**精确契约**

[查看对应参考页](/zh/reference/core-declarations-actions-records-regions-state)


<a id="api-scopeoptions"></a>

### `ScopeOptions`

区域声明结构。Vue 3 以 ScopeValue 暴露等价类型。

**导入**

`@plingjs/vue`

**调用方式**

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

`@plingjs/core` · `@plingjs/vue`

**调用方式**

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

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
interface AgentStateOptions { description?: string }
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

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
type AgentSetup = Omit<AgentRuntimeOptions, "config" | "registry" | "gate"> & {
  config?: AgentConfigOverrides;
  modelSettings?: ModelSettingsSetting;
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
| `modelSettings` | `ModelSettingsSetting` | 否 | `off` | 在运行视图中提供模型连接设置。`readonly` 只展示应用配置；`byok` 允许用户在可信页面填写端点、模型和密钥。 |

**示例 1 · 应用级助手接线**

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

**精确契约**

[查看对应参考页](/zh/reference/agent-runtime-sessions-context-limits)


<a id="api-kind"></a>

### `Kind`

动作的风险等级，供确认策略使用。

**导入**

`@plingjs/core`

**调用方式**

```ts
// Vue 3
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
// Vue 3
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


<a id="api-agenttooloptions"></a>

### `AgentToolOptions`

函数级动作的声明结构：稳定 id、面向模型的说明、可选参数协议、可用性、成功判据与实现。

**导入**

`@plingjs/vue`

**调用方式**

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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 是 | — | 模型调用时使用的全局唯一动作 id。 |
| `desc` | `string` | 是 | — | 必填的操作语义说明。 |
| `kind` | `Kind` | 否 | `write` | 风险等级。省略时按 fail-closed 视为 `write`。 |
| `confirm` | `boolean \| "always"` | 否 | `derived from kind` | 覆盖常规确认策略。 |
| `params` | `ParamDeclaration` | 否 | — | 参数声明与校验；`run` 收到规整后的参数对象。 |
| `available` | `() => boolean \| string` | 否 | — | 前置条件检查。返回字符串时，会作为不可用原因交给模型。 |
| `expect` | `Expectation` | 否 | — | `run` 完成后的成功判据。 |
| `run` | `(args: Record<string, unknown>) => unknown` | 是 | — | 校验后的实现。执行前会还原敏感值代号。 |

**示例 1 · 带参数的函数动作**

```ts
useAgentTool({
  id: "set_priority",
  desc: "设置订单优先级",
  kind: "write",
  params: [{ name: "level", label: "优先级", values: ["low", "normal", "high"] }],
  run: ({ level }) => setPriority(String(level)),
});
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
// Vue 3
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
// Vue 3
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

`@plingjs/core` · `@plingjs/vue`

**调用方式**

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

`@plingjs/core` · `@plingjs/vue`

**调用方式**

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

`@plingjs/ui` · `@plingjs/vue`

**调用方式**

```ts
// Vue 3
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


<a id="api-modelsettingssetting"></a>

### `ModelSettingsSetting`

控制运行视图是否展示应用托管或用户自带的模型设置。

**导入**

`@plingjs/vue`

**调用方式**

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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `mode` | `"off" \| "readonly" \| "byok"` | 是 | — | `off` 隐藏模型设置；`readonly` 展示应用托管配置；`byok` 允许用户填写端点、模型和密钥。 |
| `persist` | `"memory" \| "session"` | 否 | `memory` | `byok` 下，填写的配置只保留在当前运行时，或写入 sessionStorage 直到标签页关闭。应用托管模式不会使用该存储。 |

**示例 1 · 在可信页面允许自带密钥**

```ts
createPling({
  agent: { modelSettings: { mode: "byok", persist: "session" } },
});
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


## 助手界面

已挂载的对话与检查界面。它们渲染共享运行时，不创建第二个 Agent。

| API | 类型 | 参考 |
| --- | --- | --- |
| [AgentDock](#api-agentdock) | 组件 | [参考](/zh/reference/vue-3-adapter) |
| [AgentInline](#api-agentinline) | 组件 | [参考](/zh/reference/vue-3-adapter) |
| [AgentChat](#api-agentchat) | 组件 | [参考](/zh/reference/vue-3-adapter) |
| [AgentPanel](#api-agentpanel) | 组件 | [参考](/zh/reference/vue-3-adapter) |
| [createPlingUi](#api-createplingui) | 函数 | [参考](/zh/reference/ui-messages-theme-locale) |

<a id="api-agentdock"></a>

### `AgentDock`

浮动或侧边栏助手界面，负责位置、任务登记、展开状态与运行视图。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
<AgentDock />
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | `string` | 否 | — | 助手标题。默认使用当前语言的文案。 |
| `placeholder` | `string` | 否 | — | 输入框占位文案。 |
| `emptyHint` | `string` | 否 | — | 首次对话前显示的空状态提示。 |
| `quick` | `readonly string[]` | 否 | `[]` | 推荐指令；每次运行结束后仍可继续使用。 |
| `defaultOpen` | `boolean` | 否 | `false` | 界面是否默认展开。 |
| `config` | `AgentConfigOverrides` | 否 | — | 只覆盖当前界面的模型与运行时设置。 |
| `llm` | `Llm` | 否 | — | 当前界面使用的模型函数，覆盖应用级 `agent.llm`。 |
| `hooks` | `HookRegistry` | 否 | — | 当前界面的工具钩子。未传时使用应用级钩子。 |
| `gate` | `() => boolean` | 否 | — | 当前界面的确认通道开关。 |
| `registry` | `Registry` | 否 | — | 要操作的注册表。默认使用注入的 Pling 注册表。 |
| `navigate` | `(href: string) => void` | 否 | — | 任务完成后的导航实现。默认调用 `window.location.replace`。 |
| `layout` | `"dock" \| "sidebar"` | 否 | `"dock"` | 浮动角落布局或视口侧边栏。 |
| `side` | `"left" \| "right"` | 否 | `"right"` | 侧边栏模式下的贴边方向。 |
| `launcherPlacement` | `"bottom" \| "center"` | 否 | `"bottom"` | 侧边栏收起后启动按钮的位置。 |
| `launcherLabel` | `string` | 否 | — | 收起状态启动按钮的自定义文案。 |
| `debug` | `boolean \| AgentTraceOptions` | 否 | `false` | 在“运行”中开启只读请求诊断器。默认关闭。 |
| `modelSettings` | `ModelSettingsSetting` | 否 | `off` | 在“运行”中展示应用模型配置，或允许用户自带密钥。 |
| `@event` | `(event: SessionEvent) => void` | 否 | — | 每个会话事件触发一次。 |
| `@open` | `(open: boolean) => void` | 否 | — | 浮窗展开或收起时触发。 |

**示例 1 · Vue 3 一行接入**

```ts
<AgentDock
  title="待办助手"
  :quick="['把第一条待办标记完成']"
  :debug="true"
  @event="audit"
/>
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-agentinline"></a>

### `AgentInline`

把对话嵌入业务列，而不是使用浮动界面。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
<AgentInline />
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | `string` | 否 | — | 助手标题。 |
| `placeholder` | `string` | 否 | — | 输入框占位文案。 |
| `emptyHint` | `string` | 否 | — | 空状态文案。 |
| `quick` | `readonly string[]` | 否 | `[]` | 推荐指令。 |
| `config` | `AgentConfigOverrides` | 否 | — | 当前界面的模型覆盖。 |
| `llm` | `Llm` | 否 | — | 注入的模型函数。 |
| `hooks` | `HookRegistry` | 否 | — | 当前界面的工具钩子。 |
| `gate` | `() => boolean` | 否 | — | 确认通道开关。 |
| `registry` | `Registry` | 否 | — | 要操作的注册表。 |
| `navigate` | `(href: string) => void` | 否 | — | 任务完成后的导航实现。 |
| `visible` | `boolean` | 否 | `true` | 控制是否可见但不卸载，从而保留对话状态。 |
| `variant` | `"dock" \| "inline"` | 否 | `"inline"` | 使用紧凑浮窗宽度或常规内联布局。 |
| `manageSurface` | `boolean` | 否 | `true` | 把组件注册到页面任务路由器。浮窗外壳自己负责路由，因此传 `false`。 |
| `surfaceId` | `string` | 否 | `"inline"` | 启用 `manageSurface` 时用于任务路由的名称。 |
| `collapsible` | `boolean` | 否 | `false` | 显示浮窗外壳使用的收起按钮。 |
| `debug` | `boolean \| AgentTraceOptions` | 否 | `false` | 开启只读请求诊断器。 |
| `modelSettings` | `ModelSettingsSetting` | 否 | `off` | “运行”中的模型设置入口。 |
| `@event` | `(event: SessionEvent) => void` | 否 | — | 会话事件流。 |
| `@collapse` | `() => void` | 否 | — | 请求父级外壳收起界面。 |
| `@status` | `(status: { running; resume }) => void` | 否 | — | 报告运行状态与是否有可恢复任务。 |

**示例 1 · 为工作台预留一列**

```ts
<div class="workspace">
  <main>...</main>
  <AgentInline title="操作助手" />
</div>
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-agentchat"></a>

### `AgentChat`

渲染对话与确认状态，不负责位置或会话所有权。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
<AgentChat />
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | `string` | 否 | — | 对话标题。 |
| `events` | `readonly SessionEvent[]` | 否 | `[]` | 要渲染的会话事件。 |
| `running` | `boolean` | 否 | `false` | 禁用输入并显示运行状态。 |
| `pending` | `PendingApproval \| null` | 否 | `null` | 当前确认请求。 |
| `pendingHandoff` | `PendingHandoff \| null` | 否 | — | 当前人工接力请求。 |
| `placeholder` | `string` | 否 | — | 输入框占位文案。 |
| `emptyHint` | `string` | 否 | — | 空状态文案。 |
| `tools` | `boolean` | 否 | `false` | 在对话中显示原始工具调用行。 |
| `reveal` | `(text: string) => string` | 否 | — | 仅用于渲染的文本转换，常用于还原敏感值代号。 |
| `resume` | `{ goal?: string; interrupted?: boolean } \| null` | 否 | `null` | 显示“继续上次任务”提示。 |
| `@send` | `(text: string) => void` | 否 | — | 用户提交消息。 |
| `@reply` | `(decision: boolean \| "always") => void` | 否 | — | 用户回答了确认请求。 |
| `@handoff` | `(done: boolean) => void` | 否 | — | 用户完成或取消人工接力。 |
| `@handoffStep` | `(delta: number) => void` | 否 | — | 用户切换人工接力步骤。 |
| `#footer` | `slot` | 否 | — | 渲染在输入框上方的附加内容。 |

**示例 1 · 渲染外部接线的对话**

```ts
<AgentChat
  :events="events"
  :running="running"
  :pending="pending"
  @send="send"
  @reply="reply"
/>
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-agentpanel"></a>

### `AgentPanel`

开发期只读快照视图，用来查看 Agent 当前能看到什么。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
<AgentPanel />
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | `string` | 否 | — | 面板标题。默认使用当前语言的文案。 |
| `policy` | `Policy` | 否 | — | 面板手动执行控件使用的权限策略。默认自动批准，仅适合调试。 |
| `@executed` | `(event: ExecutedEvent) => void` | 否 | — | 从面板执行动作后触发。 |
| `#compose` | `{ execute, snapshot }` | 否 | — | 暴露面板执行器与当前快照的插槽，用于自定义控件。 |

**示例 1 · 查看声明与覆盖率**

```ts
<AgentPanel @executed="audit" />
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-createplingui"></a>

### `createPlingUi`

创建 Vue 界面背后的共享语言、主题与文案控制器。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
createPlingUi(options?: PlingUiOptions, defaultLocale?: string): PlingUiController
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
| `defaultLocale` | `string` | 否 | `en-US` | 未传 `ui.locale` 时使用的兜底语言。 |

**示例 1 · 创建独立界面控制器**

```ts
const ui = createPlingUi({ locale: "zh-CN", theme: "auto" });
ui.setTheme("dark");
console.log(ui.t("chat.send"));
```

**精确契约**

[查看对应参考页](/zh/reference/ui-messages-theme-locale)


## 页面身份与连续性

读取页面身份、在同源框架间共享运行时，并检查声明覆盖率。

| API | 类型 | 参考 |
| --- | --- | --- |
| [PageOptions](#api-pageoptions) | 类型 | [参考](/zh/reference/vue-3-adapter) |
| [PlingPage](#api-plingpage) | 接口 | [参考](/zh/reference/continuity-and-projection) |
| [createPlingPage](#api-createplingpage) | 函数 | [参考](/zh/reference/continuity-and-projection) |
| [sharePlingPageWithFrame](#api-shareplingpagewithframe) | 函数 | [参考](/zh/reference/continuity-and-projection) |
| [plingPageFromParent](#api-plingpagefromparent) | 函数 | [参考](/zh/reference/continuity-and-projection) |
| [waitForPlingPageFromParent](#api-waitforplingpagefromparent) | 函数 | [参考](/zh/reference/continuity-and-projection) |
| [inspectCoverage](#api-inspectcoverage) | 方法 | [参考](/zh/reference/vue-3-adapter) |

<a id="api-pageoptions"></a>

### `PageOptions`

控制自动页面身份、路由集成、query 白名单、hash 处理与标题覆盖。

**导入**

`@plingjs/vue`

**调用方式**

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

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `enabled` | `boolean` | 否 | `true` | 开启页面身份收集。`createPling({ page: false })` 是关闭它的简写。 |
| `router` | `PageRouterLike` | 否 | — | 提供路由名称、参数、hash 与 `meta.title` 的 Vue Router 风格对象。省略时，适配器在挂载后尝试读取 `$router`。 |
| `queryKeys` | `readonly string[]` | 否 | `[]` | 允许进入模型上下文的查询参数白名单。查询参数默认全部隐藏。 |
| `hash` | `boolean` | 否 | `true` | 是否包含安全的 hash 片段。看起来像查询串的 hash 会被忽略。 |
| `title` | `() => string \| undefined` | 否 | — | 标题覆盖或兜底值。优先于路由 `meta.title` 与 `document.title`。 |

**示例 1 · 暴露路由身份但不暴露令牌**

```ts
createPling({
  page: {
    queryKeys: ["tab"],
    title: () => route.meta.title as string | undefined,
  },
});
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-plingpage"></a>

### `PlingPage`

由多个框架岛或同源 iframe 共享的页面级运行时。

**导入**

`@plingjs/dom` · `@plingjs/vue`

**调用方式**

```ts
// Vue 3
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

`@plingjs/dom` · `@plingjs/vue`

**调用方式**

```ts
// Vue 3
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

`@plingjs/dom` · `@plingjs/vue`

**调用方式**

```ts
// Vue 3
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

`@plingjs/dom` · `@plingjs/vue`

**调用方式**

```ts
// Vue 3
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

`@plingjs/dom` · `@plingjs/vue`

**调用方式**

```ts
// Vue 3
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

`@plingjs/vue` · `@plingjs/dom`

**调用方式**

```ts
// Vue 3
pling.inspectCoverage(): CoverageReport
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

**示例 1 · 检查 Vue 覆盖率**

```ts
const report = pling.inspectCoverage();
console.log(report.coveragePercent, report.targets);
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


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

- [本页 JSON](/zh/api-index/vue-3.json)
- [API 总览 JSON](/zh/api-index.json)
