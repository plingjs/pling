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
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, useSlots, watch } from "vue";
import type { Llm, Registry } from "@plingjs/core";
import type { AgentBeforeSendHandler } from "../before-send";
import {
  compactAt,
  createAgentRuntime,
  resolveAgentConfig,
  toActivityRows,
  type ActivityRow,
  type ActiveGuidedTask,
  type AgentConfigOverrides,
  type AgentRuntime,
  type AgentTraceOptions,
  type HookRegistry,
  type PendingApproval,
  type PendingHandoff,
  type SessionEvent,
  type TaskGuideCommand,
} from "@plingjs/agent";
import { ensurePlingStyles, sameOriginUrl } from "@plingjs/dom";
import {
  describePlingDiagnostic,
  diagnosticMessageKey,
  quickTaskOf,
  type QuickTaskItem,
} from "@plingjs/ui";
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
import AgentTaskGuide from "./AgentTaskGuide.vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    placeholder?: string;
    emptyHint?: string;
    /** Render a speaker header (name + time) above each chat message. */
    speakers?: boolean;
    /** Recommended tasks. They stay available for repeated work; only disable while running. */
    quick?: readonly QuickTaskItem[];
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
    /** Composer density. `multiline` is for full workspace panels. */
    composer?: "compact" | "multiline";
    /** Keep the active task above the transcript (`pinned`), in the message flow (`inline`), or hidden (`none`). */
    taskPlacement?: "inline" | "pinned" | "none";
    /** Render the `#guide` slot above the transcript (`top`) or as the newest message (`end`). */
    guidePlacement?: "top" | "end";
    /** Built-in surfaces register with the page task router by default. */
    manageSurface?: boolean;
    surfaceId?: string;
    /** Show the collapse control. Used by the dock shell, not by inline layouts. */
    collapsible?: boolean;
    /** Enable the read-only request inspector in the run surface. Off by default. */
    debug?: boolean | AgentTraceOptions;
    /** Expose model connection details in the run surface. `off` unless explicitly enabled. */
    modelSettings?: ModelSettingsSetting;
    /** Optional local responder. Return handled: true to answer without calling the model. */
    beforeSend?: AgentBeforeSendHandler;
  }>(),
  {
    quick: () => [],
    visible: true,
    variant: "inline",
    composer: "multiline",
    taskPlacement: "pinned",
    guidePlacement: "top",
    manageSurface: true,
    surfaceId: "inline",
    collapsible: false,
    speakers: true,
  },
);

const emit = defineEmits<{
  event: [event: SessionEvent];
  collapse: [];
  status: [status: { running: boolean; resume: boolean }];
}>();

const pi = usePling();
const ui = pi.ui;
ensurePlingStyles();
const t = ui.t;
const registry = computed(() => props.registry ?? pi.registry);
const titleText = computed(() => props.title ?? t("dock.assistant"));
const quickItems = computed(() => props.quick.map(quickTaskOf));
const setup = pi.agent ?? {};
const showText = (text: string): string => (pi.revealSensitive ? registry.value.tokens.resolve(text) : text);

const draft = ref("");
const running = ref(false);
const events = shallowRef<SessionEvent[]>([]);
const resumeDismissed = ref(false);
const tab = ref<"chat" | "activity">("chat");
const debugOpen = ref(false);
const modelSettingsOpen = ref(false);
const quickMenuOpen = ref(false);
const pending = ref<PendingApproval | null>(null);
const pendingHandoff = ref<PendingHandoff | null>(null);
const quickMenuEl = ref<HTMLElement | null>(null);
const gateActive = computed(() => (props.gate ?? setup.gate)?.() ?? true);
const notReady = ref(false);
let destroyed = false;
let returnTimer: ReturnType<typeof setTimeout> | null = null;
let offTask: (() => void) | null = null;
const tick = ref(0);
const guideRevision = ref(0);
const activeGuide = shallowRef<ActiveGuidedTask | null>(null);
let offGuidedTask: (() => void) | null = null;
const slots = useSlots();
const hasTask = computed(() => Boolean(activeGuide.value?.guide) || Boolean(slots.task));

function refreshActiveGuide(): void {
  activeGuide.value = pi.task.active();
  guideRevision.value += 1;
}
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
    taskCatalog: pi.task,
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

function runGuideCommand(command: TaskGuideCommand): void {
  pi.task.command(command);
  refreshActiveGuide();
}

function selectTab(next: "chat" | "activity"): void {
  tab.value = next;
  quickMenuOpen.value = false;
}

function toggleQuickMenu(): void {
  if (!quickItems.value.length) return;
  quickMenuOpen.value = !quickMenuOpen.value;
}

function runQuick(prompt: string): void {
  if (!prompt.trim() || running.value) return;
  quickMenuOpen.value = false;
  void send(prompt);
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!quickMenuOpen.value) return;
  if (quickMenuEl.value?.contains(event.target as Node)) return;
  quickMenuOpen.value = false;
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
  [running, () => Boolean(resume.value)],
  () => emit("status", { running: running.value, resume: Boolean(resume.value) }),
  { immediate: true },
);

async function send(text: string): Promise<void> {
  const value = text.trim();
  if (!value || running.value) return;
  quickMenuOpen.value = false;
  draft.value = "";

  // Page-guided flows can resolve a complete instruction locally. This is an
  // opt-in seam: without `beforeSend`, the model path is unchanged.
  if (props.beforeSend) {
    running.value = true;
    let local: Awaited<ReturnType<AgentBeforeSendHandler>>;
    try {
      local = await props.beforeSend(value);
    } catch (error) {
      running.value = false;
      throw error;
    }
    if (local?.handled) {
      const userEvent: SessionEvent = { type: "user", text: value };
      events.value = [...events.value, userEvent];
      runtime.value.session.loop.history.append({
        role: "user",
        content: registry.value.redactText(value),
      });
      emit("event", userEvent);
      if (local.reply?.trim()) {
        const reply = local.reply.trim();
        const replyEvent: SessionEvent = { type: "assistant", text: reply };
        events.value = [...events.value, replyEvent];
        runtime.value.session.loop.history.append({ role: "assistant", content: reply });
        emit("event", replyEvent);
      }
      tick.value += 1;
      running.value = false;
      return;
    }
    running.value = false;
  }

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
  quickMenuOpen.value = false;
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

/** Append a local assistant message without invoking the model. */
function say(text: string): void {
  const value = text.trim();
  if (!value) return;
  const event: SessionEvent = { type: "assistant", text: value };
  events.value = [...events.value, event];
  runtime.value.session.loop.history.append({ role: "assistant", content: value });
  tick.value += 1;
  emit("event", event);
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown);
  offGuidedTask = pi.task.subscribe(() => {
    refreshActiveGuide();
  });
  refreshActiveGuide();
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
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  offTask?.();
  offGuidedTask?.();
  offGuidedTask = null;
  destroyed = true;
  cancelReturn();
  runtime.value.session.cancel();
  runtime.value.approvals.clear();
  runtime.value.handoffs.clear();
});

defineExpose({ runtime, send, ask: send, say });
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
      class="dock__panel pling-inline__panel pling-dock__panel"
      :class="ui.classNames.panel"
      :aria-label="titleText"
    >
      <p v-if="notReadyText" class="dock__warn pling-dock__warn">{{ notReadyText }}</p>

      <div class="dock__nav pling-dock__nav">
        <nav class="dock__tabs pling-dock__tabs" role="tablist">
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
            <span v-if="activityRows.length" class="dock__badge pling-dock__badge" :class="{ 'is-bad': failedCount > 0 }">
              {{ activityRows.length }}
            </span>
          </button>
        </nav>
        <div class="dock__actions pling-dock__actions">
          <slot name="nav-actions" />
          <div v-if="quickItems.length" ref="quickMenuEl" class="dock__action-wrap pling-dock__action-wrap">
            <button
              type="button"
              class="dock__ghost pling-dock__ghost"
              :class="{ 'is-active': quickMenuOpen }"
              :aria-label="t('dock.pageActions')"
              :aria-expanded="quickMenuOpen"
              :title="t('dock.pageActions')"
              @click.stop="toggleQuickMenu"
            >
              <svg class="dock__icon pling-dock__icon" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4 5.5h12M4 10h12M4 14.5h8" />
              </svg>
            </button>
            <div v-if="quickMenuOpen" class="pling-dock__actions-menu" role="menu">
              <header>
                <strong>{{ t("dock.pageActions") }}</strong>
                <span>{{ t("dock.pageActionsHint") }}</span>
              </header>
              <button
                v-for="(task, index) in quickItems"
                :key="`${task.prompt}:menu:${index}`"
                type="button"
                role="menuitem"
                :disabled="running || task.disabled"
                :title="task.description"
                @click="runQuick(task.prompt)"
              >
                <span>{{ task.label }}</span>
                <small v-if="task.description">{{ task.description }}</small>
              </button>
            </div>
          </div>
          <button
            type="button"
            class="dock__ghost pling-dock__ghost"
            :aria-label="t('dock.clear')"
            :title="t('dock.clear')"
            @click="clear"
          >
            <svg class="dock__icon pling-dock__icon" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 4.5h12v9H9l-4 3v-3H4z" />
              <path d="M8 7.5l4 4M12 7.5l-4 4" />
            </svg>
          </button>
          <button
            v-if="collapsible"
            type="button"
            class="dock__ghost pling-dock__ghost"
            :aria-label="t('dock.collapse')"
            :title="t('dock.collapse')"
            @click="emit('collapse')"
          >
            <svg class="dock__icon pling-dock__icon" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="running" class="dock__running pling-dock__running">
        <span class="pling-dock__running-dot" aria-hidden="true" />
        <span>{{ t("chat.running") }}</span>
        <button type="button" class="stop pling-chat__stop" @click="runtime.session.cancel()">{{ t("chat.stop") }}</button>
      </div>

      <div v-if="tab === 'activity'" class="dock__run pling-dock__run">
        <div class="dock__diagnostics pling-dock__diagnostics">
          <button
            v-if="modelSettingsEnabled"
            type="button"
            class="dock__model dock__model-button pling-dock__model pling-dock__model-button"
            :class="{ 'is-active': modelSettingsOpen }"
            :aria-label="t('modelSettings.title')"
            :aria-expanded="modelSettingsOpen"
            :title="limitsHint"
            data-testid="pling-model-settings-toggle"
            @click="toggleModelSettings"
          >
            <span class="dock__model-dot pling-dock__model-dot" aria-hidden="true"></span>
            <span class="dock__model-name pling-dock__model-name">{{ runtime.model || t("dock.model.unconfigured") }}</span>
            <svg class="dock__model-caret pling-dock__model-caret" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5l3 3 3-3" />
            </svg>
          </button>
          <span v-else class="dock__model pling-dock__model" :title="limitsHint">
            <span class="dock__model-dot pling-dock__model-dot" aria-hidden="true"></span>
            <span class="dock__model-name pling-dock__model-name">{{ runtime.model || t("dock.model.unconfigured") }}</span>
          </span>
          <span class="dock__usage pling-dock__usage">{{ summary }}</span>
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

        <section class="dock__run-section pling-dock__run-section" data-testid="pling-run-actions">
          <div class="dock__run-head pling-dock__run-head">
            <p class="dock__run-label pling-dock__run-label">{{ t("dock.run.actions") }}</p>
            <button
              v-if="debugEnabled"
              type="button"
              class="dock__run-toggle pling-dock__run-toggle"
              :class="{ 'is-active': debugOpen }"
              :aria-expanded="debugOpen"
              data-testid="pling-debug-toggle"
              @click="toggleDebug"
            >
              {{ t("debug.title") }}
            </button>
          </div>
          <ol class="dock__activity pling-dock__activity">
            <li v-for="row in activityRows" :key="row.seq" class="dock__row pling-dock__row">
              <p class="dock__row-head pling-dock__row-head">
                <code>{{ row.id }}</code>
                <span :class="['dock__state', 'pling-dock__state', `is-${row.status}`]">{{ stateText(row.status) }}</span>
                <span v-if="row.description" class="dock__desc pling-dock__desc">{{ row.description }}</span>
              </p>
              <pre v-if="Object.keys(row.args).length" class="dock__args pling-dock__args">{{ showText(JSON.stringify(row.args)) }}</pre>
              <p v-if="row.detail" class="dock__detail pling-dock__detail">{{ showText(row.detail) }}</p>
            </li>
            <li v-if="!activityRows.length" class="dock__empty pling-dock__empty">{{ t("dock.activity.empty") }}</li>
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
        class="dock__chat pling-dock__chat"
        :title="titleText"
        :placeholder="placeholder"
        :empty-hint="emptyHint"
        :speakers="speakers"
        :quick="quickItems"
        :show-header="false"
        :events="events"
        :running="running"
        :pending="pending"
        :pending-handoff="pendingHandoff"
        :resume="resume"
        :multiline="composer === 'multiline'"
        :task-placement="taskPlacement"
        :guide-placement="guidePlacement"
        :has-task="hasTask"
        :reveal="showText"
        @send="send"
        @resume="resumeTask"
        @dismiss-resume="dismissResume"
        @reply="(decision) => runtime.approvals.reply(decision)"
        @handoff="(done) => runtime.handoffs.reply(done)"
        @handoff-step="(delta) => runtime.handoffs.moveStep(delta)"
        @quick="runQuick"
        @stop="runtime.session.cancel()"
      >
        <template #task>
          <slot name="task">
            <AgentTaskGuide
              v-if="activeGuide?.guide"
              :definition="activeGuide.guide"
              :snapshot="activeGuide.state.snapshot ?? null"
              :step="activeGuide.state.step ?? 1"
              :busy="activeGuide.state.busy ?? false"
              :error="activeGuide.state.error ?? ''"
              :completed="activeGuide.state.completed ?? false"
              :revision="guideRevision"
              @command="runGuideCommand"
            />
          </slot>
        </template>
        <template v-if="$slots.guide" #guide>
          <slot name="guide" />
        </template>
      </AgentChat>

      <footer v-if="!gateActive" class="dock__status pling-dock__status">
        <span class="dock__gate pling-dock__gate" :title="t('dock.gate.offTitle')">
          {{ t("dock.gate.off") }}
        </span>
      </footer>
    </section>
  </div>
</template>

