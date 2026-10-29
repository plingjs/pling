export type DemoLocale = "en" | "zh";

const copy = {
  en: {
    eyebrow: "Production release",
    title: "Ship with the guardrails still on",
    lead: "The same Todo assistant, reviewed against the conditions that often disappear during a launch: secrets, model choice, limits, telemetry, and a way back.",
    open: (count: number) => `${count} open`,
    newTask: "New task",
    add: "Add",
    region: "Todo list",
    releaseEyebrow: "Release gate",
    ready: "Ready for staged release",
    blocked: "Blocked by failed checks",
    failed: (count: number) => `${count} failed`,
    note: "This is a static preflight over the deployment configuration. It does not prove that the gateway, telemetry collector, or kill-switch endpoint is reachable. The panel is also intentionally not exposed as an action: a model should not be able to turn off a release guard.",
    dockTitle: "Todo assistant · release review",
    quick: ["What is the release status?", "Add a task to verify rollback"],
    addDescription: "Add a task to the list.",
    addParam: "Task text",
    inputDescription: "Enter the text of a new task.",
    toggle: (text: string, done: boolean) => `Mark “${text}” as ${done ? "open" : "completed"}.`,
    statusDescription: "Read the current release-readiness result. This does not change production configuration.",
    taskTexts: ["Review the release checklist", "Send the customer follow-up", "Book the design review"],
  },
  zh: {
    eyebrow: "生产上线",
    title: "上线时仍然保留护栏",
    lead: "同一个待办助手，现在按上线时最容易被放松的条件检查：密钥、模型选择、限额、遥测和退回方式。",
    open: (count: number) => `${count} 条未完成`,
    newTask: "新待办",
    add: "添加",
    region: "待办列表",
    releaseEyebrow: "发布门禁",
    ready: "可以分阶段发布",
    blocked: "有检查未通过，暂不能发布",
    failed: (count: number) => `${count} 项失败`,
    note: "这里只根据部署配置做静态预检，不能证明网关、遥测收集器或停用端点此刻真的可达。这个面板也刻意没有暴露成动作：模型不应有权关闭发布护栏。",
    dockTitle: "待办助手 · 发布检查",
    quick: ["当前发布状态如何？", "添加一条用于验证回滚的待办"],
    addDescription: "向列表中添加一条待办。",
    addParam: "待办内容",
    inputDescription: "在新待办输入框中填写内容。",
    toggle: (text: string, done: boolean) => `将“${text}”标记为${done ? "未完成" : "已完成"}。`,
    statusDescription: "读取当前发布就绪结果。此动作不会修改生产配置。",
    taskTexts: ["检查发布清单", "跟进客户", "预约设计评审"],
  },
} as const;

export function copyFor(locale: DemoLocale) {
  return copy[locale];
}
