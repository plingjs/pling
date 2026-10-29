<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, useAgentState, type ToolOptions } from "@plingjs/vue";
import { copyFor, type DemoLocale } from "./copy";
import { addTask, countTasks, createSeedTasks, MAX_TASKS, toggleTask, type Task } from "./todo";

const props = defineProps<{ locale?: DemoLocale }>();
const locale = computed<DemoLocale>(() => {
  if (props.locale) return props.locale;
  return new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en";
});
const copy = computed(() => copyFor(locale.value));

const tasks = ref<Task[]>(createSeedTasks(locale.value));
const draft = ref("");
let sequence = 3;
let lastAddedId: string | null = null;

const counts = computed(() => countTasks(tasks.value));

useAgentState(
  "todo_migration",
  () => ({ ...counts.value, visibleIds: tasks.value.map((task) => task.id) }),
  { description: copy.value.stateDescription },
);

function submitDraft(): string | null {
  const next = addTask(tasks.value, draft.value, `t${++sequence}`);
  if (!next) return null;
  tasks.value = next;
  draft.value = "";
  return next[0]?.id ?? null;
}

const submitTaskAction = computed<ToolOptions>(() => ({
  id: "submit_task",
  desc: copy.value.submitDescription,
  kind: "write",
  available: () =>
    tasks.value.length < MAX_TASKS ? true : copy.value.listFull(MAX_TASKS),
  run: () => { lastAddedId = submitDraft(); },
  expect: {
    desc: copy.value.addExpect,
    check: () =>
      lastAddedId !== null && tasks.value.some((task) => task.id === lastAddedId),
  },
}));

function toggle(id: string): void {
  tasks.value = toggleTask(tasks.value, id);
}

function exportCsv(): void {
  const csv = tasks.value.map((task) => `${task.id},${task.text},${task.done}`).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "todos.csv";
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <main class="page">
    <section class="workspace" v-scope="{ id: 'todo', label: copy.region, description: copy.regionDescription, role: 'main' }">
      <header class="head">
        <div>
          <p class="eyebrow">{{ copy.eyebrow }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="lead">{{ copy.lead }}</p>
        </div>
        <span class="counter">{{ copy.counter(counts.open) }}</span>
      </header>

      <form class="composer" @submit.prevent="submitDraft">
        <input
          v-model="draft"
          v-tool="{ id: 'draft_text', desc: copy.draftDescription, kind: 'write' }"
          :placeholder="copy.newTask"
          :aria-label="copy.newTask"
          maxlength="80"
        />
        <button type="submit" v-tool="submitTaskAction">
          {{ copy.add }}
        </button>
      </form>

      <ul class="tasks">
        <li
          v-for="task in tasks"
          :key="task.id"
          :class="{ done: task.done }"
          v-record="{ data: task, fields: { text: task.text, status: task.done ? 'completed' : 'open' } }"
        >
          <label>
            <input
              type="checkbox"
              :checked="task.done"
              v-tool="{ id: `toggle@${task.id}`, desc: copy.toggle(task.text, task.done), kind: 'write' }"
              @change="toggle(task.id)"
            />
            <span>{{ task.text }}</span>
          </label>
        </li>
      </ul>

      <footer class="manual">
        <button type="button" data-pling-ignore @click="exportCsv">{{ copy.export }}</button>
        <p>{{ copy.exportNote }}</p>
      </footer>
    </section>

    <aside class="ledger" aria-labelledby="ledger-title">
      <p class="eyebrow">{{ copy.migration }}</p>
      <h2 id="ledger-title">{{ copy.migrationTitle }}</h2>
      <p>{{ copy.migrationLead }}</p>
      <ol>
        <li v-for="([title, detail], index) in copy.steps" :key="title">
          <span>{{ String(index + 1).padStart(2, "0") }}</span>
          <div><strong>{{ title }}</strong><p>{{ detail }}</p></div>
        </li>
      </ol>
    </aside>

    <AgentDock :title="copy.dockTitle" :quick="[...copy.quick]" :debug="{ maxCalls: 8 }" />
  </main>
</template>
