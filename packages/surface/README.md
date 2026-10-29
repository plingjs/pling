# @plingjs/surface

**Pling Agent Surface**：把页面已经声明的能力开放给外部 Agent 的协议内核。

它不启动浏览器、不解析 DOM、不调用模型，也不复制权限逻辑。它只做一件事：
把现有 `Registry` 投影成一份稳定的能力描述，并让外部调用经过现有 `executor`。

> 当前版本是协议内核：`describe` + `invoke`，并已支持**已验证会话的作用域、过期与撤销**、
> **按会话限流**、**invoke 防重放**、**元数据审计**与**审批审计关联**。身份验证、委托凭证
> 签发与传输仍由宿主实现。
> 审批回执只提供传输无关的 `SurfaceApprovalBinding` / `SurfaceApprovalChallenge` 类型；
> token、Cookie、后端签发与消费都由宿主实现（参考案例 044）。

## 安装

```bash
pnpm add @plingjs/surface @plingjs/core
```

## 最小用法

```ts
import { createExecutor, createPolicy } from "@plingjs/core";
import { createSurface, SURFACE_PROTOCOL } from "@plingjs/surface";

const executor = createExecutor({ registry, policy: createPolicy(confirm) });
const surface = createSurface({
  registry,
  execute: (id, args) => executor.execute(id, args),
  app: "todo",
  expose: ["todo.list", "todo.add"], // 接第三方时显式收敛；省略 = 当前全部能力
});

const description = surface.describe();
// { protocol: "pling.surface/0.1", capabilities: [...], context: {...} }

const response = await surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "req-1",
  method: "invoke",
  capability: "todo.add",
  input: { text: "买牛奶" },
});
```

## 受保护会话

生产接入时，传输层先验证 Cookie / JWT / 委托凭证，再把**验证后的身份**交给
Surface。内核不解析凭证，也不把凭证放进响应：

```ts
// verifiedSession 由传输层 / 后端构造，例如：
const verifiedSession = {
  agentId: "codex",
  sessionId: "delegation-7f3a",
  userId: "user-42",
  expiresAt: Date.now() + 10 * 60_000,
  scope: ["orders.search", "orders.open"], // 本次委托上限
  delegationId: "audit-123",
};

const surface = createSurface({
  registry,
  execute: (id, args) => executor.execute(id, args),
  expose: ["orders.search", "orders.open", "approve@order"], // 站点上限
  session: () => verifiedSession, // 每次调用重新读取，可处理过期 / 撤销
});
```

- `describe` 与 `invoke` 都使用 `expose ∩ session.scope`；`scope` 必须显式给出。
- 数组 scope 可写精确 id，也可写折叠模板（如 `approve@order`）来允许这一族行内动作。
- 会话缺失 / 非法 / 过期 / 撤销时 fail-closed；不会调用 executor。
- 会话作用域或有效期变化会重置增量能力缓存；授权状态变化时推荐直接换 `sessionId`。
- `describe()` 直接调用遇到无效会话会抛 `SurfaceSessionError`；生产传输统一走 `handle()`。

## 限流、防重放与审计

三个能力都是可选配置，默认不影响现有接入：

```ts
const surface = createSurface({
  registry,
  execute: (id, args) => executor.execute(id, args),
  expose: ["orders.search", "approve@order"],
  session: () => verifiedSession,

  // 每个已验证会话独立计数；所有 handle 请求都算
  rateLimit: { maxRequests: 60, windowMs: 60_000 },

  // 只防 invoke：同一会话同一个 request.id 只能执行一次
  replay: { windowMs: 5 * 60_000 },

  // 只落元数据，不含参数、响应正文、Cookie / token
  onAudit: (event) => auditLog.write(event),
  // 审计写入失败不能静默；这里接日志 / 指标 / 告警
  onAuditError: (error, event) => logger.error("surface audit failed", { error, event }),
});
```

- `RATE_LIMITED` 会带 `retryAfterMs`；限流按 `agentId + sessionId + userId` 隔离。
- 默认限流 / 防重放只在当前实例内生效。多副本可注入 `rateLimit.limiter` 与 `replay.guard`，
  共享 Redis 等存储；适配器异常返回 `RATE_LIMIT_UNAVAILABLE` / `REPLAY_GUARD_UNAVAILABLE`，
  在 executor 之前 fail-closed。
- 同会话重复 `request.id` 的 `invoke` 返回 `REPLAY_DETECTED`，不会调用 executor。
- 防重放不缓存旧响应：网络层要自动重试时，必须生成新的 `request.id`；旧 id 在窗口内一律拒绝。
- 不同会话可以使用相同 id；token 刷新但会话身份不变时，仍按同一会话防重放。
- 审计事件包含身份、能力 / record、结果、错误码与耗时，不含 input 参数；回调抛错不影响请求。
- `onAudit` 失败（同步抛错或 Promise reject）会交给 `onAuditError(error, event)`；这个回调自身失败
  也不会外溢。生产环境应提供它并接告警，否则审计可能静默丢失。

### 审批证据

高风险动作需要把“哪一次真人审批允许了它”写进审计，但不能把审批凭证交给 Agent：

```ts
const surface = createSurface({
  registry,
  execute: async (id, argsJson, context) => {
    const result = await executor.execute(id, argsJson);
    // context = { requestId, capability, record?, session }
    const approvalId = await approvals.findConsumedId(context);
    return approvalId ? { ...result, approval: { id: approvalId } } : result;
  },
  onAudit: (event) => auditLog.write(event), // event.approvalId 只在这里出现
});
```

- `SurfaceExecutionContext` 给宿主提供 `requestId / capability / record / session`，用于按完整绑定查审批；
- `SurfaceExecutionResult.approval.id` 只能是 challenge / receipt 的公开关联 id，不能是 token 或 hash；
- Surface 把 `approvalId` 写进 `SurfaceAuditEvent` 后，会在协议响应返回前剥离 `approval` 字段；
- 审批关联查询失败属于审计增强失败，不是业务失败；应上报错误，并让高风险审计的 `approval_id = null`
  进入告警 / 复核。

完整处理顺序见 [审批、审计与撤销](https://plingjs.dev/zh/recipes/approval-audit-and-revocation-for-agent-actions)。

`describe` 默认只回 8 条带字段记录，`recordIds` 仍覆盖完整活跃列表；长列表用
`offset / limit` 翻页或 `record` 精读。重复读取可传 `{ capabilities: "changed" }`，
能力形状未变时不会重复发送整份清单。成功 `invoke` 可带 `after` 增量；先看
`changed / after`，不要为确认同一步反复 `describe`。

## 边界

- **没有通用 click / eval**：只能调用 `describe().capabilities` 中的 id。
- **没有第二套权限**：`invoke` 必须走现有 executor；确认、人工接力、期望、变更证据都照旧。
- **没有原始 DOM / Cookie**：外部只能拿到能力、上下文与执行回执。
- **没有静默失败**：未知版本、未知方法、未暴露能力、非法输入全部 fail-closed。
- **没有凭证穿透**：会话 token / Cookie 不进入协议；Surface 只接收验证后的身份与 scope。
- **没有隐式重放窗口**：`request.id` 的去重与窗口必须显式开启；业务重试要换新 id。
- **没有传输绑定**：postMessage、MCP、浏览器扩展都应复用这一层，而不是各自重写语义。

## 协议

```text
describe  → 页面身份 + 能力清单 + 有界上下文
invoke    → 执行一个已暴露的能力
```

`attach`、`observe`、`handoff` 与 `detach` 不属于 0.1：实现必须把它们视为未知方法并拒绝。

## 审批回执类型

外部写操作的确认不应该只停在页面本地布尔值。`SurfaceApprovalBinding` 定义一份可交给
审批后端签发 → 校验 → 消费一次的回执绑定：

```ts
interface SurfaceApprovalBinding {
  challengeId: string;
  requestId: string;
  capability: string;
  record: string | null;
  argsHash: string;
  userId: string;
  agentId: string;
  sessionId: string;
  expiresAt: number;
}
```

`SurfaceApprovalChallenge` 再加展示用的 `description`、wire-safe `args` 和
`canApproveFromAgent: false`。推荐由后端签发 challenge：页面只提交草稿，后端生成
challengeId / challengeToken、保存绑定并限制 TTL；grant / consume 不再接受页面重新提交绑定。
**challengeToken 与 receipt token 都不属于协议类型**，不能进入 Surface 响应或 Agent 上下文。
参考实现演示了后端签发、opaque token、token hash 存储和一次性消费。

协议总纲与安全模型见 [Surface 协议](https://plingjs.dev/zh/reference/surface-protocol)。
