import { createSSRApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import type { DemoLocale } from "./copy";
import "./styles.css";

const locale: DemoLocale = new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en";
document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
document.title = locale === "zh" ? "Nuxt 与服务端渲染 · Pling" : "Nuxt and SSR · Pling";
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  agent: {
    config: {
      systemPrompt:
        "You are the assistant for a server-rendered Todo page. Answer in the user's language. The page is already visible; use only declared capabilities and keep answers short.",
      limits: { maxTurns: 100, contextTokens: 8_192, reserveForOutput: 1_024 },
    },
  },
});

createSSRApp(App, { locale }).use(pling.plugin).mount("#app");
