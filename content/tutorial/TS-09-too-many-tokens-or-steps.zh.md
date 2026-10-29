---
id: TS-09
title: "Token 或步数过多"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# Token 或步数过多

一次运行变得昂贵，通常不是模型“太笨”，而是上下文无界、记录窗口太大、工具返回值过宽、循环没有被识别，或者轮数预算掩盖了页面问题。

## 先量，再改

记录：

- `turnsUsed`：本次请求的模型轮数；
- `telemetry.summary().llmCalls`：会话累计调用；
- 每次请求的 token 估算与工具结果大小；
- 实际执行的工具序列；
- 压缩发生次数；
- 失败与重试次数。

不要把累计调用和单次预算混在一个指标里。先找出增长来自历史、工具结果还是重复循环。

## 常见原因

| 原因 | 修复 |
| --- | --- |
| 记录窗口过大 | 减小 `limit`，按需精读单条记录 |
| 每次重发整页描述 | 使用 `capabilities: "changed"` 与 `after` |
| 状态暴露整个 store | 只暴露任务相关字段 |
| 工具返回大段 HTML/JSON | 返回业务摘要与变更 id |
| 模型重复同一动作 | 检查成功判据、错误与循环检测 |
| 历史无界 | 配置 `contextTokens`、`compactRatio`、`keepRecent` |
| 轮数预算过高 | 从生产默认 10 开始，测量后再调整 |

## 配置建议

```ts
limits: {
  maxTurns: 10,
  contextTokens: 8_192,
  reserveForOutput: 1_024,
  compactRatio: 0.8,
  keepRecent: 6,
  maxTokens: 1_024,
}
```

`maxTurns` 控制一次 `send()` 的往返，`contextTokens` 控制提示词预算，`maxTokens` 控制单次生成。三者不是同一个旋钮。把 `maxTurns` 从 10 调到 100 不会压缩历史，只会给循环更多机会。

## 设计更小的上下文

- 一条记录只暴露当前决策需要的字段；
- 长列表返回窗口、总数与可引用 id；
- 成功后用 `after` 检查变化，不重复描述整页；
- 把大文件转换为业务摘要或任务 id；
- 将稳定说明放在能力描述中，而不是每轮用户消息重复；
- 对明确失败停止，不要把错误当新提示反复重试。

## 循环检测

若模型反复调用同一 id 与相同参数：

1. 检查工具结果是否表明成功；
2. 检查成功判据是否永远不成立；
3. 检查页面是否在每次调用后重建；
4. 检查错误是否没有提供可行动信息；
5. 检查 `LOOP_DETECTED` 与最大轮数是否生效。

不要仅靠提高预算解决循环。更大的预算会把一个错误变成更长的账单。

## 验收

- 100 条记录的页面在默认窗口下 token 可预测；
- 成功动作后不重复整页描述；
- 连续失败会终止并给出结构错误；
- 压缩后任务仍可完成；
- 能按请求 id 解释 token 与轮数增长来源。

## 相关

[运行时限额、观测与错误码](/zh/vue/runtime-limits-observability-and-error-codes)、[Agent 运行时、会话、上下文与限额](/zh/reference/agent-runtime-sessions-context-limits)、[测试、覆盖率与评测](/zh/vue/testing-coverage-and-evaluation)。
