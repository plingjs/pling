import { describe, expect, it, vi } from "vitest";
import { createExecutor } from "../src/executor";
import { createPolicy } from "../src/policy";
import { createRegistry } from "../src/registry";
import type { PresenceState } from "../src/types";

/**
 * 存在感（S13）：执行器只报状态，不画。
 *
 * 这里锁住三件事：
 *   1. 正常动作 = acting → idle，且 idle 在 run 结束（失败也算）之后；
 *   2. handoff = waiting → idle —— 用户被要求操作时，界面得知道指的是哪个元素；
 *   3. 还没轮到执行（不可用 / 找不到）就不该亮 —— 高亮一个根本没被碰的元素是误导。
 */

const allowAll = createPolicy(async () => true);

describe("执行流水线：存在感通知", () => {
  it("正常动作：acting → idle，且 idle 在 run 真正结束之后", async () => {
    const registry = createRegistry();
    const calls: PresenceState[] = [];
    let finished = false;
    registry.bind({
      descriptor: { id: "save", primitive: "click", description: "保存", kind: "write" },
      isAvailable: () => true,
      presence: (state) => calls.push(state),
      run: async () => {
        expect(calls).toEqual(["acting"]);
        finished = true;
      },
    });

    const out = await createExecutor({ registry, policy: allowAll }).execute("save", "{}");

    expect(out).toMatchObject({ result: { ok: true } });
    expect(calls).toEqual(["acting", "idle"]);
    expect(finished).toBe(true);
  });

  it("run 抛错也会回到 idle（不能把高亮永远挂在页面上）", async () => {
    const registry = createRegistry();
    const calls: PresenceState[] = [];
    registry.bind({
      descriptor: { id: "save", primitive: "click", description: "保存", kind: "write" },
      isAvailable: () => true,
      presence: (state) => calls.push(state),
      run: async () => {
        throw new Error("boom");
      },
    });

    await createExecutor({ registry, policy: allowAll }).execute("save", "{}");

    expect(calls).toEqual(["acting", "idle"]);
  });

  it("人工接力：waiting → idle（用户操作期间一直亮着）", async () => {
    const registry = createRegistry();
    const calls: PresenceState[] = [];
    let duringGate: PresenceState[] = [];
    registry.bind({
      descriptor: {
        id: "upload",
        primitive: "click",
        description: "上传发票",
        kind: "write",
        handoff: { reason: "请选择文件" },
      },
      isAvailable: () => true,
      presence: (state) => calls.push(state),
      handoff: { reason: "请选择文件" },
    });

    const gate = vi.fn(async () => {
      duringGate = [...calls];
      return "done" as const;
    });
    await createExecutor({ registry, policy: allowAll, handoff: gate }).execute("upload", "{}");

    expect(duringGate).toEqual(["waiting"]);
    expect(calls).toEqual(["waiting", "idle"]);
  });

  it("不可用的动作不亮：还没轮到执行就没有存在感", async () => {
    const registry = createRegistry();
    const calls: PresenceState[] = [];
    registry.bind({
      descriptor: { id: "save", primitive: "click", description: "保存", kind: "write" },
      isAvailable: () => ({ available: false, reason: "表单还没填完" }),
      presence: (state) => calls.push(state),
      run: async () => {},
    });

    const out = await createExecutor({ registry, policy: allowAll }).execute("save", "{}");

    expect(out).toMatchObject({ error: { code: "ACTION_UNAVAILABLE" } });
    expect(calls).toEqual([]);
  });

  it("没写 presence 的绑定照常执行（这是可选能力）", async () => {
    const registry = createRegistry();
    const run = vi.fn(async () => {});
    registry.bind({
      descriptor: { id: "save", primitive: "click", description: "保存", kind: "write" },
      isAvailable: () => true,
      run,
    });

    const out = await createExecutor({ registry, policy: allowAll }).execute("save", "{}");
    expect(out).toMatchObject({ result: { ok: true } });
    expect(run).toHaveBeenCalledOnce();
  });
});
