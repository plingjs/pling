---
id: J-05
title: "动态 DOM 的命令式动作"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 动态 DOM 的命令式动作

浏览器页面会不断替换节点：删除一行、刷新表格、重建弹窗，或根据服务端响应重新渲染列表。组件适配器通常能从组件生命周期知道何时解绑；原生 DOM 应用没有这层自动通知。

因此，原生适配器的 `pling.scope()`、`pling.record()` 和 `pling.tool()` 都会返回解绑函数。页面必须把这些函数和它们描述的节点保存在一起。

## 每一行拥有自己的声明集合

示例用任务 id 维护行节点及其清理函数：

```ts
const rows = new Map<string, { element: HTMLLIElement; cleanups: Array<() => void> }>();

function mountRow(task: Task): HTMLLIElement {
  const row = document.createElement("li");
  const check = document.createElement("button");
  const remove = document.createElement("button");

  const rowCleanups = [
    pling.record(row, { data: task, label: `待办：${task.text}` }),
    pling.tool(check, { id: `toggle@${task.id}`, desc: copy.toggleDesc(task.text) }),
    pling.tool(remove, { id: `remove@${task.id}`, desc: copy.removeDesc(task.text), kind: "danger" }),
  ];

  rows.set(task.id, { element: row, cleanups: rowCleanups });
  list.append(row);
  return row;
}
```

声明绑定到行的稳定业务 id，而不是把 DOM 节点当成任务身份。

## 先注销声明，再移除节点

删除一行时，应先清理记录和动作，再让元素消失：

```ts
function removeTask(id: string): void {
  const entry = rows.get(id);
  if (!entry) return;

  for (const cleanup of entry.cleanups.reverse()) cleanup();
  rows.delete(id);
  entry.element.remove();
  tasks.splice(tasks.findIndex((task) => task.id === id), 1);
  syncSummary();
}
```

顺序很重要。节点先被移除时，适配器仍可能凭引用注销；但如果页面直接替换整块列表却不调用清理函数，注册表就会保留人已经看不到、也无法操作的能力。下一轮模型会看到不存在的控件。

## 替换整个列表

服务端响应替换所有行时，应清理旧行集合，再绑定新行：

```ts
function replaceTasks(next: Task[]): void {
  for (const entry of rows.values()) {
    for (const cleanup of entry.cleanups.reverse()) cleanup();
  }
  rows.clear();
  list.replaceChildren();
  tasks.splice(0, tasks.length, ...next);
  tasks.forEach((task) => list.append(mountRow(task)));
}
```

不要只写 `list.innerHTML = ...`。那会销毁旧节点，却不给页面注销旧声明的机会。如果确实要用 `innerHTML` 做首次渲染，渲染后必须重新绑定，并保存返回的清理函数。

## 为什么不把每个按钮都自动派生出来

适配器可以选择开启范围受限的自动派生，但默认关闭。一个写着“删除”的按钮无法说明它删除当前行、清除筛选，还是打开弹窗。显式声明让操作、记录和风险等级仍由应用控制。

动态渲染不改变这条规则。节点重建后，应重新绑定显式声明。

## 运行示例

```bash
pnpm tutorial:dev j-05
```

打开 `http://127.0.0.1:5270/`，或使用 `--locale zh` 和 `http://127.0.0.1:5270/?lang=zh`。

```bash
pnpm tutorial:check j-05
```

测试通过 `remove@t2` 删除一行，并验证该行、记录、切换动作和删除动作都从注册表移除；同时确认删除后仍能新增和切换任务。

## 常见问题

**把旧的清理函数复用于新节点。** 注销旧节点不等于注册新节点，两者要分开执行。

**每条任务只保存一个清理函数。** 一行通常包含记录、多个控件，甚至区域。应在挂载函数中返回全部清理函数。

**用数组下标作为动作 id。** 删除后，同一个 id 可能指向另一条任务。应使用业务 id。

**忘记首次绑定。** 动态生成的行和服务端渲染的初始行都需要声明。页面启动时已有 HTML，就必须在标记存在后运行绑定器。

下一步：[记录与表格](/zh/vanilla/records-and-tables)。
