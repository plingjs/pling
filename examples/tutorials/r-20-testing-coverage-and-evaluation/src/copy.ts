export type DemoLocale = "en" | "zh";

export interface DemoTask {
  text: string;
  done: boolean;
}

export interface DemoCopy {
  documentTitle: string;
  eyebrow: string;
  heading: string;
  lead: string;
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
  addTaskExpect: string;
  toggleDesc: (text: string, done: boolean) => string;
  seedTasks: readonly DemoTask[];
  stats: (open: number) => string;
  exportLabel: string;
  exportNote: string;
  systemPrompt: string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · React testing and evaluation",
    eyebrow: "Testing and evaluation",
    heading: "A small page with explicit test seams",
    lead: "Every capability used by the agent is declared. One visible export control is deliberately left out so the coverage gap is observable.",
    regionLabel: "Tasks",
    regionDescription: "The task list and the form used to add a task.",
    newTaskLabel: "New task",
    placeholder: "What needs doing?",
    addTask: "Add task",
    empty: "No tasks yet.",
    completedLabel: "completed",
    openLabel: "open",
    dockTitle: "Todo assistant · testing",
    quick: ["Add “Prepare the demo” to my tasks", "What is still open?"],
    addTaskDesc: "Add one task to the list using the supplied text.",
    addTaskParamLabel: "Task text, 1–80 characters; it cannot contain only spaces",
    addTaskExpect: "The new task is present in the list",
    toggleDesc: (text, done) => done ? `Mark “${text}” as open.` : `Mark “${text}” as completed.`,
    seedTasks: [
      { text: "Review the launch checklist", done: false },
      { text: "Send the customer follow-up", done: true },
      { text: "Book the design review", done: false },
    ],
    stats: (open) => `${open} open`,
    exportLabel: "Export CSV",
    exportNote: "This export control is intentionally not declared. It appears in the coverage report, not in the agent's actions.",
    systemPrompt: "You are the assistant for a small React Todo app. Use only declared page actions. Keep answers short.",
  },
  zh: {
    documentTitle: "Pling 教程 · React 测试与评测",
    eyebrow: "测试与评测",
    heading: "一个留有明确测试接口的小页面",
    lead: "Agent 能使用的每项能力都已声明。页面保留一个可见的导出按钮不作声明，让覆盖率缺口可以被直接观察。",
    regionLabel: "待办",
    regionDescription: "待办列表，以及新增待办的表单。",
    newTaskLabel: "新待办",
    placeholder: "需要完成什么？",
    addTask: "添加待办",
    empty: "还没有待办。",
    completedLabel: "已完成",
    openLabel: "未完成",
    dockTitle: "待办助手 · 测试",
    quick: ["把“准备演示”加入我的待办", "现在还有哪些任务没完成？"],
    addTaskDesc: "使用提供的文本向待办列表添加一条待办。",
    addTaskParamLabel: "待办内容，1–80 个字符，不能只包含空格",
    addTaskExpect: "新待办已经出现在列表中",
    toggleDesc: (text, done) => done ? `将“${text}”标记为未完成。` : `将“${text}”标记为已完成。`,
    seedTasks: [
      { text: "检查发布清单", done: false },
      { text: "跟进客户", done: true },
      { text: "预约设计评审", done: false },
    ],
    stats: (open) => `${open} 项未完成`,
    exportLabel: "导出 CSV",
    exportNote: "这个导出按钮刻意没有声明。它只出现在覆盖率报告里，不会进入 Agent 的动作列表。",
    systemPrompt: "你是一个小型 React 待办应用的页面助手。只能使用页面声明的动作。回答保持简短。",
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
