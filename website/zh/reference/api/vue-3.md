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
| `@plingjs/vue` | vue ^3 | `0.1.0-alpha.6` |

当前包版本为 `0.1.0-alpha.6`；稳定性为 **preview**。这是 pre-1.0 alpha，次要版本仍可能改变 API。

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

Vue 3 与 React 的应用级运行时：注册表、UI 控制器、页面身份、任务路由、覆盖率与清理。Vue 3 还持有当前页面的引导任务目录。

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
  task: PlingTaskController & TaskCatalog;
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
| `task` | `PlingTaskController & TaskCatalog` | 否 | — | 面向人的任务入口，同时也是当前页面的引导任务目录。用 `define()` 登记任务，再通过 `active()` 读取当前任务或 `activate()` 激活指定任务。 |
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
| `modelVisible` | `boolean` | 否 | `true` | 让动作不出现在模型工具清单与动作快照中，但页面代码和任务步骤仍可调用。这是可见性边界，不是权限校验。 |
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
  label?: string;
  summary?: string;
  examples?: readonly string[];
  successHint?: string;
  playbook?: readonly string[];
  kind?: Kind;
  confirm?: boolean | "always";
  modelVisible?: boolean;
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
| `modelVisible` | `boolean` | 否 | `true` | 让动作不出现在模型工具清单与动作快照中，但页面代码和任务步骤仍可调用。这是可见性边界，不是权限校验。 |
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
| `sidebarMode` | `"overlay" \| "fused"` | 否 | `"overlay"` | 侧栏覆盖页面，或作为应用栅格的一列参与布局。仅对 `layout="sidebar"` 生效。 |
| `side` | `"left" \| "right"` | 否 | `"right"` | 侧边栏模式下的贴边方向。 |
| `launcherPlacement` | `"bottom" \| "center"` | 否 | `"bottom"` | 侧边栏收起后启动按钮的位置。 |
| `launcherLabel` | `string` | 否 | — | 收起状态启动按钮的自定义文案。 |
| `debug` | `boolean \| AgentTraceOptions` | 否 | `false` | 在“运行”中开启只读请求诊断器。默认关闭。 |
| `modelSettings` | `ModelSettingsSetting` | 否 | `off` | 在“运行”中展示应用模型配置，或允许用户自带密钥。 |
| `#task` | `slot` | 否 | — | 覆盖对话上方的任务展示。留空时由内置界面自动渲染 active 引导。 |
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
| `speakers` | `boolean` | 否 | `false` | 在每条聊天消息上方显示说话人与时间。 |
| `quick` | `readonly string[]` | 否 | `[]` | 推荐指令。 |
| `config` | `AgentConfigOverrides` | 否 | — | 当前界面的模型覆盖。 |
| `llm` | `Llm` | 否 | — | 注入的模型函数。 |
| `hooks` | `HookRegistry` | 否 | — | 当前界面的工具钩子。 |
| `gate` | `() => boolean` | 否 | — | 确认通道开关。 |
| `registry` | `Registry` | 否 | — | 要操作的注册表。 |
| `navigate` | `(href: string) => void` | 否 | — | 任务完成后的导航实现。 |
| `visible` | `boolean` | 否 | `true` | 控制是否可见但不卸载，从而保留对话状态。 |
| `variant` | `"dock" \| "inline"` | 否 | `"inline"` | 使用紧凑浮窗宽度或常规内联布局。 |
| `composer` | `"compact" \| "multiline"` | 否 | `"compact"` | 输入区密度。`multiline` 为工作台提供两行起步、自动增高的文本域；`compact` 保持单行输入。 |
| `taskPlacement` | `"inline" \| "pinned"` | 否 | `"inline"` | 把当前引导放在消息流中，或固定在滚动消息区的上方。 |
| `guidePlacement` | `"top" \| "end"` | 否 | `"top"` | 把 `#guide` 插槽渲染在对话上方，或作为会话中的最新消息。需要持续更新的下一步提示时用 `end`。 |
| `manageSurface` | `boolean` | 否 | `true` | 把组件注册到页面任务路由器。浮窗外壳自己负责路由，因此传 `false`。 |
| `surfaceId` | `string` | 否 | `"inline"` | 启用 `manageSurface` 时用于任务路由的名称。 |
| `collapsible` | `boolean` | 否 | `false` | 显示浮窗外壳使用的收起按钮。 |
| `debug` | `boolean \| AgentTraceOptions` | 否 | `false` | 开启只读请求诊断器。 |
| `modelSettings` | `ModelSettingsSetting` | 否 | `off` | “运行”中的模型设置入口。 |
| `beforeSend` | `AgentBeforeSendHandler` | 否 | — | 可选的本地响应器。返回 `{ handled: true, reply }` 时直接更新页面状态并回复，不调用模型。适合确定性的信息录入、修正与确认步骤。 |
| `#task` | `slot` | 否 | — | 覆盖对话上方的任务展示。Vue 内置界面默认在这里渲染 active 引导。 |
| `#guide` | `slot` | 否 | — | 下一步提示与操作的引导内容，位置由 `guidePlacement` 决定。 |
| `#nav-actions` | `slot` | 否 | — | 标题栏工具栏内容，渲染在内置的清空与收起按钮之前。适合放当前任务菜单等页面级操作。 |
| `@event` | `(event: SessionEvent) => void` | 否 | — | 会话事件流。 |
| `@collapse` | `() => void` | 否 | — | 请求父级外壳收起界面。 |
| `@status` | `(status: { running; resume }) => void` | 否 | — | 报告运行状态与是否有可恢复任务。 |
| `ref.say(text)` | `(text: string) => void` | 否 | — | 把一条本地助手消息追加到对话和模型历史，不调用模型。适合用户完成上传等人工操作后播报结果。 |

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
| `speakers` | `boolean` | 否 | `false` | 在每条聊天消息上方显示说话人与时间。 |
| `tools` | `boolean` | 否 | `false` | 在对话中显示原始工具调用行。 |
| `reveal` | `(text: string) => string` | 否 | — | 仅用于渲染的文本转换，常用于还原敏感值代号。 |
| `resume` | `{ goal?: string; interrupted?: boolean } \| null` | 否 | `null` | 显示“继续上次任务”提示。 |
| `multiline` | `boolean` | 否 | `false` | 渲染两行起步、自动增高的文本域。Enter 发送，Shift+Enter 换行。 |
| `taskPlacement` | `"inline" \| "pinned"` | 否 | `"inline"` | 把任务插槽放在消息流中，或固定在滚动消息区的上方。 |
| `hasTask` | `boolean` | 否 | `true` | 任务插槽当前是否有内容。没有活动引导时设为 `false`，避免固定任务区留下空白。 |
| `guidePlacement` | `"top" \| "end"` | 否 | `"top"` | 把引导插槽渲染在对话上方，或放在最新消息之后。 |
| `@send` | `(text: string) => void` | 否 | — | 用户提交消息。 |
| `@reply` | `(decision: boolean \| "always") => void` | 否 | — | 用户回答了确认请求。 |
| `@handoff` | `(done: boolean) => void` | 否 | — | 用户完成或取消人工接力。 |
| `@handoffStep` | `(delta: number) => void` | 否 | — | 用户切换人工接力步骤。 |
| `#task` | `slot` | 否 | — | 对话上方的自定义任务内容。内置界面会由 `AgentInline` 自动提供 active 引导。 |
| `#guide` | `slot` | 否 | — | 下一步提示与操作的引导内容，位置由 `guidePlacement` 决定。 |
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

创建内置助手界面背后的共享语言、主题与文案控制器。

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


## 外部 Agent Surface

通过 Surface 网关开放已声明能力的 Vue 封装。它们管理凭证与传输；能力 allowlist 与真人审批仍归应用所有。

| API | 类型 | 参考 |
| --- | --- | --- |
| [useSurfaceGateway](#api-usesurfacegateway) | 函数 | [参考](/zh/reference/vue-3-adapter) |
| [SurfaceAccessPanel](#api-surfaceaccesspanel) | 组件 | [参考](/zh/reference/vue-3-adapter) |

<a id="api-usesurfacegateway"></a>

### `useSurfaceGateway`

为一个 Vue 组件作用域创建并托管页面会话、WebSocket、Surface 桥接、配对、申领与撤销的生命周期。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
useSurfaceGateway(options: UseSurfaceGatewayOptions): SurfaceGatewayController
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `app` | `string` | 是 | — | 桥接 hello 中发送的稳定应用名。 |
| `expose` | `SurfaceExpose` | 是 | — | 显式能力 allowlist。组合式函数不会从 DOM 或注册表自动推断能力。 |
| `mode` | `"public-demo" \| "bff"` | 是 | — | `public-demo` 在浏览器创建页面会话并可展示 Agent token；`bff` 必须提供 `getPageSession`，由已认证的应用后端创建页面会话。 |
| `gatewayUrl` | `string` | 否 | — | `public-demo` 模式的网关源，例如 `https://surface.example.com`。 |
| `getPageSession` | `() => Promise<SurfacePageSession>` | 否 | — | `bff` 模式必填。应用服务端验证用户会话后，只返回短时页面会话。 |
| `gatewayClient` | `SurfaceGatewayClient` | 否 | — | 用于测试或自定义 BFF 契约的 HTTP 客户端。 |
| `approval` | `SurfaceApprovalSource & { confirm?: Confirm }` | 否 | — | 真人审批来源。它订阅并转发待审批状态；决定界面仍归页面所有。 |
| `confirm` | `Confirm \| null` | 否 | — | Surface 执行器使用的确认函数。默认取 `approval.confirm`，否则为 `null`（fail-closed）。 |
| `autoConnect` | `boolean` | 否 | `true` | 组件挂载时自动连接。传 `false` 时由宿主提供显式连接按钮。 |
| `autoClaim` | `boolean` | 否 | `true (public-demo only)` | 是否自动申领 Agent token。仅在 `public-demo` 模式下默认开启。 |
| `agentId` | `string` | 否 | — | 申领公开演示配对时记录的 Agent id。 |
| `tenantId` | `string` | 否 | — | 公开演示页面会话端点的可选租户提示。 |
| `clientKey` | `string` | 否 | — | 公开演示页面会话端点的可选客户端提示。 |
| `reconnectMs` | `number` | 否 | `1500` | 页面 WebSocket 重连延迟。 |
| `webSocket` | `SurfaceWebSocketFactory` | 否 | — | 供测试或非浏览器宿主注入的 WebSocket 实现。 |
| `surface` | `Partial<CreatePlingSurfaceOptions>` | 否 | — | 额外的 Surface 选项，例如 `recordLimit`、`rateLimit`、`replay`、审计或自定义落定等待。 |

**示例 1 · 公开演示：显式能力清单**

```ts
const gateway = useSurfaceGateway({
  app: "orders",
  expose: ["orders.overview", "orders.update_note"],
  mode: "public-demo",
  gatewayUrl: "https://surface.example.com",
  approval,
});

const surface = computed(() => gateway.surface.value);
```

**示例 2 · 生产 BFF 会话**

```ts
const gateway = useSurfaceGateway({
  app: "orders",
  expose: ["orders.overview", "orders.update_note"],
  mode: "bff",
  getPageSession: async () => {
    const response = await fetch("/api/surface/page-session", { method: "POST" });
    if (!response.ok) throw new Error("Surface session unavailable");
    return response.json();
  },
  approval,
});
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


<a id="api-surfaceaccesspanel"></a>

### `SurfaceAccessPanel`

可选的 Vue 面板：展示连接状态、配对、可复制的 Agent token、当前 scope 与撤销操作。它只渲染控制器，不创建能力。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
<SurfaceAccessPanel :gateway="gateway" title="External Agent" />
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `gateway` | `SurfaceGatewayController` | 是 | — | `useSurfaceGateway` 返回的控制器。组件只渲染其状态，不会自行创建能力或 token。 |
| `title` | `string` | 否 | — | 面板标题。默认使用当前语言的“外部 Agent”文案。 |

**示例 1 · 渲染可选的访问面板**

```ts
<SurfaceAccessPanel :gateway="gateway" title="外部 Agent" />
```

**精确契约**

[查看对应参考页](/zh/reference/vue-3-adapter)


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
| [AgentTaskGuide](#api-agenttaskguide) | 组件 | [参考](/zh/reference/guided-task-api) |
| [AgentTaskCard](#api-agenttaskcard) | 组件 | [参考](/zh/reference/guided-task-api) |
| [createGuideActions](#api-createguideactions) | 函数 | [参考](/zh/reference/guided-task-api) |
| [AgentGuideActions](#api-agentguideactions) | 组件 | [参考](/zh/reference/guided-task-api) |
| [GuideActionItem](#api-guideactionitem) | 接口 | [参考](/zh/reference/guided-task-api) |

<a id="api-createtaskcontroller"></a>

### `createTaskController`

创建框架无关的任务控制器。宿主通过 `invoke` 提供唯一的执行桥。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-tasklookup"></a>

### `TaskLookup`

任务界面与自动注册的搜索动作共用的搜索实现。

**导入**

`@plingjs/agent`

**调用方式**

```ts
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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
// Vue 3
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


<a id="api-agenttaskguide"></a>

### `AgentTaskGuide`

共享 DOM 任务引导的 Vue 生命周期外壳。内置助手界面会自动渲染它；只有替换默认任务展示时才需要直接使用。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
<AgentTaskGuide
  :definition="guide"
  :snapshot="snapshot"
  :step="step"
  :busy="busy"
  :error="error"
  :completed="completed"
  @command="handleCommand"
/>
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `definition` | `TaskGuideDefinition` | 是 | — | 要渲染的面向人的引导。 |
| `snapshot` | `TaskRunSnapshot \| null` | 否 | `null` | 用于动态摘要与完成数据的当前任务快照。 |
| `step` | `number` | 否 | `1` | 从 1 开始的当前步骤。 |
| `busy` | `boolean` | 否 | `false` | 页面完成当前步骤时禁用命令。 |
| `error` | `string` | 否 | — | 显示在引导旁的业务错误。 |
| `completed` | `boolean` | 否 | `false` | 显示完成状态。 |
| `@command` | `(command: TaskGuideCommand) => void` | 否 | — | 接收引导按钮发出的命令名。 |
| `ref.refresh()` | `void` | 否 | — | 按当前 props 重新渲染。 |

**示例 1 · 直接使用低层引导**

```ts
<AgentTaskGuide
  :definition="active.guide"
  :snapshot="active.state.snapshot"
  :step="active.state.step ?? 1"
  :busy="active.state.busy ?? false"
  :completed="active.state.completed ?? false"
  @command="pling.task.command"
/>
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-agenttaskcard"></a>

### `AgentTaskCard`

共享 DOM 任务卡的 Vue 与 React 外壳，供有意替换默认引导的产品使用。内置助手界面现在会自动渲染 active 的 `TaskGuideDefinition`。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
<AgentTaskCard ref="card" :controller="tasks" />
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `controller` | `TaskController` | 是 | — | 共享 DOM 任务卡要渲染的任务控制器。 |
| `title` | `string` | 否 | — | 可选标题覆盖；任务标题仍来自定义。 |
| `catalog` | `boolean` | 否 | `true` | 无运行任务时是否显示已登记任务。 |
| `@prompt` | `(prompt, snapshot) => void` | 否 | — | Agent 模式提示词，转交给现有助手。 |
| `@complete` | `(snapshot) => void` | 否 | — | 确定性任务完成回调。 |
| `ref.open(taskId, values?, binding?)` | `void` | 否 | — | 打开任务，可带页面已选记录。 |
| `ref.setCatalog(visible)` | `void` | 否 | — | 显示或隐藏目录，不丢失当前运行。 |

**示例 1 · 把任务卡放进 AgentDock**

```ts
<AgentDock layout="sidebar" sidebar-mode="fused" default-open>
  <template #task>
    <AgentTaskCard ref="card" :controller="tasks" @prompt="pling.ask" />
  </template>
</AgentDock>
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
// Vue 3
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


<a id="api-agentguideactions"></a>

### `AgentGuideActions`

共享紧凑操作行的 Vue 与 React 生命周期外壳。宿主提供选项并处理命令；渲染器从不写入字段。

**导入**

`@plingjs/vue`

**调用方式**

```ts
// Vue 3
<AgentGuideActions
  :items="items"
  hint="保存前再核对一次"
  aria-label="任务操作"
  @command="handleCommand"
/>
```

**参数与选项**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `items` | `readonly GuideActionItem[]` | 是 | — | 要依次展示的操作。数组变化时原地更新，不重建宿主页面。 |
| `@command` | `(command: string) => void` | 是 | — | 接收宿主声明的业务命令。 |
| `hint` | `string` | 否 | — | 操作行上方的可选提示。 |
| `aria-label` | `string` | 否 | — | 操作组的无障碍名称。 |

**示例 1 · 把操作行放在最新一条助手消息下方**

```vue
<AgentGuideActions
  :items="guideActions"
  :hint="reviewOpen ? '保存前再核对一次' : ''"
  aria-label="任务操作"
  @command="onGuideCommand"
/>
```

**精确契约**

[查看对应参考页](/zh/reference/guided-task-api)


<a id="api-guideactionitem"></a>

### `GuideActionItem`

紧凑操作行中的一项：短标签、业务自定义命令、可选类型，以及作为预览而不是标签的长推荐。

**导入**

`@plingjs/dom` · `@plingjs/vue`

**调用方式**

```ts
// Vue 3
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


## 版本与兼容性

| 包 | 版本 | 对等依赖 |
| --- | --- | --- |
| `@plingjs/vue` | `0.1.0-alpha.6` | `vue ^3` |
| `@plingjs/react` | `0.1.0-alpha.6` | `react >=16.3` |
| `@plingjs/vue2` | `0.1.0-alpha.6` | `vue ^2.7.0` |
| `@plingjs/vanilla` | `0.1.0-alpha.6` | — |

| 项目 | 值 |
| --- | --- |
| 引入版本 | `0.1.0-alpha.2` |
| 稳定性 | pre-1.0 alpha；次要版本可能改变 API |

## 机器可读副本

- [本页 JSON](/zh/api-index/vue-3.json)
- [API 总览 JSON](/zh/api-index.json)
