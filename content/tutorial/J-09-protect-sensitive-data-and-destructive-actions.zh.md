---
id: J-09
title: "保护敏感数据与危险操作"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 保护敏感数据与危险操作

客服队列通常同时包含两类风险。有些字段本身是私密的，但助手又必须借助它完成工作；有些操作会修改或删除数据，不应在模型发出一次调用后就直接执行。前者需要控制“模型看到什么”，后者需要控制“谁有权让操作发生”。

示例在同一张表中处理这两种问题。助手可以联系账号负责人，却不会拿到电话号码；它可以清理已完成任务，但必须先通过危险操作的确认。

## 让私密值不进入页面观察

账号和内部备注是有用的业务上下文。电话号码则不同：只有一个受控操作需要它，但一旦写进页面观察，它就会出现在每一轮模型请求、会话历史和调试记录中。

按“模型需要拿它做什么”分别声明字段：

```ts
pling.record(row, {
  data: task,
  id: task.id,
  label: copy.recordLabel(task.text),
  fields: {
    text: task.text,
    done: task.done,
    phone: sensitive(task.phone, "token"),
    account: sensitive(task.account, {
      mode: "masked",
      mask: (value) => String(value).replace(/^(.{3}).*(.{4})$/, "$1****-$2"),
    }),
    internalNote: sensitive(task.internalNote),
  },
});
```

三种模式回答不同的问题：

| 模式 | 模型收到什么 | 适用场景 |
| --- | --- | --- |
| `token` | 形如 <code v-pre>{{p:…}}</code> 的稳定代号，执行时由运行时还原 | 模型必须把值传给某个声明动作 |
| `masked` | 默认形状或自定义遮罩后的部分值 | 需要辨认记录，但不需要完整值 |
| `hidden` | `[hidden]`，字段名仍保留 | 模型只需知道这里有这个字段 |

`token` 不是加密。它的作用是把真值挡在模型上下文之外，只允许受控动作在执行前一刻把它换回来。参数校验看到的是真值；模型臆造的代号会被拒绝，不会被当作普通字符串传给业务函数。

## 只在窄动作里使用真值

联系按钮把电话号码声明为一个明确的参数：

```ts
pling.tool(call, {
  id: `call@${task.id}`,
  desc: copy.callDesc(task.text),
  kind: "read",
  params: [{ name: "phone", label: copy.phoneParamLabel }],
  run: (args) => {
    lastCall = String(args.phone);
    callStatus.textContent = copy.called(lastCall.slice(-4));
  },
});
```

模型在记录里看到代号，并把同一个代号传给 `phone`。只有进入 `run` 时，页面才拿到真值。界面只显示尾号，因此演示或录屏也不会把完整号码展示出来。

不要因为拿到了 token 就扩大能力边界。应声明“联系这一条任务的负责人”，不要声明任意号码都可拨打的 `dial(number)`。动作的目标要跟随记录收窄，后端仍要检查当前用户是否有权联系该账号。

## 删除是另一类决定

切换完成状态可以撤销，清理所有已完成任务则不能。清理按钮因此同时声明业务后果和确认要求：

```ts
pling.tool(clearButton, {
  id: "clear_completed",
  desc: copy.clearDesc,
  kind: "danger",
  confirm: "always",
  available: () => tasks.some((task) => task.done)
    ? true
    : "There are no completed tasks to clear.",
  run: () => removeCompleted(),
});
```

`kind: "danger"` 表明操作可能造成破坏性后果。`confirm: "always"` 使一次会话内的“始终允许”不能覆盖后续调用。没有已完成任务时，动作会从可用列表中消失，而不是让模型点一个必然失败的按钮。

确认也不等于授权。它只表示使用页面的人同意执行这一次调用。后端仍需验证这个人是否有权删除这些记录，以及这些记录本身是否允许删除。

## 删除行时一并撤销声明

清理操作移除一行时，必须同时移除该行的记录和动作：

```ts
function removeRow(task: Task): void {
  for (const cleanup of rowCleanups.get(task.id)?.reverse() ?? []) cleanup();
  rowCleanups.delete(task.id);
  rows.get(task.id)?.remove();
  rows.delete(task.id);
}

function removeCompleted(): void {
  for (const task of tasks.filter((candidate) => candidate.done)) removeRow(task);
  for (let index = tasks.length - 1; index >= 0; index -= 1) {
    if (tasks[index]?.done) tasks.splice(index, 1);
  }
  syncSummary();
}
```

只删 DOM 行会留下过期的记录和仍可调用的动作。模型可能继续看到已经不存在的任务，或者调用一个目标已被删除的联系动作。

## 运行示例

```bash
pnpm tutorial:dev j-09
```

打开 `http://127.0.0.1:5274/`，或使用 `--locale zh` 和 `http://127.0.0.1:5274/?lang=zh`。

让助手联系第一条任务的负责人，再让它清理已完成任务。危险操作会先请求确认；最近操作会记录声明的动作和结果，但不会打印完整电话号码。

```bash
pnpm tutorial:check j-09
```

检查覆盖四条边界：页面观察中分别是 token、遮罩和隐藏值；token 只在声明动作内还原；危险动作每次都要确认；拒绝和批准分别得到应有的结果。

## 常见问题

**把所有字段都设成 hidden。** 模型既无法辨认记录，也无法在获准的操作里使用值。应逐字段判断它需要完整值、部分值，还是只需要知道字段存在。

**把敏感值写进标签或说明。** 记录不是唯一的出站路径。动作说明、区域说明、错误信息和状态键都要遵守同一规则。

**只写 `kind: "danger"`，不写确认策略。** 风险等级会参与策略推导，但破坏性操作最好显式写出 `confirm`，让代码意图没有歧义。

**把确认弹窗当成授权。** 确认是页面边界上的人为决定。身份、范围和业务规则仍由服务端负责。

下一步：[原生页面接入模型网关](/zh/vanilla/connect-vanilla-pages-to-the-model-gateway)。
