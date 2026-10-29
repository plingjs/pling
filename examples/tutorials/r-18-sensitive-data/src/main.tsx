import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "./App";
import { resolveDemoLocale } from "./locale";
import "./styles.css";

const locale = resolveDemoLocale();
const pling = createPling({
  presence: { effect: "spotlight" },
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  agent: {
    config: {
      systemPrompt: locale === "zh"
        ? "你是一个小型订单工作台的页面助手。敏感值可能显示为 {{p:...}} 形式的代号。动作需要该值时，原样复制代号，绝不要猜测。回答保持简短。"
        : "You are the assistant for a small order desk. Sensitive values may appear as tokens such as {{p:...}}. Copy a token unchanged when an action needs the value; never guess one. Keep answers short.",
      limits: {
        maxTurns: 100,
        contextTokens: 8_192,
        reserveForOutput: 1_024,
        compactRatio: 0.8,
        keepRecent: 6,
      },
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
