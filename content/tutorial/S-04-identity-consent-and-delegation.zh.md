---
id: S-04
title: "身份、同意与委托"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 身份、同意与委托

外部 Agent 修改业务记录时，会同时出现几种身份：使用页面的用户、Agent 软件、Agent 会话、应用租户，以及最终接受或拒绝写入的业务后端。任何一次登录都不能同时证明这些身份。

委托凭证在一段有限时间内把上述事实连起来。它应说明：哪个用户授权、授权给哪个 Agent、允许哪些能力、绑定哪个会话、有效期到何时。它必须可撤销，token 不能进入页面投影或模型对话。

## 同意是一份明确授权

同意不是“用户打开了助手”。有效的同意界面应展示 Agent、请求的能力、记录范围、有效期，以及 Agent 将看到什么。用户应该能授予比站点上限更窄的范围。

只读订单 Agent 可以获准 `orders.search` 与 `orders.open`，不能因为用户在界面里能审批订单，就自动包含 `orders.approve`。对于写入操作，获准范围也不能替代业务后端对归属和状态的要求。

## 参考流程

`@plingjs/delegation` 定义凭证生命周期 port 与 Web 标准参考 handler。接口契约为：

```text
GET  /delegation/health
GET  /delegation/session
GET  /delegation/events          SSE
POST /delegation/issue
POST /delegation/introspect
POST /delegation/refresh
POST /delegation/revoke
```

流程刻意很小：

1. 浏览器建立应用会话。
2. 用户向 Agent 授予有界范围。
3. 服务端一次性签发不透明 token，只保存哈希。
4. 客户端 introspect token，把安全凭证视图转换为 Surface 会话，再发送请求。
5. 撤销或轮换时发布失效事件。
6. 每次请求执行前重新检查凭证；SSE 只是提前通知，不是事实来源。

身份、存储与事件总线都是 port。真实部署用登录系统、数据库和事件基础设施实现它们。内存适配器只用于测试与本地示例，不是生产实现。

## 范围交集

有效能力集是站点 `expose` 与会话 `scope` 的交集。站点白名单很宽，不会让窄委托变宽；委托范围很宽，也不能让站点从未暴露的能力出现。

数组 scope 可以写精确 id，也可以写 `approve@order` 这类折叠模板，允许一个受约束的行内动作族。函数 scope 适合动态 id，但 `describe` 与 `invoke` 必须使用同一规则。

## 撤销与过期

撤销必须在每次 `describe` 或 `invoke` 前检查，而不只是连接建立时。过期使用服务端时间，浏览器时钟不能延长会话。已撤销 token 应返回稳定失败，并且不调用执行器或业务函数。

会话范围或有效期变化时，应使用新的 session id。增量能力缓存不能跨授权状态复用。协议内核可以拒绝无效会话，但宿主负责生命周期，不能把未验证对象传给 `session`。

## 同意不能做什么

同意不能把不安全能力变安全。它不能把自由 DOM 点击变成业务操作，不能替用户批准支付，也不能替代双人复核。它记录授权，不消除后果。

协议也不能证明高风险审批一定来自真人，那属于页面与后端职责。若业务需要审批回执，challenge 应绑定请求、能力、记录、用户、Agent、会话、规范化参数与有效期。回执 token 不能进入 Surface 响应或审计事件，审计里只能有公开 approval id。

## 实现清单

- 使用真实应用身份，绝不接受请求体中的用户 id。
- 只保存 token 哈希，仅在签发或轮换时返回 token。
- 持久化前规范范围并去重。
- 拒绝缺失、过期、撤销、伪造或跨用户凭证。
- 每次 Surface 请求前重新检查。
- 发布失效事件，但把它当作加速器。
- 测试事件总线失败时，下一次 introspect 仍 fail-closed。

参见 [委托与信任边界](/zh/reference/delegation-and-trust-boundaries)、[部署 Surface 网关](/zh/surface/deploy-a-surface-gateway)与 [撤销访问与审计操作](/zh/surface/revoke-access-and-audit-actions)。
