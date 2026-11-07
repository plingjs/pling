import { React, PlingProvider, createPling, createRoot } from "./react19-runtime";
import { App } from "./App";
import { resolveDemoLocale } from "../../../shared/course-workspace/copy";
import "../../../shared/course-workspace/styles.css";

const locale = resolveDemoLocale();
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  onWarn: (message: string) => console.warn(message),
  agent: { config: { minActionIntervalMs: 320, limits: { maxTurns: 100 } } },
});

const host = document.getElementById("app");
if (!host) throw new Error("Missing #app mount point");

createRoot(host).render(
  <PlingProvider pling={pling}>
    <App locale={locale} />
  </PlingProvider>,
);
