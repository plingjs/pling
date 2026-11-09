<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, useAgentState } from "@plingjs/vue";
import { copyFor, type DemoLocale } from "../shared/copy";
import {
  MAX_TODOS,
  addTodo,
  clearCompleted as removeCompleted,
  countTodos,
  createSeedTodos,
  removeTodo,
  toggleTodo,
  updateTodo,
  visibleTodos,
  type TodoFilter,
} from "../shared/todos";

const props = defineProps<{ locale: DemoLocale }>();
const copy = computed(() => copyFor(props.locale));
const tasks = ref(createSeedTodos(props.locale));
const draft = ref("");
const filter = ref<TodoFilter>("all");
const editingId = ref<string | null>(null);
const editDraft = ref("");
const assistantOpen = ref(
  typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(min-width: 981px)").matches,
);

const counts = computed(() => countTodos(tasks.value));
const shown = computed(() => visibleTodos(tasks.value, filter.value));
const full = computed(() => tasks.value.length >= MAX_TODOS);
const progress = computed(() => (counts.value.total === 0 ? 0 : Math.round((counts.value.completed / counts.value.total) * 100)));

function addAvailability(): true | string {
  return full.value ? copy.value.fullReason : true;
}

function allCompletedRemoved(): boolean {
  return tasks.value.every((task) => !task.done);
}

function taskRemoved(id: string): boolean {
  return !tasks.value.some((task) => task.id === id);
}

// [Retrofit 04] Expose a small read model, not the whole component state.
useAgentState(
  "daylist_view",
  () => ({
    filter: filter.value,
    visible: shown.value.length,
    total: counts.value.total,
    open: counts.value.open,
    completed: counts.value.completed,
    capacity: MAX_TODOS,
  }),
  { description: copy.value.scopeDescription },
);

function submit(): void {
  if (!draft.value.trim() || full.value) return;
  tasks.value = addTodo(tasks.value, draft.value);
  draft.value = "";
}

function toggle(id: string): void {
  tasks.value = toggleTodo(tasks.value, id);
}

function startEdit(id: string, text: string): void {
  editingId.value = id;
  editDraft.value = text;
}

function saveEdit(id: string): void {
  if (!editDraft.value.trim()) return;
  tasks.value = updateTodo(tasks.value, id, editDraft.value);
  editingId.value = null;
  editDraft.value = "";
}

function cancelEdit(): void {
  editingId.value = null;
  editDraft.value = "";
}

function remove(id: string): void {
  tasks.value = removeTodo(tasks.value, id);
  if (editingId.value === id) cancelEdit();
}

function clearCompleted(): void {
  tasks.value = removeCompleted(tasks.value);
  if (filter.value === "completed") filter.value = "all";
}

function setFilter(value: TodoFilter): void {
  filter.value = value;
}
</script>

<template>
  <div class="app-shell" :class="{ 'has-assistant': assistantOpen }">
    <header class="topbar">
      <a class="brand" href="/">
        <span class="brand__mark" aria-hidden="true">π</span>
        <span class="brand__name">{{ copy.product }}</span>
        <span class="brand__note">{{ copy.productNote }}</span>
      </a>
      <span class="mode is-live">{{ copy.integratedBadge }}</span>
    </header>

    <div class="workspace">
      <!-- [Retrofit 02] A stable region name gives the agent a map before it sees actions. -->
      <main v-scope="{ id: 'daylist', label: copy.scopeLabel, description: copy.scopeDescription, role: 'main' }">
        <section class="hero" aria-labelledby="page-title">
          <div>
            <p class="eyebrow">{{ copy.eyebrow }}</p>
            <h1 id="page-title">{{ copy.title }}</h1>
            <p>{{ copy.subtitle }}</p>
          </div>
          <div class="hero__count" aria-live="polite">
            <strong>{{ counts.open }}</strong>
            <span>{{ copy.openLabel }}</span>
          </div>
        </section>

        <section class="board" aria-label="Tasks">
          <form class="composer" @submit.prevent="submit">
            <label for="new-task">{{ copy.composerLabel }}</label>
            <div class="composer__row">
              <input
                id="new-task"
                v-model="draft"
                type="text"
                autocomplete="off"
                :placeholder="copy.placeholder"
                :maxlength="80"
                v-tool="{ id: 'new_todo_text', action: 'fill', kind: 'write', desc: copy.textDesc }"
              />
              <button
                class="primary"
                type="submit"
                :disabled="!draft.trim() || full"
                v-tool="{
                  id: 'add_todo',
                  kind: 'write',
                  desc: copy.addDesc,
                  available: addAvailability,
                }"
              >
                {{ copy.add }}
              </button>
            </div>
          </form>

          <div class="toolbar">
            <div class="filters" role="group" :aria-label="copy.filterLabel">
              <button
                type="button"
                :class="{ 'is-active': filter === 'all' }"
                v-tool="{ id: 'filter_all', kind: 'write', desc: copy.filterAll }"
                @click="setFilter('all')"
              >
                {{ copy.filterAll }}
              </button>
              <button
                type="button"
                :class="{ 'is-active': filter === 'open' }"
                v-tool="{ id: 'filter_open', kind: 'write', desc: copy.filterOpen }"
                @click="setFilter('open')"
              >
                {{ copy.filterOpen }}
              </button>
              <button
                type="button"
                :class="{ 'is-active': filter === 'completed' }"
                v-tool="{ id: 'filter_completed', kind: 'write', desc: copy.filterCompleted }"
                @click="setFilter('completed')"
              >
                {{ copy.filterCompleted }}
              </button>
            </div>
            <button
              class="clear"
              type="button"
              :disabled="counts.completed === 0"
              v-tool="{
                id: 'clear_completed',
                kind: 'danger',
                desc: copy.clearDesc,
                expect: { desc: 'No completed tasks remain', check: allCompletedRemoved },
              }"
              @click="clearCompleted"
            >
              {{ copy.clearCompleted(counts.completed) }}
            </button>
          </div>

          <p class="toast" role="status">{{ full ? copy.fullReason : '' }}</p>

          <!-- [Retrofit 03] The list is a scoped collection; each row is a readable record. -->
          <ul
            class="task-list"
            v-scope="{ id: 'task_list', label: copy.scopeLabel, description: copy.scopeDescription, role: 'list' }"
          >
            <li
              v-for="task in shown"
              :key="task.id"
              class="task-row"
              :class="{ 'is-done': task.done }"
              v-record="{
                data: task,
                id: task.id,
                label: task.text,
                fields: { text: task.text, done: task.done },
              }"
            >
              <template v-if="editingId === task.id">
                <span aria-hidden="true"></span>
                <input
                  v-model="editDraft"
                  class="edit-input"
                  :aria-label="copy.editTextDesc(task.text)"
                  :maxlength="80"
                  v-tool="{ id: `edit_text@${task.id}`, action: 'fill', kind: 'write', desc: copy.editTextDesc(task.text) }"
                  @keydown.enter.prevent="saveEdit(task.id)"
                  @keydown.esc="cancelEdit"
                />
                <span class="row-actions">
                  <button
                    type="button"
                    :disabled="!editDraft.trim()"
                    v-tool="{ id: `save_edit@${task.id}`, kind: 'write', desc: copy.saveEditDesc(task.text) }"
                    @click="saveEdit(task.id)"
                  >
                    {{ copy.save }}
                  </button>
                  <button type="button" @click="cancelEdit">{{ copy.cancelEdit }}</button>
                </span>
              </template>
              <template v-else>
                <button
                  class="task-check"
                  type="button"
                  role="checkbox"
                  :aria-checked="task.done"
                  :aria-label="copy.toggleDesc(task.text, task.done)"
                  v-tool="{
                    id: `toggle@${task.id}`,
                    kind: 'write',
                    desc: copy.toggleDesc(task.text, task.done),
                  }"
                  @click="toggle(task.id)"
                />
                <div class="task-copy">
                  <strong>{{ task.text }}</strong>
                  <span>{{ task.done ? copy.doneLabel : copy.openLabel }}</span>
                </div>
                <span class="row-actions">
                  <button
                    type="button"
                    v-tool="{ id: `edit@${task.id}`, kind: 'write', desc: copy.editDesc(task.text) }"
                    @click="startEdit(task.id, task.text)"
                  >
                    {{ copy.edit }}
                  </button>
                  <button
                    type="button"
                    class="danger"
                    v-tool="{
                      id: `remove@${task.id}`,
                      kind: 'danger',
                      desc: copy.removeDesc(task.text),
                      expect: { desc: copy.taskRemovedExpect, check: () => taskRemoved(task.id) },
                    }"
                    @click="remove(task.id)"
                  >
                    {{ copy.remove }}
                  </button>
                </span>
              </template>
            </li>
          </ul>

          <p v-if="shown.length === 0" class="empty">
            {{ tasks.length === 0 ? copy.empty : copy.emptyFiltered }}
          </p>
        </section>
      </main>

      <aside class="side" aria-label="Summary">
        <div class="side__card">
          <p>{{ copy.progress }}</p>
          <strong>{{ progress }}%</strong>
          <span>{{ counts.completed }} / {{ counts.total }} {{ copy.doneLabel }}</span>
          <div class="progress" aria-hidden="true"><i :style="{ width: `${progress}%` }"></i></div>
        </div>
        <div class="side__card">
          <p>{{ copy.openLabel }}</p>
          <strong>{{ counts.open }}</strong>
          <span>{{ counts.completed }} {{ copy.doneLabel }}</span>
        </div>
        <div class="side__quote">
          <p>{{ props.locale === "zh" ? "“先决定下一步，再继续忙碌。”" : "Decide the next move before adding more motion." }}</p>
          <span>{{ copy.productNote }}</span>
        </div>
      </aside>
    </div>

    <!-- [Retrofit 05] The assistant is one surface over the same declared page actions. -->
    <AgentDock
      layout="sidebar"
      sidebar-mode="overlay"
      side="right"
      :title="copy.dockTitle"
      :placeholder="copy.dockPlaceholder"
      :quick="copy.quick"
      :debug="{ maxCalls: 8 }"
      :default-open="assistantOpen"
      @open="assistantOpen = $event"
    />
  </div>
</template>
