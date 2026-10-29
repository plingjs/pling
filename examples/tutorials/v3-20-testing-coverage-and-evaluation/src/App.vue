<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, useAgentTool, type ToolOptions } from "@plingjs/vue";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const seed = (): Task[] => [
  { id: "t1", text: "Review the launch checklist", done: false },
  { id: "t2", text: "Send the customer follow-up", done: true },
  { id: "t3", text: "Book the design review", done: false },
];

const tasks = ref<Task[]>(seed());
const draft = ref("");
let sequence = 3;

const openCount = computed(() => tasks.value.filter((task) => !task.done).length);

function reset(): void {
  tasks.value = seed();
  draft.value = "";
  sequence = 3;
}

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

function exportCsv(): void {
  const csv = tasks.value.map((task) => `${task.id},${task.text}`).join("\n");
  console.info(csv);
}

const addTaskAction: ToolOptions = {
  id: "add_task",
  desc: "Add a task to the list.",
  kind: "write",
  params: [{ name: "text", label: "Task text", minLength: 1, maxLength: 80 }],
  run: ({ text }: Record<string, unknown>) => addTask(String(text)),
};

useAgentTool({
  id: "task_overview",
  desc: "Read the number of open tasks.",
  kind: "read",
  run: () => ({ open: openCount.value, total: tasks.value.length }),
});

defineExpose({ reset, tasks });
</script>

<template>
  <main class="page">
    <section class="todo" v-scope="{ id: 'todo', label: 'Todo list', role: 'main' }">
      <header class="todo__head">
        <div>
          <p class="eyebrow">Testing and evaluation</p>
          <h1>A small page with explicit test seams</h1>
          <p class="lead">Every control the agent can use is declared. One control is deliberately left out to make a coverage gap visible.</p>
        </div>
        <span class="counter">{{ openCount }} open</span>
      </header>

      <form class="composer" @submit.prevent="submitDraft">
        <input
          v-model="draft"
          v-tool="{ id: 'draft_input', action: 'fill', desc: 'Enter the text of a new task.' }"
          placeholder="New task"
          aria-label="New task"
        />
        <button type="submit" v-tool="addTaskAction">Add</button>
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
              v-tool="{
                id: `toggle@${task.id}`,
                desc: `Mark “${task.text}” as ${task.done ? 'open' : 'done'}.`,
                kind: 'write',
              }"
              @change="toggleTask(task)"
            />
            <span>{{ task.text }}</span>
          </label>
        </li>
      </ul>

      <footer class="footer">
        <p>This button is intentionally not declared. It appears in the coverage report, not in the agent's actions.</p>
        <button id="export_csv" type="button" @click="exportCsv">Export CSV</button>
      </footer>
    </section>

    <AgentDock
      title="Todo assistant · testing"
      :quick="['Add a task to prepare the demo', 'What is still open?']"
      :debug="{ maxCalls: 8 }"
    />
  </main>
</template>
