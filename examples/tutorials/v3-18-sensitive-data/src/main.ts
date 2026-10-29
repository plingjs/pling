import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import "./styles.css";

const params = new URLSearchParams(location.search);
const locale = params.get("lang") === "zh" ? "zh-CN" : "en-US";

const pling = createPling({
  presence: { effect: "spotlight" },
  ui: { locale },
  agent: {
    config: {
      systemPrompt:
        "You are the assistant for a small order desk. Sensitive values may appear as tokens such as {{p:...}}. Copy a token unchanged when an action needs the value; never guess one. Keep answers short.",
      limits: {
        maxTurns: 100,
        contextTokens: 8_192,
        reserveForOutput: 1_024,
        compactRatio: 0.8,
        keepRecent: 6,
      },
    },
  },
});

createApp(App).use(pling.plugin).mount("#app");
