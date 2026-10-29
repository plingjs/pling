<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { AgentDock } from "@plingjs/vue";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale } from "./copy";

type Filter = "all" | "active" | "completed";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const MAX_TASKS = 8;

const props = defineProps<{ locale?: DemoLocale }>();
const locale = computed(() => props.locale ?? resolveDemoLocale());
const copy = computed(() => copyFor(locale.value));
const initialCopy = copyFor(props.locale ?? resolveDemoLocale());

const tasks = ref<Task[]>(
  initialCopy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task })),
);
const draft = ref("");
const filter = ref<Filter>("all");

let sequence = 3;

watchEffect(() => {
  document.title = copy.value.documentTitle;
  document.documentElement.lang = plingLocale(locale.value);
});

const visibleTasks = computed(() => {
  if (filter.value === "active") return tasks.value.filter((task) => !task.done);
  if (filter.value === "completed") return tasks.value.filter((task) => task.done);
  return tasks.value;
});

const remaining = computed(() => tasks.value.filter((task) => !task.done).length);
const completed = computed(() => tasks.value.length - remaining.value);

function addTask(text: string): Task | null {
  const value = text.trim();
  if (!value || tasks.value.length >= MAX_TASKS) return null;

  const task = { id: `t${++sequence}`, text: value, done: false };
  tasks.value.unshift(task);
  return task;
}

function submitDraft(): void {
  if (addTask(draft.value)) draft.value = "";
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
</script>

<template>
  <main class="page">
    <section
      class="todo"
      v-scope="{
        id: 'todo',
        label: copy.regionLabel,
        description: copy.regionDescription,
        role: 'main',
      }"
    >
      <header class="todo__header">
        <div>
        <p class="todo__eyebrow">{{ copy.eyebrow }}</p>
          <h1>{{ copy.heading }}</h1>
        </div>
        <p class="todo__count">{{ copy.stats(remaining, completed) }}</p>
      </header>

      <form class="composer" @submit.prevent="submitDraft">
        <label class="composer__label" for="new-task">{{ copy.newTaskLabel }}</label>
        <div class="composer__row">
          <input
            id="new-task"
            v-model="draft"
            v-tool="{
              id: 'composer_text',
              desc: copy.composerTextDesc,
              kind: 'write',
            }"
            autocomplete="off"
            maxlength="80"
            :placeholder="copy.newTaskPlaceholder"
          />
          <button
            type="submit"
            v-tool="{
              id: 'composer_submit',
              desc: copy.composerSubmitDesc,
              kind: 'write',
            }"
            :disabled="draft.trim() === '' || tasks.length >= MAX_TASKS"
          >
            {{ copy.addTask }}
          </button>
        </div>
      </form>

      <ul class="tasks">
        <li
          v-for="task in visibleTasks"
          :key="task.id"
          :class="{ 'is-done': task.done }"
          v-record="{
            data: task,
            fields: {
              text: task.text,
              status: task.done ? 'completed' : 'open',
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
            <span>{{ task.text }}</span>
          </label>
          <button class="tasks__remove" type="button" :aria-label="copy.deleteTask(task.text)" @click="removeTask(task.id)">
            ×
          </button>
        </li>
      </ul>

      <p v-if="visibleTasks.length === 0" class="tasks__empty">{{ copy.empty }}</p>

      <footer class="todo__footer">
        <div class="filters" :aria-label="copy.filterGroupLabel">
          <button type="button" :class="{ 'is-active': filter === 'all' }" @click="filter = 'all'">{{ copy.filters.all }}</button>
          <button type="button" :class="{ 'is-active': filter === 'active' }" @click="filter = 'active'">{{ copy.filters.active }}</button>
          <button type="button" :class="{ 'is-active': filter === 'completed' }" @click="filter = 'completed'">{{ copy.filters.completed }}</button>
        </div>
        <button class="todo__clear" type="button" :disabled="completed === 0" @click="clearCompleted">
          {{ copy.clearCompleted }}
        </button>
      </footer>
    </section>

    <AgentDock
      :title="copy.dockTitle"
      :quick="copy.quick"
    />
  </main>
</template>
