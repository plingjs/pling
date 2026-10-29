---
id: RCP-14
title: "让另一实现通过 Surface 一致性验证"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 让另一实现通过 Surface 一致性验证

当另一个团队实现页面能力面或客户端时，双方最容易在“看起来能用”之后才发现边界不同。可重复的一致性 harness 应尽早把这些差异暴露出来。

## 可运行页面

下面的面板在浏览器里创建全新夹具，运行九组 Surface 请求向量，并逐项比较预期与实际错误码。它是仓库测试向量，不是认证或互操作背书。

<DemoPlayground id="recipe-conformance" />

从仓库根目录运行：

```bash
pnpm dev:examples
```

打开 `http://localhost:5191/demos/recipe-conformance/?lang=zh`。源码在 `examples/demos/recipe-conformance/`；包级测试仍以 `packages/surface/test/surface.test.ts` 为准。

## 先定义角色

- 服务端实现：接收 `describe` / `invoke`，做暴露交集与执行透传；
- 客户端实现：构造请求、处理响应与错误；
- 传输实现：验证身份、转发消息、处理断连；
- 委托实现：签发、内省、撤销与事件。

一次测试只声明一个角色及其证据，不要把客户端通过写成整个部署通过。

## 固定夹具

建立一个最小测试页：

| 能力 | 用途 |
| --- | --- |
| `item.list` | 只读，验证记录窗口 |
| `item.add` | 写入，验证 schema |
| `item.archive@item` | 折叠记录动作 |
| `item.delete@item` | 危险动作，需要真人确认 |
| `item.unavailable` | 恒不可用，验证错误 |

夹具应能稳定产生记录、反馈、不可用原因与会话过期，不依赖真实模型或网络时钟。

## 请求向量

至少保存以下输入：

1. 正确 `describe`；
2. 非法版本；
3. 非法方法；
4. 缺少 `id`；
5. `record` 与 `offset` 同时出现；
6. 未暴露能力；
7. 不存在或已被筛选的目标记录；
8. 需要确认的写入；
9. 过期与撤销会话；
10. 重复 `request.id`；
11. 限流命中；
12. `after` 被截断的场景。

每个向量预期响应码、是否调用执行器、业务状态与审计字段。不能只断言“返回了 JSON”。

## 运行与比较

```ts
const cases = loadVectors("surface-0.1.json");
for (const vector of cases) {
  const before = await fixture.snapshot();
  const response = await implementation.handle(vector.request);
  assertEnvelope(response, vector.expected);
  assertBusinessState(await fixture.snapshot(), vector.beforeAfter ?? before);
  assertExecutorCalls(fixture, vector.expected.executorCalls);
}
```

比较协议层结果，不比较内部日志。传输可以不同，但业务副作用必须一致。所有拒绝路径必须证明执行器未被调用。

## 版本与环境

记录：

- 协议版本与实现 commit；
- Node / 浏览器 / 运行时版本；
- 传输形态；
- 会话与委托适配器；
- 限流与防重放是否启用；
- 测试日期与工作区是否干净。

未提交工作区的结果必须标注，不能与发布提交静默比较。

## 当前能声明什么

仓库有 `packages/surface/test/surface.test.ts` 与委托适配器一致性 helper。它们证明参考实现的一部分行为；当前没有公开认证项目、没有独立第二实现，也没有标准组织背书。

因此合适的表述是“通过 0.1 仓库测试向量”，不是“获得 Pling 认证”。若另一个实现通过相同向量，可以写“在指定夹具与版本下互操作”，并列出未覆盖的传输、SSO、多租户和浏览器矩阵。

## 失败处理

- 对同一请求产生不同业务副作用：先暂停互操作声明，按向量定位。
- 错误码不同：确认是否业务错误被错误提升为协议错误。
- 只隐藏能力但仍可调用：这是权限缺陷，不是格式差异。
- 客户端重试造成重复写入：检查 id 生命周期与业务幂等，而不只是网络重试。

一致性不是一次演示，而是可重复、可审计、知道边界的证据。

## 可运行验证

在页面点击“运行向量”，九项结果都应给出预期码、实际码与耗时。再运行 `pnpm --filter @plingjs/surface test` 检查包级协议和执行器边界；涉及网关时再运行 `pnpm --filter @plingjs/surface-gateway test`。比较另一实现时，使用相同夹具、版本和环境记录，并明确未覆盖的传输与身份场景。
