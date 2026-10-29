---
id: REF-11
title: "错误码与诊断"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# 错误码与诊断

Pling 把机器可读的错误码与人看到的本地化句子分开。错误码不随语言或适配器变化；文案来自共享 UI 目录。

```ts
import { describePlingError, describePlingDiagnostic } from "@plingjs/ui";

const text = describePlingError(
  { code: "ACTION_UNAVAILABLE", message: "按钮被弹窗遮住了" },
  (key, params) => translate(locale, key, params),
);
```

不要解析本地化文本来判断错误类型，按 `code` 分支。

## 动作错误

| 错误码 | 含义 | 常见原因 | 处理 |
| --- | --- | --- | --- |
| `DUPLICATE_ACTION_ID` | 两个动作使用同一个 id | 循环复用了常量 id | 加上行主键或命名空间 |
| `DUPLICATE_STATE_KEY` | 两个状态视图使用同一个键 | 两个已挂载组件都暴露 `task_view` | 使用唯一键，或收归一个所有者 |
| `DUPLICATE_GUIDE_TARGET` | 两个指引目标共用 id | 复制粘贴的人工接力标记 | 使用唯一目标 id |
| `ACTION_NOT_FOUND` | 模型调用了未注册的 id | 声明被移除、改名，或从未存在 | 声明动作，或如实拒绝任务 |
| `INVALID_ARGS` | 工具调用参数不是合法 JSON，或不符合 schema | 模型生成了畸形参数 | 指出字段与期望形状 |
| `INVALID_PARAMS` | 声明参数校验失败 | 缺少必填值、类型错误、越界、格式不符 | 返回校验原因，不要盲目重试 |
| `PERMISSION_DENIED` | 动作存在，但策略拒绝 | 当前角色无权执行 | 修改策略或请求 |
| `ACTION_UNAVAILABLE` | 前置条件不成立 | 控件禁用、被遮挡、区域未激活、`available()` 返回 false | 修复前置条件，或向模型解释 |
| `EXECUTION_FAILED` | 动作执行时抛错 | 业务函数拒绝、网络失败 | 返回真实原因，不要报告成功 |
| `EXPECTATION_FAILED` | 动作执行了，但 `expect` 始终不成立 | 页面没有更新，或期望写错 | 检查期望与实际页面 |
| `HANDOFF_CANCELLED` | 用户拒绝人工接力 | 操作者选择不完成 | 停止任务，或改走其他路径 |
| `HANDOFF_TIMEOUT` | 人工接力超时 | 用户没有在时限内完成 | 只有在业务允许时才延长时限 |
| `HANDOFF_FAILED` | 用户点了已完成，但期望不成立 | 结果尚未真正发生 | 复查页面并再次请求 |
| `STEP_FAILED` | 复合动作中的某一步失败 | `steps` 里某一步返回错误 | 报告具体失败的步骤，不要笼统报整条流程失败 |
| `HOOK_BLOCKED` | 生命周期钩子阻止了动作 | 策略钩子拒绝 | 检查钩子返回值 |
| `LOOP_DETECTED` | agent 反复调用同一个工具 | 结果缺失、期望错误，或页面存在循环 | 修复页面或终止运行 |

## 运行时错误

| 错误码 | 含义 | 常见原因 |
| --- | --- | --- |
| `NOT_CONFIGURED` | runtime 没有可用的模型连接 | 缺少 base URL、模型名或密钥 |
| `LLM_FAILED` | 模型请求失败 | 网络、CORS、网关、鉴权或服务商错误 |
| `SEND_FAILED` | 消息未能送达 runtime | 会话已销毁，或请求被取消 |

`NOT_CONFIGURED` 是就绪问题，不是模型失败。界面应指出缺少哪个字段，而不是显示一条笼统的请求错误。

## 配置诊断

这些错误码来自 `resolveAgentConfig`，通过 `describePlingDiagnostic` 渲染：

| 错误码 | 缺失或无效项 |
| --- | --- |
| `MODEL_BASE_URL_MISSING` | OpenAI 兼容根地址 |
| `MODEL_NAME_MISSING` | 模型名 |
| `MODEL_API_KEY_MISSING` | 端点要求密钥时缺少密钥 |
| `LIMITS_INVALID` | `maxTurns`、上下文预算、预留输出、压缩比例或保留历史数 |
| `RETRY_INVALID` | 重试次数或延迟 |

相对根地址（`/llm/v1`）只要应用提供同源代理就是有效配置，不应按缺失处理。

## 限额

| 配置 | 默认值 | 取值或约束 |
| --- | --- | --- |
| `maxTurns` | 10 | 至少 1；示例夹具可以设为 100 |
| `contextTokens` | 8192 | 至少 1024 |
| `reserveForOutput` | 1024 | 至少 0；`contextTokens - reserveForOutput` 至少留 1024 |
| `compactRatio` | 0.8 | 大于 0，最多 1 |
| `keepRecent` | 6 | 至少 0 |
| `maxTokens` | 1024 | 单次响应输出预算 |
| `minActionIntervalMs` | 0 | 同一批动作之间的延迟 |

示例夹具显式设置 `maxTurns: 100`；生产默认仍是 10。

## 正确阅读错误

1. 先看 `code`。
2. 原始 `message` 只作为次级细节。
3. 查看当前快照：动作是否已注册、可用，且位于活动区域。
4. 遇到 `EXPECTATION_FAILED`，先比较期望与实际页面状态，不要直接重试。
5. 遇到 `ACTION_NOT_FOUND`，检查页面是否在快照与调用之间发生了变化。
6. 遇到 `LLM_FAILED`，先查网关、CORS、凭据与服务商状态，不要先改页面声明。

## 适配器行为

四个适配器共用同一个执行器和同一套错误码。界面渲染方式可能不同：

| 适配器 | 错误呈现位置 |
| --- | --- |
| Vue 3 | `<AgentDock>`、`<AgentInline>`、`<AgentChat>`、调试检查器 |
| React | `<AgentDock>`、`<AgentChat>` |
| 原生 JS / jQuery | `pling.dock()` 与会话事件 |
| Vue 2.7 | 共享的 `pling.dock()` |

业务代码不要把错误码映射成某个适配器专属的字符串。用 `describePlingError` 配当前 UI 语言渲染。

## 相关页面

- 配置：[安装与模型配置](/zh/vue/installation-and-model-configuration)、[接入模型网关](/zh/operations/connect-a-model-gateway)。
- 可用性与区域：[区域、可见性与遮挡](/zh/vue/regions-visibility-and-overlays)。
- 成功判据：[带输入的动作与结果验证](/zh/vue/actions-with-input-and-verified-results)。
- 人工接力：[确认与人工接力](/zh/vue/confirmation-and-human-handoff)。
- 调试检查器：[Vue 3 适配器](/zh/reference/vue-3-adapter)、`packages/vue/src/components/AgentDebug.vue`、`examples/recipes/vue3`。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/*` `0.1.0-alpha.3` 的运行时与适配器错误码 |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器；Node 侧使用需 Node.js 20 或更高版本 |
| Peer 依赖 | 取决于所用适配器 |
| 稳定性 | 1.0 之前的 alpha；可以新增错误码，但不会静默改变既有错误码的含义 |

本页的错误码字符串与诊断字段是当前版本的公开契约。新增错误码属于增量变更；改变既有错误码的分类或含义，必须作为破坏性变更记录。
