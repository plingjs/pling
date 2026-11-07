import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import { resolveLocale } from "../shared/copy";
import "../shared/app.css";

const locale = resolveLocale();
const pling = createPling({
  namespace: "daylist",
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  agent: {
    config: { minActionIntervalMs: 320, limits: { maxTurns: 100 } },
    trace: true,
  },
  onWarn: (message) => console.warn(message),
});

createApp(App, { locale }).use(pling.plugin).mount("#app");
