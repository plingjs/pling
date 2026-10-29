import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import { resolveLocale } from "../../../recipe-shared/locale";
import "../../../recipe-shared/styles.css";

const locale = resolveLocale();
const pling = createPling({ ui: { locale: locale === "zh" ? "zh-CN" : "en-US" }, agent: { config: { limits: { maxTurns: 100 } } } });
createApp(App).use(pling.plugin).mount("#app");
