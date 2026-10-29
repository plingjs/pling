---
id: R-07
title: "记录、行内动作与变更证据"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 记录、行内动作与变更证据

上一章追到了交互最终落在哪个元素上。列表会多出一个单控件没有的问题：当许多行共用同一组复选框和删除按钮时，Agent 如何知道自己在改哪条业务记录，执行结果又如何说明变化发生在预期的那一行？

这里有三个机制，分别回答不同的问题。**记录**描述一行里可供读取的数据；**折叠后的行内动作**把许多元素级控件收束成一个带 `record` 参数的操作；**变更证据**比较执行前后可见页面的差异。它们都不能代替授权、成功判据或事务保证。

前面的章节已经在 Todo 路径里用过记录和折叠后的 `toggle`。本章把规则说明白，再加入一个有破坏性后果的行内操作，并区分几种证据各自能证明什么、不能证明什么。

## 列表会放大元素级声明

现在的 Todo 页面有三行。如果每一行的完成按钮和删除按钮都各自暴露成动作，模型会收到六个行内动作；一百行就是两百个。动作清单随数据增长，而用户真正能提出的操作仍然只有两类。

元素 id 还有另一个问题。`toggle@t2` 也许能让框架知道把事件派发到哪里，却没有告诉模型 `t2` 是什么。模型可以在不知道第二行是「预约设计评审」、不知道它仍未完成的情况下点击复选框；用户的自然语言通常描述数据，而不是内部元素 id，一旦行序变化，猜测就会落到错误对象上。

因此页面需要三样东西：

- 每一行有稳定身份和一份精简的数据视图；
- 每一类行内动作只投影成一个模型工具，而不是每行一个；
- 执行结果能报告暴露出来的数据和控件发生了什么变化。

业务行为仍然是普通的 React。列表仍使用组件状态、原有事件处理函数和原有按钮。Pling 只在这套行为外面加声明，不会再造一份 Todo 数据。

## 声明一行代表什么

每条任务本来就有稳定的 `id`、文本、完成状态和优先级。行组件声明一条记录，并把它挂到列表项上：

```tsx{2-8,14-18,31-39}
function TaskRow({ task, copy, onToggle, onRemove }: TaskRowProps) {
  const rowRef = usePlingRecord<HTMLLIElement>({
    data: task,
    fields: {
      text: task.text,
      status: task.done ? "completed" : "open",
      priority: copy.priorities[task.priority],
    },
  });
  const toggleRef = usePlingTool<HTMLButtonElement>({
    id: `toggle@${task.id}`,
    desc: copy.toggleDesc(task.text, task.done),
  });
  const removeRef = usePlingTool<HTMLButtonElement>({
    id: `remove@${task.id}`,
    desc: copy.removeDesc(task.text),
    kind: "danger",
  });

  return (
    <li ref={rowRef} className={task.done ? "task is-done" : "task"} data-task-id={task.id}>
      <button ref={toggleRef} type="button" className="task__check" onClick={() => onToggle(task.id)}>
        {task.done ? "✓" : ""}
      </button>
      <span className="task__body">
        <span className="task__text">{task.text}</span>
        <span className={`task__priority priority--${task.priority}`}>
          {copy.priorities[task.priority]}
        </span>
      </span>
      <button
        ref={removeRef}
        type="button"
        className="task__remove"
        aria-label={copy.deleteTaskAria(task.text)}
        onClick={() => onRemove(task.id)}
      >
        ×
      </button>
    </li>
  );
}
```

记录 id 取自 `task.id`，得到 `t1`、`t2`、`t3`。模型只能看到声明里选出的字段：

```text
t1: text 检查发布清单; status open; priority 今天
t2: text 预约设计评审; status open; priority 近期
t3: text 跟进客户; status completed; priority 稍后
```

`usePlingRecord(task)` 是简写。它从 `task.id` 或 `task.key` 取 id，并暴露对象里的其余属性。这里采用显式写法，有三个原因：

- 布尔值 `done` 不如稳定的 `open` / `completed` 便于动作判断和差异比较；
- 模型应该直接看到人能读懂的优先级，不需要猜 `soon` 是什么；
- 与当前操作无关的字段，包括以后才加入的私有数据或派生数据，不会因为同属一个对象就自动离开页面。

`status` 与 `priority` 的处理不同，这是有意的。`status` 是稳定的机器值，行内动作和差异证据都依赖它；如果把它换成当前语言的显示文字，同一种状态在切换语言后就会表现得像发生了变化。`priority` 是界面当前使用的显示标签。如果应用逻辑也要比较优先级，应另外暴露稳定枚举，而不是反过来解析显示文案。

声明登记的是这一行，不是把行复制成第二份状态。组装快照时，字段从当前对象实时读取，所以完成状态或优先级变化后，下一轮就能看到新值，不需要重新登记整行；换成另一个 id 的对象时，才会成为另一条记录。

Pling 不会抓取 `<li>` 里的文字来猜字段。DOM 文本混着标签、格式和可能隐藏的内容，还会丢掉原始类型；抓取得越多，越容易把不该离开页面的信息带进上下文。声明才是行数据的披露边界。

## 给每个行内动作稳定身份

两个行内动作都把「做什么」和「作用于哪一行」写进 id：

```tsx{1-5,9-10}
const toggleRef = usePlingTool<HTMLButtonElement>({
  id: `toggle@${task.id}`,
  desc: copy.toggleDesc(task.text, task.done),
});

const removeRef = usePlingTool<HTMLButtonElement>({
  id: `remove@${task.id}`,
  desc: copy.removeDesc(task.text),
  kind: "danger",
});
```

id 分别是 `toggle@t1`、`toggle@t2`、`remove@t1`……最后一个 `@` 前是动作模板，后面是记录 id，两边必须指向同一行。

稳定 id 比短 id 重要。用数组下标生成记录或动作 id，排序、插入或删除之后，id 仍可能语法正确，却已经指向另一条任务。React 的 `key`、记录和行内动作应使用同一个长期稳定的业务标识。

删除声明使用 `kind: "danger"`。这是风险分类，不是样式属性。按默认审批策略，破坏性动作每次都会请求确认，也不提供「始终允许」。这道闸门有价值，但不是完整的安全边界：服务端仍要校验删除权限，应用仍要判断当前用户是否允许执行这个动作。审批与敏感数据的完整规则会在后面的章节展开。

## 把重复动作折叠成一个模型工具

注册表里始终保留每个元素级动作：`toggle@t1`、`remove@t2`……精确执行、权限判断、审计和重放具体调用都需要它们。

发给模型的那份清单更小。至少两个动作共享同一模板，并且后缀都能对应到已声明记录时，协议层会为每个模板生成一个工具：

```text
toggle(record)
  将选中的待办标记为未完成或已完成。
  record: t1 / t2 / t3 之一

remove(record)
  删除选中的待办。此操作不可撤销。
  record: t1 / t2 / t3 之一
```

动作数量于是随操作种类增长，而不是随「行数 × 操作数」增长。一百行共用同样的两个控件，仍然只有两个折叠工具。

模型调用 `{ "record": "t2" }` 时，协议层会映射回精确动作 `toggle@t2`。后续仍然走同一套权限、可用性、目标解析和事件派发逻辑。折叠改变的是模型看到的接口，不是操作的执行实现。

折叠有两条边界。只有一行使用某个模板时不折叠，因为直接 id 更短；没有对应记录 id 时也不折叠，因为 `record` 必须引用模型确实见过的数据。动作 id 本身不被当作业务身份的来源。

这个分层也保留了审计价值。模型选择一条业务记录，框架执行一个精确的元素级动作。日志可以保留 `remove@t3`，给人看的说明则能写成「删除“跟进客户”」。

## 记录实际可见的变化

成功结果不只有 `{ ok: true }`。执行器会在动作前取一份快照，等待页面稳定后再取一份，并比较暴露出来的数据。

将 `t2` 标记完成后，会得到这样的证据：

```json
{
  "changed": {
    "observed": true,
    "records": {
      "added": [],
      "removed": [],
      "updated": [{ "id": "t2", "fields": ["status"] }],
      "reordered": false,
      "omitted": { "added": 0, "removed": 0, "updated": 0 }
    }
  }
}
```

删除 `t3` 会同时报告消失的行和随它消失的行内动作：

```json
{
  "changed": {
    "observed": true,
    "records": {
      "added": [],
      "removed": ["t3"],
      "updated": [],
      "reordered": false,
      "omitted": { "added": 0, "removed": 0, "updated": 0 },
      "total": { "from": 3, "to": 2 }
    },
    "actions": {
      "added": [],
      "removed": ["toggle@t3", "remove@t3"],
      "omitted": { "added": 0, "removed": 0 }
    }
  }
}
```

新增任务会在 `records.added` 里报告新 id。搜索或筛选则可能主要改变 `actions`，因为可操作的行集合变了。

返回结果刻意保持窄小。`updated` 只列变化的字段名，不复制新旧值；新增、删除和更新三个集合各最多列五条，其余用 `omitted` 报数。它足以确认预期的那一行发生了变化，又不会把每次工具结果变成页面内容的第二份拷贝。

证据在执行适配器的稳定步骤之后采集。React 的状态更新和 DOM 提交不是同一个瞬间，目标组件也可能在后续 tick 才更新。过早读取 after 快照会制造假证据，常见表现就是删除明明成功，结果却说「无变化」。

## 三个保证不能混在一起

记录、折叠动作和差异让操作更容易观察，但它们没有合并三个不同的安全问题：

| 机制 | 回答的问题 | 不能证明什么 |
| --- | --- | --- |
| 权限与审批 | 这个调用方是否可以先尝试？ | 页面发生了变化。 |
| `expect` | 声明的业务条件是否成立？ | 周围其他东西分别变成了什么样。 |
| `changed` | 两份快照之间，暴露的记录、动作、状态或反馈有什么差异？ | 变化是否完整、正确，或对所有读取方可见。 |

对于写操作，`changed.observed: false` 是告警，不是动作失败。处理函数可能执行了却没有可见效果，也可能改到了页面没有暴露的数据。只读动作不会因为差异为空而告警，因为导航和滚动本来就可能不改变记录。

变更证据也不是事务。处理函数如果在 after 快照前先新增又删除了同一行，中间状态看不到；网络请求如果在稳定窗口之后才完成，结果也不在证据内；页面从未声明的字段，差异无法报告。跨多个资源保持的业务不变量仍属于应用或服务端，不能交给 DOM 比较。

最后，证据不判断意图。差异能证明某行变了，不能证明这个变化就是用户想要的。模型仍需结合用户请求、动作说明、记录字段和观察结果一起判断。

## 查看投影与运行结果

执行一次删除后，打开 **最近操作**，再进入 **诊断信息**。三个视图分别回答不同的问题：

- **记录**里每条任务只有 `text`、`status`、`priority` 三个字段，未声明的对象属性不应出现。
- **动作**里能看到精确 id，包括删除前的 `toggle@t3`、`remove@t3`，以及删除后随之消失的行内动作。
- **模型调用**里，工具清单应显示折叠后的 `toggle` 和 `remove`，参数中各有必填的 `record`，而不是每行一份工具定义。

删除时的确认提示属于风险路径，不属于证据本身。确认表示允许尝试；工具结果和下一份页面快照才说明这次尝试是否改变了页面。

## 分别测试声明、投影和证据

示例测试独立检查三层，避免一句听起来正确的模型回复掩盖结构错误。

第一层，注册表快照必须按页面顺序包含记录，而且只有声明字段。第二层，直接从快照构建协议投影：

```tsx
const protocol = buildProtocol(pling.registry.snapshot());

expect(protocol.templates.get("remove")).toMatchObject({
  template: "remove@",
  records: ["t1", "t2", "t3"],
});
```

测试还会确认折叠工具需要 `record`，并且没有生成 `toggle_t1` 之类的逐行工具。第三层，用精确 id 执行：`toggle@t2` 应报告 `status` 更新；`remove@t3` 应报告行消失和动作减少；`add_task` 应报告新增行。最后用回放模型按 `record` 调用折叠工具，产生预期页面状态。

这种分工也对应运行时分层。声明回答页面暴露了什么，投影回答模型能调用什么，证据回答执行器观察到了什么。其中一层出错时，不应被误诊成另一层的问题。

## 运行并验证本章示例

在仓库根目录启动中文界面：

```bash
pnpm tutorial:dev r-07 --locale zh
```

打开 `http://127.0.0.1:5247/?lang=zh`。示例源码位于 `examples/tutorials/r-07-records-row-actions-and-change-evidence`；英文界面使用 `pnpm tutorial:dev r-07` 和 `http://127.0.0.1:5247/`。

依次检查：

1. 让助手把「预约设计评审」标记为完成。第二行应改变状态，结果应报告 `t2` 的 `status` 更新。
2. 让助手删除「跟进客户」，确认这次破坏性操作。第三行应消失，证据应提到 `t3` 以及随它消失的行内动作。
3. 让助手新增「起草发布说明」，优先级设为稍后。新行应出现在 `records.added` 中，记录应包含三个声明字段。
4. 打开 **最近操作**，进入 **诊断信息**。确认记录列表没有未声明的对象属性，模型看到的是 `toggle` / `remove`，而不是每行一个工具。

模型可能换一种说法，也可能以不同顺序组织调用。应以运行记录为准，不以最终回复的措辞代替验证。

## 本章边界与后续

- 示例只有三条可见任务。记录数量上限和视口外行会在长列表章节处理。
- 记录是选择性视图，不是安全边界。敏感值需要明确遮蔽或排除。
- 差异只比较暴露出来的快照，看不到隐藏数据、服务端状态，也看不到证据窗口之后才完成的改动。
- 证据不是事务，不保证多个动作之间的顺序或原子性。
- 折叠动作仍需要可信的 DOM 目标或声明的 `run`；记录不会把不安全的目标变安全。
- 记录 id 必须稳定。基于下标的 id 可能在插入、删除或排序后悄悄指向另一行。
- `danger` 只启动确认流程，不能替代服务端授权和业务校验。

下一章[函数级工具](/zh/react/function-level-tools)处理没有可用控件可点的操作。记录说明操作作用于哪个对象；函数级工具用于真正的契约本来就是函数、而不是控件的操作。
