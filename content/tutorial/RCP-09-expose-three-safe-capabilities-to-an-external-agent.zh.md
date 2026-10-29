---
id: RCP-09
title: "向外部 Agent 开放三个安全能力"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 向外部 Agent 开放三个安全能力

第一个外部能力面不应从“全部 API”开始。选三个可解释、可验证、风险递进的能力，足以证明协议闭环，也便于审计和回滚。

## 可运行页面

下面的编辑队列共用一个页面注册表。外部客户端只能看到列表、通过与备注三项能力；删除仍在页面内，尝试从外部调用会被白名单拒绝。

<DemoPlayground id="recipe-external-surface" />

从仓库根目录运行：

```bash
pnpm dev:examples
```

打开 `http://localhost:5191/demos/recipe-external-surface/?lang=zh`。源码在 `examples/demos/recipe-external-surface/`；示例在浏览器内运行能力面，用来观察协议边界，不包含面向公网的传输与身份验证。

## 能力选择

以一个订单页为例：

| 能力 | 效果 | 理由 |
| --- | --- | --- |
| `orders.search` | 只读 | 验证有界上下文与筛选 |
| `orders.update_note@order` | 写入 | 验证 schema、记录目标与执行证据 |
| `orders.cancel@order` | 破坏性 | 验证确认与不可逆边界 |

搜索能力让 Agent 知道页面能查什么；备注写入有明确输入和结果；取消订单需要真人确认，不应该由 Agent 自行批准。三个能力覆盖读取、写入与高风险路径，但不暴露用户管理、支付或任意 DOM。

## 服务端配置

```ts
import { createSurface } from "@plingjs/surface";

const surface = createSurface({
  registry,
  app: "orders",
  expose: ["orders.search", "orders.update_note@order", "orders.cancel@order"],
  session: () => verifiedSession,
  recordLimit: 8,
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  replay: true,
  onAudit(event) {
    auditStore.append(event);
  },
  execute: (id, args, context) => executor.execute(id, args, context),
});
```

`registry` 必须与页面内助手共用。`expose` 只是站点上限；真正的会话还要通过 `session.scope` 收窄。不要为外部调用复制一套 executor。

## 验收流程

1. 打开页面，登录测试用户。
2. 创建外部会话，范围只含三个能力。
3. 调 `describe`，确认只出现三个能力，记录窗口有总数。
4. 调 `orders.search`，验证筛选结果，不传任意 SQL 或选择器。
5. 调 `orders.update_note@order`，验证记录 id、schema、成功判据与审计。
6. 调 `orders.cancel@order`，确认停在真人确认，Agent 收到等待状态。
7. 用未授权能力 id 调用，确认 `CAPABILITY_NOT_EXPOSED` 且无副作用。
8. 撤销会话，确认下一次调用在 executor 前失败。

## 失败与回滚

- 目标记录被筛选掉：`INVALID_REQUEST` 或结构化业务失败，应重新描述，不能换一条记录。
- 权限不足：停止并转真人；不要尝试另一个相似能力。
- 业务期望未成立：先读取状态，检查是否部分成功。
- 写入超时：保留 request id，查询业务状态，不自动重放。
- 紧急关闭：撤销会话并关闭外部传输；不影响页面内助手。

## 证据与案例

本方案的可运行源码是 `examples/demos/recipe-external-surface/`。它把页面工具、`expose` 白名单和同一执行器放在一起，能够直接验证“页面内可用、外部不可见”的差异；公网部署还需要独立的鉴权传输与审计边界。

## 不应开放

- 任意记录列表或完整数据库查询；
- 支付、退款、管理员角色修改；
- 读取 Cookie、JWT、密钥或其他用户数据；
- 通用点击、脚本执行或任意 HTTP；
- 代 Agent 批准高风险动作的工具。

先证明三个能力可被准确发现、执行和审计，再扩展到更多业务。

## 本地验证

在外层面板先调用 `describe`，再依次调用 `article_list`、`article_approve` 与 `article_comment`。最后调用 `article_delete`；它应返回 `CAPABILITY_NOT_EXPOSED`。检查响应中的能力清单始终只有三项，且失败调用没有改变文章状态。
