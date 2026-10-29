<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useAgentState, useAgentTool, usePling, useSurfaceGateway } from "@plingjs/vue";
import { createApproval } from "./approval";
import {
  copyFor,
  priorityLabel,
  type DemoLocale,
  type Priority,
  type TodoFilter,
} from "./copy";
import ExternalConsole from "./ExternalConsole.vue";
import GatewayGuide from "./GatewayGuide.vue";
import McpGuide from "./McpGuide.vue";
import { installMcpBridge, type BridgeConnectionState } from "./mcp-bridge";
import { createTodoSurface, EXTERNAL_SCOPE } from "./surface";
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
const { surface: inspectorSurface } = createTodoSurface(pling.registry, approval.confirm);
const params = new URLSearchParams(location.search);
const mcpEnabled = params.has("mcp");
const localHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const gatewayMode = !localHost || params.get("transport") === "gateway";
const gatewayUrl = (
  import.meta.env.VITE_SURFACE_GATEWAY_URL?.trim() ||
  (localHost ? "http://127.0.0.1:5219" : "https://surface.hunger-valley.com")
).replace(/\/$/, "");
const localBridge = gatewayMode || !mcpEnabled ? null : installMcpBridge({ surface: inspectorSurface, approval, app: "example-todo-surface" });
const bridgeState = computed<BridgeConnectionState | "disabled">(() => localBridge?.state.value ?? "disabled");
const gateway = useSurfaceGateway({
  app: "example-todo-surface",
  expose: EXTERNAL_SCOPE,
  mode: "public-demo",
  gatewayUrl,
  approval,
  confirm: approval.confirm,
  autoConnect: false,
  surface: { recordLimit: 8 },
});
const pageSession = gateway.page;
const gatewayAccess = gateway.access;
const gatewayBusy = gateway.busy;
const gatewayError = gateway.error;
const gatewayState = gateway.state;
const gatewayAgent = gateway.agent;

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

onMounted(() => {
  if (gatewayMode && mcpEnabled) void gateway.connect();
});

onUnmounted(() => {
  localBridge?.close();
  gateway.disconnect();
});

defineExpose({ surface: inspectorSurface });
</script>

<template>
  <main class="page">
    <header class="hero">
      <div class="hero__copy">
        <p class="eyebrow">{{ copy.eyebrow }}</p>
        <h1>{{ copy.title }}</h1>
        <p class="lead">{{ copy.lead }}</p>
      </div>
      <div class="hero__meta" :aria-label="copy.workspaceLabel">
        <span class="meta-chip"><b>01</b>{{ copy.todoPanelTitle }}</span>
        <span class="meta-chip"><b>02</b>{{ copy.inspectorPanelTitle }}</span>
        <span class="meta-chip meta-chip--live"><b>03</b>{{ copy.surfacePanelTitle }}</span>
      </div>
    </header>

    <div class="workspace">
      <section
        id="todo-panel"
        class="todo"
        v-scope="{ id: 'todo', label: copy.region, description: copy.regionDescription, role: 'main' }"
      >
        <header class="panel-head">
          <div class="panel-head__number">01</div>
          <div>
            <p class="panel-kicker">{{ copy.todoPanelEyebrow }}</p>
            <h2>{{ copy.todoPanelTitle }}</h2>
            <p class="panel-hint">{{ copy.todoPanelHint }}</p>
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

      <div class="rail">
        <ExternalConsole id="inspector-panel" :surface="inspectorSurface" :locale="locale" />
        <McpGuide v-if="!gatewayMode" :locale="locale" :state="bridgeState" />
        <GatewayGuide
          v-else
          id="surface-panel"
          :locale="locale"
          :state="gatewayState"
          :page="pageSession"
          :access="gatewayAccess"
          :agent="gatewayAgent"
          :busy="gatewayBusy"
          :error="gatewayError"
          @access="gateway.claim()"
          @revoke="gateway.revoke()"
          @retry="gateway.connect()"
        />
      </div>
    </div>

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
  </main>
</template>

<style scoped>
.page {
  display: grid;
  max-width: 1480px;
  margin: 0 auto;
  gap: 18px;
}
.hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  padding: 30px 32px;
  overflow: hidden;
  border: 1px solid #d8e6f4;
  border-radius: 22px;
  background:
    radial-gradient(circle at 86% 15%, rgb(58 163 255 / 18%), transparent 30%),
    linear-gradient(135deg, #fff 0%, #f5faff 62%, #edf7ff 100%);
  box-shadow: 0 18px 50px rgb(15 23 42 / 7%);
}
.hero__copy { max-width: 760px; }
.hero h1 {
  max-width: 720px;
  margin: 0;
  font-size: clamp(28px, 4vw, 46px);
  line-height: 1.08;
  letter-spacing: -0.045em;
}
.hero .lead { max-width: 720px; margin-top: 12px; font-size: 14px; }
.hero__meta {
  display: flex;
  min-width: 260px;
  flex-direction: column;
  gap: 7px;
}
.meta-chip {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 11px;
  border: 1px solid #dbe8f5;
  border-radius: 9px;
  background: rgb(255 255 255 / 78%);
  color: #52657a;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(8px);
}
.meta-chip b {
  color: #1b9cf0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.04em;
}
.meta-chip--live { border-color: #bce3d1; color: #177a55; }
.meta-chip--live b { color: #22a06b; }
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.04fr) minmax(390px, 0.96fr);
  align-items: start;
  gap: 18px;
}
.rail {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
}
.rail > * { min-width: 0; }
.todo {
  padding: 22px;
  border: 1px solid #dbe6f2;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 44px rgb(15 23 42 / 7%);
}
.panel-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}
.panel-head__number {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: #e9f6ff;
  color: #0b79cc;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
}
.panel-head > div:nth-child(2) { min-width: 0; flex: 1; }
.panel-kicker {
  margin: 0 0 2px;
  color: #2e9df7;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
.panel-head h2 { margin: 0; font-size: 20px; letter-spacing: -0.02em; }
.panel-hint { margin: 4px 0 0; color: #78879a; font-size: 12px; line-height: 1.5; }
.eyebrow {
  margin: 0 0 5px;
  color: #168fe3;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.lead {
  margin: 0;
  color: #63758a;
  font-size: 13px;
  line-height: 1.65;
}
.badge {
  flex: none;
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
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
@media (max-width: 1080px) {
  .workspace { grid-template-columns: 1fr; }
  .rail { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}
@media (max-width: 760px) {
  .hero { align-items: flex-start; flex-direction: column; padding: 22px; }
  .hero__meta { width: 100%; min-width: 0; flex-direction: row; flex-wrap: wrap; }
  .rail { grid-template-columns: 1fr; }
}
@media (max-width: 650px) {
  .panel-head { flex-wrap: wrap; }
  .composer {
    grid-template-columns: 1fr;
  }
  .tasks li {
    flex-wrap: wrap;
  }
}
</style>
