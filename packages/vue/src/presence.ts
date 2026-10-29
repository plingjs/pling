/**
 * 兼容出口：存在感（动作高亮）已经下沉到 `@plingjs/dom`。
 *
 * Vue 的 `v-tool` 与 React 的 `usePlingTool` 必须画出同一个目标、同一套层级，
 * 否则同一套动作换个适配器，用户看到的反馈会不一样。
 */
export {
  createPresence,
  PLING_PRESENCE_Z_INDEX,
  PLING_UI_Z_INDEX,
  type PresenceController,
  type PresenceEffect,
  type PresenceOptions,
} from "@plingjs/dom";
