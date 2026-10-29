import { describe, expect, it } from "vitest";
import { createExecutor } from "../src/executor";
import { createPolicy } from "../src/policy";
import { createRegistry } from "../src/registry";
import type { Binding } from "../src/types";

/**
 * 期望（S4）：动作声明了「成功判据」之后，执行流水线要**等它成立**再下结论。
 *
 * 三条要害：
 *   1. 不成立就不许说成功 —— 报 `EXPECTATION_FAILED`，而不是把「还在处理」当成「做完了」；
 *   2. 等完再取证据 —— `changed` 必须是**等待之后**的快照 diff，否则异步变化全被漏掉；
 *   3. 没声明的动作行为不变 —— 期望是可选增强，不是新的必经流程。
 */

const allowAll = createPolicy(async () => true);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 一个「慢后端」。
 *
 * `landing` 决定结果什么时候落地 —— 这两档的差别就是 S4 要解决的问题：
 *   · `"inside"`  开发者 `await` 了这次请求，`run` 的 promise 覆盖了整件事；
 *   · `"after"`   点了就走（事件处理器发完请求就返回，谁也没等它）——
 *                 结果是 **`run` 结束后**才落地的，框架此刻去看，看到的是「什么都没变」。
 */
function slowHarness(
  build: (state: { text: string | null }, order: string[]) => Partial<Binding>,
  landing: "inside" | "after" = "inside",
) {
  const registry = createRegistry();
  const state: { text: string | null } = { text: null };
  const order: string[] = [];

  registry.bind({
    descriptor: { id: "submit", primitive: "click", description: "提交订单" },
    isAvailable: () => true,
    run: async () => {
      order.push("run");
      if (landing === "inside") {
        await sleep(20);
        state.text = "买牛奶";
        order.push("landed");
        return;
      }
      // 点了就走：不 await，结果 20ms 后自己落地
      void sleep(20).then(() => {
        state.text = "买牛奶";
        order.push("landed");
      });
    },
    ...build(state, order),
  });
  // 记录在等待期间才出现 —— diff 能不能看见它，就是「等没等」的分水岭
  registry.declareRecord({ id: "t7", fields: () => ({ 内容: state.text }) });
  return { registry, state, order };
}

describe("执行流水线：期望（expect）", () => {
  it("期望成立 → 成功，回执里带 expect 的说明", async () => {
    const { registry } = slowHarness((state) => ({
      expect: { desc: "新待办出现在列表里", check: () => state.text !== null, timeout: 200 },
    }));
    const executor = createExecutor({ registry, policy: allowAll });

    const out = await executor.execute("submit", "{}");
    expect(out).toMatchObject({ result: { ok: true, expect: "新待办出现在列表里" } });
  });

  it("等完再取证据：异步出现的那一行能被 diff 看见（不是「无变化」）", async () => {
    const { registry } = slowHarness((state) => ({
      expect: { desc: "新待办出现在列表里", check: () => state.text !== null, timeout: 200 },
    }));
    const executor = createExecutor({ registry, policy: allowAll });

    const out = await executor.execute("submit", "{}");
    const result = (out as { result: { changed: { observed: boolean }; warning?: string } }).result;
    expect(result.changed.observed).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it("对照组：点了就走、又不声明期望 → 回执说「无变化」（这就是要解决的问题）", async () => {
    const { registry, state } = slowHarness(() => ({}), "after");
    const executor = createExecutor({ registry, policy: allowAll });

    const out = await executor.execute("submit", "{}");
    const result = (out as { result: { changed: { observed: boolean }; warning?: string } }).result;
    expect(result.changed.observed).toBe(false);
    expect(result.warning).toContain("No change was observed between snapshots");
    // 变化确实发生了，只是在快照之后 —— 这是时序误判，不是动作没生效
    await sleep(30);
    expect(state.text).toBe("买牛奶");
  });

  it("期望一直不成立 → EXPECTATION_FAILED：说清「已经执行」而不是「失败」", async () => {
    const { registry, order } = slowHarness(() => ({
      expect: { desc: "订单出现在列表里", check: () => false, timeout: 60 },
    }));
    const executor = createExecutor({ registry, policy: allowAll });

    const out = await executor.execute("submit", "{}");
    expect(out).toMatchObject({ error: { code: "EXPECTATION_FAILED" } });
    const message = (out as { error: { message: string } }).error.message;
    expect(message).toContain("Action submit ran");
    expect(message).toContain("the expected result was not observed: 订单出现在列表里");
    expect(message).toContain("timeout 60ms");
    // 动作本身确实执行完了 —— 报错不能让人以为「没点下去」
    expect(order).toEqual(["run", "landed"]);
  });

  it("期望用默认超时（DEFAULT_WAIT_TIMEOUT）：不写 timeout 也能成立", async () => {
    const { registry } = slowHarness((state) => ({
      expect: { desc: "落地", check: () => state.text !== null },
    }));
    const executor = createExecutor({ registry, policy: allowAll });
    await expect(executor.execute("submit", "{}")).resolves.toMatchObject({ result: { ok: true } });
  });

  it("期望在 settle 之前判，pass 之后才取快照", async () => {
    const { registry, order } = slowHarness((state) => ({
      expect: { desc: "落地", check: () => state.text !== null, timeout: 200 },
    }));
    const executor = createExecutor({
      registry,
      policy: allowAll,
      settle: async () => {
        order.push("settle");
      },
    });

    await executor.execute("submit", "{}");
    expect(order).toEqual(["run", "landed", "settle"]);
  });

  it("run 抛异常时不受影响：照旧 EXECUTION_FAILED（期望根本没轮到）", async () => {
    const { registry } = slowHarness(() => ({
      run: async () => {
        throw new Error("接口 500");
      },
      expect: { desc: "落地", check: () => true, timeout: 50 },
    } as Partial<Binding>));
    const executor = createExecutor({ registry, policy: allowAll });

    const out = await executor.execute("submit", "{}");
    expect(out).toMatchObject({ error: { code: "EXECUTION_FAILED" } });
    expect((out as { error: { message: string } }).error.message).toContain("接口 500");
  });
});
