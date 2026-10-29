import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import "./styles.css";
import type { DemoLocale } from "./copy";

const locale: DemoLocale = new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en";
document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  agent: {
    config: {
      systemPrompt:
        "You are the assistant for an existing Todo application. Answer in the user's language. Change tasks only through the declared controls, and keep answers short.",
      limits: { maxTurns: 100, contextTokens: 8_192, reserveForOutput: 1_024 },
    },
  },
});

createApp(App, { locale }).use(pling.plugin).mount("#app");
