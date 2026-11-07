import { describe, expect, it } from "vitest";
import {
  approveOrder,
  countOrders,
  createSeedOrders,
  removeOrder,
  reopenOrder,
  setOrderNote,
  visibleOrders,
} from "../src/shared/orders";

describe("Northstar order operations", () => {
  it("filters by status, risk, and free text", () => {
    const orders = createSeedOrders("en");
    expect(visibleOrders(orders, "pending", "").every((order) => order.status === "pending")).toBe(true);
    expect(visibleOrders(orders, "high", "").every((order) => order.risk === "high")).toBe(true);
    expect(visibleOrders(orders, "all", "Globex").map((order) => order.id)).toEqual(["SO-2042"]);
  });

  it("counts the queue and tracks approvals without mutating the input", () => {
    const orders = createSeedOrders("en");
    const before = structuredClone(orders);
    const approved = approveOrder(orders, "SO-2042");
    expect(orders).toEqual(before);
    expect(countOrders(approved).pending).toBe(countOrders(orders).pending - 1);
    expect(approved.find((order) => order.id === "SO-2042")?.status).toBe("approved");
    expect(reopenOrder(approved, "SO-2042").find((order) => order.id === "SO-2042")?.status).toBe("pending");
  });

  it("writes a bounded note and deletes by stable order id", () => {
    const orders = createSeedOrders("zh");
    const noted = setOrderNote(orders, "SO-2042", "  客户确认周五回电  ");
    expect(noted.find((order) => order.id === "SO-2042")?.note).toBe("客户确认周五回电");
    expect(removeOrder(noted, "SO-2042").some((order) => order.id === "SO-2042")).toBe(false);
  });
});
