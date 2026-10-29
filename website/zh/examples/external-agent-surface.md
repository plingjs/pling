---
id: SITE-03-surface
layout: page
pageClass: demo-page
title: "案例05：暴露能力给外部"
description: 一个完整 Todo、一个协议检查器，以及一个供 Codex、Claude、Hermes Agent、WorkBuddy 接入的公网 Surface；记录、审批与业务处理留在页面。
status: draft
release: 0.1
locale: zh
---

<DemoPlayground id="external-agent-surface" />

## 线上页面

直接打开 [案例 05 线上页面](https://plingjs.dev/demos/external-agent-surface/?mcp=1&lang=zh)。页面分成三个工作区：

- **Todo**：真实的业务页面，手工操作与外部 Agent 操作共用同一组数据。
- **协议检查器**：直接发送 `describe` / `invoke`，观察外部客户端实际收到什么。
- **公网 Surface**：向 Pling Surface Gateway 申请页面会话，并展示 Codex、Claude、Hermes Agent、WorkBuddy 的接入片段。

这个案例不再挂页面聊天助手。它要展示的是第三方 Agent 如何进入同一组业务能力，而不是页面内助手的对话体验。

公开案例当前把页面会话和 Agent token 的最长有效期都设为 **24 小时**。页面关闭、刷新、主动撤销或到期后，token 会立即失去对当前页面的操作能力。

这里没有“线上页面 + 本机 WebSocket”的写法：浏览器会拦截公网 HTTPS 页面访问本机回环端口，报 `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`。线上案例走公网网关，本地开发才使用回环桥。

## 客户端接入

页面里的四个标签页分别给出 Codex、Claude、Hermes Agent、WorkBuddy 的接入方式。它们连的是同一个 HTTPS MCP 端点，也共享当前页面的六项能力。

### Codex

1. 打开线上页面，等待 **Codex 访问 token** 出现。
2. 复制页面上的整段命令。它等价于：

```bash
export PLING_AGENT_TOKEN='页面上的 token'
codex mcp remove pling-todo 2>/dev/null || true
codex mcp add pling-todo \
  --url https://surface.hunger-valley.com/mcp \
  --bearer-token-env-var PLING_AGENT_TOKEN
codex --no-daemon
```

3. 必须在同一个终端执行整段命令。最后一行使用 `codex --no-daemon`，避免连接到之前启动、没有这枚 token 的共享 daemon。
4. 让 Codex 先调用 `pling_surface_describe`，再调用返回的能力。例如：

> 先描述当前 Todo 页面，然后新增“准备客户演示”，再把第一条未完成事项标记为完成。

### Claude Code

```bash
export PLING_AGENT_TOKEN='页面上的 token'
claude mcp remove pling-todo >/dev/null 2>&1 || true
claude mcp add --transport http pling-todo \
  https://surface.hunger-valley.com/mcp \
  --header "Authorization: Bearer $PLING_AGENT_TOKEN"
claude
```

如果你的 Claude 版本使用 Connectors 界面，选择远程 MCP，填入同一个 URL 与 `Authorization` 请求头即可。

### Hermes Agent 与 WorkBuddy

在客户端的 MCP / 连接器设置里新增远程 HTTP（也可能叫 Remote MCP 或 Streamable HTTP）服务，名称为 `pling-todo`，填入页面上的 URL 与 `Authorization: Bearer <token>`。如果客户端接受 `mcpServers` JSON，页面也提供了可直接复制的配置。

不同客户端的菜单名称与版本有关，MCP 端点、请求头和权限边界相同。

## 有效期与使用规则

- 页面会话与 Agent token 最长有效 **24 小时**。
- **刷新页面会创建新的页面会话和新 token**；旧 token 不能继续操作刷新后的页面。
- 一个页面会话只绑定一个 Agent。要同时接 Codex、Claude 等多个客户端，请为每个 Agent **新开一个页面**。
- 页面必须保持打开。关闭页面或撤销 Agent 后，即使 token 尚未到期，也无法继续调用。
- 删除与清除已完成始终由页面上的真人确认，Agent 不能代自己批准。

如果要使用 Codex 桌面版的 `/mcp` 面板，先完全退出 Codex，再执行
`codex app-server daemon stop`，然后从已经设置 token 的终端重新启动。
`--no-daemon` 的 CLI 路径是验证接入最可靠的方式。

这是公开案例的便捷模式：token 会出现在页面 DOM 中，页面脚本、浏览器扩展或截图工具都可能读到它。生产环境应改用 OAuth 或设备授权，不要把长期凭证留在页面里。网关仍然不向 Agent 暴露 DOM、脚本执行、Cookie 或模型密钥。

## Surface 层做到什么

- `@plingjs/surface` 负责能力投影、`describe`、`invoke`、会话与审批边界。
- `services/surface-gateway` 负责公网传输、页面会话、Agent token、撤销与审计。
- 页面保留执行器、参数校验和业务函数；网关不执行页面代码，也没有 `click(selector)`、脚本执行或代审批工具。
- 企业接入时应由自己的后端创建页面会话，而不是复用这个公开案例端点。
