# @plingjs/vue

Pling 的 **Vue 适配器**。职责是把 Vue 的「挂载 / 卸载 / 响应式 / 元素 ref」翻译成 `@plingjs/core` 的 `Binding` / `StateExposure`。

```bash
pnpm add @plingjs/vue @plingjs/agent @plingjs/core
```

```ts
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";

createApp(App).use(createPling().plugin).mount("#app");
```

构建产物把组件样式抽到 `style.css`，这一行不能省。

| 模块 | 职责 |
| --- | --- |
| `directive.ts` | `createPling()` / `usePling()` / `v-tool`（含 **`expect` 成功判据**：异步动作等它成立再下结论、**`steps` 复合动作**：一次业务操作 = 1 个 tool、**`handoff` 人工接力**：验证码 / 本人复核交还给人，支持 `handoff.steps` 分步指引）/ **`v-task`**（人使用的任务入口，不注册 action）/ **`v-guide-target`**（只注册高亮目标，不产生动作）/ `v-scope` |
| `task.ts` | **任务入口路由**：`PlingTaskController` / `pling.ask()`；把 prompt 送到唯一挂载的会话，无 surface 时显式失败；不创建第二段历史 |
| `page.ts` | **页面身份**：`createPageTracker()` 从 Vue Router / `location` / `document.title` 读取 `path` / `name` / `params` / `meta.title`；监听 history / popstate / hashchange / router.afterEach / 标题变化；query 默认不暴露，只按 `queryKeys` 白名单挑选 |
| `coverage.ts` | 开发期只读扫描：`inspectCoverage()` 统计直接声明、自动派生、容器级关联和未声明的交互控件；不会注册动作 |
| `scope.ts` | 作用域与可见性：容器声明、IntersectionObserver 自动裁剪、探索动作、**层叠命中测试**（`coverOf`） |
| `target.ts` | 动作目标解析（内层原生元素自动定位 / `target` 消歧 / 注册期告警） |
| `state.ts` | `useAgentState()`：一行声明状态暴露（只读视图，随组件 / effectScope 注销，返回手动注销函数）；`useAgentStoreState()`：Pinia / Vuex 字段白名单 + selector 逃生口 |
| `tools.ts` | **`useAgentTool()`**：注册没有 DOM 元素的函数级工具；`desc` / `kind` / `confirm` / `params` / `available` / `expect` / `run` 与 `v-tool` 同义；随 Vue scope 自动注销 |
| `record.ts` | `v-record` 的取值归一化（`{ data, id, label, fields }`）：一行数据 → 快照里的「记录」 |
| `derive.ts` | **自动派生（兼容导出）**：实现已下沉到 `@plingjs/dom`，Vue / React 共用候选元素、文案铸 id、`v-record` / `usePlingRecord` 行身份、危险词表与显式让路；产物标 `source: "derived"` |
| `dom.ts` | 框架无关的 DOM 原语执行 + **元素可用性判定**（`disabled` / `aria-disabled` / `display:none` / 祖先 `inert`·`aria-hidden`·`hidden`，都带原因）+ `describeElement` |
| `scroll.ts` | **滚动观察器**：`scrollWatcher(win)`（capture 监听 window + document —— 元素滚动不冒泡只有捕获看得到；每个事件**续期**，安静 `SCROLL_QUIET_MS=120` 后注销）/ `markScrolling(win)`（框架自己发起滚动时**先登记再动手**）/ `scrollBehavior(win)`（`prefers-reduced-motion` → 瞬时滚动）。装了插件就生效，业务不用调 |
| `adapter.ts` | **遗留**（001 时代）：已收敛成主路径之上的**兼容薄壳**（同一个 `PLING_KEY`，旧的双注入 key 坑消失）；新代码用 `v-tool` / `useAgentState` |
| `components/AgentPanel.vue` | 通用调试面板：动作 / 区域裁剪 / **模型看到的页面状态**（`stateViews`，含开发者写的说明）/ **交互声明覆盖率**（开发期只读扫描） |
| `components/AgentChat.vue` | 问答入口（渲染 `@plingjs/agent` 的事件流 + 确认闸门 + **人工接力接管条**，分步时显示步骤进度与上一步 / 下一步，纯展示） |
| `components/AgentInline.vue` | **布局无关的完整会话**：注册表 / 会话 / 事件流 / 确认与人工接力 / 工具钩子 / 水位 / 两个页签；无 fixed、无 z-index、无 launcher |
| `components/AgentDock.vue` | **定位外壳**：右下浮窗或视口侧边栏、启动按钮、开关与任务注册；会话主体委托给 `<AgentInline>`，默认一行接入行为不变 |

```ts
import { createPling, usePling, useAgentState, AgentPanel } from "@plingjs/vue";

const pling = createPling({ onWarn: myLogger.warn });
app.use(pling.plugin);
```

混合页面里复用局部动作名时，给适配器加 `namespace`：
`createPling({ shared: page, namespace: "vue" })`。`draft` 会注册成 `vue/draft`；
`inbox` / `item-1` / `summary` 会分别注册成 `vue/inbox` / `vue/item-1` / `vue/summary`；
`v-feedback` 的 id / scope 与 `v-guide-target` 的 id 也会补全，`handoff.steps[].highlight`
在绑定时固化成完整身份。
行内动作的 action 头与 record 引用也会分别补全（`remove@item-1` → `vue/remove@vue/item-1`）。

同一页面里还有 React / 原生 JS 岛时，用 `createPlingPage()` 建一份页面运行时，再让三个适配器
分别传 `shared: page`。共享的是 registry 与 scopes；完整动作 id 必须整页唯一，或用
`namespace` 自动加前缀，最后一个 `page.destroy()` 由宿主调用。

## 一个标签接完：`<AgentDock />`

```vue
<script setup lang="ts">
import { AgentDock } from "@plingjs/vue";
</script>

<template>
  <TodoApp />
  <AgentDock :quick="['把「给猫买猫粮」标记为完成']" />
</template>
```

它会自己去拿：页面能力（`usePling()`）、模型配置（应用级 `createPling({ agent })` 或
`.env.local` 的 `VITE_AGENT_*`）、会话与事件流、确认面板、**人工接力接管条**、运行页顶部的上下文水位、悬浮按钮与抽屉。
**确认策略在动作声明里**（`v-tool` 的 `kind` / `confirm`），面板上不放开关。
读 `.env.local` 的是 `src/env.ts` 的 `readViteEnv()`：那个表达式必须保持 `import.meta.env` 的**字面写法**
（Vite 按编译后的源码文本决定要不要注入 env），别重构成 `const meta = import.meta; meta.env` ——
`test/env.test.ts` 守着这条约束。
三档用法随需要停在哪一档都行：

1. 零配置：`<AgentDock />` + `.env.local`；
2. 显式：`createPling({ agent: { config, llm, gate } })` 或组件上 `:config` / `:gate`；
3. 自己来：`<AgentChat>`（纯展示）+ `createAgentRuntime()`（`@plingjs/agent`）。

`gate` 只是**确认通道**的开关（返回 `false` 时所有动作直接执行，危险动作也不问），
默认开着；「要不要问」是动作声明的事。要接自己的审批流就传 `policy`。

页面不方便为 agent 留一列时，用同一个组件做视口侧边栏：

```vue
<AgentDock
  layout="sidebar"
  side="right"
  launcher-label="Ask the copilot"
  title="订单助手"
  class="order-sidebar"
/>
```

收起时默认留下右下 / 左下水平入口；`launcher-placement="center"` 可恢复旧的视口中线竖排标签。
入口文案用 `launcher-label` 定制，或通过 `createPling({ ui: { messages } })` 统一翻译。

```css
.order-sidebar {
  --pling-sidebar-width: min(440px, 100vw);
}
```

`layout` 可选 `"dock"`（默认）/ `"sidebar"`；`side` 可选 `"right"`（默认）/ `"left"`。
收起后保留边缘入口与历史；≤720px 自动退化为浮层。sidebar 是覆盖层，不自动 push 页面；
需要真实占一列时用 `<AgentInline>`。见 [助手入口、布局与任务入口](https://plingjs.dev/zh/vue/assistant-surfaces-layout-and-task-entry-points)。

### 面板里的两个页签

界面的默认形态是**右下角一个悬浮按钮，点开是个浮窗**（`position: fixed`，不参与文档流 ——
参与文档高度会跟可见性裁剪形成「滚动 → 内容变矮 → scrollTop 被夹回」的自咬回路）。
浮窗里两个页签：

- **对话**（默认）—— 聊天记录、输入框、确认闸门都在这里；
- **运行** —— 从**会话事件流**里读出来的动作清单：一次动作一行，成功 / 失败（带错误码）/ 被拦截，
  外加**步数徽标**（有失败标红）。

助手说明和最终回复会按 Markdown 渲染；用户输入、错误与提示仍按纯文本显示。原始 HTML 不会执行。

「运行」是**框架自己就会给的**：`tool_call` 配 `tool_result`、`blocked` 就是拦截 ——
业务不需要再接一根线。业务自己的审计日志仍然归业务（想要业务视角的落库 / 上报，
接 `<AgentDock @event>` 或直接用 `createAgentRuntime()`，见 014 / 015 的 `recordActivity`）。
两边看到的是同一批动作，只是各记各的。

## 内联会话与智能动作入口

工作台类页面可以直接把 `<AgentInline>` 放进业务列；页面里的业务按钮用 `v-task` 或
`pling.ask()` 把任务交给同一个会话：

```vue
<button v-task="'汇总当前待审批订单'">智能汇总</button>
<button @click="pling.ask(`解释 ${order.id} 的风险`)">解释风险</button>
<AgentInline title="订单助手" />
```

`v-task` / `pling.ask()` 是**人**的入口，不进模型工具清单；`v-tool` 才是 agent 可操作的动作。
多个入口共享一个 runtime、一段历史、一个确认闸门。没有挂载会话时 `pling.ask()` 会以
`PLING_TASK_SURFACE_MISSING` 拒绝，不静默丢任务。见 [助手入口、布局与任务入口](https://plingjs.dev/zh/vue/assistant-surfaces-layout-and-task-entry-points)。

## 元素级声明：`v-tool`

两种写法：最常见的场景（元素本来就有 `@click` / `v-model`）只写一句说明；
需要稳定 id、风险等级、注入行为时用对象。

```vue
<button v-tool="'删除这条待办（不可逆）'">删除</button>

<button
  @click="remove(todo.id)"
  v-tool="{ id: `remove@${todo.id}`, kind: 'danger', desc: `删除待办「${todo.text}」（不可逆）` }"
>删除</button>
```

说明（`desc`）是模型唯一能看懂的东西：漏写会在注册期告警（模型不会去用一个看不懂的动作）。
可见性 / 作用域裁剪只影响「此刻暴不暴露」，**未写 `v-tool` 的元素永远不兜底**。

行内动作滚出可见区时不会消失：适配器为普通原子 `v-tool`（以及自动派生动作）提供 `reveal()`，
执行器会在权限通过后调用 `scrollElementIntoView()`，等滚动落定再重新检查可见性。
业务侧不需要写任何滚动代码；模型只要填记录 id（`remove@order:SO-1001` 的 `SO-1001`）即可。
见 [长列表、滚动与视口外动作](https://plingjs.dev/zh/vue/long-lists-scrolling-and-offscreen-actions)。

### 存在感：默认就会高亮目标

不需要任何新声明。执行 `v-tool` 时，适配器自动把**真正被操作的元素**圈一下
（和点击 / 填值共用 `currentTarget()`）；`handoff` 期间一直亮着，直到用户完成。
overlay 带 `data-pling-ui` + `pointer-events: none`：不挡操作、不进快照、不参与遮挡判定。

```ts
createPling();                                      // 默认：ring，700ms
createPling({ presence: false });                   // 关掉
createPling({ presence: { effect: "spotlight" } }); // 聚光
```

自定义画法（箭头 / 星星 / 气泡）用 `presence.render(el, state)`。见 [页面反馈、目标高亮与人工指引](https://plingjs.dev/zh/vue/page-feedback-target-highlighting-and-human-guidance)。

分步人工接力时，`handoff.steps[].highlight` 会让光圈跟着当前步骤移动。
不能注册成动作、但需要被指出来的元素用 `v-guide-target="'captcha_input'"` 标记：
它不产生动作、不进快照，只负责被高亮。见 [确认与人工接力](https://plingjs.dev/zh/vue/confirmation-and-human-handoff)。

### 敏感数据：字段名照留、值换掉

```ts
import { sensitive } from "@plingjs/vue";

fields: {
  手机: sensitive(order.phone, "token"),   // → {{p:1a2b3c4}}（执行前才还原）
  证件: sensitive(order.idCard, "masked"), // → 110***********1042
  评级: sensitive(order.grade),            // → [hidden]
}
```

- `v-record` 与 `useAgentState` 走同一条 `sanitizeState(..., { vault })` 管线；
- `token` 号由会话随机盐算出：同值同号、刷新即换、编造即 `INVALID_ARGS`；
- 出站安全网：已登记真值出现在回执 / 错误 / 反馈里会被换回代号。
见 [敏感数据](https://plingjs.dev/zh/vue/sensitive-data)。

### 没有按钮的活儿：函数级工具

```ts
import { useAgentTool } from "@plingjs/vue";

useAgentTool({
  id: "approve_all_pending",
  desc: "批量通过当前所有待审批订单",
  kind: "write",
  available: () => (pendingCount.value > 0 ? true : "当前没有待审批订单"),
  run: () => approveAllPending(),          // 返回值会进回执的 data
});
```

和 `v-tool` 共用参数校验 / 敏感值还原 / 确认 / 事件 / 审计；区别只是没有元素：
不参与视口、遮挡、滚动与存在感高亮。需要复合步骤时仍用 `v-tool` 的 `steps`。
见 [函数级工具](https://plingjs.dev/zh/vue/function-level-tools)。

### 横切规则：工具钩子

```ts
import { HookRegistry } from "@plingjs/agent";
import { createPling } from "@plingjs/vue";

const hooks = new HookRegistry();
hooks.addPreToolUse(({ id }) =>
  id.startsWith("remove@order:") ? { blocked: true, reason: "需要管理员审批" } : undefined,
);
hooks.addPostToolUse(({ id, result }) =>
  id === "export_orders_csv" && "result" in result
    ? { result: { ...result.result, data: { ...result.result.data, audited: true } } }
    : undefined,
);

const pling = createPling({ agent: { hooks } });
```

之后页面里的 `<AgentDock />` 自动使用这份钩子，不需要再传 prop；
`<AgentDock :hooks="localHooks" />` 可覆盖应用级。拦截会让模型收到 `HOOK_BLOCKED`，
并产生 `blocked` 事件；`PostToolUse` 必须**返回**新结果才算替换。
见 `website/reference/agent-runtime-sessions-context-limits.md` 与案例 038。

### 一个声明都不想写：`createPling({ derive: true })`

自动派生（`derive.ts`）会替原生可点元素写这份声明：id 由「文案词表 + 行身份」拼出
（`remove@t4`），说明取文案，危险文案标 `danger`，产物带 `source: "derived"`。
三条让路规则：元素自己的 `v-tool` 覆盖它（**不牵连子树**）、`data-pling-ignore` 排除子树、
`data-pling-ui` 排除框架自己的界面。输入类（`fill` / `select`）**不派生** —— 它们要回答「填什么」。

```ts
const pling = createPling({ derive: true });
pling.derived()?.ids();   // 调试：当前派生了哪些
```

用法与限制见 [真实控件与自定义组件](https://plingjs.dev/zh/vue/real-controls-and-custom-components)；
Vue 与 React 适配器使用同一套派生规则。

### 检查交互声明覆盖率

挂载之后可以用 `pling.inspectCoverage()` 检查当前页面的交互控件是否都有声明：

```ts
const pling = createPling();
app.use(pling.plugin);
app.mount("#app");

const report = pling.inspectCoverage();
console.table(report.targets); // grouped 与 missing 控件
```

报告分为 `declared` / `derived` / `grouped` / `missing`。`grouped` 指控件位于带 `v-tool` 的容器中，会计入覆盖率但需要人工确认容器动作是否代表该控件。扫描不创建动作，`<AgentPanel>` 也会展示报告并提供重新扫描按钮。

开发期还有一次**自动自检**：`createPling()` 默认在 Vite dev 首次挂载后扫描一次；发现 `missing` 时会通过 `onWarn` 提示「有几个控件不会被 Agent 看到」，并指向 `inspectCoverage()` / `<AgentPanel>`。它只提示，不自动派生动作。测试与生产构建默认静默；需要显式控制时用 `createPling({ diagnostics: true | false })`。

完整边界、报告字段与示例见 [测试、覆盖率与评测](https://plingjs.dev/zh/vue/testing-coverage-and-evaluation)。

存量项目的最短接入路径、改动清单与上线前检查见
[迁移已有 Vue 应用](https://plingjs.dev/zh/vue/migrating-an-existing-vue-app)。

### 一条动作管多行：`params`

元素级动作对「每行一个按钮」的页面很顺手，但有一类能力天生要**输入**：
「挪到第几位」「改成多少」。给这种动作写 `params`，`run` 就收到**整包参数**：

```vue
<ul class="list" v-tool="{
  id: 'reorder',
  desc: '把某条待办挪到指定位置（position 从 1 开始，1 = 最前面）',
  params: [
    { name: 'item', label: '哪一条（行数据里的 id，如 t4）' },
    { name: 'position', label: '目标位置，从 1 开始', type: 'number' },
  ],
  run: (args) => todos.moveTo(args.item, args.position),   // ← 整包参数
}">
```

三条规则（完整说明见 [带输入的动作与结果验证](https://plingjs.dev/zh/vue/actions-with-input-and-verified-results)）：

| 规则 | 说明 |
| --- | --- |
| 写了 `params` → `run(args)` | 没写 = 原子动作的老规矩：`type`→`text`、`select`→`value`、`press`→`key`、`click`→`undefined` |
| **默认必填** | `optional: true` 才是可选；缺了在**权限决策之前**就报 `INVALID_PARAMS`（不会先弹一次确认） |
| `label` 必填 / `values` 变 `enum` | schema 就是给模型看的那份；参数类型能规整就规整（`"3"` → `3`） |

判据：**这条动作要管多行 / 多个目标时用它**。42 行列表写「每行一个 `move_up`」是 `O(行 × 2)` 个动作 id，
而列表上一条 `reorder { item, position }` 是 `O(1)`。

### 悬浮菜单：`action: 'hover'`

有些菜单只有指针移入才展开。写 `hover` 原语，不要模拟一连串鼠标坐标：

```vue
<button
  v-tool="{ id: 'open_more_menu', desc: '把指针移到「更多」上，展开菜单',
            action: 'hover', kind: 'read' }"
  @mouseenter="menuOpen = true"
>更多</button>
```

- 依次派发 `pointerover` / `pointerenter` / `mouseover` / `mouseenter`；
- **不派发离开事件**：菜单保持打开，下一步才能点它；
- **作用在声明元素本身**：`mouseenter` 不冒泡，自动改投内层会让包装层收不到；
- **纯 CSS `:hover` 不会展开**：合成事件不改指针状态。这种控件给 `run` 或改成 click；
- 省略 `kind` 时仍按 fail-closed 视为 `write`，要只读就显式写 `kind: 'read'`。

复杂控件（拖拽 / 上传 / 日期 / 图表）不需要新原语：写成 `steps` + 业务注入。
上传走 `run`（浏览器不允许脚本改 `file input`）。见
[流程、异步与失败续跑](https://plingjs.dev/zh/vue/flows-async-work-and-recovery)。

流程失败后可以从第 N 步续跑：`STEP_FAILED.error.resume` 带 `runId`，
模型调用动态动作 `pling_resume_flow`。执行前失败可直接续跑；执行后失败需要该步声明
`idempotent: true`。见 [流程、异步与失败续跑](https://plingjs.dev/zh/vue/flows-async-work-and-recovery)。

### 确认策略：`kind` 兜底，`confirm` 覆盖

两个字段解析成一个 `approval`（`resolveApproval`），policy 只认它：

| 声明 | `approval` | 说明 |
| --- | --- | --- |
| 不写（默认） | 看 `kind` | `read` / `write` → **不问**；`danger` → 每次都问 |
| `kind: 'danger'` | `ask-always` | 破坏性、不可逆的动作 |
| `confirm: true` | `ask` | 要问（写操作、读操作都能标，比如「导出全量数据」） |
| `confirm: 'always'` | `ask-always` | 每次都问，且不给「总是允许」 |
| `confirm: false` | `none` | 显式担保不问（默认本来就不问，一般用不上） |

```vue
<!-- 勾选、进编辑态、筛选：高频且无害 —— 默认就不问，什么都不用写 -->
<input type="checkbox" @change="onToggle" v-tool="{ id: `toggle@${todo.id}`, desc: '标记完成' }" />

<!-- 删除：不可逆 —— 每次都要人点头 -->
<button @click="remove(todo.id)" v-tool="{ id: `remove@${todo.id}`, kind: 'danger', desc: '删除这条' }" />
```

`confirm: false` 用在 `danger` 上也合法（开发者的担保），但注册期会告警：
这条太容易是复制粘贴留下的，出了问题没人查得到。

「不写」那一档的默认值可配：`.env.local` 的 `VITE_AGENT_DEFAULT_APPROVAL=danger`（默认，只有 danger 问）
或 `=kind`（保守：`write` 也要问，答过「总是允许」后本会话同形状不再问）。它在**声明期**落到注册表上
（`createPling` 读应用级配置，`<AgentDock :config>` 更近一层会再落一次），改的是快照里每个动作的 `approval`。
`confirm` 永远优先，`danger` 永远每次都问。

状态暴露：只挑「对 agent 有意义的那几个值」，不要倒整个 store（见
[核心声明](https://plingjs.dev/zh/reference/core-declarations-actions-records-regions-state)）。
Pinia / Vuex 可直接用 `useAgentStoreState("todo", store, ["query", "filter", "counts"])`；
需要改名或换算时传 `(store) => ({ ... })`。字段拼错会在接入期报错。

## 容器级声明：`v-scope`（裁剪 + 页面结构）

```vue
<section v-scope="{ id: 'orders_admin', label: '订单后台', role: 'page',
                    description: '管理订单的主页面' }">
  <p v-scope="{ id: 'filters', label: '筛选与工具栏', role: 'toolbar',
                description: '搜索、筛选、排序、导出' }">…</p>
  <div v-scope="{ id: 'orders', label: '订单列表', role: 'list',
                  description: '每行一张订单' }">…</div>
</section>
```

- 子元素里的 `v-tool` / `v-record` 自动继承最近的 `v-scope`（`scope` 不用逐个写）；
- 区域滚出视口 → 动作与行数据自动裁剪；区域内还有内容未展示 → 自动生成 `pling_scroll_*`；
- `role` / `label` / `description` 只影响**模型看到的页面结构**（`ScopeInfo` 与动作的
  `scopePath`），不参与权限；
- `parent` 可省略：默认取最近的祖先 `v-scope`。弹窗被 `<Teleport>` 到 body 时才需要显式写；
- `order` 由适配器按 DOM 位置自动报，父区域一定在子区域之前。

模型上下文里会多出 `## Page structure (regions)` 段，动作标签变成
`region:订单后台 / 筛选与工具栏`。见
[区域、可见性与遮挡](https://plingjs.dev/zh/vue/regions-visibility-and-overlays)。

## 行级声明：`v-record`（让 agent 读得到「行」）

动作是**元素级**的：42 行列表就是 126 个行内动作 id（`@plingjs/agent` 会把同类行内动作折叠成
一条带 `record` 参数的模板，所以清单不再靠截断），但模型仍然只知道「能删 SO-1001」，
不知道这一行金额多少、状态是什么。`v-record` 把 `v-for` 的那一行变成**读得到**的记录 ——
业务侧只有一行：

```vue
<tr v-for="order in orders" :key="order.id" v-record="order">
<!-- id 取 order.id（没有就找 order.key），其余字段整行读进去 -->

<tr v-record="{ data: order, id: order.code, label: `订单 ${order.code}`,
                fields: { 客户: order.customer, 金额: order.amount } }">
<!-- 显式主键 / 一句说明 / 只暴露这几个字段 -->
```

模型上下文里会多一段 `## Records on this page (42 total, showing 20)`（每行带序号），
并把这一行的 id 指给折叠模板的参数：**「行内动作已经按类折叠：用参数 record 填这些行的 id」** ——
读（字段）与写（行内动作）因此对称，而且共享同一个 id 空间。

几点刻意的设计：

- **只有声明，没有 DOM 兜底**：猜字段错了没有报错、只有幻觉（金额读成「¥3,200.00」、
  状态与备注串行），还会把不该给模型看的字段读出去。动作不兜底是原则，数据更不该兜底。
- **字段实时读**：登记的是引用，快照组装时才取值。数据变了模型就看到新值，
  42 行也不会因为一次改动就重新登记。顺带 `unref` 一层 —— Vue 的 `ref` 套在普通对象里
  不会自动解包，否则喂给模型的是 `{ __v_isRef: true, … }`。
- **有界 + 报数**：每行最多 12 个键 / 120 字，整段默认最多 30 条（`recordLimits`），
  裁掉的部分说 `N more records not shown in full`。
- **和 `v-scope` 同一条裁剪链**：列表滚出视口，这一行的数据也不进上下文。

它是**读**：不产生任何可执行动作。

### 此刻不能用？把原因写进去：`available`

元素在、但业务上前提没满足时，用 `available` 声明。返回字符串 = 不可用 + 原因；
返回 `false` = 不可用（说「前置条件不满足」）；`true` / 不写 = 可用。

```vue
<!-- 没勾选任何订单时，这个动作不该出现在模型的可操作清单里 —— 但也不能假装它不存在 -->
<button
  @click="approveSelected()"
  v-tool="{
    id: 'approve_selected',
    desc: '审批选中的订单',
    available: () => (selected.value.length ? true : '先选中至少一条订单'),
  }"
>批量审批</button>
```

原因会出现在两处：快照的 `unavailable` 段（模型看得到「存在 + 为什么」），
以及执行时的 `ACTION_UNAVAILABLE` 错误里。框架自己看出来的原因（`disabled` / `display: none` /
已从页面移除）也走同一条路。

### 遮罩与弹窗（层叠）：弹窗开着时，底下的动作点不到

以前这是框架的一个真 bug：遮罩下的按钮几何上还在视口里 → 判成「可操作」→ 模型调用它时
框架走的是 `element.click()`（合成事件，绕过命中测试）→ **真的生效了**，而人点同一处只会点到遮罩。

现在两层判据，都不用写业务逻辑：

```vue
<!-- ① 弹窗打开时给背景加 inert + aria-hidden（真实 UI 库本来就这么做）→ 语义信号，不依赖布局 -->
<section class="admin" :inert="editing ? true : undefined" :aria-hidden="editing ? 'true' : undefined">
  ...原页面...
</section>
<EditDialog :order="editing" @save="saveEdit" @cancel="cancelEdit" />

<!-- ② 弹窗自己的元素照常写 v-tool —— 它没被盖住，所以照常可用（这就是「活动层」） -->
```

判据②是几何的：元素中心点做命中测试（`scopes.coverOf`，默认 `document.elementFromPoint`），
命中的不是自己 / 后代 / 祖先就算被盖住。**判不了就不判**（没有布局能力、尺寸为 0、中心在视口外），
宁可不说，也不能把满屏动作误判成不可用。没有 `elementFromPoint` 的环境用
`createPling(undefined, { scopes: { hitTest } })` 注入。

框架自己的界面带 `data-pling-ui`，**不算遮挡**：`<AgentDock>` 浮在目标上时，
agent 仍然可以操作目标，不会因为自己的聊天窗挡住页面就误报「被浮层盖住」。

```ts
// 组件里一行：模型每轮都会看到这几个值
useAgentState("list", () => ({ status: status.value, shown: rows.value.length, total: total.value }), {
  description: "列表当前的筛选与条数",
});
```

`AgentPanel` 不认识任何业务：业务用它的事件与插槽接入。

```vue
<AgentPanel @executed="(e) => audit(e)">
  <template #compose="{ execute, snapshot }">
    <button @click="execute('some_action')">业务自定义组合</button>
  </template>
</AgentPanel>
```

## 页面反馈：`v-feedback` + ARIA 自动收集

```vue
<input
  v-model="customer"
  data-pling-field="customer"
  :aria-invalid="errors.customer ? 'true' : undefined"
  v-tool="{ id: 'order_customer', desc: '填写客户名称（必填）' }"
/>
<p v-feedback="{ message: errors.customer, field: 'customer' }">{{ errors.customer }}</p>
```

字符串 / 对象 / 数组三种写法；默认 `severity: error`，自动继承最近 `v-scope`。
框架还会自动收集 `role=alert` / `role=status` / `aria-live` / `aria-invalid=true`，
不猜 CSS class，跳过 `data-pling-ui`。反馈只读，不进动作清单。

见 [页面反馈、目标高亮与人工指引](https://plingjs.dev/zh/vue/page-feedback-target-highlighting-and-human-guidance)。

## 页面身份：默认零配置

```ts
const router = createRouter({ history: createWebHistory(), routes });
const pling = createPling();

createApp(App).use(router).use(pling.plugin).mount("#app");
```

router 经 `app.use(router)` 注册后，适配器在 `app.mount()` 时自动探测
`app.config.globalProperties.$router`；`app.use(router)` 与 `app.use(pling.plugin)` 的顺序不影响结果。

挂载后快照里会有 `page`：

```ts
{ path: "/orders/SO-1002", title: "订单详情", name: "order-detail", params: { id: "SO-1002" } }
```

- 没有 router 时读 `location.pathname` / `hash` / `document.title`；
- 显式传入的 `page.router` 优先于自动探测；
- 只配 `page: { queryKeys: [...] }` 时仍会自动探测 router；
- `page: false` 关闭；`hash: false` 忽略 hash；`title()` 覆盖标题；
- `queryKeys` 默认 `[]`，URL 里的 token / 签名默认不会进模型上下文；
- 探测只发生在挂载时；挂载后替换 router 需要显式传入或重建 Pling；
- `pling.page.sync()` 可手动重读，`pling.page.stop()` 停止并清空。

见 [页面身份与路由](https://plingjs.dev/zh/vue/page-identity-and-routing)。

## 页面投影：Shadow DOM 与同源 iframe

open Shadow DOM 内的 `v-tool` / `v-feedback` / `v-guide-target` 写法不变；框架用组合树让它们
继承宿主上的 `v-scope`，命中测试也会进入 shadow root。多个岛仍用 `namespace` 区分同名动作。

同源 iframe 由父页面显式共享运行时：

```ts
const page = createPlingPage();
const unshare = sharePlingPageWithFrame(frame, page);
// 子页面
const page = await waitForPlingPageFromParent();
const framePling = createPling({ shared: page, namespace: "frame" });
```

子页面默认不接管页面身份（顶层页面优先）；确实需要时显式传 `page: { ... }`。
closed shadow root 与跨域 iframe 不穿透；旋转 / 3D transform 的坐标投影未覆盖。

见 [Shadow DOM 与 iframe 投影](https://plingjs.dev/zh/concepts/projection-shadow-dom-and-iframes)。

运行：`pnpm --filter @plingjs/vue test`
