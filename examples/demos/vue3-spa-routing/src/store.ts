import { computed, ref } from "vue";
import type { AccountStatus, DemoLocale, Risk } from "./copy";

export interface Account {
  id: string;
  name: string;
  segment: string;
  owner: string;
  risk: Risk;
  status: AccountStatus;
  revenue: number;
  lastContact: string;
  note: string;
}

export interface Activity {
  id: string;
  at: string;
  text: string;
}

function seedAccounts(locale: DemoLocale): Account[] {
  const zh = locale === "zh";
  return [
    { id: "a1", name: "Northwind", segment: zh ? "企业版" : "Enterprise", owner: zh ? "林舟" : "Lin Zhou", risk: "high", status: "open", revenue: 168000, lastContact: zh ? "7 天前" : "7 days ago", note: zh ? "等待安全问卷回复。" : "Waiting for the security questionnaire." },
    { id: "a2", name: "Globex", segment: zh ? "成长版" : "Growth", owner: zh ? "周宁" : "Zhou Ning", risk: "medium", status: "reviewing", revenue: 92000, lastContact: zh ? "2 天前" : "2 days ago", note: zh ? "采购正在确认续约范围。" : "Procurement is confirming the renewal scope." },
    { id: "a3", name: "Initech", segment: zh ? "企业版" : "Enterprise", owner: zh ? "陈澄" : "Chen Cheng", risk: "high", status: "open", revenue: 214000, lastContact: zh ? "11 天前" : "11 days ago", note: zh ? "需要安排一次技术复盘。" : "A technical review is overdue." },
    { id: "a4", name: "Hooli", segment: zh ? "团队版" : "Team", owner: zh ? "林舟" : "Lin Zhou", risk: "low", status: "reviewed", revenue: 38000, lastContact: zh ? "昨天" : "Yesterday", note: zh ? "使用稳定，无待办。" : "Healthy; no follow-up needed." },
    { id: "a5", name: "Umbrella", segment: zh ? "企业版" : "Enterprise", owner: zh ? "周宁" : "Zhou Ning", risk: "medium", status: "open", revenue: 126000, lastContact: zh ? "5 天前" : "5 days ago", note: zh ? "新管理员需要培训。" : "The new administrator needs onboarding." },
    { id: "a6", name: "Soylent", segment: zh ? "成长版" : "Growth", owner: zh ? "陈澄" : "Chen Cheng", risk: "low", status: "reviewing", revenue: 57000, lastContact: zh ? "4 天前" : "4 days ago", note: zh ? "核对本季度用量。" : "Review this quarter's usage." },
    { id: "a7", name: "Vandelay", segment: zh ? "团队版" : "Team", owner: zh ? "林舟" : "Lin Zhou", risk: "high", status: "reviewed", revenue: 44000, lastContact: zh ? "今天" : "Today", note: zh ? "已确认到期时间。" : "Renewal date confirmed." },
    { id: "a8", name: "Wayne", segment: zh ? "企业版" : "Enterprise", owner: zh ? "周宁" : "Zhou Ning", risk: "medium", status: "open", revenue: 188000, lastContact: zh ? "9 天前" : "9 days ago", note: zh ? "等待法务反馈。" : "Waiting for legal feedback." },
  ];
}

export function createAccountStore(locale: DemoLocale) {
  const accounts = ref<Account[]>(seedAccounts(locale));
  const activities = ref<Activity[]>([
    {
      id: "e1",
      at: locale === "zh" ? "今天 09:10" : "Today 09:10",
      text: locale === "zh" ? "系统导入本周账户复核队列。" : "The weekly account review queue was imported.",
    },
  ]);
  let sequence = 1;

  const openCount = computed(() => accounts.value.filter((account) => account.status !== "reviewed").length);
  const highRiskCount = computed(() => accounts.value.filter((account) => account.risk === "high").length);

  function find(id: string): Account | undefined {
    return accounts.value.find((account) => account.id === id);
  }

  function log(text: string): void {
    activities.value.unshift({
      id: `e${++sequence}`,
      at: locale === "zh" ? "刚刚" : "Just now",
      text,
    });
  }

  function setStatus(id: string, status: AccountStatus): boolean {
    const account = find(id);
    if (!account || account.status === status) return false;
    account.status = status;
    log(
      locale === "zh"
        ? `把“${account.name}”的状态改为${status === "open" ? "待处理" : status === "reviewing" ? "复核中" : "已复核"}。`
        : `Changed ${account.name} to ${status}.`,
    );
    return true;
  }

  function saveNote(id: string, note: string): boolean {
    const account = find(id);
    const value = note.trim();
    if (!account) return false;
    account.note = value;
    log(locale === "zh" ? `更新了“${account.name}”的下一步备注。` : `Updated the next-step note for ${account.name}.`);
    return true;
  }

  return { accounts, activities, openCount, highRiskCount, find, setStatus, saveNote, log };
}

export type AccountStore = ReturnType<typeof createAccountStore>;
