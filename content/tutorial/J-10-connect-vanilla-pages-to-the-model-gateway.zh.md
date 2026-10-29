---
id: J-10
title: "原生页面接入模型网关"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 原生页面接入模型网关

放进浏览器产物里的密钥不是秘密。它会送到每一位访问者手里；即使变量名叫 `VITE_AGENT_KEY`，或者源码没有提交到仓库，构建后的值仍然可以从页面读取并被复制使用。

示例把供应商密钥完全移出浏览器。页面只访问同源地址，由一个较小的服务端进程验证会话、选择上游模型、补上密钥、执行限额，再返回结果。

## 让浏览器配置保持普通

页面需要地址和模型名，不需要供应商密钥：

```ts
export const browserAgentConfig = {
  baseUrl: "/api/llm/v1",
  model: "server-model",
  apiKey: "",
} as const;
```

把它交给页面运行时：

```ts
const pling = createPling({
  agent: {
    config: {
      ...browserAgentConfig,
      systemPrompt: copy.systemPrompt,
      limits: { maxTurns: 100 },
    },
  },
});
```

`apiKey` 为空是有意为之。浏览器按正常的同源规则携带 Cookie；网关验证请求后再补上供应商凭据。浏览器里的模型名只是偏好，服务端可以固定模型，也可以拒绝它。

## 转发之前先确认身份

网关接收 Web 标准的 `Request`，返回 Web 标准的 `Response`。因此它可以直接接入 Node、Bun、Deno 或 Serverless 环境：

```ts
const gateway = createPlingGateway({
  upstream: {
    baseUrl: process.env.PLING_UPSTREAM_BASE_URL!,
    apiKey: process.env.PLING_UPSTREAM_API_KEY!,
  },
  model: process.env.PLING_GATEWAY_MODEL,
  allowedModels: ["server-model"],
  authorize: auth.authorize,
  allowAnonymous: false,
  onAudit(event) {
    console.log(JSON.stringify({ type: "pling.audit", ...event }));
  },
});
```

`authorize` 在请求到达供应商之前执行。会话缺失或过期都会被拒绝。既没有 `authorize`，也没有显式设置 `allowAnonymous: true` 时，网关返回 `503`。忘记配置鉴权的结果是关闭，而不是向所有人开放。

演示使用 HttpOnly 会话 Cookie，而不是把令牌放进 `localStorage`。Cookie 采用 `SameSite=Lax`；公开地址使用 HTTPS 时还会带 `Secure`。退出登录会在服务端撤销会话，而不只是清掉页面状态。

## 由服务端决定模型

浏览器可以发送模型名，但不能决定任意或更昂贵的模型：

```ts
model: "server-model",
allowedModels: ["server-model", "server-model-fast"],
```

未知模型在访问上游前就会被拒绝。页面上的模型选择器可以表达偏好，不能授予权限。

同一条边界还限制请求体大小、上游时间和重试次数。这些不是性能调优项，而是可用性与安全约束：一个浏览器会话不应消耗无上限的内存或上游时间。

## 审计元数据，不记录对话正文

审计记录应回答运行问题：谁调用了、用了哪个模型、状态码、耗时、传输大小，以及是否耗尽了重试。

```ts
{
  type: "pling.audit",
  requestId: "…",
  user: { id: "demo-user" },
  model: "server-model",
  status: 200,
  durationMs: 842,
  bytesIn: 1780,
  bytesOut: 96,
  attempts: 1
}
```

提示词和回复默认不记录。它们可能包含客户资料、个人信息，或者从私有页面复制出来的文本。组织如果因合规需要保存正文，应单独设计保留期限、访问控制和脱敏规则。

响应会带 `x-pling-request-id`，浏览器错误可以和服务端记录对应起来，而无需记录整段对话。

## 运行示例

页面是一个客服任务表，模型请求只走 `/api/llm/v1`。网关运行在另一个进程。

```bash
pnpm tutorial:dev j-10
```

复制 `.env.gateway.example` 为 `.env.gateway`，填入供应商配置，然后在另一个终端启动网关：

```bash
pnpm --dir examples/tutorials/j-10-model-gateway dev:gateway
```

打开 `http://127.0.0.1:5275/`，用配置的演示密码登录，再让助手操作任务。浏览器网络面板里的请求只指向页面同源地址，不会出现供应商地址或密钥。

```bash
pnpm tutorial:check j-10
```

检查覆盖浏览器配置、未登录时在访问上游前拒绝、没有鉴权钩子时失败关闭、服务端注入密钥、固定模型、HttpOnly 会话 Cookie、会话撤销，以及只记录元数据的审计。

## 常见问题

**用 `VITE_*` 变量保存供应商密钥。** Vite 会把它打进浏览器产物，变量名不能提供保护。

**相信浏览器传来的模型名。** 浏览器可以修改请求的任何部分。应在服务端固定模型或执行白名单。

**使用 Cookie 却没有 CSRF 决定。** `SameSite=Lax` 覆盖常见情况，但跨源表单和多子域仍需明确策略。

**以“调试”为名记录完整提示词。** 网关能接触大量敏感内容。运维元数据和内容日志要分开；内容离开进程前必须先脱敏。

**把 agent 循环放进网关。** 在这个架构中，循环仍在页面里。网关负责传输、凭据、鉴权、限额和审计，不读取 DOM，也不决定执行哪个动作。

下一步：[MPA 与任务连续性](/zh/vanilla/mpa-and-task-continuity)。
