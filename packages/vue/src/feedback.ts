/** Vue 侧保留原有导入路径；页面反馈的归一化与自动收集由框架无关的 DOM 层提供。 */
export {
  createFeedbackCollector,
  fieldNameOf,
  normalizeFeedbackValue,
  toFeedbackDeclaration,
} from "@plingjs/dom";
export type {
  FeedbackCollector,
  FeedbackValue,
  NormalizedFeedback,
} from "@plingjs/dom";
