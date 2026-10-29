import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import App from "./App.vue";
import type { DemoLocale } from "./copy";

export function renderTodoSsr(locale: DemoLocale): Promise<string> {
  return renderToString(createSSRApp(App, { locale }));
}
