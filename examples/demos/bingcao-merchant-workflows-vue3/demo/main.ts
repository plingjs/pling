import { createApp } from "vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import "./style.css";

async function start(): Promise<void> {
  const integrated = new URLSearchParams(window.location.search).get("mode") !== "baseline";
  const app = createApp(App, { integrated });
  if (integrated) {
    const { createPling } = await import("@plingjs/vue");
    const pling = createPling({
      ui: { locale: "zh-CN" },
      agent: {
        config: { limits: { maxTurns: 100 } },
        clock: { businessTimeZone: "Asia/Shanghai" },
      },
    });
    app.use(pling.plugin);
  } else {
    // The same template is used in the unintegrated baseline. Register a no-op
    // directive there so Vue does not warn, while keeping Pling out of that app.
    app.directive("guide-target", {});
  }
  app.mount("#app");
}

void start();
