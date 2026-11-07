import type { CustomerStatus } from "./data";

export type DemoLocale = "en" | "zh";

export const DEMO_LOCALES: readonly DemoLocale[] = ["en", "zh"];

export interface DemoCopy {
  listDocumentTitle: string;
  detailDocumentTitle: string;
  listPageTitle: string;
  detailPageTitle: (name: string) => string;
  listEyebrow: string;
  listHeading: string;
  listLede: string;
  pendingLabel: string;
  boardHeading: string;
  customerTotal: (count: number) => string;
  ownerLine: (owner: string, phone: string) => string;
  noNote: string;
  openLabel: string;
  openDesc: (name: string) => string;
  listRegionLabel: string;
  listRegionDescription: string;
  listStateDescription: string;
  listFooterTitle: string;
  listFooterText: string;
  dockTitle: string;
  listPlaceholder: string;
  listQuick: readonly string[];
  detailEyebrow: string;
  detailLede: string;
  backLabel: string;
  detailRegionLabel: string;
  detailRegionDescription: string;
  ownerField: string;
  phoneField: string;
  statusField: string;
  noteLabel: string;
  notePlaceholder: string;
  saveLabel: string;
  archiveLabel: string;
  noteDesc: string;
  noteParamLabel: string;
  saveDesc: string;
  archiveDesc: string;
  archivedReason: string;
  backDesc: string;
  emptyNoteFeedback: string;
  noteSavedFeedback: string;
  archivedFeedback: string;
  detailStateDescription: string;
  detailFooterTitle: string;
  detailFooterText: string;
  detailPlaceholder: string;
  detailQuick: readonly string[];
  status: Record<CustomerStatus, string>;
  seed: readonly {
    id: string;
    name: string;
    owner: string;
    phone: string;
    status: CustomerStatus;
    note: string;
  }[];
}

const COPY: Record<DemoLocale, DemoCopy> = {
  en: {
    listDocumentTitle: "Customer follow-ups · Pling MPA continuity",
    detailDocumentTitle: "Customer detail · Pling MPA continuity",
    listPageTitle: "Customer follow-ups",
    detailPageTitle: (name) => `${name} · Customer detail`,
    listEyebrow: "MPA continuity · Page A / List",
    listHeading: "Customer follow-ups",
    listLede:
      "This is an ordinary multi-page list. “View details” really unloads the current document and starts a fresh runtime in the same tab. Pling carries the task; it does not take over business data.",
    pendingLabel: "pending",
    boardHeading: "Customers due this week",
    customerTotal: (count) => `${count} customers`,
    ownerLine: (owner, phone) => `Owner ${owner} · ${phone}`,
    noNote: "No follow-up note yet.",
    openLabel: "View details →",
    openDesc: (name) => `Open ${name}'s detail page with a full-document navigation.`,
    listRegionLabel: "Customer list",
    listRegionDescription:
      "One row per customer, with the owner, follow-up status, and latest note.",
    listStateDescription:
      "Customer follow-up list: total customers, pending count, and each customer's status and note.",
    listFooterTitle: "How to check continuity",
    listFooterText:
      "Ask the assistant to set Globex's note to “Friday dinner”. It opens the detail page as a normal document navigation; the next page resumes the task, saves the note, and returns to this list.",
    dockTitle: "Customer assistant",
    listPlaceholder: "For example: Set Globex's note to “Friday dinner”",
    listQuick: ["Set Globex's note to “Friday dinner”"],
    detailEyebrow: "MPA continuity · Page B / Detail",
    detailLede:
      "This runtime lives in a new document. Pling restores the task goal and conversation from the same tab, while this page declares its own actions, records, and state.",
    backLabel: "← Back to list",
    detailRegionLabel: "Customer detail",
    detailRegionDescription:
      "The selected customer's profile, follow-up note, and archive action.",
    ownerField: "Owner",
    phoneField: "Phone",
    statusField: "Follow-up status",
    noteLabel: "Follow-up note",
    notePlaceholder: "Record the outcome of this follow-up…",
    saveLabel: "Save note",
    archiveLabel: "Archive customer",
    noteDesc: "Enter the follow-up note for the current customer.",
    noteParamLabel: "Follow-up note",
    saveDesc:
      "Save the current follow-up note. A pending customer becomes visited after saving.",
    archiveDesc:
      "Archive the current customer. This cannot be undone, and archived customers are no longer pending.",
    archivedReason: "This customer is already archived.",
    backDesc: "Return to the customer list with a full-document navigation.",
    emptyNoteFeedback: "The note is empty. Add some text first.",
    noteSavedFeedback: "Note saved.",
    archivedFeedback: "Customer archived.",
    detailStateDescription:
      "Current customer detail: identity, follow-up status, and the saved note.",
    detailFooterTitle: "Safety boundary",
    detailFooterText:
      "Archiving requires confirmation. A pending approval is not restored after navigation: the interrupted step is recorded as “outcome unknown”, so the model must inspect the new page first.",
    detailPlaceholder: "For example: Change the note to “Friday dinner” and save it",
    detailQuick: ["Change the note to “Friday dinner” and save it"],
    status: { "待跟进": "Pending", "已回访": "Visited", "已归档": "Archived" },
    seed: [
      { id: "c1", name: "ACME", owner: "Lin Zhou", phone: "138 0000 1001", status: "待跟进", note: "" },
      { id: "c2", name: "Globex", owner: "Yi Zhou", phone: "138 0000 1002", status: "待跟进", note: "" },
      { id: "c3", name: "Hooli", owner: "Mo Chen", phone: "138 0000 1003", status: "已回访", note: "Called last week; waiting for budget confirmation." },
      { id: "c4", name: "Initech", owner: "Lin Zhou", phone: "138 0000 1004", status: "已归档", note: "Contract signed; moved to delivery." },
    ],
  },
  zh: {
    listDocumentTitle: "客户回访 · Pling MPA continuity",
    detailDocumentTitle: "客户详情 · Pling MPA continuity",
    listPageTitle: "客户回访",
    detailPageTitle: (name) => `${name} · 客户详情`,
    listEyebrow: "MPA continuity · 页面 A / 列表",
    listHeading: "客户回访",
    listLede:
      "这是一张普通的服务端多页列表。点「查看详情」会真的卸载当前 document，浏览器新开一次运行时。Pling 只接任务，不接管业务数据。",
    pendingLabel: "待跟进",
    boardHeading: "本周需要回访的客户",
    customerTotal: (count) => `${count} 位`,
    ownerLine: (owner, phone) => `负责人 ${owner} · ${phone}`,
    noNote: "还没有回访备注。",
    openLabel: "查看详情 →",
    openDesc: (name) => `打开客户 ${name} 的详情页（整页导航）`,
    listRegionLabel: "客户列表",
    listRegionDescription: "每一行是一位客户，包含负责人、回访状态和上一次的备注",
    listStateDescription: "客户回访列表：总数、待跟进数与每位客户的状态 / 备注",
    listFooterTitle: "怎么验证连续性",
    listFooterText:
      "让助手「Globex的备注为：周五约吃饭」。它点击查看详情后，页面会整页跳转；详情页自动继续，保存完成后自动返回这张列表。",
    dockTitle: "客户助手",
    listPlaceholder: "例如：Globex的备注为：周五约吃饭",
    listQuick: ["Globex的备注为：周五约吃饭"],
    detailEyebrow: "MPA continuity · 页面 B / 详情",
    detailLede:
      "这是新 document 里的运行时。Pling 从同一标签页的检查点恢复目标与对话，但页面动作、记录和状态全部由本页重新声明。",
    backLabel: "← 返回列表",
    detailRegionLabel: "客户详情",
    detailRegionDescription: "当前客户的资料、回访备注与归档操作",
    ownerField: "负责人",
    phoneField: "联系电话",
    statusField: "回访状态",
    noteLabel: "回访备注",
    notePlaceholder: "记录这次回访的结论…",
    saveLabel: "保存备注",
    archiveLabel: "归档客户",
    noteDesc: "填写当前客户的回访备注",
    noteParamLabel: "回访备注",
    saveDesc: "保存当前回访备注；保存后客户状态会从「待跟进」变成「已回访」",
    archiveDesc: "归档当前客户（不可逆，归档后不再出现在待跟进里）",
    archivedReason: "当前客户已经归档。",
    backDesc: "返回客户列表（整页导航）",
    emptyNoteFeedback: "备注是空的，先写点内容。",
    noteSavedFeedback: "备注已保存。",
    archivedFeedback: "客户已归档。",
    detailStateDescription: "当前客户详情：身份、回访状态与已保存的备注",
    detailFooterTitle: "安全边界",
    detailFooterText:
      "归档需要确认；恢复时不会恢复待确认的审批。页面跳转截断的那一步会在历史里补成「结果未知」，模型必须先观察新页面。",
    detailPlaceholder: "例如：把回访备注改成「周五约吃饭」并保存",
    detailQuick: ["把回访备注改成「周五约吃饭」并保存"],
    status: { "待跟进": "待跟进", "已回访": "已回访", "已归档": "已归档" },
    seed: [
      { id: "c1", name: "ACME", owner: "林舟", phone: "138 0000 1001", status: "待跟进", note: "" },
      { id: "c2", name: "Globex", owner: "周弈", phone: "138 0000 1002", status: "待跟进", note: "" },
      { id: "c3", name: "Hooli", owner: "陈默", phone: "138 0000 1003", status: "已回访", note: "上周已电话沟通，等对方确认预算。" },
      { id: "c4", name: "Initech", owner: "林舟", phone: "138 0000 1004", status: "已归档", note: "已签约，转入交付。" },
    ],
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
