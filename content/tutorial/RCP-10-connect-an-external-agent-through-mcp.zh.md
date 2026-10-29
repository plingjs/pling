---
id: RCP-10
title: "通过 MCP 接入外部 Agent"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 通过 MCP 接入外部 Agent

MCP 是外部 Agent 常用的工具入口。它适合承载 `describe` 与 `invoke`，但不会自动提供页面身份、能力范围或审批。接入时必须把 MCP 当作传输与工具呈现层，而不是第二套业务实现。

## 可运行页面

下面的工单页保持打开，外部 stdio MCP 进程通过回环地址连接它。客户端只拿到 `describe` 与 `invoke`，拿不到 DOM、模型密钥或任意脚本执行器。

<DemoPlayground id="recipe-mcp" />

页面与 MCP server 分别启动：

```bash
pnpm dev:examples
PLING_SURFACE_APP_URL="http://localhost:5191/demos/recipe-mcp/?mcp=1" \
pnpm --filter @plingjs/examples surface:mcp
```

打开 `http://localhost:5191/demos/recipe-mcp/?lang=zh`，再把第二条命令注册到支持 stdio MCP 的客户端。页面源码在 `examples/demos/recipe-mcp/`；桥与 server 在 `examples/demos/external-agent-surface/`，启动方式、工具清单与安全边界见该目录的 `README.md`。本示例只监听回环地址，不提供公网 MCP 端点。

## 目标结构

```text
外部 Agent
  │ MCP 工具调用
  ▼
MCP facade
  │ describe / invoke / status
  ▼
受鉴权传输
  │ 页面会话 + Agent 会话
  ▼
Pling Surface → 现有 executor
```

页面仍需保持连接，或由后端保存可验证的页面会话。Facade 不能凭一个 Agent token 就假定任意用户、任意租户或任意页面的能力都可用。

## 工具映射

一个最小 facade 可以提供：

| 工具 | 对应行为 |
| --- | --- |
| `pling_surface_describe` | 返回当前能力与有界上下文 |
| `pling_surface_invoke` | 调用一个已暴露能力 |
| `pling_surface_approval_status` | 查询等待中的请求或异步结果 |

工具 schema 必须保留能力 id、输入属性、风险级别、确认要求与记录模板。不要把每个能力粗暴映射成无参数工具，也不要根据页面按钮文案临时生成工具。

不得提供 `pling_approve`、任意 DOM 点击或脚本执行工具。审批必须由真人在页面完成；Agent 只能查询结果。

## 接入步骤

1. 启动页面侧 Surface 参考实现：

   ```bash
   pnpm dev:mcp-reference
   ```

2. 在仓库根目录把本地 MCP server 注册到客户端：

   ```bash
   codex mcp add pling-demo -- pnpm mcp:reference
   ```

3. 打开示例页面，让页面会话与本地桥建立连接。
4. 在 Agent 中先调用 `describe`，确认只出现白名单能力。
5. 选择一个只读任务，再测试带 schema 的写入。
6. 测试一个需要确认的动作，确认 Agent 收到等待状态且没有批准工具。

带登录与 Bearer token 的完整流程见登录保护的 Todo 参考实现：页面生成一次性配对码，终端领取 token，MCP 客户端使用 Bearer token。token 必须视为密码，不能写入日志或模型上下文。

## 验收标准

1. 未配对或 token 过期时，MCP 调用被拒绝。
2. 一个用户不能通过另一个用户的连接访问记录。
3. 工具清单只包含当前会话暴露的能力。
4. 业务失败以结果返回，不伪装成传输错误。
5. 高风险动作返回 `pending_approval` 或等价状态；没有自批工具。
6. 页面关闭、会话撤销或 token 过期后，所有调用 fail-closed。
7. 重复 request id 不会造成第二次写入。

## 常见问题

**MCP server 自己有数据库。** 这会让页面状态与业务状态分裂。Facade 只转发能力调用，业务真相仍在应用。

**把整个页面描述塞进系统提示词。** 每次连接都可能变化。用 `describe` 获取当前快照，并利用 `after` 减少重复。

**把 Bearer token 交给模型。** 由 MCP 客户端在传输层添加；模型只看到工具结果。

**审批用 MCP 工具完成。** 拒绝。审批必须在用户可见、与请求绑定的页面完成。

## 测试与限制

本地 MCP 参考实现提供 stdio 传输与脚本化 smoke test；登录保护的 Todo 参考实现增加 Bearer token 路径。两者都使用内存或演示身份，不等于生产 SSO、跨副本会话或公网网关。生产部署仍需 TLS、租户隔离、持久化、分布式限流与审计。

## 本地验证

让 MCP 客户端列出待处理工单、回复 `TCK-91`，再读取统计。确认工具清单只有 describe、invoke 与审批状态；然后关闭页面再调用，客户端应断开或失败，而不是继续从缓存执行业务。
