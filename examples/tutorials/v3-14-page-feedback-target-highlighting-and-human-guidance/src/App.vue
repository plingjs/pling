<script setup lang="ts">
import { computed, watchEffect } from "vue";
import { RouterView } from "vue-router";
import { AgentDock } from "@plingjs/vue";
import PublishPanel from "./components/PublishPanel.vue";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale } from "./copy";
import { createTaskStore } from "./tasks";

const props = defineProps<{ locale?: DemoLocale }>();
const locale = computed(() => props.locale ?? resolveDemoLocale());
const copy = computed(() => copyFor(locale.value));
const store = createTaskStore(copyFor(props.locale ?? resolveDemoLocale()));

watchEffect(() => {
  document.documentElement.lang = plingLocale(locale.value);
});
</script>

<template>
  <main class="page">
    <PublishPanel :locale="locale" />

    <RouterView v-slot="{ Component }">
      <component :is="Component" :store="store" :copy="copy" :locale="locale" />
    </RouterView>

    <AgentDock :title="copy.dockTitle" :quick="copy.quick" :debug="{ maxCalls: 8 }" />
  </main>
</template>
