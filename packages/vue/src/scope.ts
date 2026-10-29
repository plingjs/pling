/**
 * 兼容出口：作用域与可见性控制器已经下沉到 `@plingjs/dom`。
 *
 * Vue 的 `v-scope` / `v-tool` 与 React 的 `usePlingScope` / `usePlingTool`
 * 必须共用同一套「活跃区域 / 视口裁剪 / 遮挡判定」，否则同一页面换个适配器，
 * 模型看到的动作集合会不一样。
 */
export {
  createScopeController,
  SCOPE_ATTR,
  UI_ATTR,
  nearestScope,
  type IntersectionObserverCtor,
  type IntersectionObserverEntryLike,
  type IntersectionObserverLike,
  type ScopeController,
  type ScopeControllerOptions,
  type ScopeDeclaration,
} from "@plingjs/dom";
