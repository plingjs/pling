---
id: REF-02
title: "Agent 运行时、会话、上下文与限额"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# Agent 运行时、会话、上下文与限额

页面声明描述“能做什么”，运行时决定“一次对话如何使用这些能力”：调用哪个模型、保留多少历史、哪些动作需要确认，以及一次运行后留下哪些证据。

这一页把几个经常被混用的词拆开。某一层出错时，不应被误判成另一层的问题。

## 对象与计数口径

| 对象 | 它代表什么 | 关键边界 |
| --- | --- | --- |
| `AgentRuntime` | 一套接好的对话环境：模型、权限策略、钩子、观测与会话 | 每个已挂载的运行时只解析一次配置 |
| `AgentSession` | 对话目标、历史、事件流、待确认动作与待人工接力 | `send()` 串行执行，后一次发送等待前一次结束 |
| 轮次 | 一次 `send()` 内的一次模型回复及其工具调用 | 由 `limits.maxTurns` 限制 |
| 模型调用 | 一次实际发往模型服务的请求，包含重试 | 由 telemetry 统计，数量可以大于轮次 |
| 用于压缩判断的上下文 | 基础系统提示、压缩摘要与最近消息 | 由 `limits.contextTokens` 限制，不是回复长度 |

`maxTurns` 不是请求次数上限。模型执行五轮工具、再给出最终回答，就是六轮。网络失败后自动重试一次，轮次不变，但模型调用次数会增加。

`maxTokens` 是另一个设置：它限制单次响应的输出长度。`contextTokens` 是决定何时压缩历史时使用的预算。每轮重建的页面快照、工具 schema 与系统提示会在压缩判断之后加入，因此真正发给供应商的请求可能超过这个名义预算。

## 配置与优先级

运行时按以下顺序解析配置：

1. 框架默认值；
2. `VITE_AGENT_BASE_URL`、`VITE_AGENT_MODEL` 等环境变量；
3. 通过 `createPling({ agent: { config } })`、组件 `config` 属性或注入模型给出的显式值。

显式值按字段覆盖环境变量。`limits` 与 `retry` 会逐项合并，不会用一个不完整的对象替换整组默认值。

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `baseUrl` | 空 | OpenAI 兼容接口根地址；相对路径走同源代理 |
| `model` | 空 | 供应商模型标识 |
| `apiKey` | 空 | 直连接口使用的 Bearer token |
| `temperature` | `0.3` | 生成随机度 |
| `maxTokens` | `1024` | 单次响应的输出上限 |
| `systemPrompt` | 空 | 追加在框架规则之后的应用角色说明 |
| `stream` | `true` | 网关支持时消费 SSE 文本增量 |
| `defaultApproval` | `"danger"` | 动作未声明 `confirm` 时的默认策略 |
| `minActionIntervalMs` | `0` | 同一批动作之间的最小间隔 |
| `retry.maxRetries` | `3` | 首次失败后的重试次数，范围 0 至 5 |
| `retry.baseDelayMs` | `500` | 指数退避的初始等待 |
| `retry.maxDelayMs` | `4000` | 退避等待上限 |
| `limits.maxTurns` | `10` | 一次 `send()` 内的模型轮次上限 |
| `limits.contextTokens` | `8192` | 用于压缩判断的历史预算；页面上下文与工具 schema 另计 |
| `limits.reserveForOutput` | `1024` | 为下一次回复预留的上下文 |
| `limits.compactRatio` | `0.8` | 可用上下文达到多少比例时压缩 |
| `limits.keepRecent` | `6` | 压缩时原样保留的最近消息数 |

注入 `llm` 后，确定性测试或自定义网关客户端不需要 `baseUrl` 与 `apiKey` 才能就绪。运行时仍会检查限额与重试参数。

## 压缩历史时发生什么

历史预算不等于供应商的完整上下文窗口。Pling 先为下一次回复留出空间，并提前压缩：

```text
可用预算 = contextTokens - reserveForOutput
压缩水位 = floor(可用预算 × compactRatio)
```

按默认值，`8192 - 1024 = 7168` token 可用，压缩水位约为 `5734` token。

估算历史超过水位后，运行时会摘要较早的消息，并保留最近 `keepRecent` 条原文。它不会把 assistant 的工具调用消息与对应的 tool 结果拆开，否则请求会变成非法序列。系统提示每轮都会按当前页面重建，所以模型拿到的是新页面的动作与状态，而不是旧页面的缓存。

压缩会保留任务目标、已确认的决定、约束与未完成工作。它不是完整聊天存档。如果应用需要可审计的记录，应在上下文之外记录会话事件。

## 接入运行时

四个适配器共享同一套 `agent` 配置，区别只在挂载代码。

```ts [Vue 3]
import { createPling } from "@plingjs/vue";

const pling = createPling({
  agent: {
    config: {
      limits: { maxTurns: 100, contextTokens: 16_384, keepRecent: 8 },
      retry: { maxRetries: 2 },
    },
    onEvent(event) {
      if (event.type === "error") console.warn(event.code, event.message);
    },
  },
});
```

```tsx [React]
import { createPling, PlingProvider, AgentDock } from "@plingjs/react";

const pling = createPling({
  agent: {
    config: { limits: { maxTurns: 100, contextTokens: 16_384, keepRecent: 8 } },
  },
});

export function App() {
  return (
    <PlingProvider pling={pling}>
      <TodoPage />
      <AgentDock />
    </PlingProvider>
  );
}
```

```ts [原生 JS / jQuery]
import { createPling } from "@plingjs/vanilla";

const pling = createPling({
  agent: {
    config: { limits: { maxTurns: 100, contextTokens: 16_384, keepRecent: 8 } },
    onEvent(event) {
      if (event.type === "error") console.warn(event.code, event.message);
    },
  },
});

pling.dock({ title: "订单助手" });
```

```ts [Vue 2.7]
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  agent: {
    config: { limits: { maxTurns: 100, contextTokens: 16_384, keepRecent: 8 } },
  },
});

Vue.use(pling.plugin);
pling.dock({ title: "订单助手" });
```

`maxTurns: 100` 适合长教程或演示。生产默认仍是 10。提高上限会扩大一次用户请求可能产生的成本，应同时设置单次运行或单租户预算。

## 工具生命周期钩子

工具钩子是应用级策略缝，不是第二套动作声明。`PreToolUse` 在模型选定动作之后、执行器触达业务控件之前运行，可以拦截这次调用。被拦截时返回 `HOOK_BLOCKED`，发出 `blocked` 事件，业务处理函数不会执行。`PostToolUse` 在动作执行后运行，可以返回一份替换结果；后续钩子与最终工具消息看到的都是替换后的结果。

| 钩子 | 运行时机 | 可以做什么 | 仍然不能做什么 |
| --- | --- | --- | --- |
| `PreToolUse` | 选定动作后、执行前 | 带原因拦截；读取动作 id、模型工具名、参数与轮次 | 创建未声明动作、自行批准，或绕过执行器 |
| `PostToolUse` | 执行后 | 替换返回给模型与事件流的结构化结果 | 撤销业务副作用，或把失败结果变成已执行动作 |

```ts
import { HookRegistry } from "@plingjs/agent";
import { createPling } from "@plingjs/vue";

const hooks = new HookRegistry();

const removePre = hooks.addPreToolUse(({ id }) => {
  if (id.startsWith("delete")) {
    return { blocked: true, reason: "删除需要单独的审批策略" };
  }
});

const removePost = hooks.addPostToolUse(({ result }) => {
  if ("error" in result) return;
  return { result: { ...(result.result as Record<string, unknown>), email: "[redacted]" } };
});

const pling = createPling({
  agent: { config: { limits: { maxTurns: 100 } }, hooks },
});

// 所属插件或策略模块卸载时调用。
removePre();
removePost();
```

钩子按注册顺序执行。前钩子遇到第一个 `blocked` 就终止链；后钩子返回非 `undefined` 时，该结果成为下一个钩子的输入。两个钩子都应保持确定性并有明确上限。不要把后钩子当成页面观察的唯一脱敏边界：`sensitive()` 管的是声明值的出站脱敏，钩子处理的是动作结果。默认不要记录原始参数或结果，它们可能含业务数据或个人数据。

钩子挂在运行时而不是某个页面适配器上，因此四个适配器行为一致。它适合租户策略、单个能力的总开关、结果遮蔽、指标与复核队列，不是持久审计日志，也不替代后端授权。

## 会话生命周期

`AgentSession` 提供：

| 方法或属性 | 行为 |
| --- | --- |
| `send(input)` | 加入用户消息并运行循环；并发调用会排队 |
| `cancel()` | 中止正在进行的模型请求，在下一个安全点退出 |
| `reset()` | 清空消息、摘要、连续性状态与当前运行计数；待确认和人工接力队列需要另行清空 |
| `status()` | 返回 `idle`、`running` 或 `cancelled`；确认与接力等待通过各自队列和事件表达 |
| `events()` | 返回聊天与最近操作视图使用的事件流；会话本身不强制长度上限 |
| `continuity` | 报告跨文档检查点是否启用 |

只清空界面上的聊天记录，不等于开始新会话。旧历史仍可能在下一次请求中被发送。内置清空按钮会调用 `session.reset()`，并清除审批、人工接力队列，重置 telemetry。宿主如果直接调用 `reset()`，需要自己完成这些队列与观测清理。

## 观测

三类记录回答不同问题：

- 会话事件描述用户与界面看到了什么：消息、动作、确认、接力与错误；
- telemetry 汇总模型调用、工具调用、token、估算成本、耗时、重试与错误率；
- trace 保存最近几次真实模型请求，包括 messages 与 tools，供调试使用。

Trace 需要显式开启且有数量上限。它是诊断数据，不是审计日志，也可能包含页面文本或提示词。生产环境不应默认长期保留。

| 适配器 | 运行时诊断 |
| --- | --- |
| Vue 3 | `<AgentDock :debug="{ maxCalls: 8 }">` 在最近操作中显示请求 trace |
| React | `AgentDock.onSessionEvent`、`createPling({ agent: { onEvent } })` 与注入的 telemetry；没有内置检查器 |
| 原生 JS / jQuery | `onSessionEvent`，由宿主应用自行渲染 |
| Vue 2.7 | 共享原生 Dock 的事件；没有内置检查器 |

## 常见失败

| 现象 | 更可能的原因 | 处理 |
| --- | --- | --- |
| 还没发请求就显示 `NOT_CONFIGURED` | 缺少 `baseUrl`、`model`，或直连接口缺少 `apiKey` | 填 `.env.local` 或显式传入 `config` |
| 几次工具调用后停止，没有最终回答 | 已达到 `maxTurns`；此类终止发出提示而非结构化错误 | 先查看会话事件，再有依据地提高上限 |
| 回答忘了较早的决定 | 历史已被压缩成摘要 | 缩小工具结果与状态视图，或把关键决定放进业务状态 |
| 长任务成本异常 | `maxTurns`、`maxTokens` 偏高，或重试放大了调用数 | 设预算，并按请求检查 telemetry |
| 上下文一直不压缩 | 估算 token 尚未达到水位 | 不要强制压缩，先看实际上下文用量 |
| 界面清空后模型仍记得旧内容 | 只清了 UI，没有调用 `session.reset()` | 同时重置会话与审批、接力队列 |
| 网关支持流式却看不到增量文本 | 实际网关不支持 SSE | 关闭 `stream` 或修正网关 |

## 证据

- 运行时与限额默认值：`packages/agent/src/config.ts`。
- 上下文压缩：`packages/agent/src/history.ts`。
- 会话行为：`packages/agent/src/session.ts`。
- Vue 3 的有界调试 trace：`examples/recipes/vue3`。
- 模型设置：`packages/vue/src/model-settings.ts`。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/agent` `0.1.0-alpha.3` |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器；Node 侧使用需 Node.js 20 或更高版本 |
| Peer 依赖 | 无 |
| 稳定性 | 1.0 之前的 alpha；次版本可能改变 API |

本页的限额与默认值来自当前版本的 `packages/agent/src/config.ts`。会话、上下文、压缩和限额字段都处于 1.0 之前；升级次版本后应重新阅读本页，不要沿用旧值。

