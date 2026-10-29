import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "./App";
import { browserAgentConfig } from "./agent-config";
import { resolveDemoLocale } from "./locale";
import "./styles.css";

const locale = resolveDemoLocale();
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  agent: {
    config: {
      ...browserAgentConfig,
      systemPrompt: locale === "zh"
        ? "你是一个小型待办列表的页面助手。浏览器只访问同源模型网关。回答保持简短。"
        : "You are the assistant for a small todo list. The browser talks only to its same-origin model gateway. Keep answers short.",
      limits: { maxTurns: 100 },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlingProvider pling={pling}>
      <App locale={locale} />
    </PlingProvider>
  </StrictMode>,
);
