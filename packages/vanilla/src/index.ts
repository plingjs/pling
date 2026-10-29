export * from "./types";
export * from "./pling";
export * from "./tool";
export * from "./scope";
export * from "./record";
export * from "./state";
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
