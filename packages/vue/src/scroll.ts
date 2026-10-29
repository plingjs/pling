// 兼容出口：滚动观察已经下沉到 @plingjs/dom，Vue 公开 API 保持不变。
export {
  SCROLL_QUIET_MS,
  scrollWatcher,
  markScrolling,
  scrollBehavior,
  scrollElementIntoView,
  type ScrollWatcher,
} from "@plingjs/dom";
