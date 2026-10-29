---
id: J-01
title: "原生 JS 与 jQuery 概览"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 原生 JavaScript 与 jQuery：在现有 DOM 上补上能力声明

很多网页不是由组件框架渲染的。它们使用服务端 HTML、原生 DOM API、jQuery，或者多年积累下来的混合写法。为了接入页面 Agent 而重写这些页面，既不现实，也没有必要。

原生 JS 适配器从相反的方向工作：DOM 仍然是页面本身。Pling 在已有元素上附加声明，并使用与框架适配器相同的运行时、助手界面和执行模型。jQuery 页面也使用同一个适配器：传入底层 DOM 元素，而不是 jQuery 集合。

## API 的形态

| 需要完成的事 | 原生 JS 写法 |
| --- | --- |
| 创建页面运行时 | `createPling()` |
| 描述区域 | `pling.scope(element, options)` |
| 开放控件 | `pling.tool(element, options)` |
| 描述一行数据 | `pling.record(element, value)` |
| 暴露只读状态 | `pling.state(key, read, options)` |
| 挂载助手 | `pling.dock(options)` |

每个声明都会返回一个注销函数。这是它与 React hooks、Vue 指令最明显的区别：当代码移除或替换 DOM 节点时，也要调用对应的注销函数。所有权因此保持明确，也不会要求 Pling 接管你的渲染代码。

## 这条线怎么安排

前几章围绕一个小型 Todo 页面推进，DOM 结构保持稳定：

1. [脚本接入与首次挂载](/zh/vanilla/script-setup-and-first-mount)建立唯一的运行时和助手入口，不开放任何动作。
2. [原生页面快速上手](/zh/vanilla/quick-start-add-pling-to-a-vanilla-page)补充区域、记录行、输入框、提交按钮和完成按钮。
3. 后续章节再处理 data 属性声明、动态 DOM、表格、异步更新、弹窗、多页连续性和测试。

示例使用 Vite，方便仓库直接启动；适配器本身不依赖 Vite。任何能消费 ES modules 的构建环境都可以接入。

## 一条需要尽早说明的规则

不要让声明比对应的元素活得更久。删除一行时，也要注销这一行的记录和行内动作；关闭并丢弃弹窗 DOM 时，也要注销弹窗里的工具。否则页面能力注册表会保留人已经看不见、也无法使用的控件。

下一步阅读 [脚本接入与首次挂载](/zh/vanilla/script-setup-and-first-mount)。
