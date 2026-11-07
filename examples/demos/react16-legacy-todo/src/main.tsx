import * as React from "react";
import * as ReactDOM from "react-dom";
import { createPling, PlingProvider } from "@plingjs/react/legacy";
import { App } from "./App";
import { quickTasks, resolveDemoLocale } from "./copy";
import "./styles.css";

const locale = resolveDemoLocale();
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  onWarn: (message) => console.warn(message),
  agent: { config: { minActionIntervalMs: 320, limits: { maxTurns: 100 } } },
});

const host = document.getElementById("app");
if (!host) throw new Error("Missing #app mount point");

ReactDOM.render(
  <PlingProvider pling={pling}>
    <App locale={locale} quick={quickTasks(locale)} />
  </PlingProvider>,
  host,
);
