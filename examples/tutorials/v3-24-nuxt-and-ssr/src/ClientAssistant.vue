<script setup lang="ts">
import { computed } from "vue";
import { AgentDock, useAgentState, useAgentTool } from "@plingjs/vue";
import { copyFor, type DemoLocale } from "./copy";
import type { TodoCounts, TodoListHandle } from "./todo";

const props = defineProps<{
  list: TodoListHandle | null;
  counts: TodoCounts;
  locale: DemoLocale;
}>();

const copy = computed(() => copyFor(props.locale));

useAgentState("todo_ssr", () => ({ ...props.counts }), {
  description: copy.value.overview,
});

useAgentTool({
  id: "todo.overview",
  desc: copy.value.overview,
  kind: "read",
  run: () => props.list?.snapshot() ?? { ...props.counts, records: [] },
});

useAgentTool({
  id: "todo.add",
  desc: copy.value.addDescription,
  kind: "write",
  params: [{ name: "text", label: copy.value.taskLabel, minLength: 1, maxLength: 80 }],
  run: ({ text }: Record<string, unknown>) => props.list?.add(String(text)),
});

useAgentTool({
  id: "todo.clear_completed",
  desc: copy.value.clearDescription,
  kind: "danger",
  confirm: "always",
  run: () => props.list?.clearCompleted(),
});
</script>

<template>
  <AgentDock :title="copy.dockTitle" :quick="[...copy.quick]" :debug="{ maxCalls: 8 }" />
</template>
