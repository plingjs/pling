import { Vue, createPling } from "./vue2-runtime";
import { resolveDemoLocale } from "../../../shared/course-workspace/copy";
import "../../../shared/course-workspace/styles.css";
import { mountCourseWorkspace } from "./CourseWorkspace";

const locale = resolveDemoLocale();
const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  onWarn: (message: string) => console.warn(message),
  agent: { config: { minActionIntervalMs: 320, limits: { maxTurns: 100 } } },
});

Vue.use(pling.plugin);

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app mount point");

const unmount = mountCourseWorkspace(pling, root, locale);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unmount();
    pling.destroy();
  });
}
