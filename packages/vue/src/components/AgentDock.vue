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
    quick?: readonly string[];
    defaultOpen?: boolean;
    config?: AgentConfigOverrides;
    llm?: Llm;
    hooks?: HookRegistry;
    gate?: () => boolean;
    registry?: Registry;
    navigate?: (href: string) => void;
    /** `dock` follows the page in a floating corner. `sidebar` uses a viewport edge. */
    layout?: "dock" | "sidebar";
    /** Edge used by `layout="sidebar"`. Ignored by the default dock. */
    side?: "right" | "left";
    /**
     * Where the collapsed sidebar launcher sits.
     * `bottom` stays horizontal and readable; `center` is the legacy edge tab.
     */
    launcherPlacement?: "bottom" | "center";
    /** Custom copy for the collapsed launcher. Defaults to the localized "Ask Pling". */
    launcherLabel?: string;
    /** Enable the read-only request inspector in Activity. Off by default. */
    debug?: boolean | AgentTraceOptions;
    /** Expose model connection details in Activity. `off` unless explicitly enabled. */
    modelSettings?: ModelSettingsSetting;
  }>(),
  {
    quick: () => [],
    defaultOpen: false,
    layout: "dock",
    side: "right",
    launcherPlacement: "bottom",
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
  `dock--${props.layout}`,
  ...(props.layout === "sidebar" ? [`dock--${props.side}`] : []),
  ...(props.layout === "sidebar" ? [`dock--launcher-${props.launcherPlacement}`] : []),
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
defineExpose({ runtime, send });
</script>

<template>
  <div
    class="dock"
    :class="shellClass"
    data-pling-ui
    :data-layout="layout"
    :data-side="layout === 'sidebar' ? side : undefined"
    :data-launcher-placement="layout === 'sidebar' ? launcherPlacement : 'bottom'"
    :style="[ui.cssVars, { zIndex: PLING_UI_Z_INDEX }]"
  >
    <AgentInline
      ref="inline"
      class="dock__surface"
      :visible="open"
      variant="dock"
      :manage-surface="false"
      collapsible
      :title="title"
      :placeholder="placeholder"
      :empty-hint="emptyHint"
      :quick="quick"
      :config="config"
      :llm="llm"
      :hooks="hooks"
      :gate="gate"
      :registry="registry"
      :navigate="navigate"
      :debug="debug"
      :model-settings="modelSettings"
      @event="(event) => emit('event', event)"
      @status="setStatus"
      @collapse="toggle(false)"
    />

    <button
      type="button"
      class="dock__launcher"
      :class="[{ 'is-open': open }, ui.classNames.launcher]"
      :aria-expanded="open"
      :title="launcherText"
      @click="toggle()"
    >
      {{ launcherText }}
      <span v-if="status.running || (!open && status.resume)" class="dock__dot" aria-hidden="true" />
    </button>
  </div>
</template>

<style>
.dock {
  position: fixed;
  right: 24px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  color: var(--pling-color-text, #0f172a);
  font-family: var(--pling-font-family, system-ui, sans-serif);
  font-size: 13px;
}
.dock__surface {
  width: min(400px, calc(100vw - 48px));
}
.dock__launcher {
  position: relative;
  padding: 10px 16px;
  border: 0;
  border-radius: 999px;
  background: var(--pling-color-primary, #2e9df7);
  color: var(--pling-color-on-primary, #fff);
  font-size: 13px;
  box-shadow: var(--pling-shadow-launcher, 0 10px 24px rgb(46 157 247 / 32%));
  cursor: pointer;
}
.dock__launcher.is-open {
  background: var(--pling-color-text-muted, #475569);
  box-shadow: none;
}

/* A viewport-edge utility surface. It does not reserve page space: put
   <AgentInline> in the page grid when the business layout should make room. */
.dock--sidebar {
  top: 0;
  bottom: 0;
  height: 100dvh;
  gap: 0;
  pointer-events: none;
}
.dock--sidebar > * {
  pointer-events: auto;
}
.dock--sidebar.dock--right {
  right: 0;
  left: auto;
  align-items: flex-end;
}
.dock--sidebar.dock--left {
  right: auto;
  left: 0;
  align-items: flex-start;
}
.dock--sidebar .dock__surface {
  width: var(--pling-sidebar-width, min(420px, 100vw));
  height: 100%;
}
.dock--sidebar .dock__surface .dock__panel {
  width: 100%;
  height: 100%;
  border-radius: 0;
  border-top: 0;
  border-bottom: 0;
  box-shadow: var(--pling-shadow-sidebar, 0 0 40px rgb(15 23 42 / 18%));
}
.dock--sidebar.dock--right .dock__surface .dock__panel {
  border-right: 0;
}
.dock--sidebar.dock--left .dock__surface .dock__panel {
  border-left: 0;
}
.dock--sidebar .dock__launcher {
  position: absolute;
  top: auto;
  bottom: 24px;
  padding: 10px 16px;
  writing-mode: horizontal-tb;
}
.dock--sidebar.dock--right.dock--launcher-bottom .dock__launcher {
  right: 16px;
}
.dock--sidebar.dock--left.dock--launcher-bottom .dock__launcher {
  left: 16px;
}
.dock--sidebar.dock--launcher-center .dock__launcher {
  top: 50%;
  bottom: auto;
  transform: translateY(-50%);
  padding: 14px 8px;
  writing-mode: vertical-rl;
}
.dock--sidebar.dock--right.dock--launcher-center .dock__launcher {
  right: 0;
}
.dock--sidebar.dock--left.dock--launcher-center .dock__launcher {
  left: 0;
}
.dock--sidebar.is-open .dock__launcher {
  display: none;
}

/* On phones a full-height sidebar would leave no working page. Degrade to the
   familiar floating panel instead of hiding the assistant behind a drawer. */
@media (max-width: 720px) {
  .dock--sidebar {
    top: auto;
    bottom: 12px;
    height: auto;
    width: auto;
  }
  .dock--sidebar.dock--right {
    right: 12px;
    left: auto;
  }
  .dock--sidebar.dock--left {
    right: auto;
    left: 12px;
  }
  .dock--sidebar .dock__surface {
    width: min(400px, calc(100vw - 24px));
    height: auto;
  }
  .dock--sidebar .dock__surface .dock__panel {
    height: min(640px, calc(100dvh - 72px));
    border: 1px solid var(--pling-color-border, #e3e8f0);
    border-radius: var(--pling-radius-lg, 12px);
    box-shadow: var(--pling-shadow-panel, 0 18px 40px rgb(15 23 42 / 16%));
  }
  .dock--sidebar .dock__launcher {
    position: relative;
    top: auto;
    bottom: auto;
    left: auto;
    right: auto;
    transform: none;
    padding: 10px 16px;
    writing-mode: horizontal-tb;
  }
}
.dock__dot {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--pling-color-warning, #fbbf24);
  animation: dock-pulse 1s ease-in-out infinite;
}
@keyframes dock-pulse {
  50% {
    opacity: 0.3;
  }
}
</style>
