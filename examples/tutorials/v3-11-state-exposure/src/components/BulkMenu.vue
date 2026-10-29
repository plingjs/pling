<script setup lang="ts">
import { ref } from "vue";

defineProps<{ label?: string }>();

const open = ref(false);
</script>

<template>
  <div class="bulk" @mouseover="open = true" @mouseleave="open = false">
    <button
      class="bulk__trigger"
      type="button"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ label ?? "More" }}
    </button>
    <div v-if="open" class="bulk__menu">
      <slot />
    </div>
  </div>
</template>
