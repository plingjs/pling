import { hydrateRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "./App";
import { copyFor, plingLocale, type DemoLocale } from "./copy";
import "./styles.css";

const locale: DemoLocale =
  new URLSearchParams(window.location.search).get("lang") === "zh" ? "zh" : "en";
const copy = copyFor(locale);

const pling = createPling({
  ui: { locale: plingLocale(locale) },
  agent: {
    config: {
      systemPrompt: copy.clientNote,
      limits: { maxTurns: 100 },
    },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

hydrateRoot(
  root,
  <PlingProvider pling={pling}>
    <App locale={locale} />
  </PlingProvider>,
);
