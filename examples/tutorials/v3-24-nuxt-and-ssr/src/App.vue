<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ClientAssistant from "./ClientAssistant.vue";
import TodoList from "./TodoList.vue";
import { countTasks, createSeedTasks, type TodoCounts, type TodoListHandle } from "./todo";
import { copyFor, type DemoLocale } from "./copy";

const props = defineProps<{ locale?: DemoLocale }>();
const locale = computed<DemoLocale>(() => props.locale ?? "en");
const copy = computed(() => copyFor(locale.value));
const list = ref<TodoListHandle | null>(null);
const counts = ref<TodoCounts>(countTasks(createSeedTasks(locale.value)));
const mounted = ref(false);

onMounted(() => { mounted.value = true; });
</script>

<template>
  <main class="page">
    <TodoList ref="list" :locale="locale" @change="counts = $event" />
    <p class="client-note">{{ copy.clientNote }}</p>
    <ClientAssistant v-if="mounted" :list="list" :counts="counts" :locale="locale" />
  </main>
</template>
