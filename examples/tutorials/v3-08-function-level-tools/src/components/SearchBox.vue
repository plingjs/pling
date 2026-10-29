<script setup lang="ts">
defineProps<{ modelValue: string; ariaLabel?: string; placeholder?: string }>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  search: [];
}>();

function update(event: Event): void {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="search-box">
    <span class="search-box__icon" aria-hidden="true">⌕</span>
    <input
      :value="modelValue"
      type="search"
      :aria-label="ariaLabel ?? 'Search tasks'"
      autocomplete="off"
      :placeholder="placeholder ?? 'Search tasks, then press Enter'"
      @input="update"
      @keydown.enter.prevent="emit('search')"
    />
  </div>
</template>
