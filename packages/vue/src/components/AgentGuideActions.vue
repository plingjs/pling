<script setup lang="ts">
/**
 * Vue lifecycle shell for the shared compact guide action row.
 *
 * The row is intentionally framework-neutral: `@plingjs/dom` owns the renderer,
 * so React and the vanilla adapter mount exactly the same DOM and styles. The
 * host owns commands and copy; this component only keeps the renderer in sync.
 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { createGuideActions, type GuideActionItem, type GuideActions } from "@plingjs/dom";
import { usePling } from "../directive";

const props = withDefaults(
  defineProps<{
    items: readonly GuideActionItem[];
    hint?: string;
    ariaLabel?: string;
  }>(),
  { hint: "", ariaLabel: "" },
);

const emit = defineEmits<{
  command: [command: string];
}>();

const pling = usePling();
const host = ref<HTMLElement | null>(null);
let actions: GuideActions | null = null;

function mount(): void {
  if (!host.value) return;
  actions?.destroy();
  actions = createGuideActions({
    items: props.items,
    hint: props.hint,
    ...(props.ariaLabel ? { ariaLabel: props.ariaLabel } : {}),
    locale: pling.ui.locale,
    onCommand: (command) => emit("command", command),
  });
  host.value.replaceChildren(actions.element);
}

onMounted(mount);
onBeforeUnmount(() => {
  actions?.destroy();
  actions = null;
});

watch(
  () => [props.items, props.hint, props.ariaLabel] as const,
  () => {
    actions?.update({
      items: props.items,
      hint: props.hint,
      ...(props.ariaLabel ? { ariaLabel: props.ariaLabel } : {}),
      locale: pling.ui.locale,
      onCommand: (command) => emit("command", command),
    });
  },
  { deep: true },
);
</script>

<template>
  <div ref="host" class="pling-guide-actions-host" :style="pling.ui.cssVars" />
</template>
