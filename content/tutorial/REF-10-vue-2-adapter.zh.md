---
id: REF-10
title: "Vue 2.7 适配器"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# Vue 2.7 适配器（`@plingjs/vue2`）

`@plingjs/vue2` 面向暂时无法迁移到 Vue 3 的应用。它安装 Vue 2.7 指令，提供一组小型组合式 API，并复用 `@plingjs/vanilla` 完成执行、可见性、记录、状态与助手 Dock。

支持范围：仅 Vue 2.7。Vue 2.6 及更早版本没有 `useAgentState` 所需的 Composition API，不在本适配器的支持范围。它们仍可通过 `@plingjs/vanilla` 手动接入，见下文。

## 安装

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  agent: {
    config: {
      baseUrl: "/llm/v1",
      model: "your-model",
    },
  },
});

Vue.use(pling.plugin);

new Vue({ render: (h) => h(App) }).$mount("#app");
```

本包不规定构建工具。Vue 2.7 的 SFC 项目仍需要自己的 Vue 2 编译器配置；适配器只要求应用运行在 Vue 2.7，并在组件挂载前安装插件。

## Vue 2.6 及更早版本

`@plingjs/vue2` 不能用于 Vue 2.6 及更早版本。不要安装本包后尝试注册指令；这些版本应直接安装 `@plingjs/vanilla`，在组件挂载后对 DOM 元素调用 `pling.tool()`、`pling.scope()`、`pling.record()` 和 `pling.state()`。

| 项目版本 | 使用包 | 声明方式 |
| --- | --- | --- |
| Vue 2.7 | `@plingjs/vue2` | 指令、组合式状态辅助函数与自动生命周期清理 |
| Vue 2.6 及更早 | `@plingjs/vanilla` | 手动声明与逐项解绑 |

完整示例见[安装与首次挂载](/zh/vue2/install-and-first-mount)中的 Vue 2.6 小节。Vanilla 路径不提供 `v-tool`、`v-scope`、`v-record`、`useAgentState()` 或自动清理；列表重新渲染后必须重新登记记录与行内动作。

## 公开 API

| 导出 | 用途 |
| --- | --- |
| `createPling(options)` | 创建实例与插件 |
| `usePling()` | 在组件内取当前实例 |
| `useAgentState(key, source, options?)` | 注册只读视图 |
| `useAgentStoreState(key, store, fields 或 selector, options?)` | 从 Pinia / Vuex 挑字段 |
| `v-tool` | 声明元素动作 |
| `v-scope` | 声明区域 |
| `v-record` | 声明一行记录 |
| `pling.dock(options?)` | 挂载共享助手 |
| `pling.action(options)` | 声明函数级动作 |
| `pling.setActiveScopes(ids)` | 手动激活区域 |

`createPling` 接受与 `@plingjs/vanilla` 相同的选项，包括 `ui`、`agent`、`presence`、`derive`、`shared`、`namespace` 与 `defaultApproval`。

## 指令

```vue
<template>
  <section v-scope="{ id: 'todos', label: '待办列表', role: 'list' }">
    <li v-for="task in tasks" :key="task.id" v-record="{ data: task, label: task.title }">
      <button
        v-tool="{ id: `toggle@${task.id}`, desc: `切换完成状态：${task.title}`, kind: 'write' }"
        @click="toggle(task)"
      >
        {{ task.done ? '取消完成' : '完成' }}
      </button>
      {{ task.title }}
    </li>
  </section>
</template>
```

`v-tool` 接受字符串、`ToolOptions` 对象或选项数组；`v-scope` 接受区域 id 或完整区域对象；`v-record` 接受行数据或完整记录对象。

指令在插入时注册，在解绑或更新时注销。`v-for` 中的声明应把业务主键放进 id。

## 只读状态

需要自动清理时，用 Composition API：

```ts
import { defineComponent, ref } from "vue";
import { useAgentState } from "@plingjs/vue2";

export default defineComponent({
  setup() {
    const filter = ref("all");
    const total = ref(24);

    useAgentState("task_view", () => ({
      filter: filter.value,
      total: total.value,
    }), { description: "当前待办筛选与总数" });

    return { filter, total };
  },
});
```

Pinia 与 Vuex 使用同一套字段白名单：

```ts
const todos = useTodoStore();
useAgentStoreState("task_view", todos, ["filter", "appliedSearch", "remaining", "completed"]);
```

字段数组会在注册阶段校验。字段不存在时直接抛错，而不是生成空视图。需要改名或换算时传 selector。

## 助手界面

```ts
const dock = pling.dock({
  title: "待办助手",
  quick: ["新增一条待办", "把第一条待办标记完成"],
});
```

Dock 是共享的原生界面。它支持与其他适配器一致的会话、确认、人工接力、最近操作与观测行为，但不包含 Vue 3 的模型设置面板与调试检查器。

## 支持子集

| 能力 | 状态 |
| --- | --- |
| `v-tool` | 支持 |
| `v-scope` | 支持 |
| `v-record` | 支持 |
| `useAgentState` | 支持 |
| `useAgentStoreState` | 支持 |
| `pling.action()` | 支持 |
| `pling.dock()` | 支持 |
| `confirm` / `handoff` | 通过工具选项支持 |
| `derive` | 通过 vanilla 选项支持 |
| `v-feedback` | 缺失 |
| `v-guide-target` | 缺失 |
| `v-task` | 缺失 |
| 复合 `steps` | 缺失 |
| 模型设置界面 | 缺失 |
| 调试检查器 | 缺失 |
| `inspectCoverage()` | 缺失 |
| Router 页面身份 | 缺失 |

不要因为指令同名就推断它与 Vue 3 等价。跨适配器迁移代码时，请对照 [Vue 3 适配器](/zh/reference/vue-3-adapter)、[React 适配器](/zh/reference/react-adapter)与 [原生 JS / jQuery 适配器](/zh/reference/vanilla-jquery-adapter)的支持表。

## 迁移注意事项

- `@plingjs/vue2` 的最低版本是 Vue 2.7；能升级时先升级 2.6，不能升级时使用 Vanilla 手动接入。
- 插件必须在根组件创建前安装一次。
- 依赖组件生命周期的状态与工具应写在 `setup()` 里，不要放在脱离组件的辅助函数中。
- `v-feedback`、分步指引、任务入口与复合流程需要迁移到 Vue 3，或在 Vue 2 新增实现。
- 适配器复用原生 Dock，样式通过共享 `ui` 选项控制，没有 Vue 3 的组件插槽。

## 常见失败

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| `v-tool` 完全无效 | 挂载前没有安装插件 | 先 `Vue.use(pling.plugin)` |
| `usePling()` 抛错 | 根实例销毁后在组件外调用 | 保留 `createPling()` 的引用 |
| 状态没有清理 | 在 `setup()` 或活动作用域外声明 | 放入 `setup()` |
| 动作 id 重复 | 循环复用了常量 id | 加入行主键 |
| 记录字段不更新 | 传了对象副本 | 传当前行对象 |
| Dock 没有模型 | 没有配置，也没有环境变量 | 配置 `agent.config` |

## 证据

- 适配器实现：`packages/vue2`。
- 可运行示例：`examples/recipes/vue2`。
- 共享执行层：`packages/vanilla`。
- 发布冒烟：`pnpm pack:check` 会构建一个独立的 Vue 2.7 消费方。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/vue2` `0.1.0-alpha.3` |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器中的 Vue 2.7；构建需 Node.js 20 或更高版本 |
| Peer 依赖 | `vue ^2.7.0` |
| 稳定性 | 1.0 之前的 alpha；次版本可能改变 API |

本适配器要求 Vue 2.7，不支持 Vue 3。Vue 2.6 及更早版本可使用 `@plingjs/vanilla` 手动接入；那是另一条接入路径，不是本适配器的能力。受支持的子集就是兼容边界；本页未列出的 API，在当前版本不能通过本适配器使用。
