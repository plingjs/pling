import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import App from "./App.vue";
import "./styles.css";

const pling = createPling({
  ui: {
    locale: "en-US",
    theme: {
      mode: "light",
      tokens: { colorPrimary: "#2e9df7", radiusLg: "16px" },
    },
  },
  agent: { config: { limits: { maxTurns: 100 } } },
  diagnostics: import.meta.env.DEV,
  onWarn: (message) => console.warn(`[case077] ${message}`),
});

createApp(App).use(pling.plugin).mount("#app");
