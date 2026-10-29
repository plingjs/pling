export type DemoLocale = "en" | "zh";
export type OrderStatus = "Pending" | "Approved";
export type OrderRisk = "low" | "medium" | "high";
export type OrderFilter = "all" | "pending" | "approved" | "high";

export function resolveDemoLocale(): DemoLocale {
  const value = new URLSearchParams(window.location.search).get("lang");
  return value?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

const COPY = {
  en: {
    eyebrow: "Revenue operations",
    title: "Order queue",
    pendingTotal: (pending: number, total: number) => `${pending} pending · ${total} total`,
    hint: "Every smart action opens the same assistant sidebar.",
    smartActions: "Smart actions",
    summarize: "Summarize queue",
    triage: "Triage risk",
    approveHighest: "Approve highest risk",
    searchLabel: "Search",
    searchPlaceholder: "Order, customer, status or risk",
    scopeLabel: "Order queue",
    scopeDescription: "Pending and approved orders shown as cards",
    searchDesc: "Filter the order queue by order id, customer, status or risk",
    filters: "Queue filters",
    filterAll: "All",
    filterPending: "Pending",
    filterApproved: "Approved",
    filterHigh: "High risk",
    resetFilter: "Reset filters",
    filteredTotal: (shown: number, total: number) => `${shown} of ${total} orders shown`,
    riskLabel: (risk: OrderRisk) => `${risk} risk`,
    statusLabel: (status: OrderStatus) => status,
    explainRisk: "Explain risk",
    askInChat: "Ask in chat",
    approve: "Approve",
    approveDesc: (id: string, customer: string) => `Approve order ${id} for ${customer}`,
    openOrder: "Details",
    openOrderDesc: (id: string, customer: string) => `Open order ${id} for ${customer}`,
    closeDetails: "Close",
    closeDetailsDesc: "Close the order details panel.",
    detailEyebrow: "Order detail",
    detailOwner: "Owner",
    detailNote: "Follow-up note",
    detailNotePlaceholder: "Add a short note for the next review",
    noteDesc: (id: string) => `Enter the follow-up note for order ${id}`,
    saveNote: "Save note",
    saveNoteDesc: (id: string) => `Save the follow-up note for order ${id}`,
    saved: "Saved",
    empty: "No orders match this filter.",
    dockTitle: "Order copilot",
    dockPlaceholder: "Ask about the queue or an order…",
    summaryPrompt: "Summarize the pending orders and name the highest-risk order.",
    reviewPrompt: "Review the pending orders and tell me which ones need attention first.",
    approveHighestPrompt: "Approve the highest-risk pending order.",
    riskPrompt: (id: string, customer: string) => `Explain the risk in order ${id} for ${customer} and recommend the next action.`,
  },
  zh: {
    eyebrow: "营收运营",
    title: "订单队列",
    pendingTotal: (pending: number, total: number) => `${pending} 笔待处理 · 共 ${total} 笔`,
    hint: "每个智能入口都会打开同一个助手侧栏。",
    smartActions: "智能操作",
    summarize: "汇总队列",
    triage: "判断风险优先级",
    approveHighest: "批准最高风险订单",
    searchLabel: "搜索",
    searchPlaceholder: "订单号、客户、状态或风险",
    scopeLabel: "订单队列",
    scopeDescription: "以卡片展示的待处理与已批准订单",
    searchDesc: "按订单号、客户、状态或风险筛选订单队列",
    filters: "队列筛选",
    filterAll: "全部",
    filterPending: "待处理",
    filterApproved: "已批准",
    filterHigh: "高风险",
    resetFilter: "重置筛选",
    filteredTotal: (shown: number, total: number) => `显示 ${shown} / ${total} 笔订单`,
    riskLabel: (risk: OrderRisk) => ({ low: "低", medium: "中", high: "高" })[risk] + "风险",
    statusLabel: (status: OrderStatus) => (status === "Pending" ? "待处理" : "已批准"),
    explainRisk: "解释风险",
    askInChat: "在对话中询问",
    approve: "批准",
    approveDesc: (id: string, customer: string) => `批准 ${customer} 的订单 ${id}`,
    openOrder: "详情",
    openOrderDesc: (id: string, customer: string) => `打开 ${customer} 的订单 ${id}`,
    closeDetails: "关闭",
    closeDetailsDesc: "关闭订单详情面板。",
    detailEyebrow: "订单详情",
    detailOwner: "负责人",
    detailNote: "回访备注",
    detailNotePlaceholder: "记录下一次复核需要注意的事项",
    noteDesc: (id: string) => `填写订单 ${id} 的回访备注`,
    saveNote: "保存备注",
    saveNoteDesc: (id: string) => `保存订单 ${id} 的回访备注`,
    saved: "已保存",
    empty: "没有符合当前筛选条件的订单。",
    dockTitle: "订单助手",
    dockPlaceholder: "询问队列或某一笔订单……",
    summaryPrompt: "汇总待处理订单，并指出风险最高的一笔。",
    reviewPrompt: "检查待处理订单，告诉我哪些需要优先处理。",
    approveHighestPrompt: "批准当前风险最高的一笔待处理订单。",
    riskPrompt: (id: string, customer: string) => `解释订单 ${id}（客户 ${customer}）的风险，并建议下一步操作。`,
  },
} as const;

export function copyFor(locale: DemoLocale) {
  return COPY[locale];
}

export function quickTasks(locale: DemoLocale): readonly string[] {
  return locale === "zh"
    ? ["汇总待处理队列", "筛选高风险订单", "批准风险最高的待处理订单", "重置队列筛选"]
    : ["Summarize the pending queue", "Filter to high-risk orders", "Approve the highest-risk pending order", "Reset the queue filter"];
}
