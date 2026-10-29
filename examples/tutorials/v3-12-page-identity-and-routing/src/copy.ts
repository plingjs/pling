export type DemoLocale = "en" | "zh";
export type Priority = "today" | "soon" | "later";

export interface DemoCopy {
  pageTitle: (route: string | undefined) => string;
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
  editTaskLabel: (text: string) => string;
  editTaskDesc: (text: string) => string;
  editNoteLabel: string;
  editNotePlaceholder: string;
  editNoteDesc: string;
  editSave: string;
  editSaveDesc: string;
  editCancel: string;
  editCancelDesc: string;
  editOpenBlocked: string;
  newTaskLabel: string;
  newTaskPlaceholder: string;
  addTask: string;
  empty: string;
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
  addTaskFull: (max: number) => string;
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
  completeOpenDesc: string;
  completeOpenNone: string;
  completeOpenExpect: string;
  toggleTaskDesc: (text: string, done: boolean) => string;
  removeTaskDesc: (text: string) => string;
  openTaskLabel: (text: string) => string;
  openTaskDesc: (text: string) => string;
  seedTasks: readonly { text: string; done: boolean; priority: Priority }[];
  stats: (open: number, done: number) => string;
  deleteTask: (text: string) => string;
  clearCompletedLabel: (count: number) => string;
  stateDescription: string;
  detailEyebrow: string;
  detailRegionLabel: string;
  detailRegionDescription: string;
  detailPathHint: (id: string) => string;
  detailIdLabel: string;
  detailStatusLabel: string;
  detailPriorityLabel: string;
  statusOpen: string;
  statusCompleted: string;
  markCompleted: string;
  markOpen: string;
  toggleDetailDesc: (text: string, done: boolean) => string;
  toggleDetailExpect: string;
  backToTasks: string;
  backToTasksDesc: string;
  detailStateDescription: string;
  missingTask: string;
  missingTaskDescription: string;
  missingTaskBody: (id: string) => string;
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    pageTitle: (route) => (route === "task-detail" ? "Task detail" : "Tasks"),
    eyebrow: "Pling tutorial",
    heading: "Tasks",
    todoRegionLabel: "Tasks",
    todoRegionDescription:
      "The task workspace: adding, editing, filtering, and reviewing tasks.",
    composerRegionLabel: "Task composer",
    composerRegionDescription: "Create a task and choose its priority.",
    listRegionLabel: "Task list",
    listRegionDescription:
      "A scrollable task list. Tasks outside the visible panel remain addressable and can be brought into view.",
    controlsRegionLabel: "View controls",
    controlsRegionDescription:
      "Search, filter, and bulk actions for the task list.",
    editDialogLabel: "Edit task",
    editDialogDescription:
      "Rename one task. The rest of the task page is inactive while this dialog is open.",
    editDialogTitle: (text) => `Edit “${text}”`,
    editTaskLabel: (text) => `Edit ${text}`,
    editTaskDesc: (text) => `Open the editor for “${text}”.`,
    editNoteLabel: "Task text",
    editNotePlaceholder: "New task text",
    editNoteDesc: "Replace the text of the task currently being edited.",
    editSave: "Save changes",
    editSaveDesc: "Save the current task text and close the editor.",
    editCancel: "Cancel",
    editCancelDesc: "Close the editor without changing the task.",
    editOpenBlocked:
      "Finish or cancel the open task editor before changing the task list.",
    newTaskLabel: "New task",
    newTaskPlaceholder: "What needs doing?",
    addTask: "Add task",
    empty: "No tasks in this view.",
    filterGroupLabel: "Filter tasks",
    filters: { all: "All", active: "Open", completed: "Done" },
    searchLabel: "Search tasks",
    searchPlaceholder: "Search tasks, then press Enter",
    bulkLabel: "More",
    priorities: { today: "Today", soon: "Soon", later: "Later" },
    priorityAria: "Priority for the next task",
    dockTitle: "Todo assistant",
    quick: [
      "Open the first task's detail page, mark it complete, then return to the list",
      "Which task is open, and which route and id do you see?",
      "Open a completed task and tell me where you landed",
    ],
    addTaskDesc: "Add one task using the supplied text and the priority currently selected in the composer.",
    addTaskParamLabel: "Task text, 1–80 characters; it cannot contain only spaces",
    addTaskFull: (max) => `The list is full (${max} tasks). Remove a task before adding another.`,
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
    completeOpenDesc: "Mark every open task as completed. This changes all open records in one operation.",
    completeOpenNone: "There are no open tasks. Every task is already completed.",
    completeOpenExpect: "No task remains open",
    toggleTaskDesc: (text, done) => `Mark “${text}” as ${done ? "open" : "completed"}.`,
    removeTaskDesc: (text) => `Delete “${text}”. This cannot be undone.`,
    openTaskLabel: (text) => `Open ${text}`,
    openTaskDesc: (text) => `Open the detail page for “${text}”.`,
    seedTasks: [
      { text: "Review the launch checklist", done: false, priority: "today" },
      { text: "Book the design review", done: false, priority: "soon" },
      { text: "Send the customer follow-up", done: true, priority: "later" },
      { text: "Prepare the sprint demo", done: false, priority: "today" },
      { text: "Reconcile the May invoice", done: false, priority: "soon" },
      { text: "Draft the onboarding notes", done: false, priority: "later" },
      { text: "Check the accessibility audit", done: false, priority: "soon" },
      { text: "Confirm the release window", done: false, priority: "today" },
      { text: "Collect feedback from support", done: false, priority: "later" },
      { text: "Update the pricing page copy", done: false, priority: "soon" },
      { text: "Archive the old design files", done: true, priority: "later" },
      { text: "Review the incident summary", done: false, priority: "today" },
      { text: "Schedule the vendor call", done: false, priority: "soon" },
      { text: "Prepare the quarterly roadmap", done: false, priority: "later" },
      { text: "Verify the backup restore", done: false, priority: "soon" },
      { text: "Tidy the analytics dashboard", done: false, priority: "later" },
      { text: "Reply to the security questionnaire", done: false, priority: "today" },
      { text: "Test the mobile checkout flow", done: false, priority: "soon" },
      { text: "Clean up the feature flags", done: false, priority: "later" },
      { text: "Send the April usage report", done: true, priority: "later" },
      { text: "Review the new support macros", done: false, priority: "soon" },
      { text: "Plan the customer webinar", done: false, priority: "later" },
      { text: "Check the invoice export", done: false, priority: "today" },
      { text: "Approve the final launch copy", done: false, priority: "soon" },
    ],
    stats: (open, done) => `${open} open · ${done} done`,
    deleteTask: (text) => `Delete ${text}`,
    clearCompletedLabel: (count) => `Clear completed (${count})`,
    stateDescription:
      "Read-only view of the current task filter, applied search, matching row count, and open/completed totals.",
    detailEyebrow: "Task detail",
    detailRegionLabel: "Task detail",
    detailRegionDescription: "One task, its current status, and the actions that apply to it.",
    detailPathHint: (id) => `This page is identified by the route parameter “${id}”.`,
    detailIdLabel: "Task id",
    detailStatusLabel: "Status",
    detailPriorityLabel: "Priority",
    statusOpen: "Open",
    statusCompleted: "Completed",
    markCompleted: "Mark completed",
    markOpen: "Mark open",
    toggleDetailDesc: (text, done) => `Mark “${text}” as ${done ? "open" : "completed"}.`,
    toggleDetailExpect: "The task status changed",
    backToTasks: "Back to tasks",
    backToTasksDesc: "Return to the task list.",
    detailStateDescription: "Read-only view of this task's id, availability, status, and priority.",
    missingTask: "Task not found",
    missingTaskDescription: "The requested task id does not exist in the current task store.",
    missingTaskBody: (id) => `No task with id “${id}” is available.`,
  },
  zh: {
    pageTitle: (route) => (route === "task-detail" ? "待办详情" : "待办"),
    eyebrow: "Pling 教程",
    heading: "待办",
    todoRegionLabel: "待办",
    todoRegionDescription: "待办工作区：新增、编辑、筛选和查看待办。",
    composerRegionLabel: "新增待办",
    composerRegionDescription: "创建一条待办并选择优先级。",
    listRegionLabel: "待办列表",
    listRegionDescription:
      "可滚动的待办列表。可见范围之外的待办仍可被引用，并可在执行前滚动到视野内。",
    controlsRegionLabel: "视图控件",
    controlsRegionDescription: "待办列表的搜索、筛选和批量操作。",
    editDialogLabel: "编辑待办",
    editDialogDescription:
      "修改一条待办的文字。弹窗打开期间，待办页面的其余部分不可操作。",
    editDialogTitle: (text) => `编辑“${text}”`,
    editTaskLabel: (text) => `编辑 ${text}`,
    editTaskDesc: (text) => `打开“${text}”的编辑弹窗。`,
    editNoteLabel: "待办内容",
    editNotePlaceholder: "新的待办内容",
    editNoteDesc: "替换当前正在编辑的待办文字。",
    editSave: "保存修改",
    editSaveDesc: "保存当前待办文字并关闭编辑弹窗。",
    editCancel: "取消",
    editCancelDesc: "关闭编辑弹窗，不修改待办。",
    editOpenBlocked: "请先完成或取消当前编辑弹窗，再修改待办列表。",
    newTaskLabel: "新待办",
    newTaskPlaceholder: "需要完成什么？",
    addTask: "添加待办",
    empty: "当前视图没有待办。",
    filterGroupLabel: "筛选待办",
    filters: { all: "全部", active: "未完成", completed: "已完成" },
    searchLabel: "搜索待办",
    searchPlaceholder: "搜索待办，然后按 Enter",
    bulkLabel: "更多",
    priorities: { today: "今天", soon: "近期", later: "稍后" },
    priorityAria: "下一条待办的优先级",
    dockTitle: "待办助手",
    quick: [
      "打开第一条待办的详情页，标记为已完成，然后返回列表",
      "当前打开的是哪条待办？你看到的路由和 id 是什么？",
      "打开一条已完成的待办，告诉我你落在了哪个页面",
    ],
    addTaskDesc: "使用提供的文本和新增区当前选中的优先级添加一条待办。",
    addTaskParamLabel: "待办内容，1–80 个字符，不能只包含空格",
    addTaskFull: (max) => `列表已满（${max} 项）。请先删除一条待办再添加。`,
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
    completeOpenDesc: "将所有未完成待办标记为已完成，并在一次操作中更新所有未完成记录。",
    completeOpenNone: "当前没有未完成待办，所有待办都已完成。",
    completeOpenExpect: "没有待办仍处于未完成状态",
    toggleTaskDesc: (text, done) => `将“${text}”标记为${done ? "未完成" : "已完成"}。`,
    removeTaskDesc: (text) => `删除“${text}”。此操作不可撤销。`,
    openTaskLabel: (text) => `打开 ${text}`,
    openTaskDesc: (text) => `打开“${text}”的详情页。`,
    seedTasks: [
      { text: "检查发布清单", done: false, priority: "today" },
      { text: "预约设计评审", done: false, priority: "soon" },
      { text: "跟进客户", done: true, priority: "later" },
      { text: "准备迭代演示", done: false, priority: "today" },
      { text: "核对五月发票", done: false, priority: "soon" },
      { text: "起草新用户引导说明", done: false, priority: "later" },
      { text: "复核无障碍审计结果", done: false, priority: "soon" },
      { text: "确认发布窗口", done: false, priority: "today" },
      { text: "收集支持团队反馈", done: false, priority: "later" },
      { text: "更新价格页文案", done: false, priority: "soon" },
      { text: "归档旧版设计文件", done: true, priority: "later" },
      { text: "整理事故复盘摘要", done: false, priority: "today" },
      { text: "安排供应商会议", done: false, priority: "soon" },
      { text: "准备季度路线图", done: false, priority: "later" },
      { text: "验证备份恢复流程", done: false, priority: "soon" },
      { text: "整理分析看板", done: false, priority: "later" },
      { text: "回复安全问卷", done: false, priority: "today" },
      { text: "测试移动端结算流程", done: false, priority: "soon" },
      { text: "清理功能开关", done: false, priority: "later" },
      { text: "发送四月使用报告", done: true, priority: "later" },
      { text: "复核新版客服话术", done: false, priority: "soon" },
      { text: "策划客户线上分享会", done: false, priority: "later" },
      { text: "检查发票导出", done: false, priority: "today" },
      { text: "确认发布文案终稿", done: false, priority: "soon" },
    ],
    stats: (open, done) => `${open} 项未完成 · ${done} 项已完成`,
    deleteTask: (text) => `删除 ${text}`,
    clearCompletedLabel: (count) => `清除已完成 (${count})`,
    stateDescription: "只读展示当前筛选、已应用的搜索、匹配条数，以及未完成和已完成总数。",
    detailEyebrow: "待办详情",
    detailRegionLabel: "待办详情",
    detailRegionDescription: "单条待办的当前状态，以及可用于这条待办的操作。",
    detailPathHint: (id) => `这个页面由路由参数“${id}”标识。`,
    detailIdLabel: "待办 id",
    detailStatusLabel: "状态",
    detailPriorityLabel: "优先级",
    statusOpen: "未完成",
    statusCompleted: "已完成",
    markCompleted: "标记为已完成",
    markOpen: "标记为未完成",
    toggleDetailDesc: (text, done) => `将“${text}”标记为${done ? "未完成" : "已完成"}。`,
    toggleDetailExpect: "待办状态已经变化",
    backToTasks: "返回列表",
    backToTasksDesc: "返回待办列表。",
    detailStateDescription: "只读展示这条待办的 id、是否存在、状态和优先级。",
    missingTask: "没有找到待办",
    missingTaskDescription: "请求的待办 id 不在当前待办数据中。",
    missingTaskBody: (id) => `没有找到 id 为“${id}”的待办。`,
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
