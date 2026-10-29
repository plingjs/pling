---
id: V3-18
title: "敏感数据"
locale: zh
source_locale: en
translation_status: drafted
status: drafted
---

# 敏感数据

一条订单记录里可能有手机号、证件号或内部评级。直接删掉这些字段，助手会变笨：既认不出客户，也无法完成需要这个值的动作。原样交出去更糟：值会进入提示词、对话历史，甚至第三方模型服务的日志。

Pling 把“模型知道有这个字段”和“模型看见这个值”分开。字段仍留在记录里，值可以被隐藏、遮罩，或者换成一个会话内的代号。

## 在记录暴露处声明敏感性

订单行仍使用原来的 `v-record`，只包住敏感值：

```ts
import { sensitive } from '@plingjs/vue';

v-record="{
  data: order,
  id: order.id,
  label: `Order ${order.id}`,
  fields: {
    customer: order.customer,
    status: order.status,
    phone: sensitive(order.phone, 'token'),
    idCard: sensitive(order.idCard, 'masked'),
    grade: sensitive(order.grade),
  },
}"
```

模型会看到四种不同层级的信息：

| 声明 | 模型看到 | 原值是否可还原 |
| --- | --- | --- |
| `sensitive(value)` / `sensitive(value, 'hidden')` | `[hidden]` | 否 |
| `sensitive(value, 'masked')` | `P-1****1198` 这类遮罩 | 否 |
| `sensitive(value, 'token')` | <code v-pre>{{p:…}}</code> | 在当前页面会话内可以 |
| `sensitive(value, { mode: 'hint', hint: '美国手机号' })` | `[美国手机号]` | 否 |

默认是 `hidden`，不是 `masked`。开发者还没想清楚值会被怎样使用时，应当少暴露，而不是多暴露。

`masked` 是有损的，适合核对尾号或确认字段形态，不能当成“动作可以使用这个值”的另一种写法。

## token 是一种能力，不是混淆后的字符串

示例的手机号使用 token 模式。模型可以把 <code v-pre>{{p:…}}</code> 原样填进动作参数：

```json
{ "phone": "{{p:1a2b3c4}}" }
```

参数校验和业务函数执行之前，执行器会把它还原成真值。业务代码拿到的手机号，与用户亲手点击按钮时拿到的相同：

```ts
run: (args) => callCustomer(order, String(args.phone))
```

这使得“动作确实需要这个值”的场景可以成立，也意味着动作本身要设计得更谨慎：一个接受手机号代号的动作，可能触发打电话、发消息等真实副作用。敏感数据处理不能替代审批，应按需要声明 `kind`、`confirm` 或人工接力。

代号只在当前页面会话内有效。同一个值在同一段会话里映射到同一个代号，模型才能跨轮次指代“这位客户”。刷新页面后，代号空间会变化。编造或过期的代号会在动作执行前被拒绝：

```text
Arguments reference unknown sensitive-value tokens: <code v-pre>{{p:madeup1}}</code>
```

不要把代号当成可以带到另一个环境的密钥。它是短期引用，不是可移植凭证。

## 防止真值从其他通道返回

只处理记录还不够。业务函数抛出的错误可能带着真值，页面反馈也可能把它显示出来。Pling 会记住已经用过代号的值，在出站路径上做反向脱敏，覆盖工具回执、错误信息和页面反馈。

例如核对工具在错误里带上了还原后的手机号，模型收到的是代号：

```text
Customer <code v-pre>{{p:1a2b3c4}}</code> is already registered.
```

反向脱敏是安全网，不是到处打印敏感值的许可。应用自己的日志、分析和 telemetry 不在这个边界内，同样需要遵守规则：记录 id 或遮罩值，不记录原文。

## 状态暴露遵循同一条规则

`useAgentState` 等只读暴露里也可以使用同一个 `sensitive()` 标记：

```ts
useAgentState('customer', () => ({
  name: customer.name,
  phone: sensitive(customer.phone, 'token'),
  level: customer.level,
}));
```

不要把整个 store 暴露出去，再指望 agent 自己忽略不需要的字段。敏感字段应当显式列出，视图只包含做判断所需的内容。

## 运行示例

```bash
pnpm tutorial:dev v3-18
```

打开 `http://127.0.0.1:5231/`。

1. 让助手给 `SO-1002` 的客户打电话。模型传递手机号代号，业务函数拿到真值。
2. 让助手核对同一位客户。抛出的错误在回到模型前会被换成代号。
3. 在 Activity 里查看记录：手机号是代号，证件号是遮罩，内部评级是隐藏。

确定性检查：

```bash
pnpm tutorial:check v3-18
```

测试覆盖投影、代号还原、反向脱敏，以及拒绝编造的代号。

## 失败模式

**默认就用 token。** token 是给动作需要值的情况用的。只提供上下文的字段应当 hidden 或 hint。最宽松的模式必须是有意选择。

**以为遮罩值还能使用。** 遮罩不可逆。动作需要手机号时，应使用 token 并保护动作，而不是想办法解析遮罩。

**在进入框架前就把值写进日志。** `sensitive()` 无法脱敏应用自己发给分析服务的请求。数据采集也要单独审查。

**把代号放进 URL 或跨会话共享。** 代号是页面范围的引用，不替代授权，也不应成为跨系统携带值的捷径。
