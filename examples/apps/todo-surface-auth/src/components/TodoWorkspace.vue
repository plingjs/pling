<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import {
  AgentDock,
  useAgentState,
  useSurfaceGateway,
  type SurfaceConnectionState,
  type ToolOptions,
} from "@plingjs/vue";
import { api, ApiError, type Todo, type User } from "../api";
import { createExternalApproval } from "../surface/approval";
import ExternalApprovalPanel from "./ExternalApprovalPanel.vue";
import SurfacePanel from "./SurfacePanel.vue";

const props = defineProps<{ user: User; initialTodos: Todo[] }>();

const MAX_TODOS = 50;

const todos = ref<Todo[]>(props.initialTodos.map((todo) => ({ ...todo })));
const draft = ref("");
const operationError = ref("");
const pending = ref<Record<string, boolean>>({});
const lastAddedId = ref<string | null>(null);

const approval = createExternalApproval();
const EXTERNAL_SCOPE = ["add_task", "toggle@", "delete@", "clear_completed"];
const gateway = useSurfaceGateway({
  app: "case077-todo-surface",
  expose: EXTERNAL_SCOPE,
  mode: "bff",
  getPageSession: () => api.pageSession(),
  approval,
  confirm: approval.confirm,
  autoConnect: false,
});

const openCount = computed(() => todos.value.filter((todo) => !todo.done).length);
const completedCount = computed(() => todos.value.filter((todo) => todo.done).length);
const gatewayState = computed<SurfaceConnectionState | "idle">(() => gateway.state.value);
const pageSession = gateway.page;
const pairing = gateway.pairing;
const connectedAgent = gateway.agent;
const externalBusy = gateway.busy;
const externalError = gateway.error;

useAgentState(
  "todo",
  () => ({
    total: todos.value.length,
    open: openCount.value,
    completed: completedCount.value,
    items: todos.value.map(({ id, text, done }) => ({ id, text, status: done ? "completed" : "open" })),
  }),
  { description: "Current signed-in user's Todo list, counts, and record states" },
);

const addTaskAction = {
  id: "add_task",
  desc: "Add one task to the signed-in user's Todo list.",
  kind: "write",
  params: [
    {
      name: "text",
      label: "Task text, 1–160 characters and not only whitespace",
      minLength: 1,
      maxLength: 160,
      pattern: /\S/,
    },
  ],
  available: () =>
    todos.value.length < MAX_TODOS ? true : `The list is full (${MAX_TODOS} items). Delete a task before adding another.`,
  run: async ({ text }: Record<string, unknown>) => {
    await createTask(String(text));
  },
  expect: {
    desc: "The new task appears in the list",
    check: () => lastAddedId.value !== null && todos.value.some((todo) => todo.id === lastAddedId.value),
  },
} satisfies ToolOptions;

const clearCompletedAction = {
  id: "clear_completed",
  desc: "Permanently remove every completed task from the signed-in user's list.",
  kind: "danger",
  available: () =>
    completedCount.value > 0 ? true : "There are no completed tasks to clear.",
  run: () => clearCompletedTasks(),
  expect: {
    desc: "No completed tasks remain",
    check: () => completedCount.value === 0,
  },
} satisfies ToolOptions;

function toggleAction(todo: Todo): ToolOptions {
  return {
    id: `toggle@${todo.id}`,
    desc: `Mark “${todo.text}” as ${todo.done ? "open" : "completed"}.`,
    kind: "write",
    run: () => toggleTask(todo.id),
    expect: {
      desc: `The status of ${todo.id} changes`,
      check: () => {
        const current = todos.value.find((item) => item.id === todo.id);
        return current ? current.done === !todo.done : false;
      },
    },
  };
}

function deleteAction(todo: Todo): ToolOptions {
  return {
    id: `delete@${todo.id}`,
    desc: `Permanently delete “${todo.text}”.`,
    kind: "danger",
    run: () => deleteTask(todo.id),
    expect: {
      desc: `The task ${todo.id} no longer appears`,
      check: () => !todos.value.some((item) => item.id === todo.id),
    },
  };
}

async function createTask(text: string): Promise<void> {
  const value = text.trim();
  if (!value) throw new Error("Task text cannot be empty.");
  const { todo } = await api.createTodo(value);
  todos.value = [todo, ...todos.value];
  lastAddedId.value = todo.id;
}

async function submitDraft(): Promise<void> {
  const text = draft.value.trim();
  if (!text || pending.value.add) return;
  pending.value.add = true;
  operationError.value = "";
  try {
    await createTask(text);
    draft.value = "";
  } catch (error) {
    operationError.value = messageOf(error);
  } finally {
    pending.value.add = false;
  }
}

async function toggleTask(id: string): Promise<void> {
  if (pending.value[id]) return;
  pending.value[id] = true;
  operationError.value = "";
  try {
    const { todo } = await api.toggleTodo(id);
    replaceTodo(todo);
  } catch (error) {
    operationError.value = messageOf(error);
    throw error;
  } finally {
    pending.value[id] = false;
  }
}

async function deleteTask(id: string): Promise<void> {
  if (pending.value[id]) return;
  pending.value[id] = true;
  operationError.value = "";
  try {
    await api.deleteTodo(id);
    todos.value = todos.value.filter((todo) => todo.id !== id);
  } catch (error) {
    operationError.value = messageOf(error);
    throw error;
  } finally {
    pending.value[id] = false;
  }
}

async function clearCompletedTasks(): Promise<void> {
  if (pending.value.clear) return;
  pending.value.clear = true;
  operationError.value = "";
  try {
    await api.clearCompleted();
    const result = await api.listTodos();
    todos.value = result.todos;
  } catch (error) {
    operationError.value = messageOf(error);
    throw error;
  } finally {
    pending.value.clear = false;
  }
}

function manualToggle(id: string): void {
  void toggleTask(id).catch(() => {});
}

function manualDelete(id: string): void {
  void deleteTask(id).catch(() => {});
}

function manualClearCompleted(): void {
  void clearCompletedTasks().catch(() => {});
}

function replaceTodo(next: Todo): void {
  todos.value = todos.value.map((todo) => (todo.id === next.id ? next : todo));
}

async function connectSurface(): Promise<void> {
  await gateway.connect();
}

async function requestPairing(): Promise<void> {
  await gateway.pair();
}

async function revokeAgent(): Promise<void> {
  await gateway.revoke();
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

onUnmounted(() => {
  approval.close();
});
</script>

<template>
  <div class="workspace">
    <section
      class="board"
      aria-labelledby="todo-title"
      v-scope="{
        id: 'todo',
        label: 'Todo list',
        description: 'The signed-in user can add, complete, delete, and clear Todo records.',
        role: 'main',
      }"
    >
      <header class="board__head">
        <div>
          <p class="eyebrow">Signed in as {{ user.name }}</p>
          <h2 id="todo-title">Today</h2>
          <p class="board__meta">{{ openCount }} open · {{ completedCount }} completed · {{ todos.length }} total</p>
        </div>
        <button
          type="button"
          class="clear"
          v-tool="clearCompletedAction"
          :disabled="completedCount === 0 || pending.clear"
          @click="manualClearCompleted"
        >
          {{ pending.clear ? "Clearing…" : "Clear completed" }}
        </button>
      </header>

      <form class="composer" v-tool="addTaskAction" @submit.prevent="submitDraft">
        <label class="composer__label" for="new-task">New task</label>
        <div class="composer__row">
          <input
            id="new-task"
            v-model="draft"
            name="task"
            maxlength="160"
            autocomplete="off"
            placeholder="What needs to be done?"
            :disabled="todos.length >= MAX_TODOS"
          />
          <button type="submit" :disabled="!draft.trim() || Boolean(pending.add) || todos.length >= MAX_TODOS">
            {{ pending.add ? "Adding…" : "Add task" }}
          </button>
        </div>
        <p class="composer__hint">The same action is available to the page assistant and to a paired external Agent.</p>
      </form>

      <p v-if="operationError" class="board__error" role="alert">{{ operationError }}</p>

      <ul class="list" aria-label="Todo records">
        <li
          v-for="todo in todos"
          :key="todo.id"
          class="item"
          :class="{ done: todo.done, busy: pending[todo.id] }"
          v-record="{
            id: todo.id,
            label: todo.text,
            fields: { text: todo.text, status: todo.done ? 'completed' : 'open' },
          }"
        >
          <input
            type="checkbox"
            :checked="todo.done"
            :disabled="Boolean(pending[todo.id])"
            :aria-label="`${todo.done ? 'Reopen' : 'Complete'} ${todo.text}`"
            v-tool="toggleAction(todo)"
            @change="manualToggle(todo.id)"
          />
          <div class="item__body">
            <span class="item__text">{{ todo.text }}</span>
            <span class="item__id">{{ todo.id }}</span>
          </div>
          <button
            type="button"
            class="item__delete"
            :disabled="Boolean(pending[todo.id])"
            v-tool="deleteAction(todo)"
            @click="manualDelete(todo.id)"
          >
            Delete
          </button>
        </li>
      </ul>

      <p v-if="todos.length === 0" class="empty">The list is empty. Add a task to begin.</p>
    </section>

    <SurfacePanel
      :connection="gatewayState"
      :page="pageSession"
      :pairing="pairing"
      :agent="connectedAgent"
      :busy="externalBusy"
      :error="externalError"
      @connect="connectSurface"
      @pair="requestPairing"
      @revoke="revokeAgent"
    />
  </div>

  <AgentDock
    layout="sidebar"
    side="right"
    launcher-placement="bottom"
    title="Todo assistant"
    placeholder="Ask about a task or change the list…"
    debug
    :model-settings="{ mode: 'byok', persist: 'session' }"
    :quick="['Mark the first task complete', 'Add a task called Send the weekly report', 'What is still open?']"
  />

  <ExternalApprovalPanel :request="approval.current.value" @decide="approval.decide" />
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 370px);
  gap: 20px;
  width: min(1120px, calc(100vw - 40px));
  margin: 0 auto;
  padding: 28px 0 92px;
}
.board {
  align-self: start;
  padding: 24px;
  border: 1px solid #dbe6f2;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 20px 50px rgb(15 23 42 / 7%);
}
.board__head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}
.eyebrow {
  margin: 0 0 5px;
  color: #1677c8;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h2 {
  margin: 0;
  color: #0f172a;
  font-size: 30px;
  letter-spacing: -0.035em;
}
.board__meta {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 12px;
}
.clear {
  padding: 7px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.clear:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}
.composer {
  margin: 24px 0 18px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 13px;
  background: #f8fafc;
}
.composer__label {
  display: block;
  margin-bottom: 6px;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
}
.composer__row {
  display: flex;
  gap: 8px;
}
.composer input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  color: #0f172a;
  font: inherit;
  font-size: 13px;
}
.composer input:focus {
  border-color: #2e9df7;
  outline: 3px solid rgb(46 157 247 / 15%);
}
.composer button {
  flex: none;
  padding: 9px 15px;
  border: 0;
  border-radius: 9px;
  background: #2e9df7;
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.composer button:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
.composer__hint {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 10px;
  line-height: 1.5;
}
.board__error {
  margin: 0 0 14px;
  padding: 9px 11px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.5;
}
.list {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  transition: opacity 120ms ease, background-color 120ms ease;
}
.item.busy {
  opacity: 0.55;
}
.item.done {
  background: #f8fafc;
}
.item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #2e9df7;
}
.item__body {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
}
.item__text {
  color: #1e293b;
  font-size: 13px;
  line-height: 1.45;
}
.item.done .item__text {
  color: #94a3b8;
  text-decoration: line-through;
}
.item__id {
  color: #b6c2d1;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9px;
}
.item__delete {
  flex: none;
  padding: 5px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #b91c1c;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}
.item__delete:hover {
  background: #fee2e2;
}
.empty {
  margin: 26px 0;
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
}
@media (max-width: 850px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .workspace {
    width: calc(100vw - 24px);
    padding-top: 16px;
  }
  .board {
    padding: 18px;
  }
  .board__head,
  .composer__row {
    flex-direction: column;
  }
  .clear,
  .composer button {
    width: 100%;
  }
}
</style>
