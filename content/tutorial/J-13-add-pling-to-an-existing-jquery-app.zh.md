---
id: J-13
title: "在存量 jQuery 应用中接入 Pling"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 在存量 jQuery 应用中接入 Pling

不少生产页面仍用 jQuery 渲染和绑定事件。它们真正缺的往往不是“换一套前端框架”，而是一个稳定的能力入口。Pling 不要求页面先改写成组件应用；原生适配器直接接入现有的 DOM 元素与业务对象。

示例把队列保存在普通数组里，用 jQuery 渲染行和处理事件。Pling 只声明区域、输入框、提交按钮与行内控件，没有第二份状态，也没有第二套渲染逻辑。

## 从元素边界接入

先声明区域，再声明其中的控件。区域声明会把作用域标记写到元素上，子控件因此能继承同一区域，不必重复区域名称。

```ts
pling.scope(todo[0], {
  id: "todo",
  label: copy.regionLabel,
  description: copy.regionDescription,
  role: "main",
});
```

输入框已经存在，jQuery 也已经在监听 `input` 事件。这里新增的只是“Agent 可以怎样填写它”：

```ts
pling.tool(input[0], {
  id: "composer_text",
  desc: copy.composerTextDesc,
  action: "fill",
  params: [{ name: "text", label: copy.textParamLabel }],
});
```

提交动作不直接调用另一份 `addTask`。原有表单提交已经负责新增任务，因此 Pling 只执行同一个可见操作，让现有处理函数继续修改页面。

```ts
pling.tool(submit[0], {
  id: "composer_submit",
  desc: copy.composerSubmitDesc,
  available: () => input.val()?.toString().trim() ? true : copy.submitReason,
});
```

保留原有处理函数很重要。如果 Agent 走第二份新增实现，人和 Agent 的校验、渲染与副作用迟早会不一致。

## 记录必须指向正在使用的对象

每一行是 jQuery 元素，但记录必须指向点击处理函数修改的那个任务对象：

```ts
const task = { id: "t4", text: "检查续费", done: false };
const row = $("<li>").addClass("task");

pling.record(row[0], {
  data: task,
  label: copy.recordLabel(task.text),
});
```

不要把任务字段复制成一个只给 Agent 使用的对象。页面一旦切换完成状态，副本就会过期。记录应读取操作者此刻看到的同一份状态。

行内动作使用稳定业务 id：

```ts
pling.tool(check[0], {
  id: `toggle@${task.id}`,
  desc: copy.toggleDesc(task.text, task.done),
});
```

jQuery 集合中的下标不是身份。排序、筛选或插入一行都会改变下标，而 `t4` 在任务真正删除前仍然指向同一项。

## 随 DOM 一起移除声明

删除一行时，要同时解绑 Pling 声明与 jQuery 事件。示例把两者放在同一个生命周期里，避免下一次渲染留下指向已卸载元素的动作。

用 `.html()` 或模板刷新替换整块页面时也一样。DOM 节点消失并不会自动删除注册表里的声明。每次 `pling.tool`、`pling.record`、`pling.scope` 返回的解绑函数都应保留。

## 从一个窄切片开始迁移

存量页面可以采用下面的顺序：

1. 选一个业务对象稳定、结果可见的任务。
2. 保留现有 jQuery 事件与状态。
3. 只声明这个任务需要的区域和控件。
4. 为需要区分的记录补充绑定。
5. 给现有处理函数增加确定性测试。
6. 第一条链路可靠后，再扩大范围。

这样不需要为了接入 Agent 先重写页面，回滚也很简单：移除声明后，页面仍然是原来的 jQuery 应用。

## 运行示例

```bash
pnpm tutorial:dev j-13
```

打开 `http://127.0.0.1:5278/?lang=zh`，或使用 `--locale zh`。

```bash
pnpm tutorial:check j-13
```

检查会安装与发布版本等价的依赖，编译 jQuery 与 TypeScript 代码，运行端到端测试，并生成生产构建。

## 常见错误

**给 Pling 单独建一份任务数组。** Agent 会修改副本，而表格仍渲染原数组。记录必须绑定当前业务对象。

**把 jQuery 选择器当作动作 id。** 排序后同一个选择器可能命中另一行。id 应使用稳定业务标识，选择器只作为实现细节。

**替换行时既没有 `.off()`，也没有调用 Pling 的解绑函数。** 结果是重复事件或残留动作。

**在 `run` 里重写一遍提交逻辑。** 复用现有业务函数或 DOM 事件路径，才能让用户与 Agent 经过相同的校验和副作用。

下一步：[向外部 Agent 开放选定能力](/zh/vanilla/expose-selected-capabilities-to-external-agents)。
