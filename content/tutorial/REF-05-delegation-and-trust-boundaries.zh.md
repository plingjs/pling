---
id: REF-05
title: "委托与信任边界"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 委托与信任边界

`@plingjs/delegation` 是为外部 Agent 提供短时权限的可选前后端集成包。它定义凭证生命周期、参考适配器与一致性检查，不拥有应用登录、租户策略、数据库事务、Redis、审计归档或最终业务授权。

当外部 Agent 需要代表已登录用户操作，又不能拿到用户的 Cookie 或会话令牌时，才需要委托凭证。Agent 只在页面内运行并复用页面现有运行时，不需要额外签发委托凭证。

## 生命周期

```text
已登录用户
      │
      ├─ POST /delegation/issue ──▶ plg_dlg_… token（只返回一次）
      │                              存储只保留 SHA-256 哈希
      │
      ├─ POST /delegation/introspect ──▶ 公开凭证视图
      │                                  toSurfaceSession() ──▶ SurfaceSession
      │
      ├─ POST /delegation/refresh ──▶ 新 token，旧 token 失效
      └─ POST /delegation/revoke  ──▶ 已撤销视图
                                         │
                                         └─ 事件总线 / SSE ──▶ 页面立即失效本地会话
```

token 是 bearer 权限。它不得进入 Surface 响应、Agent 提示词、浏览器遥测或事件正文。安全视图只包含标识、范围、签发时间、过期时间与撤销时间。

## 端点

Web `Request → Response` handler 默认使用 `/delegation` 基础路径。

| 方法与路径 | 用途 |
| --- | --- |
| `GET /delegation/health` | 实例健康检查 |
| `GET /delegation/session` | 解析当前登录用户 |
| `GET /delegation/events` | SSE 失效通知 |
| `POST /delegation/issue` | 在用户同意后签发凭证 |
| `POST /delegation/introspect` | 校验 bearer token 并返回安全视图 |
| `POST /delegation/refresh` | 轮换有效凭证并使旧凭证失效 |
| `POST /delegation/revoke` | 撤销凭证 |

`createDelegationHandler({ store, events, identity, basePath?, instanceId?, now?, heartbeatMs?, maxBodyBytes? })` 返回带 `handle(request)` 的对象。SSE 心跳默认 15 秒，设为 `0` 可关闭；JSON 请求体默认上限 32 KB。

`createDelegationClient({ baseUrl?, fetch?, credentials?, eventSource? })` 默认使用同源 `/delegation`。方法包括 `ensureSession()`、`issue()`、`introspect()`、`refresh()`、`revoke()` 与 `openEvents()`。

## 端口

### 身份

`DelegationIdentity.resolve({ request, setCookie })` 返回已登录的 `{ userId, expiresAt }` 或 `null`。生产实现读取真实 Cookie、JWT、SSO 会话或身份代理，不得接受 JSON 请求体传入的用户 id。

### 存储

`DelegationStore` 有四个操作：

| 操作 | 要求 |
| --- | --- |
| `issue` | 生成 token，只持久化哈希与绑定，并只返回一次 token |
| `introspect` | 校验 token、用户绑定、过期、轮换与撤销 |
| `refresh` | 原子轮换；旧凭证必须立即停止工作 |
| `revoke` | 持久化撤销并返回安全视图 |

最小绑定包括用户、Agent、会话、范围、签发时间、过期与撤销状态。持久化前，scope 必须去重并保持首次出现顺序。

内置内存存储只是本地参考，不是生产数据库。生产适配器应把状态变更与 outbox 行写入同一事务。

### 事件

`DelegationEventBus` 提供 `subscribe(userId, listener)`、`publish(event)` 与 `close()`。事件只包含：

```ts
{
  type: "credential_revoked",
  reason: "revoked" | "rotated",
  at: number,
  credentialId: string,
  delegationId: string,
  sessionId: string,
  userId: string,
  agentId: string,
  replacedBy?: string
}
```

SSE 是提前通知，不是事实来源。每个受保护操作仍应在服务端 introspect 或执行等价校验。通知丢失可能延迟本地清理，但不得保留执行权限。

## 安全视图与 Surface 转换

```ts
import { createDelegationClient, toSurfaceSession } from "@plingjs/delegation";

const client = createDelegationClient({ baseUrl: "/delegation" });
const view = await client.introspect(token);
const session = toSurfaceSession(view);
```

`toSurfaceSession()` 复制 `agentId`、`sessionId`、`userId`、`expiresAt`、`scope`、`delegationId` 与存在时的 `revokedAt`。安全视图本就没有 token，因此转换结果也不会带 token。

得到的 `SurfaceSession.scope` 仍会与 Surface 站点白名单取交集。委托凭证不能扩大应用主动开放的能力。

## 错误与状态码

| HTTP | 错误码 | 含义 |
| --- | --- | --- |
| `400` | `DELEGATION_INVALID_REQUEST` | 请求或输入格式错误 |
| `401` | `DELEGATION_INVALID_CREDENTIAL` | token 缺失、伪造或不可用 |
| `403` | `DELEGATION_BINDING_MISMATCH` | token 不属于当前用户或会话 |
| `404` | `DELEGATION_NOT_FOUND` | 未知端点 |
| `409` | `DELEGATION_REVOKED` | 凭证已撤销或已轮换 |
| `410` | `DELEGATION_EXPIRED` | 凭证已过期 |
| `500` | `DELEGATION_INTERNAL_ERROR` | 后端失败且不泄露内部细节 |

浏览器客户端会在 `DelegationClientError` 中保留后端错误码与 HTTP 状态。不要将 `DELEGATION_EXPIRED` 或 `DELEGATION_REVOKED` 转成让 Agent 重试的提示；必须由用户重新授权。

## 一致性检查

发布生产适配器前，先运行参考生命周期检查：

```ts
import {
  assertDelegationEventBusConformance,
  assertDelegationStoreConformance,
} from "@plingjs/delegation/testing";

await assertDelegationStoreConformance(productionStore, {
  userIdPrefix: `conformance-${process.env.CI_RUN_ID}`,
});
await assertDelegationEventBusConformance(productionEvents);
```

存储套件检查 token 脱敏、范围归一化、轮换、绑定、撤销、过期与稳定错误码。请使用一次性命名空间或测试数据库。套件会创建凭证，并刻意不提供可能掩盖生命周期缺陷的清理 API。

事件总线套件检查按用户隔离、字段白名单、退订、畸形事件过滤与订阅者故障隔离。进程内总线不能证明 Redis、NATS 或 outbox 投递；那一层需要单独测试。

## 边界清单

- token 只由 `issue` 与 `refresh` 返回；
- 存储只保留哈希，不保存明文 token；
- 用户 id 只来自已验证身份；
- scope 显式给出，且不能超过 Surface 白名单；
- 撤销无需等待 SSE 即生效；
- 轮换后旧 token 失效；
- 日志与指标只使用凭证 id，不使用 bearer 值；
- 页面把缺失租约或失败的 introspect 视为没有权限。

参考实现覆盖委托凭证、撤销、多实例失效、包集成、生产端口与带登录的 Todo 流程。它们是示例，不是生产身份服务。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/delegation` `0.1.0-alpha.2` |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器；服务端需 Node.js 20 或更高版本 |
| Peer 依赖 | 无；存储、事件总线和身份适配器由应用提供 |
| 稳定性 | 1.0 之前的 alpha；次版本可能改变 API |

兼容性同时取决于本包与端口背后的实现。一致性套件描述当前版本期望的行为，不构成对某个部署的存储、投递或身份提供方的认证。
