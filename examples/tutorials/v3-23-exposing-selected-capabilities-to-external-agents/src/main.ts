import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import type { DemoLocale } from "./copy";
import "./styles.css";

const locale: DemoLocale = new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en";
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  agent: {
    config: {
      systemPrompt:
        "You are the page assistant for a Todo list that also exposes a small external surface. Answer in the user's language. Use only declared capabilities and keep answers short.",
      limits: { maxTurns: 100, contextTokens: 8_192, reserveForOutput: 1_024 },
    },
  },
});

createApp(App, { locale }).use(pling.plugin).mount("#app");
