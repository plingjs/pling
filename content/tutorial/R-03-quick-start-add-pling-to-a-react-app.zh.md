---
id: R-03
title: "React 快速上手：一个可用的 Todo Agent"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# React 快速上手：一个可用的 Todo Agent

一个 React 页面可以正常渲染 Todo 列表，却仍然让 Agent 无从下手。模型也许理解“把第 1 条待办标记完成”，但它不知道哪一行是第 1 条、这一行包含什么，也不知道页面上的多个按钮里该用哪一个。

本章把 Pling 接到一个普通的 React Todo 组件上。任务数组、状态更新函数、表单提交和渲染都留在 React；接入层只描述任务区域、每一行，以及允许 Agent 使用的少量控件。

## 从一个请求开始

先看这句话：

> 把第 1 个待办标记完成，然后新增一条“准备明天的议程”。

Agent 需要三类事实：

| 需要知道的事实 | 页面里的实际内容 | React API |
| --- | --- | --- |
| 哪一块区域包含表单和列表 | `todo` 区域 | `usePlingScope()` |
| 每一行是什么、是否完成 | `t1`：“检查发布清单”，未完成 | `usePlingRecord()` |
| 可以操作哪些控件 | 新待办输入框、提交按钮、行内完成按钮 | `usePlingTool()` |

没有记录，模型只能看到控件，无法判断“第 1 条”是谁；没有区域，相关控件缺少共同上下文；没有显式工具，页面里未声明的按钮仍然在 Agent 的能力范围之外。

## Todo 状态仍由 React 管理

业务组件仍然从普通 React 状态开始：

```tsx
interface Task {
  id: string;
  text: string;
  done: boolean;
}

const [tasks, setTasks] = useState<Task[]>(seedTasks);
const [draft, setDraft] = useState("");

function addTask(): void {
  const text = draft.trim();
  if (!text) return;
  setTasks((current) => [{ id: nextId(), text, done: false }, ...current]);
  setDraft("");
}

function toggleTask(id: string): void {
  setTasks((current) => current.map((task) =>
    task.id === id ? { ...task, done: !task.done } : task,
  ));
}
```

后面的声明不会替 Agent 直接调用 `setTasks`。它们指向原有的输入框、提交路径和完成按钮。人和 Agent 最终进入的是同一组处理函数。

## 声明任务区域

为包含表单和列表的区域创建一个 ref：

```tsx{1,6-11,15}
import { usePlingScope } from "@plingjs/react";

export function App() {
  const todoScope = usePlingScope<HTMLElement>({
    id: "todo",
    label: copy.regionLabel,
    description: copy.regionDescription,
    role: "main",
  });

  return (
    <main className="page">
      <section className="todo" ref={todoScope}>
        {/* 标题、表单和任务列表 */}
      </section>
    </main>
  );
}
```

区域给模型一个稳定的“待办模块”名称，也让区域内的行内动作继承正确的作用域。它不会把页面从人面前藏起来，只描述哪些页面事实属于同一个模块。

## 声明输入框和提交按钮

输入框原本就在更新 `draft`，表单原本就在调用 `addTask`。把 ref 交给这两个元素：

```tsx{1,6-11,17-21,31-33}
import { usePlingScope, usePlingTool } from "@plingjs/react";

export function App() {
  const [draft, setDraft] = useState("");

  const composerRef = usePlingTool<HTMLInputElement>({
    id: "composer_text",
    desc: copy.composerTextDesc,
    action: "fill",
    params: [{ name: "text", label: copy.textParamLabel }],
  });

  const submitRef = usePlingTool<HTMLButtonElement>({
    id: "composer_submit",
    desc: copy.composerSubmitDesc,
    available: () => draft.trim() ? true : copy.submitReason,
  });

  return (
    <form onSubmit={(event) => { event.preventDefault(); addTask(); }}>
      <input
        id="new-task"
        ref={composerRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button ref={submitRef} type="submit" disabled={!draft.trim()}>
        {copy.addTask}
      </button>
    </form>
  );
}
```

`action: "fill"` 明确这是要填写的字段，而不是要点击的按钮。参数名和标签会进入模型看到的工具契约。

输入框为空时，提交动作不可用。按钮的 `disabled` 和 `available` 回调表达同一条业务规则；回调还能给模型一个可理解的原因，而不是让动作悄悄消失。填入内容后，组件重新渲染，提交动作随之可用。

示例还限制最多 8 条待办。列表已满时，即使输入框里有内容，提交动作也会返回“列表已满”的原因；否则模型会看到一个实际无法执行的动作。

这仍然是两步操作。Agent 先填写页面自己的输入框，再调用页面自己的提交路径。后续章节可以在应用确实拥有更合适的业务命令时，把两步合并成一个动作。

## 为每一行声明记录和动作

React 在这里还有一条额外约束：hook 的调用顺序必须稳定。不要在 `App` 的 `.map()` 回调里调用 `usePlingTool()` 或 `usePlingRecord()`；新增或删除一行会改变该组件的 hook 数量和顺序。

把每一行拆成子组件：

```tsx{1,10-15,20-24,31-38}
import { usePlingRecord, usePlingTool } from "@plingjs/react";

function TaskRow({ task, copy, onToggle }: TaskRowProps) {
  const rowRef = usePlingRecord<HTMLLIElement>({
    data: task,
    fields: {
      text: task.text,
      status: task.done ? copy.completedLabel : copy.openLabel,
    },
  });

  const toggleRef = usePlingTool<HTMLButtonElement>({
    id: `toggle@${task.id}`,
    desc: copy.toggleDesc(task.text, task.done),
  });

  return (
    <li ref={rowRef} className={task.done ? "task is-done" : "task"}>
      <button
        ref={toggleRef}
        type="button"
        className="task__check"
        onClick={() => onToggle(task.id)}
      >
        {task.done ? "✓" : ""}
      </button>
      <span className="task__text">{task.text}</span>
    </li>
  );
}

{tasks.map((task) => (
  <TaskRow key={task.id} task={task} copy={copy} onToggle={toggleTask} />
))}
```

`usePlingRecord` 让 `t1`、`t2`、`t3` 成为可读记录。记录不复制到第二份 store，而是读取当前任务对象；完成状态变化后不需要重新注册整行。

动作 id 带有行身份。因为这一行同时是记录，框架能把控件关联到业务记录，而不是让模型猜一个内部元素 id。

## 挂载助手

Dock 放在页面外壳里，不进入 Todo 的业务状态：

```tsx{1,8}
import { AgentDock } from "@plingjs/react";

export function App() {
  return (
    <main className="page">
      <section className="todo" ref={todoScope}>{/* Todo UI */}</section>
      <AgentDock title={copy.dockTitle} quick={copy.quick} />
    </main>
  );
}
```

快捷问题只是给人的入口。它们发送文本，不会创建能力，也不会绕过执行路径。

## 改了什么，没改什么

| 位置 | 改动 |
| --- | --- |
| 应用入口 | 创建一次 `createPling()`，用 `PlingProvider` 包住应用 |
| 任务区域 | 挂上 `usePlingScope()` |
| 任务行组件 | 挂上 `usePlingRecord()` 和一个完成动作 |
| 新待办输入框 | 挂上填写动作 |
| 提交按钮 | 挂上带可用性判断的提交动作 |
| 页面外壳 | 渲染 `<AgentDock>` |

未改变：React 状态、`addTask`、`toggleTask`、表单提交、筛选、删除、布局，以及所有没有声明的控件。Agent 当前看不到删除或筛选动作。

## 运行并验证

在仓库根目录执行：

```bash
pnpm tutorial:dev r-03
```

打开 `http://127.0.0.1:5239/`。中文界面执行 `pnpm tutorial:dev r-03 --locale zh`，打开 `http://127.0.0.1:5239/?lang=zh`。

检查：

1. 让助手新增一条“回复客户”。任务只出现一次。
2. 打开运行活动。可以看到填写输入框、提交表单两步，走的都是页面原有控件。
3. 点击把第 1 个待办标记完成的快捷问题。只有那一行变化。
4. 查看活动详情。记录的 `status` 从 `open` 变为 `completed`。
5. 让助手删除任务或筛选列表。这些动作还没有声明。

本章的确定性测试也直接验证了预期暴露面：一个区域、三条记录、输入与完成动作，以及输入为空时不存在提交动作。

## 常见失败

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| React 警告 hook 顺序变化 | Pling hook 被有条件调用，或写在动态 `.map()` 中 | 把行级 hook 移入子组件，并保持在顶层调用 |
| ref 挂在包装元素上 | 收到 ref 的元素不是实际输入框或按钮 | 检查 DOM，把 ref 交给真正可操作的元素 |
| 填入内容后提交仍不可用 | 输入是受控状态但值未更新，或 `available` 仍返回原因 | 检查受控输入和禁用条件 |
| 列表已满时提交仍不可用 | 示例的列表上限是 8 条 | 先删除或完成一条待办，再新增 |
| 行内动作影响了错误任务 | 动作 id 没有使用稳定任务 id | 让 id、`key` 和记录使用同一个 id |
| 助手看不到删除按钮 | 没有声明该动作 | 这是预期行为；业务确实需要时再开放 |
| 记录字段不更新 | 记录绑定在复制出来的旧快照上 | 让记录读取当前行数据 |

后续章节继续处理显式动作元数据与结果验证。
