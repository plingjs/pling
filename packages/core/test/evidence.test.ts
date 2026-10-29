import { describe, expect, it } from "vitest";
import { createExecutor } from "../src/executor";
import { createPolicy } from "../src/policy";
import { createRegistry } from "../src/registry";
import type { Binding } from "../src/types";

/**
 * 变更证据（S3）：执行流水线在**成功后**回报「执行前后快照的差异」。
 *
 * 为什么放在执行流水线里而不是循环里：只有流水线知道「这一动作**属于**哪一次执行」
 * （循环一轮里可能连着好几个调用，before/after 要在每个动作的两侧取，才对得上）。
 */
function harness(overrides: Partial<Binding> = {}) {
  const registry = createRegistry();
  let done = false;
  registry.bind({
    descriptor: { id: "toggle@t1", primitive: "click", description: "标记完成" },
    isAvailable: () => true,
    run: async () => {
      done = true;
    },
    ...overrides,
  });
  registry.declareRecord({ id: "t1", fields: () => ({ 已完成: done }) });
  return registry;
}

const allowAll = createPolicy(async () => true);

describe("执行流水线：变更证据", () => {
  it("动作真的改了行数据 → 成功回执里带 changed，说清是哪一行的哪个字段", async () => {
    const registry = harness();
    const executor = createExecutor({ registry, policy: allowAll });

    const out = await executor.execute("toggle@t1", "{}");
    expect(out).toMatchObject({
      result: {
        ok: true,
        changed: { observed: true, records: { updated: [{ id: "t1", fields: ["已完成"] }] } },
      },
    });
  });

  it("执行成功但什么都没变 → changed.observed 为 false，并显式告警（write 类）", async () => {
    const registry = harness({ run: async () => {} });
    const executor = createExecutor({ registry, policy: allowAll });

    const out = await executor.execute("toggle@t1", "{}");
    const result = (out as { result: { changed: { observed: boolean }; warning?: string } }).result;
    expect(result.changed.observed).toBe(false);
    expect(result.warning).toContain("No change was observed between snapshots");
    // 告警要如实说清「这一层能看见多少」——否则会变成一句没有边界的断言
    expect(result.warning).toContain("1 records / 1 actions");
  });

  it("read 类动作无变化不告警（滚动 / 导航本来就可能什么都没改）", async () => {
    const registry = harness({
      // 探索动作就是这么声明的（packages/vue 的 directive 里 primitive: "scroll" + kind: "read"）
      descriptor: { id: "toggle@t1", primitive: "scroll", kind: "read", description: "滚一屏" },
      run: async () => {},
    });
    const executor = createExecutor({ registry, policy: allowAll });

    const out = await executor.execute("toggle@t1", "{}");
    const result = (out as { result: { changed: { observed: boolean }; warning?: string } }).result;
    expect(result.changed.observed).toBe(false);
    expect(result.warning).toBeUndefined();
  });

  it("evidence: false 时完全不取快照（大页面的性能开关）", async () => {
    const registry = harness();
    let snapshots = 0;
    const original = registry.snapshot.bind(registry);
    registry.snapshot = () => {
      snapshots += 1;
      return original();
    };
    const executor = createExecutor({ registry, policy: allowAll, evidence: false });

    const out = await executor.execute("toggle@t1", "{}");
    expect(out).toMatchObject({ result: { ok: true } });
    expect((out as { result: Record<string, unknown> }).result).not.toHaveProperty("changed");
    expect(snapshots).toBe(0);
  });

  it("失败路径不白取快照，也没有 changed（证据只跟成功回执走）", async () => {
    const registry = harness();
    let snapshots = 0;
    const original = registry.snapshot.bind(registry);
    registry.snapshot = () => {
      snapshots += 1;
      return original();
    };
    const executor = createExecutor({ registry, policy: allowAll });

    const out = await executor.execute("不存在", "{}");
    expect(out).toMatchObject({ error: { code: "ACTION_NOT_FOUND" } });
    expect(snapshots).toBe(0);
  });
});
