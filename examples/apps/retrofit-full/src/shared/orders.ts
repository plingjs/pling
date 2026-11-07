export type OrderStatus = "pending" | "approved";
export type OrderRisk = "low" | "medium" | "high";
export type OrderFilter = "all" | "pending" | "approved" | "high";

export interface Order {
  id: string;
  customer: string;
  amount: number;
  status: OrderStatus;
  risk: OrderRisk;
  owner: string;
  note: string;
}

export function createSeedOrders(locale: "en" | "zh"): Order[] {
  if (locale === "zh") {
    return [
      { id: "SO-2041", customer: "Acme", amount: 12800, status: "pending", risk: "high", owner: "林舟", note: "合同条款需要法务复核。" },
      { id: "SO-2042", customer: "Globex", amount: 4200, status: "pending", risk: "medium", owner: "周宁", note: "" },
      { id: "SO-2043", customer: "Hooli", amount: 930, status: "pending", risk: "low", owner: "陈澄", note: "已确认收货地址。" },
      { id: "SO-2044", customer: "Initech", amount: 7600, status: "approved", risk: "medium", owner: "周宁", note: "季度框架合同，已批准。" },
      { id: "SO-2045", customer: "Umbrella", amount: 15400, status: "pending", risk: "high", owner: "林舟", note: "等待客户补充付款主体。" },
    ];
  }
  return [
    { id: "SO-2041", customer: "Acme", amount: 12800, status: "pending", risk: "high", owner: "Lin Zhou", note: "Legal is reviewing the contract terms." },
    { id: "SO-2042", customer: "Globex", amount: 4200, status: "pending", risk: "medium", owner: "Nina Zhou", note: "" },
    { id: "SO-2043", customer: "Hooli", amount: 930, status: "pending", risk: "low", owner: "Chen Cheng", note: "Delivery address confirmed." },
    { id: "SO-2044", customer: "Initech", amount: 7600, status: "approved", risk: "medium", owner: "Nina Zhou", note: "Quarterly framework agreement approved." },
    { id: "SO-2045", customer: "Umbrella", amount: 15400, status: "pending", risk: "high", owner: "Lin Zhou", note: "Waiting for the customer's billing entity." },
  ];
}

export function countOrders(orders: readonly Order[]): {
  total: number;
  pending: number;
  approved: number;
  highRisk: number;
  value: number;
} {
  return {
    total: orders.length,
    pending: orders.filter((order) => order.status === "pending").length,
    approved: orders.filter((order) => order.status === "approved").length,
    highRisk: orders.filter((order) => order.risk === "high").length,
    value: orders.reduce((sum, order) => sum + order.amount, 0),
  };
}

export function visibleOrders(orders: readonly Order[], filter: OrderFilter, search: string): Order[] {
  const needle = search.trim().toLocaleLowerCase();
  return orders.filter((order) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && order.status === "pending") ||
      (filter === "approved" && order.status === "approved") ||
      (filter === "high" && order.risk === "high");
    const matchesSearch =
      !needle ||
      [order.id, order.customer, order.owner, order.note, order.status, order.risk].some((value) =>
        value.toLocaleLowerCase().includes(needle),
      );
    return matchesFilter && matchesSearch;
  });
}

export function approveOrder(orders: readonly Order[], id: string): Order[] {
  return orders.map((order) => (order.id === id ? { ...order, status: "approved" } : order));
}

export function reopenOrder(orders: readonly Order[], id: string): Order[] {
  return orders.map((order) => (order.id === id ? { ...order, status: "pending" } : order));
}

export function setOrderNote(orders: readonly Order[], id: string, note: string): Order[] {
  const value = note.trim().slice(0, 240);
  return orders.map((order) => (order.id === id ? { ...order, note: value } : order));
}

export function removeOrder(orders: readonly Order[], id: string): Order[] {
  return orders.filter((order) => order.id !== id);
}

export function formatMoney(amount: number, locale: "en" | "zh"): string {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(amount);
}
