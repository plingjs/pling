import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecutor } from "../src/executor";
import { createPolicy } from "../src/policy";
import { createRegistry } from "../src/registry";
import type { PresenceState } from "../src/types";

const allowAll = createPolicy(async () => true);

afterEach(() => {
  vi.useRealTimers();
});

describe("executor.locate：只指向，不执行", () => {
  it("高亮目标后按配置的时间收起，不调用 run", async () => {
    vi.useFakeTimers();
    const registry = createRegistry();
    const marks: PresenceState[] = [];
    const run = vi.fn(async () => {});
    registry.bind({
      descriptor: { id: "upload", primitive: "click", description: "上传封面", kind: "write" },
      isAvailable: () => true,
      presence: (state) => marks.push(state),
      run,
    });

    const executor = createExecutor({ registry, policy: allowAll, locateDurationMs: 50 });
    expect(await executor.locate("upload")).toMatchObject({
      result: {
        ok: true,
        executed: false,
        located: { id: "upload", description: "上传封面" },
      },
    });
    expect(marks).toEqual(["locate"]);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(51);
    expect(marks).toEqual(["locate", "idle"]);
  });

  it("视口外的目标先 reveal，再画高亮", async () => {
    const registry = createRegistry();
    const calls: string[] = [];
    let visible = false;
    registry.bind({
      descriptor: { id: "cover", primitive: "click", description: "上传封面", kind: "write" },
      isAvailable: () => true,
      isVisible: () => visible,
      reveal: async () => {
        calls.push("reveal");
        visible = true;
      },
      presence: (state) => calls.push(state),
      run: async () => calls.push("run"),
    });

    const executor = createExecutor({
      registry,
      policy: allowAll,
      locateDurationMs: 0,
      settle: async () => {
        calls.push("settle");
      },
    });

    expect(await executor.locate("cover")).toMatchObject({ result: { ok: true, executed: false } });
    expect(calls).toEqual(["reveal", "settle", "locate"]);
  });

  it("未知目标 / 无视觉目标都给出可行动错误，且不执行任何动作", async () => {
    const registry = createRegistry();
    const run = vi.fn(async () => {});
    registry.bind({
      descriptor: { id: "save", primitive: "call", description: "直接保存", kind: "write" },
      isAvailable: () => true,
      run,
    });
    const executor = createExecutor({ registry, policy: allowAll, locateDurationMs: 0 });

    expect(await executor.locate("missing")).toMatchObject({ error: { code: "ACTION_NOT_FOUND" } });
    expect(await executor.locate("save")).toMatchObject({ error: { code: "ACTION_UNAVAILABLE" } });
    expect(run).not.toHaveBeenCalled();
  });
});
