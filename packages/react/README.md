# @plingjs/react

Pling 的 React 适配器：把 React 元素与函数声明成 agent 动作，并复用 `@plingjs/core` 的执行、权限与错误契约；记录、区域、只读状态与问答入口同样在第一方 API 内。

```bash
pnpm add @plingjs/react @plingjs/core react
```

```tsx
import { createRoot } from "react-dom/client";
import { AgentDock, createPling, PlingProvider, usePlingTool } from "@plingjs/react";

const pling = createPling();

function App() {
  const add = usePlingTool<HTMLButtonElement>({ id: "add", desc: "新增一条记录" });
  return <button ref={add} onClick={addItem}>新增</button>;
}

createRoot(document.getElementById("root")!).render(
  <PlingProvider pling={pling}><App /><AgentDock /></PlingProvider>,
);
```

混合页面里如果多个岛都写 `draft` / `submit`，给适配器加 `namespace` 即可：
`createPling({ shared: page, namespace: "react" })`。动作、记录、区域与状态 key 都会加前缀；
`remove@item-1` 里的记录引用也会落成 `react/item-1`。

`<AgentDock />` 是悬浮入口：点开后有「对话」与「运行」两个页签，
模型配置默认从 `.env.local` 的 `VITE_AGENT_*` 读；也可以在
`createPling({ agent: { llm, config, hooks } })` 里给应用级接线。

界面语言、主题和 class hook 与 Vue / Vanilla 共用 `@plingjs/ui`。默认英文；React 通过
`useSyncExternalStore` 读取同一份 UI 快照，因此运行时切换不重挂载：

```tsx
const pling = createPling({
  ui: {
    locale: "zh-CN",
    theme: { mode: "dark", tokens: { colorPrimary: "#2e9df7" } },
    classNames: { launcher: "brand-launcher" },
  },
});

pling.ui.setLocale("en-US");
pling.ui.setTheme({ mode: "light", tokens: { colorPrimary: "#0f766e" } });
```

## API

| API | 作用 |
| --- | --- |
| `createPling(options?)` | 建应用级实例（注册表 + 默认审批策略） |
| `createPlingPage()` | 混合框架页面共享的 registry / scopes；适配器传 `createPling({ shared: page })` |
| `<PlingProvider pling>` | 把实例放进 React 树 |
| `usePling()` | 取当前实例 |
| `usePlingUi()` | 订阅共享 UI 快照；`pling.ui.setLocale / setTheme` 后组件原地更新 |
| `usePlingTool(options)` | 声明元素动作（含 `handoff`），返回要挂到元素上的 ref |
| `useAgentTool(options)` | 声明没有 DOM 元素的函数级动作 |
| `usePlingRecord(value)` | 把列表的一行声明成可读记录，返回 ref |
| `usePlingScope(options)` | 声明页面区域（label / description / role / parent），返回 ref |
| `usePlingState(key, source, options?)` | 暴露只读状态视图；每次快照重读最新闭包 |
| `exposePlingState(pling, key, source, options?)` | 组件树之外（入口文件）登记状态视图 |
| `usePlingFeedback(value, options?)` | 把用户已经能看到的错误 / 状态声明为只读页面反馈，也自动收集 ARIA 语义 |
| `usePlingGuideTarget(id)` | 标记人工接力的视觉目标；不会进入动作清单 |
| `pling.ask(prompt, options?)` | 把一段业务任务交给页面里的助手入口 |
| `pling.inspectCoverage(root?)` | 开发期只读扫描未声明的可交互控件 |
| `pling.derived()` | 取自动派生控制器；`createPling({ derive: true })` 时非空 |
| `<AgentDock>` | 悬浮入口：会话、确认、人工接力、任务快捷入口、调试与限额读数自动接线 |
| `<AgentInline>` | 放进页面网格的会话界面，不带固定定位或启动按钮 |
| `<AgentChat>` | 纯展示聊天组件；想自己控制外壳时配合 `createAgentRuntime()` 使用 |

`usePlingTool` 自动随组件卸载解绑；`id` 省略时按 hook 实例生成一次。`run` 可以省略，此时由共享的 DOM 原语执行；提供 `run` 时直接调用业务函数。参数 schema、可用性、成功判据、风险等级与确认策略和 Vue 适配器同义。

同一页面里还有 Vue / 原生 JS 岛时，用 `createPlingPage()` 建一份页面运行时，再让每个适配器传
`shared`。完整动作 id 必须整页唯一，或用 `namespace` 自动加前缀；适配器销毁不会销毁页面
scopes，最后调用 `page.destroy()`。

## 让模型读得到、分得清

```tsx
function Row({ todo }: { todo: Todo }) {
  const record = usePlingRecord({ data: todo, label: `待办：${todo.text}` });
  const remove = usePlingTool<HTMLButtonElement>({ id: `remove@${todo.id}`, desc: "删除待办", kind: "danger" });
  return <li ref={record}><span>{todo.text}</span><button ref={remove}>删除</button></li>;
}

function App() {
  const list = usePlingScope({ id: "todos", label: "待办列表", role: "list" });
  return <ul ref={list}>{todos.map((todo) => <Row key={todo.id} todo={todo} />)}</ul>;
}
```

记录字段是实时读的；区域会自动推断父级与 DOM 顺序，子元素动作 / 记录自动继承最近作用域。
归一化规则在 `@plingjs/core`，Vue / React 完全同义。

区域进入视口后自动活跃；容器内滚出可视区的动作会被裁剪，被弹窗 / 遮罩盖住时会给出原因。
每个区域还会自动生成 `pling_reveal_<id>` / `pling_scroll_<id>` 两个探索动作。
测试或自定义环境可传 `createPling({ scopes: { ... } })`，布局变化观察不到时调
`pling.scopes.refresh()`。

动作执行时默认会高亮真实目标，开发者零声明。`createPling({ presence: false })` 可关，
传对象可换 `spotlight`、最短显示时间或自定义 `render`。`usePlingTool` 的 `handoff`
会进入 waiting 形态并保持高亮，直到用户完成。

状态同样只暴露「视图」：

```tsx
usePlingState("todo", () => ({
  filter,
  total: todos.length,
  remaining: todos.filter((todo) => !todo.done).length,
}), { description: "待办当前的筛选与计数" });
```

它是只读的；写入必须声明成动作。老项目可以在入口用 `exposePlingState(pling, ...)`
一次性登记，业务组件零改动。不要把整个 store 倒进上下文。

## 当前边界

已支持：元素动作、函数级工具、目标解析、可用性原因、`expect`、动态参数、默认审批配置、卸载注销；
记录（`usePlingRecord`）与区域语义（`usePlingScope`，含自动继承与页面顺序）；
只读状态视图（`usePlingState` / `exposePlingState`）；
可见性 / 遮挡裁剪与探索动作（`usePlingScope` / `usePlingTool` 复用 `@plingjs/dom` 控制器）；
动作存在感（默认光圈，`handoff` 期间 waiting；`presence: false` 可关）与人工接力；
复合动作（`usePlingTool({ steps })`）、页面反馈（`usePlingFeedback` + ARIA）、
人工接力目标（`usePlingGuideTarget`）、任务入口（`pling.ask` / `AgentDock.quick`）、
调试检查器（`AgentDock` 的 `debug`）与 `pling.inspectCoverage()`；
悬浮 / 内嵌 / 侧栏问答入口与会话事件流（对话 / 运行）、确认闸门、人工接力、推荐指令。

页面身份由应用在路由变化时调用 `registry.setPage()`。React Router 7 的写法见教程；
适配器刻意不绑定某个路由器。状态也没有 Redux / Zustand 专用适配器，应使用 `usePlingState`
或 `exposePlingState` 选出必要字段。

界面语言 / 主题（`@plingjs/ui`，默认英文；`setLocale` / `setTheme` 原地更新；四个
`classNames` 槽位）；跨适配器契约见
[主题、语言与可访问性](https://plingjs.dev/zh/operations/theme-locale-and-accessibility)。

已支持自动派生：`createPling({ derive: true })` 后，原生 `button` / `a[href]` /
`input[type=submit|button|reset]` 会按文案与最近记录推成 `add` / `remove@t1` 这类动作，
显式 `usePlingTool` 优先，`data-pling-ignore` 排除子树。派生器在 `@plingjs/dom`，
与 Vue 共用同一套规则；输入类（`fill` / `select`）不派生，避免在不知道要填什么时乱操作。
见 [真实控件与自定义组件](https://plingjs.dev/zh/react/real-controls-and-custom-components)。

页面投影：open Shadow DOM 通过组合树查询进入同一份世界；同源 iframe 用
`sharePlingPageWithFrame()` / `waitForPlingPageFromParent()` 显式共享 `PlingPage`，
可见性、遮挡、滚动与存在感使用投影坐标。closed shadow root 与跨域 iframe 不穿透。

当前不提供 Live / 移动端运行时。
