export type DemoLocale = "en" | "zh";

const copy = {
  en: {
    eyebrow: "Existing React application",
    title: "Add a capability layer without rebuilding the page",
    lead: "The Todo logic below is ordinary application code. Pling only describes which parts of the working interface an agent may use.",
    counter: (open: number) => `${open} open`,
    newTask: "New task",
    add: "Add",
    export: "Export CSV",
    exportNote: "Manual export. This operation is not available to the assistant.",
    region: "Todo list",
    regionDescription: "The existing task list and its add-task form.",
    draftDescription: "Enter the text of a new task in the existing form.",
    submitDescription: "Submit the existing new-task form.",
    listFull: (max: number) => `The list already has ${max} tasks. Remove one before adding another.`,
    addExpect: "The submitted task is present in the list.",
    toggle: (text: string, done: boolean) => `Mark “${text}” as ${done ? "open" : "completed"}.`,
    stateDescription: "Read-only summary of the existing Todo list.",
    migration: "Migration ledger",
    migrationTitle: "Integration ledger",
    migrationLead: "The page keeps its layout, handlers, and business functions. These are the areas that change.",
    steps: [
      ["Application entry", "Add one provider at the React entry."],
      ["Page region", "Name the existing list for the agent."],
      ["Form operation", "Expose the existing input and submit controls."],
      ["Row operation", "Add a record and expose each row's checkbox."],
      ["Read view", "Expose counts, not the whole component state."],
      ["Not yet exposed", "Keep export manual until its risk is reviewed."],
    ],
    dockTitle: "Todo assistant · migrated page",
    quick: ["What is still open?", "Add a task called Prepare the demo"],
  },
  zh: {
    eyebrow: "存量 React 应用",
    title: "不重写页面，补上一层能力描述",
    lead: "下面的待办逻辑就是普通业务代码。Pling 只说明页面中哪些现有能力可以交给 Agent 使用。",
    counter: (open: number) => `${open} 条未完成`,
    newTask: "新待办",
    add: "添加",
    export: "导出 CSV",
    exportNote: "人工导出。此操作不开放给助手。",
    region: "待办列表",
    regionDescription: "现有的待办列表和新增表单位置。",
    draftDescription: "在现有表单中填写一条新待办。",
    submitDescription: "提交现有的新增待办表单。",
    listFull: (max: number) => `列表已有 ${max} 条待办。请先删除一条，再继续新增。`,
    addExpect: "提交的待办已经出现在列表中。",
    toggle: (text: string, done: boolean) => `将“${text}”标记为${done ? "未完成" : "已完成"}。`,
    stateDescription: "现有待办列表的只读摘要。",
    migration: "迁移记录",
    migrationTitle: "接入清单",
    migrationLead: "页面保留原有布局、事件处理和业务函数。下面是发生变化的接入区域。",
    steps: [
      ["应用入口", "在 React 入口加一次 Provider。"],
      ["页面区域", "为现有列表命名。"],
      ["表单操作", "开放现有输入框和提交按钮。"],
      ["行操作", "增加记录声明，并开放每行勾选框。"],
      ["只读视图", "只暴露计数，不倾倒组件状态。"],
      ["暂不开放", "导出仍由人工操作，待评审风险后再决定。"],
    ],
    dockTitle: "待办助手 · 迁移后的页面",
    quick: ["现在还有什么没完成？", "添加一条“准备演示”"],
  },
} as const;

export function copyFor(locale: DemoLocale) {
  return copy[locale];
}

export function resolveDemoLocale(): DemoLocale {
  const value = new URLSearchParams(window.location.search).get("lang")?.toLowerCase();
  return value === "zh" || value === "cn" || value?.startsWith("zh-") ? "zh" : "en";
}

export function plingLocale(locale: DemoLocale): "en-US" | "zh-CN" {
  return locale === "zh" ? "zh-CN" : "en-US";
}
