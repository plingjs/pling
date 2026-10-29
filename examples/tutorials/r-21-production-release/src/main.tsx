import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "./App";
import { plingLocale, resolveDemoLocale } from "./copy";
import "./styles.css";

const locale = resolveDemoLocale();
const pling = createPling({
  ui: { locale: plingLocale(locale) },
  agent: {
    config: {
      systemPrompt: locale === "zh"
        ? "你是一个小型待办应用的页面助手。发布面板只供人阅读，不能修改发布配置。回答保持简短。"
        : "You are the assistant for a small Todo app. The release panel is for human review and cannot change release configuration. Keep answers short.",
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
