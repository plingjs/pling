import { describe, expect, it, vi } from "vitest";
import { runEvaluation, formatReport, type EvalCase } from "../src/evaluate";
import { HookRegistry } from "../src/hooks";
import { createAgentLoop } from "../src/loop";
import { createReplayLlm, type ReplayTurn } from "../src/replay";
import { allowAll, collectEvents, makeRegistry, noSettle } from "./helpers";

function harness(turns: readonly ReplayTurn[], actions: readonly { id: string; kind?: "read" | "write" | "danger" }[]) {
  const hooks = new HookRegistry();
  const loop = createAgentLoop({
    registry: makeRegistry(actions),
    policy: allowAll,
    llm: createReplayLlm(turns),
    hooks,
    settle: noSettle,
  });
  return { hooks, loop, reset: vi.fn(() => loop.reset()) };
}

describe("评测", () => {
  it("三种断言：必须包含 / 必须调用 / 绝不能调用", async () => {
    const { hooks, loop, reset } = harness(
      [
        { calls: [{ tool: "search_query" }, { tool: "search_enter" }] },
        { content: "已找到 3 条订单" },
      ],
      [
        { id: "search_query", kind: "write" },
        { id: "search_enter", kind: "write" },
        { id: "delete_order", kind: "danger" },
      ],
    );

    const cases: EvalCase[] = [
      {
        name: "按关键词搜索",
        input: "搜一下订单",
        expectIncludes: ["找到"],
        expectTools: ["search_query", "search_enter"],
        expectNotTools: ["delete_order"], // 信条：危险动作绝不能被顺手调用
      },
    ];

    const report = await runEvaluation({ run: (input) => loop.run(input), hooks, cases, reset });

    expect(report.passed).toBe(1);
    expect(report.results[0]!.toolsUsed).toEqual(["search_query", "search_enter"]);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("调了不该调的动作 → 用例失败（expectNotTools 的价值）", async () => {
    const { hooks, loop } = harness([{ calls: [{ tool: "delete_order" }] }, { content: "删掉了" }], [
      { id: "delete_order", kind: "danger" },
    ]);

    const report = await runEvaluation({
      run: (input) => loop.run(input),
      hooks,
      cases: [{ input: "帮我看看订单", expectNotTools: ["delete_order"] }],
    });

    expect(report.passed).toBe(0);
    expect(report.passRate).toBe(0);
  });

  it("每个用例之间必须 reset（否则历史会串）", async () => {
    const { hooks, loop, reset } = harness([{ content: "一" }, { content: "二" }], [{ id: "a" }]);
    await runEvaluation({
      run: (input) => loop.run(input),
      hooks,
      reset,
      cases: [{ input: "甲" }, { input: "乙" }],
    });
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it("用例里抛错只让这一条失败，报告照样出", async () => {
    const { hooks } = harness([], [{ id: "a" }]);
    let calls = 0;
    const report = await runEvaluation({
      run: async () => {
        calls += 1;
        if (calls === 1) throw new Error("炸了");
        return "好的";
      },
      hooks,
      cases: [{ name: "坏的", input: "甲" }, { name: "好的", input: "乙", expectIncludes: ["好的"] }],
    });

    expect(report.total).toBe(2);
    expect(report.passed).toBe(1);
    expect(report.results[0]!.error).toBe("炸了");
    expect(formatReport(report)).toContain("通过 1/2");
  });

  it("评测跑完卸载钩子，不污染宿主", async () => {
    const { hooks, loop } = harness(
      [{ calls: [{ tool: "a" }] }, { content: "完" }, { calls: [{ tool: "a" }] }, { content: "完" }],
      [{ id: "a" }],
    );
    await runEvaluation({ run: (input) => loop.run(input), hooks, cases: [{ input: "甲" }] });

    // 再跑一轮，之前评测装的采集器不应再被触发（卸载干净）
    const seen = vi.fn();
    hooks.addPreToolUse(seen);
    await loop.run("再跑一次");
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("verify 检查真实业务状态，失败原因会进报告", async () => {
    const { hooks, loop } = harness([{ calls: [{ tool: "a" }] }, { content: "做完了" }], [{ id: "a" }]);
    let state = 0;

    const report = await runEvaluation({
      run: (input) => loop.run(input),
      hooks,
      cases: [
        { name: "状态成立", input: "甲", verify: () => state === 1 },
        { name: "状态没发生", input: "乙", verify: () => state === 2 },
      ],
      reset: () => {
        state = 1;
      },
    });

    expect(report.passed).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.results[1]!.failures).toContain("业务状态不符合预期（verify 返回 false）");
    expect(formatReport(report)).toContain("业务状态不符合预期");
  });

  it("maxToolErrors 把「一路试错撞到答案」判成失败，measure 的读数进入报告", async () => {
    const hooks = new HookRegistry();
    const { events, onEvent } = collectEvents();
    const loop = createAgentLoop({
      registry: makeRegistry([]),
      policy: allowAll,
      llm: createReplayLlm([{ calls: [{ tool: "missing" }] }, { content: "完成" }]),
      hooks,
      settle: noSettle,
      onEvent,
    });

    const report = await runEvaluation({
      run: (input) => loop.run(input),
      hooks,
      cases: [{ input: "甲", maxToolErrors: 0 }],
      events: () => events,
      measure: () => ({ turns: 2, llmCalls: 2 }),
    });

    expect(report.passed).toBe(0);
    expect(report.results[0]).toMatchObject({ toolErrors: 1, metrics: { turns: 2, llmCalls: 2 } });
    expect(report.results[0]!.failures[0]).toContain("超过上限 0");
  });

  it("reset 可以是异步的，并且每条用例开始前都等它完成", async () => {
    const { hooks, loop } = harness([{ content: "一" }, { content: "二" }], [{ id: "a" }]);
    const order: string[] = [];

    await runEvaluation({
      run: async (input) => {
        order.push(`run:${input}`);
        return loop.run(input);
      },
      hooks,
      cases: [{ input: "甲" }, { input: "乙" }],
      reset: async () => {
        await Promise.resolve();
        order.push("reset");
      },
    });

    expect(order).toEqual(["reset", "run:甲", "reset", "run:乙"]);
  });
});
