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
        ? "你是一个小型待办应用的页面助手。外部客户端只能调用明确开放的能力，回答保持简短。"
        : "You are the assistant for a small Todo app. External clients can invoke only explicitly exposed capabilities. Keep answers short.",
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
