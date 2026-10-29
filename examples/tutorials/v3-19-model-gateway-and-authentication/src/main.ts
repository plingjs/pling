import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import { browserAgentConfig } from "./agent-config";
import "./styles.css";

const pling = createPling({
  ui: { locale: "en-US" },
  agent: {
    config: {
      ...browserAgentConfig,
      systemPrompt:
        "You are the assistant for a small todo list. The browser talks only to its same-origin model gateway. Keep answers short.",
      limits: { maxTurns: 100 },
    },
  },
});

createApp(App).use(pling.plugin).mount("#app");
