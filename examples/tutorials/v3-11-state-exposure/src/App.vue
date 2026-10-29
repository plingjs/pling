<script setup lang="ts">
import { computed, nextTick, ref, watchEffect } from "vue";
import {
  AgentDock,
  useAgentState,
  useAgentTool,
  type AgentToolOptions,
  type ToolOptions,
} from "@plingjs/vue";
import BulkMenu from "./components/BulkMenu.vue";
import SearchBox from "./components/SearchBox.vue";
import TaskFilters from "./components/TaskFilters.vue";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale, type Priority } from "./copy";

type Filter = "all" | "active" | "completed";

interface Task {
  id: string;
  text: string;
  done: boolean;
  priority: Priority;
}

const MAX_TASKS = 40;

const props = defineProps<{ locale?: DemoLocale }>();
const locale = computed(() => props.locale ?? resolveDemoLocale());
const copy = computed(() => copyFor(locale.value));
const initialCopy = copyFor(props.locale ?? resolveDemoLocale());

const tasks = ref<Task[]>(
  initialCopy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task })),
);
const draft = ref("");
const priority = ref<Priority>("soon");
const filter = ref<Filter>("all");
const searchDraft = ref("");
const appliedSearch = ref("");
const editingId = ref<string | null>(null);
const editText = ref("");
const editInput = ref<HTMLInputElement | null>(null);

let sequence = initialCopy.seedTasks.length;
let lastAddedId: string | null = null;

watchEffect(() => {
  document.title = copy.value.documentTitle;
  document.documentElement.lang = plingLocale(locale.value);
});

const visibleTasks = computed(() => {
  const needle = appliedSearch.value.toLocaleLowerCase();
  return tasks.value.filter((task) => {
    if (filter.value === "active" && task.done) return false;
    if (filter.value === "completed" && !task.done) return false;
    return needle === "" || task.text.toLocaleLowerCase().includes(needle);
  });
});

const remaining = computed(
  () => tasks.value.filter((task) => !task.done).length,
);
const completed = computed(() => tasks.value.length - remaining.value);
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
  { description: copy.value.stateDescription },
);

function priorityLabel(value: Priority): string {
  return copy.value.priorities[value];
}

function addTask(text: string, nextPriority: Priority): Task | null {
  const value = text.trim();
  if (!value || tasks.value.length >= MAX_TASKS) return null;

  const task = {
    id: `t${++sequence}`,
    text: value,
    done: false,
    priority: nextPriority,
  };
  tasks.value.unshift(task);
  return task;
}

function submitDraft(): void {
  if (addTask(draft.value, priority.value)) draft.value = "";
}

function applySearch(): void {
  appliedSearch.value = searchDraft.value.trim();
}

function toggleTask(id: string): void {
  const task = tasks.value.find((item) => item.id === id);
  if (task) task.done = !task.done;
}

function removeTask(id: string): void {
  tasks.value = tasks.value.filter((task) => task.id !== id);
}

function clearCompleted(): void {
  tasks.value = tasks.value.filter((task) => !task.done);
}

function openEdit(id: string): void {
  const task = tasks.value.find((item) => item.id === id);
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

function completeOpenTasks(): number {
  const openTasks = tasks.value.filter((task) => !task.done);
  for (const task of openTasks) task.done = true;
  return openTasks.length;
}

const addTaskAction = {
  id: "add_task",
  desc: copy.value.addTaskDesc,
  kind: "write",
  params: [
    {
      name: "text",
      label: copy.value.addTaskParamLabel,
      minLength: 1,
      maxLength: 80,
      pattern: /\S/,
    },
  ],
  available: () =>
    tasks.value.length < MAX_TASKS
      ? true
      : copy.value.addTaskFull(MAX_TASKS),
  run: ({ text }: Record<string, unknown>) => {
    lastAddedId = addTask(String(text), priority.value)?.id ?? null;
  },
  expect: {
    desc: copy.value.addTaskExpect,
    check: () =>
      lastAddedId !== null &&
      tasks.value.some((task) => task.id === lastAddedId),
  },
} satisfies ToolOptions;

const selectPriorityAction = {
  id: "select_priority",
  desc: copy.value.selectPriorityDesc,
  kind: "write",
  action: "select",
  params: [
    {
      name: "value",
      label: copy.value.selectPriorityParamLabel,
      values: ["today", "soon", "later"],
    },
  ],
} satisfies ToolOptions;

const searchActions = [
  {
    id: "search_text",
    desc: copy.value.searchTextDesc,
    kind: "write",
    action: "fill",
  },
  {
    id: "search_enter",
    desc: copy.value.searchEnterDesc,
    kind: "read",
    action: "press",
    key: "Enter",
  },
] satisfies ToolOptions[];

const filterActions = [
  {
    id: "show_all_tasks",
    desc: copy.value.showAllDesc,
    kind: "read",
    action: "click",
    target: 'button[data-filter="all"]',
  },
  {
    id: "show_open_tasks",
    desc: copy.value.showOpenDesc,
    kind: "read",
    action: "click",
    target: 'button[data-filter="active"]',
  },
  {
    id: "show_completed_tasks",
    desc: copy.value.showCompletedDesc,
    kind: "read",
    action: "click",
    target: 'button[data-filter="completed"]',
  },
] satisfies ToolOptions[];

const openBulkMenuAction = {
  id: "open_bulk_menu",
  desc: copy.value.openBulkMenuDesc,
  kind: "read",
  action: "hover",
  fidelity: "high",
} satisfies ToolOptions;

const clearCompletedAction = {
  id: "clear_completed",
  desc: copy.value.clearCompletedDesc,
  kind: "danger",
} satisfies ToolOptions;

const editNoteAction = {
  id: "edit_note",
  desc: copy.value.editNoteDesc,
  kind: "write",
  action: "fill",
} satisfies ToolOptions;

const editSaveAction = {
  id: "edit_save",
  desc: copy.value.editSaveDesc,
  kind: "write",
} satisfies ToolOptions;

const editCancelAction = {
  id: "edit_cancel",
  desc: copy.value.editCancelDesc,
  kind: "read",
} satisfies ToolOptions;

const completeOpenTasksAction = {
  id: "complete_open_tasks",
  desc: copy.value.completeOpenDesc,
  kind: "write",
  available: () =>
    editingTask.value
      ? copy.value.editOpenBlocked
      : remaining.value > 0
        ? true
        : copy.value.completeOpenNone,
  run: () => ({ completed: completeOpenTasks() }),
  expect: {
    desc: copy.value.completeOpenExpect,
    check: () => remaining.value === 0,
  },
} satisfies AgentToolOptions;

useAgentTool(completeOpenTasksAction);
</script>

<template>
  <main class="page">
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
              @change="toggleTask(task.id)"
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
              @click="removeTask(task.id)"
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
            @click="clearCompleted"
          >
            {{ copy.clearCompletedLabel(completed) }}
          </button>
        </BulkMenu>
      </footer>
    </section>

    <AgentDock
      :title="copy.dockTitle"
      :quick="copy.quick"
      :debug="{ maxCalls: 8 }"
    />

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
  </main>
</template>
