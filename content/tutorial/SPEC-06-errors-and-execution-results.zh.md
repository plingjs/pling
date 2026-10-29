---
id: SPEC-06
title: "错误与执行结果"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 错误与执行结果

实现必须区分协议失败与业务执行失败。把两者压成一个“失败”会让客户端重复写入、误报成功，或把权限拒绝当成临时故障。

## 两类结果

| 类别 | 字段 | 含义 |
| --- | --- | --- |
| 协议失败 | `ok: false`、顶层 `error` | 请求未进入业务执行，或执行边界出现内部异常 |
| 业务结果 | `ok: true`、`result` | 调用到达执行器；成功或结构化失败都由执行器定义 |

业务失败放在 `result.error`：

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_02",
  "ok": true,
  "result": {
    "error": {
      "code": "EXPECTATION_FAILED",
      "message": "保存后没有观察到新的状态"
    }
  }
}
```

客户端必须先检查 `ok`，再检查 `result.error`。只检查 HTTP 状态或只检查 `ok` 都不够。

## 协议错误码

| 错误码 | 触发条件 | 是否执行 |
| --- | --- | --- |
| `INVALID_REQUEST` | 包络、字段、类型或取值不合法 | 否 |
| `PROTOCOL_VERSION_UNSUPPORTED` | `protocol` 不是支持的版本 | 否 |
| `METHOD_NOT_SUPPORTED` | 方法不是 `describe` 或 `invoke` | 否 |
| `CAPABILITY_NOT_EXPOSED` | 能力不在站点与会话的交集内 | 否 |
| `SESSION_REQUIRED` | 实现要求会话但未提供 | 否 |
| `SESSION_INVALID` | 会话格式或绑定无效 | 否 |
| `SESSION_EXPIRED` | 会话已过有效期 | 否 |
| `SESSION_REVOKED` | 会话已撤销 | 否 |
| `RATE_LIMITED` | 超出限流窗口；可带 `retryAfterMs` | 否 |
| `RATE_LIMIT_UNAVAILABLE` | 自定义限流器故障，已 fail-closed | 否 |
| `REPLAY_DETECTED` | 同一会话复用了已消费的 `request.id` | 否 |
| `REPLAY_GUARD_UNAVAILABLE` | 防重放服务故障，已 fail-closed | 否 |
| `INTERNAL_ERROR` | 协议实现内部异常；不得继续推断业务成功 | 未确认，按未执行或状态未知处理 |

`INTERNAL_ERROR` 可能发生在执行边界附近。客户端不得因为收到它而自动重发写入；应先用只读方式观察业务状态，或请求人工确认。

## 业务错误码

执行器可以返回以下稳定错误码：

| 错误码 | 含义 |
| --- | --- |
| `DUPLICATE_ACTION_ID` | 声明了重复动作 id |
| `DUPLICATE_STATE_KEY` | 声明了重复状态键 |
| `DUPLICATE_GUIDE_TARGET` | 声明了重复指引目标 |
| `ACTION_NOT_FOUND` | 当前页面没有该动作 |
| `INVALID_ARGS` | 工具参数不是合法 JSON 或结构错误 |
| `INVALID_PARAMS` | 参数不符合 schema |
| `PERMISSION_DENIED` | 业务策略拒绝 |
| `ACTION_UNAVAILABLE` | 前置条件不满足 |
| `EXECUTION_FAILED` | 处理函数抛错或业务拒绝 |
| `EXPECTATION_FAILED` | 动作执行后成功判据未成立 |
| `HANDOFF_CANCELLED` | 用户取消人工接力 |
| `HANDOFF_TIMEOUT` | 人工接力超时 |
| `HANDOFF_FAILED` | 用户声称完成，但结果未出现 |
| `STEP_FAILED` | 复合动作中的某一步失败，可能带 `resume` |
| `HOOK_BLOCKED` | 生命周期钩子阻止执行 |
| `LOOP_DETECTED` | 运行时检测到重复循环 |

业务错误码必须保持机器可读。`message` 可以本地化，但不得成为调用方分支依据。

## 成功结果

成功结果的 `result` 由执行器与应用共同定义。它应包含足以验证业务的证据，例如变更后的记录 id、确认过的期望或操作摘要。成功响应不应包含凭证、原始敏感参数或仅供内部调试的对象引用。

## 恢复规则

- `INVALID_REQUEST`：修正包络，不得原样重试。
- `CAPABILITY_NOT_EXPOSED`：重新描述；不要尝试相似 id。
- `ACTION_NOT_FOUND`：页面或声明已经变化，重新描述。
- `ACTION_UNAVAILABLE`：满足前置条件，不能绕过闸门。
- `INVALID_PARAMS`：按 schema 修正。
- `PERMISSION_DENIED`：停止并转人工；Agent 不能自授权限。
- `EXPECTATION_FAILED`：先观察页面，可能存在部分成功。
- `RATE_LIMITED`：遵守 `retryAfterMs`。
- `REPLAY_DETECTED`：不要生成新 id 来重复同一业务意图；先查询前次结果。
- 会话错误：重新认证或取得新委托。

## 日志与展示

日志可以记录错误码、request id、能力 id 和耗时，不应记录完整输入或响应。面向用户的文案应解释可行动的下一步，而不是暴露堆栈。审计与告警应根据错误类别和风险级别设置，不应把每个业务拒绝都当成系统故障。
