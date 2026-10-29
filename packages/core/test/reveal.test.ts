import { describe, expect, it, vi } from "vitest";
import { createExecutor } from "../src/executor";
import { createPolicy } from "../src/policy";
import { createRegistry } from "../src/registry";

/**
 * 自动揭示（S12）：模型可以引用活跃区域内、但暂时滚在视口外的行内动作。
 *
 * 执行器在**权限通过之后**把目标带到可见区，并等 `settle` 收尾，再重新读可见性与可用性。
 * 这三条顺序都不能省：先问人再滚（不为一个还看不见的目标反复打扰）、滚完再看
 * （平滑滚动是异步的）、最终仍不可见就如实失败（不能假装点到了）。
 */

function setup(options: { kind?: "read" | "danger" } = {}) {
  const registry = createRegistry();
  let visible = false;
  const run = vi.fn(async () => {});
  const reveal = vi.fn(async () => {
    // 故意保持不可见：这个绑定的用途是验证「揭示失败」分支
  });
  registry.bind({
    descriptor: { id: "remove@order:SO-1042", primitive: "click", description: "删除订单 SO-1042", kind: options.kind ?? "read" },
    isAvailable: () => true,
    isVisible: () => visible,
    reveal,
    run,
  });
  return {
    registry,
    run,
    reveal,
    setVisible: (next: boolean) => {
      visible = next;
    },
  };
}

describe("视口外动作：先揭示，再执行", () => {
  it("reveal 成功 → settle 后重新检查可见性，业务动作只执行一次", async () => {
    const calls: string[] = [];
    const local = createRegistry();
    let visible = false;
    const executed = vi.fn(async () => {
      calls.push("run");
    });
    local.bind({
      descriptor: { id: "remove@order:SO-1042", primitive: "click", description: "删除订单 SO-1042", kind: "read" },
      isAvailable: () => true,
      isVisible: () => visible,
      reveal: async () => {
        calls.push("reveal");
        visible = true;
      },
      run: executed,
    });
    const executor = createExecutor({
      registry: local,
      policy: createPolicy(null),
      settle: async () => {
        calls.push("settle");
      },
    });

    expect(await executor.execute("remove@order:SO-1042", "{}")).toMatchObject({ result: { ok: true } });
    // 第二个 settle 是执行后取变更证据前等 DOM 落地；第一个是揭示滚动后的落定
    expect(calls).toEqual(["reveal", "settle", "run", "settle"]);
    expect(executed).toHaveBeenCalledTimes(1);
  });

  it("reveal 之后目标仍不可见 → ACTION_UNAVAILABLE，且不执行副作用", async () => {
    const { registry, run } = setup();
    const executor = createExecutor({ registry, policy: createPolicy(null) });

    expect(await executor.execute("remove@order:SO-1042", "{}")).toMatchObject({
      error: {
        code: "ACTION_UNAVAILABLE",
        message: expect.stringContaining("still not visible"),
      },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("没有 reveal 的适配器：视口外动作不会被静默执行", async () => {
    const registry = createRegistry();
    const run = vi.fn(async () => {});
    registry.bind({
      descriptor: { id: "remove@order:SO-1042", primitive: "click", description: "删除订单", kind: "read" },
      isAvailable: () => true,
      isVisible: () => false,
      run,
    });
    const executor = createExecutor({ registry, policy: createPolicy(null) });

    expect(await executor.execute("remove@order:SO-1042", "{}")).toMatchObject({
      error: { code: "ACTION_UNAVAILABLE", message: expect.stringContaining("has no reveal handler") },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("权限被拒绝时不会先去滚页面", async () => {
    const registry = createRegistry();
    const reveal = vi.fn(async () => {});
    registry.bind({
      descriptor: { id: "remove@order:SO-1042", primitive: "click", description: "删除订单", kind: "danger" },
      isAvailable: () => true,
      isVisible: () => false,
      reveal,
      run: async () => {},
    });
    const executor = createExecutor({
      registry,
      policy: createPolicy(async () => false),
    });

    expect(await executor.execute("remove@order:SO-1042", "{}")).toMatchObject({ error: { code: "PERMISSION_DENIED" } });
    expect(reveal).not.toHaveBeenCalled();
  });
});
