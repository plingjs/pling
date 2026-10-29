---
id: SPEC-07
title: "传输绑定"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 传输绑定

`describe` 与 `invoke` 的语义与传输无关。传输层负责把请求可靠、完整、可鉴权地交给协议实现，并把响应带回调用方。它不得改变能力、授权或错误分类。

## 传输层必须提供

1. **身份验证**：确定调用方、用户、租户和会话；验证发生在协议对象之前。
2. **完整性**：请求与响应未被篡改；跨源场景使用 TLS 或等价保护。
3. **机密性**：凭证不出现在 URL、日志或协议包络中。
4. **大小限制**：限制请求与响应字节数，防止内存与拒绝服务风险。
5. **超时与取消**：调用方可以终止等待，主机可以释放资源。
6. **请求关联**：保留协议 `id`，并可为传输增加独立关联 id。
7. **重放边界**：传输重试不得重新提交一个已经产生业务副作用的逻辑调用。
8. **顺序说明**：不得假定不同请求按发送顺序完成；导航或作用域变化应显式失效旧描述。

## 当前可用形态

| 形态 | 适用场景 | 主要风险 |
| --- | --- | --- |
| `postMessage` | 同页、受信任扩展或受控 iframe | 必须验证 origin、source 与消息形状 |
| 同源 HTTP + SSE | Web 服务、MCP facade、事件通知 | Cookie/CSRF、代理限制、会话恢复 |
| WebSocket | 双向低延迟桥 | 连接认证、消息大小、断线重连 |
| MCP facade | 将能力作为工具提供给 Agent runtime | 工具说明遗漏、通用逃逸口、传输鉴权 |
| 本地进程桥 | 开发或受控桌面环境 | 本地端点发现、权限提升、日志泄露 |

传输选择不改变协议一致性。一个实现可以在 HTTP 上暴露 `describe`，在 WebSocket 上暴露 `invoke`，但两端必须使用相同会话与能力交集。

## `postMessage`

接收方必须检查 `event.origin`、`event.source` 和 `event.data`：

```ts
window.addEventListener("message", async (event) => {
  if (event.origin !== allowedOrigin) return;
  if (event.source !== allowedWindow) return;
  const response = await surface.handle(event.data);
  allowedWindow.postMessage(response, allowedOrigin);
});
```

不得使用 `"*"` 作为携带敏感数据的响应目标。也不得只检查 message type；能力与记录 id 都必须受会话作用域限制。

## HTTP 与 MCP

HTTP 路由应在鉴权后再调用 `surface.handle(request)`。响应状态码可以表达传输结果，但不能替代包络内的 `ok` 与 `error.code`。

MCP facade 必须：

- 把每个能力映射为有明确 schema 的工具；
- 保留 `effect`、`approval`、`handoff`、记录模板与 `scopePath`；
- 把 `describe` 结果作为能力发现，不从 UI 文案临时生成工具；
- 在调用前重新验证会话；
- 不提供通用 `click`、`eval`、原始 DOM 或任意 HTTP 工具；
- 把业务失败原样作为结果，而不是伪装成传输错误。

## 浏览器与代理限制

反向代理、CDN 与日志系统可能截断长响应、缓冲流式事件或记录请求体。部署时必须：

- 不记录完整请求体、响应体或 Authorization；
- 为 SSE 关闭不必要缓冲；
- 设置与协议上限一致的 body size；
- 保留 `x-pling-request-id` 或等价关联头；
- 对超时、限流和服务不可用返回可诊断的传输错误。

## 当前实现的边界

仓库提供协议内核、参考委托 HTTP handler 与案例中的本地桥。`surface.plingjs.dev` 只用于演示，不是所有客户共享的生产网关。任何生产传输都应由部署方实现 TLS、身份、租户隔离、持久化、限流与审计。
