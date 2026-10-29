export type DemoLocale = "en" | "zh";

export const DEMO_LOCALES: readonly DemoLocale[] = ["en", "zh"];

export interface DemoTask {
  text: string;
  done: boolean;
  phone: string;
  account: string;
  internalNote: string;
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
  contactColumn: string;
  actionColumn: string;
  openAssistant: string;
  statusOpen: string;
  statusDone: string;
  empty: string;
  dockTitle: string;
  quick: readonly string[];
  composerTextDesc: string;
  composerSubmitDesc: string;
  toggleDesc: (text: string, done: boolean) => string;
  callDesc: (text: string) => string;
  callLabel: string;
  called: (lastFour: string) => string;
  clearDone: string;
  clearDesc: string;
  submitReason: string;
  seedTasks: readonly DemoTask[];
  stats: (open: number) => string;
  systemPrompt: string;
  textParamLabel: string;
  phoneParamLabel: string;
  recordLabel: (text: string) => string;
  gatewayTitle: string;
  gatewayLead: string;
  passwordLabel: string;
  signIn: string;
  signOut: string;
  signingIn: string;
  signInFailed: string;
  signedIn: string;
  signedOut: string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · sensitive data and dangerous actions",
    eyebrow: "Pling tutorial · vanilla JavaScript",
    heading: "Support tasks",
    regionLabel: "Support tasks",
    regionDescription: "Tasks, their owners, and the controls for completing or clearing them.",
    newTaskLabel: "New task",
    placeholder: "What needs doing?",
    addTask: "Add task",
    taskColumn: "Task",
    statusColumn: "Status",
    contactColumn: "Account",
    actionColumn: "Actions",
    openAssistant: "Open assistant",
    statusOpen: "Open",
    statusDone: "Done",
    empty: "No tasks remain.",
    dockTitle: "Support assistant",
    quick: ["Call the owner about the first task", "Clear the completed tasks"],
    composerTextDesc: "Enter the text for a new support task.",
    composerSubmitDesc: "Add the text in the task field to the support queue.",
    toggleDesc: (text) => `Change the completion state of “${text}”.`,
    callDesc: (text) => `Call the account owner about “${text}”.`,
    callLabel: "Call",
    called: (lastFour) => `Call prepared for account ending ${lastFour}.`,
    clearDone: "Clear completed",
    clearDesc: "Permanently remove every completed support task from this page.",
    submitReason: "The task field is empty.",
    seedTasks: [
      { text: "Review the launch checklist", done: false, phone: "+1 415 555 0137", account: "AC-1002-7788", internalNote: "Escalated by the account director" },
      { text: "Book the design review", done: false, phone: "+1 415 555 0194", account: "AC-1003-3145", internalNote: "Awaiting legal review" },
      { text: "Send the customer follow-up", done: true, phone: "+1 415 555 0168", account: "AC-1004-9921", internalNote: "Customer prefers email" },
    ],
    stats: (open) => `${open} open`,
    systemPrompt: "You are the assistant for a small support-task page. Keep answers short.",
    textParamLabel: "Task text",
    phoneParamLabel: "Phone number",
    recordLabel: (text) => `Task: ${text}`,
    gatewayTitle: "Gateway session",
    gatewayLead: "The provider key and model allowlist stay in the server process.",
    passwordLabel: "Demo password",
    signIn: "Sign in",
    signOut: "Sign out",
    signingIn: "Signing in…",
    signInFailed: "Sign-in failed. Check the gateway process and password.",
    signedIn: "Signed in. Model requests stay on this origin.",
    signedOut: "Signed out.",
  },
  zh: {
    documentTitle: "Pling 教程 · 敏感数据与危险操作",
    eyebrow: "Pling 教程 · 原生 JavaScript",
    heading: "客服任务",
    regionLabel: "客服任务",
    regionDescription: "客服任务、对应账号，以及完成或清理任务的操作。",
    newTaskLabel: "新任务",
    placeholder: "需要处理什么？",
    addTask: "添加任务",
    taskColumn: "任务",
    statusColumn: "状态",
    contactColumn: "账号",
    actionColumn: "操作",
    openAssistant: "打开助手",
    statusOpen: "待处理",
    statusDone: "已完成",
    empty: "没有剩余任务。",
    dockTitle: "客服助手",
    quick: ["联系第一条任务的账号负责人", "清理已完成的任务"],
    composerTextDesc: "填写一条新的客服任务。",
    composerSubmitDesc: "把任务输入框中的文字加入客服队列。",
    toggleDesc: (text) => `切换“${text}”的完成状态。`,
    callDesc: (text) => `联系“${text}”对应的账号负责人。`,
    callLabel: "联系",
    called: (lastFour) => `已准备拨打尾号 ${lastFour} 的电话。`,
    clearDone: "清理已完成",
    clearDesc: "永久移除页面上所有已完成的客服任务。",
    submitReason: "任务输入框是空的。",
    seedTasks: [
      { text: "检查发布清单", done: false, phone: "+86 138 1234 5678", account: "AC-1002-7788", internalNote: "已由客户总监升级处理" },
      { text: "预约设计评审", done: false, phone: "+86 139 8765 4321", account: "AC-1003-3145", internalNote: "等待法务审核" },
      { text: "跟进客户", done: true, phone: "+86 137 2468 1357", account: "AC-1004-9921", internalNote: "客户偏好邮件联系" },
    ],
    stats: (open) => `${open} 项待处理`,
    systemPrompt: "你是一个小型客服任务页面的助手。回答保持简短。",
    textParamLabel: "任务内容",
    phoneParamLabel: "电话号码",
    recordLabel: (text) => `任务：${text}`,
    gatewayTitle: "网关会话",
    gatewayLead: "供应商密钥和模型白名单只存在于服务端进程。",
    passwordLabel: "演示密码",
    signIn: "登录",
    signOut: "退出",
    signingIn: "正在登录…",
    signInFailed: "登录失败。请检查网关进程和密码。",
    signedIn: "已登录。模型请求只访问本站同源地址。",
    signedOut: "已退出。",
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
