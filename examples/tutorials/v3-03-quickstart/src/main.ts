import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import { plingLocale, resolveDemoLocale } from "./copy";
import "./styles.css";

const pling = createPling({
  ui: { locale: plingLocale(resolveDemoLocale()) },
  agent: {
    config: {
      limits: { maxTurns: 100 },
      systemPrompt: "You are the assistant for a small Todo app. Keep answers short.",
    },
  },
});

createApp(App).use(pling.plugin).mount("#app");
