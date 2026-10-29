import { describe, expect, it, vi } from "vitest";
import { modelActions } from "../src/model-actions";
import { createRegistry, DEFAULT_RECORD_LIMITS } from "../src/registry";

/**
 * record（记录 / 行数据）：`v-for` 的每一行成为可读的一等公民。
 *
 * 它是**读**：只往快照里加字段，不产生任何可执行动作 ——
 * 「未注册不兜底」说的是动作，不是数据。
 */
describe("记录：行数据进快照", () => {
  it("声明了就出现在快照里，带字段与来源", () => {
    const registry = createRegistry();
    registry.declareRecord({
      id: "SO-1001",
      label: "订单 SO-1001",
      fields: { 客户: "华远科技", 金额: 3200, 状态: "待审批" },
    });

    const snapshot = registry.snapshot();
    expect(snapshot.records).toEqual([
      {
        id: "SO-1001",
        label: "订单 SO-1001",
        fields: { 客户: "华远科技", 金额: 3200, 状态: "待审批" },
        scope: undefined,
        source: "declared",
      },
    ]);
    expect(snapshot.recordsTotal).toBe(1);
  });

  it("字段是有界序列化的：长字符串截断、字段过多折叠（读一眼就够，不是搬数据库）", () => {
    const registry = createRegistry();
    const many: Record<string, unknown> = {};
    for (let index = 0; index < 20; index += 1) many[`f${index}`] = index;
    registry.declareRecord({
      id: "r1",
      fields: { 备注: "长".repeat(500), ...many, 函数: () => 1, 空: undefined },
    });

    const fields = registry.snapshot().records[0]!.fields;
    expect((fields.备注 as string).length).toBe(DEFAULT_RECORD_LIMITS.fields.maxString! + 1); // 结尾一个「…」
    expect(fields.函数).toBeUndefined();
    expect(fields.空).toBeUndefined();
    expect(Object.keys(fields).length).toBeLessThanOrEqual(DEFAULT_RECORD_LIMITS.fields.maxKeys! + 1); // +1 是「…」
  });

  it("条数上限：列表截断，总数照实报（模型不会以为「就这些」）", () => {
    const registry = createRegistry({ recordLimits: { maxRecords: 3 } });
    for (let index = 1; index <= 10; index += 1) registry.declareRecord({ id: `SO-100${index}`, fields: { i: index } });

    const snapshot = registry.snapshot();
    expect(snapshot.records.map((record) => record.id)).toEqual(["SO-1001", "SO-1002", "SO-1003"]);
    expect(snapshot.recordsTotal).toBe(10);
  });

  it("快照窗口：分页只影响带字段的记录，recordIds 仍覆盖整张活跃列表", () => {
    const registry = createRegistry({ recordLimits: { maxRecords: 3 } });
    for (let index = 1; index <= 5; index += 1) registry.declareRecord({ id: `t${index}`, fields: { i: index } });

    const page = registry.snapshot({ recordOffset: 1, recordLimit: 2 });
    expect(page.records.map((record) => record.id)).toEqual(["t2", "t3"]);
    expect(page.recordsTotal).toBe(5);
    expect(page.recordIds).toEqual(["t1", "t2", "t3", "t4", "t5"]);

    const picked = registry.snapshot({ recordIds: ["t5", "missing"] });
    expect(picked.records.map((record) => record.id)).toEqual(["t5"]);
    expect(picked.recordsTotal).toBe(5);
  });

  it("记录 id 索引不受字段条数上限影响：长列表的每一行都能被行内动作引用", () => {
    const registry = createRegistry({ recordLimits: { maxRecords: 3, maxRecordIds: 100 } });
    for (let index = 1; index <= 10; index += 1) {
      registry.declareRecord({ id: `SO-100${index}`, fields: { i: index } });
    }

    const snapshot = registry.snapshot();
    expect(snapshot.records.map((record) => record.id)).toEqual(["SO-1001", "SO-1002", "SO-1003"]);
    expect(snapshot.recordsTotal).toBe(10);
    expect(snapshot.recordIds).toEqual(Array.from({ length: 10 }, (_, index) => `SO-100${index + 1}`));
    expect(snapshot.recordIdsTotal).toBe(10);
  });

  it("视口外的行内动作单独收进 offscreenRecordActions：不混进可见清单，但保留可执行身份", () => {
    const registry = createRegistry();
    const visible = new Set(["SO-1001"]);
    for (const id of ["SO-1001", "SO-1002", "SO-1003"]) {
      registry.declareRecord({ id, scope: "orders", fields: { id } });
      registry.bind({
        descriptor: {
          id: `remove@order:${id}`,
          primitive: "click",
          description: `删除订单 ${id}`,
          kind: "danger",
          scope: "orders",
        },
        isAvailable: () => true,
        isVisible: () => visible.has(id),
        run: async () => {},
      });
    }
    registry.setActiveScopes(["orders"]);

    const snapshot = registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).toEqual(["remove@order:SO-1001"]);
    expect(snapshot.offscreenRecordActions.map((action) => action.id)).toEqual([
      "remove@order:SO-1002",
      "remove@order:SO-1003",
    ]);
    expect(snapshot.offscreenRecordActions.every((action) => action.offscreen)).toBe(true);
    expect(snapshot.recordIds).toEqual(["SO-1001", "SO-1002", "SO-1003"]);
    expect(snapshot.total).toBe(3); // 不可见的行仍然计入总数，不会被误认为「只有一条」
  });

  it("折叠模板说明用 {record} 替换首行身份，筛选改变首行时语义不变", () => {
    const registry = createRegistry();
    for (const id of ["SO-1001", "SO-1002"]) {
      registry.declareRecord({ id, scope: "orders", fields: { id } });
      registry.bind({
        descriptor: {
          id: `remove@order:${id}`,
          primitive: "click",
          description: `删除订单 ${id}`,
          kind: "danger",
          scope: "orders",
        },
        isAvailable: () => true,
        run: async () => {},
      });
    }
    registry.setActiveScopes(["orders"]);

    const [capability] = modelActions(registry.snapshot());
    expect(capability?.type).toBe("fold");
    if (capability?.type === "fold") {
      expect(capability.folded.description).toBe("删除订单 {record}");
    }
  });

  it("折叠模板保留声明语言的引号风格", () => {
    const registry = createRegistry();
    for (const id of ["t1", "t2"]) {
      registry.declareRecord({ id, scope: "todo", fields: { text: id } });
      registry.bind({
        descriptor: {
          id: `delete@${id}`,
          primitive: "click",
          description: `Permanently delete “${id}”.`,
          kind: "danger",
          scope: "todo",
        },
        isAvailable: () => true,
        run: async () => {},
      });
    }
    registry.setActiveScopes(["todo"]);

    const [capability] = modelActions(registry.snapshot());
    expect(capability?.type).toBe("fold");
    if (capability?.type === "fold") {
      expect(capability.folded.description).toBe("Permanently delete “{record}”.");
    }
  });

  it("作用域：区域不活跃 → 这行数据不进快照，但计入总数；激活后进来", () => {
    const registry = createRegistry();
    registry.declareRecord({ id: "r1", scope: "orders", fields: { a: 1 } });

    let snapshot = registry.snapshot();
    expect(snapshot.records).toEqual([]);
    expect(snapshot.recordsTotal).toBe(1);

    registry.setActiveScopes(["orders"]);
    snapshot = registry.snapshot();
    expect(snapshot.records.map((record) => record.id)).toEqual(["r1"]);
    expect(snapshot.records[0]!.scope).toBe("orders");
  });

  it("重复 id：先到先得；注销只删得掉自己那一条", () => {
    const registry = createRegistry();
    registry.declareRecord({ id: "dup", fields: { 谁: "先来的" } });
    const unbindSecond = registry.declareRecord({ id: "dup", fields: { 谁: "后来的" } });
    const unbindFirst = registry.declareRecord({ id: "other", fields: {} });

    expect(registry.snapshot().records[0]!.fields.谁).toBe("先来的");
    unbindSecond();
    expect(registry.snapshot().records[0]!.fields.谁).toBe("先来的"); // 后来的没登记过，注销它不该动到先来的
    unbindFirst();
    expect(registry.snapshot().records.map((record) => record.id)).toEqual(["dup"]);
  });

  it("重复 id：前一份注销后，后一份接棒（master-detail 的常见写法）", () => {
    const registry = createRegistry();
    const unbindRow = registry.declareRecord({ id: "t1", fields: { 在哪: "列表行" } });
    registry.declareRecord({ id: "t1", fields: { 在哪: "详情区" } });

    expect(registry.snapshot().records[0]!.fields.在哪).toBe("列表行");
    expect(registry.snapshot().recordsTotal).toBe(1);

    unbindRow(); // 行被归档 / 删除：详情区那份接管，记录不会凭空消失
    expect(registry.snapshot().records[0]!.fields.在哪).toBe("详情区");
    expect(registry.snapshot().recordsTotal).toBe(1);
  });

  it("字段读不出来也不能把快照搞崩（一行的 getter 抛异常只影响这一行）", () => {
    const registry = createRegistry();
    const boom: Record<string, unknown> = {};
    Object.defineProperty(boom, "坏字段", {
      enumerable: true,
      get() {
        throw new Error("读不动");
      },
    });
    registry.declareRecord({ id: "r1", fields: boom });

    expect(() => registry.snapshot()).not.toThrow();
    expect(registry.snapshot().records[0]!.fields).toEqual({ "(read failed)": "读不动" });
  });

  it("顺序：适配器报了「页面位置」就按它排（登记顺序会被 Vue 的批量挂载打乱）", () => {
    const registry = createRegistry();
    // 倒着登记（Vue 实测就是这样）：t3、t2、t1
    registry.declareRecord({ id: "t3", fields: {}, order: () => 2 });
    registry.declareRecord({ id: "t2", fields: {}, order: () => 1 });
    registry.declareRecord({ id: "t1", fields: {}, order: () => 0 });

    expect(registry.snapshot().records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("报不出位置的排在最后（信息不全时宁可不动它，也别把它塞到最前面）", () => {
    const registry = createRegistry();
    registry.declareRecord({ id: "unknown", fields: {}, order: () => undefined });
    registry.declareRecord({ id: "b", fields: {}, order: () => 1 });
    registry.declareRecord({ id: "a", fields: {}, order: () => 0 });

    expect(registry.snapshot().records.map((record) => record.id)).toEqual(["a", "b", "unknown"]);
  });

  it("没人报位置时保持登记顺序（老页面一行不改，行为不变）", () => {
    const registry = createRegistry();
    registry.declareRecord({ id: "b", fields: {} });
    registry.declareRecord({ id: "a", fields: {} });

    expect(registry.snapshot().records.map((record) => record.id)).toEqual(["b", "a"]);
  });

  it("声明 / 注销都会通知（面板与快照跟着刷新）", () => {
    const registry = createRegistry();
    const onChange = vi.fn();
    registry.onChange(onChange);

    const unbind = registry.declareRecord({ id: "r1", fields: {} });
    expect(onChange).toHaveBeenCalledTimes(1);
    unbind();
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
