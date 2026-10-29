import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import App from "./App.vue";
import { resolveLocale } from "../../../recipe-shared/locale";
import "../../../recipe-shared/styles.css";

const locale = resolveLocale();
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  agent: {
    config: { limits: { maxTurns: 100 } },
    continuity: { key: "recipe-continuity", resume: "auto", returnOnDone: true },
  },
});
createApp(App).use(pling.plugin).mount("#app");
