import { describe, expect, it, vi } from "vitest";
import type { ConfirmRequest } from "@plingjs/core";
import { ApprovalQueue } from "../src/approval-queue";

const request: ConfirmRequest = {
  id: "remove@order:SO-1001",
  kind: "danger",
  approval: "ask-always",
  description: "删除订单",
  args: {},
};

describe("确认队列（UI 侧的确认闸门）", () => {
  it("请求进来后 UI 能拿到待确认状态；reply 之后状态清空", async () => {
    const queue = new ApprovalQueue();
    const changes = vi.fn();
    queue.onChange(changes);

    const decision = queue.channel(request);
    expect(queue.current()?.request.id).toBe("remove@order:SO-1001");

    expect(queue.reply(false)).toBe(true);
    expect(await decision).toBe(false);
    expect(queue.current()).toBeNull();
    expect(changes).toHaveBeenCalledTimes(2); // 进入 + 清空
  });

  it("没有待确认请求时 reply 返回 false（不能把普通消息误判成批准）", () => {
    expect(new ApprovalQueue().reply(true)).toBe(false);
  });

  it("超时 → 拒绝，并且把待确认状态清掉（UI 不会一直挂着）", async () => {
    const onTimeout = vi.fn();
    const queue = new ApprovalQueue({
      timeoutMs: 50,
      onTimeout,
      setTimer: (fn) => setTimeout(fn, 0),
    });

    const decision = queue.channel(request);
    expect(await decision).toBe(false);
    expect(onTimeout).toHaveBeenCalledOnce();
    expect(queue.current()).toBeNull();
  });

  it("clear() 按拒绝处理 —— 不能让等确认的循环挂死", async () => {
    const queue = new ApprovalQueue();
    const decision = queue.channel(request);
    queue.clear();

    expect(await decision).toBe(false);
    expect(queue.current()).toBeNull();
  });

  it("write 动作的「始终允许」透传给 policy（会话内不再问）", async () => {
    const queue = new ApprovalQueue();
    const decision = queue.channel({ ...request, kind: "write" });
    queue.reply("always");
    expect(await decision).toBe("always");
  });

  it("danger 动作即使点了「始终允许」也被降级成本次批准（纵深防御）", async () => {
    const queue = new ApprovalQueue();
    const decision = queue.channel(request);
    queue.reply("always");
    expect(await decision).toBe(true);
  });
});
