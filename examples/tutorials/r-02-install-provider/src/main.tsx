import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "./App";
import { copyFor, plingLocale, resolveDemoLocale } from "./copy";
import "./styles.css";

const locale = resolveDemoLocale();
const copy = copyFor(locale);

const pling = createPling({
  ui: { locale: plingLocale(locale) },
  agent: {
    config: {
      systemPrompt: copy.systemPrompt,
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
