export type DemoLocale = "en" | "zh";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  newItem: string;
  placeholder: string;
  add: string;
  filterLabel: string;
  filterAll: string;
  filterOpen: string;
  filterCompleted: string;
  empty: string;
  emptyFiltered: string;
  openTotal: (remaining: number, total: number) => string;
  clearCompleted: (count: number) => string;
  edit: string;
  saveEdit: string;
  cancelEdit: string;
  remove: string;
  scopeLabel: string;
  scopeDescription: string;
  stateDescription: string;
  textDesc: string;
  addDesc: string;
  filterAllDesc: string;
  filterOpenDesc: string;
  filterCompletedDesc: string;
  toggleDesc: (text: string, done: boolean) => string;
  editDesc: (text: string) => string;
  editTextDesc: (text: string) => string;
  saveEditDesc: (text: string) => string;
  removeDesc: (text: string) => string;
  clearCompletedDesc: string;
  dockTitle: string;
  dockPlaceholder: string;
}

const EN: TodoCopy = {
  eyebrow: "React 16.3 · Legacy entry",
  title: "A real Todo app from before Hooks",
  subtitle: "Class components, render props, and the same Pling runtime used by modern React.",
  newItem: "New todo",
  placeholder: "What needs to happen?",
  add: "Add",
  filterLabel: "Filter todos",
  filterAll: "All",
  filterOpen: "Open",
  filterCompleted: "Completed",
  empty: "No todos yet. Add one above.",
  emptyFiltered: "Nothing matches this filter.",
  openTotal: (remaining, total) => `${remaining} open · ${total} total`,
  clearCompleted: (count) => `Clear completed (${count})`,
  edit: "Edit",
  saveEdit: "Save",
  cancelEdit: "Cancel",
  remove: "Remove",
  scopeLabel: "Todo list",
  scopeDescription: "The visible todo rows, their text, and completion state.",
  stateDescription: "A compact summary of the current Todo page.",
  textDesc: "Fill the new-todo field.",
  addDesc: "Add the text in the new-todo field.",
  filterAllDesc: "Show every todo.",
  filterOpenDesc: "Show only unfinished todos.",
  filterCompletedDesc: "Show only completed todos.",
  toggleDesc: (text, done) => `${done ? "Mark as open" : "Mark as complete"}: ${text}`,
  editDesc: (text) => `Edit the todo: ${text}`,
  editTextDesc: (text) => `Replace the todo text: ${text}`,
  saveEditDesc: (text) => `Save the edited todo: ${text}`,
  removeDesc: (text) => `Remove the todo: ${text}`,
  clearCompletedDesc: "Remove every completed todo.",
  dockTitle: "Todo assistant",
  dockPlaceholder: "Ask the assistant to update the list…",
};

const ZH: TodoCopy = {
  eyebrow: "React 16.3 · Legacy 入口",
  title: "Hooks 出现之前的真实 Todo",
  subtitle: "class 组件、render props，和现代 React 共用同一套 Pling 运行时。",
  newItem: "新建待办",
  placeholder: "接下来要做什么？",
  add: "添加",
  filterLabel: "筛选待办",
  filterAll: "全部",
  filterOpen: "未完成",
  filterCompleted: "已完成",
  empty: "还没有待办，先在上方添加一条。",
  emptyFiltered: "当前筛选下没有待办。",
  openTotal: (remaining, total) => `${remaining} 项未完成 · 共 ${total} 项`,
  clearCompleted: (count) => `清除已完成（${count}）`,
  edit: "编辑",
  saveEdit: "保存",
  cancelEdit: "取消",
  remove: "删除",
  scopeLabel: "待办列表",
  scopeDescription: "当前可见的待办行、文本和完成状态。",
  stateDescription: "当前 Todo 页面的精简摘要。",
  textDesc: "填写新待办内容。",
  addDesc: "添加新待办输入框里的内容。",
  filterAllDesc: "显示全部待办。",
  filterOpenDesc: "只显示未完成待办。",
  filterCompletedDesc: "只显示已完成待办。",
  toggleDesc: (text, done) => `${done ? "标记为未完成" : "标记为完成"}：${text}`,
  editDesc: (text) => `编辑待办：${text}`,
  editTextDesc: (text) => `替换待办内容：${text}`,
  saveEditDesc: (text) => `保存编辑后的待办：${text}`,
  removeDesc: (text) => `删除待办：${text}`,
  clearCompletedDesc: "删除全部已完成待办。",
  dockTitle: "待办助手",
  dockPlaceholder: "让助手更新这份清单……",
};

export function resolveDemoLocale(search = typeof window === "undefined" ? "" : window.location.search): DemoLocale {
  return new URLSearchParams(search).get("lang") === "zh" ? "zh" : "en";
}

export function copyFor(locale: DemoLocale): TodoCopy {
  return locale === "zh" ? ZH : EN;
}

export function initialTodos(locale: DemoLocale): TodoItem[] {
  return locale === "zh"
    ? [
        { id: "t1", text: "整理本周发布清单", done: false },
        { id: "t2", text: "先给旧版 React 页面接一个动作", done: false },
        { id: "t3", text: "确认助手可以读取待办状态", done: true },
      ]
    : [
        { id: "t1", text: "Review this week's release checklist", done: false },
        { id: "t2", text: "Wire one action into the legacy React page", done: false },
        { id: "t3", text: "Confirm the assistant can read Todo state", done: true },
      ];
}

export function quickTasks(locale: DemoLocale): readonly string[] {
  return locale === "zh"
    ? ["把第一条未完成待办标记为完成，再新增一条「周五前回复客户」", "清空全部已完成待办"]
    : ["Complete the first open todo, then add “Reply to the customer by Friday”", "Clear every completed todo"];
}
