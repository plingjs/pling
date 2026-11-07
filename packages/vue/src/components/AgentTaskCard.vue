<script setup lang="ts">
/**
 * Conversation-sized guided-task card.
 *
 * This is a Vue lifecycle shell over the shared DOM renderer. Fields, lookup,
 * confirmation, handoff, and the run state machine stay in `@plingjs/agent` /
 * `@plingjs/vanilla`; this component only mounts and disposes that view.
 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type {
  TaskBinding,
  TaskController,
  TaskRunSnapshot,
  TaskValues,
} from "@plingjs/agent";
import { createTaskCard, type GuidedTaskPanel } from "@plingjs/vanilla";
import { usePling } from "../directive";

const props = withDefaults(
  defineProps<{
    controller: TaskController;
    /** Optional heading override. Task titles still come from the definition. */
    title?: string;
    /** Show the registered tasks when no run is active. */
    catalog?: boolean;
  }>(),
  { catalog: true },
);

const emit = defineEmits<{
  prompt: [prompt: string, snapshot: TaskRunSnapshot];
  complete: [snapshot: TaskRunSnapshot];
}>();

const pi = usePling();
const host = ref<HTMLElement | null>(null);
let panel: GuidedTaskPanel | null = null;

function mount(): void {
  if (!host.value) return;
  panel?.destroy();
  panel = createTaskCard(props.controller, {
    locale: pi.ui.locale,
    t: pi.ui.t,
    ...(props.title ? { title: props.title } : {}),
    catalog: props.catalog,
    onPrompt: (prompt, snapshot) => emit("prompt", prompt, snapshot),
    onComplete: (snapshot) => emit("complete", snapshot),
  });
  host.value.replaceChildren(panel.element);
}

function unmount(): void {
  panel?.destroy();
  panel = null;
}

onMounted(mount);
onBeforeUnmount(unmount);
watch(() => props.controller, mount);
watch(() => pi.ui.locale, mount);
watch(
  () => props.title,
  () => mount(),
);
watch(
  () => props.catalog,
  (visible) => panel?.setCatalog(visible),
);

defineExpose({
  open(taskId: string, values?: TaskValues, binding?: TaskBinding) {
    panel?.open(taskId, values, binding);
  },
  close() {
    panel?.close();
  },
  refresh() {
    panel?.refresh();
  },
  setCatalog(visible: boolean) {
    panel?.setCatalog(visible);
  },
});
</script>

<template>
  <div ref="host" class="pling-task-card-host" :style="pi.ui.cssVars" />
</template>
