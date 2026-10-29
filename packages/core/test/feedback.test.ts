import { describe, expect, it, vi } from "vitest";
import { createRegistry, DEFAULT_FEEDBACK_LIMITS } from "../src/registry";

describe("页面反馈（只读数据）", () => {
  it("声明后进入快照，带字段 / 级别 / 来源", () => {
    const registry = createRegistry();
    registry.declareFeedback({
      id: "customer_required",
      message: "客户不能为空",
      field: "customer",
      severity: "error",
    });

    expect(registry.snapshot().feedback).toEqual([
      {
        id: "customer_required",
        message: "客户不能为空",
        field: "customer",
        severity: "error",
        source: "declared",
      },
    ]);
    expect(registry.snapshot().feedbackTotal).toBe(1);
  });

  it("动态 message / field / severity：每次快照重新读", () => {
    const registry = createRegistry();
    let message = "金额必须大于 0";
    let field = "amount";
    let severity: "error" | "warning" = "error";
    registry.declareFeedback({
      id: "amount_invalid",
      message: () => message,
      field: () => field,
      severity: () => severity,
    });

    expect(registry.snapshot().feedback[0]).toMatchObject({ message, field, severity });
    message = "金额最多 10000";
    field = "amountMax";
    severity = "warning";
    expect(registry.snapshot().feedback[0]).toMatchObject({ message, field, severity });
  });

  it("带区域路径：区域不活跃时不出现在 feedback 里，但总数照实报", () => {
    const registry = createRegistry();
    registry.declareScope({ id: "page", label: "订单后台" });
    registry.declareScope({ id: "form", label: "新建订单", parent: "page" });
    registry.declareFeedback({ id: "customer_required", message: "客户不能为空", scope: "form" });

    let snapshot = registry.snapshot();
    expect(snapshot.feedback).toEqual([]);
    expect(snapshot.feedbackTotal).toBe(1);

    registry.setActiveScopes(["page", "form"]);
    snapshot = registry.snapshot();
    expect(snapshot.feedback[0]).toMatchObject({ scope: "form", scopePath: ["订单后台", "新建订单"] });
  });

  it("条数与消息长度都有上限，超出时仍报总数", () => {
    const registry = createRegistry({ feedbackLimits: { maxFeedback: 2, maxMessage: 10 } });
    for (let index = 1; index <= 5; index += 1) {
      registry.declareFeedback({ id: `f${index}`, message: `第 ${index} 条非常非常长的反馈` });
    }

    const snapshot = registry.snapshot();
    expect(snapshot.feedback).toHaveLength(2);
    expect(snapshot.feedbackTotal).toBe(5);
    expect((snapshot.feedback[0]!.message as string).length).toBe(11); // 10 + 「…」
  });

  it("同一区域、同一字段、同一句话只留一条，且显式声明优先", () => {
    const registry = createRegistry();
    registry.declareFeedback({ id: "a", message: "客户不能为空", field: "customer" });
    registry.declareFeedback({ id: "b", message: "客户不能为空", field: "customer", source: "aria" });

    expect(registry.snapshot().feedback).toHaveLength(1);
    expect(registry.snapshot().feedback[0]).toMatchObject({ id: "a", source: "declared" });
    expect(registry.snapshot().feedbackTotal).toBe(2);
  });

  it("不同 scope 下同一句话是两条反馈", () => {
    const registry = createRegistry();
    registry.declareScope({ id: "left", label: "左表单" });
    registry.declareScope({ id: "right", label: "右表单" });
    registry.declareFeedback({ id: "left_required", message: "请先填写", field: "text", scope: "left" });
    registry.declareFeedback({ id: "right_required", message: "请先填写", field: "text", scope: "right" });
    registry.setActiveScopes(["left", "right"]);

    expect(registry.snapshot().feedback.map((item) => [item.id, item.scope])).toEqual([
      ["left_required", "left"],
      ["right_required", "right"],
    ]);
  });

  it("重复 id 先到先得；注销第一份后第二份接棒", () => {
    const registry = createRegistry();
    const unbindFirst = registry.declareFeedback({ id: "same", message: "先来的" });
    registry.declareFeedback({ id: "same", message: "后来的" });

    expect(registry.snapshot().feedback[0]!.message).toBe("先来的");
    unbindFirst();
    expect(registry.snapshot().feedback[0]!.message).toBe("后来的");
  });

  it("消息读失败不能把快照搞崩", () => {
    const registry = createRegistry();
    registry.declareFeedback({
      id: "boom",
      message: () => {
        throw new Error("读不动");
      },
    });

    expect(() => registry.snapshot()).not.toThrow();
    expect(registry.snapshot().feedback[0]!.message).toContain("读不动");
  });

  it("声明 / 注销都会通知，并遵守默认上限", () => {
    const registry = createRegistry();
    const onChange = vi.fn();
    registry.onChange(onChange);
    const unbind = registry.declareFeedback({ id: "f", message: "x" });
    expect(onChange).toHaveBeenCalledTimes(1);
    unbind();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(DEFAULT_FEEDBACK_LIMITS.maxFeedback).toBeGreaterThan(0);
  });
});
