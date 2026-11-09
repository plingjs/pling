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
import { computed, inject, nextTick, onMounted, onUnmounted, ref, useSlots, watch } from "vue";
import MarkdownIt from "markdown-it";
import { supportsAlwaysAllow } from "@plingjs/core";
import { toTranscriptLines, type PendingApproval, type PendingHandoff, type SessionEvent } from "@plingjs/agent";
import { ensurePlingStyles } from "@plingjs/dom";
import { quickTaskOf, type QuickTaskItem } from "@plingjs/ui";
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
    /** Opt-in two-line composer for workspace layouts. */
    multiline?: boolean;
    /**
     * Keep task content above the scrolling transcript instead of appending it
     * to the message flow. `none` lets a host own all guidance without the
     * built-in task card reserving space.
     */
    taskPlacement?: "inline" | "pinned" | "none";
    /** Whether the task slot currently has content. Keeps an empty pinned area from occupying space. */
    hasTask?: boolean;
    /**
     * Where slotted guidance belongs. `end` renders it as the newest message in
     * the transcript (use this for a live next-step prompt); `top` keeps the
     * legacy positioned block for pinned layouts.
     */
    guidePlacement?: "top" | "end";
    /** Render a speaker header (name + time) above each chat message. */
    speakers?: boolean;
    /** Page-level suggestions shown only while the conversation is empty. */
    quick?: readonly QuickTaskItem[];
    /** Keep the standalone title/running header. Workspace panels usually hide it. */
    showHeader?: boolean;
  }>(),
  {
    events: () => [],
    running: false,
    pending: null,
    tools: false,
    multiline: true,
    taskPlacement: "pinned",
    hasTask: true,
    guidePlacement: "top",
    speakers: true,
    quick: () => [],
    showHeader: true,
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
  quick: [text: string];
}>();

const draft = ref("");
const transcriptEl = ref<HTMLElement | null>(null);
const composerEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
const SCROLL_FOLLOW_THRESHOLD = 64;
const followLatest = ref(true);
const pi = inject(PLING_KEY, null);
const slots = useSlots();
const ui = pi?.ui ?? STANDALONE_UI;
ensurePlingStyles();
const t = ui.t;
const titleText = computed(() => props.title ?? t("chat.title"));
const placeholderText = computed(() => props.placeholder ?? t("chat.placeholder"));
const emptyText = computed(() => props.emptyHint ?? t("chat.empty"));
const lines = computed(() =>
  toTranscriptLines(props.events, { tools: props.tools, locale: ui.locale, translate: t }),
);
const lineTimes = ref<string[]>([]);
const timeFormatter = computed(
  () => new Intl.DateTimeFormat(ui.locale ?? "zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }),
);
function stampLines(count: number): void {
  const next = lineTimes.value.slice(0, Math.max(0, count));
  while (next.length < count) next.push(timeFormatter.value.format(new Date()));
  if (next.length !== lineTimes.value.length) lineTimes.value = next;
}
watch(
  () => lines.value.length,
  (count) => stampLines(count),
  { immediate: true },
);
const shown = (text: string): string => (props.reveal ? props.reveal(text) : text);
const quickItems = computed(() => props.quick.map(quickTaskOf));
const handoffSteps = computed(() => props.pendingHandoff?.request.steps ?? []);
const handoffStep = computed(() => props.pendingHandoff?.step ?? 0);
const handoffLast = computed(() => handoffStep.value >= handoffSteps.value.length - 1);
const transcriptEmpty = computed(
  () =>
    !lines.value.length &&
    !props.resume &&
    !slots.guide &&
    !(props.taskPlacement === "inline" && props.hasTask && slots.task),
);

function submit(): void {
  const text = draft.value.trim();
  if (!text || props.running) return;
  draft.value = "";
  followLatest.value = true;
  emit("send", text);
}

function resizeComposer(): void {
  const element = composerEl.value;
  if (!element || element.tagName !== "TEXTAREA") return;
  element.style.height = "auto";
  const height = Math.min(150, Math.max(44, element.scrollHeight));
  element.style.height = `${height}px`;
  element.style.overflowY = element.scrollHeight > 150 ? "auto" : "hidden";
}

function onComposerKeydown(event: KeyboardEvent): void {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  submit();
}

watch(draft, () => void nextTick(resizeComposer));

// Task cards and other slotted content grow independently of the event list.
// Follow new output only while the reader is already near the bottom; scrolling
// up must remain stable while an answer is still streaming.
let transcriptObserver: MutationObserver | null = null;

function syncScrollIntent(): void {
  const box = transcriptEl.value;
  if (!box) return;
  followLatest.value = box.scrollHeight - box.scrollTop - box.clientHeight <= SCROLL_FOLLOW_THRESHOLD;
}

onMounted(() => {
  if (!transcriptEl.value || typeof MutationObserver === "undefined") return;
  transcriptEl.value.addEventListener("scroll", syncScrollIntent, { passive: true });
  if (followLatest.value) transcriptEl.value.scrollTop = transcriptEl.value.scrollHeight;
  transcriptObserver = new MutationObserver(() => {
    const box = transcriptEl.value;
    if (box && followLatest.value) box.scrollTop = box.scrollHeight;
  });
  transcriptObserver.observe(transcriptEl.value, {
    childList: true,
    subtree: true,
    characterData: true,
  });
});
onUnmounted(() => {
  transcriptEl.value?.removeEventListener("scroll", syncScrollIntent);
  transcriptObserver?.disconnect();
});
</script>

<template>
  <section class="chat pling-chat" :class="ui.classNames.chat" :style="ui.cssVars">
    <header v-if="showHeader" class="pling-chat__head">
      <strong>{{ titleText }}</strong>
      <!-- 给外壳（如 <AgentDock>）放自己的控件：模型徽标、清空、收起… -->
      <slot name="actions" />
      <span v-if="running" class="running pling-chat__running">{{ t("chat.running") }}</span>
      <button v-if="running" type="button" class="stop pling-chat__stop" @click="emit('stop')">{{ t("chat.stop") }}</button>
    </header>

    <div v-if="taskPlacement === 'pinned' && hasTask && $slots.task" class="task-pinned pling-chat__task-pinned">
      <slot name="task" />
    </div>

    <div ref="transcriptEl" class="transcript pling-chat__transcript" :class="{ 'is-empty': transcriptEmpty }">
      <div v-if="guidePlacement === 'top' && $slots.guide" class="chat-guide">
        <slot name="guide" />
      </div>
      <div v-if="resume" class="resume pling-chat__resume">
        <strong>{{ resume.goal ? t("chat.resume.goal", { goal: shown(resume.goal) }) : t("chat.resume.pending") }}</strong>
        <p v-if="resume.interrupted" class="resume__hint pling-chat__resume-hint">
          {{ t("chat.resume.interrupted") }}
        </p>
        <p class="resume__hint pling-chat__resume-hint">{{ t("chat.resume.record") }}</p>
        <div class="answers pling-chat__answers">
          <button type="button" @click="emit('resume')">{{ t("chat.resume.continue") }}</button>
          <button type="button" class="reject" @click="emit('dismissResume')">{{ t("chat.resume.dismiss") }}</button>
        </div>
      </div>
      <template v-if="!lines.length && !$slots.guide && !(taskPlacement === 'inline' && hasTask && $slots.task)">
        <p class="empty pling-chat__empty">{{ emptyText }}</p>
        <div v-if="quickItems.length" class="pling-chat__quick dock__quick">
          <button
            v-for="(task, index) in quickItems"
            :key="`${task.prompt}:${index}`"
            type="button"
            :disabled="running || task.disabled"
            :title="task.description"
            @click="emit('quick', task.prompt)"
          >
            {{ task.label }}
          </button>
        </div>
      </template>
      <template v-for="(line, index) in lines" :key="index">
        <div v-if="line.kind === 'user'" class="line user pling-chat__line is-user">
          <header v-if="speakers" class="line-head pling-chat__line-head">
            <span>{{ t("chat.me") }}</span>
            <time>{{ lineTimes[index] }}</time>
          </header>
          <p class="line-body pling-chat__line-body">{{ shown(line.text) }}</p>
        </div>
        <div v-else-if="line.kind === 'final'" class="line final pling-chat__line is-final">
          <header v-if="speakers" class="line-head pling-chat__line-head">
            <strong>{{ t("chat.assistantName") }}</strong>
            <time>{{ lineTimes[index] }}</time>
          </header>
          <div class="markdown" v-html="renderMarkdown(shown(line.text))" />
        </div>
        <div v-else-if="line.kind === 'assistant'" class="line assistant pling-chat__line is-assistant">
          <header v-if="speakers" class="line-head pling-chat__line-head">
            <strong>{{ t("chat.assistantName") }}</strong>
            <time>{{ lineTimes[index] }}</time>
          </header>
          <div class="markdown" v-html="renderMarkdown(shown(line.text))" />
        </div>
        <p v-else-if="line.kind === 'notice'" class="line notice pling-chat__line is-notice">{{ shown(line.text) }}</p>
        <p v-else-if="line.kind === 'cancelled'" class="line notice pling-chat__line is-notice">{{ t("chat.cancelled") }}</p>
        <p v-else-if="line.kind === 'error'" class="line error pling-chat__line is-error">{{ shown(line.text) }}</p>
        <p v-else-if="line.kind === 'blocked'" class="line blocked pling-chat__line is-blocked">{{ shown(line.text) }}</p>
        <p v-else-if="line.kind === 'call'" class="line call pling-chat__line is-call">
          <code>{{ line.id }}</code>
          <span class="args pling-chat__args">{{ shown(line.args) }}</span>
        </p>
        <p v-else class="line result pling-chat__line is-result" :class="{ ok: line.ok, 'is-ok': line.ok }">
          <code>{{ line.id }}</code>
          <span>{{ shown(line.detail) }}</span>
        </p>
      </template>
      <slot v-if="taskPlacement === 'inline' && hasTask" name="task" />
      <div v-if="guidePlacement === 'end' && $slots.guide" class="chat-guide chat-guide--end">
        <slot name="guide" />
      </div>
      <!-- 「正在执行」：动作流水不刷屏了，但「它在动」这件事要看得见。
           待确认时让位给下面的确认条（那本身就是一次交互，不是「在跑」）。 -->
      <p v-if="running && !pending && !pendingHandoff" class="line executing pling-chat__line is-executing">
        <span class="executing__dot pling-chat__executing-dot" aria-hidden="true" />
        {{ t("chat.executing") }}
      </p>
    </div>

    <div v-if="pendingHandoff" class="handoff pling-chat__handoff">
      <div class="ask pling-chat__ask">
        <strong>{{ handoffSteps.length ? t("chat.handoff.step", { current: handoffStep + 1, total: handoffSteps.length }) : t("chat.handoff.takeover") }}</strong>
        <code>{{ pendingHandoff.request.id }}</code>
      </div>
      <p class="handoff__reason pling-chat__handoff-reason">{{ pendingHandoff.request.reason }}</p>
      <ol v-if="handoffSteps.length" class="handoff__steps pling-chat__handoff-steps">
        <li
          v-for="(step, index) in handoffSteps"
          :key="index"
          :class="{ 'is-current': index === handoffStep, 'is-done': index < handoffStep }"
        >
          <span class="handoff__num pling-chat__handoff-num">{{ index + 1 }}</span>
          <span>{{ shown(step.text) }}</span>
        </li>
      </ol>
      <p class="handoff__hint pling-chat__handoff-hint">
        {{ handoffSteps.length ? t("chat.handoff.follow") : t("chat.handoff.completeHint") }}
      </p>
      <div class="answers pling-chat__answers">
        <button v-if="handoffStep > 0" type="button" @click="emit('handoffStep', -1)">{{ t("chat.handoff.previous") }}</button>
        <button v-if="handoffSteps.length && !handoffLast" type="button" @click="emit('handoffStep', 1)">{{ t("chat.handoff.next") }}</button>
        <button v-else type="button" @click="emit('handoff', true)">{{ t("chat.handoff.done") }}</button>
        <button type="button" class="reject" @click="emit('handoff', false)">{{ t("chat.handoff.cancel") }}</button>
      </div>
    </div>

    <div v-else-if="pending" class="confirm pling-chat__confirm" :class="{ danger: pending.request.kind === 'danger', 'is-danger': pending.request.kind === 'danger' }">
      <div class="ask pling-chat__ask">
        <strong>{{ pending.request.kind === "danger" ? t("chat.confirm.danger") : t("chat.confirm.title") }}</strong>
        <code>{{ pending.request.id }}</code>
        <span class="desc pling-chat__confirm-desc">{{ pending.request.description }}</span>
      </div>
      <div class="answers pling-chat__answers">
        <button type="button" @click="emit('reply', true)">{{ t("chat.confirm.approve") }}</button>
        <button v-if="supportsAlwaysAllow(pending.request.approval)" type="button" @click="emit('reply', 'always')">
          {{ t("chat.confirm.always") }}
        </button>
        <button type="button" class="reject" @click="emit('reply', false)">{{ t("chat.confirm.reject") }}</button>
      </div>
    </div>

    <slot name="footer" />

    <form class="composer pling-chat__composer" @submit.prevent="submit">
      <div class="pling-chat__composer-box">
        <textarea
          v-if="multiline"
          ref="composerEl"
          v-model="draft"
          rows="2"
          :aria-label="t('chat.inputLabel')"
          :placeholder="placeholderText"
          :disabled="running"
          @keydown="onComposerKeydown"
        />
        <input v-else ref="composerEl" v-model="draft" :aria-label="t('chat.inputLabel')" :placeholder="placeholderText" :disabled="running" />
        <button class="pling-chat__send" type="submit" :aria-label="t('chat.send')" :title="t('chat.send')" :disabled="running || !draft.trim()">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10h10M11 6.5l3.5 3.5-3.5 3.5" /></svg>
        </button>
      </div>
    </form>
  </section>
</template>

