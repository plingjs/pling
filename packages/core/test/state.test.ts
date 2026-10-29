import { describe, expect, it } from "vitest";
import { createRegistry } from "../src/registry";
import { sanitizeState } from "../src/state";

describe("状态：有界序列化", () => {
  it("基本类型原样通过（NaN / Infinity 转字符串，保证 JSON 合法）", () => {
    expect(sanitizeState({ a: 1, b: true, c: null, d: "hi" })).toEqual({ a: 1, b: true, c: null, d: "hi" });
    expect(sanitizeState({ bad: Number.NaN })).toEqual({ bad: "NaN" });
    expect(JSON.parse(JSON.stringify(sanitizeState({ bad: Infinity })))).toEqual({ bad: "Infinity" });
  });

  it("丢弃函数 / undefined / symbol（它们没法给模型）", () => {
    expect(sanitizeState({ keep: 1, fn: () => 1, undef: undefined, sym: Symbol("x") })).toEqual({ keep: 1 });
  });

  it("数组超长：保留前 N 项，末尾明说还剩多少", () => {
    const rows = Array.from({ length: 42 }, (_, i) => `SO-${i + 1}`);
    const out = sanitizeState({ rows }, { maxArray: 5 }) as { rows: unknown[] };
    expect(out.rows).toHaveLength(6);
    expect(out.rows.slice(0, 5)).toEqual(["SO-1", "SO-2", "SO-3", "SO-4", "SO-5"]);
    expect(out.rows[5]).toBe("… (42 items total; showing 5)");
  });

  it("对象字段过多：保留前 N 个，补一个「…」说明", () => {
    const wide = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]));
    const out = sanitizeState(wide, { maxKeys: 3 }) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(["k0", "k1", "k2", "…"]);
    expect(out["…"]).toBe("17 more fields not shown");
  });

  it("字符串过长：截断并标记", () => {
    const out = sanitizeState({ note: "x".repeat(500) }, { maxString: 10 }) as { note: string };
    expect(out.note).toBe(`${"x".repeat(10)}…`);
  });

  it("深度超限：更深的层级变成「…」，并且不会因为循环引用卡死", () => {
    const cyclic: Record<string, unknown> = { name: "root" };
    cyclic.self = cyclic;
    const out = sanitizeState(cyclic, { maxDepth: 2 }) as Record<string, unknown>;
    expect(out.name).toBe("root");
    expect(JSON.stringify(out)).toContain("…");
  });

  it("Date 走 toJSON，Map / Set 转成数组", () => {
    const out = sanitizeState({
      at: new Date("2026-01-02T03:04:05.000Z"),
      m: new Map([["a", 1]]),
      s: new Set([1, 2]),
    }) as Record<string, unknown>;
    expect(out.at).toBe("2026-01-02T03:04:05.000Z");
    expect(out.m).toEqual([["a", 1]]);
    expect(out.s).toEqual([1, 2]);
  });
});

describe("状态：进快照", () => {
  it("expose 的读函数按需取值，快照里是序列化后的结果", () => {
    const registry = createRegistry({ stateLimits: { maxArray: 2 } });
    let query = "foo";
    const off = registry.expose({ key: "filters", description: "筛选", read: () => ({ query, rows: [1, 2, 3] }) });

    expect(registry.snapshot().state).toEqual({ filters: { query: "foo", rows: [1, 2, "… (3 items total; showing 2)"] } });
    query = "bar";
    expect(registry.snapshot().state).toEqual({ filters: { query: "bar", rows: [1, 2, "… (3 items total; showing 2)"] } });

    off();
    expect(registry.snapshot().state).toEqual({});
  });

  it("读函数抛异常：只让这一组状态变成错误文本，快照本身不崩", () => {
    const registry = createRegistry();
    registry.expose({ key: "bad", read: () => { throw new Error("炸了"); } });
    registry.expose({ key: "good", read: () => 1 });

    expect(registry.snapshot().state).toEqual({ bad: "(read failed: 炸了)", good: 1 });
  });

  it("state key 重复直接报错（暴露冲突要立刻发现，不能静默覆盖）", () => {
    const registry = createRegistry();
    registry.expose({ key: "dup", read: () => 1 });
    expect(() => registry.expose({ key: "dup", read: () => 2 })).toThrow(/dup/);
  });
});
