<script setup lang="ts">
/**
 * Layout-agnostic agent surface.
 *
 * This is the actual conversation: runtime, session events, approval/handoff,
 * run ledger, usage readout, and the chat/run tabs. It has **no fixed
 * positioning, no z-index, no launcher, and no overlay**. Put it in a sidebar,
 * a business column, or inside `<AgentDock>`.
 *
 * For the normal one-line setup keep using `<AgentDock />`. `<AgentInline>` is for
 * enterprise/workbench layouts where the agent belongs to the page grid.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import type { Llm, Registry } from "@plingjs/core";
import {
  compactAt,
  createAgentRuntime,
  resolveAgentConfig,
  toActivityRows,
  type ActivityRow,
  type AgentConfigOverrides,
  type AgentRuntime,
  type AgentTraceOptions,
  type HookRegistry,
  type PendingApproval,
  type PendingHandoff,
  type SessionEvent,
} from "@plingjs/agent";
import { sameOriginUrl } from "@plingjs/dom";
import { describePlingDiagnostic, diagnosticMessageKey } from "@plingjs/ui";
import { usePling } from "../directive";
import { readViteEnv } from "../env";
import {
  applyUserModelSettings,
  clearUserModelSettings,
  readUserModelSettings,
  resolveModelSettings,
  writeUserModelSettings,
  type ModelSettingsSetting,
  type UserModelSettings,
} from "../model-settings";
import AgentChat from "./AgentChat.vue";
import AgentDebug from "./AgentDebug.vue";
import AgentModelSettings from "./AgentModelSettings.vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    placeholder?: string;
    emptyHint?: string;
    /** Recommended tasks. They stay available for repeated work; only disable while running. */
    quick?: readonly string[];
    config?: AgentConfigOverrides;
    llm?: Llm;
    hooks?: HookRegistry;
    gate?: () => boolean;
    registry?: Registry;
    navigate?: (href: string) => void;
    /** Internal shell controls. Standalone inline usage keeps this true. */
    visible?: boolean;
    /** Visual variant. `dock` preserves the compact floating-panel width. */
    variant?: "dock" | "inline";
    /** Built-in surfaces register with the page task router by default. */
    manageSurface?: boolean;
    surfaceId?: string;
    /** Show the collapse control. Used by the dock shell, not by inline layouts. */
    collapsible?: boolean;
    /** Enable the read-only request inspector in the run surface. Off by default. */
    debug?: boolean | AgentTraceOptions;
    /** Expose model connection details in the run surface. `off` unless explicitly enabled. */
    modelSettings?: ModelSettingsSetting;
  }>(),
  {
    quick: () => [],
    visible: true,
    variant: "inline",
    manageSurface: true,
    surfaceId: "inline",
    collapsible: false,
  },
);

const emit = defineEmits<{
  event: [event: SessionEvent];
  collapse: [];
  status: [status: { running: boolean; resume: boolean }];
}>();

const pi = usePling();
const ui = pi.ui;
const t = ui.t;
const registry = computed(() => props.registry ?? pi.registry);
const titleText = computed(() => props.title ?? t("dock.assistant"));

const setup = pi.agent ?? {};
const showText = (text: string): string => (pi.revealSensitive ? registry.value.tokens.resolve(text) : text);

const draft = ref("");
const running = ref(false);
const events = shallowRef<SessionEvent[]>([]);
const resumeDismissed = ref(false);
const tab = ref<"chat" | "activity">("chat");
const debugOpen = ref(false);
const modelSettingsOpen = ref(false);
const pending = ref<PendingApproval | null>(null);
const pendingHandoff = ref<PendingHandoff | null>(null);
const gateActive = computed(() => (props.gate ?? setup.gate)?.() ?? true);
const notReady = ref(false);
let destroyed = false;
let returnTimer: ReturnType<typeof setTimeout> | null = null;
let offTask: (() => void) | null = null;
const tick = ref(0);
const transcript = ref<InstanceType<typeof AgentChat> | null>(null);
const traceOption = props.debug !== undefined ? props.debug : setup.trace;
const debugEnabled = Boolean(traceOption);
const modelSetting = resolveModelSettings(props.modelSettings ?? setup.modelSettings);
const injectedLlm = props.llm ?? setup.llm;
const modelSettingsMode = computed(() =>
  injectedLlm && modelSetting.mode === "byok" ? "off" : modelSetting.mode,
);
const modelSettingsEnabled = computed(() => modelSettingsMode.value !== "off");

function modelStorage(): Storage | null {
  if (modelSetting.persist !== "session" || typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const settingsStorage = modelStorage();
const userModelSettings = ref<UserModelSettings | null>(
  settingsStorage ? readUserModelSettings(settingsStorage) : null,
);

const baseConfig = resolveAgentConfig({
  env: readViteEnv(),
  config: { ...(setup.config ?? {}), ...(props.config ?? {}) },
});

let runtimeToken = 0;

function buildRuntime(): AgentRuntime {
  const config = applyUserModelSettings(baseConfig, userModelSettings.value);
  registry.value.setDefaultApproval(config.defaultApproval);
  const token = ++runtimeToken;
  return createAgentRuntime({
    ...setup,
    ...(traceOption ? { trace: traceOption } : {}),
    ...(props.hooks ? { hooks: props.hooks } : {}),
    config,
    ...(injectedLlm ? { llm: injectedLlm } : {}),
    ...(props.gate ? { gate: props.gate } : {}),
    registry: registry.value,
    responseLocale: setup.responseLocale ?? (() => ui.locale),
    onEvent: (event) => {
      if (token !== runtimeToken) return;
      events.value = [...events.value, event];
      tick.value += 1;
      if (event.type === "final") queueReturn();
      emit("event", event);
    },
    onApproval: (request) => {
      if (token !== runtimeToken) return;
      pending.value = request;
      setup.onApproval?.(request);
    },
    onHandoff: (request) => {
      if (token !== runtimeToken) return;
      pendingHandoff.value = request;
      setup.onHandoff?.(request);
    },
  });
}

const runtime = shallowRef<AgentRuntime>(buildRuntime());
events.value = [...runtime.value.session.events()];

function selectTab(next: "chat" | "activity"): void {
  tab.value = next;
}

function toggleDebug(): void {
  if (!debugEnabled) return;
  debugOpen.value = !debugOpen.value;
}

function toggleModelSettings(): void {
  if (!modelSettingsEnabled.value) return;
  modelSettingsOpen.value = !modelSettingsOpen.value;
}

function replaceRuntime(notice?: SessionEvent): void {
  const previous = runtime.value;
  previous.session.cancel();
  previous.approvals.clear();
  previous.handoffs.clear();
  cancelReturn();

  const next = buildRuntime();
  // Changing the transport must not silently resume a task that belonged to the
  // previous model connection. The user explicitly asked for a new conversation.
  next.session.reset();
  runtime.value = next;
  events.value = notice ? [notice] : [];
  pending.value = null;
  pendingHandoff.value = null;
  notReady.value = false;
  resumeDismissed.value = true;
  tick.value = 0;
}

function saveModelSettings(settings: UserModelSettings): void {
  if (running.value) return;
  userModelSettings.value = settings;
  if (settingsStorage) writeUserModelSettings(settings, settingsStorage);
  replaceRuntime({ type: "notice", text: t("modelSettings.saved", { model: settings.model }) });
  modelSettingsOpen.value = false;
  tab.value = "chat";
}

function resetModelSettings(): void {
  if (running.value) return;
  userModelSettings.value = null;
  if (settingsStorage) clearUserModelSettings(settingsStorage);
  replaceRuntime({ type: "notice", text: t("modelSettings.resetDone") });
  modelSettingsOpen.value = false;
  tab.value = "chat";
}

function cancelReturn(): void {
  if (returnTimer === null) return;
  clearTimeout(returnTimer);
  returnTimer = null;
}

function queueReturn(): void {
  const target = runtime.value.continuity.claimReturn();
  if (!target) return;
  const href = sameOriginUrl(target.href);
  if (!href) return;
  cancelReturn();
  returnTimer = setTimeout(() => {
    returnTimer = null;
    if (destroyed) return;
    (props.navigate ?? ((url: string) => window.location.replace(url)))(href);
  }, target.delayMs);
}

const RESUME_TEXT =
  "Continue the previous task. Inspect the current page before deciding the next step; if the previous page's action result is unknown, do not assume it succeeded.";

const resume = computed(() => {
  if (runtime.value.continuity.resume === "off") return null;
  const checkpoint = runtime.value.continuity.restored ? runtime.value.continuity.checkpoint : null;
  if (!checkpoint || checkpoint.status !== "active" || resumeDismissed.value) return null;
  return { ...(checkpoint.goal ? { goal: checkpoint.goal } : {}), interrupted: checkpoint.interrupted };
});

const limitsHint = computed(() =>
  t("dock.limits.title", {
    model: runtime.value.model || t("dock.model.unconfigured"),
    context: runtime.value.limits.contextTokens,
    reserve: runtime.value.limits.reserveForOutput,
    compact: compactAt(runtime.value.limits),
    keep: runtime.value.limits.keepRecent,
    maxTurns: runtime.value.limits.maxTurns,
    retries: runtime.value.retry.maxRetries,
    min: runtime.value.retry.baseDelayMs,
    max: runtime.value.retry.maxDelayMs,
  }),
);

const activityRows = computed(() => toActivityRows(events.value, { locale: ui.locale, translate: t }));
const notReadyText = computed(() =>
  notReady.value ? describePlingDiagnostic(runtime.value.readiness, t) : "",
);
const stateText = (status: ActivityRow["status"]): string => t(`dock.state.${status}`);
const failedCount = computed(
  () => activityRows.value.filter((row) => row.status === "failed" || row.status === "blocked").length,
);
const usedTokens = computed(() => {
  void tick.value;
  return runtime.value.session.loop.history.totalTokens();
});
const compactPoint = computed(() => compactAt(runtime.value.limits));
const summary = computed(() => {
  void tick.value;
  const data = runtime.value.telemetry.summary();
  const parts = [
    t("dock.summary.context", {
      used: usedTokens.value,
      total: runtime.value.limits.contextTokens,
      compact: compactPoint.value,
    }),
    t("dock.summary.turns", {
      used: runtime.value.session.loop.turnsUsed,
      max: runtime.value.limits.maxTurns,
    }),
  ];
  if (data.llmCalls) parts.push(t("dock.summary.calls", { count: data.llmCalls }));
  if (data.retries) parts.push(t("dock.summary.retries", { count: data.retries }));
  if (data.retryExhausted) parts.push(t("dock.summary.exhausted", { count: data.retryExhausted }));
  return parts.join(" · ");
});

watch(
  () => events.value.length,
  async () => {
    await nextTick();
    const el = transcript.value?.$el as HTMLElement | undefined;
    const box = el?.querySelector(".transcript") as HTMLElement | null;
    if (box) box.scrollTop = box.scrollHeight;
  },
);

watch(
  [running, () => Boolean(resume.value)],
  () => emit("status", { running: running.value, resume: Boolean(resume.value) }),
  { immediate: true },
);

async function send(text: string): Promise<void> {
  const value = text.trim();
  if (!value || running.value) return;
  draft.value = "";

  notReady.value = false;
  if (!runtime.value.readiness.ready) {
    notReady.value = true;
    const messageKey = diagnosticMessageKey(runtime.value.readiness.code);
    events.value = [
      ...events.value,
      { type: "user", text: value },
      {
        type: "error",
        code: "NOT_CONFIGURED",
        message: runtime.value.readiness.hint,
        ...(messageKey ? { messageKey } : {}),
        ...(runtime.value.readiness.params ? { params: runtime.value.readiness.params } : {}),
      },
    ];
    return;
  }

  running.value = true;
  try {
    await runtime.value.session.send(value);
  } finally {
    running.value = false;
  }
}

function resumeTask(): void {
  resumeDismissed.value = true;
  void send(RESUME_TEXT);
}

function dismissResume(): void {
  resumeDismissed.value = true;
  clear();
}

function clear(): void {
  cancelReturn();
  resumeDismissed.value = true;
  runtime.value.session.reset();
  runtime.value.approvals.clear();
  runtime.value.handoffs.clear();
  runtime.value.telemetry.clear();
  events.value = [];
  pending.value = null;
  pendingHandoff.value = null;
  notReady.value = false;
  tick.value = 0;
}

onMounted(() => {
  if (props.manageSurface) {
    offTask = pi.task.register({
      id: props.surfaceId,
      ask: async (prompt) => {
        await send(prompt);
      },
    });
  }
  if (!runtime.value.readiness.ready || !runtime.value.continuity.claimAutoResume()) return;
  resumeDismissed.value = true;
  void send(RESUME_TEXT);
});

onUnmounted(() => {
  offTask?.();
  destroyed = true;
  cancelReturn();
  runtime.value.session.cancel();
  runtime.value.approvals.clear();
  runtime.value.handoffs.clear();
});

defineExpose({ runtime, send, ask: send });
</script>

<template>
  <div
    class="pling-inline"
    :class="[`pling-inline--${variant}`]"
    data-pling-ui
    :style="ui.cssVars"
  >
    <section
      v-if="visible"
      class="dock__panel pling-inline__panel"
      :class="ui.classNames.panel"
      :aria-label="titleText"
    >
      <p v-if="notReadyText" class="dock__warn">{{ notReadyText }}</p>

      <div class="dock__nav">
        <nav class="dock__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'chat'"
            :class="{ 'is-active': tab === 'chat' }"
            @click="selectTab('chat')"
          >
            {{ t("dock.tab.chat") }}
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'activity'"
            :class="{ 'is-active': tab === 'activity' }"
            @click="selectTab('activity')"
          >
            {{ t("dock.tab.activity") }}
            <span v-if="activityRows.length" class="dock__badge" :class="{ 'is-bad': failedCount > 0 }">
              {{ activityRows.length }}
            </span>
          </button>
        </nav>
        <div class="dock__actions">
          <button
            type="button"
            class="dock__ghost"
            :aria-label="t('dock.clear')"
            :title="t('dock.clear')"
            @click="clear"
          >
            <svg class="dock__icon" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 4.5h12v9H9l-4 3v-3H4z" />
              <path d="M8 7.5l4 4M12 7.5l-4 4" />
            </svg>
          </button>
          <button
            v-if="collapsible"
            type="button"
            class="dock__ghost"
            :aria-label="t('dock.collapse')"
            :title="t('dock.collapse')"
            @click="emit('collapse')"
          >
            <svg class="dock__icon" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="quick.length && tab === 'chat'" class="dock__quick">
        <button v-for="task in quick" :key="task" type="button" :disabled="running" @click="send(task)">
          {{ task }}
        </button>
      </div>

      <div v-if="tab === 'activity'" class="dock__run">
        <div class="dock__diagnostics">
          <button
            v-if="modelSettingsEnabled"
            type="button"
            class="dock__model dock__model-button"
            :class="{ 'is-active': modelSettingsOpen }"
            :aria-label="t('modelSettings.title')"
            :aria-expanded="modelSettingsOpen"
            :title="limitsHint"
            data-testid="pling-model-settings-toggle"
            @click="toggleModelSettings"
          >
            <span class="dock__model-dot" aria-hidden="true"></span>
            <span class="dock__model-name">{{ runtime.model || t("dock.model.unconfigured") }}</span>
            <svg class="dock__model-caret" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5l3 3 3-3" />
            </svg>
          </button>
          <span v-else class="dock__model" :title="limitsHint">
            <span class="dock__model-dot" aria-hidden="true"></span>
            <span class="dock__model-name">{{ runtime.model || t("dock.model.unconfigured") }}</span>
          </span>
          <span class="dock__usage">{{ summary }}</span>
        </div>

        <AgentModelSettings
          v-if="modelSettingsOpen"
          :mode="modelSettingsMode === 'readonly' ? 'readonly' : 'byok'"
          :persist="modelSetting.persist"
          :config="runtime.config"
          :user="userModelSettings"
          :running="running"
          @save="saveModelSettings"
          @reset="resetModelSettings"
        />

        <section class="dock__run-section" data-testid="pling-run-actions">
          <div class="dock__run-head">
            <p class="dock__run-label">{{ t("dock.run.actions") }}</p>
            <button
              v-if="debugEnabled"
              type="button"
              class="dock__run-toggle"
              :class="{ 'is-active': debugOpen }"
              :aria-expanded="debugOpen"
              data-testid="pling-debug-toggle"
              @click="toggleDebug"
            >
              {{ t("debug.title") }}
            </button>
          </div>
          <ol class="dock__activity">
            <li v-for="row in activityRows" :key="row.seq" class="dock__row">
              <p class="dock__row-head">
                <code>{{ row.id }}</code>
                <span :class="['dock__state', `is-${row.status}`]">{{ stateText(row.status) }}</span>
                <span v-if="row.description" class="dock__desc">{{ row.description }}</span>
              </p>
              <pre v-if="Object.keys(row.args).length" class="dock__args">{{ showText(JSON.stringify(row.args)) }}</pre>
              <p v-if="row.detail" class="dock__detail">{{ showText(row.detail) }}</p>
            </li>
            <li v-if="!activityRows.length" class="dock__empty">{{ t("dock.activity.empty") }}</li>
          </ol>
        </section>

        <AgentDebug
          v-if="debugEnabled && debugOpen && runtime.trace"
          :runtime="runtime"
          :registry="registry"
        />
      </div>

      <AgentChat
        v-else-if="tab === 'chat'"
        ref="transcript"
        class="dock__chat"
        :title="titleText"
        :placeholder="placeholder"
        :empty-hint="emptyHint"
        :events="events"
        :running="running"
        :pending="pending"
        :pending-handoff="pendingHandoff"
        :resume="resume"
        :reveal="showText"
        @send="send"
        @resume="resumeTask"
        @dismiss-resume="dismissResume"
        @reply="(decision) => runtime.approvals.reply(decision)"
        @handoff="(done) => runtime.handoffs.reply(done)"
        @handoff-step="(delta) => runtime.handoffs.moveStep(delta)"
        @stop="runtime.session.cancel()"
      />

      <footer v-if="!gateActive" class="dock__status">
        <span class="dock__gate" :title="t('dock.gate.offTitle')">
          {{ t("dock.gate.off") }}
        </span>
      </footer>
    </section>
  </div>
</template>

<style>
.pling-inline {
  box-sizing: border-box;
  color: var(--pling-color-text, #0f172a);
  font-family: var(--pling-font-family, system-ui, sans-serif);
  font-size: 13px;
}
.pling-inline *,
.pling-inline *::before,
.pling-inline *::after {
  box-sizing: border-box;
}
.dock__panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: var(--pling-inline-height, min(640px, calc(100vh - 96px)));
  padding: 12px;
  border: 1px solid var(--pling-color-border, #e3e8f0);
  border-radius: var(--pling-radius-lg, 12px);
  background: var(--pling-color-surface, #fff);
  box-shadow: var(--pling-shadow-panel, 0 18px 40px rgb(15 23 42 / 16%));
}
.pling-inline--dock .dock__panel {
  width: min(400px, calc(100vw - 48px));
  height: min(600px, calc(100vh - 120px));
}
.dock__warn {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--pling-color-warning, #9a6700);
  border-radius: var(--pling-radius-md, 8px);
  background: var(--pling-color-warning-soft, #fff7ed);
  color: var(--pling-color-warning, #9a3412);
  font-size: 12px;
}
.dock__quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dock__quick button {
  padding: 3px 8px;
  border: 1px solid var(--pling-color-border, #cbd5e1);
  border-radius: 999px;
  background: var(--pling-color-surface-muted, #f8fafc);
  color: var(--pling-color-text-muted, #334155);
  font-size: 12px;
  cursor: pointer;
}
.dock__quick button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dock__chat {
  flex: 1;
  min-height: 0;
}
.dock__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--pling-color-border, #e3e8f0);
}
.dock__tabs {
  display: flex;
  gap: 4px;
  min-width: 0;
  margin: 2px 0 0;
}
.dock__tabs button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--pling-color-text-muted, #64748b);
  font-size: 12px;
  cursor: pointer;
}
.dock__tabs button.is-active {
  border-bottom-color: var(--pling-color-primary, #2e9df7);
  color: var(--pling-color-primary-strong, #1677c8);
}
.dock__badge {
  padding: 0 5px;
  border-radius: 999px;
  background: var(--pling-color-primary-soft, #eaf6ff);
  color: var(--pling-color-primary-strong, #1677c8);
  font-size: 11px;
}
.dock__badge.is-bad {
  background: var(--pling-color-danger-soft, #fee2e2);
  color: var(--pling-color-danger, #b91c1c);
}
.dock__activity {
  margin: 0;
  padding: 4px 4px 4px 22px;
  font-size: 12px;
}
.dock__run {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding-right: 2px;
}
.dock__run-section {
  flex: none;
}
.dock__run-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 4px 4px;
}
.dock__run-label {
  margin: 0;
  color: var(--pling-color-text-subtle, #94a3b8);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.dock__run-toggle {
  padding: 1px 6px;
  border: none;
  border-radius: 999px;
  background: none;
  color: var(--pling-color-text-subtle, #94a3b8);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}
.dock__run-toggle:hover,
.dock__run-toggle.is-active {
  background: var(--pling-color-surface-muted, #f1f5f9);
  color: var(--pling-color-primary-strong, #1677c8);
}
.dock__run-toggle:focus-visible {
  outline: 2px solid var(--pling-color-primary, #2e9df7);
  outline-offset: 1px;
}
.dock__diagnostics {
  display: flex;
  flex: none;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  padding: 2px 4px 6px;
  border-bottom: 1px solid var(--pling-color-border-muted, #f1f5f9);
}
.dock__diagnostics .dock__usage {
  flex: 1 1 180px;
  min-width: 0;
  line-height: 1.45;
}
.dock__row {
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--pling-color-border-muted, #f1f5f9);
}
.dock__row:last-child {
  border-bottom: none;
}
.dock__row-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  flex-wrap: wrap;
}
.dock__activity code {
  color: var(--pling-color-text, #0f172a);
  word-break: break-all;
}
.dock__state {
  color: var(--pling-color-text-muted, #64748b);
  flex: none;
}
.dock__state.is-running {
  color: var(--pling-color-primary, #2e9df7);
}
.dock__state.is-ok {
  color: var(--pling-color-success, #15803d);
}
.dock__state.is-failed,
.dock__state.is-blocked {
  color: var(--pling-color-danger, #b91c1c);
}
.dock__desc {
  color: var(--pling-color-text-muted, #64748b);
}
.dock__args {
  margin: 2px 0 0;
  padding: 4px 6px;
  border-radius: 6px;
  background: var(--pling-color-surface-muted, #f8fafc);
  color: var(--pling-color-text-muted, #334155);
  font-family: var(--pling-font-family-mono, ui-monospace, monospace);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
}
.dock__detail {
  margin: 2px 0 0;
  color: var(--pling-color-text-subtle, #94a3b8);
}
.dock__activity .dock__empty {
  color: var(--pling-color-text-subtle, #94a3b8);
  list-style: none;
  margin-left: -16px;
  line-height: 1.6;
}
.dock__model {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--pling-color-surface-muted, #f8fafc);
  color: var(--pling-color-text-muted, #64748b);
  font-size: 11px;
  max-width: 150px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dock__model-button {
  border: 1px solid transparent;
  font: inherit;
  cursor: pointer;
}
.dock__model-button:hover,
.dock__model-button.is-active {
  border-color: var(--pling-color-border, #e3e8f0);
  background: var(--pling-color-primary-soft, #eaf6ff);
  color: var(--pling-color-primary-strong, #1677c8);
}
.dock__model-button:focus-visible {
  outline: 2px solid var(--pling-color-primary, #2e9df7);
  outline-offset: 1px;
}
.dock__model-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dock__model-caret {
  width: 10px;
  height: 10px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  transition: transform 120ms ease;
}
.dock__model-button.is-active .dock__model-caret {
  transform: rotate(180deg);
}
.dock__model-dot {
  width: 5px;
  height: 5px;
  flex: none;
  border-radius: 50%;
  background: var(--pling-color-success, #22a06b);
}
.dock__gate {
  color: var(--pling-color-warning, #b45309);
  font-size: 11px;
  white-space: nowrap;
}
.dock__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
}
.dock__ghost {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--pling-color-text-muted, #64748b);
  cursor: pointer;
}
.dock__ghost:hover {
  background: var(--pling-color-surface-muted, #f1f5f9);
  color: var(--pling-color-text, #0f172a);
}
.dock__ghost.is-active {
  background: var(--pling-color-primary-soft, #eaf6ff);
  color: var(--pling-color-primary-strong, #1677c8);
}
.dock__ghost:focus-visible {
  outline: 2px solid var(--pling-color-primary, #2e9df7);
  outline-offset: 1px;
}
.dock__icon {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dock__status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-height: 18px;
}
.dock__usage {
  margin: 0;
  color: var(--pling-color-text-subtle, #94a3b8);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
</style>
