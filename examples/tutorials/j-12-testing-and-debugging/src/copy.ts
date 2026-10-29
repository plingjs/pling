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
  taskColumn: string;
  statusColumn: string;
  actionColumn: string;
  statusOpen: string;
  statusDone: string;
  empty: string;
  dockTitle: string;
  quick: readonly string[];
  composerTextDesc: string;
  composerSubmitDesc: string;
  toggleDesc: (text: string, done: boolean) => string;
  submitReason: string;
  seedTasks: readonly DemoTask[];
  stats: (open: number) => string;
  systemPrompt: string;
  textParamLabel: string;
  recordLabel: (text: string) => string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · testing and debugging",
    eyebrow: "Pling tutorial · tests, replay, and request traces",
    heading: "Work queue",
    regionLabel: "Tasks",
    regionDescription: "The task list and the form for adding a new task.",
    newTaskLabel: "New task",
    placeholder: "What needs doing?",
    addTask: "Add task",
    taskColumn: "Task",
    statusColumn: "Status",
    actionColumn: "Complete",
    statusOpen: "Open",
    statusDone: "Done",
    empty: "No tasks yet.",
    dockTitle: "Todo assistant",
    quick: ["Add “Prepare tomorrow’s agenda” to my tasks", "Mark the first task as completed"],
    composerTextDesc: "Enter the text for a new task in this field.",
    composerSubmitDesc: "Add the text in the new-task field to the task list.",
    toggleDesc: (text) => `Change the completion state of “${text}”.`,
    submitReason: "The input is empty. Fill in a task first.",
    seedTasks: [
      { text: "Review the launch checklist", done: false },
      { text: "Book the design review", done: false },
      { text: "Send the customer follow-up", done: true },
    ],
    stats: (open) => `${open} open`,
    systemPrompt: "You are the assistant for a small work-queue page. Keep answers short.",
    textParamLabel: "Task text",
    recordLabel: (text) => `Task: ${text}`,
  },
  zh: {
    documentTitle: "Pling 教程 · 测试与调试",
    eyebrow: "Pling 教程 · 测试、回放与请求轨迹",
    heading: "工作队列",
    regionLabel: "待办",
    regionDescription: "待办列表，以及新增待办的表单。",
    newTaskLabel: "新待办",
    placeholder: "需要完成什么？",
    addTask: "添加待办",
    taskColumn: "待办",
    statusColumn: "状态",
    actionColumn: "完成",
    statusOpen: "未完成",
    statusDone: "已完成",
    empty: "还没有待办。",
    dockTitle: "待办助手",
    quick: ["把“准备明天的议程”加入我的待办", "把第 1 个待办标记完成"],
    composerTextDesc: "在这个输入框中填写一条新待办的内容。",
    composerSubmitDesc: "把新待办输入框中的文字加入待办列表。",
    toggleDesc: (text) => `切换“${text}”的完成状态。`,
    submitReason: "输入框是空的，先填写待办内容。",
    seedTasks: [
      { text: "检查发布清单", done: false },
      { text: "预约设计评审", done: false },
      { text: "跟进客户", done: true },
    ],
    stats: (open) => `${open} 项未完成`,
    systemPrompt: "你是一个小型工作队列页面的助手。回答保持简短。",
    textParamLabel: "待办内容",
    recordLabel: (text) => `待办：${text}`,
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
