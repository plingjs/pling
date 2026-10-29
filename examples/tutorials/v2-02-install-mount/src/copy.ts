export type DemoLocale = "en" | "zh";

export const DEMO_LOCALES: readonly DemoLocale[] = ["en", "zh"];

export interface DemoCopy {
  documentTitle: string;
  eyebrow: string;
  heading: string;
  lead: string;
  actionCount: string;
  checks: readonly string[];
  nextLabel: string;
  nextText: string;
  dockTitle: string;
  quick: readonly string[];
  systemPrompt: string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · Vue 2 installation",
    eyebrow: "Pling tutorial · Vue 2.7",
    heading: "Connected. Nothing exposed yet.",
    lead: "The Vue application is unchanged. Pling has one runtime and one assistant entry.",
    actionCount: "0 actions",
    checks: [
      "Vue 2.7 application mounted",
      "Pling plugin installed",
      "Assistant entry mounted",
      "Page actions declared",
    ],
    nextLabel: "Next:",
    nextText: "open the assistant and confirm it can reply.",
    dockTitle: "Page assistant",
    quick: ["What can you do on this page?"],
    systemPrompt: "You are the assistant for a Vue 2.7 application. Keep answers short.",
  },
  zh: {
    documentTitle: "Pling 教程 · Vue 2 安装",
    eyebrow: "Pling 教程 · Vue 2.7",
    heading: "已连接，尚未开放任何操作",
    lead: "Vue 应用本身保持不变。Pling 只有一个运行时和一个助手入口。",
    actionCount: "0 个动作",
    checks: [
      "Vue 2.7 应用已挂载",
      "Pling 插件已安装",
      "助手入口已挂载",
      "页面动作已声明",
    ],
    nextLabel: "下一步：",
    nextText: "打开助手，确认它能够回复。",
    dockTitle: "页面助手",
    quick: ["你能在这个页面上做什么？"],
    systemPrompt: "你是一个 Vue 2.7 应用的页面助手。回答保持简短。",
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
