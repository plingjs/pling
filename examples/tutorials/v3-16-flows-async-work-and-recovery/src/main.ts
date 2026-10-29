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
        "You are the assistant for a small order desk. Prefer a declared flow when one matches the whole business operation. If a flow fails, read the step report and resume from the failed step instead of starting again. Keep answers short.",
      limits: { maxTurns: 100 },
    },
  },
});

createApp(App).use(pling.plugin).mount("#app");
