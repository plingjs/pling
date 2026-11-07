import { copyFor, type DemoLocale } from "./copy";

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

function storageKey(locale: DemoLocale): string {
  return locale === "zh" ? STORAGE_KEY : `${STORAGE_KEY}:${locale}`;
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    // 隐私模式 / 被策略禁用：业务仍可运行，只是刷新后回到种子数据。
    return null;
  }
}

export function loadCustomers(locale: DemoLocale = "zh"): Customer[] {
  const raw = storage()?.getItem(storageKey(locale));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length) return parsed as Customer[];
    } catch {
      // 坏数据不阻塞页面：退回种子。
    }
  }
  return copyFor(locale).seed.map((customer) => ({ ...customer }));
}

export function saveCustomers(customers: readonly Customer[], locale: DemoLocale = "zh"): void {
  try {
    storage()?.setItem(storageKey(locale), JSON.stringify(customers));
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
  locale: DemoLocale = "zh",
): Customer | undefined {
  const customer = findCustomer(customers, id);
  if (!customer) return undefined;
  if (patch.status !== undefined) customer.status = patch.status;
  if (patch.note !== undefined) customer.note = patch.note;
  saveCustomers(customers, locale);
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
