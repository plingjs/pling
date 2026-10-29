import { describe, expect, it, vi } from "vitest";
import { createRegistry, normalizePage } from "../src/registry";
import { describeDiff, diffSnapshots } from "../src/diff";

describe("页面身份（S10a）", () => {
  it("只保存有界、非空的页面字段", () => {
    const registry = createRegistry();
    expect(registry.snapshot().page).toBeUndefined();

    registry.setPage({
      path: " /orders/SO-1002 ",
      title: "订单详情",
      name: "order-detail",
      params: { id: "SO-1002", long: "x".repeat(300) },
      query: { q: "SO-1002" },
      hash: "#detail",
    });

    const page = registry.snapshot().page!;
    expect(page.path).toBe("/orders/SO-1002");
    expect(page.params?.id).toBe("SO-1002");
    expect(String(page.params?.long)).toHaveLength(121);
    expect(page.query).toEqual({ q: "SO-1002" });
    expect(page.hash).toBe("#detail");
  });

  it("空对象等于清空；内容没变不重复广播", () => {
    const registry = createRegistry();
    const listener = vi.fn();
    registry.onChange(listener);

    registry.setPage({ path: "/orders", title: "订单列表" });
    expect(listener).toHaveBeenCalledTimes(1);

    registry.setPage({ path: "/orders", title: "订单列表" });
    expect(listener).toHaveBeenCalledTimes(1);

    registry.setPage({});
    expect(registry.snapshot().page).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("normalizePage 不保留空字符串与非法记录", () => {
    expect(normalizePage({ title: "  ", params: {} })).toBeUndefined();
    expect(normalizePage({ path: "/", params: {} })).toEqual({ path: "/" });
  });

  it("路由变化进入 diff，并且能被说成人话", () => {
    const registry = createRegistry();
    registry.setPage({ path: "/orders", title: "订单列表", name: "orders" });
    const before = registry.snapshot();

    registry.setPage({ path: "/orders/SO-1002", title: "订单详情", name: "order-detail", params: { id: "SO-1002" } });
    const after = registry.snapshot();
    const diff = diffSnapshots(before, after);

    expect(diff.observed).toBe(true);
    expect(diff.page?.changed).toEqual(expect.arrayContaining(["path", "title", "name", "params"]));
    expect(describeDiff(diff)).toBe(
      "页面「订单列表」(/orders) → 「订单详情」(/orders/SO-1002)",
    );
  });
});
