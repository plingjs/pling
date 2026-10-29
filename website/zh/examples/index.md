---
id: SITE-03
title: "在线案例"
description: "可运行的 Pling 案例：真实模型、页面源码，以及与人工控件共用的业务路径。"
status: draft
release: 0.1
prereq: ""
locale: zh
---

# 在线案例

这些是可运行的页面，不是录屏。每个示例都保留自己的组件、状态与业务处理函数；Pling 只增加一小块能力面，并把页面接到真实模型。

建议先打开在线案例，再阅读接入说明和源码。接入说明会直接对应到具体代码行：在哪创建运行时、在哪声明动作、在哪暴露记录、在哪加入确认闸门。

公开示例的模型请求都经过服务端网关。浏览器只拿到同源地址和模型名，供应商凭据留在服务端。

教程中的每一章也有对应的完整页面。需要先看运行结果、再读代码时，可以打开<a href="/demos/tutorials/" target="_blank" rel="noopener noreferrer">全部章节示例</a>；每个教程页顶部同样提供该章的在线预览与本地命令。

## 五个经典案例

这五个案例分别覆盖最小接入、真实业务工作台、Vue 3 单页内跨路由操作、整页导航后的任务连续性，以及向页面之外的 Agent 开放能力。

<DemoGallery />

## 十四项可运行方案

每项方案都有独立页面、源码目录、本地命令与失败路径。模型网关和本地 access service 由同一条命令启动。

```bash
pnpm dev:examples
```

<DemoGallery group="recipes" />

## 如何阅读示例

1. **打开在线案例。** 先用人工界面完成一次操作，再让助手完成同一件事。
2. **切换到接入说明。** 按顺序看配置、运行时、动作声明和助手入口。
3. **查看源码。** 高亮行分别标出导入、运行时初始化、动作声明和助手入口。

每个案例都有独立说明页、在线案例、完整源码与逐行走查。案例05另附本地 MCP 桥，可把同一组 Todo 能力接到 Codex、Claude，以及其他支持 stdio MCP 的 Agent。

准备修改自己的应用时，继续进入 [Vue 快速上手](/zh/vue/quick-start-add-pling-to-a-vue-app)或 [React 快速上手](/zh/react/quick-start-add-pling-to-a-react-app)。
