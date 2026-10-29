---
id: R-17
title: "运行时限额、观测与错误码"
locale: zh
source_locale: en
translation_status: drafted
status: drafted
---

# 运行时限额、观测与错误码

一个在演示里能用的 agent，到了产品里仍可能出问题：模型轮数失控、历史无界增长，或者只回一句“出错了”，让人无从判断下一步。这一章不改订单流程，只看它外面的运行时。

目标不是把所有数字都变成配置项，而是把边界说清楚，让一次运行留下可读的记录，让失败有稳定的结构。

## 区分两类限额

应用配置的是一组请求预算和一组上下文预算：

```ts
createPling({
  agent: {
    config: {
      limits: {
        maxTurns: 100,
        contextTokens: 8_192,
        reserveForOutput: 1_024,
        compactRatio: 0.8,
        keepRecent: 6,
      },
    },
  },
});
```

| 设置 | 控制什么 |
| --- | --- |
| `maxTurns` | 一次 `send()` 里最多几轮模型往返 |
| `contextTokens` | 整段对话的提示词预算 |
| `reserveForOutput` | 为下一次模型回复预留的空间 |
| `compactRatio` | 用到可用预算的多少比例时压缩历史 |
| `keepRecent` | 压缩时保留多少条近期原文 |

`maxTurns` 不是整段会话的总次数。一个会话可以包含多次用户请求，每次请求单独计算轮数。`contextTokens` 也不等于 `maxTokens`：后者限制单次生成，前者限制每次请求携带的提示词历史。

示例为了便于学习使用 `maxTurns: 100`。生产环境应从框架默认的 10 开始，只有经过测量确认确有需要才增大。轮数放得太宽，会把一个循环错误变成一张账单。

`reserveForOutput` 必须给历史留下可用空间。如果 `contextTokens - reserveForOutput` 太小，每次请求一开始就接近压缩水位。框架会拒绝 `maxTurns: 0`、`compactRatio: 1.5` 这类配置，而不是等到运行时才出现难以解释的行为。

## 两个计数器回答不同问题

运行时同时暴露两个数：

- `turnsUsed`：最近一次 `send()` 用掉了几轮模型往返，应与 `maxTurns` 比较；
- `telemetry.summary().llmCalls`：整段会话累计调用了几次模型，包含重试和压缩。

不要把两个数放进同一个标签。“10 轮里用了 3 轮”描述预算；“本段会话累计 17 次调用”描述用量。

订单示例用一个 `Telemetry` 实例记录工具调用：

```ts
const telemetry = new Telemetry();
const loop = createAgentLoop({ registry, policy, llm, telemetry, maxTurns: 4 });

await loop.run('修改 SO-1002 的备注');

loop.turnsUsed;                       // 本次运行的模型轮数
telemetry.summary().toolCalls;        // 累计工具调用数
```

生产环境应把同类事件送到自己的采集系统。默认不要记录完整提示词、表单值和模型原文。内建 telemetry 只保留次数、耗时、token 估算和错误类别，不需要变成用户数据的副本。

## 在运行视图里检查一次请求

React 的浮窗可以打开一个有界的请求检查器：

```tsx
<AgentDock debug={{ maxCalls: 8 }} />
```

检查器显示系统提示、组装后的历史、工具 schema、页面快照和最近几次模型响应。`maxCalls` 限制内存里保留多少次调用。这个上限是必要的：长会话里保存每一份提示词，会把调试功能变成内存泄漏。

检查器放在运行视图里，而不是另开一个应用面板。它描述的就是用户刚看到的那次运行，包括审批和人工接力。

调试数据属于运行数据。显示模型输出和页面快照时要把它们当作不可信内容处理，也不要默认写进公开日志。

## 错误要有代码，也要有下一步

上一章的流程可能因为保存被锁定而失败。回执同时带上稳定代码和可读说明：

```json
{
  "error": {
    "code": "STEP_FAILED",
    "message": "Flow update_order_note failed at step 4/4 (save_note): ...",
    "resume": { "runId": "run-3", "from": 4 }
  }
}
```

`PERMISSION_DENIED`、`ACTION_UNAVAILABLE`、`EXPECTATION_FAILED`、`HANDOFF_CANCELLED`、`STEP_FAILED` 这类代码用于程序判断和测试；message 给模型和查看运行记录的人。客户端不要根据 message 的具体措辞分支，应当根据 code 分支。

错误处理要停在正确的边界上：

- 权限拒绝和人工取消是用户的决定，不要静默重试；
- 动作不可用，先修前置条件；
- 期望超时，说明效果尚未确认，先检查页面再重试；
- 流程失败且带有 `resume`，从失败步骤继续。

## 运行示例

```bash
pnpm tutorial:dev r-17
```

打开 `http://127.0.0.1:5257/?lang=zh`，使用运行视图。
完整示例位于 `examples/tutorials/r-17-runtime-limits-observability-and-error-codes`。

1. 让助手修改备注。查看 `turnsUsed`、工具调用和检查器里的真实请求。
2. 锁定保存，再修改一条备注。找到 `STEP_FAILED`、逐步账本和续跑句柄。
3. 解锁保存并继续。原流程从失败处续跑，而不是重做。

确定性检查：

```bash
pnpm tutorial:check r-17
```

测试覆盖限额校验、轮数与累计调用的区别，以及稳定错误码。

## 失败模式

**靠增大 `maxTurns` 掩盖循环。** 轮数越多，错误循环只是跑得更久。应先修重复动作或含糊指令，确认确有需要后再提高预算。

**一个计数器表达两种含义。** 界面因为混用累计调用和单次预算而显示“10 轮里用了 20 轮”，比不显示更糟。

**把每次请求都留在检查器里。** 调试缓冲必须有上限。保留最近若干次足以定位问题，也能让内存占用可预测。

**解析人类可读的错误文本。** 说明会随框架改进而变化。测试和恢复逻辑应使用错误代码与结构化字段。
