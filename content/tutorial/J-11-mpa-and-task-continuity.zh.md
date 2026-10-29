---
id: J-11
title: "MPA 与任务连续性"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# MPA 与任务连续性

单页应用切换路由时，document 通常仍在内存中，页面运行时、会话和注册表都不会消失。多页应用不同：点击链接会卸载整个 document，下一页从空的运行时开始。

任务连续性处理的就是这个差异。它不假装旧页面还在，而是把“任务做到哪了”以有界检查点交给下一页；下一页仍要重新声明自己的控件，并观察自己的页面。

## 明确什么能跨页，什么不能

两个页面使用同一份 continuity 配置：

```ts
export const agentSetup: AgentSetup = {
  continuity: {
    resume: "auto",
    returnOnDone: true,
  },
  config: { limits: { maxTurns: 100 } },
};
```

检查点包含最初的目标、有限的页面描述、最近的消息和事件、摘要、任务状态，以及任务开始时的页面。它不包含 DOM 节点、元素引用、待确认审批、截图、Cookie 或敏感真值。

新页面的系统提示会重新构建。模型会同时看到旧对话和本页快照，但不能因为上一页有某个动作就调用它。所有动作、记录和区域都必须由新页面重新声明。

## 每个 document 各建一个运行时

两个页面各自创建运行时和一个问答入口。列表页声明客户行和详情链接，详情页声明备注表单和操作：

```ts
const pling = createPling({ agent: agentSetup });
pling.registry.setPage({ path: "/demo/index.html", title: "客户回访" });

pling.dock({ title: "客户助手" });
```

```ts
const pling = createPling({ agent: agentSetup });
pling.registry.setPage({ path: "/demo/detail.html", title: `${customer.name} · 客户详情` });

pling.dock({ title: "客户助手" });
```

连续性成立需要三个条件：同一 origin、同一标签页、同一存储 key。默认 key 是 `pling:continuity`；同一个标签页里若有两个独立任务，应使用不同的 key。

一个标签页只应有一个开启连续性的问答入口。多个入口写同一个 key 会互相覆盖。

## 选择下一页如何继续

`resume` 有三个常用值：

| 值 | 行为 |
| --- | --- |
| `"ask"`（默认） | 显示“继续上次任务”，用户点了才发送 |
| `"auto"` | 新页面准备完成后自动发送一条受控的继续消息 |
| `"off"` | 恢复上下文，但不显示入口，也不自动发送 |

`"auto"` 不绕过 agent 循环。模型仍要观察新页面、选择声明过的动作，并经过可用性与确认检查。它省掉的只是用户重复描述目标。

`returnOnDone` 是可选项。开启后，循环产生最终回复时返回任务开始页。目标必须同源，返回动作只消费一次。

## 把被截断的步骤当成未知

如果 document 在一个动作执行期间卸载，历史里可能留下助手的 tool call，却没有对应的 tool result。直接发给模型会破坏消息配对；猜测它成功则更危险。

恢复时会补一条合成结果，说明页面在动作执行期间发生了整页导航，这一步的结果未知。模型必须先观察新页面再继续。这是刻意的保守选择：如果副作用可能已经发生，重试比重新观察更危险。

## 业务数据和任务上下文分开

连续性携带的是任务，不是业务数据。示例把客户数据存在业务自己的存储 key 下，Pling 检查点单独存放。

两者都不应保存授权令牌、供应商密钥或未脱敏的个人数据。恢复的对话仍是不可信输入，缓存的页面快照也不是当前业务状态的证明。

## 运行示例

```bash
pnpm tutorial:dev j-11
```

打开 `http://127.0.0.1:5276/demo/index.html?lang=zh` 或使用 `--locale zh`。让助手执行「Globex的备注为：周五约吃饭」。列表页会按普通整页导航跳转；详情页接着完成任务，完成后只返回列表一次。

```bash
pnpm tutorial:check j-11
```

检查覆盖真实链接导航、详情页普通动作、目标与对话恢复、被截断的 tool call、一次性自动续跑，以及新标签页隔离。

## 常见问题

**期待 DOM 被恢复。** 连续性恢复的是任务上下文，不是元素。每个 document 都要声明自己的能力。

**在客户端路由切换时使用 continuity。** 不卸载 document 的路由应暴露页面身份，额外开启连续性只会产生重复状态。

**把恢复的任务当成已经授权。** 新页面仍需要有效会话、可用范围，危险动作仍要确认。

**返回任意 URL。** 返回目标必须同源，并作为任务起始上下文的一部分进行校验。

**把真值写进检查点。** 检查点会留在浏览器存储中。敏感字段应使用 token，原始值不应进入对话或业务存储。

下一步：[测试与调试原生页面能力](/zh/vanilla/test-and-debug-vanilla-capabilities)。
