---
id: R-24
title: "Next.js 与服务端渲染"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# Next.js 与服务端渲染

在服务端渲染的 React 应用里，有两个时机不能混在一起。业务页面必须在浏览器出现之前生成可读的 HTML；Pling 必须等到浏览器水合这份 HTML、DOM 目标已经存在之后，再创建运行时并登记能力。

本章用一个较小的 Vite SSR 示例把这两个时机展示清楚。它使用的 React 能力与 Next.js App Router 相同：服务端渲染、水合、客户端组件和只在浏览器创建的运行时。最后一节说明同一套边界在 `app/` 目录中的位置，但不会把一个小型构建说成完整的 Next.js 应用。

## 首屏不依赖助手

待办页面接收语言参数，从确定的初始数据开始渲染。第一次输出已经包含标题、表单、待办行和计数。这条路径不调用 `createPling`，不解析 DOM 目标，也不创建模型会话。

示例把页面状态放在 `App`，只延后助手子树：

```tsx
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

return (
  <main>
    <TodoPage tasks={tasks} counts={counts} />
    {mounted ? <TodoAssistant ... /> : null}
  </main>
);
```

服务端渲染和客户端第一次渲染时，`mounted` 都是 `false`，所以两边生成的树一致。水合完成后 effect 才把这个值改为 `true`，这时创建 Pling、针对已经存在的页面登记能力才是安全的。

不要只用 `typeof window !== "undefined"` 包住这段子树。客户端第一次渲染仍然要和服务端结果一致。用水合后的状态显式控制边界，原因更清楚。

服务端入口渲染同一棵组件树：

```tsx
export function renderTodoSsr(locale: DemoLocale): string {
  return renderToString(<App locale={locale} />);
}
```

HTTP 处理函数把这段字符串放进页面，再返回给浏览器。请求 `/?lang=zh` 时，第一份响应里已经有中文待办，而不是一个等待 JavaScript 填充的空根节点。

## 在客户端创建运行时

浏览器入口水合已有 HTML，而不是替换它：

```tsx
const pling = createPling({
  ui: { locale: plingLocale(locale) },
  agent: {
    config: { limits: { maxTurns: 100 } },
  },
});

hydrateRoot(
  document.getElementById("root")!,
  <PlingProvider pling={pling}>
    <App locale={locale} />
  </PlingProvider>,
);
```

这里有三项前提：

- 服务端和浏览器必须拿到相同的初始语言与初始数据；
- 浏览器必须水合服务端生成的那棵树；
- `createPling` 只能放在浏览器入口，不能放在每次请求都会被服务端求值的共享模块顶层。

Pling 的区域观察器、目标解析、存在感层和模型循环都依赖浏览器文档。服务端包里的模块级单例，要么在导入时访问不存在的全局对象，要么被不相关的请求共用。

## 水合完成后再登记能力

助手是一个只在页面水合后出现的子组件。它接收当前记录和已有业务处理函数，再登记函数级工具：

```tsx
usePlingState("todo_ssr", () => ({ ...counts }), {
  description: copy.overview,
});

useAgentTool({
  id: "todo.add",
  desc: copy.addDescription,
  kind: "write",
  params: [{ name: "text", label: copy.taskLabel, minLength: 1, maxLength: 80 }],
  run: (args) => onAdd(String(args.text)),
});

useAgentTool({
  id: "todo.clear_completed",
  desc: copy.clearDescription,
  kind: "danger",
  confirm: "always",
  run: onClear,
});
```

这些是页面原本就有的能力，不是第二套状态。新增待办调用表单使用的同一个 React setter；清除已完成仍然经过 Pling 的确认闸门。助手卸载时，这些登记也一起移除。

只读工具每次执行时读取当前值，而不是返回首次渲染时捕获的快照：

```tsx
useAgentTool({
  id: "todo.overview",
  desc: copy.overview,
  kind: "read",
  run: () => ({
    ...counts,
    records: tasks.map(({ id, text, done }) => ({ id, text, done })),
  }),
});
```

处理函数和数据都属于持有页面状态的客户端组件。示例因此可以水合整棵树，再把助手晚一步接上去。服务端组件不能把事件处理函数传给客户端边界；当能力需要操作本地 UI 状态时，状态所在的 workspace 本身必须是客户端组件。

## Next.js App Router 中的同一道边界

在 Next.js App Router 中，路由页可以继续做服务端组件。它加载数据，再把可序列化的初始值交给客户端 workspace：

```tsx
// app/page.tsx
import { TodoWorkspace } from "./todo-workspace";

export default function Page() {
  return <TodoWorkspace initialTasks={loadTasks()} locale="en" />;
}
```

workspace 是客户端组件，因为它持有交互状态并登记页面能力：

```tsx
// app/todo-workspace.tsx
"use client";

import { useEffect, useState } from "react";
import { createPling, PlingProvider } from "@plingjs/react";

export function TodoWorkspace(props: Props) {
  const [mounted, setMounted] = useState(false);
  const [pling] = useState(() => createPling({
    agent: { config: { limits: { maxTurns: 100 } } },
  }));

  useEffect(() => {
    setMounted(true);
    return () => pling.destroy();
  }, [pling]);

  return (
    <PlingProvider pling={pling}>
      <TodoPage {...props} />
      {mounted ? <TodoAssistant {...props} /> : null}
    </PlingProvider>
  );
}
```

Next.js 仍会在服务端渲染这个客户端组件，以生成首屏 HTML；但 effect 和 DOM 观察器只在浏览器运行。`PlingProvider` 只提供上下文，不生成标记，所以包一层不会改变服务端输出。

`mounted` 控制的是能力与 `AgentDock` 何时进入客户端树，不能代替浏览器判断：客户端组件同样会经历服务端渲染。运行时必须留在只在浏览器执行的生命周期里。若应用需要在客户端导航之间复用一个实例，可以把它放进专门的应用级客户端 Provider，并在该 Provider 离开根节点时销毁。

如果 workspace 是服务端组件，而助手需要操作服务端数据，应通过带鉴权的服务端接口完成业务操作，再登记调用这些接口的工具。不要为一个浏览器里并不存在的控件虚构 DOM 动作。

## 运行示例

运行英文示例：

```bash
pnpm tutorial:dev r-24
```

打开 `http://127.0.0.1:5264/`。运行中文示例：

```bash
pnpm tutorial:dev r-24 --locale zh
```

打开 `http://127.0.0.1:5264/?lang=zh`。第一份响应已经包含业务页面，助手在水合之后出现。禁用 JavaScript，待办列表仍然可读。

确定性检查：

```bash
pnpm tutorial:check r-24
```

测试会先在服务端渲染页面，确认输出里没有助手外壳；然后水合同一份标记，确认四个工具完成登记，并在已水合的页面上执行 `todo.add`。

## 常见问题

**模块在服务端被导入时就创建 Pling。** 运行时会访问 `document`，模块级单例还可能跨请求泄漏状态。应放在浏览器入口或只在客户端执行的生命周期中。

**助手在水合前就进入组件树。** 服务端标记和客户端第一次渲染不一致，能力层也可能查找尚不存在的目标。用水合后设置的状态控制助手子树。

**两侧使用不同的数据。** 语言、初始记录和服务端提供的其他初始值必须一致。它们应来自可序列化 props，而不是一侧读请求参数、另一侧读 `window`。

**工具闭包保存了过期状态。** 在执行动作时读取当前值。注册表能保留动作，却无法修复处理函数里已经捕获的旧快照。

**把 SSR 当作模型安全边界。** 服务端渲染不提供鉴权、限额、密钥隔离或审计。这些仍属于模型网关和部署边界。
