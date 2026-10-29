---
id: R-01
title: "React 学习路径"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# React：在现有页面上声明能力

Pling 的 React 适配器把现有应用接入页面能力运行时。它不接管 React 的状态、路由、表单或渲染；适配器提供的是一层 Provider 和少量 hooks，把声明挂到你原本就渲染的元素上。

这个边界决定了代码的位置：Todo 列表继续用 `useState` 或自己的 store 保管任务，表单仍调用原来的提交函数。Pling 只补充页面能力声明和助手入口，Agent 最终进入与人相同的控件与业务路径。

## 教程的组织方式

教程按 Vue 3、React、原生 JS / jQuery 和 Vue 2.7 分成独立学习线。你只需要跟着与项目相符的一条，不必先读其他框架的写法。

每条线先从一个完整的 Todo 页面跑通最小闭环，再逐章加入动作参数、记录、区域、流程、状态和确认等能力。业务页尽量保持不变，变化集中在接入声明。代码块会标出本章新增或改动的行；示例按章独立运行，可以边读边对照。

跨框架的共性问题和运维问题集中在「概念」与「运维」章节。需要查完整参数时看「参考」；处理表格、批量操作、上传等具体任务时看「实战方案」；遇到报错或异常现象时看「排障」。主线章节建议按顺序完成，其余部分按需查阅即可。

## 这条线怎么安排

1. [安装、Provider 与首次挂载](/zh/react/install-provider-and-mount)建立唯一的页面运行时和助手入口。此时页面还没有开放任何动作。
2. [React 快速上手：一个可用的 Todo Agent](/zh/react/quick-start-add-pling-to-a-react-app)补充任务区域、记录、输入、提交和行内完成操作。
3. 后续章节依次处理显式动作、记录与行内动作、区域、流程、状态、模型网关、测试和生产控制。

入门阶段保持同一个 Todo 业务页面。页面越稳定，接入本身越清楚：每章改变的是“页面声明了什么”，而不是“页面变成了另一套应用”。

## React 适配器补了什么

| 需要完成的事 | React 写法 |
| --- | --- |
| 共享一个页面运行时 | `<PlingProvider pling={pling}>` |
| 描述页面区域 | `usePlingScope()` |
| 开放一个控件 | `usePlingTool()` |
| 描述一行或其他记录 | `usePlingRecord()` |
| 暴露只读状态 | `usePlingState()` |
| 挂载问答入口 | `<AgentDock>` |

这些 hook 返回 React ref。你把它交给原本负责业务行为的元素即可，不需要再用包装组件接管该控件，也不会出现第二套点击实现。

## 适用范围

React 适配器支持 React 18 及更新版本，面向客户端渲染的 React 应用。Next.js 与服务端渲染需要额外处理 ref 和浏览器 API 的执行时机，属于后续章节，不应混入首次安装。

示例使用 Vite，但 Pling 本身不依赖 Vite。换用其他构建工具时，请显式传入模型配置，不要依赖 `VITE_AGENT_*` 快捷方式。

下一步阅读 [安装、Provider 与首次挂载](/zh/react/install-provider-and-mount)。
