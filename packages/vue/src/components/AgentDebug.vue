<script setup lang="ts">
/**
 * Read-only inspector for the runtime that is already driving this chat.
 *
 * It deliberately does not execute actions and does not create a second runtime:
 * the useful debugging question is what *this* conversation saw and did.
 */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { Registry, Snapshot } from "@plingjs/core";
import type { AgentRuntime, AgentTraceCall } from "@plingjs/agent";
import { formatAvailabilityReason } from "@plingjs/ui";
import { usePling } from "../directive";
import type { CoverageReport } from "../coverage";

const props = defineProps<{ runtime: AgentRuntime; registry: Registry }>();

const pi = usePling();
const ui = pi.ui;
const t = ui.t;
const version = ref(0);
const coverage = ref<CoverageReport | null>(null);
const offs: Array<() => void> = [];

function refreshCoverage(): void {
  coverage.value = pi.inspectCoverage();
}

onMounted(() => {
  offs.push(props.registry.onChange(() => (version.value += 1)));
  const offTrace = props.runtime.trace?.subscribe(() => (version.value += 1));
  if (offTrace) offs.push(offTrace);
  refreshCoverage();
});

onUnmounted(() => {
  for (const off of offs) off();
});

const snapshot = computed<Snapshot>(() => {
  void version.value;
  return props.registry.snapshot();
});

const calls = computed<readonly AgentTraceCall[]>(() => {
  void version.value;
  return props.runtime.trace?.calls ?? [];
});

const historySummary = computed(() => {
  void version.value;
  return props.runtime.session.loop.history.summary;
});

const latestSeq = computed(() => calls.value[calls.value.length - 1]?.seq ?? 0);
const expandedSeq = ref(0);

watch(
  latestSeq,
  (seq) => {
    expandedSeq.value = seq;
  },
  { immediate: true },
);

function toggleCall(seq: number, event: Event): void {
  const open = (event.currentTarget as HTMLDetailsElement | null)?.open ?? false;
  expandedSeq.value = open ? seq : expandedSeq.value === seq ? 0 : expandedSeq.value;
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function messageLabel(message: { role: string; name?: string; toolCallId?: string }): string {
  return [message.role, message.name, message.toolCallId].filter(Boolean).join(" · ");
}

function duration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function coverageSummary(): string {
  const report = coverage.value;
  if (!report || report.coveragePercent === null) return t("panel.coverage.none");
  return `${report.coveragePercent}% · ${t("panel.coverage.summary", {
    declared: report.declared,
    derived: report.derived,
    grouped: report.grouped,
    missing: report.missing,
  })}`;
}

function missingTargets() {
  return coverage.value?.targets.filter((target) => target.status === "missing") ?? [];
}
</script>

<template>
  <section class="debug" data-testid="pling-debug" :style="ui.cssVars">
    <header class="debug__head">
      <span class="debug__title">{{ t("debug.title") }}</span>
      <span class="debug__readonly">{{ t("debug.readonly") }}</span>
      <button type="button" class="debug__refresh" @click="refreshCoverage">{{ t("debug.refresh") }}</button>
    </header>
    <p class="debug__note">{{ t("debug.sensitiveNote") }}</p>

    <details class="debug__section" open>
      <summary>{{ t("debug.page") }}</summary>
      <div v-if="snapshot.page" class="debug__card">
        <code>{{ snapshot.page.title || snapshot.page.path || snapshot.page.name }}</code>
        <p v-if="snapshot.page.path">{{ snapshot.page.path }}</p>
      </div>

      <div class="debug__subhead">
        <strong>{{ t("debug.actions") }}</strong>
        <span>
          {{ t("debug.actionsSummary", {
            visible: snapshot.actions.length,
            total: snapshot.total,
            unavailable: snapshot.unavailableTotal,
          }) }}
        </span>
      </div>
      <ul v-if="snapshot.actions.length" class="debug__list">
        <li v-for="action in snapshot.actions" :key="action.id">
          <code>{{ action.id }}</code>
          <span>{{ action.primitive }} · {{ action.kind }}</span>
          <span v-if="action.scopePath?.length" class="debug__muted">{{ action.scopePath.join(" / ") }}</span>
          <span class="debug__desc">{{ action.description }}</span>
        </li>
      </ul>
      <p v-else class="debug__empty">{{ t("debug.noActions") }}</p>

      <template v-if="snapshot.unavailable.length">
        <div class="debug__subhead"><strong>{{ t("debug.unavailable") }}</strong></div>
        <ul class="debug__list">
          <li v-for="action in snapshot.unavailable" :key="action.id">
            <code>{{ action.id }}</code>
            <span class="debug__muted">{{ formatAvailabilityReason(action, t) }}</span>
          </li>
        </ul>
      </template>

      <div class="debug__subhead">
        <strong>{{ t("debug.scopes") }}</strong>
        <span>{{ t("debug.scopesTotal", { visible: snapshot.scopes.filter((scope) => scope.active).length, total: snapshot.scopes.length }) }}</span>
      </div>
      <ul v-if="snapshot.scopes.length" class="debug__list">
        <li v-for="scope in snapshot.scopes" :key="scope.id">
          <code>{{ scope.id }}</code>
          <span>{{ scope.label || scope.role || "" }}</span>
          <span class="debug__muted">{{ scope.visible }} / {{ scope.total }}</span>
        </li>
      </ul>
      <p v-else class="debug__empty">{{ t("debug.noScopes") }}</p>

      <div class="debug__subhead">
        <strong>{{ t("debug.records") }}</strong>
        <span>{{ t("debug.recordsTotal", { shown: snapshot.records.length, total: snapshot.recordsTotal }) }}</span>
      </div>
      <ul v-if="snapshot.records.length" class="debug__list">
        <li v-for="record in snapshot.records" :key="record.id">
          <code>{{ record.id }}</code>
          <span>{{ record.label || "" }}</span>
          <pre>{{ pretty(record.fields) }}</pre>
        </li>
      </ul>
      <p v-else class="debug__empty">{{ t("debug.noRecords") }}</p>

      <div class="debug__subhead"><strong>{{ t("debug.state") }}</strong></div>
      <ul v-if="snapshot.stateViews.length" class="debug__list">
        <li v-for="item in snapshot.stateViews" :key="item.key">
          <code>{{ item.key }}</code>
          <span v-if="item.description" class="debug__desc">{{ item.description }}</span>
          <pre>{{ pretty(item.value) }}</pre>
        </li>
      </ul>
      <p v-else class="debug__empty">{{ t("debug.noState") }}</p>

      <div class="debug__subhead"><strong>{{ t("debug.feedback") }}</strong></div>
      <ul v-if="snapshot.feedback.length" class="debug__list">
        <li v-for="item in snapshot.feedback" :key="item.id">
          <span :class="['debug__severity', `is-${item.severity}`]">{{ item.severity }}</span>
          <span>{{ item.message }}</span>
          <span v-if="item.scopePath?.length" class="debug__muted">{{ item.scopePath.join(" / ") }}</span>
        </li>
      </ul>
      <p v-else class="debug__empty">{{ t("debug.noFeedback") }}</p>
    </details>

    <details class="debug__section" open>
      <summary>{{ t("debug.calls") }}</summary>
      <p v-if="!calls.length" class="debug__empty">{{ t("debug.noCalls") }}</p>
      <details
        v-for="call in calls"
        :key="call.seq"
        class="debug__call"
        :open="call.seq === expandedSeq"
        @toggle="toggleCall(call.seq, $event)"
      >
        <summary>
          <span>#{{ call.seq }}</span>
          <span>{{ t("debug.turn", { turn: call.turn }) }}</span>
          <span :class="['debug__status', `is-${call.status}`]">{{ t(`debug.status.${call.status}`) }}</span>
          <span>{{ duration(call.durationMs) }}</span>
          <span>{{ call.contextTokens }} tokens</span>
        </summary>

        <div v-if="call.seq === expandedSeq" :data-testid="`pling-call-body-${call.seq}`">
          <p v-if="call.error" class="debug__error">{{ call.error.code }}: {{ call.error.message }}</p>

          <div class="debug__subhead"><strong>{{ t("debug.request") }}</strong></div>
          <div v-for="(message, index) in call.messages" :key="`${call.seq}:${index}`" class="debug__message">
            <p class="debug__messageHead">{{ messageLabel(message) }}</p>
            <pre v-if="message.content">{{ message.content }}</pre>
            <ul v-if="message.toolCalls?.length" class="debug__toolCalls">
              <li v-for="toolCall in message.toolCalls" :key="toolCall.id">
                <code>{{ toolCall.name }}</code>
                <span>{{ toolCall.arguments }}</span>
              </li>
            </ul>
          </div>

          <details class="debug__nested">
            <summary>{{ t("debug.tools") }} ({{ call.tools.length }})</summary>
            <ul v-if="call.tools.length" class="debug__list">
              <li v-for="tool in call.tools" :key="tool.function.name">
                <code>{{ tool.function.name }}</code>
                <span class="debug__desc">{{ tool.function.description }}</span>
                <pre class="debug__schema">{{ pretty(tool.function.parameters) }}</pre>
              </li>
            </ul>
            <p v-else class="debug__empty">{{ t("debug.noTools") }}</p>
          </details>

          <template v-if="call.response">
            <div class="debug__subhead"><strong>{{ t("debug.response") }}</strong></div>
            <pre v-if="call.response.content">{{ call.response.content }}</pre>
            <ul v-if="call.response.toolCalls.length" class="debug__toolCalls">
              <li v-for="toolCall in call.response.toolCalls" :key="toolCall.id">
                <code>{{ toolCall.name }}</code>
                <span>{{ toolCall.arguments }}</span>
              </li>
            </ul>
          </template>

          <details class="debug__nested">
            <summary>{{ t("debug.callSnapshot") }}</summary>
            <p class="debug__muted">
              {{ call.snapshot.actions.length }} actions · {{ call.snapshot.records.length }} records ·
              {{ call.snapshot.stateViews.length }} state keys
            </p>
            <ul class="debug__list">
              <li v-for="action in call.snapshot.actions" :key="action.id">
                <code>{{ action.id }}</code>
                <span class="debug__desc">{{ action.description }}</span>
              </li>
            </ul>
          </details>
        </div>
      </details>
    </details>

    <details class="debug__section">
      <summary>{{ t("debug.coverage") }}</summary>
      <p>{{ coverageSummary() }}</p>
      <ul v-if="missingTargets().length" class="debug__list">
        <li v-for="target in missingTargets()" :key="target.element">
          <code>{{ target.element }}</code>
          <span class="debug__desc">{{ target.label }}</span>
        </li>
      </ul>
    </details>

    <details v-if="historySummary" class="debug__section">
      <summary>{{ t("debug.historySummary") }}</summary>
      <pre>{{ historySummary }}</pre>
    </details>
  </section>
</template>

<style scoped>
.debug {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 4px;
  padding: 2px 2px 8px;
  color: var(--pling-color-text, #0f172a);
  font-size: 11px;
}
.debug__head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0 4px;
}
.debug__title {
  font-size: 12px;
  font-weight: 600;
}
.debug__readonly {
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--pling-color-surface-muted, #f8fafc);
  color: var(--pling-color-text-subtle, #94a3b8);
}
.debug__refresh {
  margin-left: auto;
  padding: 2px 6px;
  border: 1px solid var(--pling-color-border, #e3e8f0);
  border-radius: 6px;
  background: var(--pling-color-surface, #fff);
  color: var(--pling-color-text-muted, #64748b);
  font: inherit;
  cursor: pointer;
}
.debug__section,
.debug__call,
.debug__nested {
  border: 1px solid var(--pling-color-border-muted, #f1f5f9);
  border-radius: 7px;
  background: var(--pling-color-surface, #fff);
}
.debug__section > summary,
.debug__call > summary,
.debug__nested > summary {
  padding: 5px 7px;
  color: var(--pling-color-text-muted, #475569);
  font-weight: 600;
  cursor: pointer;
}
.debug__section > summary {
  background: var(--pling-color-surface-muted, #f8fafc);
}
.debug__section > :not(summary),
.debug__call > :not(summary),
.debug__nested > :not(summary) {
  margin-right: 7px;
  margin-left: 7px;
}
.debug__section > :last-child,
.debug__call > :last-child,
.debug__nested > :last-child {
  margin-bottom: 7px;
}
.debug__call {
  margin: 5px 7px;
}
.debug__call > summary {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 7px;
  font-weight: 400;
}
.debug__call .debug__status {
  font-weight: 600;
}
.debug__status.is-ok {
  color: var(--pling-color-success, #15803d);
}
.debug__status.is-error {
  color: var(--pling-color-danger, #b91c1c);
}
.debug__status.is-cancelled {
  color: var(--pling-color-warning, #b45309);
}
.debug__nested {
  margin-top: 5px;
  margin-bottom: 5px;
}
.debug__facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 8px;
  margin: 7px;
}
.debug__facts dt {
  color: var(--pling-color-text-muted, #64748b);
}
.debug__facts dd {
  margin: 0;
  word-break: break-word;
}
.debug__subhead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin-top: 7px;
  color: var(--pling-color-text-muted, #475569);
}
.debug__subhead span {
  color: var(--pling-color-text-subtle, #94a3b8);
  text-align: right;
}
.debug__list {
  margin: 4px 0 6px;
  padding-left: 16px;
}
.debug__list li {
  margin: 3px 0;
  line-height: 1.45;
}
.debug__list code,
.debug__card code {
  color: var(--pling-color-primary-strong, #1677c8);
  word-break: break-all;
}
.debug__list li > span {
  margin-left: 5px;
}
.debug__desc {
  color: var(--pling-color-text-muted, #475569);
}
.debug__muted,
.debug__note {
  color: var(--pling-color-text-subtle, #94a3b8);
}
.debug__note {
  margin-top: 6px;
  line-height: 1.45;
}
.debug__card {
  margin-top: 6px;
  padding: 5px 7px;
  border-radius: 6px;
  background: var(--pling-color-surface-muted, #f8fafc);
}
.debug__card p {
  margin: 2px 0 0;
  color: var(--pling-color-text-muted, #64748b);
}
.debug__message {
  margin: 5px 0;
  padding: 5px 6px;
  border-left: 2px solid var(--pling-color-border, #cbd5e1);
  background: var(--pling-color-surface-muted, #f8fafc);
}
.debug__messageHead {
  margin: 0 0 3px;
  color: var(--pling-color-text-muted, #475569);
  font-family: var(--pling-font-family-mono, ui-monospace, monospace);
}
.debug pre {
  box-sizing: border-box;
  max-height: 260px;
  margin: 3px 0 0;
  padding: 5px 6px;
  overflow: auto;
  border-radius: 5px;
  background: var(--pling-color-surface-muted, #f8fafc);
  color: var(--pling-color-text-muted, #334155);
  font-family: var(--pling-font-family-mono, ui-monospace, monospace);
  font-size: 10px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
.debug__toolCalls {
  margin: 3px 0 0;
  padding-left: 16px;
  font-family: var(--pling-font-family-mono, ui-monospace, monospace);
  font-size: 10px;
}
.debug__toolCalls li {
  word-break: break-all;
}
.debug__toolCalls span {
  margin-left: 5px;
  color: var(--pling-color-text-muted, #475569);
}
.debug__severity {
  padding: 0 4px;
  border-radius: 4px;
  background: var(--pling-color-surface-muted, #f1f5f9);
}
.debug__severity.is-error {
  background: var(--pling-color-danger-soft, #fee2e2);
  color: var(--pling-color-danger, #b91c1c);
}
.debug__severity.is-warning {
  background: var(--pling-color-warning-soft, #fff7ed);
  color: var(--pling-color-warning, #9a3412);
}
.debug__severity.is-success {
  background: var(--pling-color-success-soft, #f0fdf4);
  color: var(--pling-color-success, #15803d);
}
.debug__error {
  padding: 5px 6px;
  border-radius: 6px;
  background: var(--pling-color-danger-soft, #fee2e2);
  color: var(--pling-color-danger, #b91c1c);
  word-break: break-word;
}
.debug__empty {
  color: var(--pling-color-text-subtle, #94a3b8);
  line-height: 1.5;
}
</style>
