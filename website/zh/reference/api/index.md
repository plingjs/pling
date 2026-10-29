---
title: "API 参考"
status: navigation
release: 0.1
locale: zh
---
<!-- generated:api-index -->

# API 参考

先选择你正在使用的框架。每个框架页只展示该框架的入口、选项、默认值与示例，不再把四种写法混在同一张表里。共享的运行时与测试 API 单独成页。

参数表是这里的重点。遇到某个选项时，先查它在当前框架页中的类型、必填性、默认值与适用场景；需要字段级语义或错误码时，再进入对应参考页。

共 **5** 个 API 页面，覆盖 **9** 类能力；当前版本 `0.1.0-alpha.3`，稳定性为 **preview**。

## 按框架查阅

| 框架 | 包 | 条目 | 页面 |
| --- | --- | --- | --- |
| **Vue 3 API** | `@plingjs/vue` | 43 | [打开](/zh/reference/api/vue-3) |
| **React API** | `@plingjs/react` | 39 | [打开](/zh/reference/api/react) |
| **Vue 2.7 API** | `@plingjs/vue2` | 25 | [打开](/zh/reference/api/vue-2) |
| **原生 JS API** | `@plingjs/vanilla` | 27 | [打开](/zh/reference/api/vanilla) |

## 共享包 API

运行时、页面连续性、测试与诊断 API 共用一套实现，共 **33** 个条目。

[打开共享包 API](/zh/reference/api/shared)

## 版本与兼容性

| 包 | 版本 | 对等依赖 |
| --- | --- | --- |
| `@plingjs/vue` | `0.1.0-alpha.3` | `vue ^3` |
| `@plingjs/react` | `0.1.0-alpha.3` | `react >=18` |
| `@plingjs/vue2` | `0.1.0-alpha.3` | `vue ^2.7.0` |
| `@plingjs/vanilla` | `0.1.0-alpha.3` | — |

| 项目 | 值 |
| --- | --- |
| 引入版本 | `0.1.0-alpha.2` |
| 运行时 | ES 模块；Vue 3、React 18+、Vue 2.7 或原生浏览器环境 |
| 稳定性 | pre-1.0 alpha；次要版本可能改变 API |

## 机器可读副本

- [API 总览 JSON](/zh/api-index.json)
- [Vue 3 API JSON](/zh/api-index/vue-3.json)
- [React API JSON](/zh/api-index/react.json)
- [Vue 2.7 API JSON](/zh/api-index/vue-2.json)
- [原生 JS API JSON](/zh/api-index/vanilla.json)
- [共享包 API JSON](/zh/api-index/shared.json)

## 不在本页范围内

- Surface 协议、委托、Node 网关与协议 Schema 分别见各自专题参考。
- 适配器的支持矩阵不代表四个框架的行为完全相同。
- 包内工具函数、组件内部接口与未导出类型不在这里承诺兼容。
