<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAgentState } from "@plingjs/vue";
import type { DemoCopy, DemoLocale } from "../copy";
import type { TaskStore } from "../tasks";

const props = defineProps<{
  store: TaskStore;
  copy: DemoCopy;
  locale: DemoLocale;
}>();

const route = useRoute();
const router = useRouter();
const id = computed(() => {
  const value = route.params.id;
  return Array.isArray(value) ? (value[0] ?? "") : String(value ?? "");
});
const task = computed(() => props.store.findTask(id.value));
let expectedDone: boolean | undefined;

useAgentState(
  "task_detail",
  () => ({
    id: id.value,
    found: Boolean(task.value),
    status: task.value ? (task.value.done ? "completed" : "open") : null,
    priority: task.value?.priority ?? null,
  }),
  { description: props.copy.detailStateDescription },
);

function backToTasks(): void {
  const query: Record<string, string> = {};
  if (props.locale === "zh") query.lang = "zh";
  void router.push({ name: "tasks", query });
}

function toggleTask(): void {
  const current = task.value;
  if (!current) return;
  expectedDone = !current.done;
  props.store.toggleTask(current.id);
}

const backAction = {
  id: "back_to_tasks",
  desc: props.copy.backToTasksDesc,
  kind: "read",
  run: backToTasks,
};

const toggleAction = computed(() => ({
  id: "toggle_task_status",
  desc: task.value
    ? props.copy.toggleDetailDesc(task.value.text, task.value.done)
    : props.copy.missingTask,
  kind: "write",
  available: () => (task.value ? true : props.copy.missingTask),
  run: toggleTask,
  expect: {
    desc: props.copy.toggleDetailExpect,
    check: () => task.value?.done === expectedDone,
  },
}));
</script>

<template>
  <section
    v-if="task"
    class="detail"
    v-scope="{
      id: 'task_detail',
      label: copy.detailRegionLabel,
      description: copy.detailRegionDescription,
      role: 'page',
    }"
  >
    <header class="detail__head">
      <button
        class="detail__back"
        type="button"
        v-tool="backAction"
        @click="backToTasks"
      >
        ← {{ copy.backToTasks }}
      </button>
      <p class="todo__eyebrow">{{ copy.detailEyebrow }}</p>
      <h1>{{ task.text }}</h1>
      <p class="detail__path">{{ copy.detailPathHint(id) }}</p>
    </header>

    <div
      class="detail__card"
      v-record="{
        data: task,
        fields: {
          text: task.text,
          status: task.done ? 'completed' : 'open',
          priority: copy.priorities[task.priority],
        },
      }"
    >
      <dl>
        <div>
          <dt>{{ copy.detailIdLabel }}</dt>
          <dd><code>{{ task.id }}</code></dd>
        </div>
        <div>
          <dt>{{ copy.detailStatusLabel }}</dt>
          <dd>{{ task.done ? copy.statusCompleted : copy.statusOpen }}</dd>
        </div>
        <div>
          <dt>{{ copy.detailPriorityLabel }}</dt>
          <dd>{{ copy.priorities[task.priority] }}</dd>
        </div>
      </dl>

      <button
        class="detail__toggle"
        type="button"
        v-tool="toggleAction"
        @click="toggleTask"
      >
        {{ task.done ? copy.markOpen : copy.markCompleted }}
      </button>
    </div>
  </section>

  <section
    v-else
    class="detail detail--missing"
    v-scope="{
      id: 'task_missing',
      label: copy.missingTask,
      description: copy.missingTaskDescription,
      role: 'page',
    }"
  >
    <h1>{{ copy.missingTask }}</h1>
    <p>{{ copy.missingTaskBody(id) }}</p>
    <button
      class="detail__back"
      type="button"
      v-tool="backAction"
      @click="backToTasks"
    >
      ← {{ copy.backToTasks }}
    </button>
  </section>
</template>
