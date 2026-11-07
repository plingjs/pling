import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import { resolveLocale } from "../shared/copy";
import "../shared/app.css";

const locale = resolveLocale();
const pling = createPling({
  namespace: "northstar",
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  diagnostics: false,
  agent: {
    config: { minActionIntervalMs: 420, limits: { maxTurns: 100 } },
    trace: true,
  },
  onWarn: (message) => console.warn(message),
});

createApp(App, { locale }).use(pling.plugin).mount("#app");
