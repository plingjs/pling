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
  addTaskDesc: string;
  addTaskParamLabel: string;
  addTaskFull: (max: number) => string;
  addTaskExpect: string;
  toggleTaskDesc: (text: string, done: boolean) => string;
  seedTasks: readonly { text: string; done: boolean }[];
  stats: (open: number, done: number) => string;
  deleteTask: (text: string) => string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · actions with input",
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
      "Add a task called “Reply to the customer”",
    ],
    addTaskDesc: "Add one task to the list using the supplied text.",
    addTaskParamLabel: "Task text, 1–80 characters; it cannot contain only spaces",
    addTaskFull: (max) => `The list is full (${max} tasks). Remove a task before adding another.`,
    addTaskExpect: "The new task is present in the list",
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
    documentTitle: "Pling 教程 · 带输入的动作",
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
      "添加一条“回复客户”的待办",
    ],
    addTaskDesc: "使用提供的文本向待办列表添加一条待办。",
    addTaskParamLabel: "待办内容，1–80 个字符，不能只包含空格",
    addTaskFull: (max) => `列表已满（${max} 项）。请先删除一条待办再添加。`,
    addTaskExpect: "新待办已经出现在列表中",
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
