import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "./App";
import { copyFor, plingLocale, resolveDemoLocale } from "./copy";
import "./styles.css";

const locale = resolveDemoLocale();
const copy = copyFor(locale);
const routerBase = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

const pling = createPling({
  presence: { effect: "spotlight" },
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
      <BrowserRouter basename={routerBase}>
        <App locale={locale} />
      </BrowserRouter>
    </PlingProvider>
  </StrictMode>,
);
