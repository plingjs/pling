<script setup lang="ts">
/**
 * 通用调试面板：把「模型此刻看到的快照」渲染成人能看的东西。
 *
 * 分层要求：这个组件属于**框架**，不允许 import 任何业务模块。
 * 业务侧需要额外的东西（自定义组合按钮、审计日志），用 props / 插槽接进来：
 *   · event @executed  —— 每次执行后抛出，业务可据此记审计日志
 *   · slot #compose    —— 业务自定义的组合示例，通过插槽参数拿到 execute / snapshot
 */
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { createPolicy, createRuntime, type Policy, type Primitive, type Snapshot } from "@plingjs/core";
import { usePling } from "../directive";
import type { ExecutedEvent } from "../panel";
import type { CoverageReport, CoverageTarget } from "../coverage";

const props = defineProps<{
  title?: string;
  /** 权限决策：默认自动批准一切（只适合调试面板） */
  policy?: Policy;
}>();

const emit = defineEmits<{ executed: [ExecutedEvent] }>();

const pi = usePling();
const ui = pi.ui;
const t = ui.t;
const titleText = computed(() => props.title ?? t("panel.title"));
const runtime = createRuntime({
  registry: pi.registry,
  policy: props.policy ?? createPolicy(async () => true),
  llm: async () => ({ content: "" }),
});

const version = ref(0);
const coverage = ref<CoverageReport | null>(null);
let off: (() => void) | null = null;
onMounted(() => {
  version.value += 1;
  off = pi.registry.onChange(() => {
    version.value += 1;
  });
  refreshCoverage();
});
onUnmounted(() => off?.());

const snapshot = computed<Snapshot>(() => {
  void version.value;
  return pi.registry.snapshot();
});

const values = reactive<Record<string, string>>({});
const results = reactive<Record<string, string>>({});

function refreshCoverage(): void {
  coverage.value = pi.inspectCoverage();
}

function coverageStatus(target: CoverageTarget): string {
  if (target.status === "missing") return t("panel.coverage.missing");
  if (target.status === "grouped") {
    return target.actions?.length
      ? t("panel.coverage.groupedActions", { actions: target.actions.join(" / ") })
      : t("panel.coverage.groupedCheck");
  }
  return target.status;
}

function argsFor(id: string, primitive: Primitive): Record<string, unknown> {
  if (primitive === "type") return { text: values[id] ?? "" };
  if (primitive === "select") return { value: values[id] ?? "" };
  if (primitive === "press") return { key: values[id] || "Enter" };
  return {};
}

/** 面板自己的执行入口；也通过 #compose 插槽暴露给业务侧复用 */
async function execute(id: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const out = await runtime.execute(id, JSON.stringify(args));
  const event = toEvent(id, out);
  emit("executed", event);
  return out;
}

function toEvent(id: string, out: unknown): ExecutedEvent {
  const ok = !(out && typeof out === "object" && "error" in out);
  if (ok) {
    const result = (out as { result?: { warning?: string } }).result;
    return { id, ok, detail: result?.warning ?? "ok", result: out };
  }
  return { id, ok, detail: (out as { error: { code: string } }).error.code, result: out };
}

async function run(id: string, primitive: Primitive): Promise<void> {
  const out = await execute(id, argsFor(id, primitive));
  results[id] = JSON.stringify(out);
}
</script>

<template>
  <!-- 调试面板也是「框架自己的界面」：`data-pling-ui` 让 L1 派生跳过它（见 AgentDock） -->
  <section class="panel" :class="ui.classNames.panel" data-pling-ui :style="ui.cssVars">
    <h2>{{ titleText }}</h2>
    <p class="stats">
      {{ t("panel.actions", { total: snapshot.total, visible: snapshot.actions.length }) }}
      <span class="hint">{{ t("panel.actionsHint") }}</span>
    </p>

    <div class="coverage">
      <div class="coverage-head">
        <strong>{{ t("panel.coverage") }}</strong>
        <button type="button" class="rescan" @click="refreshCoverage">{{ t("panel.rescan") }}</button>
      </div>
      <template v-if="coverage">
        <p class="coverage-summary">
          {{ coverage.coveragePercent === null ? t("panel.coverage.none") : coverage.coveragePercent + "%" }}
          <span>{{ t("panel.coverage.summary", {
            declared: coverage.declared,
            derived: coverage.derived,
            grouped: coverage.grouped,
            missing: coverage.missing,
          }) }}</span>
        </p>
        <div v-for="target in coverage.targets" :key="`${target.element}:${target.status}`" class="coverage-target">
          <code>{{ target.element }}</code>
          <span>{{ target.label }}</span>
          <span class="hint">{{ coverageStatus(target) }}</span>
        </div>
        <p v-if="coverage.targets.length === 0 && coverage.total > 0" class="hint">{{ t("panel.coverage.complete") }}</p>
        <p v-if="coverage.total === 0" class="hint">{{ t("panel.coverage.empty") }}</p>
      </template>
    </div>

    <div v-if="snapshot.page" class="page">
      <strong>{{ t("panel.page") }}</strong>
      <div class="page-row">
        <span v-if="snapshot.page.title">{{ snapshot.page.title }}</span>
        <code v-if="snapshot.page.path">{{ snapshot.page.path }}</code>
        <code v-if="snapshot.page.name">{{ snapshot.page.name }}</code>
        <span v-if="snapshot.page.params" class="hint">{{ t("panel.page.params", { params: JSON.stringify(snapshot.page.params) }) }}</span>
      </div>
    </div>

    <div v-if="snapshot.feedbackTotal" class="feedback">
      <strong>{{ t("panel.feedback") }}</strong>
      <div v-for="item in snapshot.feedback" :key="item.id" class="feedback-row" :class="item.severity">
        <span class="badge">{{ item.severity }}</span>
        <code v-if="item.field">{{ item.field }}</code>
        <span>{{ item.message }}</span>
        <span v-if="item.scopePath?.length" class="hint">{{ t("panel.feedback.scope", { scope: item.scopePath.join(" / ") }) }}</span>
      </div>
      <span v-if="snapshot.feedbackTotal > snapshot.feedback.length" class="hint">
        {{ t("panel.feedback.more", { count: snapshot.feedbackTotal - snapshot.feedback.length }) }}
      </span>
    </div>

    <div v-if="snapshot.scopes.length" class="scopes">
      <div v-for="scope in snapshot.scopes" :key="scope.id" class="scope" :class="{ more: scope.hasMore }">
        <strong>{{ scope.label ?? scope.id }}</strong>
        <code>{{ scope.id }}</code>
        <span>{{ t("panel.scopes.visible", { visible: scope.visible, total: scope.total }) }}</span>
        <span v-if="scope.hasMore" class="more-tag">{{ t("panel.scopes.more", { count: scope.total - scope.visible }) }}</span>
        <span v-else class="done-tag">{{ t("panel.scopes.all") }}</span>
        <span v-if="scope.explore.length" class="hint">{{ t("panel.scopes.explore", { actions: scope.explore.join(" / ") }) }}</span>
      </div>
    </div>

    <!--
      记录（行数据）：`v-record` 声明过的行。
      没有声明时也给一句提示 —— 和状态一样，「告诉你缺什么」才是面板的一半价值。
    -->
    <div class="state">
      <strong>{{ t("panel.records") }}</strong>
      <div v-for="record in snapshot.records" :key="record.id" class="state-row">
        <code>{{ record.id }}</code>
        <span v-if="record.label" class="desc">{{ record.label }}</span>
        <code class="value">{{ JSON.stringify(record.fields) }}</code>
      </div>
      <span v-if="snapshot.recordsTotal > snapshot.records.length" class="hint">
        {{ t("panel.records.more", { count: snapshot.recordsTotal - snapshot.records.length }) }}
      </span>
      <span v-if="!snapshot.recordsTotal" class="hint">
        {{ t("panel.records.empty") }}
      </span>
    </div>

    <!--
      状态暴露：让开发者看清「模型此刻还看到了什么」。
      没有 expose 任何东西时也给一句提示——面板的价值一半在于「告诉你缺什么」。
    -->
    <div class="state">
      <strong>{{ t("panel.state") }}</strong>
      <div v-for="view in snapshot.stateViews" :key="view.key" class="state-row">
        <code>{{ view.key }}</code>
        <span v-if="view.description" class="desc">{{ view.description }}</span>
        <code class="value">{{ JSON.stringify(view.value) }}</code>
      </div>
      <span v-if="!snapshot.stateViews.length" class="hint">
        {{ t("panel.state.empty") }}
      </span>
    </div>

    <div class="compose">
      <slot name="compose" :execute="execute" :snapshot="snapshot" />
    </div>

    <div v-for="action in snapshot.actions" :key="action.id" class="tool">
      <div class="head">
        <code>{{ action.id }}</code>
        <span class="badge kind" :class="action.kind">{{ action.kind }}</span>
        <span class="badge fidelity" :class="action.fidelity">{{ action.fidelity }}</span>
        <span class="desc">{{ action.description }}</span>
      </div>
      <div class="body">
        <input
          v-if="action.primitive === 'type' || action.primitive === 'select' || action.primitive === 'press'"
          v-model="values[action.id]"
          :placeholder="action.primitive === 'press' ? 'Enter' : t('panel.arg.value')"
        />
        <button type="button" @click="run(action.id, action.primitive)">{{ t("panel.run") }}</button>
        <code v-if="results[action.id]" class="result">{{ results[action.id] }}</code>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  color: var(--pling-color-text, #0f172a);
  font-family: var(--pling-font-family, system-ui, sans-serif);
}
.stats {
  color: var(--pling-color-text-muted, #333);
}
.coverage {
  margin: 10px 0 14px;
  padding: 10px 12px;
  border: 1px solid var(--pling-color-primary, #dbeafe);
  border-radius: var(--pling-radius-md, 8px);
  background: var(--pling-color-primary-soft, #f8fbff);
  font-size: 12px;
}
.coverage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.rescan {
  padding: 3px 8px;
  border: 1px solid var(--pling-color-primary, #bfdbfe);
  border-radius: 5px;
  background: var(--pling-color-surface, white);
  color: var(--pling-color-primary-strong, #1677c8);
  cursor: pointer;
}
.coverage-summary {
  margin: 7px 0;
  font-weight: 600;
}
.coverage-summary span {
  color: var(--pling-color-text-muted, #64748b);
  font-weight: 400;
}
.coverage-target {
  display: grid;
  grid-template-columns: minmax(90px, auto) 1fr auto;
  gap: 8px;
  padding: 4px 0;
  border-top: 1px solid var(--pling-color-border, #e2e8f0);
}
.page {
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid var(--pling-color-border, #e2e8f0);
  border-radius: var(--pling-radius-md, 8px);
  background: var(--pling-color-surface-muted, #f8fafc);
  font-size: 12px;
}
.page-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}
.page-row code {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--pling-color-border-muted, #e2e8f0);
  color: var(--pling-color-text-muted, #475569);
}
.feedback {
  margin-bottom: 12px;
  font-size: 13px;
}
.feedback-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
  padding: 5px 8px;
  margin-top: 4px;
  border-left: 3px solid var(--pling-color-text-muted, #64748b);
  background: var(--pling-color-surface-muted, #f8fafc);
}
.feedback-row.error {
  border-color: var(--pling-color-danger, #dc2626);
}
.feedback-row.warning {
  border-color: var(--pling-color-warning, #d97706);
}
.feedback-row.success {
  border-color: var(--pling-color-success, #16a34a);
}
.scopes {
  margin-bottom: 12px;
}
.scope {
  display: flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--pling-color-primary-soft, #eef4fb);
  margin-bottom: 6px;
  font-size: 13px;
}
.scope.more {
  background: var(--pling-color-warning-soft, #fff4e5);
}
.more-tag {
  color: var(--pling-color-warning, #b26a00);
}
.done-tag {
  color: var(--pling-color-success, #2e7d32);
}
.hint {
  color: var(--pling-color-text-subtle, #888);
}
.hint:empty {
  display: none;
}
.state {
  margin-bottom: 12px;
  font-size: 13px;
}
.state-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
  padding: 4px 8px;
}
.state-row .value {
  color: var(--pling-color-success, #0b5);
  word-break: break-all;
}
.compose {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 8px;
  background: var(--pling-color-surface-muted, #f6f8fa);
  border-radius: 6px;
  margin-bottom: 12px;
}
.compose:empty {
  display: none;
}
.tool {
  border: 1px solid var(--pling-color-border, #ddd);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
}
.head {
  display: flex;
  gap: 6px;
  align-items: baseline;
}
.desc {
  flex: 1;
  color: var(--pling-color-text-muted, #444);
}
.badge {
  font-size: 11px;
  border-radius: 4px;
  padding: 0 6px;
  color: #fff;
}
.kind {
  background: var(--pling-color-text-muted, #607d8b);
}
.kind.read {
  background: var(--pling-color-success, #2e7d32);
}
.kind.danger {
  background: var(--pling-color-danger, #c62828);
}
.fidelity.high {
  background: var(--pling-color-primary-strong, #1565c0);
}
.fidelity.auto {
  background: var(--pling-color-primary, #6a1b9a);
}
.fidelity.low {
  background: var(--pling-color-warning, #ef6c00);
}
.body {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 6px;
}
.result {
  color: var(--pling-color-text-muted, #555);
  font-size: 12px;
}
</style>
