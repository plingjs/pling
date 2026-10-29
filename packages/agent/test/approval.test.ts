import { describe, expect, it, vi } from "vitest";
import type { ConfirmRequest } from "@plingjs/core";
import { createTimedApproval, parseApprovalReply } from "../src/approval";

const request = (kind: ConfirmRequest["kind"]): ConfirmRequest => ({
  id: "delete_order",
  kind,
  approval: kind === "read" ? "none" : kind === "danger" ? "ask-always" : "ask",
  description: "删除订单",
  args: {},
});

describe("确认闸门", () => {
  it("用户点「本次批准」→ 放行", async () => {
    const confirm = createTimedApproval({ channel: async () => true });
    await expect(confirm(request("write"))).resolves.toBe(true);
  });

  it("danger 上给「始终允许」会被降级成本次批准（不给长期授权）", async () => {
    const confirm = createTimedApproval({ channel: async () => "always" });
    await expect(confirm(request("danger"))).resolves.toBe(true);
  });

  it("超时未答 → 拒绝（安全默认，不是同意）", async () => {
    const onTimeout = vi.fn();
    const confirm = createTimedApproval({
      channel: () => new Promise(() => {}), // 永不回复
      timeoutMs: 50,
      onTimeout,
      setTimer: (fn) => setTimeout(fn, 0),
    });

    await expect(confirm(request("write"))).resolves.toBe(false);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("认不出的回答 → 拒绝", () => {
    expect(parseApprovalReply("批准")).toBe(true);
    expect(parseApprovalReply("始终允许")).toBe("always");
    expect(parseApprovalReply("嗯……你说呢")).toBe(false);
    expect(parseApprovalReply("rm -rf /")).toBe(false);
  });
});
