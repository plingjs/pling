---
id: REF-04
title: "Surface 协议"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# Surface 协议

`@plingjs/surface` 实现 `pling.surface/0.1` 与传输无关的协议边界。它把已有的动作注册表投影成能力，再把外部调用交回应用现有的执行器。它不负责身份验证、传输选择、DOM 点击，也不维护第二套权限系统。

规范语义见[范围与术语](/zh/spec/0.1/scope-and-terminology)至[消息与包络](/zh/spec/0.1/messages-and-envelopes)。本页只记录参考实现实际导出的接口、默认值与边界。

## 公开入口

```ts
import {
  SURFACE_PROTOCOL,
  SurfaceSessionError,
  createSurface,
  type AgentSurface,
  type SurfaceOptions,
} from "@plingjs/surface";
```

| 导出 | 类型 | 含义 |
| --- | --- | --- |
| `SURFACE_PROTOCOL` | 常量 | `"pling.surface/0.1"` |
| `createSurface(options)` | 函数 | 创建协议投影 |
| `AgentSurface` | 接口 | `describe(input?)` 与 `handle(request)` |
| `SurfaceSessionError` | 类 | 直接调用 `describe()` 时的会话失败 |
| `DEFAULT_SURFACE_RECORD_LIMIT` | 常量 | 默认每次描述返回 `8` 条记录 |
| `MAX_SURFACE_RECORD_LIMIT` | 常量 | 每次描述最多 `100` 条记录 |

`SurfaceMethod` 只有 `"describe"` 和 `"invoke"`。`attach`、`observe`、`handoff`、`detach` 不属于 0.1，不能从本包推断它们已经存在。

## `createSurface(options)`

`registry` 与 `execute` 必填。其余选项用于收窄暴露范围、绑定身份或补充运行证据。

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `registry` | `Registry` | 必填 | 与页面内 Agent 共用的注册表 |
| `execute` | `(id, argsJson?, context?) => Promise<ExecResult>` | 必填 | 必须调用现有执行器；Surface 不重复实现确认、可用性或期望 |
| `app` | `string` | 省略 | 写入描述的应用标识 |
| `expose` | `readonly string[] \| (id) => boolean` | 当前全部能力 | 站点级上限；数组项可写 `approve@order` 这类折叠模板 |
| `session` | `SurfaceSession \| () => SurfaceSession \| null` | 开放模式 | 需要处理过期与撤销时应传 getter；开放模式只适合本地调试 |
| `recordLimit` | `number` | `8` | `describe` 的默认记录窗口 |
| `maxRecordLimit` | `number` | `100` | 调用方 `limit` 的上限 |
| `rateLimit` | `{ maxRequests, windowMs, limiter? }` | 关闭 | 作用于 `handle()`，按已验证会话隔离 |
| `replay` | `boolean \| { windowMs?, guard? }` | 关闭 | 作用于 `invoke`；启用默认守卫窗口为五分钟 |
| `onAudit` | `(event) => void \| Promise<void>` | 省略 | 只含元数据，不含参数、响应正文、Cookie 或 token |
| `onAuditError` | `(error, event) => void \| Promise<void>` | 省略 | 审计写入失败的通知口；生产环境应据此告警 |

### 会话边界

`SurfaceSession` 包含 `agentId`、`sessionId`、`userId`、`expiresAt`、显式的 `scope`、可选 `delegationId` 与 `revokedAt`。这些值必须在传输层或后端验证后构造。浏览器请求体不能直接充当会话。

暴露范围是 `expose` 与 `session.scope` 的交集。省略 `session.scope` 不合法。会话 getter 在每次 `describe` 或 `handle` 时重新求值，因此过期和撤销无需重启页面即可生效。

配置会话后，直接调用 `surface.describe()` 会在会话无效时抛出 `SurfaceSessionError`；`surface.handle()` 会把同一情况转换成协议失败。生产传输应调用 `handle()` 并返回结构化响应。

### 限流与防重放

内置限流器是实例内滑动窗口。多副本部署要提供共享的 `SurfaceRateLimiter`。适配器抛错或返回非法决策时，Surface 以 `RATE_LIMIT_UNAVAILABLE` fail-closed，不能把 `undefined` 或异常当成放行。

防重放在执行前占用 `(session, request.id)`。窗口内重复的 `invoke` 返回 `REPLAY_DETECTED`，执行器不会被调用。守卫不缓存上一次响应。传输层只有在确认前一次尝试未提交业务效果后，才应为同一次业务意图生成新 id。

## `describe(input?)`

输入可省略，字段之间有互斥关系：

| 字段 | 约束 | 效果 |
| --- | --- | --- |
| `record` | 一个 id 或 `1–20` 个 id | 只返回这些记录的字段 |
| `offset` | 非负整数 | 返回记录页的起点 |
| `limit` | 非负整数 | 页大小；会被裁剪到 `maxRecordLimit` |
| `capabilities` | `"full"` 或 `"changed"` | `"changed"` 在能力签名未变时可返回空数组 |

`record` 不能与 `offset` 或 `limit` 同时使用。未知字段会使请求无效。能力清单可以保持完整，而记录字段按窗口读取；`context.recordIds` 仍包含活跃区域内全部可引用记录。

返回的 `SurfaceDescription` 形态如下：

```json
{
  "protocol": "pling.surface/0.1",
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
```

能力是稳定的传输对象，不是内部动作视图。每项能力可以包含 `id`、`description`、`inputSchema`、`effect`、`approval`、`fidelity`、`source`、`scopePath`、`handoff`、`flowSteps`、`offscreen` 与记录模板元数据。

## `handle(request)`

`handle()` 接受 `unknown`，对格式错误的输入不会抛异常，只返回以下三类响应之一：

```ts
type SurfaceResponse =
  | { ok: true; id: string; protocol: "pling.surface/0.1"; result: SurfaceDescription }
  | { ok: true; id: string; protocol: "pling.surface/0.1"; result: ExecResult; after?: SurfaceObservation }
  | { ok: false; id: string; protocol: "pling.surface/0.1"; error: { code; message; retryAfterMs? } };
```

`invoke` 请求包含 `protocol`、`id`、`method: "invoke"`、`capability` 与可选的、必须为对象的 `input`。对于会产生副作用的意图，id 必须唯一；同一次请求的传输重试应沿用原 id。

业务拒绝仍是 `ok: true` 的协议响应，结构化错误位于 `result`。`ok: false` 表示协议层未能安全地得到业务结果。

### 协议失败

| 错误码 | 常见原因 |
| --- | --- |
| `INVALID_REQUEST` | 缺少字段、JSON 形态错误、`describe` 未知字段或非法范围 |
| `PROTOCOL_VERSION_UNSUPPORTED` | 版本不是 `pling.surface/0.1` |
| `METHOD_NOT_SUPPORTED` | 方法不是 `describe` 或 `invoke` |
| `CAPABILITY_NOT_EXPOSED` | id 不在站点上限或会话范围内 |
| `RATE_LIMITED` | 会话超过窗口，检查 `retryAfterMs` |
| `RATE_LIMIT_UNAVAILABLE` | 共享限流器失败或返回非法决策 |
| `REPLAY_DETECTED` | 同一会话在窗口内复用了 invoke id |
| `REPLAY_GUARD_UNAVAILABLE` | 共享防重放守卫失败或返回非法决策 |
| `SESSION_REQUIRED`、`SESSION_INVALID`、`SESSION_EXPIRED`、`SESSION_REVOKED` | 会话缺失或已不可用 |
| `INTERNAL_ERROR` | 业务结果路径之外的意外失败 |

## 最小服务端组合

```ts
import { createExecutor, createPolicy } from "@plingjs/core";
import { createSurface, SURFACE_PROTOCOL } from "@plingjs/surface";

const executor = createExecutor({ registry, policy: createPolicy(confirm) });

const surface = createSurface({
  registry,
  execute: (id, args) => executor.execute(id, args),
  app: "orders",
  expose: ["orders.search", "orders.update_note@order"],
  session: () => verifiedSession,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  replay: { windowMs: 5 * 60_000 },
  onAudit: (event) => audit.write(event),
  onAuditError: (error, event) => logger.error({ error, event }, "surface audit failed"),
});

const response = await surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "req-01",
  method: "invoke",
  capability: "orders.update_note@order",
  input: { record: "SO-1002", note: "客户要求周五前回电" },
});
```

包住这次调用的适配器仍负责身份验证、HTTP、SSE、CORS、请求体上限与响应脱敏。`surface.plingjs.dev` 是演示端点，不是面向客户应用的共享代理。

## 刻意不提供

- 任意选择器点击、脚本执行、原始 DOM 读取或任意 HTTP 原语；
- 在 Surface 内解析浏览器凭证；
- 取代业务后端的授权；
- 超出上述 JSON 对象的强制传输分帧；
- 公开的第三方 Surface 认证套件。已有的适配器一致性工具列在 [Surface 一致性与互操作](/zh/reference/surface-conformance-and-interoperability)。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/surface` `0.1.0-alpha.2` |
| 协议 | `pling.surface/0.1`（Draft） |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器；Node 侧使用需 Node.js 20 或更高版本 |
| Peer 依赖 | 无 |
| 稳定性 | 1.0 之前的 alpha；包版本与协议版本独立演进 |

包版本与协议版本是两件事。`0.1.x` 的包发布不会自动让 `pling.surface/0.1` 成为稳定标准；本参考也不承诺兼容未列出的协议版本。
