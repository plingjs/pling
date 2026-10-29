---
id: SITE-04
title: "示例与任务方案"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 示例与任务方案

示例展示完整应用，任务方案处理可复用的界面边界。两者现在都以可运行页面为准：每篇方案都有自己的页面、源码、启动路径和验证步骤，不再把多个问题引向同一个演示。

## 五个经典案例

- [案例01：待办事项](/zh/examples/quickstart)覆盖新增、完成、编辑、筛选与清理。
- [案例02：订单工作台](/zh/examples/orders)覆盖业务队列、记录、行级动作与确认。
- [案例03：单页多路由工作台](/zh/examples/vue3-spa-routing)在客户端路由切换后继续任务。
- [案例04：多页工作台](/zh/examples/multi-page-continuity)跨完整 document 导航继续任务。
- [案例05：暴露能力给外部](/zh/examples/external-agent-surface)把具名能力暴露给页面之外的 Agent。

每个案例页都提供可操作预览、带标记的源码与接入说明。模型请求通过服务端网关发出，浏览器不持有供应商密钥。

## 运行方案

在仓库根目录执行：

```bash
pnpm dev:examples
```

命令同时启动示例页面、模型网关和本地 access service。页面地址为 `http://localhost:5191/demos/<方案>/?lang=zh`；每篇正文顶部也会嵌入当前效果，并可在“效果预览”“源码”“接入说明”之间切换。涉及文件上传、登录、委托或审批的方案会使用 `examples/recipe-backends/access-service/`，其路由、演示账号和限制写在目录内的 `README.md`。MCP 方案还需单独启动 stdio server，命令见对应正文。

## 身份与受保护数据

- [登录、会话与受保护页面](/zh/recipes/login-session-and-protected-pages) — [效果](/demos/recipe-login-session/?lang=zh) · 源码 `examples/demos/recipe-login-session/` · 后端 `examples/recipe-backends/access-service/`
- [经用户同意的委托访问](/zh/recipes/delegated-access-with-user-consent) — [效果](/demos/recipe-delegation/?lang=zh) · 源码 `examples/demos/recipe-delegation/` · 后端 `examples/recipe-backends/access-service/`

## 表单与重要动作

- [表单填写、校验与提交](/zh/recipes/form-fill-validation-and-submit) — [效果](/demos/recipe-form-validation/?lang=zh) · 源码 `examples/demos/recipe-form-validation/` · 无需后端
- [多步弹窗与向导](/zh/recipes/multi-step-modal-and-wizard) — [效果](/demos/recipe-wizard/?lang=zh) · 源码 `examples/demos/recipe-wizard/` · 无需后端
- [危险操作与确认](/zh/recipes/dangerous-actions-and-confirmation) — [效果](/demos/recipe-danger-confirm/?lang=zh) · 源码 `examples/demos/recipe-danger-confirm/` · 无需后端

## 表格、搜索与异步任务

- [表格行与批量操作](/zh/recipes/table-rows-and-batch-actions) — [效果](/demos/recipe-table-batch/?lang=zh) · 源码 `examples/demos/recipe-table-batch/` · 无需后端
- [搜索、筛选与长列表](/zh/recipes/search-filters-and-long-lists) — [效果](/demos/recipe-search-long-list/?lang=zh) · 源码 `examples/demos/recipe-search-long-list/` · 无需后端
- [文件上传与异步任务](/zh/recipes/file-upload-and-asynchronous-work) — [效果](/demos/recipe-upload-async/?lang=zh) · 源码 `examples/demos/recipe-upload-async/` · 后端 `examples/recipe-backends/access-service/`
- [多页任务连续性](/zh/recipes/multi-page-task-continuity) — [效果](/demos/recipe-continuity/?lang=zh) · 源码 `examples/demos/recipe-continuity/` · 无需后端

## 外部 Agent 与运维

- [向外部 Agent 开放三个安全能力](/zh/recipes/expose-three-safe-capabilities-to-an-external-agent) — [效果](/demos/recipe-external-surface/?lang=zh) · 源码 `examples/demos/recipe-external-surface/` · 无需后端
- [通过 MCP 接入外部 Agent](/zh/recipes/connect-an-external-agent-through-mcp) — [效果](/demos/recipe-mcp/?lang=zh) · 源码 `examples/demos/recipe-mcp/` · stdio server `examples/demos/external-agent-surface/mcp-server.mjs`
- [Agent 操作的审批、审计与撤销](/zh/recipes/approval-audit-and-revocation-for-agent-actions) — [效果](/demos/recipe-approval-audit/?lang=zh) · 源码 `examples/demos/recipe-approval-audit/` · 后端 `examples/recipe-backends/access-service/`
- [让另一实现通过 Surface 一致性验证](/zh/recipes/pass-surface-conformance-with-another-implementation) — [效果](/demos/recipe-conformance/?lang=zh) · 源码 `examples/demos/recipe-conformance/` · 无需后端

## 模型访问

- [使用自己的模型密钥](/zh/recipes/use-your-own-model-key) — [效果](/demos/recipe-model-key/?lang=zh) · 源码 `examples/demos/recipe-model-key/` · 本地模型网关

## 按框架学习

要改造自己的应用，继续以对应框架的教程为主：

- [Vue 3 快速上手](/zh/vue/quick-start-add-pling-to-a-vue-app)
- [React 快速上手](/zh/react/quick-start-add-pling-to-a-react-app)
- [原生 JavaScript 快速上手](/zh/vanilla/quick-start-add-pling-to-a-vanilla-page)
- [Vue 2.7 快速上手](/zh/vue2/quick-start)

## 源码组织

方案页面位于 `examples/demos/`，共享外壳与本地 API 客户端位于 `examples/recipe-shared/`，需要服务端的方案共用 `examples/recipe-backends/access-service/`。框架代码仍只在 `packages/`；示例不复制执行逻辑。

如果方案依赖你的应用尚未提供的能力，应调整业务处理器，而不是增加通用 DOM 逃逸口。Pling 暴露页面本来就有权执行的操作，不绕开页面另建自动化通道。
