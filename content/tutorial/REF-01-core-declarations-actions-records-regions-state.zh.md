---
id: REF-01
title: "核心声明：动作、记录、区域、状态"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# 核心声明：动作、记录、区域与状态

Pling 通过四类声明把页面交给模型。它们回答不同的问题，不能互相替代：

| 声明 | 回答的问题 | 是否写入 |
| --- | --- | --- |
| 动作 | 这里能做什么？ | 是 |
| 记录 | 这是哪个对象，它包含什么？ | 否 |
| 区域 | 它在哪里，此刻是否可达？ | 否 |
| 状态 | 当前生效的是哪种视图？ | 否 |

只有动作会写入。记录、区域和状态都只描述页面；它们不会变成第二条执行通道。

## 动作

一个动作由稳定的 id、写给模型看的说明、风险等级和执行路径组成。执行路径可以是 DOM 原语（`click`、`fill`、`select`、`press`、`hover`），可以是注入的 `run`，也可以是要求用户亲自完成的 `handoff`。

| 字段 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `id` | 建议填写 | 元素绑定会生成一次 | 列表行和任务连续性必须使用稳定 id |
| `desc` | 是 | — | 模型判断动作用途的唯一依据 |
| `kind` | 否 | `"write"` | `"read"`、`"write"` 或 `"danger"` |
| `params` | 否 | — | 数组简写或 JSON Schema；数组参数默认必填，除非写 `optional: true` |
| `run` | 否 | DOM 原语 | 收到已校验、已还原敏感值的参数 |
| `available` | 否 | — | 返回 `false` 或字符串时动作不可用；字符串会进入模型清单 |
| `expect` | 否 | — | 等待结果成立；失败时报 `EXPECTATION_FAILED` |
| `confirm` | 否 | 由策略推导 | `true` 或 `"always"` |
| `handoff` | 否 | — | 由用户完成这一步；不会执行 `run` |
| `action` / `target` / `autoTarget` / `fidelity` | 否 | 自动推断 | 控制 DOM 原语如何定位目标 |

```ts [Vue 3]
const submit = { id: "add_task", desc: "把输入框里的内容加进待办", kind: "write" };
```

```tsx [React]
const submit = usePlingTool<HTMLButtonElement>({
  id: "add_task",
  desc: "把输入框里的内容加进待办",
  kind: "write",
});
```

```ts [原生 JS / jQuery]
const off = pling.tool(document.querySelector("#add")!, {
  id: "add_task",
  desc: "把输入框里的内容加进待办",
  kind: "write",
});
```

```ts [Vue 2.7]
// <button v-tool="{ id: 'add_task', desc: '把输入框里的内容加进待办' }">
// 指令接受同一套 ToolOptions。
```

声明动作不等于它一定可见。禁用元素、被遮挡元素、未激活区域和 `available()` 未通过，都会让动作从模型清单里消失，并附带原因。这是刻意的：「没有注册」和「此刻不可用」是两种不同状态，必须能区分。

## 记录

记录给一行数据一个身份和一组有界字段。身份必须来自业务对象，不能来自数组下标。

```ts [Vue 3]
// <li v-for="task in tasks" :key="task.id" v-record="{ data: task, label: task.title }">
```

```tsx [React]
const row = usePlingRecord({ data: task, label: task.title });
return <li ref={row}>{task.title}</li>;
```

```ts [原生 JS / jQuery]
const off = pling.record(rowElement, { data: task, label: task.title });
```

```ts [Vue 2.7]
// <li v-for="task in tasks" :key="task.id" v-record="{ data: task, label: task.title }">
```

默认行为：

- id：先取 `data.id`，再取 `data.key`；
- 字段：数据对象去掉 id 字段；
- 区域：最近的祖先区域；
- 顺序：适配器能确定时按页面顺序。

记录是只读的。行内动作仍然是动作，仍然经过可用性、策略、执行和结果检查。不要把「标记完成」写成修改记录字段。

## 区域

区域给页面一棵小结构树，也参与可见性与可达性判断。

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 稳定、与界面语言无关 |
| `label` | 否 | 给模型看的区域名 |
| `description` | 否 | 这块区域是做什么的 |
| `role` | 否 | `main`、`dialog`、`toolbar`、`list` 等 `RegionRole` |
| `parent` | 否 | DOM 祖先不是正确结构时显式指定父区域 |

```ts [Vue 3]
// <section v-scope="{ id: 'todo_list', label: '待办列表', role: 'list' }">
```

```tsx [React]
const listScope = usePlingScope<HTMLUListElement>({
  id: "todo_list",
  label: "待办列表",
  role: "list",
});
return <ul ref={listScope}>…</ul>;
```

```ts [原生 JS / jQuery]
const off = pling.scope(listElement, { id: "todo_list", label: "待办列表", role: "list" });
```

```ts [Vue 2.7]
// <ul v-scope="{ id: 'todo_list', label: '待办列表', role: 'list' }">
```

区域不是权限边界。它只缩小并解释模型此刻能接触到的范围。授权仍然属于动作实现或服务端。

## 状态

状态视图是一组具名、只读的数据，用来解释当前投影：生效的筛选、已应用的搜索、计数、分页或选中的页签。它没有 setter。

```ts [Vue 3]
useAgentState("task_view", () => ({
  filter: filter.value,
  search: appliedSearch.value,
  matched: visibleTasks.value.length,
  total: tasks.value.length,
}), { description: "当前筛选、已应用的搜索与待办计数" });
```

```tsx [React]
usePlingState("task_view", () => ({
  filter,
  search: appliedSearch,
  matched: visibleTasks.length,
  total: tasks.length,
}), { description: "当前筛选、已应用的搜索与待办计数" });
```

```ts [原生 JS / jQuery]
const off = pling.state("task_view", () => ({
  filter,
  search: appliedSearch,
  matched: visibleTasks.length,
  total: tasks.length,
}), { description: "当前筛选、已应用的搜索与待办计数" });
```

```ts [Vue 2.7]
useAgentState("task_view", () => ({
  filter: this.filter,
  search: this.appliedSearch,
  matched: this.visibleTasks.length,
  total: this.tasks.length,
}));
```

读取函数会在每份快照生成时执行。普通对象只在注册时求值一次，会把初始值冻结下来。暴露用户正在看的视图，不要倾倒整个 store。

## 四类声明如何配合

一个可靠的页面通常在同一块区域里同时需要四类声明：

- 区域说明这是哪块列表，并决定它此刻是否可达；
- 记录说明有哪些行，并提供选择某一行所需的数据；
- 动作说明列表或行上能执行什么；
- 状态解释那些仅靠行看不出来的筛选与计数。

这也是「模型能点一个按钮」和「模型能先理解当前页面，再选择动作」之间的区别。

## 常见失败

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 模型编造动作 id | 动作没有注册，或 id 在渲染间变化 | 显式声明，使用稳定 id |
| 行内动作作用到错误的行 | id 来自数组下标 | 改用业务主键 |
| 计数只对一次，之后不更新 | 普通对象捕获了 setup 时的值 | 用函数读取 |
| 弹窗打开后底层动作仍可用 | 弹窗没有区域，或遮罩无法被检测 | 把弹窗放进 `dialog` 区域并验证命中测试 |
| 模型试图通过状态写入 | 对应动作缺失或说明不清 | 补上用户会用的动作；状态保持只读 |
| 两行共享同一个动作 id | id 没有带上行主键 | 使用 `toggle@${task.id}` 或命名空间 |

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/core` `0.1.0-alpha.2` |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器；Node 侧使用需 Node.js 20 或更高版本 |
| Peer 依赖 | 无 |
| 稳定性 | 1.0 之前的 alpha；次版本可能改变 API |

四个适配器在当前版本都提供这四类声明。下表的适配器支持范围就是兼容边界；声明的含义一旦改变，属于破坏性变更，不能当作文档措辞调整。

| 适配器 | 动作 | 记录 | 区域 | 状态 |
| --- | --- | --- | --- | --- |
| Vue 3 | 支持 | 支持 | 支持 | 支持 |
| React | 支持 | 支持 | 支持 | 支持 |
| 原生 JS / jQuery | 支持 | 支持 | 支持 | 支持 |
| Vue 2.7 | 支持 | 支持 | 支持 | 支持 |

各端的支持状态不同。[Vue 3 适配器](/zh/reference/vue-3-adapter)、[React 适配器](/zh/reference/react-adapter)、[原生 JS / jQuery 适配器](/zh/reference/vanilla-jquery-adapter)与 [Vue 2.7 适配器](/zh/reference/vue-2-adapter)分别列出了准确边界。Vue 2.7 是真实适配器，但只支持其页面上列出的子集。

## 接下来

- [Vue 3 学习线](/zh/vue/)按顺序逐项建立这些声明。
- [表格行与批量操作](/zh/recipes/table-rows-and-batch-actions)把记录与行内动作用于表格。
- 各适配器参考给出精确签名与支持边界。
