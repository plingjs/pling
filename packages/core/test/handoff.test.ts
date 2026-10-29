import { describe, expect, it, vi } from "vitest";
import { createExecutor } from "../src/executor";
import { createPolicy, type HandoffGate } from "../src/policy";
import { createRegistry } from "../src/registry";
import type { Binding } from "../src/types";

/**
 * 人工接力（S5）：这一步由用户亲自完成。
 *
 * 三条不能错的语义：
 *   1. **不执行 run**：用户亲手做过了，框架再模拟一次就是重复提交；
 *   2. **不叠 confirmation**：用户亲手做这件事本身就是批准，不能再让人先点一次「批准」；
 *   3. **「我已完成」不等于成功**：有 expect 时必须真的等到结果，没等到就报 HANDOFF_FAILED。
 */

const allowAll = createPolicy(async () => true);

function harness(overrides: Partial<Binding> = {}) {
  const registry = createRegistry();
  const run = vi.fn(async () => {});
  registry.bind({
    descriptor: {
      id: "submit_export",
      primitive: "click",
      description: "提交导出（需要输入图形验证码）",
      kind: "danger",
      handoff: { reason: "请填写图形验证码后提交" },
    },
    isAvailable: () => true,
    handoff: { reason: "请填写图形验证码后提交" },
    run,
    ...overrides,
  });
  return { registry, run };
}

describe("执行流水线：人工接力（handoff）", () => {
  it("请用户接管；用户完成后不执行 run，回执里带 handoff 证据", async () => {
    const { registry, run } = harness();
    const gate = vi.fn<HandoffGate>(async () => "done");
    const executor = createExecutor({ registry, policy: allowAll, handoff: gate });

    const out = await executor.execute("submit_export", "{}");

    expect(gate).toHaveBeenCalledWith({
      id: "submit_export",
      description: "提交导出（需要输入图形验证码）",
      reason: "请填写图形验证码后提交",
      args: {},
      kind: "danger",
      timeout: 300_000,
    });
    expect(run).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      result: { ok: true, handoff: { reason: "请填写图形验证码后提交", actor: "user" } },
    });
  });

  it("接力动作不叠加 confirmation（人亲手做就是批准）", async () => {
    const { registry } = harness();
    const confirm = vi.fn(async () => true as const);
    const policy = createPolicy(confirm);
    const executor = createExecutor({ registry, policy, handoff: async () => "done" });

    await executor.execute("submit_export", "{}");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("用户取消 / 超时 → 可行动的结构化错误", async () => {
    const cancelled = createExecutor({
      registry: harness().registry,
      policy: allowAll,
      handoff: async () => "cancelled",
    });
    expect(await cancelled.execute("submit_export", "{}")).toMatchObject({
      error: { code: "HANDOFF_CANCELLED" },
    });

    const timeout = createExecutor({
      registry: harness().registry,
      policy: allowAll,
      handoff: async () => "timeout",
    });
    expect(await timeout.execute("submit_export", "{}")).toMatchObject({
      error: { code: "HANDOFF_TIMEOUT" },
    });
  });

  it("没有接力通道 → fail-closed（不会偷偷替用户点）", async () => {
    const { registry, run } = harness();
    const executor = createExecutor({ registry, policy: allowAll });
    expect(await executor.execute("submit_export", "{}")).toMatchObject({
      error: { code: "HANDOFF_FAILED" },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("用户说「已完成」但期望没发生 → HANDOFF_FAILED，而不是假成功", async () => {
    const { registry } = harness({
      handoff: {
        reason: "请填写图形验证码后提交",
        expect: { desc: "导出结果出现", check: () => false, timeout: 30 },
      },
    });
    const executor = createExecutor({ registry, policy: allowAll, handoff: async () => "done" });
    expect(await executor.execute("submit_export", "{}")).toMatchObject({
      error: { code: "HANDOFF_FAILED" },
    });
  });

  it("分步指引：步骤随请求下发给面板；切步时高亮跟着移动，结束后全部熄灭", async () => {
    const { registry } = harness({
      handoff: {
        reason: "请完成实名认证",
        steps: [
          { text: "上传身份证正面", highlight: "id_front" },
          { text: "上传身份证背面", highlight: "id_back" },
        ],
      },
    });
    const marks: Array<[string, string]> = [];
    for (const id of ["id_front", "id_back"]) {
      registry.declareGuideTarget(id, { presence: (state) => marks.push([id, state]) });
    }

    const gate = vi.fn<HandoffGate>(async (request) => {
      expect(request.steps).toEqual([
        { text: "上传身份证正面", highlight: "id_front" },
        { text: "上传身份证背面", highlight: "id_back" },
      ]);
      request.onStep?.(1);
      return "done";
    });

    await createExecutor({ registry, policy: allowAll, handoff: gate }).execute("submit_export", "{}");

    expect(marks).toEqual([
      ["id_front", "waiting"],
      ["id_front", "idle"],
      ["id_back", "waiting"],
      ["id_back", "idle"],
    ]);
  });

  it("同一个指引目标 id 重复声明会立刻报错（避免两个元素抢同一圈高亮）", () => {
    const registry = createRegistry();
    registry.declareGuideTarget("captcha", { presence: () => {} });
    expect(() => registry.declareGuideTarget("captcha", { presence: () => {} })).toThrow(/captcha/);
  });
});
