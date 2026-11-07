<script setup lang="ts">
/**
 * Vue lifecycle shell for the framework-agnostic guided-task renderer.
 *
 * The business owns the step copy, summary rows and command names. This
 * component only keeps the DOM renderer in sync with Vue state.
 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { TaskGuideCommand, TaskGuideDefinition, TaskRunSnapshot } from "@plingjs/agent";
import { createTaskGuide, type GuidedTaskGuide } from "@plingjs/vanilla";
import { usePling } from "../directive";

const props = withDefaults(
  defineProps<{
    definition: TaskGuideDefinition;
    snapshot?: TaskRunSnapshot | null;
    /** 1-based step number. */
    step?: number;
    busy?: boolean;
    error?: string;
    completed?: boolean;
  }>(),
  {
    snapshot: null,
    step: 1,
    busy: false,
    error: "",
    completed: false,
  },
);

const emit = defineEmits<{
  command: [command: TaskGuideCommand];
}>();

const pi = usePling();
const host = ref<HTMLElement | null>(null);
let guide: GuidedTaskGuide | null = null;
let wasCompleted = false;

function applyState(): void {
  if (!guide) return;
  if (props.completed) {
    if (!wasCompleted) {
      guide.reset();
      wasCompleted = true;
    }
    guide.setSnapshot(props.snapshot ?? null);
    guide.complete();
    return;
  }

  if (wasCompleted) {
    guide.reset();
    wasCompleted = false;
  }
  guide.setSnapshot(props.snapshot ?? null);
  guide.setStep(props.step);
  guide.setBusy(props.busy);
  guide.setError(props.error);
}

function mount(): void {
  if (!host.value) return;
  guide?.destroy();
  wasCompleted = false;
  guide = createTaskGuide({
    definition: props.definition,
    snapshot: props.snapshot ?? null,
    step: props.step,
    onCommand: (command) => emit("command", command),
  });
  host.value.replaceChildren(guide.element);
  applyState();
}

onMounted(mount);
onBeforeUnmount(() => {
  guide?.destroy();
  guide = null;
});

watch(() => props.definition, mount);
watch(() => props.snapshot, applyState);
watch(() => props.step, applyState);
watch(() => props.busy, applyState);
watch(() => props.error, applyState);
watch(() => props.completed, applyState);

defineExpose({
  refresh() {
    guide?.refresh();
  },
});
</script>

<template>
  <div ref="host" class="pling-task-guide-host" :style="pi.ui.cssVars" />
</template>

