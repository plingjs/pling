---
id: V2-01
title: "Vue 2.7 支持声明"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# Vue 2.7 支持声明

`@plingjs/vue2` 用于把已有的 Vue 2.7 应用接入 Pling。它是一个适配器，不是 Vue 3 接入方式的另一份分支。应用继续使用原有的组件、状态、事件处理函数和渲染模型；Pling 增加能力注册表、指令和基于 DOM 的问答入口。

`@plingjs/vue2` 的受支持版本是 Vue 2.7。Vue 2.6 及更早版本没有它使用的 Composition API，因此不能使用这个适配器；不过这些项目仍可以通过 `@plingjs/vanilla` 手动声明页面能力。两种接入方式的范围不同，见下文。Vue 3 使用 `@plingjs/vue`，安装代码和学习路线也不同。

## 版本选择

| 项目版本 | 接入方式 | 得到什么 |
| --- | --- | --- |
| Vue 2.7 | `@plingjs/vue2` | `v-tool`、`v-scope`、`v-record`、状态辅助函数和生命周期清理 |
| Vue 2.6 及更早 | `@plingjs/vanilla` | 在组件挂载后手动调用 `pling.tool()`、`pling.scope()`、`pling.record()`、`pling.state()` 和 `pling.dock()` |

如果项目可以升级，优先升级到 Vue 2.7，再使用 `@plingjs/vue2`。无法升级时，Vanilla 路径仍然可以让已有页面接入 Pling；代价是声明和清理都要由应用代码显式完成。

## 适配器提供什么

| 需求 | Vue 2.7 中的写法 |
| --- | --- |
| 创建并安装运行时 | `createPling()`，然后 `Vue.use(pling.plugin)` |
| 描述页面区域 | `v-scope` |
| 描述一个控件 | `v-tool` |
| 描述一行或其他业务记录 | `v-record` |
| 读取经过筛选的状态视图 | `useAgentState()` 或 `useAgentStoreState()` |
| 挂载助手 | `pling.dock()` |

`pling.dock()` 复用共享的 DOM 问答入口。Vue 2 适配器不会另外实现一套行为不同的聊天界面。

## 不提供什么

- 不能让 Vue 2.6 应用使用 `v-tool`、`v-scope`、`v-record` 或 `useAgentState()`。这些项目应改用 `@plingjs/vanilla`。
- 不接管路由、状态管理、表单提交或服务端持久化。
- 不替代无障碍属性，也不替代服务端授权。
- 不会让 Vue 2 应用等同于 Vue 3 应用。支持的 API 与迁移方式仍然分开说明。

当应用已经运行在 Vue 2.7，并且只需要把选定的控件以受控方式开放给智能体时，这个适配器是合适的。新的应用通常应直接从 Vue 3 开始。对于旧应用，应先声明一个最小可用范围，再只向已经理解的业务操作扩展。

Vue 2.6 及更早版本的 Vanilla 接入没有适配器代管声明。组件销毁时要逐项解绑，列表重新渲染后也要重新登记行记录与行内动作；相应写法见[安装与首次挂载](/zh/vue2/install-and-first-mount)。

## 接入边界

接入代码应放在页面入口，以及原本就拥有业务控件的模板或渲染函数中。智能体通过用户会触发的同一条浏览器事件路径执行已声明的控件：

1. 适配器注册元素或区域。
2. 执行器解析声明的动作。
3. 浏览器派发 click、input 或 form 事件。
4. 原有的 Vue 处理函数更新应用状态。
5. 下一份注册表快照反映页面的实际结果。

这个顺序很重要。声明不是第二套业务实现，点击成功也不等于远端服务器已经接受修改。

下一步：[安装与首次挂载](/zh/vue2/install-and-first-mount)。
