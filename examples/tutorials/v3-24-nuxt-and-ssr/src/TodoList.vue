<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { countTasks, createSeedTasks, type Task, type TodoCounts } from "./todo";
import { copyFor, type DemoLocale } from "./copy";

const props = defineProps<{ locale: DemoLocale }>();
const emit = defineEmits<{ change: [counts: TodoCounts] }>();
const copy = computed(() => copyFor(props.locale));
const tasks = ref<Task[]>(createSeedTasks(props.locale));
const draft = ref("");
const counts = computed(() => countTasks(tasks.value));
let sequence = 3;

watch(counts, (value) => emit("change", { ...value }), { immediate: true });

function submitDraft(): void {
  const text = draft.value.trim();
  if (!text) return;
  tasks.value = [{ id: `t${++sequence}`, text, done: false }, ...tasks.value];
  draft.value = "";
}

function toggle(id: string): void {
  tasks.value = tasks.value.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
}

function clearCompleted(): void {
  tasks.value = tasks.value.filter((task) => !task.done);
}

function add(text: string): void {
  const value = text.trim();
  if (!value) return;
  tasks.value = [{ id: `t${++sequence}`, text: value, done: false }, ...tasks.value];
}

defineExpose({
  add,
  toggle,
  clearCompleted,
  snapshot: () => ({
    ...counts.value,
    records: tasks.value.map((task) => ({ id: task.id, text: task.text, done: task.done })),
  }),
});
</script>

<template>
  <section class="todo">
    <header class="head">
      <div>
        <p class="eyebrow">{{ copy.eyebrow }}</p>
        <h1>{{ copy.title }}</h1>
        <p class="lead">{{ copy.lead }}</p>
      </div>
      <span class="counter">{{ copy.counter(counts.open) }}</span>
    </header>

    <form class="composer" @submit.prevent="submitDraft">
      <input v-model="draft" :placeholder="copy.newTask" :aria-label="copy.newTask" maxlength="80" />
      <button type="submit">{{ copy.add }}</button>
    </form>

    <ul class="tasks">
      <li v-for="task in tasks" :key="task.id" :class="{ done: task.done }">
        <label>
          <input type="checkbox" :checked="task.done" @change="toggle(task.id)" />
          <span>{{ task.text }}</span>
        </label>
      </li>
    </ul>

    <div class="footer">
      <button type="button" @click="clearCompleted">{{ copy.clear }}</button>
      <span>{{ copy.completed(counts.completed) }}</span>
    </div>
  </section>
</template>
