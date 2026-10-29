import { describe, expect, it } from "vitest";
import { createExecutor } from "../src/executor";
import { RESUME_FLOW_ACTION_ID, type FlowStep } from "../src/flow";
import { schemaOf } from "../src/params";
import { createPolicy } from "../src/policy";
import { createRegistry } from "../src/registry";
import type { Binding } from "../src/types";

/**
 * S6c-1：流程失败后从第 N 步续跑。
 *
 * 这一组测试盯的是「续跑不能把前面已经生效的步骤再跑一遍」：
 *   1. 执行前失败（不可用 / 找不到动作 / 参数错）→ 可以安全重试；
 *   2. 执行后失败（动作自己抛错 / 期望没成立）→ 默认不重试（fail-closed），
 *      只有该步显式声明 `idempotent: true` 才给续跑句柄；
 *   3. 续跑成功 = 原流程的完整账本 + 整次业务操作的前后 diff，而不是「只做了剩下几步」。
 */

const allowAll = createPolicy(async () => true);
const outOf = (value: unknown): { result: any; error: any } => value as { result: any; error: any };

function createPage() {
  const registry = createRegistry({ defaultApproval: "kind" });
  const calls: string[] = [];
  const state = { day: 30 };

  function bind(binding: Binding): void {
    registry.bind(binding);
  }

  function element(spec: {
    id: string;
    primitive: Binding["descriptor"]["primitive"];
    description: string;
    params?: Binding["descriptor"]["params"];
    available?: () => boolean | { available: boolean; reason?: string };
    run?: (args: Record<string, unknown>) => void;
  }): void {
    bind({
      descriptor: {
        id: spec.id,
        primitive: spec.primitive,
        description: spec.description,
        ...(spec.params ? { params: spec.params } : {}),
      },
      isAvailable: () => spec.available?.() ?? true,
      ...(spec.run ? { run: async (args) => spec.run!(args) } : {}),
    });
  }

  function flow(id: string, steps: readonly FlowStep[]): void {
    bind({
      descriptor: {
        id,
        primitive: "flow",
        description: `流程：${id}`,
        params: schemaOf([{ name: "day", label: "日" }]),
      },
      isAvailable: () => true,
      steps,
    });
  }

  return { registry, calls, state, element, flow };
}

describe("流程续跑：从失败那一步继续", () => {
  it("执行前失败（不可用）给出 resume；续跑不重放前 3 步", async () => {
    const page = createPage();
    page.element({ id: "reset", primitive: "click", description: "重置", run: () => page.calls.push("reset") });
    page.element({ id: "open", primitive: "click", description: "打开", run: () => page.calls.push("open") });
    page.element({
      id: "fill",
      primitive: "type",
      description: "填写",
      params: schemaOf([{ name: "text", label: "内容" }]),
      run: (args) => page.calls.push(`fill:${String(args.text)}`),
    });
    page.element({
      id: "pick_day",
      primitive: "click",
      description: "选择日",
      params: schemaOf([{ name: "day", label: "日" }]),
      available: () =>
        Number(page.state.day) <= 28
          ? true
          : { available: false, reason: "这个月只有 28 天" },
      run: () => page.calls.push(`pick:${page.state.day}`),
    });
    page.element({ id: "save", primitive: "click", description: "保存", run: () => page.calls.push("save") });

    page.flow("pick_due_date", [
      { action: "reset" },
      { action: "open" },
      { action: "fill", args: { text: "回款日" } },
      { action: "pick_day", args: { day: "{{day}}" } },
      { action: "save" },
    ]);

    const executor = createExecutor({ registry: page.registry, policy: allowAll });
    const failed = outOf(await executor.execute("pick_due_date", JSON.stringify({ day: "30" })));

    expect(failed.result).toBeUndefined();
    expect(failed.error.code).toBe("STEP_FAILED");
    expect(failed.error.resume).toMatchObject({
      flowId: "pick_due_date",
      failedAt: 4,
      total: 5,
      from: 4,
      remaining: ["pick_day", "save"],
    });
    expect(failed.error.resume.runId).toMatch(/^run-/);
    // 失败那一步**没有执行**：不可用是在流水线第 5 步拦下的
    expect(page.calls).toEqual(["reset", "open", "fill:回款日"]);

    // 续跑句柄是框架动作：只在这一刻可见
    expect(page.registry.snapshot().actions.map((action) => action.id)).toContain(RESUME_FLOW_ACTION_ID);

    page.state.day = 28;
    const resumed = outOf(
      await executor.execute(RESUME_FLOW_ACTION_ID, JSON.stringify({ runId: failed.error.resume.runId })),
    );

    expect(resumed.error).toBeUndefined();
    expect(resumed.result).toMatchObject({ ok: true, flow: { completed: 5, total: 5 } });
    expect(resumed.result.flow.steps.map((step: { id: string }) => step.id)).toEqual([
      "reset",
      "open",
      "fill",
      "pick_day",
      "save",
    ]);
    // 关键：前 3 步只出现一次，失败那一步重试一次，后面的步骤继续走
    expect(page.calls).toEqual(["reset", "open", "fill:回款日", "pick:28", "save"]);

    // 成功后句柄失效，模型不会再看到 pling_resume_flow
    expect(page.registry.snapshot().actions.map((action) => action.id)).not.toContain(RESUME_FLOW_ACTION_ID);
  });

  it("执行后失败且没有 idempotent：不给 resume，并明确要求手动补做", async () => {
    const page = createPage();
    page.element({ id: "first", primitive: "click", description: "第一步", run: () => page.calls.push("first") });
    page.element({
      id: "submit",
      primitive: "click",
      description: "提交（会抛错）",
      run: () => {
        page.calls.push("submit");
        throw new Error("网络断了");
      },
    });
    page.flow("submit_flow", [{ action: "first" }, { action: "submit" }]);

    const executor = createExecutor({ registry: page.registry, policy: allowAll });
    const failed = outOf(await executor.execute("submit_flow", JSON.stringify({ day: "1" })));

    expect(failed.error.code).toBe("STEP_FAILED");
    expect(failed.error.resume).toBeUndefined();
    expect(failed.error.message).toContain("will not retry it automatically");
    expect(page.registry.snapshot().actions.map((action) => action.id)).not.toContain(RESUME_FLOW_ACTION_ID);
  });

  it("执行后失败但该步声明了 idempotent：允许从失败那一步重试", async () => {
    const page = createPage();
    let attempts = 0;
    page.element({ id: "first", primitive: "click", description: "第一步", run: () => page.calls.push("first") });
    page.element({
      id: "save_draft",
      primitive: "click",
      description: "保存草稿（幂等）",
      run: () => {
        attempts += 1;
        page.calls.push(`save:${attempts}`);
        if (attempts === 1) throw new Error("第一次写失败");
      },
    });
    page.flow("draft_flow", [{ action: "first" }, { action: "save_draft", idempotent: true }]);

    const executor = createExecutor({ registry: page.registry, policy: allowAll });
    const failed = outOf(await executor.execute("draft_flow", JSON.stringify({ day: "1" })));

    expect(failed.error.resume).toMatchObject({ failedAt: 2, from: 2, remaining: ["save_draft"] });

    const resumed = outOf(
      await executor.execute(RESUME_FLOW_ACTION_ID, JSON.stringify({ runId: failed.error.resume.runId })),
    );
    expect(resumed.error).toBeUndefined();
    expect(resumed.result.flow.completed).toBe(2);
    expect(page.calls).toEqual(["first", "save:1", "save:2"]);
  });

  it("续跑再次失败：同一个 runId 仍可继续，失败位置会更新", async () => {
    const page = createPage();
    page.element({ id: "first", primitive: "click", description: "第一步", run: () => page.calls.push("first") });
    page.element({
      id: "pick_day",
      primitive: "click",
      description: "选择日",
      params: schemaOf([{ name: "day", label: "日" }]),
      available: () => (Number(page.state.day) === 28 ? true : { available: false, reason: "只有 28 天" }),
      run: () => page.calls.push("pick"),
    });
    page.element({ id: "save", primitive: "click", description: "保存", run: () => page.calls.push("save") });
    page.flow("date_flow", [
      { action: "first" },
      { action: "pick_day", args: { day: "{{day}}" } },
      { action: "save" },
    ]);

    const executor = createExecutor({ registry: page.registry, policy: allowAll });
    const first = outOf(await executor.execute("date_flow", JSON.stringify({ day: "30" })));
    expect(first.error.resume).toMatchObject({ failedAt: 2, from: 2 });

    // 仍然选不对：续跑失败，句柄不丢
    page.state.day = 31;
    const again = outOf(
      await executor.execute(RESUME_FLOW_ACTION_ID, JSON.stringify({ runId: first.error.resume.runId })),
    );
    expect(again.error.code).toBe("STEP_FAILED");
    expect(again.error.resume).toMatchObject({
      runId: first.error.resume.runId,
      failedAt: 2,
      from: 2,
      remaining: ["pick_day", "save"],
    });

    page.state.day = 28;
    const done = outOf(
      await executor.execute(RESUME_FLOW_ACTION_ID, JSON.stringify({ runId: again.error.resume.runId })),
    );
    expect(done.error).toBeUndefined();
    expect(page.calls).toEqual(["first", "pick", "save"]);
  });

  it("runId 缺失 / 不存在时给出可行动的错误", async () => {
    const page = createPage();
    page.element({ id: "first", primitive: "click", description: "第一步", run: () => page.calls.push("first") });
    page.flow("tiny_flow", [{ action: "first" }]);
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const missing = outOf(await executor.execute(RESUME_FLOW_ACTION_ID, "{}"));
    expect(missing.error.code).toBe("INVALID_PARAMS");
    expect(missing.error.message).toContain("error.resume.runId");

    const unknown = outOf(await executor.execute(RESUME_FLOW_ACTION_ID, JSON.stringify({ runId: "run-999" })));
    expect(unknown.error.code).toBe("ACTION_NOT_FOUND");
    expect(unknown.error.message).toContain("run-999");
  });

  it("续跑动作只在有失败流程时出现；反复 createExecutor 不会重复绑定", async () => {
    const page = createPage();
    page.element({
      id: "blocked",
      primitive: "click",
      description: "暂时不可用",
      available: () => ({ available: false, reason: "还没准备好" }),
    });
    page.flow("blocked_flow", [{ action: "blocked" }]);
    createExecutor({ registry: page.registry, policy: allowAll });
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    // 没有失败流程时**不挂**：快照里不会多出一条「pling_resume_flow 不可用」的噪音
    expect(page.registry.get(RESUME_FLOW_ACTION_ID)).toBeUndefined();
    expect(page.registry.snapshot().actions.map((action) => action.id)).not.toContain(RESUME_FLOW_ACTION_ID);

    await executor.execute("blocked_flow", JSON.stringify({ day: "1" }));
    expect(page.registry.get(RESUME_FLOW_ACTION_ID)).toBeDefined();
    expect(page.registry.snapshot().actions.filter((action) => action.id === RESUME_FLOW_ACTION_ID)).toHaveLength(1);
  });
});
