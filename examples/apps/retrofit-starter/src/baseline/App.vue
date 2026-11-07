<script setup lang="ts">
import { computed, ref } from "vue";
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
const toast = ref("");

const counts = computed(() => countTodos(tasks.value));
const shown = computed(() => visibleTodos(tasks.value, filter.value));
const full = computed(() => tasks.value.length >= MAX_TODOS);
const progress = computed(() => (counts.value.total === 0 ? 0 : Math.round((counts.value.completed / counts.value.total) * 100)));

function submit(): void {
  if (!draft.value.trim() || full.value) return;
  tasks.value = addTodo(tasks.value, draft.value);
  draft.value = "";
  toast.value = "";
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
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/baseline/">
        <span class="brand__mark" aria-hidden="true">π</span>
        <span class="brand__name">{{ copy.product }}</span>
        <span class="brand__note">{{ copy.productNote }}</span>
      </a>
      <span class="mode">{{ copy.baselineBadge }}</span>
    </header>

    <div class="workspace">
      <main>
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
              />
              <button class="primary" type="submit" :disabled="!draft.trim() || full">
                {{ copy.add }}
              </button>
            </div>
          </form>

          <div class="toolbar">
            <div class="filters" role="group" :aria-label="copy.filterLabel">
              <button type="button" :class="{ 'is-active': filter === 'all' }" @click="setFilter('all')">
                {{ copy.filterAll }}
              </button>
              <button type="button" :class="{ 'is-active': filter === 'open' }" @click="setFilter('open')">
                {{ copy.filterOpen }}
              </button>
              <button type="button" :class="{ 'is-active': filter === 'completed' }" @click="setFilter('completed')">
                {{ copy.filterCompleted }}
              </button>
            </div>
            <button class="clear" type="button" :disabled="counts.completed === 0" @click="clearCompleted">
              {{ copy.clearCompleted(counts.completed) }}
            </button>
          </div>

          <p class="toast" role="status">{{ full ? copy.fullReason : toast }}</p>

          <ul class="task-list">
            <li v-for="task in shown" :key="task.id" class="task-row" :class="{ 'is-done': task.done }">
              <template v-if="editingId === task.id">
                <span aria-hidden="true"></span>
                <input
                  v-model="editDraft"
                  class="edit-input"
                  :aria-label="copy.editTextDesc(task.text)"
                  :maxlength="80"
                  @keydown.enter.prevent="saveEdit(task.id)"
                  @keydown.esc="cancelEdit"
                />
                <span class="row-actions">
                  <button type="button" :disabled="!editDraft.trim()" @click="saveEdit(task.id)">{{ copy.save }}</button>
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
                  @click="toggle(task.id)"
                />
                <div class="task-copy">
                  <strong>{{ task.text }}</strong>
                  <span>{{ task.done ? copy.doneLabel : copy.openLabel }}</span>
                </div>
                <span class="row-actions">
                  <button type="button" @click="startEdit(task.id, task.text)">{{ copy.edit }}</button>
                  <button type="button" class="danger" @click="remove(task.id)">{{ copy.remove }}</button>
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
  </div>
</template>
