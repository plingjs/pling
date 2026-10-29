---
id: OPS-03
title: 接入模型网关
locale: zh
source_locale: en
translation_status: reviewed
status: reviewed
---

# 接入模型网关

运行在浏览器里的 Agent 总要把模型请求发到某个地方。本地开发时，可以直接调用兼容 OpenAI 的服务商；进入生产后，这种做法却会暴露服务商密钥、受制于对方的 CORS 策略，也没有一个可靠的位置来执行身份、模型选择、成本和审计策略。

模型网关就是这些请求经过的服务端路径。它把上游凭证留在服务端，决定请求可以使用哪个模型，并记录运行元数据。它不接管 Agent 循环，也不接管页面运行时。

本指南使用 `@plingjs/server` 中的参考网关。同一套契约可以由现有后端实现；这个包只是契约的一份小型实现，不是必须引入的平台。

## 本文划出的边界

浏览器仍然负责页面观察、对话历史、模型回合、工具选择和执行结果。网关每次接收一条模型请求，再把服务商的响应交给浏览器。它看不到 DOM，不会选择页面动作，也不会执行能力。

这个区分同时关系到延迟和权限。把 Agent 循环搬进网关，会制造第二份页面状态和第二套执行路径；保护凭证并不需要付出这个代价。

“模型网关”也不是“Surface 网关”。两者面对的流量方向相反。

| 要回答的问题 | 模型网关 | Surface 网关 |
| --- | --- | --- |
| 谁在请求？ | 页面内的 Agent，使用模型 | 外部 Agent，使用委托会话 |
| 经过的是什么？ | 兼容 OpenAI 的模型请求 | 能力描述与调用 |
| 保护什么？ | 上游模型凭证与模型使用策略 | 页面能力、作用域、确认与审计 |
| 典型路由 | `/chat/completions` | Surface 的 `describe` 与 `invoke` |
| 不做什么 | 操作页面 | 不替外部 Agent 选择或支付模型 |

两者可以部署在同一个后端里，但它们是两个接口，也对应两组不同的信任判断。

## 生产拓扑

生产路径有三跳：

```text
浏览器
  │  POST /api/llm/v1/chat/completions   （没有上游密钥）
  ▼
应用源站 / 反向代理
  │  已鉴权、有限流的同源路由
  ▼
模型网关
  │  固定上游 + 服务端凭证
  ▼
兼容 OpenAI 的模型服务
```

浏览器使用相对地址，因此请求仍然留在应用自己的源上。反向代理或应用服务器验证用户会话，再把请求交给网关。网关选择上游模型服务并添加服务端凭证。模型服务最终看不到浏览器持有的服务商密钥，因为浏览器根本没有。

这个结构也避免了过宽的 CORS 例外。浏览器直接访问另一个模型域名，需要对方允许跨域，还要处理跨站 Cookie 是否可接受。同源路由省掉了这层额外暴露。

## 配置浏览器

浏览器只需要三个值：相对基础路径、模型别名和空的浏览器密钥。

```ts
const pling = createPling({
  agent: {
    config: {
      baseUrl: "/api/llm/v1",
      model: "app-chat",
      apiKey: "",
    },
  },
});
```

`createOpenAiLlm` 会补上 `/chat/completions`，所以这个例子会请求 `/api/llm/v1/chat/completions`。模型名必须是固定上游能够接受的名字。参考网关会原样转发它，不会维护别名映射表。

React 或原生 JS 适配器中的对应配置使用同样的值。适配器改变的是应用如何声明运行时，不改变模型请求的传输方式。

开发阶段仍可直接连接模型：

| 模式 | 浏览器 base URL | 浏览器密钥 | 适用场景 |
| --- | --- | --- | --- |
| 直连 | 服务商的绝对地址 | 短期开发密钥 | 本机开发或兼容性测试 |
| 网关 | 同源相对路径 | 空 | 生产 |
| 注入模型 | 传输层不读取 | 不读取 | 脚本演示、测试或宿主提供的实现 |

写在 `VITE_*` 变量里的密钥会进入前端构建产物。无论源文件是否提交，这个构建的每个使用者都能看到它。只有当读取环境变量的代码在服务端运行时，环境变量才真正保护密钥。

助手界面不应要求访客粘贴服务商密钥或任意端点。如果产品需要客户自己的凭证，应当把它保存在服务端控制面里，只向页面暴露模型别名。如果某个人想使用自己的 Agent 和模型，那属于外部 Agent 路径，不是浏览器里的密钥表单。

## 创建网关

这个包导出一个符合 Web 标准的请求处理器，以及一个很小的 `node:http` 适配器。下面的例子在私有回环地址上启动参考网关：

```ts
import { createServer } from "node:http";
import { createPlingGateway, toNodeHandler } from "@plingjs/server";

const gateway = createPlingGateway({
  upstream: {
    baseUrl: process.env.PLING_UPSTREAM_BASE_URL!,
    apiKey: process.env.PLING_UPSTREAM_API_KEY!,
  },
  model: process.env.PLING_MODEL!,
  allowedModels: [process.env.PLING_MODEL!],
  authorize: async ({ headers }) => {
    const user = await verifySession(headers.get("cookie"));
    return user ? { ok: true, user: { id: user.id } } : false;
  },
  onAudit: (event) => auditLog.write(event),
  timeoutMs: 30_000,
  maxBodyBytes: 512 * 1024,
  retry: { maxRetries: 1, baseDelayMs: 400, maxDelayMs: 2_000 },
});

createServer(toNodeHandler(gateway)).listen(5192, "127.0.0.1");
```

`verifySession` 与 `auditLog` 代表应用已有的会话校验函数和审计出口，不是 Pling API。网关会在模型请求边界调用它们。

开发阶段，用同源 Vite 代理连到这个监听地址即可：

```ts
server: {
  proxy: {
    "/api/llm": {
      target: "http://127.0.0.1:5192",
      changeOrigin: true,
    },
  },
}
```

网关接受任何以 `/chat/completions` 结尾的路径，所以代理不必去掉前缀。`GET .../health` 返回一个很小的就绪响应。生产环境的反向代理必须原样转发请求体和流式响应，不能缓冲它们。

也可以把 `gateway.handle(request)` 直接挂到 Bun、Deno、Serverless 或现有 Web 框架上。Node 适配器只是接入便利，不是协议本身。

## 每次请求都做鉴权

网关不会根据客户端自报的请求头或 Cookie 的存在推断用户。应用提供 `authorize` 钩子，它会在每次模型请求时运行并返回一个判断。

```ts
authorize: async ({ headers, request }) => {
  const session = await verifySession(headers.get("cookie"));
  if (!session) return false;

  return {
    ok: true,
    user: { id: session.userId, tenant: session.tenantId },
  };
}
```

- 返回 `false`：以 `401 UNAUTHORIZED` 拒绝。
- 返回 `{ ok: false, status?, message? }`：默认以 `403` 拒绝，也可以指定状态码。
- 返回 `{ ok: true, user?, headers? }`：放行。`user` 会交给审计钩子；`headers` 会加入上游请求。
- 没有配置钩子，也没有显式设置 `allowAnonymous: true`：返回 `503 GATEWAY_MISCONFIGURED`。忘记配置鉴权，永远不等于“对所有人开放”。
- 钩子抛出异常：返回 `500 AUTHORIZE_FAILED`，不会被当成鉴权成功。

钩子应当验证服务端会话或带签名的令牌。除非可信代理已经签署或清理过请求头，否则不要相信浏览器传来的 `user-id`。跨站使用 Cookie 时，应用还需要明确的 CSRF 与 CORS 设计；网关不会让不安全的 Cookie 策略变安全。

作为 `user` 返回的值只应包含审计所需的非敏感标识，例如用户 id 与租户 id。网关不会净化这个值。

上游凭证与用户凭证是两件事。配置里的上游 `apiKey` 会成为默认的 `Authorization` 头。如果上游要求携带当前用户的令牌，`authorize` 可以显式返回 `authorization` 头；这个决定会覆盖本次请求的默认头。浏览器 Cookie 不会被自动转发。

## 模型选择留在服务端

浏览器可以在请求体里写模型名，但不能控制上游目标。上游基础地址在创建网关时就固定了。这个包只接受 `http` 与 `https`，拒绝内嵌用户名或密码，也拒绝基础地址里的查询串和片段。没有任何请求参数可以把模型调用重定向到另一台主机。

模型策略由两个选项表达：

```ts
createPlingGateway({
  upstream,
  model: "app-chat",
  allowedModels: ["app-chat", "app-chat-mini"],
});
```

- `model` 会覆盖浏览器请求里的任何模型名。
- `allowedModels` 校验最终模型名。不在名单里的值返回 `400 MODEL_NOT_ALLOWED`。
- 两个选项都不配置时，使用请求里的模型名。可信的内部客户端也许可以接受，但这不是公开应用的合理默认值。

只有当固定上游能解析模型别名时，别名才有用。参考网关会原样转发选中的模型名，不会把 `support-fast` 映射成某个服务商模型。如果内部模型路由层负责这层映射，别名可以隐藏服务商与区域细节，让后端在不发前端版本的情况下轮换凭证，也给网关提供稳定的预算与策略单位。别名本身不是秘密。如果上游就是模型服务商本身，应使用服务商提供的模型 id。

## 网关能看到什么

模型网关是凭证边界，不是隐私边界。请求里有系统提示词、页面观察、对话历史和工具声明；响应里有模型文本和建议的工具调用。网关必然要处理这两部分。

这带来三个后果：

1. 敏感值替换必须在请求到达网关之前完成。把密钥移出浏览器，并不会把业务数据移出模型请求。
2. 提示词与响应正文不应写进普通网关日志、访问日志、错误追踪或链路追踪系统。内置审计钩子刻意只记录元数据，原因就在这里。
3. 网关可以增加内容过滤或数据防泄漏规则，但这些规则不能替代页面的能力设计、确认与后端授权检查。模型仍然只能提出动作；运行时和后端决定动作是否可以执行。

审计事件包含请求 id、时间、模型、是否流式、状态、上游状态、尝试次数、耗时、可获得的字节数、鉴权钩子返回的用户信息以及错误码。它不包含提示词、响应正文或上游密钥。如果应用需要更强的审计证据，可以在其中加入业务请求标识，但不应复制模型上下文。

## 限额、重试与失败语义

参考网关有一组有界的默认值。它们是起点，不是完整的容量方案。

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `maxBodyBytes` | 1,000,000 字节 | 超过上限的请求在调用上游前返回 `413 PAYLOAD_TOO_LARGE` |
| `timeoutMs` | 60,000 毫秒 | 限制等待上游响应头的时间；`0` 关闭该计时器 |
| `retry.maxRetries` | 2 | 首次请求之后最多再试两次；范围 0–5 |
| `retry.baseDelayMs` | 500 毫秒 | 指数退避的基数 |
| `retry.maxDelayMs` | 4,000 毫秒 | 单次退避的上限，也会限制上游 `Retry-After` |

重试覆盖 408、425、429、5xx、网络失败和响应头超时。400、401、403 以及其他确定性的客户端错误不会重试。流式请求只允许在上游开始返回正文之前重试；一旦有字节流向浏览器，网关就不会重放这次请求。

网关的超时在上游响应头到达时结束。正文在读取过程中仍可能停滞；浏览器侧的 OpenAI 适配器会对这一阶段施加自己的超时。

浏览器侧的模型链也有重试预算。它能识别网关返回的 `retryExhausted` 标记并停止重试，因此默认的两层预算不会相乘成无限循环。如果应用只想保留一层预算，应显式把另一层设为 0，并观察实际结果。

网关把上游故障映射成稳定的客户端错误，并且不回传上游正文：

| 状态码 | 错误码 | 含义 |
| --- | --- | --- |
| 400 | `INVALID_JSON` / `INVALID_BODY` | 请求体不是 JSON 对象 |
| 400 | `MODEL_REQUIRED` / `MODEL_NOT_ALLOWED` | 最终模型缺失或不在允许范围内 |
| 401 / 403 | `UNAUTHORIZED` | 鉴权钩子拒绝请求 |
| 413 | `PAYLOAD_TOO_LARGE` | 请求体超过配置上限 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 请求不是 JSON |
| 499 | `CLIENT_ABORTED` | 浏览器取消了请求 |
| 500 | `AUTHORIZE_FAILED` / `GATEWAY_INTERNAL` | 鉴权钩子或网关自身失败 |
| 502 | `UPSTREAM_UNAVAILABLE` / `UPSTREAM_ERROR` | 网络失败或不可重试的上游响应 |
| 503 | `GATEWAY_MISCONFIGURED` | 没有配置鉴权策略 |
| 503 | `UPSTREAM_RATE_LIMITED` | 上游返回 429，且重试已耗尽 |
| 504 | `UPSTREAM_TIMEOUT` | 网关未在限定时间内收到上游响应头 |

错误体包含 `requestId`、`retryable`，在适用时还包含 `attempts` 与 `retryExhausted`。请求 id 同时出现在 `x-pling-request-id` 与审计事件中，因此可以把用户反馈和网关元数据对上，而不必记录提示词。

第一次接入时常见的失败有三种：

- **所有请求都返回 `503 GATEWAY_MISCONFIGURED`。** 没有提供 `authorize` 钩子。补上一个；`allowAnonymous: true` 只能用于私有的本机或内网监听，上线前必须移除。
- **浏览器报告网络失败或 CORS 错误。** 浏览器仍指向服务商的绝对地址，或者同源路由没有代理到网关。改成相对基础路径，并验证 POST 路由，包括流式响应。
- **服务商拒绝凭证，但浏览器只看到 `502 UPSTREAM_ERROR`。** 网关刻意隐藏了上游响应正文。到审计出口里查看 `upstreamStatus` 和请求 id，再修正或轮换服务端凭证，不要把密钥暴露给客户端。

## 部署清单

- 上游密钥放在 Secret Manager 或服务端环境里，不进入源码、镜像、公开构建产物或 localStorage。
- 浏览器与模型路由同源。使用 TLS；不要为了弥补跨域部署而放开带凭证的宽松 CORS。
- 网关绑定私有网络接口，只通过反向代理暴露预期路由。
- 用应用真实身份系统实现 `authorize`。不要接受请求体里的用户 id 或角色。
- 配置固定模型别名或白名单。不要允许公开客户端选择任意昂贵模型。
- 在 `@plingjs/server` 之外增加限流、租户额度、费用预算和紧急开关。这个包限制单次请求，不是计费或多租户平台。
- 关闭反向代理、APM 和错误日志对请求体与响应体的采集。保留不含提示词的审计元数据，并定义保留期限。
- 健康路由只在内网监听上使用。它刻意不做鉴权，不应作为普通公网端点暴露。
- 把超时与重试预算当成一个整体设计。对反复出现的 `UPSTREAM_RATE_LIMITED`、`UPSTREAM_TIMEOUT` 和 `retryExhausted` 结果设置告警。
- 测试反向路径：没有会话、来源不匹配、模型缺失、请求体超限、上游超时和服务商密钥缺失。
- 扫描生产构建产物里的凭证。把密钥写进 `VITE_*` 变量，并不会因为“它是环境变量”而变得安全。

## 小结

模型网关把服务商凭证留在服务端，也把模型使用变成一个由应用控制的操作。浏览器保留 Agent 循环和页面权限；网关验证调用者、选择允许的模型、把一条请求转发到固定上游，并输出运行元数据。

它不会让模型请求自动变成私密数据，不会授权页面动作，也不会替代后端业务规则。这些仍然是彼此独立的控制。生产接入真正需要回答的问题很窄，也可以验证：这个浏览器能否以这个身份、在这份预算内、经过这个固定上游调用这个模型，并且始终拿不到上游凭证？
