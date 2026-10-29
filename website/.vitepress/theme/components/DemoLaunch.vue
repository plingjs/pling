<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";

const props = defineProps<{
  href: string;
  label?: string;
  labelZh?: string;
}>();

const { lang } = useData();
const isZh = computed(() => lang.value.startsWith("zh"));
const text = computed(() => (isZh.value ? props.labelZh ?? "打开在线案例" : props.label ?? "Open live example"));
</script>

<template>
  <div class="demo-launch">
    <a class="demo-launch__button" :href="href" target="_blank" rel="noopener noreferrer">
      {{ text }} <span aria-hidden="true">↗</span>
    </a>
  </div>
</template>

<style scoped>
.demo-launch {
  margin: 24px 0 34px;
}

.demo-launch__button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid var(--pling-line-strong);
  border-radius: 9px;
  background: var(--pling-wash);
  color: var(--pling-accent-ink);
  font-size: 14px;
  font-weight: 650;
  text-decoration: none;
  transition:
    border-color 140ms ease,
    background-color 140ms ease;
}

.demo-launch__button:hover {
  border-color: var(--pling-accent);
  background: #e2f2ff;
}
</style>
