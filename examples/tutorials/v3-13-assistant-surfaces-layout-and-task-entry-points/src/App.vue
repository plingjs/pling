<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { RouterView } from "vue-router";
import { AgentDock, usePling } from "@plingjs/vue";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale } from "./copy";
import { createTaskStore } from "./tasks";

const props = defineProps<{ locale?: DemoLocale }>();
const locale = computed(() => props.locale ?? resolveDemoLocale());
const copy = computed(() => copyFor(locale.value));
const store = createTaskStore(copyFor(props.locale ?? resolveDemoLocale()));
const pling = usePling();
const layout = ref<"dock" | "sidebar">("dock");
const side = ref<"right" | "left">("right");
const launcherPlacement = ref<"bottom" | "center">("bottom");

watchEffect(() => {
  document.documentElement.lang = plingLocale(locale.value);
});

function askFromPage(): void {
  void pling.ask(copy.value.pageQuestion).catch(() => undefined);
}
</script>

<template>
  <main class="page">
    <section class="surface-settings" aria-labelledby="surface-settings-title">
      <div>
        <p class="surface-settings__eyebrow">{{ copy.surfaceEyebrow }}</p>
        <h1 id="surface-settings-title">{{ copy.surfaceHeading }}</h1>
        <p class="surface-settings__lead">{{ copy.surfaceDescription }}</p>
      </div>

      <div class="surface-settings__controls">
        <fieldset>
          <legend>{{ copy.layoutLabel }}</legend>
          <label>
            <input v-model="layout" type="radio" value="dock" />
            {{ copy.layoutDock }}
          </label>
          <label>
            <input v-model="layout" type="radio" value="sidebar" />
            {{ copy.layoutSidebar }}
          </label>
        </fieldset>

        <fieldset v-if="layout === 'sidebar'">
          <legend>{{ copy.sideLabel }}</legend>
          <label>
            <input v-model="side" type="radio" value="right" />
            {{ copy.sideRight }}
          </label>
          <label>
            <input v-model="side" type="radio" value="left" />
            {{ copy.sideLeft }}
          </label>
        </fieldset>

        <fieldset v-if="layout === 'sidebar'">
          <legend>{{ copy.launcherLabel }}</legend>
          <label>
            <input v-model="launcherPlacement" type="radio" value="bottom" />
            {{ copy.launcherBottom }}
          </label>
          <label>
            <input v-model="launcherPlacement" type="radio" value="center" />
            {{ copy.launcherCenter }}
          </label>
        </fieldset>
      </div>

      <div class="surface-settings__tasks" :aria-label="copy.taskEntryLabel">
        <button
          type="button"
          class="smart-action"
          data-task-entry="summarize"
          v-task="copy.openTasksPrompt"
        >
          ✦ {{ copy.openTasksTask }}
        </button>
        <button type="button" class="smart-action" data-task-entry="ask" @click="askFromPage">
          ✦ {{ copy.askTask }}
        </button>
      </div>
    </section>

    <RouterView v-slot="{ Component }">
      <component :is="Component" :store="store" :copy="copy" :locale="locale" />
    </RouterView>

    <AgentDock
      :title="copy.dockTitle"
      :quick="copy.quick"
      :layout="layout"
      :side="side"
      :launcher-placement="launcherPlacement"
      :launcher-label="copy.launcherText"
      :debug="{ maxCalls: 8 }"
    />
  </main>
</template>
