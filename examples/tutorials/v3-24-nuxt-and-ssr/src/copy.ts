export type DemoLocale = "en" | "zh";

const copy = {
  en: {
    eyebrow: "Server-rendered first paint",
    title: "The page renders before the assistant exists",
    lead: "The server sends the Todo HTML. The client creates Pling, attaches the capability layer, and leaves the business component in place.",
    counter: (open: number) => `${open} open`,
    completed: (count: number) => `${count} completed`,
    newTask: "New task",
    add: "Add",
    clear: "Clear completed",
    toggle: (text: string, done: boolean) => `Mark “${text}” as ${done ? "open" : "completed"}.`,
    overview: "Read the current Todo counts and records.",
    addDescription: "Add a task with the supplied text.",
    clearDescription: "Delete every completed task after explicit confirmation.",
    taskLabel: "Task text",
    dockTitle: "Todo assistant · SSR boundary",
    quick: ["What is still open?", "Add a task called Hydration check"],
    clientNote: "The assistant is created only on the client. The server never resolves DOM actions or runs the loop.",
  },
  zh: {
    eyebrow: "服务端首屏",
    title: "页面先渲染，助手随后接入",
    lead: "服务端先返回待办 HTML。客户端再创建 Pling、接上能力层，业务组件保持不变。",
    counter: (open: number) => `${open} 条未完成`,
    completed: (count: number) => `${count} 条已完成`,
    newTask: "新待办",
    add: "添加",
    clear: "清除已完成",
    toggle: (text: string, done: boolean) => `将“${text}”标记为${done ? "未完成" : "已完成"}。`,
    overview: "读取当前待办计数和记录。",
    addDescription: "用给定文本新增一条待办。",
    clearDescription: "经过明确确认后，删除所有已完成的待办。",
    taskLabel: "待办内容",
    dockTitle: "待办助手 · SSR 边界",
    quick: ["现在还有什么没完成？", "添加一条“检查水合结果”"],
    clientNote: "助手只在客户端创建。服务端不会解析 DOM 动作，也不会运行 Agent 循环。",
  },
} as const;

export function copyFor(locale: DemoLocale) {
  return copy[locale];
}
