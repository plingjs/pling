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
    documentTitle: "Pling tutorial · React first mount",
    eyebrow: "Pling tutorial · React first mount",
    heading: "Connected. Nothing exposed yet.",
    actionCount: "0 actions",
    lead: "The assistant is running inside a normal React tree. It can answer questions, but it cannot operate the page because no control has been declared.",
    checks: [
      "React application mounted",
      "PlingProvider is above the business tree",
      "Assistant entry mounted",
      "Page actions declared",
    ],
    nextLabel: "Next:",
    nextText: "Declare the existing Todo controls with React hooks. The assistant will then use the same state updates and event handlers as a person.",
    dockTitle: "Page assistant",
    quick: ["What can you do on this page?"],
    systemPrompt: "You are the assistant for a small React app. Keep answers short.",
  },
  zh: {
    documentTitle: "Pling 教程 · React 首次挂载",
    eyebrow: "Pling 教程 · React 首次挂载",
    heading: "已连接，尚未开放任何操作",
    actionCount: "0 个动作",
    lead: "助手运行在普通的 React 组件树里。它可以回答问题，但还不能操作页面，因为页面没有声明任何控件。",
    checks: ["React 应用已挂载", "PlingProvider 位于业务树外层", "助手入口已挂载", "尚未声明页面动作"],
    nextLabel: "下一步：",
    nextText: "用 React hooks 声明页面已有的 Todo 控件。助手随后会调用同一套状态更新与事件处理函数。",
    dockTitle: "页面助手",
    quick: ["你能在这个页面上做什么？"],
    systemPrompt: "你是一个小型 React 应用的页面助手。回答保持简短。",
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
