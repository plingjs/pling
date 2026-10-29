<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock } from "@plingjs/vue";
import { copyFor, initialTodos, type DemoLocale } from "./copy";

const props = defineProps<{
  quick: readonly string[];
  locale: DemoLocale;
}>();

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

const draft = ref("");
const filter = ref<"all" | "open" | "completed">("all");
const editingId = ref<string | null>(null);
const editDraft = ref("");
const sidebarOpen = ref(true);
const copy = computed(() => copyFor(props.locale));
const todos = ref<Todo[]>(initialTodos(props.locale));
const remaining = computed(() => todos.value.filter((todo) => !todo.done).length);
const completed = computed(() => todos.value.length - remaining.value);
const visibleTodos = computed(() =>
  todos.value.filter((todo) => {
    if (filter.value === "open") return !todo.done;
    if (filter.value === "completed") return todo.done;
    return true;
  }),
);
let sequence = 3;

function addTodo(): void {
  const text = draft.value.trim();
  if (!text) return;
  todos.value.push({ id: `t${++sequence}`, text, done: false });
  draft.value = "";
}

function removeTodo(id: string): void {
  todos.value = todos.value.filter((todo) => todo.id !== id);
}

function startEdit(todo: Todo): void {
  editingId.value = todo.id;
  editDraft.value = todo.text;
}

function saveEdit(todo: Todo): void {
  const text = editDraft.value.trim();
  if (!text) return;
  todo.text = text;
  editingId.value = null;
  editDraft.value = "";
}

function cancelEdit(): void {
  editingId.value = null;
  editDraft.value = "";
}

function clearCompleted(): void {
  todos.value = todos.value.filter((todo) => !todo.done);
  if (filter.value === "completed") filter.value = "all";
}

function setFilter(value: "all" | "open" | "completed"): void {
  filter.value = value;
}
</script>

<template>
  <main class="todo-page" :class="{ 'is-sidebar-closed': !sidebarOpen }">
    <section class="todo-card" aria-labelledby="todo-title">
      <header class="todo-head">
        <div>
          <p class="eyebrow">{{ copy.eyebrow }}</p>
          <h1 id="todo-title">{{ copy.title }}</h1>
          <p class="meta">{{ copy.openTotal(remaining, todos.length) }}</p>
        </div>
        <span class="badge">{{ copy.badge }}</span>
      </header>

      <form class="composer" @submit.prevent="addTodo">
        <label for="todo-input">{{ copy.newItem }}</label>
        <div class="composer__row">
          <input
            id="todo-input"
            v-model="draft"
            type="text"
            autocomplete="off"
            :placeholder="copy.placeholder"
            v-tool="{ id: 'todo_text', action: 'fill', desc: copy.textDesc }"
          />
          <button
            id="add-todo"
            type="submit"
            :disabled="!draft.trim()"
            v-tool="{ id: 'add_todo', desc: copy.addDesc }"
          >
            {{ copy.add }}
          </button>
        </div>
      </form>

      <div class="filters" role="group" :aria-label="copy.filterLabel">
        <button
          type="button"
          :class="{ 'is-active': filter === 'all' }"
          v-tool="{ id: 'filter_all', kind: 'read', desc: copy.filterAll }"
          @click="setFilter('all')"
        >
          {{ copy.filterAll }}
        </button>
        <button
          type="button"
          :class="{ 'is-active': filter === 'open' }"
          v-tool="{ id: 'filter_open', kind: 'read', desc: copy.filterOpen }"
          @click="setFilter('open')"
        >
          {{ copy.filterOpen }}
        </button>
        <button
          type="button"
          :class="{ 'is-active': filter === 'completed' }"
          v-tool="{ id: 'filter_completed', kind: 'read', desc: copy.filterCompleted }"
          @click="setFilter('completed')"
        >
          {{ copy.filterCompleted }}
        </button>
      </div>

      <ul
        id="todo-list"
        class="todo-list"
        v-scope="{ id: 'todos', label: copy.scopeLabel, description: copy.scopeDescription, role: 'list' }"
      >
        <li
          v-for="todo in visibleTodos"
          :key="todo.id"
          class="todo-row"
          :class="{ 'is-done': todo.done }"
          v-record="{ data: todo, label: todo.text, fields: { text: todo.text, done: todo.done } }"
        >
          <template v-if="editingId === todo.id">
            <input
              class="edit-input"
              :value="editDraft"
              :aria-label="copy.editTextDesc(todo.text)"
              v-tool="{ id: `edit_text@${todo.id}`, action: 'fill', desc: copy.editTextDesc(todo.text) }"
              @input="editDraft = ($event.target as HTMLInputElement).value"
              @keyup.enter="saveEdit(todo)"
              @keyup.esc="cancelEdit"
            />
            <span class="row-actions">
              <button
                type="button"
                class="save"
                :disabled="!editDraft.trim()"
                v-tool="{ id: `save_edit@${todo.id}`, kind: 'write', desc: copy.saveEditDesc(todo.text) }"
                @click="saveEdit(todo)"
              >
                {{ copy.saveEdit }}
              </button>
              <button type="button" class="remove" @click="cancelEdit">{{ copy.cancelEdit }}</button>
            </span>
          </template>
          <template v-else>
            <label class="todo-check">
              <input
                v-model="todo.done"
                type="checkbox"
                v-tool="{ id: `toggle@${todo.id}`, desc: copy.toggleDesc(todo.text, todo.done) }"
              />
              <span>{{ todo.text }}</span>
            </label>
            <span class="row-actions">
              <button
                type="button"
                class="edit"
                v-tool="{ id: `edit@${todo.id}`, kind: 'read', desc: copy.editDesc(todo.text) }"
                @click="startEdit(todo)"
              >
                {{ copy.edit }}
              </button>
              <button
                :id="`remove-${todo.id}`"
                type="button"
                class="remove"
                v-tool="{ id: `remove@${todo.id}`, kind: 'write', desc: copy.removeDesc(todo.text) }"
                @click="removeTodo(todo.id)"
              >
                {{ copy.remove }}
              </button>
            </span>
          </template>
        </li>
      </ul>

      <p v-if="visibleTodos.length === 0" class="empty">{{ todos.length === 0 ? copy.empty : copy.emptyFiltered }}</p>

      <footer class="todo-footer">
        <span>{{ copy.openTotal(remaining, todos.length) }}</span>
        <button
          type="button"
          class="clear"
          :disabled="completed === 0"
          v-tool="{ id: 'clear_completed', kind: 'danger', desc: copy.clearCompletedDesc }"
          @click="clearCompleted"
        >
          {{ copy.clearCompleted(completed) }}
        </button>
      </footer>
    </section>

    <AgentDock
      class="todo-sidebar"
      layout="sidebar"
      side="right"
      :title="copy.dockTitle"
      :placeholder="copy.dockPlaceholder"
      default-open
      :quick="props.quick"
      @open="sidebarOpen = $event"
    />
  </main>
</template>

<style scoped>
.todo-page {
  --demo-sidebar-width: min(400px, 44vw);
  max-width: 1120px;
  min-height: 100%;
  margin: 0 auto;
  padding-right: calc(var(--demo-sidebar-width) + 16px);
  transition: padding-right 180ms ease;
}
.todo-page.is-sidebar-closed {
  padding-right: 0;
}
.todo-card {
  padding: 22px;
  border: 1px solid #dbe6f2;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 44px rgb(15 23 42 / 7%);
}
.todo-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.eyebrow {
  margin: 0 0 4px;
  color: #2e9df7;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.todo-head h1 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.02em;
}
.meta {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 13px;
}
.badge {
  padding: 5px 8px;
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
  gap: 7px;
  margin: 22px 0 16px;
  color: #475569;
  font-size: 12px;
  font-weight: 650;
}
.composer__row {
  display: flex;
  gap: 8px;
}
.composer__row input {
  min-width: 0;
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 400;
}
.composer__row input:focus {
  border-color: #2e9df7;
  outline: 3px solid rgb(46 157 247 / 16%);
}
.composer__row button {
  padding: 9px 15px;
  border: 1px solid #1273cf;
  border-radius: 10px;
  background: #1273cf;
  color: #fff;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}
.composer__row button:disabled {
  border-color: #dbe6f2;
  background: #eef4fa;
  color: #94a3b8;
  cursor: not-allowed;
}
.todo-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.filters {
  display: flex;
  gap: 6px;
  margin: 0 0 12px;
}
.filters button {
  padding: 5px 9px;
  border: 1px solid #dbe6f2;
  border-radius: 999px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
}
.filters button.is-active {
  border-color: #a7d6fb;
  background: #eaf6ff;
  color: #0b6db7;
  font-weight: 650;
}
.todo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  background: #fff;
}
.todo-row.is-done {
  background: #f8fafc;
}
.todo-check {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: #1e293b;
  font-size: 14px;
}
.todo-row.is-done .todo-check span {
  color: #94a3b8;
  text-decoration: line-through;
}
.todo-check input {
  width: 16px;
  height: 16px;
  accent-color: #1273cf;
}
.edit-input {
  min-width: 0;
  flex: 1;
  padding: 7px 9px;
  border: 1px solid #2e9df7;
  border-radius: 8px;
  color: #0f172a;
  font-size: 14px;
}
.row-actions {
  display: inline-flex;
  gap: 10px;
  align-items: center;
}
.edit,
.save,
.remove {
  padding: 4px 2px;
  border: 0;
  background: none;
  color: #b91c1c;
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.edit,
.save {
  color: #0b6db7;
}
.save:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}
.todo-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #eef2f7;
  color: #64748b;
  font-size: 12px;
}
.clear {
  padding: 5px 8px;
  border: 1px solid #dbe6f2;
  border-radius: 8px;
  background: #fff;
  color: #b91c1c;
  font-size: 12px;
  cursor: pointer;
}
.clear:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}
.empty {
  margin: 18px 0 0;
  color: #94a3b8;
  text-align: center;
}
.todo-sidebar {
  --pling-sidebar-width: var(--demo-sidebar-width);
}
@media (max-width: 720px) {
  .todo-page {
    padding-right: 0;
  }
  .todo-head {
    flex-direction: column;
  }
}
</style>
