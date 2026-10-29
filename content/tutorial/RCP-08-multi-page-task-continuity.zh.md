---
id: RCP-08
title: "多页任务连续性"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 多页任务连续性

一项任务经常跨多个文档：在列表页搜索，在详情页修改，在结果页确认，再回到原列表。单页应用能在路由切换时保留内存中的运行时；整页文档应用不能。Pling 的连续性层处理第二种情况，但不会恢复旧 DOM。

这篇配方让同一标签页、同一 origin 下的整页导航保留一个目标、一份有界检查点和一个执行者。

## 可运行页面

下面的页面用两次完整 document 导航完成一个任务：在列表页打开 Globex，在详情页写入备注，成功后返回列表。它不是在同一页里切换一个假路由。

<DemoPlayground id="recipe-continuity" />

从仓库根目录运行：

```bash
pnpm dev:examples
```

打开 `http://localhost:5191/demos/recipe-continuity/?lang=zh`。源码在 `examples/demos/recipe-continuity/`；示例使用同一标签页的 `sessionStorage`，不依赖后端。

## 选择正确机制

| 应用形态 | 机制 | 保留什么 |
| --- | --- | --- |
| SPA 路由切换 | 内存运行时加页面身份 | 会话与历史；当前路由仍挂载组件产生的声明与注册 |
| 整页文档导航 | `continuity: "tab"` 或 `scope` 为 `tab` 的对象 | 有界快照、摘要、最近消息、目标、开始页 |
| 新标签页或跨设备 | `continuity: { scope: "browser" \| "remote" }` 加 authority | 共享任务与租约，不保留旧文档 |

从整页导航场景开始。如果路由切换不会卸载文档，不要为了“看起来连续”而开启 continuity；应暴露当前路由身份。

## MPA 配置

两个页面必须使用同一个 Pling 版本、同一个 origin、同一个浏览器标签页和同一个 continuity key。

### Vue 3

```ts
import { createPling } from "@plingjs/vue";

const pling = createPling({
  agent: {
    continuity: {
      key: "order-review",
      resume: "auto",
      returnOnDone: true,
    },
  },
});

pling.registry.setPage({ path: location.pathname, title: document.title });
```

真正的整页 Vue 应用会在每个页面重新创建应用，并复用同一个 `agent.continuity` 配置。页面身份用 `pling.registry.setPage()` 显式设置；路由集成属于下面的 SPA 场景。

### React

```tsx
import { createPling } from "@plingjs/react";

const pling = createPling({
  agent: {
    continuity: { key: "order-review", resume: "auto", returnOnDone: true },
  },
});

pling.registry.setPage({ path: location.pathname, title: document.title });
```

每个文档重新挂载 Provider 与 `<AgentDock>`，它们会从 session storage 恢复检查点。

### 原生 JS / jQuery

```ts
const pling = createPling({
  agent: {
    continuity: { key: "order-review", resume: "auto", returnOnDone: true },
  },
});

pling.registry.setPage({ path: location.pathname, title: document.title });
pling.dock({ title: "订单助手" });
```

### Vue 2.7

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  agent: {
    continuity: { key: "order-review", resume: "auto", returnOnDone: true },
  },
});

Vue.use(pling.plugin);
pling.registry.setPage({ path: location.pathname, title: document.title });
pling.dock({ title: "订单助手" });
```

Vue 2.7 复用共享原生 Dock，也包括 continuity。它没有自动路由身份集成；宿主需要时手动设置页面。

## 检查点里有什么

| 字段 | 用途 | 默认上限 |
| --- | --- | --- |
| `goal` | 用户最初的任务目标 | 首次 `send()` 输入 |
| `page` | 上一页的页面视图 | 有界的路径、标题与选定参数 |
| `startPage` | 任务开始的位置 | 供 `returnOnDone` 使用 |
| `messages` | 最近完整消息，不含系统提示 | 20 条，每条 4000 字符 |
| `events` | 最近界面事件 | 60 条 |
| `summary` | 压缩后的历史摘要 | 有界 |
| `status` | `active` 或 `done` | 持久化 |
| `updatedAt` | 过期判断 | 默认 2 小时 |

它不包含 DOM、注册项、待确认动作、待人工接力或未脱敏敏感值。新页面声明自己的动作与记录。系统提示按新页面重建，再与恢复的历史组合。

## 恢复模式

`resume` 接受：

- `"ask"`（默认）：显示“继续上次任务”，等待用户决定；
- `"auto"`：新页面挂载后自动发送一条受控的继续消息；
- `"off"`：只恢复历史，不显示自动入口。

`auto` 不会重放上一页动作。它发送一条提示，要求模型先检查当前页面，不能假设被中断的动作已经成功。危险动作仍会经过确认闸门。

`returnOnDone: true` 只在恢复的任务完成时回到 `startPage`。当前地址已经是开始页时不会重新加载。需要明确目的地时使用 `{ to, delayMs }`。

## SPA 页面身份

SPA 保持一个运行时，在路由变化时更新页面身份。Vue 3 可以自动读取 Vue Router，也可以显式传入：

```ts
const pling = createPling({
  page: {
    router,
    queryKeys: ["status"],
    hash: true,
  },
});
```

只有列出的 query key 会暴露。带有访问 token、签名下载链接或回跳地址的 URL 不应进入模型上下文。React、原生 JS 与 Vue 2.7 在导航后调用 `pling.registry.setPage()`，传入有界对象，不要传整个 route。

## 完整序列

1. 用户在列表页要求修改订单 SO-1042。
2. 模型打开记录或调用导航动作。
3. 浏览器卸载列表文档，加载详情文档。
4. 运行时恢复目标、摘要、最近消息与开始页。
5. 新页面声明自己的表单、记录与动作。
6. `resume: "auto"` 时收到一条受控继续消息；`"ask"` 时由用户决定。
7. 模型先读取新页面，再执行动作。
8. 恢复的任务完成后，`returnOnDone` 回到列表页。

返回是导航，不是回滚。如果用户在详情页修改了数据，列表必须从数据源重新加载。

## 常见失败

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 新页面从空对话开始 | origin、标签页、存储 key 不同，或 continuity 未开启 | 使用同一个 key，并确认 `sessionStorage` 可用 |
| 两个 Dock 互相覆盖 | 同一标签页有多个启用 continuity 的表面写同一 key | 每个标签页只让一个表面写检查点 |
| 模型假设被中断的动作已成功 | 检查点记录了没有结果的 in-flight 工具调用 | 继续提示必须检查页面，并显示“结果未知” |
| 任务完成后回到错误页面 | 手动覆盖了 `startPage`，或 `returnOnDone.to` 有误 | 首次发送时记录开始页；使用明确的同源目的地 |
| 页面上下文中出现 token | 暴露了完整 URL 或 route 对象 | 只开放白名单 query key，用有界字段设置页面身份 |
| 导航后待确认动作消失 | 待确认按设计不会恢复 | 让用户检查新页面后再发起动作 |
| 虚拟列表丢失目标行 | 该行从未进入 DOM | 提供服务端查找或加载动作 |

## 安全边界

检查点是会话数据，不是授权凭证。恢复的对话仍要认证、限制新页面范围，并确认敏感动作。不要把 API key、完整访问 token 或未脱敏敏感值写进 continuity 存储。

## 证据

本方案的可运行源码是 `examples/demos/recipe-continuity/`。列表页与详情页共享同一个连续性 key，测试的是真实 document 卸载与恢复，而不是组件内状态。

## 本地验证

输入“打开 Globex，把备注写成周五约吃饭，然后保存”。观察浏览器地址从列表页切换到详情页，助手在详情页恢复任务、只保存一次，完成后回到列表；返回后的数据应从业务状态重新读取。

