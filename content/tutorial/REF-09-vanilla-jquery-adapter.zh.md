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

`createPling(options)` 支持 `ui`、`registry`、`shared`、`namespace`、`onWarn`、`agent`、`revealSensitive`、`defaultApproval`、`scopes`、`presence` 与 `derive`，返回 `VanillaPling`。

| 方法 | 返回 | 用途 |
| --- | --- | --- |
| `tool(element, options)` | 解绑函数 | 声明元素动作 |
| `action(options)` | 解绑函数 | 声明函数级动作 |
| `record(element, value)` | 解绑函数 | 声明一行记录 |
| `scope(element, options)` | 解绑函数 | 声明区域 |
| `state(key, source, options?)` | 解绑函数 | 注册只读视图 |
| `setActiveScopes(ids)` | — | 观察器无法推断布局时手动激活 |
| `dock(options?)` | `VanillaDock` | 挂载共享助手 |
| `derived()` | 控制器或 `null` | 取自动派生控制器 |
| `destroy()` | — | 停止观察器并注销全部声明 |

每个声明都返回解绑函数。由你自己的代码移除节点时，要保留并调用它。运行时会跟踪元素所在区域；只移除节点而不解绑，会留下过期登记，直到调用 `destroy()`。

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
- 本适配器不提供复合 `steps`、页面反馈、分步指引、任务入口、模型设置界面、调试检查器、覆盖率扫描或 Router 页面身份。
- Surface 的 describe / invoke 由 `@plingjs/surface` 提供，不属于本适配器。

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
| 适用版本 | `@plingjs/vanilla` `0.1.0-alpha.3` |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器；构建需 Node.js 20 或更高版本 |
| Peer 依赖 | 无；jQuery 为可选项 |
| 稳定性 | 1.0 之前的 alpha；次版本可能改变 API |

本适配器假定存在浏览器 DOM，并使用支持 ES2022 的构建。jQuery 只影响可选包装层；不使用它时，本页的声明与执行契约不变。
