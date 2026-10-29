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
      systemPrompt:
        "You are the assistant for a small task list. Use the task editor when a task must be renamed. Keep answers short.",
      limits: { maxTurns: 100 },
    },
  },
});

createApp(App).use(pling.plugin).mount("#app");
