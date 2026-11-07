---
id: REF-08
title: "React 适配器"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# React 适配器（`@plingjs/react`）

`@plingjs/react` 把 React 的 ref、effect 与 context 接到 Vue 适配器共用的页面运行时上。它不另带执行器，也不另写一套 agent 循环。

对等版本：React 16.3 及以上。Hooks 入口要求 React 16.8+；React 16.3–16.7 使用下面的 legacy 入口。两者都是客户端适配器；Next.js 等 SSR 宿主必须在 DOM 就绪后再创建实例。

## 安装与 Provider

```tsx
import { createRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";
import App from "./App";

const pling = createPling({
  agent: {
    config: {
      baseUrl: import.meta.env.VITE_AGENT_BASE_URL,
      model: import.meta.env.VITE_AGENT_MODEL,
      apiKey: import.meta.env.VITE_AGENT_API_KEY,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <PlingProvider pling={pling}>
    <App />
  </PlingProvider>,
);
```

`createPling(options)` 支持 `ui`、`registry`、`shared`、`namespace`、`onWarn`、`agent`、`revealSensitive`、`scopes`、`presence` 与 `derive`。返回的 `PlingElement` 包含 `registry`、`scopes`、`ui`、`presence`、`derived()`、`setActiveScopes()` 与 `destroy()`。

## Hooks

| Hook | 返回 | 用途 |
| --- | --- | --- |
| `usePling()` | `PlingElement` | 取 Provider 中的实例 |
| `usePlingTool<T>(options)` | `RefCallback<T>` | 声明元素动作 |
| `useAgentTool(options)` | `void` | 声明函数级动作 |
| `usePlingRecord<T>(value)` | `RefCallback<T>` | 声明一行记录 |
| `usePlingScope<T>(options)` | `RefCallback<T>` | 声明区域 |
| `usePlingState(key, source, options?)` | `() => void` | 注册组件级只读视图 |
| `exposePlingState(pling, key, source, options?)` | `() => void` | 在组件树外注册视图 |

`usePlingTool` 接受与 Vue `v-tool` 相同的字段：`id`、`desc`、`kind`、`params`、`run`、`available`、`expect`、`confirm`、`handoff`、`action`、`target`、`autoTarget` 与 `fidelity`。选项从 ref 读取，因此重渲染后处理函数不会停留在旧闭包。

<a id="react-163-167-legacy-entry"></a>

## React 16.3–16.7（legacy 入口）

React 16.3 有 context、ref 和 Fragment，但没有 Hooks。因此默认入口最低支持 React 16.8；更早的应用改用 legacy 入口：

```tsx
import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  AgentDock,
  createPling,
  PlingProvider,
  PlingScope,
  PlingState,
  PlingTool,
} from "@plingjs/react/legacy";

const pling = createPling();

class App extends React.Component {
  state = { count: 0 };

  render() {
    return (
      <PlingProvider pling={pling}>
        <PlingState
          name="counter"
          source={() => ({ count: this.state.count })}
          description="当前计数"
        />
        <PlingScope options={{ id: "todo", label: "待办列表" }}>
          {(scopeRef) => (
            <section ref={scopeRef}>
              <PlingTool options={{ id: "increment", desc: "把计数加一" }}>
                {(toolRef) => (
                  <button ref={toolRef} onClick={() => this.setState({ count: this.state.count + 1 })}>
                    当前：{this.state.count}
                  </button>
                )}
              </PlingTool>
            </section>
          )}
        </PlingScope>
        <AgentDock layout="inline" />
      </PlingProvider>
    );
  }
}

ReactDOM.render(<App />, document.getElementById("root"));
```

legacy 入口用 render props 代替 Hooks：`PlingTool`、`PlingScope`、`PlingRecord`、`PlingFeedback`、`PlingTask` 与 `PlingGuideTarget` 的唯一子节点是 ref 回调；`PlingState` 和 `PlingAction` 不渲染 DOM，挂载时登记、卸载时撤销。`AgentDock` 与 `AgentInline` 挂载共享的 DOM 助手；挂到 `AgentDock` 的 ref 可以用 `open()`、`close()`、`toggle()`、`isOpen()` 和 `destroy()` 控制它。

构建使用经典 JSX 转换，不引用 `react/jsx-runtime`，因此 `react@16.3.0` 即可运行。legacy 的助手是共享 DOM Dock，不是第二套 React 实现；它的“最近操作”和可选的调试、模型设置与 Vanilla 适配器一致。

完整可运行案例有两个：[React 16.3 兼容 Todo](/zh/examples/react16-legacy-todo) 覆盖常规增删改查与状态视图；[React 16.3 课程管理后台](/zh/examples/course-workspace-react16) 则用同一套 legacy 入口完成新建课程、重名查找、新增老师、排课冲突与绑定行备注。两者都使用真实的 `react@16.3.0`、class 组件和 render props，可直接在文档站打开。

## 完整的一行

```tsx
function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const row = usePlingRecord({ data: task, label: task.title });
  const toggle = usePlingTool<HTMLButtonElement>({
    id: `toggle@${task.id}`,
    desc: `${task.done ? "取消完成" : "标记完成"}：${task.title}`,
  });

  return (
    <li ref={row}>
      <button ref={toggle} onClick={() => onToggle(task.id)}>
        {task.done ? "取消完成" : "完成"}
      </button>
      {task.title}
    </li>
  );
}
```

ref 回调在挂载时注册，卸载时注销。记录读取最新的 `task` prop，所以字段更新不需要重新声明。

## 区域与状态

```tsx
function TaskList({ tasks }: { tasks: Task[] }) {
  const scope = usePlingScope<HTMLUListElement>({
    id: "task_list",
    label: "待办列表",
    role: "list",
  });

  usePlingState("task_view", () => ({
    total: tasks.length,
    open: tasks.filter((task) => !task.done).length,
  }), { description: "当前列表的待办总数与未完成数" });

  return <ul ref={scope}>{tasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => {}} />)}</ul>;
}
```

`usePlingState` 没有 setter。要改变列表，必须声明执行改变的动作。

## 助手界面

```tsx
<AgentDock
  title="待办助手"
  quick={["新增一条待办", "把第一条待办标记完成"]}
  config={{ limits: { maxTurns: 100 } }}
/>
```

`<AgentDock>` 负责 runtime、确认面板、人工接力面板与最近操作；`<AgentChat>` 只负责展示，适合宿主自己管理 runtime 和事件流的场景。

给 `<AgentDock>` 传 `debug` 可在运行页开启只读检查器：

```tsx
<AgentDock debug={{ maxCalls: 8 }} />
```

检查器展示打开时的页面投影，以及每次保留的模型调用所收到的消息、工具、响应与请求时页面快照。它读取当前对话正在使用的 runtime，不执行动作，也不创建第二套会话。`debug` 默认关闭；传对象可限制保留的调用数，传 `true` 使用默认上限。检查器会显示发往模型的消息与页面数据，应把它视为开发工具，不要在生产公开构建里无条件开启。

Hooks 入口不提供模型设置界面；legacy 入口使用共享 DOM Dock 提供的模型设置。生产环境的 React 项目仍应把模型凭据留在自己的模型网关之后。

## 能力边界

Hooks 入口支持动作、函数级工具、记录、区域、状态、确认、人工接力、存在感、自动派生、命名空间、共享页面运行时与只读运行检查器。

当前不支持：

- store 字段白名单（`useAgentStoreState`）；
- 复合动作 `steps`；
- 页面反馈、分步指引与任务入口；
- 模型设置界面；
- 覆盖率扫描；
- Router 页面身份。

不要通过引入 Vue 组件来补这些缺口。应新增 React 实现，或把能力下沉到共享层。

legacy 入口通过 render-prop 组件提供页面反馈、分步指引和任务入口。它是 React 16.3–16.7 的兼容路径，不是 Hooks API 的等价替代品。

## 常见失败

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| Hook 抛错，提示没有 Provider | 组件渲染在 `<PlingProvider>` 之外 | 在根节点包一层 |
| 重渲染后动作消失 | ref 换到了别的元素，或元素被卸载 | 把 ref 固定在稳定的可交互节点上 |
| 行内动作作用到错误的行 | id 没有绑定到该行 | 使用 `toggle@${task.id}` |
| 状态不更新 | 捕获了旧值，而不是读取当前值 | 传读取当前 props/state 的函数 |
| Dock 没有模型 | `createPling({ agent })` 与 `<AgentDock>` 都没有配置 | 在其中一个提供 `config`，或使用环境变量 |
| 卸载后 `useAgentTool` 仍然有效 | Hook 在组件外调用 | 移入组件，或显式注销 |

## 证据

- 适配器实现：`packages/react/src`。
- 共享执行器：`packages/core/src/executor.ts`。
- 可运行示例：`examples/recipes/react`。
- 跨适配器复用代码前，请对照 [Vue 3 适配器](/zh/reference/vue-3-adapter)、[原生 JS / jQuery 适配器](/zh/reference/vanilla-jquery-adapter)与 [Vue 2.7 适配器](/zh/reference/vue-2-adapter)的支持表。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/react` `0.1.0-alpha.7` |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | Hooks 入口要求 React 16.8+，legacy 入口支持 React 16.3+；浏览器需支持 ES2022 模块；SSR 与构建需 Node.js 20 或更高版本 |
| Peer 依赖 | `react >=16.3` |
| 稳定性 | 1.0 之前的 alpha；次版本可能改变 API |

本适配器不依赖 Vue，也不绑定特定路由。本页列出的 Provider、Hook、组件名与 props 就是当前版本的公开接口。
