<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { AgentDock, useAgentState, useAgentTool, usePling } from "@plingjs/vue";
import { createApproval } from "./approval";
import {
  copyFor,
  priorityLabel,
  type DemoLocale,
  type Priority,
  type TodoFilter,
} from "./copy";
import ExternalConsole from "./ExternalConsole.vue";
import McpGuide from "./McpGuide.vue";
import { installMcpBridge, type BridgeConnectionState } from "./mcp-bridge";
import { createTodoSurface } from "./surface";
import {
  addTask,
  countTasks,
  createSeedTasks,
  MAX_TASKS,
  removeTask,
  toggleTask,
  updateTask,
  type Task,
} from "./todo";

const props = defineProps<{ locale: DemoLocale }>();
const copy = computed(() => copyFor(props.locale));
const pling = usePling();
const approval = createApproval();
const { surface } = createTodoSurface(pling.registry, approval.confirm);
const bridge = new URLSearchParams(location.search).has("mcp")
  ? installMcpBridge({ surface, approval, app: "example-todo-surface" })
  : null;
const bridgeState = computed<BridgeConnectionState | "disabled">(() => bridge?.state.value ?? "disabled");

const tasks = ref<Task[]>(createSeedTasks(props.locale));
const draft = ref("");
const priority = ref<Priority>("today");
const filter = ref<TodoFilter>("all");
const search = ref("");
const editingId = ref<string | null>(null);
const editDraft = ref("");
const toast = ref("");
let sequence = 100;

const counts = computed(() => countTasks(tasks.value));
const visible = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase();
  return tasks.value.filter((task) => {
    const matchesFilter =
      filter.value === "all" || (filter.value === "open" && !task.done) || (filter.value === "completed" && task.done);
    return matchesFilter && (!needle || task.text.toLocaleLowerCase().includes(needle));
  });
});

const taskOptions = () => tasks.value.map((task) => ({ value: task.id, label: task.text }));

useAgentState(
  "todo_view",
  () => ({
    filter: filter.value,
    search: search.value,
    matched: visible.value.length,
    total: counts.value.total,
    open: counts.value.open,
    completed: counts.value.completed,
  }),
  { description: copy.value.stateDescription },
);

useAgentTool({
  id: "todo.overview",
  desc: copy.value.overview,
  kind: "read",
  run: () => ({ ...counts.value, tasks: tasks.value.map((task) => ({ ...task, priority: priorityLabel(props.locale, task.priority) })) }),
});

useAgentTool({
  id: "todo.add",
  desc: copy.value.addDesc,
  kind: "write",
  available: () => (tasks.value.length < MAX_TASKS ? true : copy.value.empty),
  params: [
    { name: "text", label: copy.value.textParam, minLength: 1, maxLength: 80 },
    { name: "priority", label: copy.value.priorityParam, values: ["today", "soon", "later"], optional: true },
  ],
  run: ({ text, priority: value }) => {
    const next = addTask(tasks.value, String(text), (value ? String(value) : "today") as Priority, `t${++sequence}`);
    if (!next) return { changed: false };
    tasks.value = next;
    toast.value = copy.value.toastAdded;
    return { changed: true, taskId: tasks.value[0]?.id };
  },
});

useAgentTool({
  id: "todo.update",
  desc: copy.value.updateDesc,
  kind: "write",
  available: () => (tasks.value.length > 0 ? true : copy.value.empty),
  params: [
    { name: "taskId", label: copy.value.taskParam, options: taskOptions },
    { name: "text", label: copy.value.textParam, minLength: 1, maxLength: 80 },
  ],
  run: ({ taskId, text }) => {
    tasks.value = updateTask(tasks.value, String(taskId), String(text));
    toast.value = copy.value.toastUpdated;
    return { changed: true, taskId };
  },
});

useAgentTool({
  id: "todo.toggle",
  desc: copy.value.toggleDesc,
  kind: "write",
  available: () => (tasks.value.length > 0 ? true : copy.value.empty),
  params: [{ name: "taskId", label: copy.value.taskParam, options: taskOptions }],
  run: ({ taskId }) => {
    tasks.value = toggleTask(tasks.value, String(taskId));
    toast.value = copy.value.toastToggled;
    return { changed: true, taskId };
  },
});

useAgentTool({
  id: "todo.delete",
  desc: copy.value.deleteDesc,
  kind: "danger",
  confirm: "always",
  available: () => (tasks.value.length > 0 ? true : copy.value.empty),
  params: [{ name: "taskId", label: copy.value.taskParam, options: taskOptions }],
  run: ({ taskId }) => {
    tasks.value = removeTask(tasks.value, String(taskId));
    toast.value = copy.value.toastDeleted;
    return { changed: true, taskId };
  },
});

useAgentTool({
  id: "todo.clear_completed",
  desc: copy.value.clearDesc,
  kind: "danger",
  confirm: "always",
  available: () => (counts.value.completed > 0 ? true : copy.value.empty),
  run: () => {
    tasks.value = tasks.value.filter((task) => !task.done);
    toast.value = copy.value.toastCleared;
    return { changed: true };
  },
});

useAgentTool({
  id: "todo.set_view",
  desc: copy.value.setViewDesc,
  kind: "read",
  params: [
    { name: "filter", label: copy.value.filterParam, values: ["all", "open", "completed"], optional: true },
    { name: "search", label: copy.value.searchParam, optional: true, maxLength: 80 },
  ],
  run: ({ filter: value, search: query }) => {
    if (value === "all" || value === "open" || value === "completed") filter.value = value;
    if (typeof query === "string") search.value = query;
    return { filter: filter.value, search: search.value, matched: visible.value.length };
  },
});

function addFromForm(): void {
  if (!draft.value.trim()) return;
  const next = addTask(tasks.value, draft.value, priority.value, `t${++sequence}`);
  if (!next) return;
  tasks.value = next;
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

function resetView(): void {
  filter.value = "all";
  search.value = "";
}

function startEdit(task: Task): void {
  editingId.value = task.id;
  editDraft.value = task.text;
}

function saveEdit(task: Task): void {
  const text = editDraft.value.trim();
  if (!text) return;
  tasks.value = updateTask(tasks.value, task.id, text);
  editingId.value = null;
  editDraft.value = "";
}

function decide(approved: boolean): void {
  approval.decide(approved);
}

onUnmounted(() => bridge?.close());

defineExpose({ surface });
</script>

<template>
  <main class="page">
    <section class="todo" v-scope="{ id: 'todo', label: copy.region, description: copy.regionDescription, role: 'main' }">
      <header class="head">
        <div>
          <p class="eyebrow">{{ copy.eyebrow }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="lead">{{ copy.lead }}</p>
        </div>
        <span class="badge">{{ copy.open(counts.open, counts.total) }}</span>
      </header>

      <form class="composer" @submit.prevent="addFromForm">
        <input v-model="draft" :placeholder="copy.newTaskPlaceholder" :aria-label="copy.newTask" maxlength="80" />
        <select v-model="priority" :aria-label="copy.priority">
          <option value="today">{{ copy.today }}</option>
          <option value="soon">{{ copy.soon }}</option>
          <option value="later">{{ copy.later }}</option>
        </select>
        <button type="submit" :disabled="!draft.trim() || tasks.length >= MAX_TASKS">{{ copy.add }}</button>
      </form>

      <div class="toolbar">
        <label class="search">
          <span class="sr-only">{{ copy.search }}</span>
          <input v-model="search" type="search" :placeholder="copy.searchPlaceholder" />
        </label>
        <div class="filters" role="group" :aria-label="copy.filter">
          <button type="button" :class="{ 'is-active': filter === 'all' }" @click="filter = 'all'">{{ copy.all }}</button>
          <button type="button" :class="{ 'is-active': filter === 'open' }" @click="filter = 'open'">{{ copy.openOnly }}</button>
          <button type="button" :class="{ 'is-active': filter === 'completed' }" @click="filter = 'completed'">{{ copy.completed }}</button>
          <button type="button" class="reset" :disabled="filter === 'all' && !search.trim()" @click="resetView">{{ copy.reset }}</button>
        </div>
      </div>

      <ul
        class="tasks"
        v-scope="{ id: 'todo_rows', label: copy.region, description: copy.regionDescription, role: 'list' }"
      >
        <li
          v-for="task in visible"
          :key="task.id"
          :class="{ done: task.done }"
          v-record="{
            data: task,
            label: task.text,
            fields: {
              text: task.text,
              status: task.done ? 'completed' : 'open',
              priority: task.priority,
            },
          }"
        >
          <template v-if="editingId === task.id">
            <input v-model="editDraft" class="edit-input" :aria-label="copy.taskText" @keyup.enter="saveEdit(task)" @keyup.esc="editingId = null" />
            <span class="row-actions">
              <button type="button" class="save" :disabled="!editDraft.trim()" @click="saveEdit(task)">{{ copy.save }}</button>
              <button type="button" @click="editingId = null">{{ copy.cancel }}</button>
            </span>
          </template>
          <template v-else>
            <label class="check">
              <input type="checkbox" :checked="task.done" @change="toggle(task.id)" />
              <span class="task-text">{{ task.text }}</span>
            </label>
            <span class="pill" :class="`priority-${task.priority}`">{{ priorityLabel(locale, task.priority) }}</span>
            <span class="row-actions">
              <button type="button" @click="startEdit(task)">{{ copy.edit }}</button>
              <button type="button" class="danger" @click="remove(task.id)">{{ copy.delete }}</button>
            </span>
          </template>
        </li>
      </ul>
      <p v-if="visible.length === 0" class="empty">{{ copy.empty }}</p>

      <footer class="footer">
        <span>{{ copy.completed }}: {{ counts.completed }}</span>
        <button type="button" class="danger" :disabled="counts.completed === 0" @click="clearCompleted">
          {{ copy.clearCompleted(counts.completed) }}
        </button>
      </footer>
      <p v-if="toast" class="toast">{{ toast }}</p>
    </section>

    <ExternalConsole :surface="surface" :locale="locale" />
    <McpGuide :locale="locale" :state="bridgeState" />

    <aside v-if="approval.current.value" class="approval" role="alertdialog" aria-modal="true" data-testid="approval">
      <p class="eyebrow">{{ copy.approvalEyebrow }}</p>
      <h3>{{ approval.current.value.description }}</h3>
      <code>{{ approval.current.value.id }}</code>
      <p>{{ copy.approvalHint }}</p>
      <div class="approval__actions">
        <button type="button" @click="decide(false)">{{ copy.deny }}</button>
        <button type="button" class="primary" @click="decide(true)">{{ copy.allow }}</button>
      </div>
    </aside>

    <AgentDock
      class="sidebar"
      layout="sidebar"
      side="right"
      :title="copy.dockTitle"
      :placeholder="copy.dockPlaceholder"
      :quick="copy.quick"
      :debug="{ maxCalls: 8 }"
      default-open
    />
  </main>
</template>

<style scoped>
.page {
  --demo-sidebar-width: min(400px, 44vw);
  display: grid;
  max-width: 1180px;
  margin: 0 auto;
  padding-right: calc(var(--demo-sidebar-width) + 24px);
  gap: 16px;
}
.todo {
  padding: 22px;
  border: 1px solid #dbe6f2;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 44px rgb(15 23 42 / 7%);
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.eyebrow {
  margin: 0 0 4px;
  color: #2e9df7;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.025em;
}
.lead {
  max-width: 700px;
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}
.badge {
  padding: 5px 9px;
  border: 1px solid #b9defb;
  border-radius: 999px;
  background: #f1f9ff;
  color: #0b6db7;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}
.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px auto;
  gap: 8px;
  margin: 18px 0 12px;
}
.composer input,
.composer select,
.search input,
.edit-input {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  background: #fff;
  color: #0f172a;
  font: inherit;
  font-size: 13px;
}
.composer button,
.save,
.primary {
  padding: 8px 12px;
  border: 0;
  border-radius: 9px;
  background: #1273cf;
  color: #fff;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.composer button:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.search {
  min-width: 220px;
  flex: 1;
}
.search input {
  width: 100%;
  box-sizing: border-box;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.filters button,
.row-actions button {
  padding: 5px 8px;
  border: 1px solid #dbe6f2;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
  font-size: 11px;
  cursor: pointer;
}
.filters button.is-active {
  border-color: #a7d6fb;
  background: #eaf6ff;
  color: #0b6db7;
  font-weight: 650;
}
.filters .reset {
  border-color: transparent;
  color: #0b6db7;
}
.filters button:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}
.tasks {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tasks li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fbfdff;
}
.tasks li.done {
  background: #f8fafc;
}
.check {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 9px;
  color: #1e293b;
  font-size: 13px;
}
.tasks li.done .task-text {
  color: #94a3b8;
  text-decoration: line-through;
}
.check input {
  accent-color: #1273cf;
}
.pill {
  padding: 3px 7px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  font-size: 10px;
  white-space: nowrap;
}
.priority-today {
  background: #fff1e8;
  color: #c2410c;
}
.priority-soon {
  background: #fffbeb;
  color: #a16207;
}
.row-actions {
  display: inline-flex;
  gap: 5px;
}
.row-actions .danger,
.footer .danger {
  color: #b91c1c;
}
.edit-input {
  flex: 1;
}
.empty {
  margin: 18px 0 0;
  color: #94a3b8;
  text-align: center;
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #eef2f7;
  color: #64748b;
  font-size: 12px;
}
.footer button {
  padding: 5px 8px;
  border: 0;
  background: none;
  font-size: 12px;
  cursor: pointer;
}
.footer button:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}
.toast {
  margin: 8px 0 0;
  color: #15803d;
  font-size: 12px;
}
.approval {
  position: fixed;
  inset: 0;
  z-index: 2147483002;
  width: min(420px, calc(100vw - 32px));
  height: fit-content;
  margin: auto;
  padding: 22px;
  border: 1px solid #dbe6f2;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 28px 90px rgb(15 23 42 / 28%);
}
.approval h3 {
  margin: 8px 0;
  font-size: 18px;
}
.approval p {
  color: #64748b;
  font-size: 13px;
  line-height: 1.55;
}
.approval__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.approval__actions button {
  padding: 7px 11px;
  border: 1px solid #dbe6f2;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}
.approval__actions .primary {
  background: #1273cf;
  border-color: #1273cf;
  color: #fff;
}
.sidebar {
  --pling-sidebar-width: var(--demo-sidebar-width);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
@media (max-width: 820px) {
  .page {
    padding-right: 0;
  }
}
@media (max-width: 650px) {
  .head {
    flex-direction: column;
  }
  .composer {
    grid-template-columns: 1fr;
  }
  .tasks li {
    flex-wrap: wrap;
  }
}
</style>
