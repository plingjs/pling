---
id: R-16
title: "流程、异步与失败续跑"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# 流程、异步与失败续跑

有些业务操作有固定顺序。修改订单备注通常要先回到全部列表，找到目标订单，打开编辑框，填入内容，再等待保存完成。这个顺序不是模型每次都要重新决定的策略，而是业务操作本身的一部分。

如果每一步都单独调用动作，会出现三个问题：模型要用多轮对话反复表达同一件事；中途失败时，它很容易从第一步重来；审批和审计看到的是一串互不相关的动作，而不是一次业务操作。

流程把这段固定顺序声明一次。模型只看到一个动作，Pling 按声明顺序执行，轮到某一步时才解析对应动作，最后为整次操作返回一份回执。

## 声明业务操作，而不是发明一套脚本语言

示例在页面上声明了一条流程：

```ts
const updateNoteFlow = {
  id: 'update_order_note',
  desc: '把指定订单的备注改为新内容（回到全部 → 打开订单 → 填写 → 保存）。',
  kind: 'write',
  params: [
    { name: 'orderId', label: '订单号', options: () => orders.map((order) => order.id) },
    { name: 'note', label: '新的备注内容', minLength: 1 },
  ],
  steps: [
    { action: 'filter_all', desc: '把筛选恢复到全部订单' },
    { action: 'open_order@{{orderId}}', desc: '打开目标订单' },
    { action: 'note_input', args: { text: '{{note}}' }, desc: '填写新的备注' },
    { action: 'save_note', desc: '保存备注', idempotent: true },
  ],
};
```

步骤引用的是页面上已经注册的动作 id。它们不引入选择器、DOM 调用，也不建立第二套权限判断。在 React 中，流程本身仍然通过同一个 `usePlingTool` 注册：

```tsx
const flowRef = usePlingTool<HTMLElement>(updateNoteFlow);

return <section ref={flowRef}>...</section>;
```

这样，查询按钮改名或删除后，流程会在开发阶段给出可定位的错误，而不是悄悄点到旧的选择器。某个行内动作需要审批时，同一条审批逻辑也会在流程里生效。

只有顺序确实固定时才使用流程。下一步要看上一步结果的情况，应当把选择留给 agent 循环，并保留各个单独动作。流程不是通用脚本语言。

## 模型看到什么

模型看到的是一个带流程标记的动作，而不是四个彼此独立的建议：

```text
update_order_note（流程:4 步 / write）
  把指定订单的备注改为新内容（回到全部 → 打开订单 → 填写 → 保存）。
```

调用以后，运行时仍会检查参数、作用域、可用性和审批。整条流程的风险取所有可达步骤里最严的一档，用户只为这一次业务操作确认一次。

执行器逐步解析动作 id。弹窗里的输入框和保存按钮在订单打开之前并不存在，所以不能在页面刚渲染时就把所有步骤当成静态节点验证一遍。

最后一步完成后，回执包含逐步账本和一份变更摘要：

```json
{
  "ok": true,
  "flow": { "completed": 4, "total": 4, "steps": ["…"] },
  "changed": { "observed": true }
}
```

一份回执不是省字段，而是让模型判断“这次业务操作是否完成、改了什么”的基本单位。

## 把异步完成说清楚

点击保存不等于请求已经完成。界面可能在请求期间保持编辑框，等服务器返回后再关闭。示例里的 `saveNote()` 等待 250ms，随后更新备注并关闭编辑框。

保存动作声明了成功判据：

```ts
expect: {
  desc: '订单备注已更新，弹窗已关闭',
  check: () => {
    const order = editingOrder.value;
    return Boolean(order && order.note === draftNote.value.trim() && editingId.value === null);
  },
  timeout: 2_000,
}
```

`expect` 判断的是业务状态，不是固定等待时间。Pling 会等条件成立；如果请求失败，编辑框仍然打开，动作返回 `EXPECTATION_FAILED`，而不是把“按钮点到了”说成保存成功。

不要用随意加的 `setTimeout` 代替 `expect`。固定延时要么比实际需要更慢，要么在负载高时仍然太短。结果可以被观察到时，就让框架等这个结果。

`settle` 解决的是另一件事：让 React 完成 DOM 更新，并等页面停止滚动或动画。流程内部沿用普通动作相同的 settle 机制。`settle` 和 `expect` 不能互相替代。

## 中途失败时，不假装什么都没发生

示例的“锁定保存”会让保存动作暂时不可用。此时运行流程，会以 `STEP_FAILED` 停在第 4 步：

```text
Flow update_order_note failed at step 4/4 (save_note): saving is locked.
Progress: 3/4 steps: filter_all✓ / open_order@SO-1004✓ / note_input✓ / save_note✗.
Changes from completed steps have already taken effect.
Call pling_resume_flow to resume from step 4 (runId: run-…).
```

前三步没有回滚：筛选已经恢复，目标订单已经打开，新的备注也已经填进输入框。agent 应当保留这些状态继续，而不是从头重放整条流程。

保存重新可用后，用失败回执里的句柄继续：

```ts
await executor.execute('pling_resume_flow', JSON.stringify({ runId: failed.error.resume.runId }));
```

框架从失败的那一步开始，保留之前的步骤记录。流程成功后，临时的续跑动作会从页面上消失。

并非所有失败都能安全续跑。找不到动作、参数错误、控件不可用或权限被拒绝，都发生在产生副作用之前，可以继续；已经抛出错误或等待期望超时的步骤，可能已经改变了数据，只有确认重复执行无害时才标 `idempotent: true`。否则应先检查页面，再手工补做剩余部分。

## 运行示例

```bash
pnpm tutorial:dev r-16 --locale zh
```

打开 `http://127.0.0.1:5256/?lang=zh`。示例源码位于 `examples/tutorials/r-16-flows-async-work-and-recovery`，直接使用工作区中的 Pling 包，没有复制框架实现。

1. 让助手修改 `SO-1002` 的备注。页面会回到全部、打开编辑框、填入内容，并等待延迟保存完成。
2. 点击“锁定保存”，再发起一次备注修改。查看逐步账本和续跑句柄。
3. 点击“解锁保存”，让助手继续。编辑框会从原处完成，前三步不会重放。

确定性检查：

```bash
pnpm tutorial:check r-16
```

测试覆盖流程注册结果、异步完成、最后一步失败和从失败处续跑。

## 失败模式

**用流程隐藏判断。** 流程没有分支。下一步取决于结果时，应保留各个动作，让模型根据回执选择。把很长的决策树写进步骤，会让回执难以理解，也更难测试。

**重试副作用未知的步骤。** 提交请求超时并不说明请求没有成功。除非底层操作本身支持幂等，不要轻易把这一步标成可重复执行。

**用固定毫秒数等待。** 业务结果用 `expect`，页面落定用 `settle`。睡眠不能证明任何事情发生过。

**忽略逐步账本。** “流程失败了”远不如“前三步已经完成，第四步不可用”有用。账本存在的目的，就是让模型修对那一段，而不是重做整件事。
