---
id: TS-10
title: "SSR 或 hydration 破坏页面"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# SSR 或 hydration 破坏页面

服务端没有 `window`、`document`、`MutationObserver` 或真实事件循环。把浏览器专用初始化放在模块顶层，会在 SSR 阶段直接报错；放在首次渲染中，也可能造成 hydration 不一致。

## 常见症状

| 症状 | 可能原因 |
| --- | --- |
| `window is not defined` | 模块导入时执行浏览器代码 |
| Hydration mismatch | 服务端与客户端首次 DOM 不同 |
| 动作在首屏不可用 | 插件在挂载后才安装 |
| 双重注册 | 服务端渲染与客户端重复初始化 |
| 路由切换后崩溃 | 单例跨请求复用 |
| 监听器泄漏 | 插件卸载未清理 |

## Vue / Nuxt

- 在插件或组件 `onMounted` 后创建 `createPling()`；
- 不要把实例放进跨请求共享的模块单例；
- 使用 `.client` 插件或显式客户端条件；
- hydrate 前保证服务端与客户端渲染相同结构；
- 路由切换时重新创建页面声明，或确保作用域正确销毁。

参考 [Nuxt 与服务端渲染](/zh/vue/nuxt-and-ssr)。

## React / Next.js

- 在客户端组件中使用 Provider，检查 `"use client"` 边界；
- 不在模块顶层访问浏览器全局；
- 避免在首次 render 中根据 `window` 生成不同 DOM；
- 延迟到 effect 或客户端挂载后创建运行时；
- 服务端组件不能传递不可序列化的实例或函数。

参考 [Next.js 与 SSR](/zh/react/next-js-and-ssr)。

## 排查顺序

1. 先在服务端日志找第一个 `window` / `document` 访问。
2. 在浏览器控制台检查 hydration 警告与组件边界。
3. 禁用 Pling 初始化，确认基础页面 SSR 正常。
4. 将运行时创建移到客户端生命周期。
5. 检查插件是否被重复安装、单例是否跨请求复用。
6. 用真实构建而不是仅 dev server 测试。

## 安全与一致性

SSR 页面可能先返回未登录或占位内容。不要在服务端把受保护数据写进 HTML 后再由客户端能力面假设已登录。每次请求重新验证身份；不要把请求级会话缓存在全局模块中。

## 验收标准

- 服务端渲染无浏览器 API 访问；
- hydration 无结构不一致警告；
- 首屏后动作在明确时机出现；
- 两个并发请求不共享用户状态；
- 路由切换与组件卸载正确清理监听器和注册；
- 生产构建下的 SSR 与客户端行为都有测试。

## 相关

[Nuxt 与服务端渲染](/zh/vue/nuxt-and-ssr)、[Next.js 与 SSR](/zh/react/next-js-and-ssr)、[投影：Shadow DOM 与 iframe](/zh/concepts/projection-shadow-dom-and-iframes)。
