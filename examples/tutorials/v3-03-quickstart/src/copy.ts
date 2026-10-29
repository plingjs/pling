export type DemoLocale = "en" | "zh";

export interface DemoCopy {
  documentTitle: string;
  eyebrow: string;
  heading: string;
  regionLabel: string;
  regionDescription: string;
  newTaskLabel: string;
  newTaskPlaceholder: string;
  addTask: string;
  empty: string;
  filterGroupLabel: string;
  filters: { all: string; active: string; completed: string };
  clearCompleted: string;
  dockTitle: string;
  quick: readonly string[];
  composerTextDesc: string;
  composerSubmitDesc: string;
  toggleTaskDesc: (text: string, done: boolean) => string;
  seedTasks: readonly { text: string; done: boolean }[];
  stats: (open: number, done: number) => string;
  deleteTask: (text: string) => string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · complete Todo agent",
    eyebrow: "Pling tutorial",
    heading: "Tasks",
    regionLabel: "Tasks",
    regionDescription: "The task list and the form for adding a new task.",
    newTaskLabel: "New task",
    newTaskPlaceholder: "What needs doing?",
    addTask: "Add task",
    empty: "No tasks in this view.",
    filterGroupLabel: "Filter tasks",
    filters: { all: "All", active: "Open", completed: "Done" },
    clearCompleted: "Clear completed",
    dockTitle: "Todo assistant",
    quick: [
      "Add “Prepare tomorrow’s agenda” to my tasks",
      "Mark the first task as completed, then create two tasks of your choosing",
    ],
    composerTextDesc: "Enter the text for a new task in this field.",
    composerSubmitDesc: "Add the text in the new-task field to the task list.",
    toggleTaskDesc: (text, done) =>
      done ? `Mark “${text}” as open.` : `Mark “${text}” as completed.`,
    seedTasks: [
      { text: "Review the launch checklist", done: false },
      { text: "Book the design review", done: false },
      { text: "Send the customer follow-up", done: true },
    ],
    stats: (open, done) => `${open} open · ${done} done`,
    deleteTask: (text) => `Delete ${text}`,
  },
  zh: {
    documentTitle: "Pling 教程 · 完整的 Todo Agent",
    eyebrow: "Pling 教程",
    heading: "待办",
    regionLabel: "待办",
    regionDescription: "待办列表，以及新增待办的表单。",
    newTaskLabel: "新待办",
    newTaskPlaceholder: "需要完成什么？",
    addTask: "添加待办",
    empty: "当前视图没有待办。",
    filterGroupLabel: "筛选待办",
    filters: { all: "全部", active: "未完成", completed: "已完成" },
    clearCompleted: "清除已完成",
    dockTitle: "待办助手",
    quick: [
      "把“准备明天的议程”加入我的待办",
      "把第 1 个待办标记完成，然后由你决定创建 2 个待办",
    ],
    composerTextDesc: "在这个输入框中填写一条新待办的内容。",
    composerSubmitDesc: "把新待办输入框中的文字加入待办列表。",
    toggleTaskDesc: (text, done) =>
      done ? `将“${text}”标记为未完成。` : `将“${text}”标记为已完成。`,
    seedTasks: [
      { text: "检查发布清单", done: false },
      { text: "预约设计评审", done: false },
      { text: "跟进客户", done: true },
    ],
    stats: (open, done) => `${open} 项未完成 · ${done} 项已完成`,
    deleteTask: (text) => `删除 ${text}`,
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
