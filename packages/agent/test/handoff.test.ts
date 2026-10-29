import { describe, expect, it, vi } from "vitest";
import { createPolicy, type HandoffGate } from "@plingjs/core";
import { createAgentLoop } from "../src/loop";
import { createHandoffQueue } from "../src/handoff";
import { createReplayLlm } from "../src/replay";
import { collectEvents, makeRegistry, noSettle, ofType } from "./helpers";

/**
 * 人工接力（S5）在 agent 层：
 *   - 执行器触发接力时，循环发 `handoff` 事件（requested → completed/cancelled/timeout）；
 *   - 模型拿到的工具回执里有 handoff 证据；
 *   - 队列把「等用户点按钮」变成 UI 可直接渲染的状态。
 */

describe("循环：人工接力", () => {
  it("模型调用 handoff 动作 → 请求用户接管 → 完成后继续下一轮", async () => {
    const run = vi.fn();
    const registry = makeRegistry([
      {
        id: "submit_export",
        description: "提交导出（需要验证码）",
        kind: "danger",
        handoff: { reason: "请填写图形验证码后提交" },
        onRun: run,
      },
    ]);
    const { events, onEvent } = collectEvents();
    const gate = vi.fn<HandoffGate>(async () => "done");
    const loop = createAgentLoop({
      registry,
      policy: createPolicy(async () => true),
      llm: createReplayLlm([{ calls: [{ tool: "submit_export" }] }, { content: "导出完成。" }]),
      handoff: gate,
      onEvent,
      settle: noSettle,
    });

    const answer = await loop.run("导出待办");

    expect(gate).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
    expect(ofType(events, "handoff").map((event) => event.status)).toEqual(["requested", "completed"]);
    expect(JSON.parse(loop.history.recent.find((message) => message.role === "tool")!.content)).toMatchObject({
      result: { ok: true, handoff: { actor: "user", reason: "请填写图形验证码后提交" } },
    });
    expect(answer).toBe("导出完成。");
  });

  it("用户取消 → 模型拿到 HANDOFF_CANCELLED，不会假装成功", async () => {
    const registry = makeRegistry([
      { id: "submit_export", handoff: { reason: "请本人复核" }, onRun: () => {} },
    ]);
    const { events, onEvent } = collectEvents();
    const loop = createAgentLoop({
      registry,
      policy: createPolicy(async () => true),
      llm: createReplayLlm([{ calls: [{ tool: "submit_export" }] }, { content: "好，先不做了。" }]),
      handoff: async () => "cancelled",
      onEvent,
      settle: noSettle,
    });

    await loop.run("提交");

    const result = JSON.parse(loop.history.recent.find((message) => message.role === "tool")!.content);
    expect(result).toMatchObject({ error: { code: "HANDOFF_CANCELLED" } });
    expect(ofType(events, "handoff").map((event) => event.status)).toEqual(["requested", "cancelled"]);
  });
});

describe("HandoffQueue", () => {
  it("请求 → UI 看到 pending；reply(true) → done", async () => {
    const queue = createHandoffQueue();
    const pending = queue.channel({
      id: "submit",
      description: "提交",
      reason: "请完成验证码",
      args: {},
      kind: "danger",
      timeout: 10_000,
    });
    expect(queue.current()?.request.reason).toBe("请完成验证码");
    expect(queue.reply(true)).toBe(true);
    await expect(pending).resolves.toBe("done");
    expect(queue.current()).toBeNull();
  });

  it("用户取消 → cancelled；超时 → timeout（并清掉 pending）", async () => {
    const queue = createHandoffQueue();
    const cancelled = queue.channel({
      id: "a",
      description: "a",
      reason: "a",
      args: {},
      kind: "write",
      timeout: 10_000,
    });
    queue.reply(false);
    await expect(cancelled).resolves.toBe("cancelled");

    const timed = createHandoffQueue({ timeoutMs: 5 });
    const result = await timed.channel({
      id: "b",
      description: "b",
      reason: "b",
      args: {},
      kind: "write",
      timeout: 5,
    });
    expect(result).toBe("timeout");
    expect(timed.current()).toBeNull();
  });

  it("分步指引：current 带当前步；next / previous 更新 UI 并通知执行器", async () => {
    const queue = createHandoffQueue();
    const seen: number[] = [];
    const pending = queue.channel({
      id: "upload",
      description: "上传附件",
      reason: "请按步骤完成",
      args: {},
      kind: "write",
      timeout: 10_000,
      steps: [
        { text: "点击上传", highlight: "pick" },
        { text: "确认文件", highlight: "preview" },
      ],
      onStep: (index) => seen.push(index),
    });

    expect(queue.current()?.step).toBe(0);
    expect(queue.previousStep()).toBe(false);
    expect(queue.nextStep()).toBe(true);
    expect(queue.current()?.step).toBe(1);
    expect(queue.nextStep()).toBe(false);
    expect(queue.previousStep()).toBe(true);
    expect(queue.current()?.step).toBe(0);
    expect(seen).toEqual([0, 1, 0]);

    queue.reply(true);
    await expect(pending).resolves.toBe("done");
  });
});
