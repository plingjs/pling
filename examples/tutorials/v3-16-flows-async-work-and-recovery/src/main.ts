import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import "./styles.css";

const params = new URLSearchParams(location.search);
const locale = params.get("lang") === "zh" ? "zh-CN" : "en-US";
const title = locale === "zh-CN" ? "流程、异步与失败续跑" : "Flows, async work, and recovery";

document.documentElement.lang = locale;
document.title = `${title} · Pling`;

const pling = createPling({
  presence: { effect: "spotlight" },
  ui: { locale },
  page: { title: () => title },
  agent: {
    config: {
      systemPrompt:
        locale === "zh-CN"
          ? "你是一个小型订单工作台的页面助手。整项业务操作有已声明的流程时，优先调用流程。流程失败后，阅读步骤回执，从失败的步骤续跑，不要从第一步重来。回答保持简短。"
          : "You are the assistant for a small order desk. Prefer a declared flow when one matches the whole business operation. If a flow fails, read the step report and resume from the failed step instead of starting again. Keep answers short.",
      limits: { maxTurns: 100 },
    },
  },
});

createApp(App).use(pling.plugin).mount("#app");
