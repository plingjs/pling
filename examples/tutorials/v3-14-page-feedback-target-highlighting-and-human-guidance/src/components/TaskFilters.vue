<script setup lang="ts">
type Filter = "all" | "active" | "completed";

defineProps<{
  modelValue: Filter;
  groupLabel?: string;
  labels?: { all: string; active: string; completed: string };
}>();

const emit = defineEmits<{
  "update:modelValue": [value: Filter];
}>();
</script>

<template>
  <div class="filters" role="group" :aria-label="groupLabel ?? 'Filter tasks'">
    <button
      type="button"
      data-filter="all"
      :class="{ 'is-active': modelValue === 'all' }"
      @click="emit('update:modelValue', 'all')"
    >
      {{ labels?.all ?? "All" }}
    </button>
    <button
      type="button"
      data-filter="active"
      :class="{ 'is-active': modelValue === 'active' }"
      @click="emit('update:modelValue', 'active')"
    >
      {{ labels?.active ?? "Open" }}
    </button>
    <button
      type="button"
      data-filter="completed"
      :class="{ 'is-active': modelValue === 'completed' }"
      @click="emit('update:modelValue', 'completed')"
    >
      {{ labels?.completed ?? "Done" }}
    </button>
  </div>
</template>
