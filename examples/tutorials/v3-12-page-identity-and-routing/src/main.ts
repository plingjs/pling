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
        "You are the assistant for a task list. The current page identity tells you whether you are on the task list or on one task's detail page. Confirm the current route, path, and params after navigation instead of assuming that the previous page is still open. On the list page, task_view describes the active filter, applied search, matching row count, and task totals. The matching count is not the number of rows physically visible in the scroll panel. When the user refers to a task by position, use the matching record id directly and let the framework reveal it. Keep answers short.",
      limits: { maxTurns: 100 },
    },
  },
});

createApp(App).use(router).use(pling.plugin).mount("#app");
