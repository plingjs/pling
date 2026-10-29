import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "./App";
import "../../shared.css";

const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
  agent: {
    config: { limits: { maxTurns: 100 } },
    continuity: { key: "recipe-order-desk", resume: "auto", returnOnDone: true },
  },
});

createRoot(document.querySelector("#app")!).render(
  <StrictMode>
    <PlingProvider pling={pling}>
      <App />
    </PlingProvider>
  </StrictMode>,
);
