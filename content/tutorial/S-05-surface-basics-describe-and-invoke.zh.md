---
id: S-05
title: "Surface 基础：describe 与 invoke"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# Surface 基础：describe 与 invoke

当前 Surface 协议只有两个方法。`describe` 让客户端了解当前页面与已暴露能力，`invoke` 请求页面执行其中一个。连接中的其他部分——身份验证、传输发现、撤销、审计投递——都属于宿主。

## 创建 Surface

```ts
const surface = createSurface({
  registry,
  execute: (id, args) => executor.execute(id, args),
  app: "orders",
  expose: ["orders.search", "orders.open", "orders.update_note@order"],
  session: () => verifiedSession,
  recordLimit: 8,
});
```

`registry` 与页面助手使用同一份声明。`execute` 必须是现有执行路径，或等价地保留可用性、确认、schema 校验、成功判据和变更证据。不要在传输层重新实现这些检查。

## `describe`

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req-1",
  "method": "describe",
  "input": { "limit": 8, "capabilities": "changed" }
}
```

响应包括：

- `app` 与 `protocol`；
- 受 `expose ∩ session.scope` 限制的 `capabilities`；
- 页面身份可用时的 `context.page`；
- 区域、记录窗口、记录 id、状态、反馈与不可用动作；
- `recordWindow` 与总数，让截断可见；
- `capabilities: "changed"` 无变化时的 `capabilitiesUnchanged`。

用 `record` 读取一条或少数指定记录，不能与 `offset`、`limit` 同时使用。只有在首次完整读取之后才使用 `capabilities: "changed"`；空数组表示未变化，不表示没有能力。

## `invoke`

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req-2",
  "method": "invoke",
  "capability": "orders.update_note@order",
  "input": { "record": "SO-1002", "note": "周五前回电" }
}
```

能力 id 而不是选择器标识操作。折叠行内动作从 `input.record` 解析目标；页面执行器仍检查记录是否存在、是否属于活跃区域，以及会话范围是否允许。

响应有两层。`ok` 描述协议交换；合法交换中仍可能包含业务失败：

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req-2",
  "ok": true,
  "result": {
    "error": { "code": "ACTION_UNAVAILABLE", "message": "记录已锁定" }
  }
}
```

协议失败则不同，使用 `ok: false` 与 `CAPABILITY_NOT_EXPOSED`、`INVALID_REQUEST`、`SESSION_EXPIRED`、`RATE_LIMITED` 或 `REPLAY_DETECTED` 等 `error.code`。

## 增量证据

`invoke` 结果可以带 `after`，描述新出现的能力、变化记录与状态。它帮助下一次决策，但不能替代导航或大规模外部变化后的完整描述。没有 `after` 时，客户端应重新 `describe`，不要假设什么都没变。

`after` 也不是授权证明。它描述页面在执行后观察到什么，不证明用户批准过高风险操作，也不证明后端事务已提交。

## 失败分类

| 观察 | 含义 | 下一步 |
| --- | --- | --- |
| `CAPABILITY_NOT_EXPOSED` | 站点或会话范围拒绝了该 id | 重新描述，或申请有效授权 |
| `ACTION_NOT_FOUND` | 当前页面没有注册该 id | 重新描述当前页面 |
| `ACTION_UNAVAILABLE` | 动作存在但前置条件未满足 | 先解决前置条件，不要盲重试 |
| `INVALID_PARAMS` | 输入不符合 schema | 按描述修正输入 |
| `PERMISSION_DENIED` | 人或后端拒绝 | 停止并报告；同意不能自授 |
| `EXPECTATION_FAILED` | 声明的结果没有出现 | 重新观察再决定 |
| `SESSION_EXPIRED` / `SESSION_REVOKED` | 委托已失效 | 重新登录或申请新授权 |

## 最小客户端循环

1. 验证身份，从宿主取得有效会话。
2. 用有界记录窗口调用 `describe`。
3. 选择一个已暴露且输入符合 schema 的能力。
4. 用新请求 id 调用 `invoke`。
5. 同时检查 `ok` 与 `result.error`。
6. 导航、动作不可用或成功判据失败后重新描述。

协议刻意比浏览器自动化 API 小。它不提供 `click(selector)`、`eval`、任意 HTTP 或通用工作流语言。若任务无法由已声明业务能力表达，应交给显式人工流程，而不是增加逃逸口。

参见 [构建外部 Agent 客户端](/zh/surface/build-an-external-agent-client)与 [参考：Surface 协议](/zh/reference/surface-protocol)。
