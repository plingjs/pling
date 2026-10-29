import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import "./styles.css";

const pling = createPling({
  ui: { locale: "en-US" },
  agent: {
    config: {
      systemPrompt: "You are the assistant for a small todo list. Use only declared actions. Keep answers short.",
      limits: { maxTurns: 100 },
    },
  },
});

createApp(App).use(pling.plugin).mount("#app");
