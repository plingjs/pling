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
  clearDone: string;
  clearDesc: string;
  externalTitle: string;
  externalDescription: string;
  describeLabel: string;
  addSampleLabel: string;
  clearLabel: string;
  outputEmpty: string;
  approvalTitle: string;
  approvalBody: string;
  approveLabel: string;
  denyLabel: string;
  sampleTask: string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · external agent surface",
    eyebrow: "Pling tutorial · vanilla JavaScript",
    heading: "Support queue",
    regionLabel: "Support queue",
    regionDescription: "Tasks and the page-side controls for adding, completing, or clearing them.",
    newTaskLabel: "New task",
    placeholder: "What needs doing?",
    addTask: "Add task",
    taskColumn: "Task",
    statusColumn: "Status",
    actionColumn: "Complete",
    statusOpen: "Open",
    statusDone: "Done",
    empty: "No tasks yet.",
    dockTitle: "Queue assistant",
    quick: ["Add a task named “Confirm the deployment window”", "Clear the completed tasks"],
    composerTextDesc: "Enter the text for a new support task.",
    composerSubmitDesc: "Add the text in the new-task field to the queue.",
    toggleDesc: (text) => `Change the completion state of “${text}”.`,
    submitReason: "The input is empty. Fill in a task first.",
    seedTasks: [
      { text: "Review the launch checklist", done: false },
      { text: "Book the design review", done: false },
      { text: "Send the customer follow-up", done: true },
    ],
    stats: (open) => `${open} open`,
    systemPrompt: "You are the assistant for a small support queue. Keep answers short.",
    textParamLabel: "Task text",
    recordLabel: (text) => `Task: ${text}`,
    clearDone: "Clear completed",
    clearDesc: "Permanently remove every completed task from the queue.",
    externalTitle: "External agent",
    externalDescription: "This console can only use the capabilities exposed by the page.",
    describeLabel: "Describe capabilities",
    addSampleLabel: "Add a task",
    clearLabel: "Clear completed",
    outputEmpty: "No protocol call yet.",
    approvalTitle: "A destructive action needs your decision",
    approvalBody: "An external agent asked to remove all completed tasks.",
    approveLabel: "Allow",
    denyLabel: "Deny",
    sampleTask: "Approve the vendor security review",
  },
  zh: {
    documentTitle: "Pling 教程 · 向外部 Agent 开放能力",
    eyebrow: "Pling 教程 · 原生 JavaScript",
    heading: "客服队列",
    regionLabel: "客服队列",
    regionDescription: "客服任务，以及新增、完成和清理任务所需的页面操作。",
    newTaskLabel: "新任务",
    placeholder: "需要处理什么？",
    addTask: "添加任务",
    taskColumn: "任务",
    statusColumn: "状态",
    actionColumn: "完成",
    statusOpen: "待处理",
    statusDone: "已完成",
    empty: "还没有任务。",
    dockTitle: "队列助手",
    quick: ["新增一条“确认发布窗口”的任务", "清理已完成的任务"],
    composerTextDesc: "填写一条新的客服任务。",
    composerSubmitDesc: "把任务输入框中的文字加入客服队列。",
    toggleDesc: (text) => `切换“${text}”的完成状态。`,
    submitReason: "输入框是空的，先填写任务内容。",
    seedTasks: [
      { text: "检查发布清单", done: false },
      { text: "预约设计评审", done: false },
      { text: "跟进客户", done: true },
    ],
    stats: (open) => `${open} 项待处理`,
    systemPrompt: "你是一个小型客服队列页面的助手。回答保持简短。",
    textParamLabel: "任务内容",
    recordLabel: (text) => `任务：${text}`,
    clearDone: "清理已完成",
    clearDesc: "永久移除队列中所有已完成的客服任务。",
    externalTitle: "外部 Agent 控制台",
    externalDescription: "这个控制台只能调用页面开放的能力。",
    describeLabel: "读取能力描述",
    addSampleLabel: "新增一条任务",
    clearLabel: "清理已完成",
    outputEmpty: "还没有协议调用。",
    approvalTitle: "危险操作需要你确认",
    approvalBody: "一个外部 Agent 请求移除所有已完成任务。",
    approveLabel: "允许",
    denyLabel: "拒绝",
    sampleTask: "批准供应商的安全评审",
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
