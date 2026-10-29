---
id: REF-07
title: "Vue 3 适配器"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# Vue 3 适配器（`@plingjs/vue`）

`@plingjs/vue` 是参考适配器，界面能力最完整，也是 Vue 专属声明集的唯一实现。执行判断仍然全部交给 `@plingjs/core`、`@plingjs/dom` 和 `@plingjs/agent`。

## 安装

```ts
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";

const pling = createPling({
  agent: {
    config: {
      baseUrl: import.meta.env.VITE_AGENT_BASE_URL,
      model: import.meta.env.VITE_AGENT_MODEL,
      apiKey: import.meta.env.VITE_AGENT_API_KEY,
    },
  },
});

createApp(App).use(pling.plugin).mount("#app");
```

对等版本：Vue 3。适配器不依赖 Vue Router 或 Pinia。路由支持通过 `page: { router }` 显式开启。

## `createPling(options)`

| 选项 | 默认值 | 用途 |
| --- | --- | --- |
| `ui` | 英文、浅色主题 | 语言、主题、文案覆盖与类名 |
| `registry` | 新注册表 | 测试或高级场景复用注册表 |
| `shared` | — | 接入 `createPlingPage()` 页面运行时；不能与 `registry` / `scopes` 同用 |
| `namespace` | — | 混合框架岛的动作 id 前缀 |
| `onWarn` | `console.warn` | 开发期告警 |
| `agent` | — | 模型配置、钩子、确认通道、追踪与回答语言 |
| `diagnostics` | 仅 Vite 开发期 | 提示未声明的交互控件；不会注册动作 |
| `page` | 自动 | 页面身份；传 `false` 关闭，或传 `{ router }` 接 Vue Router |
| `presence` | 开 | 动作高亮；`false` 关闭 |
| `revealSensitive` | `true` | 在操作者自己的会话里还原脱敏值 |
| `derive` | 关 | 从原生控件自动派生动作 |
| `scopes` | 自动 | 可见性与命中测试的测试注入点 |

`createPling()` 返回 `PlingElement`：`plugin`、`registry`、`ui`、`scopes`、`page`、`feedback`、`ask()`、`inspectCoverage()`、`derived()` 与 `setActiveScopes()`。

## 指令

| 指令 | 值 | 用途 |
| --- | --- | --- |
| `v-tool` | 字符串、`ToolOptions` 或数组 | 声明元素动作 |
| `v-scope` | 字符串或区域选项 | 声明区域 |
| `v-record` | 行数据或完整记录对象 | 声明一行记录 |
| `v-task` | 字符串或 `{ prompt, surface?, disabled? }` | 人的任务入口；不是 agent 动作 |
| `v-feedback` | 字符串、数组或反馈对象 | 让模型看到页面反馈 |
| `v-guide-target` | `{ id, label?, description? }` | 人工接力时高亮非动作目标 |

```vue
<template>
  <section v-scope="{ id: 'todos', label: '待办列表', role: 'list' }">
    <li v-for="task in tasks" :key="task.id" v-record="{ data: task }">
      <button v-tool="{ id: `toggle@${task.id}`, desc: `切换完成状态：${task.title}` }" @click="toggle(task)">
        {{ task.done ? '取消完成' : '完成' }}
      </button>
      {{ task.title }}
    </li>
  </section>
</template>
```

## 组合式 API

| API | 作用域 | 说明 |
| --- | --- | --- |
| `usePling()` | 组件 | 返回已安装的 `PlingElement` |
| `useAgentState(key, source, options?)` | 组件 / effect scope | 只读视图；自动注销 |
| `useAgentStoreState(key, store, fields 或 selector, options?)` | 组件 / effect scope | Pinia / Vuex 字段白名单 |
| `useAgentTool(options)` | 组件 / effect scope | 没有 DOM 元素的函数级动作 |

`useAgentStoreState` 对 Pinia 直接读取 state 与 getter；对 Vuex 先读 `store.state`，再读 `store.getters`。字段在两层都不存在时，注册阶段就会抛错。

## 组件

| 组件 | 用途 |
| --- | --- |
| `<AgentDock>` | 浮窗或侧栏助手；负责位置、任务注册与开关状态 |
| `<AgentInline>` | 把会话嵌进业务列 |
| `<AgentChat>` | 只渲染会话，不负责定位 |
| `<AgentPanel>` | 开发期快照面板；不是生产助手 |

`<AgentDock>` 支持 `layout="dock" | "sidebar"`、`side`、`launcherPlacement`、`launcherLabel`、`quick`、`config`、`debug` 与 `modelSettings`。

```vue
<AgentDock
  layout="sidebar"
  side="right"
  launcher-placement="bottom"
  :debug="{ maxCalls: 8 }"
  :model-settings="{ mode: 'byok', persist: 'session' }"
/>
```

`modelSettings` 有三种模式：

- `off`（默认）：不显示设置界面；
- `readonly`：只展示应用托管的连接，不显示密钥；
- `byok`：允许用户填写 `baseUrl`、`model` 与 `apiKey`；默认只在内存中保留，显式 `persist: "session"` 才写入 sessionStorage。不支持 localStorage。

## 会影响行为的默认值

- 没有声明就没有动作。`derive` 默认关闭。
- `kind` 默认是 `write`；`confirm` 由当前审批策略推导。
- 元素绑定可以自动生成 action id，但列表行必须显式传入稳定 id。
- 状态值在每份快照生成时读取；普通对象会冻结在注册时刻。
- `inspectCoverage()` 只做诊断，不会让未声明控件变得可达。
- `debug` 只在内存中保留最近的模型调用，它不是隐私边界。

## 常见失败

| 症状 | 可能原因 | 检查 |
| --- | --- | --- |
| 快照里没有某个动作 | 元素禁用、被遮挡、区域未激活，或 `available()` 返回 false | 打开诊断面板读原因 |
| 状态一直停在初始值 | 传了普通对象而不是读取函数 | 改成 `() => ({ ... })` |
| 同一个 id 出现两次 | 跨行手动 id 冲突 | 带上行主键或使用 `namespace` |
| 路由变了，模型却以为还在旧页面 | `page` 关闭，或没有传 router | 传 `page: { router }` 并配置 query 白名单 |
| 看不到模型设置 | 模式是 `off`，或没有传给实际挂载的入口 | 在 `<AgentDock>` 或 `createPling({ agent })` 上设置 `modelSettings` |
| 调试面板没有请求 | `debug` 关闭，或调用被清空 | 开启 `debug`，复现一次请求 |

## 证据

- 完整学习路径：[Vue 3 教程](/zh/vue/)。
- 适配器实现：`packages/vue/src`。
- 调试检查器：`packages/vue/src/components/AgentDebug.vue`。
- 模型设置：`packages/vue/src/components/AgentModelSettings.vue`。
- 可运行示例：`examples/recipes/vue3`。
- 跨适配器复用代码前，请对照 [React 适配器](/zh/reference/react-adapter)、[原生 JS / jQuery 适配器](/zh/reference/vanilla-jquery-adapter)与 [Vue 2.7 适配器](/zh/reference/vue-2-adapter)的支持表。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/vue` `0.1.0-alpha.2` |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器中的 Vue 3；SSR 与构建需 Node.js 20 或更高版本 |
| Peer 依赖 | `vue ^3` |
| 稳定性 | 1.0 之前的 alpha；次版本可能改变 API |

本适配器不支持 Vue 2；Vue 2 请使用独立的 2.7 适配器。本页列出的指令、组合式函数、组件名与 props 就是当前版本的公开接口。
