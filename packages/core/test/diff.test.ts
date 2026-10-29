import { describe, expect, it } from "vitest";
import { describeDiff, DIFF_LIST_LIMIT, diffSnapshots } from "../src/diff";
import type { Snapshot } from "../src/registry";

/**
 * 变更证据（S3）：一次动作前后两份快照的差异。
 *
 * 这一层是**纯函数**：只比「模型能看见的那部分」（行数据 / 动作清单 / 状态视图），
 * 说清变没变、变了什么 —— 不假装知道快照之外的东西。
 */
function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    actions: [],
    records: [],
    recordsTotal: 0,
    recordIds: [],
    recordIdsTotal: 0,
    offscreenRecordActions: [],
    feedback: [],
    feedbackTotal: 0,
    state: {},
    stateViews: [],
    total: 0,
    unavailable: [],
    unavailableTotal: 0,
    scopes: [],
    ...overrides,
  };
}

const row = (id: string, fields: Record<string, unknown> = {}) => ({ id, fields, source: "declared" as const });

describe("diffSnapshots：行数据", () => {
  it("新增 / 删除行按 id 报出来", () => {
    const before = snapshot({ records: [row("t1")], recordsTotal: 1 });
    const after = snapshot({ records: [row("t1"), row("t2")], recordsTotal: 2 });

    const diff = diffSnapshots(before, after);
    expect(diff.observed).toBe(true);
    expect(diff.records).toMatchObject({ added: ["t2"], removed: [], updated: [] });
    expect(describeDiff(diff)).toBe("新增 1 行（t2）；行数 1 → 2");
  });

  it("字段变了只列「哪一行的哪些字段」", () => {
    const before = snapshot({ records: [row("t1", { 已完成: false, 优先级: "低" })] });
    const after = snapshot({ records: [row("t1", { 已完成: true, 优先级: "低" })] });

    const diff = diffSnapshots(before, after);
    expect(diff.records!.updated).toEqual([{ id: "t1", fields: ["已完成"] }]);
    expect(describeDiff(diff)).toBe("改了 1 条（t1 的 已完成）");
  });

  it("行没增减、字段也没变，但顺序变了 —— 拖拽排序必须能被看出来", () => {
    const before = snapshot({ records: [row("t1"), row("t2")], recordsTotal: 2 });
    const after = snapshot({ records: [row("t2"), row("t1")], recordsTotal: 2 });

    const diff = diffSnapshots(before, after);
    expect(diff.observed).toBe(true);
    expect(diff.records).toMatchObject({ added: [], removed: [], updated: [], reordered: true });
    expect(describeDiff(diff)).toBe("顺序变了");
  });

  it("行数据一条没变 → observed 为 false（不是「什么都没改」，是「这一层没看见」）", () => {
    const before = snapshot({ records: [row("t1", { 已完成: false })] });
    const after = snapshot({ records: [row("t1", { 已完成: false })] });
    const diff = diffSnapshots(before, after);

    expect(diff.observed).toBe(false);
    expect(diff.records).toBeUndefined();
    expect(describeDiff(diff)).toBe("无变化");
  });

  it("被条数上限裁掉的行只在 recordsTotal 上看得见", () => {
    const before = snapshot({ records: [row("t1")], recordsTotal: 42 });
    const after = snapshot({ records: [row("t1")], recordsTotal: 41 });

    expect(diffSnapshots(before, after).records).toMatchObject({ total: { from: 42, to: 41 } });
  });

  it("一次改动很多行时列表有上限，剩下的报数（这段会进每一次工具结果，token 要压住）", () => {
    const before = snapshot({ records: [], recordsTotal: 0 });
    const after = snapshot({
      records: Array.from({ length: DIFF_LIST_LIMIT + 3 }, (_, index) => row(`t${index + 1}`)),
      recordsTotal: DIFF_LIST_LIMIT + 3,
    });

    const diff = diffSnapshots(before, after);
    expect(diff.records!.added).toHaveLength(DIFF_LIST_LIMIT);
    expect(diff.records!.omitted.added).toBe(3);
    expect(describeDiff(diff)).toContain("新增 8 行");
  });
});

describe("diffSnapshots：动作清单与状态", () => {
  const action = (id: string) => ({
    id,
    primitive: "click" as const,
    kind: "write" as const,
    approval: "none" as const,
    fidelity: "high" as const,
    description: id,
    params: { type: "object" as const },
  });

  it("动作清单的增减（筛选 / 搜索会带来成批的行内动作变化）", () => {
    const before = snapshot({ actions: [action("remove@t1"), action("remove@t2")] });
    const after = snapshot({ actions: [action("remove@t1")] });

    const diff = diffSnapshots(before, after);
    expect(diff.actions).toMatchObject({ removed: ["remove@t2"], added: [] });
    expect(describeDiff(diff)).toBe("1 个动作不可用 / 消失（remove@t2）");
  });

  it("状态视图只报 key", () => {
    const before = snapshot({ state: { filter: "all", query: "" } });
    const after = snapshot({ state: { filter: "completed", query: "" } });

    expect(diffSnapshots(before, after).state).toMatchObject({ changed: ["filter"] });
  });

  it("页面反馈出现 / 消失 / 文案变化也算变更（空提交后的唯一变化就是它）", () => {
    const before = snapshot();
    const after = snapshot({
      feedback: [
        {
          id: "customer_required",
          message: "客户不能为空",
          field: "customer",
          severity: "error",
          source: "declared",
        },
      ],
      feedbackTotal: 1,
    });
    const diff = diffSnapshots(before, after);
    expect(diff.observed).toBe(true);
    expect(diff.feedback).toMatchObject({ added: ["customer_required"], removed: [], changed: [] });
    expect(describeDiff(diff)).toContain("新增 1 条页面反馈");

    const changed = diffSnapshots(after, {
      ...after,
      feedback: [{ ...after.feedback[0]!, message: "客户名称过长" }],
    });
    expect(changed.feedback).toMatchObject({ added: [], removed: [], changed: ["customer_required"] });
  });

  it("行数据 / 动作 / 状态一起变时，都在同一句里说清楚", () => {
    const before = snapshot({ records: [row("t1")], recordsTotal: 1, state: { filter: "all" } });
    const after = snapshot({ records: [], recordsTotal: 0, state: { filter: "completed" } });

    expect(describeDiff(diffSnapshots(before, after))).toBe("删除 1 行（t1）；行数 1 → 0；状态变了（filter）");
  });
});

describe("describeDiff：human-facing locale", () => {
  it("English keeps record and action summaries in English", () => {
    expect(
      describeDiff(
        {
          observed: true,
          records: {
            added: [],
            removed: [],
            updated: [{ id: "SO-2041", fields: ["fields"] }],
            reordered: false,
            omitted: { added: 0, removed: 0, updated: 0 },
          },
          actions: {
            added: [],
            removed: ["approve@SO-2041"],
            omitted: { added: 0, removed: 0 },
          },
        },
        { locale: "en-US" },
      ),
    ).toBe(
      "updated 1 record (SO-2041: fields); 1 action unavailable / removed (approve@SO-2041)",
    );
  });

  it("English handles page, rows, ordering, state, and feedback without Chinese labels", () => {
    const text = describeDiff(
      {
        observed: true,
        page: {
          changed: ["path"],
          from: { name: "Queue", path: "/queue" },
          to: { name: "Order", path: "/orders/1" },
        },
        records: {
          added: ["SO-2041"],
          removed: ["SO-2039"],
          updated: [],
          reordered: true,
          omitted: { added: 0, removed: 0, updated: 0 },
          total: { from: 4, to: 4 },
        },
        state: { changed: ["filter"], omitted: 0 },
        feedback: { added: ["saved"], removed: [], changed: [], omitted: { added: 0, removed: 0, changed: 0 } },
      },
      { locale: "en-US" },
    );

    expect(text).toContain("page “Queue” (/queue) → “Order” (/orders/1)");
    expect(text).toContain("added 1 row (SO-2041)");
    expect(text).toContain("removed 1 row (SO-2039)");
    expect(text).toContain("order changed");
    expect(text).toContain("rows 4 → 4");
    expect(text).toContain("state changed (filter)");
    expect(text).toContain("added 1 page message (saved)");
    expect(text).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("Chinese remains the default for existing callers", () => {
    expect(describeDiff({ observed: false })).toBe("无变化");
    expect(describeDiff({ observed: false }, { locale: "zh-CN" })).toBe("无变化");
  });
});
