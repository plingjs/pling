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
  presence: { effect: "spotlight" },
  page: {
    queryKeys: ["from"],
    title: () => titleForRoute(router.currentRoute.value.name),
  },
  ui: { locale: plingLocale(locale) },
  agent: {
    config: {
      systemPrompt:
        "You are the assistant for a task list with a workspace release form. Dangerous actions may require approval before execution. Some steps require a human handoff: call the declared action, explain why the user must act, and wait for the result. Do not repeat a denied action or guess a verification code. Keep answers short.",
      limits: { maxTurns: 100 },
    },
  },
});

createApp(App).use(router).use(pling.plugin).mount("#app");
