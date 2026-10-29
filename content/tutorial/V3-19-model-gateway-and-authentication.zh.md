---
id: V3-19
title: "模型网关与鉴权"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 模型网关与鉴权

把模型密钥打进前端产物，并不会因为它来自“环境变量”就变得安全。任何打开页面的访问者都能拿到它。模型地址和模型名也有同样的问题：如果浏览器可以随意修改这两项，应用等于把凭据和账单一起交了出去。

生产环境的边界比“页面调用模型”更窄：页面只调用自己的服务器。服务器先确认请求来自谁，再决定访问哪家模型服务、使用哪个密钥、允许哪些模型、请求体有多大，以及该记录什么。

## 让浏览器配置保持简单

浏览器只需要同源地址和模型名，不需要供应商密钥。

```ts
// src/agent-config.ts
export const browserAgentConfig = {
  baseUrl: '/api/llm/v1',
  model: 'server-model',
  apiKey: '',
} as const;
```

把它交给 agent 配置：

```ts
const pling = createPling({
  agent: {
    config: {
      ...browserAgentConfig,
      limits: { maxTurns: 100 },
    },
  },
});
```

`baseUrl` 与页面同源，浏览器会按正常的同源规则携带 Cookie。`apiKey` 为空，因为真正的供应商密钥由网关在后面补上。浏览器里的模型名只是偏好，不是权限；网关可以固定模型，也可以拒绝不在白名单里的名字。

客户端里的空密钥是有意为之，不是没配完。把真实供应商密钥放在这里，会让整条边界失去意义。

## 转发之前先确认身份

网关接收标准的 `Request`，返回标准的 `Response`。因此它可以直接接到 Node、Bun、Deno 或 Serverless 适配器上，不需要在服务端再放一套 agent 循环。

```ts
const gateway = createPlingGateway({
  upstream: {
    baseUrl: process.env.PLING_UPSTREAM_BASE_URL!,
    apiKey: process.env.PLING_UPSTREAM_API_KEY!,
  },
  model: process.env.PLING_GATEWAY_MODEL,
  allowedModels: ['server-model'],
  authorize: auth.authorize,
  allowAnonymous: false,
  onAudit(event) {
    console.log(JSON.stringify({ type: 'pling.audit', ...event }));
  },
});
```

`authorize` 在请求体发往上游之前执行。返回 `false` 或 `{ ok: false }` 会直接拒绝。既没有 `authorize`，也没有显式设置 `allowAnonymous: true` 时，网关同样会拒绝请求。忘记配置鉴权的结果是关闭，而不是向所有人开放。

浏览器应用通常更适合使用 HttpOnly 会话 Cookie，而不是把令牌放进 `localStorage`。示例还要求 `SameSite=Lax`，HTTPS 站点必须带 `Secure`。每次模型请求都会重新验证会话；退出登录会在服务端撤销它。

## 由服务端决定模型，而不是页面

浏览器可以发送模型名，但不能决定任意模型或更昂贵的模型。`model` 固定上游模型；需要多个合法模型时，用 `allowedModels` 设置白名单：

```ts
model: 'server-model',
allowedModels: ['server-model', 'server-model-fast'],
```

未知模型会在访问上游前被拒绝。页面上的模型选择器可以表达偏好，但不能授予权限。

网关还会限制请求体大小、设置上游超时，并按需重试瞬时故障。这些不是性能参数，而是防止单个浏览器会话耗尽内存、上游时间或重试预算的边界。

## 审计元数据，不记录对话正文

审计记录应当回答运维问题：哪个用户、哪个模型、什么状态、耗时多久、传输多少字节、是否耗尽了重试。

```ts
{
  type: 'pling.audit',
  requestId: '…',
  user: { id: 'demo-user' },
  model: 'server-model',
  status: 200,
  durationMs: 842,
  bytesIn: 1780,
  bytesOut: 96,
  attempts: 1
}
```

提示词和模型回答默认不记录。它们可能包含个人信息、客户记录，或者页面里复制出来的密钥。组织若因合规需要记录正文，应当单独设计保留期限、访问控制和脱敏规则。

请求标识会通过 `x-pling-request-id` 返回，便于把浏览器错误和服务端审计对应起来。

## 运行示例

页面是一个小型 Todo 列表，模型请求只走 `/api/llm/v1`。网关运行在另一个 Node 进程里。

```bash
pnpm tutorial:dev v3-19
```

复制 `.env.gateway.example` 为 `.env.gateway`，填入供应商配置，然后在另一个终端启动网关：

```bash
cd examples/tutorials/v3-19-model-gateway-and-authentication
node server.mjs
```

打开 `http://127.0.0.1:5232/`，用配置的演示密码登录，再让 Todo 助手新增或查看任务。浏览器网络面板里的请求会指向 `127.0.0.1:5232/api/llm/...`，不会出现供应商密钥。

确定性检查：

```bash
pnpm tutorial:check v3-19
```

测试覆盖浏览器配置、鉴权失败关闭、会话撤销、模型固定、服务端注入密钥，以及只记录元数据的审计。

## 失败模式

**把供应商密钥写进 `VITE_*` 变量。** Vite 会把这类值打进前端产物，变量名取得再好也挡不住访问者查看。

**相信浏览器传来的模型名。** 浏览器可以修改自己发出的任何请求。应在服务端固定模型或执行白名单。

**使用 Cookie 却不考虑 CSRF。** `SameSite=Lax` 能覆盖常见情况，但跨源表单、多子域等场景仍需明确的 CSRF 策略。

**以“调试”为名记录完整提示词。** 审计日志保留时间长、访问面广。运维元数据与内容日志要分开，内容在离开进程前必须先脱敏。

**把网关当成 agent。** 在这个架构里，agent 循环仍在页面中运行；网关只负责传输、凭据、鉴权、限额和审计。
