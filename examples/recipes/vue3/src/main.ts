import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import App from "./App.vue";
import "../../shared.css";

const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
  agent: {
    config: { limits: { maxTurns: 100 } },
    continuity: { key: "recipe-order-desk", resume: "auto", returnOnDone: true },
  },
});

createApp(App).use(pling.plugin).mount("#app");
