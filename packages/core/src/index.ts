/**
 * @plingjs/core —— 框架无关内核。
 *
 * 这一层不允许出现任何 Vue / React 概念：它只认识
 * `Binding`（元素级能力）与 `StateExposure`（只读状态），
 * 由 `@plingjs/vue` 之类的适配器把各自框架的挂载 / 卸载 / 响应式翻译进来。
 */
export * from "./types";
export * from "./ids";
export * from "./wait";
export * from "./pending";
export * from "./errors";
export * from "./llm";
export * from "./primitives";
export * from "./params";
export * from "./flow";
export * from "./registry";
export * from "./model-actions";
export * from "./diff";
export * from "./state";
export * from "./sensitivity";
export * from "./policy";
export * from "./executor";
export * from "./runtime";
export * from "./record";
