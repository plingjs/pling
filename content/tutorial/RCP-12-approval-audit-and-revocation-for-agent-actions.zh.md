---
id: RCP-12
title: "Agent 操作的审批、审计与撤销"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# Agent 操作的审批、审计与撤销

危险动作需要三条可分别验证的事实：真人看到了什么、后端批准了什么、系统实际执行了什么。三者不能靠同一条自由文本串起来。

## 可运行页面

下面的发票页把“请求删除”和“批准删除”分开。Agent 只能创建待决请求，真人才能允许或拒绝；审计面板显示请求、决定与撤销后的失败路径。

<DemoPlayground id="recipe-approval-audit" />

从仓库根目录运行：

```bash
pnpm dev:examples
```

打开 `http://localhost:5191/demos/recipe-approval-audit/?lang=zh`，使用 `demo@example.com` / `pling-demo` 登录。页面源码在 `examples/demos/recipe-approval-audit/`；审批、审计与撤销后端在 `examples/recipe-backends/access-service/`，边界见其 `README.md`。

## 审批边界

Agent 可以请求一个动作，但不能批准它。推荐流程：

```text
invoke 高风险能力
→ 执行器发现需要确认，返回 pending
→ 页面展示绑定 request / capability / record / 参数摘要的挑战
→ 真人拒绝或批准
→ 后端消费一次性回执并执行
→ Agent 收到最终结果，同时审计写入公开关联 id
```

审批挑战与回执必须绑定用户、Agent、会话、能力、目标记录、参数摘要与有效期。回执 token 只在页面与审批后端之间传递，不能进入协议响应、模型上下文或日志。

## 审计内容

一条可用的 `SurfaceAuditEvent` 应含：

```json
{
  "protocol": "pling.surface/0.1",
  "at": "2026-10-28T12:00:00.000Z",
  "requestId": "req_02",
  "method": "invoke",
  "agentId": "codex",
  "sessionId": "ses_01",
  "userId": "user_42",
  "capability": "orders.cancel@order",
  "record": "SO-1002",
  "approvalId": "apr_public_7",
  "outcome": "completed",
  "durationMs": 183
}
```

审计不应包含原始参数、完整响应、Cookie、JWT 或审批 token。`approvalId` 只是公开关联 id，不能用于重建或重放审批。

## 撤销

撤销应覆盖：

- 当前 Agent 会话；
- 某用户的全部委托；
- 某应用的外部访问；
- 紧急情况下关闭所有外部传输。

浏览器收到撤销事件后应立即停止调用，但服务端仍要在每次请求前重新验证。事件是提示，不是事实来源。

## 验收标准

1. 高风险动作在批准前没有业务副作用。
2. Agent 看不到审批 token，也没有代批准工具。
3. 拒绝、超时和关闭页面产生稳定错误，不留下半完成写入。
4. 同一回执不能被第二次消费；重放请求被拒绝。
5. 审计能把请求、用户、Agent、会话与公开审批 id 关联起来。
6. 撤销后下一次调用在执行器前失败。
7. 后端授权仍独立生效；审批不能替代业务权限。
8. 审计 sink 故障不会把已完成动作改成失败，但会触发告警。

## 参考实现

本方案的后端保存待审批、决定和审计事件，页面只暴露请求工具与有界状态视图。它覆盖“Agent 请求、真人决定、系统执行”的完整路径；内存存储和演示账号不提供生产审批服务、真实身份或跨副本事务保证。

## 常见错误

**把 `approval: always` 当成已批准证据。** 它只声明需要确认，不证明确认发生。

**把审批 token 放进审计。** 泄漏后可被重放。只存公开关联 id，并设置访问控制与保留期限。

**在 MCP 中开放 `approve` 工具。** Agent 会批准自己的请求。审批必须由真人完成。

**只记录成功。** 拒绝、不可用、期望失败和内部异常也要审计，否则无法调查越权尝试。

## 发布前检查

- 审批挑战与一次真实请求绑定；
- 回执一次性消费；
- 业务事务与审计关联可核对；
- 撤销和过期在跨实例场景生效；
- 高风险审计的 `approvalId` 为空时有告警；
- 日志和调试面板不含 token、完整参数或敏感正文。

## 本地验证

请求删除 `INV-2042`，第一次拒绝并确认发票仍在；再次请求并允许，检查审计中出现对应决定。随后点击“测试撤销后的外部调用”，请求应在业务函数之前失败。全程确认 Agent 工具清单中没有批准工具。
