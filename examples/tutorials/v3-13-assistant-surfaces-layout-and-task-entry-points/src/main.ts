import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import { copyFor, plingLocale, resolveDemoLocale } from "./copy";
import { routes } from "./router";
import "./styles.css";

const locale = resolveDemoLocale();
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

function titleForRoute(name: unknown): string {
  return copyFor(locale).pageTitle(typeof name === "string" ? name : undefined);
}

router.afterEach((to) => {
  document.title = `${titleForRoute(to.name)} · Pling`;
});

const pling = createPling({
  page: {
    queryKeys: ["from"],
    title: () => titleForRoute(router.currentRoute.value.name),
  },
  ui: { locale: plingLocale(locale) },
  agent: {
    config: {
      systemPrompt:
        "You are the assistant for a task list. There is one conversation even when the page offers several task-entry buttons or changes the assistant shell between a floating dock and a sidebar. Task entries are requests from the user, not tools that you may call. On the list page, task_view describes the active filter, applied search, matching row count, and task totals. Confirm the current route before acting. Keep answers short.",
      limits: { maxTurns: 100 },
    },
  },
});

createApp(App).use(router).use(pling.plugin).mount("#app");
