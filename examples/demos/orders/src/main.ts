import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import OrderWorkspace from "./OrderWorkspace.vue";
import { quickTasks, resolveDemoLocale } from "./copy";
import "./styles.css";

const locale = resolveDemoLocale();
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  onWarn: (message) => console.warn(message),
  agent: { config: { minActionIntervalMs: 420, limits: { maxTurns: 100 } } },
});

createApp(OrderWorkspace, { quick: quickTasks(locale), locale }).use(pling.plugin).mount("#app");
