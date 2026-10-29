import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import DemoGallery from "./components/DemoGallery.vue";
import DemoLaunch from "./components/DemoLaunch.vue";
import DemoPlayground from "./components/DemoPlayground.vue";
import HomeLanding from "./components/HomeLanding.vue";
import "./custom.css";

/**
 * 默认主题 + Pling 品牌色。要加全局组件（比如内嵌案例的 <DemoFrame>）就在这里 enhanceApp。
 */
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("DemoGallery", DemoGallery);
    app.component("DemoLaunch", DemoLaunch);
    app.component("DemoPlayground", DemoPlayground);
    app.component("HomeLanding", HomeLanding);
  },
} satisfies Theme;
