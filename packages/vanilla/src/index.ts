export * from "./types";
export * from "./pling";
export * from "./tool";
export * from "./scope";
export * from "./record";
export * from "./state";
export * from "./page";
export * from "./model-settings";
export * from "./surface-gateway";
export * from "./surface-panel";
export * from "./debug-view";
export * from "./task-panel";
export * from "./task-actions";
export * from "./task-guide";
export { createPlingUi, type VanillaUiController } from "./ui";
export type {
  PlingClassNames,
  PlingTheme,
  PlingThemeMode,
  PlingUiOptions,
} from "@plingjs/ui";
// Waiting and expectations are everyday authoring APIs, not core-internal details.
export { waitFor, DEFAULT_WAIT_TIMEOUT, DEFAULT_WAIT_INTERVAL, type WaitForOptions } from "@plingjs/core";
export type { FlowStep, FlowStepReport, FlowReport, RegionRole, ScopeInfo } from "@plingjs/core";
export { describeFlow, MAX_FLOW_DEPTH } from "@plingjs/core";
export { sensitive, type SensitivityMode, type SensitiveOptions, type SensitiveValue } from "@plingjs/core";
export {
  COVERAGE_SELECTOR,
  createFeedbackCollector,
  fieldNameOf,
  normalizeFeedbackValue,
  toFeedbackDeclaration,
  inspectCoverage,
  type CoverageReport,
  type CoverageStatus,
  type CoverageTarget,
  type FeedbackCollector,
  type FeedbackValue,
  type NormalizedFeedback,
} from "@plingjs/dom";
export {
  createGuideActions,
  type GuideActionItem,
  type GuideActionKind,
  type GuideActions,
  type GuideActionsOptions,
} from "@plingjs/dom";
export {
  createPlingPage,
  sharePlingPageWithFrame,
  plingPageFromParent,
  waitForPlingPageFromParent,
  type PlingPage,
  type PlingPageOptions,
  type WaitForFramePageOptions,
} from "@plingjs/dom";
// 浮窗只通过 `pling.dock()` 暴露；`createDock` 需要内部 Host，不属于公开入口。
