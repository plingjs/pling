<script setup lang="ts">
/**
 * Placement shell around `<AgentInline>`.
 *
 * The shell owns placement, open/close, and task routing. The conversation
 * itself lives in `AgentInline`, so the same runtime can also be embedded directly
 * in a business column without creating a second history.
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { Llm, Registry } from "@plingjs/core";
import type { QuickTaskItem } from "@plingjs/ui";
import type {
  AgentConfigOverrides,
  AgentRuntime,
  AgentTraceOptions,
  HookRegistry,
  SessionEvent,
} from "@plingjs/agent";
import { usePling } from "../directive";
import type { ModelSettingsSetting } from "../model-settings";
import { PLING_UI_Z_INDEX } from "../presence";
import AgentInline from "./AgentInline.vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    placeholder?: string;
    emptyHint?: string;
    quick?: readonly QuickTaskItem[];
    /** Render speaker names and timestamps above messages. */
    speakers?: boolean;
    defaultOpen?: boolean;
    config?: AgentConfigOverrides;
    llm?: Llm;
    hooks?: HookRegistry;
    gate?: () => boolean;
    registry?: Registry;
    navigate?: (href: string) => void;
    /** `dock` follows the page in a floating corner. `sidebar` uses a viewport edge. */
    layout?: "dock" | "sidebar";
    /** `overlay` keeps the sidebar above the page; `fused` lets it occupy a grid column. */
    sidebarMode?: "overlay" | "fused";
    /** Edge used by `layout="sidebar"`. Ignored by the default dock. */
    side?: "right" | "left";
    /**
     * Where the collapsed sidebar launcher sits.
     * `bottom` stays horizontal and readable; `center` is the legacy edge tab.
     */
    launcherPlacement?: "bottom" | "center";
    /** Custom copy for the collapsed launcher. Defaults to the localized "Ask Pling". */
    launcherLabel?: string;
    /** Keep the active task above the transcript (`pinned`), in the message flow (`inline`), or hidden (`none`). */
    taskPlacement?: "inline" | "pinned" | "none";
    /** Render the `#guide` slot above the transcript (`top`) or as the newest message (`end`). */
    guidePlacement?: "top" | "end";
    /** Enable the read-only request inspector in Activity. Off by default. */
    debug?: boolean | AgentTraceOptions;
    /** Expose model connection details in Activity. `off` unless explicitly enabled. */
    modelSettings?: ModelSettingsSetting;
  }>(),
  {
    quick: () => [],
    defaultOpen: false,
    layout: "dock",
    sidebarMode: "fused",
    side: "right",
    launcherPlacement: "bottom",
    taskPlacement: "pinned",
    guidePlacement: "top",
    speakers: true,
  },
);

const emit = defineEmits<{ event: [event: SessionEvent]; open: [open: boolean] }>();

const pi = usePling();
const ui = pi.ui;
const t = ui.t;
const open = ref(props.defaultOpen);
const inline = ref<InstanceType<typeof AgentInline> | null>(null);
const status = ref({ running: false, resume: false });
let offTask: (() => void) | null = null;

const shellClass = computed(() => [
  "pling-dock",
  `dock--${props.layout}`,
  `pling-dock--${props.layout}`,
  ...(props.layout === "sidebar" ? [`dock--${props.side}`] : []),
  ...(props.layout === "sidebar" ? [`pling-dock--${props.side}`] : []),
  ...(props.layout === "sidebar" && props.sidebarMode === "fused" ? ["dock--fused", "pling-dock--fused"] : []),
  ...(props.layout === "sidebar" ? [`dock--launcher-${props.launcherPlacement}`, `pling-dock--launcher-${props.launcherPlacement}`] : []),
  ...(open.value ? ["is-open"] : []),
  ...(ui.classNames.dock ? [ui.classNames.dock] : []),
]);

const launcherOpenText = computed(() => props.launcherLabel?.trim() || t("dock.launcher.open"));
const launcherText = computed(() => {
  if (open.value) return t("dock.launcher.close");
  return status.value.resume ? t("dock.launcher.resume") : launcherOpenText.value;
});

function toggle(value?: boolean): void {
  open.value = value ?? !open.value;
  emit("open", open.value);
}

function send(text: string): Promise<void> {
  open.value = true;
  emit("open", true);
  return inline.value?.send(text) ?? Promise.resolve();
}

function setStatus(next: { running: boolean; resume: boolean }): void {
  status.value = next;
}

onMounted(() => {
  // `<AgentInline>` is mounted all the time so a closed dock keeps its history.
  // Only the shell registers the task target; the nested inline primitive does not.
  offTask = pi.task.register({
    id: "dock",
    ask: async (prompt) => {
      await send(prompt);
    },
  });
});

onUnmounted(() => offTask?.());

const runtime = computed<AgentRuntime | undefined>(() => inline.value?.runtime);
defineExpose({
  runtime,
  send,
  open: () => toggle(true),
  close: () => toggle(false),
});
</script>

<template>
  <div
    class="dock"
    :class="shellClass"
    data-pling-ui
    :data-layout="layout"
    :data-side="layout === 'sidebar' ? side : undefined"
    :data-sidebar-mode="layout === 'sidebar' ? sidebarMode : undefined"
    :data-launcher-placement="layout === 'sidebar' ? launcherPlacement : 'bottom'"
    :style="[ui.cssVars, { zIndex: PLING_UI_Z_INDEX }]"
  >
    <AgentInline
      ref="inline"
      class="dock__surface pling-dock__surface"
      :visible="open"
      variant="dock"
      :manage-surface="false"
      collapsible
      :title="title"
      :placeholder="placeholder"
      :empty-hint="emptyHint"
      :quick="quick"
      :speakers="speakers"
      :config="config"
      :llm="llm"
      :hooks="hooks"
      :gate="gate"
      :registry="registry"
      :navigate="navigate"
      :debug="debug"
      :model-settings="modelSettings"
      :task-placement="taskPlacement"
      :guide-placement="guidePlacement"
      @event="(event) => emit('event', event)"
      @status="setStatus"
      @collapse="toggle(false)"
    >
      <template v-if="$slots.task" #task><slot name="task" /></template>
    </AgentInline>

    <button
      type="button"
      class="dock__launcher pling-dock__launcher"
      :class="[{ 'is-open': open }, ui.classNames.launcher]"
      :aria-expanded="open"
      :title="launcherText"
      @click="toggle()"
    >
      {{ launcherText }}
      <span v-if="status.running || (!open && status.resume)" class="dock__dot pling-dock__dot" aria-hidden="true" />
    </button>
  </div>
</template>

