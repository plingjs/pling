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
        ? "你是一个小型订单工作台的页面助手。整项业务操作有已声明的流程时，优先调用流程。流程失败后，阅读步骤回执，从失败的步骤续跑，不要从第一步重来。回答保持简短。"
        : "You are the assistant for a small order desk. Prefer a declared flow when one matches the whole business operation. If a flow fails, read the step report and resume from the failed step instead of starting again. Keep answers short.",
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
