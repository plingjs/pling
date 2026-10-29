import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import { createPling } from "@plingjs/vue";
import App from "./App.vue";
import { copyFor, resolveDemoLocale } from "./copy";
import { routes } from "./router";
import { createAccountStore } from "./store";
import "./styles.css";

const locale = resolveDemoLocale();
const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

function titleFor(name: unknown): string {
  const copy = copyFor(locale);
  if (name === "account-detail") return copy.accountDetail;
  if (name === "activity") return copy.activityTitle;
  return copy.title;
}

router.afterEach((to) => {
  document.title = `${titleFor(to.name)} · Pling`;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
});

const pling = createPling({
  page: { queryKeys: ["lang"] },
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  onWarn: (message) => console.warn(message),
  agent: {
    config: {
      systemPrompt:
        "You operate an account review workspace. The current page identity is authoritative: read the route name, path and params before acting, and confirm the new page after navigation. Use stable account ids from records. On the list route, account_list_view describes the active risk filter, search and matched count. On a detail route, use account.update_status or account.save_note with the current account id. Do not assume that a previous page is still open. Answer in the user's language and keep responses brief.",
      minActionIntervalMs: 320,
      limits: { maxTurns: 100 },
    },
  },
});

createApp(App, { locale, store: createAccountStore(locale) })
  .use(router)
  .use(pling.plugin)
  .mount("#app");
