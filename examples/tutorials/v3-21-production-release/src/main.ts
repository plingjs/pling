import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import type { DemoLocale } from "./copy";
import "./styles.css";

const locale: DemoLocale = new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en";
document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  agent: {
    config: {
      systemPrompt:
        "You are the assistant for a small todo list in a release review. Answer in the user's language. You may change tasks, but you cannot change release configuration or deploy. Keep answers short.",
      limits: { maxTurns: 100, contextTokens: 8_192, reserveForOutput: 1_024 },
    },
  },
});

createApp(App, { locale }).use(pling.plugin).mount("#app");
