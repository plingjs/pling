import { createPling } from "@plingjs/vanilla";
import { createRecipeApp } from "./app";
import "../../shared.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app");

const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
  agent: {
    config: { limits: { maxTurns: 100 } },
    continuity: { key: "recipe-order-desk", resume: "auto", returnOnDone: true },
  },
});

createRecipeApp(pling, root);
