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
        ? "你是一个存量 React 待办应用的页面助手。复用现有表单与业务函数，回答保持简短。"
        : "You are the assistant for an existing React Todo app. Reuse the existing form and business functions. Keep answers short.",
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
