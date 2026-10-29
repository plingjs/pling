<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, useAgentTool, usePling } from "@plingjs/vue";
import { createApproval } from "./approval";
import { copyFor, type DemoLocale } from "./copy";
import ExternalConsole from "./ExternalConsole.vue";
import { createTodoSurface } from "./surface";
import { addTask, countTasks, createSeedTasks, removeTask, toggleTask, type Task } from "./todo";

const props = defineProps<{ locale?: DemoLocale }>();
const locale = computed<DemoLocale>(() => {
  if (props.locale) return props.locale;
  return new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en";
});
const copy = computed(() => copyFor(locale.value));
const pling = usePling();
const approval = createApproval();
const { surface } = createTodoSurface(pling.registry, approval.confirm);

const tasks = ref<Task[]>(createSeedTasks(locale.value));
const draft = ref("");
let sequence = 3;

const counts = computed(() => countTasks(tasks.value));

useAgentTool({
  id: "todo.overview",
  desc: copy.value.overview,
  kind: "read",
  run: () => ({ ...counts.value, records: tasks.value.map((task) => ({ id: task.id, text: task.text, done: task.done })) }),
});

useAgentTool({
  id: "todo.add",
  desc: copy.value.addDescription,
  kind: "write",
  params: [{ name: "text", label: copy.value.taskLabel, minLength: 1, maxLength: 80 }],
  run: ({ text }: Record<string, unknown>) => add(String(text)),
});

function add(text: string): void {
  const next = addTask(tasks.value, text, `t${++sequence}`);
  if (!next) return;
  tasks.value = next;
}

function submitDraft(): void {
  if (!draft.value.trim()) return;
  add(draft.value);
  draft.value = "";
}

function toggle(id: string): void {
  tasks.value = toggleTask(tasks.value, id);
}

function remove(id: string): void {
  tasks.value = removeTask(tasks.value, id);
}

function clearCompleted(): void {
  tasks.value = tasks.value.filter((task) => !task.done);
}

function decide(approved: boolean): void {
  approval.decide(approved);
}

defineExpose({ surface });
</script>

<template>
  <main class="page">
    <section class="weekly" v-scope="{ id: 'todo', label: copy.region, description: copy.regionDescription, role: 'main' }">
      <header class="head">
        <div>
          <p class="eyebrow">{{ copy.eyebrow }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="lead">{{ copy.lead }}</p>
        </div>
        <span class="counter">{{ copy.counter(counts.open) }}</span>
      </header>

      <form class="composer" @submit.prevent="submitDraft">
        <input v-model="draft" :placeholder="copy.newTask" :aria-label="copy.newTask" maxlength="80" />
        <button type="submit">{{ copy.add }}</button>
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
              v-tool="{ id: `todo.toggle@task:${task.id}`, desc: copy.toggle(task.text, task.done), kind: 'write' }"
              @change="toggle(task.id)"
            />
            <span>{{ task.text }}</span>
          </label>
          <button
            type="button"
            class="remove"
            v-tool="{ id: `todo.remove@task:${task.id}`, desc: copy.remove(task.text), kind: 'danger', confirm: 'always' }"
            @click="remove(task.id)"
          >
            ×
          </button>
        </li>
      </ul>

      <div class="footer">
        <button
          type="button"
          v-tool="{ id: 'todo.clear_completed', desc: copy.clearDescription, kind: 'danger', confirm: 'always' }"
          @click="clearCompleted"
        >
          {{ copy.clear }}
        </button>
        <span>{{ copy.completed(counts.completed) }}</span>
      </div>
    </section>

    <ExternalConsole :surface="surface" :copy="copy" />

    <aside v-if="approval.current.value" class="approval" role="alertdialog" aria-modal="true" data-testid="approval">
      <p class="eyebrow">{{ copy.approvalEyebrow }}</p>
      <h3>{{ approval.current.value.description }}</h3>
      <code>{{ approval.current.value.id }}</code>
      <p>{{ copy.approvalHint }}</p>
      <div class="approval__actions">
        <button type="button" data-testid="approval-deny" @click="decide(false)">{{ copy.deny }}</button>
        <button type="button" class="primary" data-testid="approval-allow" @click="decide(true)">{{ copy.allow }}</button>
      </div>
    </aside>

    <AgentDock :title="copy.dockTitle" :quick="[...copy.quick]" :debug="{ maxCalls: 8 }" />
  </main>
</template>
