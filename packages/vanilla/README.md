# @plingjs/vanilla

Pling 的原生 JS 适配器：不引入 Vue / React，直接在已有 DOM 元素上声明 agent 动作、记录、区域与只读状态，并可一行接入浮动问答入口。

```bash
pnpm add @plingjs/vanilla @plingjs/core
```

```ts
import { createPling } from "@plingjs/vanilla";

const pling = createPling();
const list = document.querySelector("#todos")!;

pling.scope(list, {
  id: "todos",
  label: "待办列表",
  description: "每一行是一条待办",
  role: "list",
});

pling.tool(document.querySelector("#add")!, {
  id: "add",
  desc: "新增一条待办",
});

pling.state("todo", () => ({ total: todos.length }), {
  description: "待办当前的条数",
});

pling.dock({
  title: "Todo 助手",
  quick: ["新增一条「写周报」", "删除「给猫买猫粮」"],
});
```

混合页面里复用局部动作名时，给适配器加 `namespace`：
`createPling({ shared: page, namespace: "vanilla" })`。`draft` 会注册成 `vanilla/draft`；
`inbox` / `item-1` / `summary` 会分别注册成 `vanilla/inbox` / `vanilla/item-1` / `vanilla/summary`。
`data-pling-scope` / `data-pling-record` 也使用完整 id，派生动作不会拼错行身份。

界面语言、主题和 class hook 与 Vue / React 共用 `@plingjs/ui`。默认英文；`pling.ui` 是同一份
共享控制器，修改后浮窗原地重绘：

```ts
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

`empty` 的普通元素不用改写成组件。声明返回注销函数；动态行卸载时调用它，整页结束时调 `pling.destroy()`。

## API

| API | 作用 |
| --- | --- |
| `createPling(options?)` | 建页面级实例（注册表 + 可见性 + 存在感 + 可选派生） |
| `createPlingPage()` | 混合框架页面共享的 registry / scopes；适配器传 `createPling({ shared: page })` |
| `pling.tool(element, options)` | 把一个 DOM 元素声明成动作 |
| `pling.action(options)` | 声明没有 DOM 元素的函数级动作 |
| `pling.record(element, value)` | 把一行数据声明成记录 |
| `pling.scope(element, options)` | 声明一块区域，子元素自动继承 |
| `pling.state(key, source, options?)` | 暴露只读状态视图 |
| `pling.ui` | 共享 UI 控制器：`locale` / `theme` / `t()` / `setLocale()` / `setTheme()` |
| `pling.setActiveScopes(ids)` | 手动声明活跃区域（自动判定之外） |
| `pling.dock(options?)` | 挂一个浮动问答入口；返回 `open / close / toggle / destroy` 控制器 |
| `pling.derived()` | 取自动派生控制器（`derive` 开启时非空） |
| `pling.destroy()` | 注销全部声明并停掉观察器 |

输入框、按钮的执行仍走 `@plingjs/core` 的执行流水线；DOM 原语、目标解析、可见性与存在感全部复用 `@plingjs/dom`。
同一页面里还有 Vue / React 岛时，用 `createPlingPage()` 建一份页面运行时，再让每个适配器传
`shared`。共享的是 registry 与 scopes，各框架的声明和生命周期仍各自管理；完整动作 id 必须
整页唯一，或用 `namespace` 自动加前缀。
open Shadow DOM 会通过组合树查询进入同一份世界；同源 iframe 用
`sharePlingPageWithFrame()` / `waitForPlingPageFromParent()` 显式共享 `PlingPage`，
多个 document 仍各自声明、各自运行 MutationObserver 与派生。closed shadow root 与跨域
iframe 不穿透。
浮窗的会话循环、模型配置、确认、人工接力、运行页与限额读数全部复用 `@plingjs/agent`，原生侧只负责 DOM 渲染。
这个包不依赖 Vue / React。

模型与业务级接线在入口写一次：

```ts
const pling = createPling({
  agent: {
    config: { limits: { maxTurns: 100 } }, // 演示可调；生产默认 10
  },
});
```

`.env.local` 里的 `VITE_AGENT_BASE_URL` / `VITE_AGENT_MODEL` 等变量由 `@plingjs/agent` 统一读取；
测试或自己的网关也可以直接注入 `llm`。
