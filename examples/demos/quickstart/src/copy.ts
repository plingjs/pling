export type DemoLocale = "en" | "zh";

export function resolveDemoLocale(): DemoLocale {
  const value = new URLSearchParams(window.location.search).get("lang");
  return value?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

const COPY = {
  en: {
    eyebrow: "Today",
    title: "A normal todo page",
    openTotal: (open: number, total: number) => `${open} open · ${total} total`,
    badge: "Declared, not guessed",
    newItem: "New item",
    placeholder: "What needs to be done?",
    add: "Add",
    scopeLabel: "Todo list",
    scopeDescription: "Current todo items and their completion state",
    textDesc: "Type the text for a new todo",
    addDesc: "Add the typed todo to the list",
    toggleDesc: (text: string, done: boolean) => `Mark ${text} ${done ? "not done" : "done"}`,
    removeDesc: (text: string) => `Remove ${text} from the list`,
    remove: "Remove",
    edit: "Edit",
    editDesc: (text: string) => `Edit ${text}`,
    editTextDesc: (text: string) => `Enter the replacement text for ${text}`,
    saveEdit: "Save",
    saveEditDesc: (text: string) => `Save the edited text for ${text}`,
    cancelEdit: "Cancel",
    clearCompleted: (count: number) => `Clear completed (${count})`,
    clearCompletedDesc: "Remove every completed todo. This cannot be undone.",
    filterAll: "All",
    filterOpen: "Open",
    filterCompleted: "Completed",
    filterLabel: "Filter todos",
    empty: "Nothing here yet. Add the first item above.",
    emptyFiltered: "No todos match this filter.",
    dockTitle: "Todo assistant",
    dockPlaceholder: "Ask me to add, complete, or clean up todos…",
  },
  zh: {
    eyebrow: "今天",
    title: "一个普通的 Todo 页面",
    openTotal: (open: number, total: number) => `${open} 项未完成 · 共 ${total} 项`,
    badge: "明确声明，不靠猜测",
    newItem: "新增待办",
    placeholder: "要做什么？",
    add: "添加",
    scopeLabel: "待办列表",
    scopeDescription: "当前待办内容与完成状态",
    textDesc: "填写新待办的文本",
    addDesc: "把输入框中的待办加入列表",
    toggleDesc: (text: string, done: boolean) => `把“${text}”标记为${done ? "未完成" : "已完成"}`,
    removeDesc: (text: string) => `从列表中删除“${text}”`,
    remove: "删除",
    edit: "编辑",
    editDesc: (text: string) => `编辑“${text}”`,
    editTextDesc: (text: string) => `填写“${text}”修改后的内容`,
    saveEdit: "保存",
    saveEditDesc: (text: string) => `保存“${text}”修改后的内容`,
    cancelEdit: "取消",
    clearCompleted: (count: number) => `清除已完成 (${count})`,
    clearCompletedDesc: "删除全部已完成的待办。此操作不可撤销。",
    filterAll: "全部",
    filterOpen: "未完成",
    filterCompleted: "已完成",
    filterLabel: "筛选待办",
    empty: "这里还没有待办。请在上方添加第一条。",
    emptyFiltered: "当前筛选条件下没有待办。",
    dockTitle: "待办助手",
    dockPlaceholder: "让助手新增、完成或清理待办……",
  },
} as const;

export function copyFor(locale: DemoLocale) {
  return COPY[locale];
}

export function initialTodos(locale: DemoLocale) {
  return locale === "zh"
    ? [
        { id: "t1", text: "检查上线清单", done: false },
        { id: "t2", text: "回复客户跟进邮件", done: true },
        { id: "t3", text: "预约设计评审", done: false },
      ]
    : [
        { id: "t1", text: "Review the launch checklist", done: false },
        { id: "t2", text: "Send the customer follow-up", done: true },
        { id: "t3", text: "Book the design review", done: false },
      ];
}

export function quickTasks(locale: DemoLocale): readonly string[] {
  return locale === "zh"
    ? ["新增“发送项目进度更新”", "完成下一条未完成待办", "删除所有已完成待办", "现在还有哪些待办没有完成？"]
    : [
        "Add “Send the project update”",
        "Mark the next unfinished item complete",
        "Remove completed items",
        "What is still open?",
      ];
}
