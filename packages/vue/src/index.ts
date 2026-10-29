/**
 * @plingjs/vue —— pi 的 Vue 适配器。
 *
 * 职责：把 Vue 的「挂载 / 卸载 / 响应式 / 元素 ref」翻译成 `@plingjs/core` 的
 * `Binding` / `StateExposure`。core 完全不认识 Vue。
 *
 * 对外主入口：
 *   createPling(options)  → 应用级实例（registry + scopes + plugin）
 *   usePling()            → 组件内取用
 *   v-tool / v-scope        → 元素级 / 容器级声明
 *   createPling({ derive })    → L1 自动派生（不声明也有一批动作，标 source: derived）
 *   pi.inspectCoverage()    → 开发期只读扫描交互声明覆盖率
 *   useAgentState()         → 状态暴露（只读视图，随组件生命周期注销）
 *   <AgentPanel>            → 通用调试面板（把快照渲染成人能看的东西）
 *   <AgentChat>             → 问答入口（渲染会话事件流 + 确认闸门，纯展示）
 *
 * `./adapter` 是 001 时代的遗留模块，现在只是主路径之上的兼容薄壳（同一个注入 key）。
 */
// 等待与期望（S4）：`run` / `expect` 里要用的 `waitFor` 从 @plingjs/vue 也能拿到 ——
// 写页面的人不该为了等一次异步，再去认一个包名。
export { waitFor, DEFAULT_WAIT_TIMEOUT, DEFAULT_WAIT_INTERVAL, type WaitForOptions } from "@plingjs/core";
// 复合动作（S6a）：写 `steps` 的人不该为了一个类型再去认 @plingjs/core ——
// `v-tool` 的 `steps` 就是这些类型。
export type { FlowStep, FlowStepReport, FlowReport } from "@plingjs/core";
export { describeFlow, MAX_FLOW_DEPTH } from "@plingjs/core";
// 区域语义：写 `v-scope` 的人不该为了一个角色类型再去认 @plingjs/core。
export type { RegionRole, ScopeInfo } from "@plingjs/core";
export * from "./dom";
export * from "./scroll";
// 存在感（S13）：默认零配置；这里导出的是「想换画法」时才要用的类型。
export * from "./presence";
export * from "./scope";
export {
  createPlingPage,
  sharePlingPageWithFrame,
  plingPageFromParent,
  waitForPlingPageFromParent,
  type PlingPage,
  type PlingPageOptions,
  type WaitForFramePageOptions,
} from "@plingjs/dom";
export * from "./target";
export * from "./directive";
export * from "./task";
export * from "./derive";
export * from "./record";
export * from "./feedback";
export * from "./page";
export * from "./coverage";
export * from "./state";
export * from "./model-settings";
// 函数级动作（S15）：没有按钮的活儿也能登记成动作。
export * from "./tools";
// 敏感值（S14）：写 `v-record` / `useAgentState` 的人不该为了一个标记再去认 @plingjs/core。
export { sensitive, type SensitivityMode, type SensitiveOptions, type SensitiveValue } from "@plingjs/core";
// 遗留模块（001）：兼容薄壳，刻意用具名导出而非 `export *`，避免旧 API 混进主路径的补全列表。
export { createPlingVue, type PlingVue } from "./adapter";
export * from "./panel";
export { default as AgentPanel } from "./components/AgentPanel.vue";
export { default as AgentChat } from "./components/AgentChat.vue";
export { default as AgentInline } from "./components/AgentInline.vue";
export { default as AgentDock } from "./components/AgentDock.vue";
export { createPlingUi, DEFAULT_VUE_LOCALE, STANDALONE_UI, type PlingUiController } from "./ui";
export type { PlingClassNames, PlingTheme, PlingThemeMode, PlingUiOptions } from "@plingjs/ui";
