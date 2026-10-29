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
  listLabel: string;
  listDescription: string;
  recordLabel: (text: string) => string;
  newTaskLabel: string;
  placeholder: string;
  addTask: string;
  empty: string;
  dockTitle: string;
  quick: readonly string[];
  composerTextDesc: string;
  composerSubmitDesc: string;
  toggleDesc: (text: string, done: boolean) => string;
  removeDesc: (text: string) => string;
  editDesc: (text: string) => string;
  dialogLabel: string;
  dialogDescription: string;
  editTitle: string;
  saveEdit: string;
  cancelEdit: string;
  saveDesc: string;
  cancelDesc: string;
  submitReason: string;
  fullReason: string;
  seedTasks: readonly DemoTask[];
  stats: (open: number) => string;
  systemPrompt: string;
  textParamLabel: string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · Vue 2 Todo agent",
    eyebrow: "Pling tutorial · Vue 2.7",
    heading: "Tasks",
    regionLabel: "Tasks",
    regionDescription: "The task page, including the add form and the task rows.",
    listLabel: "Task list",
    listDescription: "Each row is a task with its text and completion state.",
    recordLabel: (text) => `Task: ${text}`,
    newTaskLabel: "New task",
    placeholder: "What needs doing?",
    addTask: "Add task",
    empty: "No tasks yet.",
    dockTitle: "Todo assistant",
    quick: ["Add “Prepare tomorrow’s agenda” to my tasks", "Mark the first task as completed"],
    composerTextDesc: "Enter the text for a new task in this field.",
    composerSubmitDesc: "Add the text in the new-task field to the task list.",
    toggleDesc: (text, done) => done ? `Mark “${text}” as open.` : `Mark “${text}” as completed.`,
    removeDesc: (text) => `Delete “${text}” from the task list.`,
    editDesc: (text) => `Edit the text of “${text}”.`,
    dialogLabel: "Edit task",
    dialogDescription: "A modal form for changing one task's text.",
    editTitle: "Edit task",
    saveEdit: "Save",
    cancelEdit: "Cancel",
    saveDesc: "Save the edited task text and close the dialog.",
    cancelDesc: "Close the edit dialog without changing the task.",
    submitReason: "The input is empty. Fill in a task first.",
    fullReason: "The task list is full. Remove a task first.",
    seedTasks: [
      { text: "Review the launch checklist", done: false },
      { text: "Book the design review", done: false },
      { text: "Send the customer follow-up", done: true },
    ],
    stats: (open) => `${open} open`,
    systemPrompt: "You are the assistant for a small Vue 2.7 Todo app. Keep answers short.",
    textParamLabel: "Task text",
  },
  zh: {
    documentTitle: "Pling 教程 · Vue 2 Todo Agent",
    eyebrow: "Pling 教程 · Vue 2.7",
    heading: "待办",
    regionLabel: "待办",
    regionDescription: "待办页面，包括新增表单和任务行。",
    listLabel: "任务列表",
    listDescription: "每一行是一条待办，包含内容和完成状态。",
    recordLabel: (text) => `待办：${text}`,
    newTaskLabel: "新待办",
    placeholder: "需要完成什么？",
    addTask: "添加待办",
    empty: "还没有待办。",
    dockTitle: "待办助手",
    quick: ["把“准备明天的议程”加入我的待办", "把第 1 个待办标记完成"],
    composerTextDesc: "在这个输入框中填写一条新待办的内容。",
    composerSubmitDesc: "把新待办输入框中的文字加入待办列表。",
    toggleDesc: (text, done) => done ? `将“${text}”标记为未完成。` : `将“${text}”标记为已完成。`,
    removeDesc: (text) => `从待办列表中删除“${text}”。`,
    editDesc: (text) => `编辑“${text}”的内容。`,
    dialogLabel: "编辑待办",
    dialogDescription: "用于修改单条待办内容的模态表单。",
    editTitle: "编辑待办",
    saveEdit: "保存",
    cancelEdit: "取消",
    saveDesc: "保存修改后的待办内容并关闭弹窗。",
    cancelDesc: "关闭编辑弹窗，不修改待办。",
    submitReason: "输入框是空的，先填写待办内容。",
    fullReason: "待办列表已满，请先删除一条待办。",
    seedTasks: [
      { text: "检查发布清单", done: false },
      { text: "预约设计评审", done: false },
      { text: "跟进客户", done: true },
    ],
    stats: (open) => `${open} 项未完成`,
    systemPrompt: "你是一个小型 Vue 2.7 待办应用的页面助手。回答保持简短。",
    textParamLabel: "待办内容",
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
