import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import CourseWorkspace from "./CourseWorkspace.vue";
import { resolveDemoLocale } from "../../../shared/course-workspace/copy";
import "./course-create.css";

const locale = resolveDemoLocale();
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  onWarn: (message) => console.warn(message),
  agent: { config: { minActionIntervalMs: 320, limits: { maxTurns: 100 } } },
});

createApp(CourseWorkspace, { locale }).use(pling.plugin).mount("#app");
