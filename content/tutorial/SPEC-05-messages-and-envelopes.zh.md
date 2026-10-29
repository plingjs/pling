---
id: SPEC-05
title: "消息与包络"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 消息与包络

本版本的消息是 JSON 对象，通过传输层交换。传输可以是 `postMessage`、HTTP、MCP facade、扩展通道或未来浏览器提案；包络语义不随传输改变。

## 请求的共同字段

每个请求必须包含：

| 字段 | 要求 |
| --- | --- |
| `protocol` | 精确值 `pling.surface/0.1` |
| `id` | 非空字符串，在本次会话内唯一标识这次逻辑调用 |
| `method` | `describe` 或 `invoke` |

`id` 用于关联响应、审计与错误。客户端不得让多个独立业务调用复用同一个 id。服务端不得因为响应重发而再次执行 `invoke`。

## `describe` 请求

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_01",
  "method": "describe",
  "input": {
    "limit": 8,
    "capabilities": "full"
  }
}
```

`input` 可以省略。支持字段：

| 字段 | 约束 | 含义 |
| --- | --- | --- |
| `record` | 非空字符串，或一至二十个 id 的数组 | 精读指定记录 |
| `offset` | 非负整数 | 记录窗口起点 |
| `limit` | 非负整数，受实现上限约束 | 记录窗口大小 |
| `capabilities` | `full` 或 `changed` | 返回完整或未变化的能力清单 |

`record` 不得与 `offset` 或 `limit` 同时使用。未知的 `describe.input` 字段应被拒绝。`capabilities: "changed"` 只应在客户端保存了同一会话上一次描述时使用。

## `describe` 成功响应

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_01",
  "ok": true,
  "result": {
    "app": "orders",
    "capabilities": [],
    "context": {
      "regions": [],
      "records": [],
      "recordIds": [],
      "recordIdsTotal": 0,
      "state": {},
      "feedback": [],
      "unavailable": [],
      "recordsTotal": 0,
      "feedbackTotal": 0,
      "unavailableTotal": 0
    }
  }
}
```

`result.protocol` 必须与请求版本一致。能力清单与上下文遵循 [能力模型](/zh/spec/0.1/capability-model)与[上下文模型](/zh/spec/0.1/context-model)。

## `invoke` 请求

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_02",
  "method": "invoke",
  "capability": "order.update_note@order",
  "input": {
    "record": "SO-1002",
    "note": "周五前回电"
  }
}
```

`capability` 必须非空，并且来自当前会话可见的能力清单。`input` 必须是对象；省略等价于空对象。折叠模板的目标记录必须放入 `input.record`，其余字段遵循该能力的 schema。

## `invoke` 成功响应

“成功”指协议交换完成，不等于业务动作成功。业务结果仍可能是结构化错误：

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_02",
  "ok": true,
  "result": {
    "error": {
      "code": "ACTION_UNAVAILABLE",
      "message": "记录已锁定"
    }
  }
}
```

业务成功可以是任意由执行器定义的 JSON 值。客户端必须同时检查 `ok` 与 `result.error`。

服务可以在成功响应中附带 `after`：

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_02",
  "ok": true,
  "result": { "title": "备注已更新" },
  "after": {
    "records": [{ "id": "SO-1002", "fields": { "note": "周五前回电" } }],
    "state": { "filter": "all" }
  }
}
```

`after` 是增量观察，不是授权证明，也不是完整快照。能力、记录或省略数量都必须有上限。

## 协议失败响应

包络、版本、方法、暴露范围、会话、限流或内部异常失败时使用：

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_02",
  "ok": false,
  "error": {
    "code": "CAPABILITY_NOT_EXPOSED",
    "message": "能力不在当前暴露范围内"
  }
}
```

`id` 无法解析时允许为空字符串。`message` 只用于诊断，客户端不得依赖其文案。稳定分支依据 `error.code`。

## 处理顺序

服务端应按以下顺序处理请求：

1. 校验对象、`id`、`protocol` 与 `method`；
2. 解析并校验会话（若实现要求会话）；
3. 应用限流；
4. 校验方法与特定字段；
5. 对 `invoke` 校验能力、记录、防重放；
6. 调用现有执行器；
7. 生成有界 `after` 与审计事件。

协议实现永远不应抛出未结构化的异常给调用方。未知版本、未知方法与内部异常都必须返回 `ok: false`。

## 版本与兼容

客户端必须发送精确版本值。服务端遇到不支持的版本必须返回 `PROTOCOL_VERSION_UNSUPPORTED`，不得按最新版本猜测。未来新增可选字段时，旧客户端应能安全忽略未知响应字段；旧客户端不得把未知状态当作成功或批准。

## 大小与缓存

传输层必须限制请求与响应大小，并对超限请求返回明确错误。`describe` 结果默认不缓存；实现可以提供会话级增量，但必须把缓存绑定到会话与作用域。导航、权限变化或撤销后，旧描述必须失效。
