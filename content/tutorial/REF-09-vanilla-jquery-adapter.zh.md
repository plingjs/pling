---
id: REF-09
title: "原生 JS / jQuery 适配器"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# 原生 JS 与 jQuery 适配器（`@plingjs/vanilla`）

`@plingjs/vanilla` 是 DOM 层适配器，不依赖任何前端框架。Vue 2.7 适配器也建立在它之上，因此它是理解声明、可见性与执行如何衔接的最小可执行参考。

jQuery 项目直接使用它。没有单独的 jQuery 包，也不需要：`pling.tool()` 接受任意 DOM 元素，包括 `$el[0]`。

## 实例

```ts
import { createPling } from "@plingjs/vanilla";

const pling = createPling({
  agent: {
    config: {
      baseUrl: "/llm/v1",
      model: "your-model",
      apiKey: "",
    },
  },
  presence: true,
  derive: false,
});

const dock = pling.dock({
  title: "待办助手",
  quick: ["新增一条待办", "把第一条待办标记完成"],
});
```

`createPling(options)` 支持 `ui`、`registry`、`shared`、`namespace`、`onWarn`、`diagnostics`、`agent`、`revealSensitive`、`defaultApproval`、`scopes`、`presence`、`derive` 与 `page`，返回 `VanillaPling`。

| 方法 | 返回 | 用途 |
| --- | --- | --- |
| `tool(element, options)` | 解绑函数 | 声明元素动作 |
| `action(options)` | 解绑函数 | 声明函数级动作 |
| `record(element, value)` | 解绑函数 | 声明一行记录 |
| `scope(element, options)` | 解绑函数 | 声明区域 |
| `state(key, source, options?)` | 解绑函数 | 注册只读视图 |
| `declareFeedback(element, value)` | 解绑函数 | 声明页面反馈 |
| `declareTask(element, value)` | 解绑函数 | 声明面向人的任务入口，不注册动作 |
| `guideTarget(element, id)` | 解绑函数 | 标记人工接力的指引目标 |
| `setActiveScopes(ids)` | — | 观察器无法推断布局时手动激活 |
| `dock(options?)` | `VanillaDock` | 挂载共享助手 |
| `surfaceGateway(options)` | `VanillaSurfaceGateway` | 把允许的能力开放给外部 Agent |
| `inspectCoverage(root?)` | `CoverageReport` | 扫描尚未声明的交互控件 |
| `derived()` | 控制器或 `null` | 取自动派生控制器 |
| `destroy()` | — | 停止观察器并注销全部声明 |

每个声明都返回解绑函数。由你自己的代码移除节点时，要保留并调用它。运行时会跟踪元素所在区域；只移除节点而不解绑，会留下过期登记，直到调用 `destroy()`。

原生页面没有框架的 `updated` / `beforeUnmount`，因此同一元素或同一状态 key 再次声明时，适配器会先撤销旧声明再登记新的。旧声明返回的解绑函数随后调用是安全的，不会误删新声明。这使列表重绘与 jQuery 插件替换节点时不必自己维护两份登记。

## 元素动作

```ts
const addButton = document.querySelector<HTMLButtonElement>("#add")!;

const unbind = pling.tool(addButton, {
  id: "add_task",
  desc: "把输入框里的内容新增为待办",
  kind: "write",
  available: () => {
    const input = document.querySelector<HTMLInputElement>("#composer")!;
    return input.value.trim() ? true : "输入框是空的";
  },
});
```

填写动作要声明在输入框本身：

```ts
pling.tool(document.querySelector<HTMLInputElement>("#composer")!, {
  id: "composer_text",
  desc: "填写新待办的内容",
  action: "fill",
  params: [{ name: "text", label: "待办内容" }],
});
```

没有对应元素的业务操作使用 `pling.action()`：

```ts
pling.action({
  id: "clear_completed",
  desc: "删除所有已完成的待办",
  kind: "danger",
  run: () => removeCompleted(),
});
```

`tool({ steps })` 声明复合动作；每一步都引用已经声明的动作 id，执行时仍走同一个确认闸门。需要用户亲自完成的步骤用 `handoff`：

```ts
pling.tool(document.querySelector("#submit-order")!, {
  id: "submit_order",
  desc: "保存并提交订单",
  steps: [{ action: "save_order" }, { action: "confirm_order" }],
});

pling.tool(document.querySelector("#verify-phone")!, {
  id: "verify_phone",
  desc: "等待用户完成手机验证",
  handoff: {
    reason: "手机验证码只能由用户本人查看并填写",
    steps: ["打开手机短信", "填写 6 位验证码"],
    expect: { desc: "验证码已通过", check: () => Boolean(document.querySelector("[data-verified]")) },
  },
});
```

## 记录与区域

```ts
for (const task of tasks) {
  const row = document.querySelector(`[data-task="${task.id}"]`)!;
  pling.record(row, { data: task, label: task.title });
}

pling.scope(document.querySelector("#task-list")!, {
  id: "task_list",
  label: "待办列表",
  role: "list",
});
```

记录继承最近的已声明区域。声明在未激活或被遮挡区域里的动作，会从模型快照中消失并附带原因。

## 状态

```ts
const offState = pling.state("task_view", () => ({
  filter,
  appliedSearch,
  matched: visibleTasks.length,
  total: tasks.length,
}), {
  description: "当前筛选、已应用的搜索与待办计数",
});
```

`state` 是只读的，没有 setter，也不会生成动作。若模型应能改变筛选，用 `pling.tool()` 声明那个筛选控件。

## 页面反馈、任务与指引

表单错误应作为页面反馈暴露，而不是再声明一个“读出错误”的动作：

```ts
pling.declareFeedback(document.querySelector("#customer-field")!, {
  message: "客户名称不能为空",
  field: "customer",
  severity: "error",
});

pling.declareTask(document.querySelector("#ask-assistant")!, {
  prompt: "检查当前订单是否缺少必填信息",
});
```

`declareTask()` 只把一句话交给已挂载的助手，因此不会出现在动作清单里。`guideTarget()` 则只标记用户在人工接力时需要看的位置，同样不会生成动作。

## 助手、模型设置与调试

```ts
const dock = pling.dock({
  layout: "dock",
  quick: ["总结当前订单"],
  debug: { maxCalls: 8 },
  modelSettings: { mode: "readonly" },
});
```

`layout` 可为 `dock`、`sidebar` 或 `inline`；`side` / `launcherPlacement` 控制侧边栏位置。`debug` 在“活动”页打开只读检查器，展示页面投影、真实请求消息、tools、响应和最近的调用轨迹。`modelSettings: "readonly"` 展示应用托管端点，`{ mode: "byok", persist: "session" }` 允许可信页面使用自己的模型密钥；`persist` 只支持 `memory` 与 `session`，不支持 `localStorage`。

当 `continuity.scope` 为 `browser` 或 `remote` 时，浮窗还会出现“任务”页。用户可以只读跟随另一个标签页 / 设备上的任务、接管它，或把它分叉成一条独立任务。只在一个标签页内工作的 `tab` 作用域不会显示这个页签。

## 页面身份与覆盖率

页面路径、标题和 allowlist 后的查询参数会自动进入快照。需要 Router-like 的 `name` / `params` 时，给 `page.router` 传一个带 `currentRoute` 与可选 `afterEach` 的对象即可。

```ts
const report = pling.inspectCoverage(document.querySelector("main"));
console.log(report.coveragePercent, report.targets.filter((target) => target.status === "missing"));
```

覆盖率扫描只报告未声明的交互控件，不会自动注册动作。

## 外部 Agent

`pling.surfaceGateway()` 复用 `@plingjs/surface-browser`，只开放显式 allowlist 中的能力；`createSurfaceAccessPanel()` 是 Vue `<SurfaceAccessPanel>` 的原生 DOM 对应物：

```ts
import { createSurfaceAccessPanel } from "@plingjs/vanilla";

const gateway = pling.surfaceGateway({
  app: "orders",
  mode: "bff",
  expose: ["list_orders", "update_note@order:"],
  getPageSession: () => fetch("/api/surface/session").then((response) => response.json()),
});

const panel = createSurfaceAccessPanel(gateway, { mount: document.querySelector("#access")! });
```

## jQuery 写法

```js
const $ = window.jQuery;

const pling = createPling({ agent: { config: { baseUrl: "/llm/v1", model: "your-model" } } });

pling.tool($("#add")[0], { id: "add_task", desc: "新增待办", kind: "write" });
pling.scope($("#task-list")[0], { id: "task_list", label: "待办列表", role: "list" });
$("#add").on("click", addTask);
```

在元素存在之后接入 Pling。若插件之后替换了 DOM 节点，先解绑旧声明，再声明新节点。不要让声明继续指向已经脱离文档的克隆节点。

## 默认值与边界

- `presence` 默认开启；`presence: false` 关闭高亮。
- `derive` 默认关闭。
- `kind` 默认是 `write`；确认策略由当前审批策略决定。
- `ui` 默认英文、浅色主题。
- 没有框架组件树或 store：`AgentDock` / `AgentInline` 这类组件与 `useAgentStoreState` 不适用；对应能力由 `pling.dock()`、`pling.page` 与显式字段选择完成。
- 不具备 Vue / React 的自动挂载与卸载生命周期。重复声明会替换旧声明，但节点销毁时仍应主动调用解绑函数。
- SSR 不属于 DOM 适配器职责。Surface 协议仍由 `@plingjs/surface` 提供，本适配器只负责页面会话与浏览器传输接线。

## 常见失败

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 节点替换后动作仍在 | 没有调用旧解绑函数 | 替换 DOM 前解绑 |
| 动作完全不出现 | 元素已脱离文档、禁用、被遮挡，或所在区域未激活 | 检查 `isConnected`、disabled 与区域状态 |
| 记录字段不更新 | 传了副本而不是当前业务对象 | 传当前对象或读取函数 |
| id 重复 | 循环复用了同一个常量 id | 加上行主键 |
| 状态不更新 | 传入了快照值 | 传函数 |
| Dock 没有模型 | 没有 `agent.config`，也没有环境变量 | 配置其中之一 |

## 证据

- 适配器实现：`packages/vanilla/src`。
- 可运行的原生 JS / jQuery 示例：`examples/recipes/vanilla`。
- 复用本适配器的 Vue 2.7：`examples/recipes/vue2`。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/vanilla` `0.1.0-alpha.8` |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器；构建需 Node.js 20 或更高版本 |
| Peer 依赖 | 无；jQuery 为可选项 |
| 稳定性 | 1.0 之前的 alpha；次版本可能改变 API |

本适配器假定存在浏览器 DOM，并使用支持 ES2022 的构建。jQuery 只影响可选包装层；不使用它时，本页的声明与执行契约不变。
