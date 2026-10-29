export type DemoLocale = "en" | "zh";
export type Priority = "today" | "soon" | "later";

export const DEMO_LOCALES: readonly DemoLocale[] = ["en", "zh"];

export interface DemoTask {
  text: string;
  done: boolean;
  priority: Priority;
}

export interface DemoCopy {
  documentTitle: string;
  eyebrow: string;
  heading: string;
  todoRegionLabel: string;
  todoRegionDescription: string;
  composerRegionLabel: string;
  composerRegionDescription: string;
  listRegionLabel: string;
  listRegionDescription: string;
  controlsRegionLabel: string;
  controlsRegionDescription: string;
  editDialogLabel: string;
  editDialogDescription: string;
  editDialogTitle: (text: string) => string;
  editTaskAria: (text: string) => string;
  editTaskDesc: (text: string) => string;
  editTextLabel: string;
  editTextPlaceholder: string;
  editTextDesc: string;
  editSave: string;
  editSaveDesc: string;
  editSaveExpect: string;
  editCancel: string;
  editCancelDesc: string;
  editOpenBlocked: string;
  newTaskLabel: string;
  placeholder: string;
  addTask: string;
  empty: string;
  completedLabel: string;
  openLabel: string;
  filterGroupLabel: string;
  filters: { all: string; active: string; completed: string };
  searchLabel: string;
  searchPlaceholder: string;
  bulkLabel: string;
  priorities: Record<Priority, string>;
  priorityAria: string;
  dockTitle: string;
  quick: readonly string[];
  addTaskDesc: string;
  addTaskParamLabel: string;
  addTaskFullReason: string;
  addTaskExpect: string;
  selectPriorityDesc: string;
  selectPriorityParamLabel: string;
  searchTextDesc: string;
  searchEnterDesc: string;
  showAllDesc: string;
  showOpenDesc: string;
  showCompletedDesc: string;
  openBulkMenuDesc: string;
  clearCompletedDesc: string;
  clearCompletedLabel: (count: number) => string;
  completeOpenDesc: string;
  completeOpenNone: string;
  completeOpenExpect: string;
  toggleDesc: (text: string, done: boolean) => string;
  removeDesc: (text: string) => string;
  deleteTaskAria: (text: string) => string;
  seedTasks: readonly DemoTask[];
  stats: (open: number, done: number) => string;
  systemPrompt: string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    documentTitle: "Pling tutorial · React regions and overlays",
    eyebrow: "Pling tutorial · React",
    heading: "Tasks",
    todoRegionLabel: "Tasks",
    todoRegionDescription:
      "The task workspace: adding, editing, filtering, and reviewing tasks.",
    composerRegionLabel: "Task composer",
    composerRegionDescription: "Create a task and choose its priority.",
    listRegionLabel: "Task list",
    listRegionDescription:
      "Visible tasks with completion, edit, and delete actions.",
    controlsRegionLabel: "View controls",
    controlsRegionDescription: "Filtering and bulk operations for the task list.",
    editDialogLabel: "Edit task",
    editDialogDescription:
      "Rename one task. The rest of the task page is inactive while this dialog is open.",
    editDialogTitle: (text) => `Edit “${text}”`,
    editTaskAria: (text) => `Edit ${text}`,
    editTaskDesc: (text) => `Open the editor for “${text}”.`,
    editTextLabel: "Task text",
    editTextPlaceholder: "New task text",
    editTextDesc: "Replace the text of the task currently being edited.",
    editSave: "Save changes",
    editSaveDesc: "Save the task text and close the editor.",
    editSaveExpect: "The task text is updated and the editor is closed",
    editCancel: "Cancel",
    editCancelDesc: "Close the editor without changing the task.",
    editOpenBlocked:
      "Finish or cancel the open task editor before changing the task list.",
    newTaskLabel: "New task",
    placeholder: "What needs doing?",
    addTask: "Add task",
    empty: "No tasks in this view.",
    completedLabel: "completed",
    openLabel: "open",
    filterGroupLabel: "Filter tasks",
    filters: { all: "All", active: "Open", completed: "Done" },
    searchLabel: "Search tasks",
    searchPlaceholder: "Search tasks, then press Enter",
    bulkLabel: "More",
    priorities: { today: "Today", soon: "Soon", later: "Later" },
    priorityAria: "Priority for the next task",
    dockTitle: "Todo assistant",
    quick: [
      "Rename the second task to “Book the design review with Mina”",
      "Open the editor for “Review the launch checklist”",
      "Mark every open task as completed",
    ],
    addTaskDesc: "Add one task using the supplied text and the priority currently selected in the composer.",
    addTaskParamLabel: "Task text, 1–80 characters; it cannot contain only spaces",
    addTaskFullReason: "The list is full (8 tasks). Remove a task before adding another.",
    addTaskExpect: "The new task is present in the list",
    selectPriorityDesc: "Select the priority that will be used by the next task added with add_task.",
    selectPriorityParamLabel: "Priority for the next added task: today, soon, or later",
    searchTextDesc: "Enter a phrase in the task search field. This does not apply the search yet.",
    searchEnterDesc: "Press Enter in the task search field to apply the phrase already typed there.",
    showAllDesc: "Show every task, including completed tasks.",
    showOpenDesc: "Show only tasks that are not completed.",
    showCompletedDesc: "Show only completed tasks.",
    openBulkMenuDesc: "Move the pointer over More to reveal the bulk actions. Clear completed only exists while this menu is open.",
    clearCompletedDesc: "Remove all completed tasks from the list. This cannot be undone.",
    clearCompletedLabel: (count) => `Clear completed (${count})`,
    completeOpenDesc: "Mark every open task as completed. This changes all open records in one operation.",
    completeOpenNone: "There are no open tasks. Every task is already completed.",
    completeOpenExpect: "No task remains open",
    toggleDesc: (text, done) => done ? `Mark “${text}” as open.` : `Mark “${text}” as completed.`,
    removeDesc: (text) => `Delete “${text}”. This cannot be undone.`,
    deleteTaskAria: (text) => `Delete “${text}”`,
    seedTasks: [
      { text: "Review the launch checklist", done: false, priority: "today" },
      { text: "Book the design review", done: false, priority: "soon" },
      { text: "Send the customer follow-up", done: true, priority: "later" },
    ],
    stats: (open, done) => `${open} open · ${done} done`,
    systemPrompt: "You are the assistant for a small React Todo app. Keep answers short.",
  },
  zh: {
    documentTitle: "Pling 教程 · React 区域与覆盖层",
    eyebrow: "Pling 教程 · React",
    heading: "待办",
    todoRegionLabel: "待办",
    todoRegionDescription: "待办工作区：新增、编辑、筛选和查看待办。",
    composerRegionLabel: "新增待办",
    composerRegionDescription: "创建一条待办并选择优先级。",
    listRegionLabel: "待办列表",
    listRegionDescription: "当前可见的待办，以及完成、编辑和删除操作。",
    controlsRegionLabel: "视图控制",
    controlsRegionDescription: "待办列表的筛选与批量操作。",
    editDialogLabel: "编辑待办",
    editDialogDescription: "修改一条待办的文字。弹窗打开期间，待办页面的其余部分不可操作。",
    editDialogTitle: (text) => `编辑“${text}”`,
    editTaskAria: (text) => `编辑 ${text}`,
    editTaskDesc: (text) => `打开“${text}”的编辑器。`,
    editTextLabel: "待办文字",
    editTextPlaceholder: "新的待办文字",
    editTextDesc: "替换当前正在编辑的待办文字。",
    editSave: "保存修改",
    editSaveDesc: "保存待办文字并关闭编辑器。",
    editSaveExpect: "待办文字已更新，编辑器已关闭",
    editCancel: "取消",
    editCancelDesc: "关闭编辑器，不修改待办。",
    editOpenBlocked: "请先完成或取消当前编辑弹窗，再修改待办列表。",
    newTaskLabel: "新待办",
    placeholder: "需要完成什么？",
    addTask: "添加待办",
    empty: "当前视图没有待办。",
    completedLabel: "已完成",
    openLabel: "未完成",
    filterGroupLabel: "筛选待办",
    filters: { all: "全部", active: "未完成", completed: "已完成" },
    searchLabel: "搜索待办",
    searchPlaceholder: "搜索待办，然后按 Enter",
    bulkLabel: "更多",
    priorities: { today: "今天", soon: "近期", later: "稍后" },
    priorityAria: "下一条待办的优先级",
    dockTitle: "待办助手",
    quick: [
      "把第 2 条待办改名为“与 Mina 预约设计评审”",
      "打开“检查发布清单”的编辑器",
      "把所有未完成待办都标记为已完成",
    ],
    addTaskDesc: "使用提供的文本和新增区当前选中的优先级添加一条待办。",
    addTaskParamLabel: "待办内容，1–80 个字符，不能只包含空格",
    addTaskFullReason: "列表已满（8 项）。请先删除一条待办再添加。",
    addTaskExpect: "新待办已经出现在列表中",
    selectPriorityDesc: "选择下一条通过 add_task 添加的待办所使用的优先级。",
    selectPriorityParamLabel: "下一条待办的优先级：today、soon 或 later",
    searchTextDesc: "在待办搜索框中输入短语。此时还不会应用搜索。",
    searchEnterDesc: "在待办搜索框中按 Enter，应用已经输入的短语。",
    showAllDesc: "显示全部待办，包括已完成的待办。",
    showOpenDesc: "只显示尚未完成的待办。",
    showCompletedDesc: "只显示已完成的待办。",
    openBulkMenuDesc: "将指针移到“更多”上以展开批量操作。只有菜单展开时才会出现“清除已完成”。",
    clearCompletedDesc: "移除所有已完成的待办。此操作不可撤销。",
    clearCompletedLabel: (count) => `清除已完成（${count}）`,
    completeOpenDesc: "将所有未完成待办标记为已完成，并在一次操作中更新所有未完成记录。",
    completeOpenNone: "当前没有未完成待办，所有待办都已完成。",
    completeOpenExpect: "没有待办仍处于未完成状态",
    toggleDesc: (text, done) => done ? `将“${text}”标记为未完成。` : `将“${text}”标记为已完成。`,
    removeDesc: (text) => `删除“${text}”。此操作不可撤销。`,
    deleteTaskAria: (text) => `删除“${text}”`,
    seedTasks: [
      { text: "检查发布清单", done: false, priority: "today" },
      { text: "预约设计评审", done: false, priority: "soon" },
      { text: "跟进客户", done: true, priority: "later" },
    ],
    stats: (open, done) => `${open} 项未完成 · ${done} 项已完成`,
    systemPrompt: "你是一个小型 React 待办应用的页面助手。回答保持简短。",
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
