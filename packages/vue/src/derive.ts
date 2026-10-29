/**
 * 兼容出口：L1 自动派生已经下沉到 `@plingjs/dom`，Vue 与 React 共用同一套
 * 候选元素、文案词表、行身份与危险判定。Vue 的公开 import 路径保持不变。
 */
export {
  IGNORE_ATTR,
  DERIVED_ATTR,
  DERIVE_SELECTOR,
  DEFAULT_DANGER_WORDS,
  markExplicit,
  unmarkExplicit,
  isExplicit,
  explicitActionIds,
  markRecordElement,
  unmarkRecordElement,
  nearestRecordId,
  labelOf,
  verbOf,
  createDeriver,
  UI_ATTR,
  type DeriveOptions,
  type DeriveRoot,
  type DeriveController,
} from "@plingjs/dom";
