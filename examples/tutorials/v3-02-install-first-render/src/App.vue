<script setup lang="ts">
import { computed, watchEffect } from "vue";
import { AgentDock } from "@plingjs/vue";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale } from "./copy";

const props = defineProps<{ locale?: DemoLocale }>();
const locale = computed(() => props.locale ?? resolveDemoLocale());
const copy = computed(() => copyFor(locale.value));
const checks = computed(() => copy.value.checks.map((label, index) => ({ label, done: index < 3 })));

watchEffect(() => {
  document.title = copy.value.documentTitle;
  document.documentElement.lang = plingLocale(locale.value);
});
</script>

<template>
  <main class="page" :data-locale="locale">
    <section class="setup">
      <header class="setup__header">
        <div>
          <p class="setup__eyebrow">{{ copy.eyebrow }}</p>
          <h1>{{ copy.heading }}</h1>
        </div>
        <span class="setup__count">{{ copy.actionCount }}</span>
      </header>

      <p class="setup__lead">{{ copy.lead }}</p>

      <ol class="checks">
        <li v-for="check in checks" :key="check.label" :class="{ 'is-pending': !check.done }">
          <span class="checks__mark" aria-hidden="true">{{ check.done ? "✓" : "→" }}</span>
          <span>{{ check.label }}</span>
        </li>
      </ol>

      <aside class="next">
        <strong>{{ copy.nextLabel }}</strong> {{ copy.nextText }}
      </aside>
    </section>

    <AgentDock :title="copy.dockTitle" :quick="copy.quick" />
  </main>
</template>
