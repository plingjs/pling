import Vue from "vue";
import { createPling } from "@plingjs/vue2";
import "../../shared.css";
import { mountOrderApp } from "./App";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app");

const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
  agent: {
    config: { limits: { maxTurns: 100 } },
    continuity: { key: "recipe-order-desk", resume: "auto", returnOnDone: true },
  },
});

Vue.use(pling.plugin);

const unmount = mountOrderApp(pling, root);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unmount();
    pling.destroy();
  });
}
