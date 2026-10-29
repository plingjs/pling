/**
 * 业务数据。
 *
 * 刻意用 `sessionStorage` 而不是内存数组：MPA 的每次导航都会重建整个 JS 运行时，
 * 业务自己的数据也必须跨 document 保存，否则详情页读不到列表页选中的客户。
 * 注意这是**业务存储**，和 Pling 的任务检查点（`pling:continuity`）是两回事。
 */

export type CustomerStatus = "待跟进" | "已回访" | "已归档";

export interface Customer {
  id: string;
  name: string;
  owner: string;
  phone: string;
  status: CustomerStatus;
  note: string;
}

const STORAGE_KEY = "case062:customers";

const SEED: readonly Customer[] = [
  { id: "c1", name: "ACME", owner: "林舟", phone: "138 0000 1001", status: "待跟进", note: "" },
  { id: "c2", name: "Globex", owner: "周弈", phone: "138 0000 1002", status: "待跟进", note: "" },
  { id: "c3", name: "Hooli", owner: "陈默", phone: "138 0000 1003", status: "已回访", note: "上周已电话沟通，等对方确认预算。" },
  { id: "c4", name: "Initech", owner: "林舟", phone: "138 0000 1004", status: "已归档", note: "已签约，转入交付。" },
];

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    // 隐私模式 / 被策略禁用：业务仍可运行，只是刷新后回到种子数据。
    return null;
  }
}

export function loadCustomers(): Customer[] {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length) return parsed as Customer[];
    } catch {
      // 坏数据不阻塞页面：退回种子。
    }
  }
  return SEED.map((customer) => ({ ...customer }));
}

export function saveCustomers(customers: readonly Customer[]): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(customers));
  } catch {
    // 配额 / 隐私模式：内存里的状态仍然是当前页的真相。
  }
}

export function findCustomer(customers: readonly Customer[], id: string): Customer | undefined {
  return customers.find((customer) => customer.id === id);
}

export function updateCustomer(
  customers: Customer[],
  id: string,
  patch: Partial<Pick<Customer, "status" | "note">>,
): Customer | undefined {
  const customer = findCustomer(customers, id);
  if (!customer) return undefined;
  if (patch.status !== undefined) customer.status = patch.status;
  if (patch.note !== undefined) customer.note = patch.note;
  saveCustomers(customers);
  return customer;
}

export function detailHref(id: string): string {
  const href = `./detail.html?id=${encodeURIComponent(id)}`;
  if (typeof location === "undefined") return href;
  const lang = new URL(location.href).searchParams.get("lang");
  return lang ? `${href}&lang=${encodeURIComponent(lang)}` : href;
}

export function idFromSearch(search: string, fallback = "c1"): string {
  return new URLSearchParams(search).get("id") ?? fallback;
}
