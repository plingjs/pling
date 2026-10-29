export type DemoLocale = "en" | "zh";

export const DEMO_LOCALES: readonly DemoLocale[] = ["en", "zh"];

export interface DemoTask {
  text: string;
  done: boolean;
}

export interface DemoCopy {
  documentTitle: string;
  eyebrow: string;
  heading: string;
  regionLabel: string;
  regionDescription: string;
  newTaskLabel: string;
  placeholder: string;
  addTask: string;
  empty: string;
  completedLabel: string;
  openLabel: string;
  dockTitle: string;
  quick: readonly string[];
  addTaskDesc: string;
  addTaskParamLabel: string;
  addTaskFullReason: string;
  addTaskExpect: string;
  toggleDesc: (text: string, done: boolean) => string;
  seedTasks: readonly DemoTask[];
  stats: (open: number) => string;
  systemPrompt: string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · React Todo agent",
    eyebrow: "Pling tutorial · React",
    heading: "Tasks",
    regionLabel: "Tasks",
    regionDescription: "The task list and the form for adding a new task.",
    newTaskLabel: "New task",
    placeholder: "What needs doing?",
    addTask: "Add task",
    empty: "No tasks yet.",
    completedLabel: "completed",
    openLabel: "open",
    dockTitle: "Todo assistant",
    quick: ["Add “Prepare tomorrow’s agenda” to my tasks", "Mark the first task as completed"],
    addTaskDesc: "Add one task to the list using the supplied text.",
    addTaskParamLabel: "Task text, 1–80 characters; it cannot contain only spaces",
    addTaskFullReason: "The list is full (8 tasks). Remove a task before adding another.",
    addTaskExpect: "The new task is present in the list",
    toggleDesc: (text, done) => done ? `Mark “${text}” as open.` : `Mark “${text}” as completed.`,
    seedTasks: [
      { text: "Review the launch checklist", done: false },
      { text: "Book the design review", done: false },
      { text: "Send the customer follow-up", done: true },
    ],
    stats: (open) => `${open} open`,
    systemPrompt: "You are the assistant for a small React Todo app. Keep answers short.",
  },
  zh: {
    documentTitle: "Pling 教程 · React Todo Agent",
    eyebrow: "Pling 教程 · React",
    heading: "待办",
    regionLabel: "待办",
    regionDescription: "待办列表，以及新增待办的表单。",
    newTaskLabel: "新待办",
    placeholder: "需要完成什么？",
    addTask: "添加待办",
    empty: "还没有待办。",
    completedLabel: "已完成",
    openLabel: "未完成",
    dockTitle: "待办助手",
    quick: ["把“准备明天的议程”加入我的待办", "把第 1 个待办标记完成"],
    addTaskDesc: "使用提供的文本向待办列表添加一条待办。",
    addTaskParamLabel: "待办内容，1–80 个字符，不能只包含空格",
    addTaskFullReason: "列表已满（8 项）。请先删除一条待办再添加。",
    addTaskExpect: "新待办已经出现在列表中",
    toggleDesc: (text, done) => done ? `将“${text}”标记为未完成。` : `将“${text}”标记为已完成。`,
    seedTasks: [
      { text: "检查发布清单", done: false },
      { text: "预约设计评审", done: false },
      { text: "跟进客户", done: true },
    ],
    stats: (open) => `${open} 项未完成`,
    systemPrompt: "你是一个小型 React 待办应用的页面助手。回答保持简短。",
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
