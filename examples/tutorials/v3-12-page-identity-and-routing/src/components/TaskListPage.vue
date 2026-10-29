<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useRouter } from "vue-router";
import {
  useAgentState,
  useAgentTool,
  type AgentToolOptions,
  type ToolOptions,
} from "@plingjs/vue";
import BulkMenu from "./BulkMenu.vue";
import SearchBox from "./SearchBox.vue";
import TaskFilters from "./TaskFilters.vue";
import type { DemoCopy, DemoLocale, Priority } from "../copy";
import { MAX_TASKS, type Filter, type TaskStore } from "../tasks";

const props = defineProps<{
  store: TaskStore;
  copy: DemoCopy;
  locale: DemoLocale;
}>();

const router = useRouter();
const tasks = props.store.tasks;
const remaining = props.store.remaining;
const completed = props.store.completed;
const draft = ref("");
const priority = ref<Priority>("soon");
const filter = ref<Filter>("all");
const searchDraft = ref("");
const appliedSearch = ref("");
const editingId = ref<string | null>(null);
const editText = ref("");
const editInput = ref<HTMLInputElement | null>(null);
let lastAddedId: string | null = null;

const visibleTasks = computed(() => {
  const needle = appliedSearch.value.toLocaleLowerCase();
  return tasks.value.filter((task) => {
    if (filter.value === "active" && task.done) return false;
    if (filter.value === "completed" && !task.done) return false;
    return needle === "" || task.text.toLocaleLowerCase().includes(needle);
  });
});
const editingTask = computed(
  () => tasks.value.find((task) => task.id === editingId.value) ?? null,
);

useAgentState(
  "task_view",
  () => ({
    filter: filter.value,
    search: appliedSearch.value,
    matched: visibleTasks.value.length,
    total: tasks.value.length,
    open: remaining.value,
    completed: completed.value,
  }),
  { description: props.copy.stateDescription },
);

function priorityLabel(value: Priority): string {
  return props.copy.priorities[value];
}

function submitDraft(): void {
  if (props.store.addTask(draft.value, priority.value)) draft.value = "";
}

function applySearch(): void {
  appliedSearch.value = searchDraft.value.trim();
}

function openTask(id: string): void {
  const query: Record<string, string> = { from: "tasks" };
  if (props.locale === "zh") query.lang = "zh";
  void router.push({ name: "task-detail", params: { id }, query });
}

function openEdit(id: string): void {
  const task = props.store.findTask(id);
  if (!task) return;
  editingId.value = id;
  editText.value = task.text;
  void nextTick(() => {
    editInput.value?.focus();
    editInput.value?.select();
  });
}

function saveEdit(): void {
  const task = editingTask.value;
  const value = editText.value.trim();
  if (!task || !value) return;
  task.text = value;
  cancelEdit();
}

function cancelEdit(): void {
  editingId.value = null;
  editText.value = "";
}

const addTaskAction = {
  id: "add_task",
  desc: props.copy.addTaskDesc,
  kind: "write",
  params: [
    {
      name: "text",
      label: props.copy.addTaskParamLabel,
      minLength: 1,
      maxLength: 80,
      pattern: /\S/,
    },
  ],
  available: () =>
    tasks.value.length < MAX_TASKS
      ? true
      : props.copy.addTaskFull(MAX_TASKS),
  run: ({ text }: Record<string, unknown>) => {
    lastAddedId = props.store.addTask(String(text), priority.value)?.id ?? null;
  },
  expect: {
    desc: props.copy.addTaskExpect,
    check: () =>
      lastAddedId !== null &&
      tasks.value.some((task) => task.id === lastAddedId),
  },
} satisfies ToolOptions;

const selectPriorityAction = {
  id: "select_priority",
  desc: props.copy.selectPriorityDesc,
  kind: "write",
  action: "select",
  params: [
    {
      name: "value",
      label: props.copy.selectPriorityParamLabel,
      values: ["today", "soon", "later"],
    },
  ],
} satisfies ToolOptions;

const searchActions = [
  {
    id: "search_text",
    desc: props.copy.searchTextDesc,
    kind: "write",
    action: "fill",
  },
  {
    id: "search_enter",
    desc: props.copy.searchEnterDesc,
    kind: "read",
    action: "press",
    key: "Enter",
  },
] satisfies ToolOptions[];

const filterActions = [
  {
    id: "show_all_tasks",
    desc: props.copy.showAllDesc,
    kind: "read",
    action: "click",
    target: 'button[data-filter="all"]',
  },
  {
    id: "show_open_tasks",
    desc: props.copy.showOpenDesc,
    kind: "read",
    action: "click",
    target: 'button[data-filter="active"]',
  },
  {
    id: "show_completed_tasks",
    desc: props.copy.showCompletedDesc,
    kind: "read",
    action: "click",
    target: 'button[data-filter="completed"]',
  },
] satisfies ToolOptions[];

const openBulkMenuAction = {
  id: "open_bulk_menu",
  desc: props.copy.openBulkMenuDesc,
  kind: "read",
  action: "hover",
  fidelity: "high",
} satisfies ToolOptions;

const clearCompletedAction = {
  id: "clear_completed",
  desc: props.copy.clearCompletedDesc,
  kind: "danger",
} satisfies ToolOptions;

const editNoteAction = {
  id: "edit_note",
  desc: props.copy.editNoteDesc,
  kind: "write",
  action: "fill",
} satisfies ToolOptions;

const editSaveAction = {
  id: "edit_save",
  desc: props.copy.editSaveDesc,
  kind: "write",
} satisfies ToolOptions;

const editCancelAction = {
  id: "edit_cancel",
  desc: props.copy.editCancelDesc,
  kind: "read",
} satisfies ToolOptions;

const completeOpenTasksAction = {
  id: "complete_open_tasks",
  desc: props.copy.completeOpenDesc,
  kind: "write",
  available: () =>
    editingTask.value
      ? props.copy.editOpenBlocked
      : remaining.value > 0
        ? true
        : props.copy.completeOpenNone,
  run: () => ({ completed: props.store.completeOpenTasks() }),
  expect: {
    desc: props.copy.completeOpenExpect,
    check: () => remaining.value === 0,
  },
} satisfies AgentToolOptions;

useAgentTool(completeOpenTasksAction);
</script>

<template>
  <section
    class="todo"
    :inert="editingTask ? true : undefined"
    :aria-hidden="editingTask ? 'true' : undefined"
    v-scope="{
      id: 'todo',
      label: copy.todoRegionLabel,
      description: copy.todoRegionDescription,
      role: 'main',
    }"
  >
    <header class="todo__header">
      <div>
        <p class="todo__eyebrow">{{ copy.eyebrow }}</p>
        <h1>{{ copy.heading }}</h1>
      </div>
      <p class="todo__count">
        {{ copy.stats(remaining, completed) }}
        <span v-if="appliedSearch"> · “{{ appliedSearch }}”</span>
      </p>
    </header>

    <form
      class="composer"
      v-scope="{
        id: 'composer',
        label: copy.composerRegionLabel,
        description: copy.composerRegionDescription,
        role: 'form',
      }"
      v-tool="addTaskAction"
      @submit.prevent="submitDraft"
    >
      <label class="composer__label" for="new-task">{{ copy.newTaskLabel }}</label>
      <div class="composer__row">
        <input
          id="new-task"
          v-model="draft"
          autocomplete="off"
          maxlength="80"
          :placeholder="copy.newTaskPlaceholder"
        />
        <select
          id="task-priority"
          v-model="priority"
          :aria-label="copy.priorityAria"
          v-tool="selectPriorityAction"
        >
          <option value="today">{{ copy.priorities.today }}</option>
          <option value="soon">{{ copy.priorities.soon }}</option>
          <option value="later">{{ copy.priorities.later }}</option>
        </select>
        <button
          type="submit"
          :disabled="draft.trim() === '' || tasks.length >= MAX_TASKS"
        >
          {{ copy.addTask }}
        </button>
      </div>
    </form>

    <SearchBox
      v-model="searchDraft"
      v-tool="searchActions"
      :aria-label="copy.searchLabel"
      :placeholder="copy.searchPlaceholder"
      @search="applySearch"
    />

    <ul
      class="tasks"
      tabindex="0"
      :aria-label="copy.listRegionLabel"
      v-scope="{
        id: 'task_list',
        label: copy.listRegionLabel,
        description: copy.listRegionDescription,
        role: 'list',
      }"
    >
      <li
        v-for="task in visibleTasks"
        :key="task.id"
        :class="{ 'is-done': task.done }"
        v-record="{
          data: task,
          fields: {
            text: task.text,
            status: task.done ? 'completed' : 'open',
            priority: priorityLabel(task.priority),
          },
        }"
      >
        <label class="tasks__check">
          <input
            type="checkbox"
            :checked="task.done"
            v-tool="{
              id: `toggle@${task.id}`,
              desc: copy.toggleTaskDesc(task.text, task.done),
              kind: 'write',
            }"
            @change="store.toggleTask(task.id)"
          />
          <span class="tasks__body">
            <span class="tasks__text">{{ task.text }}</span>
            <span class="tasks__priority" :class="`priority--${task.priority}`">
              {{ priorityLabel(task.priority) }}
            </span>
          </span>
        </label>
        <div class="tasks__actions">
          <button
            class="tasks__open"
            type="button"
            :aria-label="copy.openTaskLabel(task.text)"
            v-tool="{
              id: `open@${task.id}`,
              desc: copy.openTaskDesc(task.text),
              kind: 'read',
            }"
            @click="openTask(task.id)"
          >
            ›
          </button>
          <button
            class="tasks__edit"
            type="button"
            :aria-label="copy.editTaskLabel(task.text)"
            v-tool="{
              id: `edit@${task.id}`,
              desc: copy.editTaskDesc(task.text),
              kind: 'read',
            }"
            @click="openEdit(task.id)"
          >
            ✎
          </button>
          <button
            class="tasks__remove"
            type="button"
            :aria-label="copy.deleteTask(task.text)"
            v-tool="{
              id: `remove@${task.id}`,
              desc: copy.removeTaskDesc(task.text),
              kind: 'danger',
            }"
            @click="store.removeTask(task.id)"
          >
            ×
          </button>
        </div>
      </li>
    </ul>

    <p v-if="visibleTasks.length === 0" class="tasks__empty">
      {{ copy.empty }}
    </p>

    <footer
      class="todo__footer"
      v-scope="{
        id: 'view_controls',
        label: copy.controlsRegionLabel,
        description: copy.controlsRegionDescription,
        role: 'toolbar',
      }"
    >
      <TaskFilters
        v-model="filter"
        v-tool="filterActions"
        :labels="copy.filters"
        :group-label="copy.filterGroupLabel"
      />

      <BulkMenu v-tool="openBulkMenuAction" :label="copy.bulkLabel">
        <button
          class="todo__clear"
          type="button"
          :disabled="completed === 0"
          v-tool="clearCompletedAction"
          @click="store.clearCompleted"
        >
          {{ copy.clearCompletedLabel(completed) }}
        </button>
      </BulkMenu>
    </footer>
  </section>

  <div
    v-if="editingTask"
    class="overlay"
    v-scope="{
      id: 'edit_dialog',
      label: copy.editDialogLabel,
      description: copy.editDialogDescription,
      role: 'dialog',
      parent: 'todo',
    }"
    @click.self="cancelEdit"
  >
    <section
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-title"
      @keydown.esc.stop="cancelEdit"
    >
      <h2 id="edit-task-title">{{ copy.editDialogTitle(editingTask.text) }}</h2>
      <label class="dialog__label" for="edit-task-text">{{ copy.editNoteLabel }}</label>
      <input
        id="edit-task-text"
        ref="editInput"
        v-model="editText"
        maxlength="80"
        autocomplete="off"
        :placeholder="copy.editNotePlaceholder"
        v-tool="editNoteAction"
      />
      <div class="dialog__actions">
        <button
          class="dialog__cancel"
          type="button"
          v-tool="editCancelAction"
          @click="cancelEdit"
        >
          {{ copy.editCancel }}
        </button>
        <button
          class="dialog__save"
          type="button"
          :disabled="editText.trim() === ''"
          v-tool="editSaveAction"
          @click="saveEdit"
        >
          {{ copy.editSave }}
        </button>
      </div>
    </section>
  </div>
</template>
