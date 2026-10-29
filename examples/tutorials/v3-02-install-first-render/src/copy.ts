export type DemoLocale = "en" | "zh";

export const DEMO_LOCALES: readonly DemoLocale[] = ["en", "zh"];

export interface DemoCopy {
  documentTitle: string;
  eyebrow: string;
  heading: string;
  actionCount: string;
  lead: string;
  checks: readonly string[];
  nextLabel: string;
  nextText: string;
  dockTitle: string;
  quick: readonly string[];
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · first render",
    eyebrow: "Pling tutorial · first render",
    heading: "Connected. Nothing exposed yet.",
    actionCount: "0 actions",
    lead: "The assistant is running, but it cannot operate this page. No control has been declared. That is the expected state at the end of this chapter.",
    checks: [
      "Vue application mounted",
      "Pling plugin installed",
      "Assistant entry mounted",
      "Page actions declared",
    ],
    nextLabel: "Next:",
    nextText: "Declare the existing task input and submit button in the quick-start chapter. The assistant will then use those controls through their normal event handlers.",
    dockTitle: "Page assistant",
    quick: ["What can you do on this page?"],
  },
  zh: {
    documentTitle: "Pling 教程 · 首次渲染",
    eyebrow: "Pling 教程 · 首次渲染",
    heading: "已连接，尚未开放任何操作",
    actionCount: "0 个动作",
    lead: "助手已经运行，但还不能操作这个页面。页面没有声明任何控件，这正是本章结束时应有的状态。",
    checks: ["Vue 应用已挂载", "Pling 插件已安装", "助手入口已挂载", "尚未声明页面动作"],
    nextLabel: "下一步：",
    nextText: "在快速上手一章中，声明页面已有的任务输入框和提交按钮。助手随后会通过它们原本的表单处理函数来操作页面。",
    dockTitle: "页面助手",
    quick: ["你能在这个页面上做什么？"],
  },
};

export function normalizeDemoLocale(value: string | null | undefined): DemoLocale | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "zh" || normalized === "cn" || normalized.startsWith("zh-")) return "zh";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return undefined;
}

export function resolveDemoLocale(
  search = typeof window === "undefined" ? "" : window.location.search,
  configured: string | undefined = import.meta.env.VITE_DEMO_LOCALE,
): DemoLocale {
  const fromQuery = normalizeDemoLocale(new URLSearchParams(search).get("lang"));
  return fromQuery ?? normalizeDemoLocale(configured) ?? "en";
}

export function plingLocale(locale: DemoLocale): "en-US" | "zh-CN" {
  return locale === "zh" ? "zh-CN" : "en-US";
}

export function copyFor(locale: DemoLocale): DemoCopy {
  return COPY[locale];
}
