---
id: RCP-11
title: "经用户同意的委托访问"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 经用户同意的委托访问

委托不是“把登录 Cookie 借给 Agent”。它是用户对某个 Agent、某个会话、某项能力范围和时间窗口的明确授权。凭证可以撤销，不能进入模型上下文，也不能代替后端授权。

## 可运行页面

下面的页面用本地账号签发一份短期委托。用户可以选 Agent、范围和有效期；撤销后，下一次调用必须在业务函数之前失败。

<DemoPlayground id="recipe-delegation" />

从仓库根目录运行：

```bash
pnpm dev:examples
```

打开 `http://localhost:5191/demos/recipe-delegation/?lang=zh`，使用 `demo@example.com` / `pling-demo` 登录。页面源码在 `examples/demos/recipe-delegation/`；委托签发、内省与撤销后端在 `examples/recipe-backends/access-service/`，路由与安全边界见其 `README.md`。

## 角色与流程

```text
用户登录应用
  │ 明确选择 Agent 与能力范围
  ▼
应用后端签发短期委托 token
  │ 只在签发响应中出现一次
  ▼
浏览器 / 宿主内省得到安全视图
  │ toSurfaceSession() 去掉 token
  ▼
Surface 校验会话与能力交集
  │
  └─ 用户撤销 → 事件通知 + 下次调用 fail-closed
```

`@plingjs/delegation` 提供凭证契约、内存适配器、浏览器客户端与 Web 标准 HTTP/SSE handler。应用仍需实现身份、数据库、消息广播、租户和业务授权。

## 服务端端口

| Port | 职责 |
| --- | --- |
| `DelegationIdentity` | 从真实 Cookie / JWT / SSO 解析当前用户 |
| `DelegationStore` | 持久化 token 哈希、scope、过期、撤销与轮换 |
| `DelegationEventBus` | 按用户广播撤销 / 轮换事件 |

参考 HTTP 端点：

```text
GET  /delegation/session
POST /delegation/issue
POST /delegation/introspect
POST /delegation/refresh
POST /delegation/revoke
GET  /delegation/events
```

`issue` 与 `refresh` 是唯一返回原始 token 的路径。`introspect` 返回不含 token 的安全视图。数据库和广播实现必须由部署方替换内存或文件适配器。

## 浏览器流程

```ts
const client = createDelegationClient({ baseUrl: "/delegation" });
const credential = await client.issue({
  agentId: "codex",
  scope: ["tasks.read", "tasks.add", "tasks.complete@task"],
  ttlMs: 15 * 60_000,
});

// 只把一次性 token 交给受信任的 Agent 连接建立流程。
await handTokenToAgentTransport(credential.token);

// Surface 只接收已验证、无 token 的会话视图。
const session = toSurfaceSession(credential);
```

在实际使用中，token 的交付通常发生在用户明确开启外部访问和完成配对之后。不要让模型生成 `agentId`、`userId` 或 scope。

## 同意界面必须说明

- 哪个 Agent 请求访问；
- 允许哪些能力，而不是只有“读写”这种模糊级别；
- 有效期与是否可续期；
- 哪些动作需要再次确认；
- 如何立即撤销；
- 当前账户与租户。

用户拒绝、关闭窗口或未完成配对时，不得默认授权。

## 验收标准

1. token 只在签发 / 轮换响应中出现一次，之后只存哈希。
2. 安全视图、SSE 事件、日志与模型上下文都不含 token。
3. scope 去重并保持顺序；非法或空 scope 被拒绝。
4. 过期、撤销、用户不匹配、Agent 不匹配都 fail-closed。
5. 页面收到的撤销事件只含允许字段；事件漏发时，内省仍必须拒绝旧 token。
6. 同一 token 不能跨用户、跨租户或跨页面会话使用。
7. 续期生成新凭证或新会话 id，旧描述不能继续授权。

## 错误处理

| 错误码 | 含义 | 行为 |
| --- | --- | --- |
| `DELEGATION_INVALID_CREDENTIAL` | token 缺失、伪造或格式错误 | 重新配对 |
| `DELEGATION_BINDING_MISMATCH` | 用户、Agent 或会话不匹配 | 停止，不跨账户重试 |
| `DELEGATION_REVOKED` | 已撤销或轮换 | 清理本地会话 |
| `DELEGATION_EXPIRED` | 已过期 | 重新取得用户同意 |
| `DELEGATION_INTERNAL_ERROR` | 后端故障 | 失败关闭并告警 |

## 参考案例

本方案的后端同时实现签发、内省、调用与撤销，页面只负责收集用户同意并显示有界状态。它演示完整生命周期，但内存存储不是生产数据库，示例账号也不是企业 SSO。生产上线前应使用 `@plingjs/delegation/testing` 对真实 store 与 event bus 运行一致性检查，并单独测试跨副本投递。

## 本地验证

签发一份只含 `invoice.list` 的两分钟委托，先调用成功，再撤销并重复调用。第二次请求应返回撤销错误且没有读取发票数据；切换到 `report.export` 等未授权范围也应失败。
