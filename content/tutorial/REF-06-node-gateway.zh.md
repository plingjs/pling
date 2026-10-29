---
id: REF-06
title: "Node 网关"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# Node 网关

`@plingjs/server` 是一层很薄的 OpenAI 兼容网关。它用服务端持有的凭证把浏览器请求转发到固定上游，执行鉴权与有界请求处理，再把响应返回。它不运行 Agent 循环、不读取页面、不保存会话记忆，也不实现租户计费。

这层分离很重要：浏览器仍决定调用哪个已声明能力，服务端只拥有模型凭证与出站请求边界。

## 最小服务端

```ts
import { createPlingGateway, toNodeHandler } from "@plingjs/server";
import { createServer } from "node:http";

const gateway = createPlingGateway({
  upstream: {
    baseUrl: process.env.PLING_UPSTREAM_BASE_URL!,
    apiKey: process.env.PLING_UPSTREAM_API_KEY!,
  },
  model: "deepseek-chat",
  authorize: async ({ headers }) => {
    const user = await verifySession(headers.get("cookie"));
    return user ? { ok: true, user } : false;
  },
  onAudit: (event) => audit.write(event),
});

createServer(toNodeHandler(gateway)).listen(5192);
```

浏览器侧只配置同源路径，不含服务商密钥：

```ts
createPling({
  agent: {
    config: { baseUrl: "/api/llm/v1", model: "deepseek-chat", apiKey: "" },
  },
});
```

## 选项

| 选项 | 类型 | 默认值 | 行为 |
| --- | --- | --- | --- |
| `upstream` | `string \| { baseUrl, apiKey?, headers? }` | 必填 | 网关唯一可访问的目标 |
| `model` | `string` | 客户端值 | 强制上游模型 |
| `allowedModels` | `readonly string[]` | 省略 | 最终模型不在名单中则拒绝 |
| `authorize` | `(ctx) => boolean \| decision` | 省略 | 接收 `Request`、`Headers` 与路径 |
| `allowAnonymous` | `boolean` | `false` | 只有本地演示才应显式打开 |
| `onAudit` | `(event) => void \| Promise<void>` | 省略 | 元数据审计；回调失败不影响请求 |
| `fetch` | `typeof fetch` | 全局 `fetch` | 测试或自定义传输的注入点 |
| `timeoutMs` | `number` | `60_000` | 等待上游响应头；`0` 关闭 |
| `retry` | `false \| { maxRetries?, baseDelayMs?, maxDelayMs? }` | `maxRetries: 2` | 在向浏览器发送正文前有界重试 |
| `maxBodyBytes` | `number` | `1_000_000` | 请求体上限 |

`createPlingGateway()` 返回 `{ handle(request: Request): Promise<Response> }`。`toNodeHandler(gateway)` 把它接到 `node:http`；Bun、Deno、Serverless 与现有框架可以直接调用 `handle()`。

## 路由契约

- 模型请求路径必须以 `/chat/completions` 结尾；
- 模型调用只接受 `POST`；
- `GET .../health` 返回 `{ "ok": true, "service": "pling-gateway" }`；
- 路径前缀不固定，`/api/llm/v1/chat/completions` 与 `/internal/llm/v1/chat/completions` 都可使用；
- 上游地址在创建时固定，浏览器不能传入新的上游 URL。

## 鉴权与凭证

既没有 `authorize`，也没有显式 `allowAnonymous: true` 时，模型调用以 HTTP `503` 和 `GATEWAY_MISCONFIGURED` fail-closed。忘记配置策略不能变成公开访问。

`authorize` 可以返回：

```ts
true
// 或
{ ok: true, user?: unknown, headers?: Record<string, string> }
// 或
{ ok: false, status?: number, message?: string }
```

返回的 `headers` 会附加到上游请求。追踪头或短时服务商断言应只通过这里传递。浏览器 Cookie 不会被自动转发。

服务商密钥只从服务端配置读取并发送给上游，绝不能出现在响应、审计事件、浏览器包或错误消息中。

## 请求体、超时与重试

请求体上限在解析前和上游调用前执行。超过上限返回 `413 PAYLOAD_TOO_LARGE`。

超时覆盖等待上游响应头，不覆盖整个流式生成过程。超时后返回 `504 UPSTREAM_TIMEOUT`。

重试只在尚未向浏览器发送任何正文时发生，覆盖：

- HTTP `408`、`425`、`429` 与 `5xx`；
- 网络失败；
- 等待响应头超时。

`400`、`401`、`403` 等非瞬时状态不重试。`maxRetries` 不含首次请求，默认 `2`，最多 `5`。退避使用带抖动的有界指数增长；上游 `Retry-After` 会被尊重，但仍受 `maxDelayMs` 限制。

流式请求一旦开始向浏览器透传，网关不再重放。部分生成结果不能安全重试，否则会重复内容并扭曲用量统计。

浏览器侧 Agent 链也有重试逻辑。两层预算都应显式设置。如果只希望一层重试，可在网关设 `retry: false`，或把浏览器侧预算设为零。

## 错误形态

网关错误统一为：

```json
{
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "上游超时（已尝试 3 次）",
    "requestId": "…",
    "retryable": true,
    "attempts": 3,
    "retryExhausted": true
  }
}
```

`retryable` 描述最终故障类别。`retryExhausted` 表示网关已经用完自己的预算；客户端不得为同一请求再启动自动重试循环。

| HTTP | 错误码 | 含义 |
| --- | --- | --- |
| `400` | `INVALID_JSON` / `INVALID_BODY` | 请求体无效 |
| `400` | `MODEL_REQUIRED` / `MODEL_NOT_ALLOWED` | 缺少模型或模型不在名单中 |
| `401` / `403` | `UNAUTHORIZED` | 应用鉴权失败 |
| `404` | `NOT_FOUND` | 路径不以 `/chat/completions` 结尾 |
| `405` | `METHOD_NOT_ALLOWED` | 模型请求不是 POST |
| `413` | `PAYLOAD_TOO_LARGE` | 请求体超过上限 |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | 请求体不是 JSON |
| `499` | `CLIENT_ABORTED` | 客户端断开 |
| `502` | `UPSTREAM_UNAVAILABLE` / `UPSTREAM_ERROR` | 上游网络失败或返回非 2xx |
| `503` | `GATEWAY_MISCONFIGURED` | 未配置鉴权 |
| `503` | `UPSTREAM_RATE_LIMITED` | 上游 `429` 且重试耗尽 |
| `504` | `UPSTREAM_TIMEOUT` | 上游超时 |

## 审计

`GatewayAuditEvent` 包含请求 id、时间、方法、路径、模型、流式标记、最终状态、可选上游状态、尝试次数、耗时、字节数、可选已授权用户与最终错误元数据。它刻意不包含提示词、回复正文、Cookie 或服务商密钥。

审计出口失败不改变模型响应。生产环境仍应把审计失败送入日志或告警；静默消失的回调不构成审计链。

## 上线检查

- 在网关之前或同一受信任边界内终止 TLS；
- 显式设置鉴权策略，不能依赖“应该有人配过”；
- 固定服务商地址，尽可能固定模型；
- 把请求体与超时限制设得低于平台自身限制；
- 公开服务应在网关前增加按用户限流；
- 把审计事件写入受访问控制与保留策略保护的持久存储；
- 不要从同一 handler 暴露管理、计费或任意代理路径；
- 上线前测试流式取消与一次重试耗尽路径。

网关不是策略引擎、密钥保险库、成本核算服务或提示词防火墙。这些控制属于外围后端，且必须独立于模型是否配合。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/server` `0.1.0-alpha.2` |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | Node.js 20 或更高版本 |
| Peer 依赖 | 无 |
| 稳定性 | 1.0 之前的 alpha；次版本可能改变 API |

兼容边界是 Node.js 运行时与本页给出的 HTTP 契约。具体服务商的请求与响应行为仍由服务商约定；本包不依赖任何 UI 框架。
