import { describe, expect, it, vi } from "vitest";
import { createPolicy, createRegistry, createRuntime, normalizeDeclaredArgs, toJsonSchema } from "../src/index";
import type { Registry } from "../src/index";

/**
 * 带参数的动作：声明 → 给模型的 schema → 执行前的校验与规整。
 *
 * 这一层要同时照顾两件事：
 *   - 模型那边：参数说明 / 必填 / 枚举都要**如实**出现在 schema 里（它只有这一份说明书）；
 *   - 业务那边：`run` 拿到的参数一定是**规整过的**（`"3"` → `3`），需要出错时出错得**可行动**。
 */

const params = [
  { name: "item", label: "哪一条（记录 id）" },
  { name: "position", label: "目标位置，从 1 开始", type: "number" as const },
  { name: "mode", label: "怎么放", values: ["before", "after"], optional: true },
];

describe("声明式参数 → JSON Schema", () => {
  it("默认必填、类型默认 string、label 就是模型的参数说明", () => {
    expect(toJsonSchema(params)).toEqual({
      type: "object",
      properties: {
        item: { type: "string", description: "哪一条（记录 id）" },
        position: { type: "number", description: "目标位置，从 1 开始" },
        mode: { type: "string", description: "怎么放", enum: ["before", "after"] },
      },
      required: ["item", "position"],
    });
  });

  it("optional: true 才不进 required（默认必填是故意 fail-closed 的）", () => {
    const schema = toJsonSchema([{ name: "a", label: "A" }, { name: "b", label: "B", optional: true }]);
    expect(schema.required).toEqual(["a"]);
  });

  it("空枚举不写进 schema（`values: []` 是笔误，不该让模型无值可选）", () => {
    expect(toJsonSchema([{ name: "a", label: "A", values: [] }]).properties).toMatchObject({
      a: { type: "string", description: "A" },
    });
  });
});

describe("执行前：校验 + 规整", () => {
  const schema = toJsonSchema(params);

  it("缺必填 → 报错里点名道姓，还带着那句说明（模型据此自救）", () => {
    expect(() => normalizeDeclaredArgs(schema, { item: "t4" })).toThrowError(
      'Missing required parameter "position" (目标位置，从 1 开始)',
    );
  });

  it("不在枚举里 → 把可选值列出来", () => {
    expect(() => normalizeDeclaredArgs(schema, { item: "t4", position: 1, mode: "middle" })).toThrowError(
      'Parameter "mode" must be one of: before / after; received "middle"',
    );
  });

  it("模型常犯的小毛病：把数字写成字符串 → 规整成数字（不是报错）", () => {
    expect(normalizeDeclaredArgs(schema, { item: "t4", position: "3" })).toEqual({ item: "t4", position: 3 });
  });

  it("真的转不了才报错", () => {
    expect(() => normalizeDeclaredArgs(schema, { item: "t4", position: "后面" })).toThrowError(
      'Parameter "position" must be a number (目标位置，从 1 开始); received "后面"',
    );
    expect(() => normalizeDeclaredArgs(schema, { item: { id: "t4" }, position: 1 })).toThrowError(
      'Parameter "item" must be a string (哪一条（记录 id）); received {"id":"t4"}',
    );
  });

  it("没声明的键原样留着（框架不该收走别的层要用的东西）", () => {
    expect(normalizeDeclaredArgs(schema, { item: "t4", position: 1, extra: true })).toEqual({
      item: "t4",
      position: 1,
      extra: true,
    });
  });

  it("没写 params 的动作：一个键都不动（老行为不变）", () => {
    const args = { text: 42, weird: "keep" };
    expect(normalizeDeclaredArgs(undefined, args)).toBe(args);
  });

  it("可选的参数可以不来，也不会留下一个 null", () => {
    expect(normalizeDeclaredArgs(schema, { item: "t4", position: 1, mode: null })).toEqual({ item: "t4", position: 1 });
  });
});

describe("整条流水线：参数在正确的位置被校验", () => {
  function setup(): { registry: Registry; run: ReturnType<typeof vi.fn>; check: ReturnType<typeof vi.fn> } {
    const run = vi.fn();
    const check = vi.fn(async () => "always" as const);
    const registry = createRegistry();
    registry.bind({
      descriptor: {
        id: "reorder",
        primitive: "click",
        description: "把某条挪到第几位",
        kind: "write",
        params: toJsonSchema(params),
      },
      isAvailable: () => true,
      run: async (args) => run(args),
    });
    return { registry, run, check };
  }

  it("run 拿到的是规整后的参数", async () => {
    const { registry, run } = setup();
    const runtime = createRuntime({ registry, policy: createPolicy(async () => "always"), llm: async () => ({ content: "" }) });

    await runtime.execute("reorder", JSON.stringify({ item: "t4", position: "1" }));
    expect(run).toHaveBeenCalledWith({ item: "t4", position: 1 });
  });

  it("缺必填参数时**不去打扰用户**：参数校验在确认闸门之前", async () => {
    const { registry, run, check } = setup();
    const runtime = createRuntime({
      registry,
      // 一律停下来问人；如果参数校验排在它后面，这条就会被白问一次
      policy: { check },
      llm: async () => ({ content: "" }),
    });

    const result = await runtime.execute("reorder", JSON.stringify({ item: "t4" }));
    expect(result).toMatchObject({ error: { code: "INVALID_PARAMS" } });
    expect(check).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("确认闸门看到的是规整后的参数（人看到的和真正执行的是同一份）", async () => {
    const { registry, check } = setup();
    const runtime = createRuntime({ registry, policy: { check }, llm: async () => ({ content: "" }) });

    await runtime.execute("reorder", JSON.stringify({ item: "t4", position: "2" }));
    expect(check).toHaveBeenCalledWith(expect.objectContaining({ args: { item: "t4", position: 2 } }));
  });

  it("快照里的 schema 是「原语 + 声明」合并后的那份（模型看到的就是它）", () => {
    const { registry } = setup();
    const action = registry.snapshot().actions.find((item) => item.id === "reorder")!;

    expect(action.params.required).toEqual(["item", "position"]);
    expect(action.params.properties).toMatchObject({
      item: { type: "string", description: "哪一条（记录 id）" },
      mode: { enum: ["before", "after"] },
    });
  });
});

describe("S6b-1：值域、格式与动态选项", () => {
  it("约束进 schema：数值范围 / 长度 / 正则", () => {
    const schema = toJsonSchema([
      { name: "amount", label: "金额", type: "number", min: 0, max: 10000 },
      { name: "note", label: "备注", maxLength: 20 },
      { name: "orderId", label: "订单号", pattern: /^SO-\d{4}$/ },
      { name: "due", label: "回款日", format: "date" },
    ]);
    expect(schema.properties).toMatchObject({
      amount: { type: "number", minimum: 0, maximum: 10000 },
      note: { maxLength: 20 },
      orderId: { pattern: "^SO-\\d{4}$" },
      due: { format: "date" },
    });
    expect(schema.properties!.note).not.toHaveProperty("pattern");
  });

  it("format: date 不只看形状：2026-02-30 这种日子不存在，也拒绝", () => {
    const schema = toJsonSchema([{ name: "due", label: "回款日", format: "date" }]);
    expect(normalizeDeclaredArgs(schema, { due: "2026-02-28" })).toEqual({ due: "2026-02-28" });
    expect(() => normalizeDeclaredArgs(schema, { due: "2026-02-30" })).toThrowError(
      'Parameter "due" must be a real calendar date in YYYY-MM-DD format (回款日); received "2026-02-30"',
    );
  });

  it("动态选项每次重新求值：列表变了，enum 跟着变", () => {
    let orders = ["SO-1001", "SO-1002"];
    const params = [
      {
        name: "orderId",
        label: "订单号",
        options: () => orders.map((id) => ({ value: id, label: `${id} 的客户` })),
      },
    ] as const;

    const first = toJsonSchema(params);
    expect(first.properties!.orderId).toMatchObject({
      enum: ["SO-1001", "SO-1002"],
      description: "订单号 (2 options available: SO-1001 (SO-1001 的客户) / SO-1002 (SO-1002 的客户))",
    });

    orders = ["SO-1001", "SO-1002", "SO-1003"];
    expect(toJsonSchema(params).properties!.orderId).toMatchObject({
      enum: ["SO-1001", "SO-1002", "SO-1003"],
      description:
        "订单号 (3 options available: SO-1001 (SO-1001 的客户) / SO-1002 (SO-1002 的客户) / SO-1003 (SO-1003 的客户))",
    });
  });

  it("动态选项的 label 只抄前 8 个进 description，其余报总数", () => {
    const orders = Array.from({ length: 10 }, (_, i) => ({ value: `SO-${1001 + i}`, label: `客户${i + 1}` }));
    const schema = toJsonSchema([{ name: "orderId", label: "订单号", options: () => orders }]);
    const description = (schema.properties!.orderId as { description: string }).description;
    expect(description).toContain("SO-1001 (客户1)");
    expect(description).toContain("SO-1008 (客户8)");
    expect(description).not.toContain("SO-1009");
    expect(description).toContain("… (10 total)");
  });

  it("选项读不到时不拖垮 schema：动作仍可用，说明里如实写原因", () => {
    const schema = toJsonSchema([
      {
        name: "customer",
        label: "客户",
        options: () => {
          throw new Error("接口 502");
        },
      },
    ]);
    expect(schema.properties!.customer).toMatchObject({ type: "string" });
    expect(schema.properties!.customer).not.toHaveProperty("enum");
    expect((schema.properties!.customer as { description: string }).description).toContain(
      "option lookup failed: 接口 502",
    );
  });

  it("执行前按约束校验，错误信息可行动", () => {
    const schema = toJsonSchema([
      { name: "amount", label: "金额", type: "number", min: 0, max: 10000 },
      { name: "note", label: "备注", maxLength: 5 },
      { name: "orderId", label: "订单号", pattern: /^SO-\d{4}$/ },
    ]);

    expect(() => normalizeDeclaredArgs(schema, { amount: -1, note: "a", orderId: "SO-1001" })).toThrowError(
      'Parameter "amount" must be >= 0 (金额); received -1',
    );
    expect(() => normalizeDeclaredArgs(schema, { amount: 10001, note: "a", orderId: "SO-1001" })).toThrowError(
      'Parameter "amount" must be <= 10000 (金额); received 10001',
    );
    expect(() => normalizeDeclaredArgs(schema, { amount: 1, note: "123456", orderId: "SO-1001" })).toThrowError(
      'Parameter "note" must be at most 5 characters (备注); received "123456" (6 characters)',
    );
    expect(() => normalizeDeclaredArgs(schema, { amount: 1, note: "a", orderId: "1001" })).toThrowError(
      'Parameter "orderId" must match ^SO-\\d{4}$ (订单号); received "1001"',
    );
  });

  it("数字枚举先规整再比较：\"3\" 与 3 是同一个值", () => {
    const schema = toJsonSchema([{ name: "level", label: "优先级", type: "number", values: [1, 2, 3] }]);
    expect(normalizeDeclaredArgs(schema, { level: "2" })).toEqual({ level: 2 });
    expect(() => normalizeDeclaredArgs(schema, { level: 4 })).toThrowError(
      'Parameter "level" must be one of: 1 / 2 / 3; received 4',
    );
  });

  it("选项很多时错误只列前 8 个，并报总数", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `SO-${1001 + i}`);
    const schema = toJsonSchema([{ name: "orderId", label: "订单号", values: ids }]);
    expect(() => normalizeDeclaredArgs(schema, { orderId: "SO-9999" })).toThrowError(
      `Parameter "orderId" must be one of: ${ids.slice(0, 8).join(" / ")} … (10 total); received "SO-9999"`,
    );
  });

  it("快照与执行都用**此刻**的 schema（Binding.resolveParams），不是注册时那份", async () => {
    let allowed = ["SO-1001"];
    const stale = toJsonSchema([{ name: "orderId", label: "订单号", values: ["SO-1001"] }]);
    const registry = createRegistry();
    const run = vi.fn();
    registry.bind({
      descriptor: {
        id: "pick_order",
        primitive: "click",
        description: "选一条订单",
        kind: "write",
        params: stale,
      },
      resolveParams: () => toJsonSchema([{ name: "orderId", label: "订单号", values: allowed }]),
      isAvailable: () => true,
      run: async (args) => run(args),
    });

    // 选项变了：快照里立刻能看到新值
    allowed = ["SO-1001", "SO-1002"];
    const action = registry.snapshot().actions.find((item) => item.id === "pick_order")!;
    expect(action.params!.properties!.orderId).toMatchObject({ enum: ["SO-1001", "SO-1002"] });

    // 执行时也按新值校验：旧的注册 schema 不该把新选项判成非法
    const runtime = createRuntime({ registry, policy: createPolicy(async () => "always"), llm: async () => ({ content: "" }) });
    await runtime.execute("pick_order", JSON.stringify({ orderId: "SO-1002" }));
    expect(run).toHaveBeenCalledWith({ orderId: "SO-1002" });
  });
});
