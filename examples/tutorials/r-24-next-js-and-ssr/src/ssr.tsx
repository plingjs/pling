import { renderToString } from "react-dom/server";
import { App } from "./App";
import type { DemoLocale } from "./copy";

export function renderTodoSsr(locale: DemoLocale): string {
  return renderToString(<App locale={locale} />);
}
