---
id: J-03
title: "原生页面快速上手：一个可用的 Todo Agent"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 原生页面快速上手：一个可用的 Todo Agent

本章给一个用普通 DOM API 写成的 Todo 页面接入 Agent。这里没有组件树可以挂 hook，也没有响应式 store 可以直接暴露。页面已经知道怎样渲染行、填写输入框、提交表单和切换完成状态。Pling 只补充让模型能够使用这些事实的声明。

结果刻意保持狭窄：Agent 可以新增待办，也可以改变已有待办的完成状态；它不能删除、筛选，也不能操作页面没有声明的控件。

## 没有框架时，“第 1 条”是什么

先看请求：

> 把第 1 个待办标记完成，并新增一条“准备明天的议程”。

DOM 只能告诉浏览器存在三个 `li` 元素。它不会告诉模型哪一个在业务列表里是第 1 条、每行文字是什么，或者这一行是否已经完成。这些事实必须由页面声明。

| 需要知道的事 | 原生 JS 声明 |
| --- | --- |
| Todo 模块 | `pling.scope(todo, { id: "todo", ... })` |
| 每条任务行 | `pling.record(row, { data: task, ... })` |
| 新待办输入框 | `pling.tool(input, { id: "composer_text", action: "fill", ... })` |
| 提交按钮 | `pling.tool(submit, { id: "composer_submit", ... })` |
| 每行完成按钮 | `pling.tool(check, { id: `toggle@${task.id}`, ... })` |

记录 id 来自稳定的任务 id，而不是 DOM 里的视觉位置。模型可以选择 `t2`，再由 Pling 映射到对应的元素级动作。

## DOM 和事件处理保持原样

页面仍然自己创建标记、绑定事件：

```ts
const form = document.querySelector<HTMLFormElement>("[data-composer]")!;
const input = document.querySelector<HTMLInputElement>("[data-new-task]")!;
const submit = document.querySelector<HTMLButtonElement>("[data-submit]")!;

function addTask(): void {
  const text = input.value.trim();
  if (!text) return;
  const task = { id: `t${++sequence}`, text, done: false };
  tasks.unshift(task);
  list.prepend(renderRow(task));
  input.value = "";
  syncSummary();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  addTask();
});
```

下面的声明不会替换 `addTask`、`renderRow` 或点击事件。它们只是告诉 Agent 这些操作位于哪里。

## 声明区域

```ts{3-8}
const todo = document.querySelector<HTMLElement>("[data-todo]")!;

const offScope = pling.scope(todo, {
  id: "todo",
  label: copy.regionLabel,
  description: copy.regionDescription,
  role: "main",
});
```

区域让 Todo 模块内的控件共享上下文。返回值是注销函数，应放进页面的清理列表。

## 声明输入框和提交按钮

```ts{1-10,12-17}
const offText = pling.tool(input, {
  id: "composer_text",
  desc: copy.composerTextDesc,
  action: "fill",
  params: [{ name: "text", label: copy.textParamLabel }],
});

const offSubmit = pling.tool(submit, {
  id: "composer_submit",
  desc: copy.composerSubmitDesc,
  available: () => input.value.trim() ? true : copy.submitReason,
});
```

`action: "fill"` 很关键。文本输入框在业务意义上不是点击目标，它接受一个值；参数声明把这个值告诉模型。

输入框为空时，提交动作最初不可用。填写之后，页面更新 `input.value`，可用性判断变为真，动作重新出现。这与用户看到的禁用按钮来自同一条规则。

## 声明每一行和完成控件

行渲染函数接收一个任务并创建 DOM。趁创建行时附加记录和工具：

```ts{4,11-14,18}
function mountRow(task: Task): HTMLLIElement {
  const row = document.createElement("li");
  const check = document.createElement("button");
  const text = document.createElement("span");

  row.append(check, text);
  text.textContent = task.text;

  const offRecord = pling.record(row, {
    data: task,
    label: copy.recordLabel(task.text),
  });

  const offToggle = pling.tool(check, {
    id: `toggle@${task.id}`,
    desc: copy.toggleDesc(task.text),
  });

  check.addEventListener("click", () => {
    task.done = !task.done;
    syncRow();
    syncSummary();
  });

  return row;
}
```

记录里的 `data` 包含 `id`、`text` 和 `done`。模型因此可以先读取这一行，再选择操作。工具 id 含有 `task.id`，两行不会共享同一个控件身份。

完成动作的说明保持稳定：它描述“切换完成状态”，当前状态属于记录，而不是一句会在点击后过期的文案。这样也避免每次视觉更新都注销、重绑工具。

如果以后删除一行，应在丢弃元素之前调用 `offRecord()` 和 `offToggle()`。本章示例不删除行；动态列表会在后续章节处理。

## 挂载助手

```ts
const dock = pling.dock({
  title: copy.dockTitle,
  quick: copy.quick,
});
```

Dock 是共享的 DOM 问答入口。它与页面控件使用同一份注册表和 Agent 运行时。快捷问题只是文本建议，不是隐藏的能力。

## 清理也是接入的一部分

示例把所有注销函数放进清理列表：

```ts
const cleanups: Array<() => void> = [];
cleanups.push(offScope, offText, offSubmit, offRecord, offToggle);

return {
  destroy() {
    for (const cleanup of cleanups.reverse()) cleanup();
    dock.destroy();
    pling.destroy();
  },
};
```

这不是仪式。DOM 适配器无法推断你的代码何时丢弃节点。显式清理能避免注册表继续描述一个已经不存在的控件。

## 运行并验证

在仓库根目录执行：

```bash
pnpm tutorial:dev j-03
```

打开 `http://127.0.0.1:5241/`。中文界面执行 `pnpm tutorial:dev j-03 --locale zh`，打开 `http://127.0.0.1:5241/?lang=zh`。

检查：

1. 让助手新增“回复客户”。任务只出现一次。
2. 打开运行活动。应能看到填写输入框和原有表单提交两步。
3. 通过助手切换第 2 行的完成状态。只有那一行改变。
4. 让助手删除或筛选。当前没有这些能力。
5. 刷新页面，确认没有助手时页面仍然正常。

## 常见失败

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 模型能看到输入框，但不能提交 | 提交动作仍不可用 | 确认填写更新了真实输入框，可用性函数读取同一个值 |
| 点击行没有改变任务 | 声明的元素不是绑定点击处理的按钮 | 把真正的交互元素传给 `pling.tool` |
| 两行共享一个控件 | 动作 id 没有稳定任务 id | 记录和动作使用同一个 id |
| 删除的行还留在快照里 | 没有调用注销函数 | 把注册和清理绑定到行生命周期 |
| 助手看不到筛选 | 没有声明筛选动作 | 预期行为；需要时再开放 |
| 页面正常，但 Agent 看不到 | 元素被替换后没有重新声明 | 在最终 DOM 节点上声明，替换后重新注册 |

后续章节继续处理 data 属性声明和动态 DOM。
