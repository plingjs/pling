<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  description: string;
}>();
</script>

<template>
  <main class="page">
    <header class="masthead">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p class="lede">{{ description }}</p>
      </div>
      <div class="toolbar"><slot name="actions" /></div>
    </header>
    <slot />
  </main>
</template>
