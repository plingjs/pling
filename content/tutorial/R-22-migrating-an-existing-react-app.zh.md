---
id: R-22
title: "在存量 React 应用中接入 Pling"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 在存量 React 应用中接入 Pling

一个已经运行的 React 页面里，通常已经有助手需要的大部分东西：校验过的表单、测试过的行操作、权限判断和状态模型。迁移应当开放这些已经工作的路径，而不是在页面旁边再造一套处理函数。

示例从一个普通 Todo 页面开始。业务函数不引用 Pling。接入部分只增加一次 Provider，给现有页面区域命名，连接原来的表单与行控件，再提供一个范围很窄的只读视图。原有布局和事件处理都保留。

## 业务函数留在原处

业务函数仍是唯一实现：

```ts
export function addTask(tasks: Task[], text: string, id: string): Task[] | null {
  const value = text.trim();
  if (!value || tasks.length >= MAX_TASKS) return null;
  return [{ id, text: value, done: false }, ...tasks];
}

export function toggleTask(tasks: Task[], id: string): Task[] {
  return tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
}
```

这些函数可以在没有页面助手时单独测试，也可以同时被人工点击和 Agent 动作调用。签名里不必出现 Pling 的类型。

在应用入口提供一次运行时：

```ts
const pling = createPling();

createRoot(document.getElementById("root")!).render(
  <PlingProvider pling={pling}>
    <App />
  </PlingProvider>,
);
```

Provider 只让 React 组件拿到运行时，不会自动开放控件或状态字段。哪一个按钮、输入框和视图可以被调用，仍要逐个声明。

## 给页面区域命名

为现有工作区加上稳定区域：

```tsx
const todoScope = usePlingScope<HTMLElement>({
  id: "todo",
  label: copy.region,
  description: copy.regionDescription,
  role: "main",
});

<section ref={todoScope}>
```

区域用于说明这些操作属于页面的哪一部分，它本身不是权限边界。动作是否可用、风险多高、是否需要确认，由各自的声明和执行策略决定。

区域应当对应人能认出的单元，例如当前列表、弹窗或工作面板。如果同一页面还有风险不同的无关工具，不要为了少写声明就把整个应用包进一个区域。

## 接上已经在做事的控件

先把一条完整任务路径接好。这个页面里的路径由现有输入框、提交按钮和行内勾选框组成：

```tsx
const draftRef = usePlingTool<HTMLInputElement>({
  id: "draft_text",
  desc: copy.draftDescription,
  kind: "write",
});
const submitRef = usePlingTool<HTMLFormElement>({
  id: "submit_task",
  desc: copy.submitDescription,
  kind: "write",
  available: () => tasks.length < MAX_TASKS ? true : copy.listFull(MAX_TASKS),
  run: () => { submitDraft(); },
  expect: {
    desc: copy.addExpect,
    check: () => lastAddedId.current !== null && tasks.some(
      (task) => task.id === lastAddedId.current,
    ),
  },
});

<form ref={submitRef} onSubmit={handleSubmit}>
  <input ref={draftRef} value={draft} onChange={handleDraftChange} />
  <button type="submit">{copy.add}</button>
</form>

<li ref={rowRef}>
  <input
    ref={toggleRef}
    type="checkbox"
    checked={task.done}
    onChange={() => toggle(task.id)}
  />
</li>
```

`usePlingRecord` 给每行一个稳定记录 id（`task.id`）和少量字段。不要用行号或可见文字生成 id：排序、筛选或切换语言后，它们都会变化。

提交动作不只是一次点击。它需要知道列表是否已满，也需要确认提交的待办是否真的出现：

```ts
const submitRef = usePlingTool<HTMLFormElement>({
  id: "submit_task",
  desc: copy.submitDescription,
  kind: "write",
  available: () => tasks.length < MAX_TASKS ? true : copy.listFull(MAX_TASKS),
  run: () => { submitDraft(); },
  expect: {
    desc: copy.addExpect,
    check: () =>
      lastAddedId.current !== null &&
      tasks.some((task) => task.id === lastAddedId.current),
  },
});
```

`lastAddedId` 是一个 ref，由 `submitDraft()` 更新，代表这次提交新增的记录。`expect` 只认这个 id，避免列表里原本就有记录时把动作误判为成功。

`available` 让动作继续留在清单里，但说明为什么暂时不能执行，比直接隐藏更有用。`expect` 会等待可观察的结果；待办始终没有出现时，会返回 `EXPECTATION_FAILED`，不会把“点过了”当成“提交成功”。

这里保留“填写表单，再提交”的两步流程，因为原页面本来就是这样工作。如果业务语义更适合一个动作，也可以用一个带参数的工具直接调用同一个 `addTask`。这是任务模型的取舍，不是要把实现藏起来。

## 只暴露范围有限的现有状态

Agent 要知道页面此刻有什么，但不需要组件里的全部状态：

```ts
usePlingState(
  "todo_migration",
  () => ({ ...counts, visibleIds: tasks.map((task) => task.id) }),
  { description: copy.stateDescription },
);
```

这个视图是只读的。写入仍要经过已声明的动作，因此会走同一套可用性、策略、确认和执行证据。视图应保持有界：计数、当前筛选和记录 id 通常已经足够；内部字段和敏感值不要放进去。

## 保留人工路径，并验证两边一致

不需要开放所有控件。示例里的 CSV 导出是真实的员工操作。人仍可使用它，但它没有动作声明，并带有 `data-pling-ignore`。页面上只显示“人工导出”，不会把实现标记当成业务说明。

`data-pling-ignore` 会阻止该元素下的自动派生和覆盖率提示，它不是授权机制。真正不能交给 Agent 的操作，应当保持未声明，并在应用或后端照常执行权限检查。

迁移测试会同时检查两条路径是否落到同一份可见状态：

- 不挂载 Pling 时，原有业务函数仍能工作；
- 人仍能通过原表单和勾选框新增、完成待办；
- Agent 的表单动作调用同一套处理函数，修改同一份列表；
- 刻意未开放的控件不会出现在注册表里；
- 中英文描述的是同一个操作。

运行英文示例：

```bash
pnpm tutorial:dev r-22
```

打开 `http://127.0.0.1:5262/`。运行中文示例：

```bash
pnpm tutorial:dev r-22 --locale zh
```

打开 `http://127.0.0.1:5262/?lang=zh`。源码位于 `examples/tutorials/r-22-migrating-an-existing-react-app`。

待办列表旁的记录标出了接入点。助手可以填写并提交表单、勾选行；CSV 导出仍由人操作。

确定性检查：

```bash
pnpm tutorial:check r-22
```

## 逐步扩大开放范围

实际迁移可以按下面的顺序推进：

1. 安装插件，保留原有测试。
2. 给一个页面区域命名，开放一个低风险只读操作。
3. 加入一条完整写路径，并写明可观察的成功判据。
4. 等 id 与字段边界稳定后，再开放记录级动作。
5. 最后处理敏感、管理类与批量操作，并明确策略和确认方式。

这样每一步页面都仍可使用，出问题时也容易判断是接入边界还是后续能力造成的。第一条写路径跑通后，再扩大能力面会更稳妥。

## 常见问题

**给 Agent 另建一套处理函数。** 两套实现迟早会分叉。Agent 动作应调用现有函数，并验证用户能看到的结果。

**看到控件就全部开放。** 一个控件可见，不代表适合交给 Agent：它可能风险过高、范围过宽，或与目标任务无关。能被扫描到不等于已被批准。

**把整个组件或 store 交给模型。** 这会浪费上下文，也更容易把内部字段和敏感数据带出页面。应提供有名字、有边界的只读视图。

**用翻译后的标签当 id。** 改文案或切换语言就会破坏动作。使用应用内稳定 id，只把说明文字交给翻译。

**把 `data-pling-ignore` 当成安全边界。** 它只阻止声明与覆盖率发现，授权仍应由动作策略和后端负责。
