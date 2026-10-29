import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import { resolveDemoLocale } from "./copy";
import "./styles.css";

const locale = resolveDemoLocale();
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  onWarn: (message) => console.warn(message),
  agent: {
    config: {
      systemPrompt:
        "You are the page assistant for a complete Todo list. The page also exposes a small named surface to an external client. Use only the declared tools, read todo_view before interpreting a filtered list, and answer in the user's language. Never claim that an external request was approved: the page operator decides separately.",
      minActionIntervalMs: 300,
      limits: { maxTurns: 100 },
    },
  },
});

createApp(App, { locale }).use(pling.plugin).mount("#app");
