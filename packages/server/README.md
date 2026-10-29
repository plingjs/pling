# @plingjs/server

Pling 的**薄 Node 层**：OpenAI 兼容代理 + 服务端密钥 + 鉴权钩子 + 审计。

它**不搬 agent 循环**，也不接触 DOM。浏览器仍然负责「看快照 → 选动作 → 执行」，
这一层只负责把模型请求安全地送出去。

## 最小用法

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
  onAudit: (event) => auditLog.write(event),
});

createServer(toNodeHandler(gateway)).listen(5192);
```

浏览器侧只写路径：

```ts
createPling({
  agent: {
    config: { baseUrl: "/api/llm/v1", model: "deepseek-chat", apiKey: "" },
  },
});
```

## 它保证什么

| 约束 | 行为 |
| --- | --- |
| 密钥 | 只从服务端配置读取，只发给上游；响应里不会出现 |
| 鉴权 | 没配 `authorize` 且没显式 `allowAnonymous: true` → **503 fail-closed** |
| 上游目标 | 只能在创建时配置；客户端无法改 URL（防 SSRF） |
| 请求体 | 默认上限 1MB；超限 413，不调用上游 |
| 超时 | 默认 60s；超时 504 |
| 瞬时故障 | 408 / 425 / 429 / 5xx、网络失败、响应头超时默认有界重试 2 次 |
| 模型 | 可固定 `model`，也可用 `allowedModels` 白名单 |
| 审计 | `onAudit` 只给元数据；默认不记录 prompt / 回复正文 |
| 流式 | `text/event-stream` 原样透传 |

## API

### `createPlingGateway(options)`

```ts
interface PlingGatewayOptions {
  upstream: string | { baseUrl: string; apiKey?: string; headers?: Record<string, string> };
  model?: string;
  allowedModels?: readonly string[];
  authorize?: (ctx: { request: Request; headers: Headers; path: string }) =>
    | boolean
    | { ok: true; user?: unknown; headers?: Record<string, string> }
    | { ok: false; status?: number; message?: string };
  allowAnonymous?: boolean;
  onAudit?: (event: GatewayAuditEvent) => void | Promise<void>;
  fetch?: typeof fetch;
  timeoutMs?: number;
  retry?: false | { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number };
  maxBodyBytes?: number;
}
```

返回 `{ handle(request: Request): Promise<Response> }`。

请求路径只需以 `/chat/completions` 结尾；因此可以挂在 `/api/llm/v1`、`/internal/llm/v1`
等任意前缀下。`GET .../health` 返回 `{ ok: true, service: "pling-gateway" }`。

### `toNodeHandler(gateway)`

`node:http` 适配器，返回 `(req, res) => Promise<void>`。
其他运行时（Bun / Deno / Serverless / 现有框架）可以直接调用 `gateway.handle()`。

## 瞬时故障重试

```ts
createPlingGateway({
  upstream,
  retry: { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 4_000 },
});
```

- 默认重试 2 次（最多 3 次上游请求）；`retry: false` 关闭；`maxRetries` 上限为 5。
- 只重试 408 / 425 / 429 / 5xx、网络失败和等待响应头超时；400 / 401 / 403 等不重试。
- 退避带 jitter，并受 `maxDelayMs` 约束；上游 `Retry-After` 也会被尊重，但同样不会突破上限。
- 流式请求只在上游响应头到达前重试。一旦开始向浏览器透传，网关不会再重放这次请求。
- 浏览器侧的 `createLlmChain` 也有一套重试。两层都有界；如果希望只保留一层预算，
  把其中一层显式设为 `0`，并在接入层只重试真正瞬时的故障。

## 审计事件

```ts
interface GatewayAuditEvent {
  requestId: string;
  at: string;
  method: string;
  path: string;
  model?: string;
  stream: boolean;
  status: number;
  upstreamStatus?: number;
  attempts?: number;
  durationMs: number;
  bytesIn: number;
  bytesOut?: number;
  user?: unknown;
  error?: string;
  retryable?: boolean;
  retryExhausted?: boolean;
}
```

`attempts` 是实际访问上游的次数；健康检查 / 鉴权失败时没有上游请求，因此缺省。
`retryable` 只在最终失败时出现；如果网关已经用完重试预算，还会带 `retryExhausted: true`。
审计不包含 prompt、回复正文或密钥。需要更细的审计时，在 `authorize` 里把用户信息带回，
再由 `onAudit` 落到你们自己的日志 / 审计系统。

## 错误码

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | `INVALID_JSON` / `INVALID_BODY` | 请求体不合法 |
| 400 | `MODEL_REQUIRED` / `MODEL_NOT_ALLOWED` | 模型缺失或不在白名单 |
| 401 / 403 | `UNAUTHORIZED` | 鉴权失败 |
| 404 | `NOT_FOUND` | 不是 `/chat/completions` |
| 405 | `METHOD_NOT_ALLOWED` | 非 POST |
| 413 | `PAYLOAD_TOO_LARGE` | 请求体超限 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 不是 JSON |
| 499 | `CLIENT_ABORTED` | 客户端取消 |
| 502 | `UPSTREAM_UNAVAILABLE` / `UPSTREAM_ERROR` | 上游网络失败 / 非 2xx |
| 503 | `GATEWAY_MISCONFIGURED` | 忘记配置鉴权 |
| 503 | `UPSTREAM_RATE_LIMITED` | 上游 429，且重试耗尽 |
| 504 | `UPSTREAM_TIMEOUT` | 上游超时 |

错误响应统一为：

```json
{
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "上游超时（504）（已尝试 3 次）",
    "requestId": "…",
    "retryable": true,
    "attempts": 3,
    "retryExhausted": true
  }
}
```

`retryable` 表示故障类型是否属于瞬时故障。`retryExhausted` 表示网关自己的重试预算已经用完；
`@plingjs/agent` 会据此把这次调用标记为不可重试，避免浏览器侧再放大一轮请求。

## 刻意不做

- 不在网关里跑 agent 循环；
- 不存会话记忆；
- 不做多租户密钥托管 / 计费 / 策略中心；
- 不把浏览器 cookie 自动转发给上游（需要时在 `authorize` 返回 headers）。

## 测试

```bash
pnpm --filter @plingjs/server test
```

见 [Node 模型网关](https://plingjs.dev/zh/reference/node-gateway) 与
[连接模型网关](https://plingjs.dev/zh/operations/connect-a-model-gateway)。
