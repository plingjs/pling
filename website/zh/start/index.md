---
id: SITE-02
title: "开始"
description: "选择最短的可用路径，或在写代码之前先理解 Pling 的工作方式。"
status: drafted
release: 0.1
prereq: ""
locale: zh
---

# 从这里开始

Pling 是面向 Web 应用的能力层。它把应用本身已经会执行的操作，以明确的契约交给 Agent。Agent 不扫描页面去猜哪个按钮可以点，而是从团队声明的动作中选择。

Pling 不替换 Vue、React、DOM 或后端。它在页面和 Agent 之间增加一层契约，并用运行时让声明过的动作沿着页面原有行为执行。

## 从框架快速上手

**Vue 3** — [Vue 快速上手：接入 Pling](/zh/vue/quick-start-add-pling-to-a-vue-app)  
安装插件，声明完成一个任务所需的控件，再挂载助手。教程从一个可运行的 Todo 页面开始。

**React** — [React 快速上手：接入 Pling](/zh/react/quick-start-add-pling-to-a-react-app)  
安装 Provider，声明第一个动作，并在 React 应用中挂载助手。

如果只想先看交互效果，不安装任何东西，打开[在线案例](/zh/examples/)。

## 开始前需要什么

两条快速上手路径都假设你已经有：

- 一个 Vue 3 或 React 应用；
- Node.js 20 或更新版本，用于运行教程工具；
- 一个接受 OpenAI 兼容 Chat 请求的模型端点。

本地开发时，页面可以直接请求模型端点。生产环境应让模型流量经过自己的服务端或网关，使凭据和策略不进入浏览器。

Pling 不内置托管模型，也不绑定某一家模型供应商。使用哪个端点、如何鉴权，由应用决定。
