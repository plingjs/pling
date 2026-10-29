<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, useAgentTool, type ToolOptions } from "@plingjs/vue";
import { copyFor, type DemoLocale } from "./copy";
import { evaluateRelease, previewConfig, type ReleaseConfig } from "./release";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const props = defineProps<{ locale?: DemoLocale }>();
const locale = computed<DemoLocale>(() => props.locale ?? "en");
const copy = computed(() => copyFor(locale.value));
const tasks = ref<Task[]>(copy.value.taskTexts.map((text, index) => ({
  id: `t${index + 1}`,
  text,
  done: index === 1,
})));
const draft = ref("");
const config = ref<ReleaseConfig>(previewConfig);
const review = computed(() => evaluateRelease(config.value, locale.value));
const openCount = computed(() => tasks.value.filter((task) => !task.done).length);
let sequence = 3;

function addTask(text: string): void {
  const value = text.trim();
  if (!value) return;
  tasks.value.unshift({ id: `t${++sequence}`, text: value, done: false });
}

function submitDraft(): void {
  if (!draft.value.trim()) return;
  addTask(draft.value);
  draft.value = "";
}

function toggleTask(task: Task): void {
  task.done = !task.done;
}

const addTaskAction = computed<ToolOptions>(() => ({
  id: "add_task",
  desc: copy.value.addDescription,
  kind: "write",
  params: [{ name: "text", label: copy.value.addParam, minLength: 1, maxLength: 80 }],
  run: ({ text }: Record<string, unknown>) => addTask(String(text)),
}));

useAgentTool({
  id: "release_status",
  desc: copy.value.statusDescription,
  kind: "read",
  run: () => ({ ready: review.value.ready, failing: review.value.checks.filter((check) => check.status === "fail").map((check) => check.id) }),
});
</script>

<template>
  <main class="page">
    <section class="todo" v-scope="{ id: 'todo', label: copy.region, role: 'main' }">
      <header class="head">
        <div>
          <p class="eyebrow">{{ copy.eyebrow }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="lead">{{ copy.lead }}</p>
        </div>
        <span class="counter">{{ copy.open(openCount) }}</span>
      </header>

      <form class="composer" @submit.prevent="submitDraft">
        <input
          v-model="draft"
          v-tool="{ id: 'draft_input', action: 'fill', desc: copy.inputDescription }"
          :placeholder="copy.newTask"
          :aria-label="copy.newTask"
        />
        <button type="submit" v-tool="addTaskAction">{{ copy.add }}</button>
      </form>

      <ul class="tasks">
        <li
          v-for="task in tasks"
          :key="task.id"
          :class="{ done: task.done }"
          v-record="{ data: task, fields: { text: task.text, status: task.done ? 'done' : 'open' } }"
        >
          <label>
            <input
              type="checkbox"
              :checked="task.done"
              v-tool="{ id: `toggle@${task.id}`, desc: copy.toggle(task.text, task.done), kind: 'write' }"
              @change="toggleTask(task)"
            />
            <span>{{ task.text }}</span>
          </label>
        </li>
      </ul>
    </section>

    <section class="release" aria-labelledby="release-title" data-pling-ignore>
      <div class="release__head">
        <div>
          <p class="eyebrow">{{ copy.releaseEyebrow }}</p>
          <h2 id="release-title">{{ review.ready ? copy.ready : copy.blocked }}</h2>
        </div>
        <span :class="['badge', review.ready ? 'badge--ok' : 'badge--bad']">
          {{ copy.failed(review.checks.filter((check) => check.status === "fail").length) }}
        </span>
      </div>
      <ul class="checks">
        <li v-for="check in review.checks" :key="check.id" :class="`check--${check.status}`">
          <span class="dot" aria-hidden="true"></span>
          <div><strong>{{ check.label }}</strong><p>{{ check.detail }}</p></div>
        </li>
      </ul>
      <p class="release__note">{{ copy.note }}</p>
    </section>

    <AgentDock
      :title="copy.dockTitle"
      :quick="[...copy.quick]"
      :debug="{ maxCalls: 8 }"
    />
  </main>
</template>
