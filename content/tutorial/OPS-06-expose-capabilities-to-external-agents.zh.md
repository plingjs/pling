---
id: OPS-06
title: "向外部 Agent 开放能力"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 向外部 Agent 开放能力

一个应用可以同时服务两类 Agent，而不复制业务逻辑：

- 页面内的助手，直接使用页面声明好的动作；
- 运行在用户电脑上的 Agent，通过 Agent Surface 到达同一组动作。

第二条路径会引入凭证、网络边界和人工审批。本页说明参考拓扑，以及应用必须自己承担的部分。

## 先确定能力边界

不要从“把全部动作都暴露出去”开始。先选一组在页面之外仍然成立的业务操作，例如：

```text
add_task
toggle@<record-id>
delete@<record-id>
clear_completed
```

这些 id 来自页面已有的声明。Surface 只做投影，不创建第二套动作模型。导航、账号设置、登录表单和无关记录应留在 allowlist 之外。

任何传输层都遵守两条规则：

- 页面会话显式声明能力 allowlist；
- Agent 会话只能请求它的子集，不能扩大范围。

协议中没有通用的 `click(selector)`、`eval` 或任意 HTTP 操作。已经控制 Chromium 的浏览器 Agent 仍可通过 CDP 绕过 Surface；Surface 不承诺阻止这种行为。它的价值是让获准的业务操作具有身份、范围、确认路径和可观察结果。

## 区分三种部署角色

“网关”一词容易掩盖三种不同职责。应把它们分开：

| 角色 | 谁运营 | 持有什么 |
| --- | --- | --- |
| 官方演示 Gateway | Pling 项目 | 演示租户、演示会话、演示审计 |
| 企业 Gateway | 应用所有者 | 租户 allowlist、身份集成、审计存储 |
| 客户 BFF | 应用后端 | 用户会话、业务数据、页面会话创建 |

`surface.plingjs.dev` 是官方演示端点，不是客户应用共用的代理。企业应在自己控制的源上部署 `@plingjs/surface-gateway`，例如 `surface.example.com`，并由自己的后端创建页面会话。

Gateway 配置中的租户 Origin 列表不是认证。它只回答一个更窄的问题：哪些浏览器源可以为该租户打开 WebSocket。

## 在服务端创建页面会话

创建页面会话的管理凭证不能进入浏览器。流程是：

1. 用户登录应用；
2. BFF 校验自己的 HttpOnly 会话 Cookie；
3. BFF 通过私有路径调用 `POST /v1/page-sessions`；
4. 请求携带 `tenantId`、已认证的 `userId` 和收窄后的 scope；
5. Gateway 返回短时页面 token；
6. BFF 只把页面 token 和 WebSocket 地址返回给浏览器。

调用 Gateway 时使用仅服务端持有的 admin bearer token：

```http
POST /v1/page-sessions
Authorization: Bearer <SURFACE_ADMIN_TOKEN>
Content-Type: application/json

{
  "tenantId": "demo",
  "userId": "u_...",
  "scope": ["add_task", "toggle@", "delete@", "clear_completed"]
}
```

不要在浏览器代码里创建页面会话，也不要用未经验证的请求体推断 `userId`。身份来源是应用自己的登录会话。

## 让一个 Agent 配对一页

页面打开 WebSocket 后，才请求一次性配对码。页面传输未连接时，配对必须被拒绝，因为页面才是能力与审批的权威。

用户把配对码交给 Agent 运行时。运行时只兑换一次，获得：

- Agent 会话 id；
- 短时 bearer token；
- 实际生效的 scope；
- MCP 端点。

页面 token 与 Agent token 的持有者不同：

| 凭证 | 持有者 | 用途 |
| --- | --- | --- |
| Admin token | 应用后端 | 创建或检查页面会话 |
| Page token | 已登录页面 | 打开页面 WebSocket、创建配对 |
| Agent token | 外部 Agent 运行时 | 调用 `describe`、`invoke`、`status` |

这些凭证都不应进入模型提示词、公开日志或审计记录。

## 让适配器托管浏览器侧生命周期

页面仍然负责声明能力、渲染审批界面；它不该再手写会话、Socket、桥接、配对、
申领、重连与卸载清理。Vue 3 里可以直接用 `useSurfaceGateway()` 托管这段生命周期：

```ts
import { computed } from "vue";
import { useSurfaceGateway } from "@plingjs/vue";

const gateway = useSurfaceGateway({
  app: "orders",
  expose: ["orders.overview", "orders.update_note"],
  mode: "bff",
  getPageSession: async () => {
    const response = await fetch("/api/surface/page-session", { method: "POST" });
    if (!response.ok) throw new Error("无法创建 Surface 页面会话");
    return response.json();
  },
  approval,
});

const surface = computed(() => gateway.surface.value);
```

`bff` 模式必须提供 `getPageSession`。应用服务端验证用户后，用自己的 admin token
调用网关；浏览器只拿到短时页面会话。`public-demo` 只用于需要展示可复制 Agent token
的公开演示，不要为了省掉 BFF 接口就把产品切到 `public-demo`。

同一个控制器还覆盖重连、配对、撤销与卸载清理。`<SurfaceAccessPanel :gateway="gateway" />`
是连接与 token 控件的可选起点，产品可以换成自己的界面。

封装不会放宽安全边界：`expose` 仍然显式，页面仍然是唯一能批准破坏性动作的地方。
React、原生 JavaScript 或非浏览器宿主可以直接使用框架无关的 `@plingjs/surface-browser` 原语。

## 执行仍留在应用里

Agent 调用三个 MCP 操作：

```text
pling_surface_describe
pling_surface_invoke
pling_surface_approval_status
```

`describe` 返回页面身份、允许的能力、有界记录、区域、暴露状态和反馈。`invoke` 把一个能力转交给页面，由现有执行器校验动作、应用策略并运行业务实现。Gateway 不持有业务数据库，也不复制应用的授权逻辑。

对于折叠的记录动作，Agent 单独传入记录：

```json
{
  "capability": "delete",
  "input": { "record": "t_1234abcd" }
}
```

页面内部的动作 id 仍是 `delete@t_1234abcd`。折叠避免长列表为每一行生成一个模型可见工具，同时保留记录身份。

## 把人工审批放在正确的位置

高风险请求返回 `pending_approval`，而不是先执行再询问。页面把决定展示给已登录用户。Agent 可以轮询 `status`，但没有 MCP 审批工具，也没有一个能让它批准自己请求的 token。

对远程 Agent 来说，这一点尤其重要。用户没有看到的页面里的审批按钮，不是可用的决策面。产品可以把待审批请求作为通知转发到 Agent 客户端，但决定仍必须由已认证的真人作出，并由应用执行。

审批证据属于应用的审计链。challenge token、receipt token 及其 hash 不进入 Surface 响应、审计事件、日志或模型上下文。只有公开的 approval id 可以用于关联。

## 部署选择

公开演示使用独立主机：

```text
https://todo.plingjs.dev     应用页面与 BFF
https://surface.plingjs.dev  官方演示 Gateway
```

企业部署对应为：

```text
https://app.example.com     应用页面与 BFF
https://surface.example.com 企业 Gateway
```

应用可以用同一个源提供页面和 `/api/*`；Gateway 可以作为单独服务位于 TLS 之后。admin token 只应出现在 BFF 到 Gateway 的服务端链路，不出现在浏览器或 Agent 链路。

如果页面必须部署在子路径而不是独立主机，前端 base path 和 BFF 路由前缀必须一起修改。只改一处时，浏览器里的请求看似正确，却不会到达 BFF。

## 需要验证的失败路径

- 页面 WebSocket 未连接时创建配对必须失败。
- 同一个配对码兑换两次必须失败。
- 过期的页面会话或 Agent 会话必须停止工作。
- 请求超出页面会话的 scope 必须失败。
- 调用未暴露的能力必须在协议边界失败。
- 对未知记录调用记录动作必须返回业务错误，而不是访问其他用户的记录。
- 删除操作必须保持 pending，直到真人在应用中批准。
- 撤销 Agent 必须使其 token 失效，但不删除用户数据。

公开仓库中的登录版 Todo 案例实现了这条参考路径，并使用内存身份与 Todo 存储。生产应用必须替换为自己的数据库、SSO、业务授权规则和审计系统。
