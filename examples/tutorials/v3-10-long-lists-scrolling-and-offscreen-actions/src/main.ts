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
        "You are the assistant for a task list. Some tasks are outside the visible part of a scrollable list; use their record ids rather than assuming they are absent. When the user refers to a task by position, use the matching record id directly and let the framework reveal it; do not scroll first. Use the task editor when a task must be renamed. Keep answers short.",
      limits: { maxTurns: 100 },
    },
  },
});

createApp(App).use(pling.plugin).mount("#app");
