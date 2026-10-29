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
  systemPrompt: string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · vanilla first mount",
    eyebrow: "Pling tutorial · vanilla JavaScript",
    heading: "Connected. Nothing exposed yet.",
    actionCount: "0 actions",
    lead: "The page is still ordinary HTML and DOM. The assistant entry is mounted, but no element has been declared as an action or record.",
    checks: [
      "Existing HTML mounted",
      "Page-level Pling instance created",
      "Assistant entry mounted",
      "Page actions declared",
    ],
    nextLabel: "Next:",
    nextText: "Declare the existing Todo elements with pling.scope, pling.record and pling.tool. Their click and submit handlers do not move.",
    dockTitle: "Page assistant",
    quick: ["What can you do on this page?"],
    systemPrompt: "You are the assistant for a small vanilla JavaScript app. Keep answers short.",
  },
  zh: {
    documentTitle: "Pling 教程 · 原生页面首次挂载",
    eyebrow: "Pling 教程 · 原生 JavaScript",
    heading: "已连接，尚未开放任何操作",
    actionCount: "0 个动作",
    lead: "页面仍然是普通 HTML 和 DOM。助手入口已经挂载，但还没有元素被声明为动作或记录。",
    checks: ["已有 HTML 已挂载", "页面级 Pling 实例已创建", "助手入口已挂载", "尚未声明页面动作"],
    nextLabel: "下一步：",
    nextText: "用 pling.scope、pling.record 和 pling.tool 声明已有 Todo 元素；它们的 click 与 submit 处理函数不需要挪动。",
    dockTitle: "页面助手",
    quick: ["你能在这个页面上做什么？"],
    systemPrompt: "你是一个小型原生 JavaScript 应用的页面助手。回答保持简短。",
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
