---
id: RCP-01
title: "登录、会话与受保护页面"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 登录、会话与受保护页面

当页面包含订单、课程、患者信息或企业后台时，Agent 不应替用户登录，也不能绕过登录。Pling 的任务是让已登录页面更可操作，并把“当前是谁、能看什么、什么时候失效”留在应用现有身份系统里。

## 可运行页面

下面的页面使用真实本地 HTTP 会话。登录、会话过期与退出都会直接改变页面投影，而不是只切换一段提示文案。

<DemoPlayground id="recipe-login-session" />

从仓库根目录运行：

```bash
pnpm dev:examples
```

打开 `http://localhost:5191/demos/recipe-login-session/?lang=zh`。页面源码在 `examples/demos/recipe-login-session/`；后端在 `examples/recipe-backends/access-service/`，启动方式、路由和边界见该目录的 `README.md`。演示账号为 `demo@example.com` / `pling-demo`。

## 适用场景

- 受保护页面需要用户先登录；
- 外部 Agent 通过委托访问有限能力；
- 会话过期或退出登录后，页面能力必须立即不可用；
- 同一页面存在多个租户或多个角色。

## 控制设计

先分清三种状态：

| 状态 | 页面行为 |
| --- | --- |
| 未登录 | 只暴露登录说明或人工入口，不暴露业务记录与写入动作 |
| 已登录、无委托 | 页面内助手可用，外部能力面默认关闭 |
| 已登录、有委托 | Surface 可用，范围取站点暴露与会话作用域的交集 |

外部会话不是用户 Cookie 的复制。宿主验证浏览器会话后，签发短期委托给特定 Agent；页面 Agent 仍使用自己的登录态。退出登录、切换租户或撤销委托时，必须让对应能力立即失效。

## 验收标准

1. 未登录时 `describe` 看不到受保护记录和写入能力。
2. Agent 不能提交用户名、密码、Cookie 或 token 作为工具参数。
3. 会话过期后，下一次 `invoke` 返回 `SESSION_EXPIRED`，执行业务函数未被调用。
4. 撤销后返回 `SESSION_REVOKED`；浏览器 SSE 只作提示，服务端仍重新验证。
5. 切换租户后旧 `sessionId` 不得复用，旧描述也不能继续调用。
6. 退出登录后页面内助手与外部 Surface 都不再看到受保护数据。

## 实现路径

Vue 3 与 React 的接入步骤分别见 [Vue 模型网关与鉴权](/zh/vue/model-gateway-and-authentication)和 [React 模型网关与鉴权](/zh/react/model-gateway-and-authentication)。共享的委托契约见 [身份、同意与委托](/zh/surface/identity-consent-and-delegation)。

服务端可以使用 `@plingjs/delegation` 的 identity / store / event bus 三个 port。参考案例：

- 委托凭证参考：签发、内省、范围交集；
- 撤销参考：撤销后 fail-closed；
- 多实例参考：跨实例失效语义；
- 包集成参考：文件存储与一致性 helper；
- 登录保护的 Todo 参考：登录、Bearer token 与 MCP。

这些是参考实现，不是生产身份服务。

## 失败路径

**Agent 说“请先告诉我密码”。** 拒绝。登录是用户与身份提供方之间的流程，不属于能力。

**只在前端隐藏按钮。** 不够。`invoke` 仍必须经过能力交集和后端授权。

**撤销后仍能调用。** 检查 `sessionId` 是否在权限变化时更换，以及每次调用是否重新验证会话。依赖长连接缓存而不重新检查，会产生旧权限窗口。

**把 JWT 传给模型上下文。** 即使模型“只需要知道已登录”也不应该拿到凭证。给模型暴露布尔状态或业务身份，不给 token。

## 上线检查

- 登录、登出、切换租户、过期与撤销五条路径都有测试；
- 受保护能力在未登录状态下不出现在描述中；
- 审计记录用户、Agent、会话与结果，不记录凭证；
- 反向代理不缓存受保护响应；
- 错误文案不泄露账户是否存在；
- 回滚时能立即关闭外部 Surface，而不影响页面内助手。

## 本地验证

登录后让助手添加一条发票备注；随后点击“使会话过期”或退出，再发同一请求。页面不再渲染受保护记录，备注动作也不可用；即使直接调用后端，仍会得到会话错误。

这个后端只用于本地验证：用户、会话和委托都在内存中，重启即清空。生产环境应替换为应用自己的身份、数据库、CSRF、TLS 与审计实现，不要直接部署这个示例服务。
