<script setup lang="ts">
/**
 * 问答入口（通用，来自框架，不含任何业务知识）。
 *
 * 这一版是**纯展示组件**：事件流、发送、确认回复都由外部（业务侧）接线。
 * 这样搭的好处是它同时适配两种拓扑：
 *   - 循环在浏览器（LocalSession）：业务把 session.events() 传进来，send 直接调 session.send
 *   - 循环在服务端（RemoteSession，M4）：业务把服务端推来的事件传进来，send 走 WebSocket
 * 组件本身完全不需要知道循环在哪。
 *
 * 注意（踩过的坑）：面板类 UI 不能参与文档高度，否则「滚动 → 内容变少 → 文档变矮 →
 * scrollTop 被夹回」会形成自咬回路。这里固定视口高度 + 自己滚动。
 */
import { computed, inject, ref } from "vue";
import MarkdownIt from "markdown-it";
import { supportsAlwaysAllow } from "@plingjs/core";
import { toTranscriptLines, type PendingApproval, type PendingHandoff, type SessionEvent } from "@plingjs/agent";
import { PLING_KEY } from "../directive";
import { STANDALONE_UI } from "../ui";

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  const token = tokens[index]!;
  const href = String(token.attrGet("href") ?? "");
  if (/^(?:https?:|mailto:)/i.test(href)) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
  }
  return self.renderToken(tokens, index, options);
};

function renderMarkdown(text: string): string {
  return markdown.render(text);
}

const props = withDefaults(
  defineProps<{
    title?: string;
    events?: readonly SessionEvent[];
    running?: boolean;
    /** 当前待确认的动作；danger 动作永远只能「批准本次」 */
    pending?: PendingApproval | null;
    /** 当前等待用户亲自完成的人工步骤（S5） */
    pendingHandoff?: PendingHandoff | null;
    placeholder?: string;
    emptyHint?: string;
    /**
     * 把**动作流水**（`composer_text{"text":…}` / `ok`）也画进对话。
     * 默认 false —— 那是给调试看的，用户要的是「它在动」的感觉；
     * 详细参数在「运行」里（`toActivityRows`）。要全看（终端 / 调试器）就打开。
     */
    tools?: boolean;
    /**
     * 展示层改写（S14）：把 `{{p:…}}` 代号还原成人能看的真值。
     * 只作用于渲染 —— 事件流、历史与发给模型的请求原样不动。
     */
    reveal?: (text: string) => string;
    /** MPA 恢复入口：有值时在对话顶部显示「继续上次任务」。 */
    resume?: { goal?: string; interrupted?: boolean } | null;
  }>(),
  {
    events: () => [],
    running: false,
    pending: null,
    tools: false,
  },
);

const emit = defineEmits<{
  send: [text: string];
  reply: [decision: boolean | "always"];
  handoff: [done: boolean];
  handoffStep: [delta: number];
  resume: [];
  dismissResume: [];
  stop: [];
}>();

const draft = ref("");
const pi = inject(PLING_KEY, null);
const ui = pi?.ui ?? STANDALONE_UI;
const t = ui.t;
const titleText = computed(() => props.title ?? t("chat.title"));
const placeholderText = computed(() => props.placeholder ?? t("chat.placeholder"));
const emptyText = computed(() => props.emptyHint ?? t("chat.empty"));
const lines = computed(() =>
  toTranscriptLines(props.events, { tools: props.tools, locale: ui.locale, translate: t }),
);
const shown = (text: string): string => (props.reveal ? props.reveal(text) : text);
const handoffSteps = computed(() => props.pendingHandoff?.request.steps ?? []);
const handoffStep = computed(() => props.pendingHandoff?.step ?? 0);
const handoffLast = computed(() => handoffStep.value >= handoffSteps.value.length - 1);

function submit(): void {
  const text = draft.value.trim();
  if (!text || props.running) return;
  draft.value = "";
  emit("send", text);
}
</script>

<template>
  <section class="chat" :class="ui.classNames.chat" :style="ui.cssVars">
    <header>
      <strong>{{ titleText }}</strong>
      <!-- 给外壳（如 <AgentDock>）放自己的控件：模型徽标、清空、收起… -->
      <slot name="actions" />
      <span v-if="running" class="running">{{ t("chat.running") }}</span>
      <button v-if="running" type="button" class="stop" @click="emit('stop')">{{ t("chat.stop") }}</button>
    </header>

    <div class="transcript">
      <div v-if="resume" class="resume">
        <strong>{{ resume.goal ? t("chat.resume.goal", { goal: shown(resume.goal) }) : t("chat.resume.pending") }}</strong>
        <p v-if="resume.interrupted" class="resume__hint">
          {{ t("chat.resume.interrupted") }}
        </p>
        <p class="resume__hint">{{ t("chat.resume.record") }}</p>
        <div class="answers">
          <button type="button" @click="emit('resume')">{{ t("chat.resume.continue") }}</button>
          <button type="button" class="reject" @click="emit('dismissResume')">{{ t("chat.resume.dismiss") }}</button>
        </div>
      </div>
      <p v-if="!lines.length" class="empty">{{ emptyText }}</p>
      <template v-for="(line, index) in lines" :key="index">
        <p v-if="line.kind === 'user'" class="line user">{{ shown(line.text) }}</p>
        <div v-else-if="line.kind === 'final'" class="line final markdown" v-html="renderMarkdown(shown(line.text))" />
        <div v-else-if="line.kind === 'assistant'" class="line assistant markdown" v-html="renderMarkdown(shown(line.text))" />
        <p v-else-if="line.kind === 'notice'" class="line notice">{{ shown(line.text) }}</p>
        <p v-else-if="line.kind === 'cancelled'" class="line notice">{{ t("chat.cancelled") }}</p>
        <p v-else-if="line.kind === 'error'" class="line error">{{ shown(line.text) }}</p>
        <p v-else-if="line.kind === 'blocked'" class="line blocked">{{ shown(line.text) }}</p>
        <p v-else-if="line.kind === 'call'" class="line call">
          <code>{{ line.id }}</code>
          <span class="args">{{ shown(line.args) }}</span>
        </p>
        <p v-else class="line result" :class="{ ok: line.ok }">
          <code>{{ line.id }}</code>
          <span>{{ shown(line.detail) }}</span>
        </p>
      </template>
      <!-- 「正在执行」：动作流水不刷屏了，但「它在动」这件事要看得见。
           待确认时让位给下面的确认条（那本身就是一次交互，不是「在跑」）。 -->
      <p v-if="running && !pending && !pendingHandoff" class="line executing">
        <span class="executing__dot" aria-hidden="true" />
        {{ t("chat.executing") }}
      </p>
    </div>

    <div v-if="pendingHandoff" class="handoff">
      <div class="ask">
        <strong>{{ handoffSteps.length ? t("chat.handoff.step", { current: handoffStep + 1, total: handoffSteps.length }) : t("chat.handoff.takeover") }}</strong>
        <code>{{ pendingHandoff.request.id }}</code>
      </div>
      <p class="handoff__reason">{{ pendingHandoff.request.reason }}</p>
      <ol v-if="handoffSteps.length" class="handoff__steps">
        <li
          v-for="(step, index) in handoffSteps"
          :key="index"
          :class="{ 'is-current': index === handoffStep, 'is-done': index < handoffStep }"
        >
          <span class="handoff__num">{{ index + 1 }}</span>
          <span>{{ shown(step.text) }}</span>
        </li>
      </ol>
      <p class="handoff__hint">
        {{ handoffSteps.length ? t("chat.handoff.follow") : t("chat.handoff.completeHint") }}
      </p>
      <div class="answers">
        <button v-if="handoffStep > 0" type="button" @click="emit('handoffStep', -1)">{{ t("chat.handoff.previous") }}</button>
        <button v-if="handoffSteps.length && !handoffLast" type="button" @click="emit('handoffStep', 1)">{{ t("chat.handoff.next") }}</button>
        <button v-else type="button" @click="emit('handoff', true)">{{ t("chat.handoff.done") }}</button>
        <button type="button" class="reject" @click="emit('handoff', false)">{{ t("chat.handoff.cancel") }}</button>
      </div>
    </div>

    <div v-else-if="pending" class="confirm" :class="{ danger: pending.request.kind === 'danger' }">
      <div class="ask">
        <strong>{{ pending.request.kind === "danger" ? t("chat.confirm.danger") : t("chat.confirm.title") }}</strong>
        <code>{{ pending.request.id }}</code>
        <span class="desc">{{ pending.request.description }}</span>
      </div>
      <div class="answers">
        <button type="button" @click="emit('reply', true)">{{ t("chat.confirm.approve") }}</button>
        <button v-if="supportsAlwaysAllow(pending.request.approval)" type="button" @click="emit('reply', 'always')">
          {{ t("chat.confirm.always") }}
        </button>
        <button type="button" class="reject" @click="emit('reply', false)">{{ t("chat.confirm.reject") }}</button>
      </div>
    </div>

    <slot name="footer" />

    <form class="composer" @submit.prevent="submit">
      <input v-model="draft" :aria-label="t('chat.inputLabel')" :placeholder="placeholderText" :disabled="running" />
      <button type="submit" :disabled="running || !draft.trim()">{{ t("chat.send") }}</button>
    </form>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  border: 1px solid var(--pling-color-border, #ddd);
  border-radius: var(--pling-radius-md, 8px);
  padding: 12px;
  background: var(--pling-color-surface, #fff);
  color: var(--pling-color-text, #0f172a);
  font-family: var(--pling-font-family, system-ui, sans-serif);
  font-size: 13px;
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--pling-color-border-muted, #eee);
}
header .running {
  color: var(--pling-color-primary-strong, #1565c0);
  font-size: 12px;
}
header .stop {
  margin-left: auto;
}
.transcript {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.resume {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 10px;
  border: 1px solid var(--pling-color-primary, #7dd3fc);
  border-radius: 8px;
  background: var(--pling-color-primary-soft, #f0f9ff);
}
.resume strong {
  color: var(--pling-color-primary-strong, #075985);
  font-size: 12px;
}
.resume__hint {
  margin: 0;
  color: var(--pling-color-primary-strong, #0369a1);
  font-size: 12px;
  line-height: 1.45;
}
.line {
  margin: 0;
  padding: 6px 8px;
  border-radius: 6px;
  border-left: 3px solid var(--pling-color-border, #ddd);
  white-space: pre-wrap;
  word-break: break-word;
}
.line.user {
  border-color: var(--pling-color-primary, #90caf9);
  background: var(--pling-color-primary-soft, #f3f8ff);
}
.line.assistant {
  border-color: var(--pling-color-border, #c5cae9);
}
.line.final {
  border-color: var(--pling-color-success, #66bb6a);
  background: var(--pling-color-success-soft, #f1f8f2);
}
.line.markdown {
  white-space: normal;
}
.line.markdown :deep(p) {
  margin: 0 0 0.55em;
}
.line.markdown :deep(p:last-child) {
  margin-bottom: 0;
}
.line.markdown :deep(h1),
.line.markdown :deep(h2),
.line.markdown :deep(h3),
.line.markdown :deep(h4),
.line.markdown :deep(h5),
.line.markdown :deep(h6) {
  margin: 0.25em 0 0.5em;
  line-height: 1.35;
}
.line.markdown :deep(ul),
.line.markdown :deep(ol) {
  margin: 0.35em 0;
  padding-left: 1.5em;
}
.line.markdown :deep(blockquote) {
  margin: 0.5em 0;
  padding-left: 0.75em;
  border-left: 3px solid var(--pling-color-border, #cbd5e1);
  color: var(--pling-color-text-muted, #475569);
}
.line.markdown :deep(pre) {
  overflow-x: auto;
  margin: 0.5em 0;
  padding: 8px;
  border-radius: 5px;
  background: var(--pling-color-surface-muted, #f1f5f9);
}
.line.markdown :deep(code) {
  padding: 0.08em 0.28em;
  border-radius: 3px;
  background: var(--pling-color-surface-muted, #eef2f7);
  font-family: var(--pling-font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.94em;
}
.line.markdown :deep(pre code) {
  padding: 0;
  background: transparent;
  white-space: pre;
}
.line.markdown :deep(a) {
  color: var(--pling-color-primary, #2e9df7);
  text-decoration: underline;
}
.line.markdown :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}
.line.markdown :deep(th),
.line.markdown :deep(td) {
  padding: 3px 6px;
  border: 1px solid var(--pling-color-border, #dbe2ea);
  text-align: left;
}
.line.notice {
  border-color: var(--pling-color-warning, #ffe082);
  background: var(--pling-color-warning-soft, #fffdf3);
  color: var(--pling-color-warning, #795548);
  font-size: 12px;
}
.line.error {
  border-color: var(--pling-color-danger, #ef9a9a);
  background: var(--pling-color-danger-soft, #fff5f5);
  color: var(--pling-color-danger, #b71c1c);
}
.line.blocked {
  border-color: var(--pling-color-warning, #ffb74d);
  background: var(--pling-color-warning-soft, #fff8e1);
  color: var(--pling-color-warning, #8d5b00);
}
.line.executing {
  display: flex;
  align-items: center;
  gap: 6px;
  border-color: var(--pling-color-border, #cbd5e1);
  color: var(--pling-color-text-muted, #64748b);
  font-size: 12px;
}
.executing__dot {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--pling-color-primary, #2e9df7);
  animation: chat-pulse 1s ease-in-out infinite;
}
@keyframes chat-pulse {
  50% {
    opacity: 0.25;
  }
}
@media (prefers-reduced-motion: reduce) {
  .executing__dot {
    animation: none;
  }
}
.line.call {
  border-color: var(--pling-color-border, #b0bec5);
  font-family: var(--pling-font-family-mono, ui-monospace, monospace);
}
.line.result {
  border-color: var(--pling-color-danger, #ef9a9a);
  font-family: var(--pling-font-family-mono, ui-monospace, monospace);
  color: var(--pling-color-danger, #b71c1c);
}
.line.result.ok {
  border-color: var(--pling-color-success, #a5d6a7);
  color: var(--pling-color-success, #2e7d32);
}
.args {
  color: var(--pling-color-text-subtle, #888);
  margin-left: 6px;
}
.empty {
  color: var(--pling-color-text-subtle, #888);
}
.confirm {
  border: 1px solid var(--pling-color-warning, #ffe082);
  background: var(--pling-color-warning-soft, #fffdf3);
  border-radius: var(--pling-radius-sm, 6px);
  padding: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.confirm.danger {
  border-color: var(--pling-color-danger, #ef9a9a);
  background: var(--pling-color-danger-soft, #fff5f5);
}
.handoff {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--pling-color-primary, #93c5fd);
  border-radius: var(--pling-radius-sm, 6px);
  background: var(--pling-color-primary-soft, #eff6ff);
}
.handoff .ask {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.handoff__reason {
  margin: 0;
  color: var(--pling-color-primary-strong, #1e3a8a);
}
.handoff__steps {
  margin: 2px 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 3px;
}
.handoff__steps li {
  display: flex;
  gap: 6px;
  align-items: baseline;
  color: var(--pling-color-text-muted, #64748b);
  font-size: 12px;
}
.handoff__steps li.is-current {
  color: var(--pling-color-text, #0f172a);
  font-weight: 600;
}
.handoff__steps li.is-done {
  color: var(--pling-color-success, #15803d);
  text-decoration: line-through;
}
.handoff__num {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--pling-color-primary-soft, #dbeafe);
  color: var(--pling-color-primary-strong, #1d4ed8);
  font-size: 10px;
  flex: none;
}
.handoff__steps li.is-current .handoff__num {
  background: var(--pling-color-primary, #2e9df7);
  color: var(--pling-color-on-primary, #fff);
}
.handoff__hint {
  margin: 0;
  color: var(--pling-color-text-muted, #64748b);
  font-size: 12px;
}
.confirm .ask {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.confirm .desc {
  color: var(--pling-color-text-muted, #666);
}
.answers {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
.answers .reject {
  color: var(--pling-color-danger, #b71c1c);
}
.composer {
  display: flex;
  gap: 6px;
}
.composer input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--pling-color-border, #ddd);
  border-radius: var(--pling-radius-sm, 6px);
  background: var(--pling-color-surface, #fff);
  color: var(--pling-color-text, #0f172a);
}
</style>
