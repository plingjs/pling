import { describe, expect, it, vi } from "vitest";
import { createExecutor } from "../src/executor";
import { describeFlow, describeFlowHuman, renderTemplate, resolveStepArgs, type FlowStep } from "../src/flow";
import { schemaOf, type ToolParam } from "../src/params";
import { createPolicy, type ConfirmRequest } from "../src/policy";
import { createRegistry } from "../src/registry";
import type { Binding, Kind, Primitive } from "../src/types";

/**
 * 复合动作（flow，S6a）：对模型是 **1 个 tool**，内部是一条固定顺序的流水。
 *
 * 这一组测试盯的是「把顺序从模型手里接过来」之后的四件事：
 *   1. **逐步解析** —— 第 N 步的 id 在执行到它的时候才查注册表（弹窗里的按钮那时才存在）；
 *   2. **失败如实** —— 做到第几步、哪些已经生效，一字不差地说出来（否则模型从头再来）；
 *   3. **一次业务操作一份账** —— 权限只问一次（最严那一档）、证据只取一份；
 *   4. **收敛不越权** —— 内层不再问，但比批准过的更严时**必须**再问一次。
 *
 * 页面用 `createPage()` 现搭：它模拟真实的注册 / 注销 —— `page.bind()` 是
 * **重新挂一个同名元素**（先解绑再绑定），这正是「弹窗里的按钮由前一步挂上去」的场景。
 */

const allowAll = createPolicy(async () => true);

function createPage() {
  const registry = createRegistry({ defaultApproval: "kind" });
  const calls: string[] = [];
  const state = { note: null as string | null, draft: "" };
  const unbinds = new Map<string, () => void>();

  /** 挂 / 重挂一个元素（重复 id = 前一个先卸下来，模拟 Vue 的重新挂载） */
  function bind(binding: Binding): void {
    unbinds.get(binding.descriptor.id)?.();
    unbinds.set(binding.descriptor.id, registry.bind(binding));
  }

  function element(spec: {
    id: string;
    primitive: Primitive;
    description: string;
    params?: readonly ToolParam[];
    kind?: Kind;
    confirm?: boolean;
    available?: boolean | { available: boolean; reason?: string };
    run?: (args: Record<string, unknown>) => void;
  }): void {
    const declared = spec.params ? schemaOf(spec.params) : undefined;
    bind({
      descriptor: {
        id: spec.id,
        primitive: spec.primitive,
        description: spec.description,
        ...(declared ? { params: declared } : {}),
        ...(spec.kind ? { kind: spec.kind } : {}),
        ...(spec.confirm !== undefined ? { confirm: spec.confirm } : {}),
      },
      isAvailable: () => spec.available ?? true,
      ...(spec.run ? { run: async (args) => spec.run!(args) } : {}),
    });
  }

  /** 绑一条复合动作（对模型就是一个 tool） */
  function flow(
    id: string,
    steps: readonly FlowStep[],
    extra: {
      params?: readonly ToolParam[];
      kind?: Kind;
      confirm?: boolean;
      description?: string;
    } = {},
  ): void {
    const declared = schemaOf(
      extra.params ?? [
        { name: "orderId", label: "订单号" },
        { name: "note", label: "新的备注" },
      ],
    );
    bind({
      descriptor: {
        id,
        primitive: "flow",
        description: extra.description ?? `流程：${id}`,
        ...(declared ? { params: declared } : {}),
        ...(extra.kind ? { kind: extra.kind } : {}),
        ...(extra.confirm !== undefined ? { confirm: extra.confirm } : {}),
      },
      isAvailable: () => true,
      steps,
    });
  }

  // ── 一个「订单页」的最小模型 ──
  element({
    id: "search_query",
    primitive: "type",
    description: "在搜索框里输入关键词",
    params: [{ name: "text", label: "关键词" }],
    run: (args) => {
      calls.push(`search:${String(args.text)}`);
      state.draft = String(args.text);
    },
  });
  element({
    id: "edit@order:SO-1002",
    primitive: "click",
    description: "打开 SO-1002 的编辑弹窗",
    run: () => {
      calls.push("edit:SO-1002");
    },
  });
  element({
    id: "dialog_note",
    primitive: "type",
    description: "在弹窗的备注框里输入",
    params: [{ name: "text", label: "备注内容" }],
    run: (args) => {
      calls.push(`note:${String(args.text)}`);
      state.note = String(args.text);
    },
  });
  element({
    id: "dialog_save",
    primitive: "click",
    description: "保存并关闭弹窗",
    run: () => {
      calls.push("save");
    },
  });
  element({
    id: "remove@order:SO-1002",
    primitive: "click",
    description: "删除 SO-1002",
    kind: "danger",
    run: () => {
      calls.push("remove:SO-1002");
    },
  });

  registry.declareRecord({
    id: "SO-1002",
    fields: () => ({ 备注: state.note, 状态: "待处理" }),
  });

  return { registry, calls, state, bind, element, flow };
}

/** 「录一条订单备注」= 搜索 → 打开弹窗 → 填备注 → 保存 */
const FILL_NOTE: FlowStep[] = [
  { action: "search_query", args: { text: "{{orderId}}" }, desc: "搜索这个订单" },
  { action: "edit@order:{{orderId}}", desc: "打开编辑弹窗" },
  { action: "dialog_note", args: { text: "{{note}}" }, desc: "填上备注" },
  { action: "dialog_save", desc: "保存并关闭弹窗" },
];

const as_result = (out: unknown): { result: any; error: any } => out as { result: any; error: any };

describe("复合动作：顺序、占位符、逐步解析", () => {
  it("按顺序走完 4 步，占位符替换成这次调用的参数", async () => {
    const page = createPage();
    page.flow("fill_note", FILL_NOTE);
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("fill_note", JSON.stringify({ orderId: "SO-1002", note: "约吃饭" })));

    expect(out.error).toBeUndefined();
    expect(out.result).toMatchObject({ ok: true, flow: { completed: 4, total: 4 } });
    expect(page.calls).toEqual(["search:SO-1002", "edit:SO-1002", "note:约吃饭", "save"]);
    expect(page.state.note).toBe("约吃饭");
    // 逐步回执里的 id 是**替换后**的真实 id：模型据此知道刚才点的是哪一条
    expect(out.result.flow.steps.map((step: { id: string }) => step.id)).toEqual([
      "search_query",
      "edit@order:SO-1002",
      "dialog_note",
      "dialog_save",
    ]);
    expect(out.result.flow.steps[0].desc).toBe("搜索这个订单");
  });

  it("整条流程只取一份证据：快照组装两次（前 / 后），不是每步一份", async () => {
    const page = createPage();
    page.flow("fill_note", FILL_NOTE);
    const snapshot = vi.spyOn(page.registry, "snapshot");
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("fill_note", JSON.stringify({ orderId: "SO-1002", note: "约吃饭" })));

    expect(snapshot).toHaveBeenCalledTimes(2);
    // 一份证据说的是「这次业务操作改了什么」：备注字段变了，而且行没有增减
    expect(out.result.changed.observed).toBe(true);
    expect(out.result.changed.records.updated).toEqual([{ id: "SO-1002", fields: ["备注"] }]);
  });

  it("每步之后落定（settle），步与步之间才停一下（betweenSteps）", async () => {
    const page = createPage();
    page.flow("fill_note", FILL_NOTE);
    const settle = vi.fn(async () => {});
    const betweenSteps = vi.fn(async () => {});
    const executor = createExecutor({ registry: page.registry, policy: allowAll, settle, betweenSteps });

    await executor.execute("fill_note", JSON.stringify({ orderId: "SO-1002", note: "约吃饭" }));

    expect(settle).toHaveBeenCalledTimes(4);
    // 4 步之间有 3 个空档；最后一步做完不该再「停顿」（那会平白多等一次）
    expect(betweenSteps).toHaveBeenCalledTimes(3);
  });

  it("逐步解析：第 2 步的 id 跑到它跟前才注册，也能找到", async () => {
    const page = createPage();
    // 「保存」按钮此刻还不存在 —— 它由第 1 步（打开弹窗）挂上去
    page.element({
      id: "open_editor",
      primitive: "click",
      description: "打开编辑弹窗",
      run: () => {
        page.calls.push("open_editor");
        page.element({
          id: "dialog_save",
          primitive: "click",
          description: "保存并关闭弹窗",
          run: () => {
            page.calls.push("save");
          },
        });
      },
    });
    page.flow("fill_note", [{ action: "open_editor" }, { action: "dialog_save" }], { params: [] });
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("fill_note", "{}"));

    expect(out.error).toBeUndefined();
    expect(page.calls).toEqual(["open_editor", "save"]);
    expect(out.result.flow.completed).toBe(2);
  });

  it("步骤 id 一直没注册 → 这一步失败，说清是「未知动作」", async () => {
    const page = createPage();
    page.flow("fill_note", [{ action: "never_registered" }], { params: [] });
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("fill_note", "{}"));

    expect(out.error.code).toBe("STEP_FAILED");
    expect(out.error.message).toContain("never_registered");
    expect(out.error.message).toContain("Unknown action");
  });

  it("清单里带上「这条是流程、有几步」（模型据此不去自己拆开做）", async () => {
    const page = createPage();
    page.flow("fill_note", FILL_NOTE);
    const view = page.registry.snapshot().actions.find((action) => action.id === "fill_note");
    expect(view).toMatchObject({ primitive: "flow", flowSteps: 4 });
  });

  it("既没有 run 也没有 steps → 明确报错，而不是静默成功", async () => {
    const page = createPage();
    page.bind({
      descriptor: { id: "empty", primitive: "click", description: "什么都没接的动作" },
      isAvailable: () => true,
    } as Binding);
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("empty", "{}"));
    expect(out.error.code).toBe("EXECUTION_FAILED");
    expect(out.error.message).toContain("has neither run nor steps");
  });
});

describe("复合动作：失败要如实", () => {
  it("第 4 步失败 → STEP_FAILED，说清做到第几步、前面已经生效、不要从第一步重来", async () => {
    const page = createPage();
    page.flow("fill_note", FILL_NOTE);
    // 保存炸了 —— 典型场景：后端 500
    page.element({
      id: "dialog_save",
      primitive: "click",
      description: "保存并关闭弹窗",
      run: () => {
        throw new Error("接口 500");
      },
    });
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("fill_note", JSON.stringify({ orderId: "SO-1002", note: "约吃饭" })));

    expect(out.error.code).toBe("STEP_FAILED");
    expect(out.error.message).toContain("failed at step 4/4 (dialog_save)");
    expect(out.error.message).toContain("接口 500");
    // 逐步账本要进错误信息，模型才知道自己走到哪了
    expect(out.error.message).toContain("3/4 steps");
    expect(out.error.message).toContain("have already taken effect");
    expect(out.error.message).toContain("do not restart the entire flow");
    // 前 3 步真的生效了（备注已经填进状态），这正是「不许从头再来」的根据
    expect(page.state.note).toBe("约吃饭");
    expect(page.calls).toEqual(["search:SO-1002", "edit:SO-1002", "note:约吃饭"]);
  });

  it("中断之后不再往下走：后面的步骤一步都没执行，且报出不可用的原因", async () => {
    const page = createPage();
    page.flow("fill_note", FILL_NOTE);
    page.element({
      id: "edit@order:SO-1002",
      primitive: "click",
      description: "打开 SO-1002 的编辑弹窗",
      available: { available: false, reason: "这条订单已经不在列表里" },
      run: () => {
        page.calls.push("edit:SO-1002");
      },
    });
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("fill_note", JSON.stringify({ orderId: "SO-1002", note: "约吃饭" })));

    expect(out.error.code).toBe("STEP_FAILED");
    expect(out.error.message).toContain("failed at step 2/4");
    expect(out.error.message).toContain("这条订单已经不在列表里");
    expect(page.calls).toEqual(["search:SO-1002"]);
    expect(page.state.note).toBeNull();
  });

  it("optional 步骤失败 → 跳过它继续跑完，回执里如实说「跳过了」", async () => {
    const page = createPage();
    page.flow(
      "fill_note",
      [
        { action: "search_query", args: { text: "{{orderId}}" } },
        { action: "tip_banner", desc: "顺手关掉提示条", optional: true },
        { action: "dialog_save" },
      ],
      { params: [{ name: "orderId", label: "订单号" }] },
    );
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("fill_note", JSON.stringify({ orderId: "SO-1002" })));

    expect(out.error).toBeUndefined();
    expect(out.result.flow).toMatchObject({ completed: 2, total: 3 });
    expect(out.result.flow.steps[1]).toMatchObject({ id: "tip_banner", ok: false, skipped: true });
    expect(out.result.warning).toContain("1 optional step(s) were skipped");
    // 跳过之后流程照常往下走
    expect(page.calls).toEqual(["search:SO-1002", "save"]);
  });

  it("占位符没有对应参数 → 当场说清缺哪个，而不是拼出 edit@order: 再报「未知动作」", async () => {
    const page = createPage();
    page.flow("fill_note", [{ action: "edit@order:{{orderId}}", desc: "打开编辑弹窗" }], {
      params: [{ name: "orderId", label: "订单号", optional: true }],
    });
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("fill_note", "{}"));

    expect(out.error.code).toBe("STEP_FAILED");
    expect(out.error.message).toContain("{{orderId}}");
    expect(out.error.message).toContain("has no value");
    expect(page.calls).toEqual([]);
  });

  it("流程自己的必填参数没给 → 在动页面之前就报 INVALID_PARAMS", async () => {
    const page = createPage();
    page.flow("fill_note", FILL_NOTE);
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("fill_note", "{}"));

    expect(out.error.code).toBe("INVALID_PARAMS");
    expect(out.error.message).toContain("orderId");
    expect(page.calls).toEqual([]);
  });
});

describe("复合动作：风险聚合与确认闸门", () => {
  it("整条流程只问一次：确认里给的是步骤最严的那一档 + 要走哪几步", async () => {
    const page = createPage();
    page.flow("fill_note", FILL_NOTE);
    const requests: ConfirmRequest[] = [];
    const policy = createPolicy(async (request) => {
      requests.push(request);
      return true;
    });
    const executor = createExecutor({ registry: page.registry, policy });

    await executor.execute("fill_note", JSON.stringify({ orderId: "SO-1002", note: "约吃饭" }));

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      id: "fill_note",
      kind: "write",
      approval: "ask",
      args: { orderId: "SO-1002", note: "约吃饭" },
      // 人看到的确认是「一次业务操作」：要让他知道这一下会走哪几步
      flow: { steps: ["search_query", "edit@order:{{orderId}}", "dialog_note", "dialog_save"] },
    });
  });

  it("步骤里藏着更危险的动作（带占位符、此刻解析不出来）→ 那一步当场再问一次", async () => {
    const page = createPage();
    page.flow("note_then_remove", [
      { action: "dialog_note", args: { text: "{{note}}" } },
      { action: "remove@order:{{orderId}}", desc: "删掉这个订单" },
    ]);
    const requests: ConfirmRequest[] = [];
    const policy = createPolicy(async (request) => {
      requests.push(request);
      return true;
    });
    const executor = createExecutor({ registry: page.registry, policy });

    await executor.execute("note_then_remove", JSON.stringify({ orderId: "SO-1002", note: "改完就删" }));

    expect(requests.map((request) => request.kind)).toEqual(["write", "danger"]);
    // 第二次问的是那个危险动作本身 —— 它没被第一次确认覆盖
    expect(requests[1]).toMatchObject({ id: "remove@order:SO-1002", approval: "ask-always" });
    expect(requests[1]!.flow).toBeUndefined();
    expect(page.calls).toEqual(["note:改完就删", "remove:SO-1002"]);
  });

  it("危险步骤写在明面上（id 能静态解析）→ 一次确认就把它算进去，不再问第二次", async () => {
    const page = createPage();
    page.flow("note_then_remove", [
      { action: "dialog_note", args: { text: "{{note}}" } },
      { action: "remove@order:SO-1002", desc: "删掉这个订单" },
    ]);
    const requests: ConfirmRequest[] = [];
    const policy = createPolicy(async (request) => {
      requests.push(request);
      return true;
    });
    const executor = createExecutor({ registry: page.registry, policy });

    await executor.execute("note_then_remove", JSON.stringify({ orderId: "SO-1002", note: "改完就删" }));

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ id: "note_then_remove", kind: "danger", approval: "ask-always" });
  });

  it("用户拒绝 → PERMISSION_DENIED，页面一动不动（拒绝发生在第一步之前）", async () => {
    const page = createPage();
    page.flow("fill_note", FILL_NOTE);
    const executor = createExecutor({ registry: page.registry, policy: createPolicy(async () => false) });

    const out = as_result(await executor.execute("fill_note", JSON.stringify({ orderId: "SO-1002", note: "约吃饭" })));

    expect(out.error.code).toBe("PERMISSION_DENIED");
    expect(page.calls).toEqual([]);
  });

  it("流程内部不各自取证据：内层步骤的回执里没有 changed（只有整条流程一份）", async () => {
    const page = createPage();
    page.flow("fill_note", FILL_NOTE);
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("fill_note", JSON.stringify({ orderId: "SO-1002", note: "约吃饭" })));

    // 内层步骤只以「逐步账本」的形式出现：id / ok / desc，没有各自的 changed
    const step = out.result.flow.steps[3];
    expect(step).toMatchObject({ index: 4, id: "dialog_save", ok: true });
    expect(step.changed).toBeUndefined();
  });
});

describe("复合动作：嵌套与防线", () => {
  it("步骤引用自己 → 深度上限先到，报一条能看懂的错（不是栈溢出）", async () => {
    const page = createPage();
    page.flow("loop", [{ action: "loop" }], { params: [] });
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(await executor.execute("loop", "{}"));

    expect(out.error.code).toBe("STEP_FAILED");
    expect(out.error.message).toContain("nested too deeply");
    expect(out.error.message).toContain("limit: 5");
  });

  it("流程可以引用流程：小流程复用两次，外层拿到的是一份总账", async () => {
    const page = createPage();
    page.flow("fill_note", [
      { action: "search_query", args: { text: "{{orderId}}" } },
      { action: "dialog_note", args: { text: "{{note}}" } },
    ]);
    page.flow(
      "two_notes",
      [
        { action: "fill_note", args: { orderId: "{{first}}", note: "{{a}}" }, desc: "第一条" },
        { action: "fill_note", args: { orderId: "{{second}}", note: "{{b}}" }, desc: "第二条" },
      ],
      {
        params: [
          { name: "first", label: "第一个订单号" },
          { name: "second", label: "第二个订单号" },
          { name: "a", label: "第一条备注" },
          { name: "b", label: "第二条备注" },
        ],
      },
    );
    const executor = createExecutor({ registry: page.registry, policy: allowAll });

    const out = as_result(
      await executor.execute("two_notes", JSON.stringify({ first: "SO-1001", second: "SO-1002", a: "甲", b: "乙" })),
    );

    expect(out.error).toBeUndefined();
    expect(out.result.flow.completed).toBe(2);
    expect(page.calls).toEqual(["search:SO-1001", "note:甲", "search:SO-1002", "note:乙"]);
    expect(page.state.note).toBe("乙");
    // 内层流程也只占外层账本里的一行（它自己有几步，是它的事）
    expect(out.result.flow.steps.map((step: { id: string }) => step.id)).toEqual(["fill_note", "fill_note"]);
  });
});

describe("复合动作：模板工具（单元）", () => {
  it("renderTemplate：替换多个占位符，允许两侧空格，数字也转成文本", () => {
    expect(renderTemplate("edit@order:{{ orderId }}", { orderId: "SO-1" })).toBe("edit@order:SO-1");
    expect(renderTemplate("{{a}}-{{b}}", { a: 1, b: "x" })).toBe("1-x");
  });

  it("renderTemplate：空值 / 缺值一律报错，并列出这次到底给了什么", () => {
    expect(() => renderTemplate("{{orderId}}", {})).toThrow(/has no value/);
    expect(() => renderTemplate("{{orderId}}", {})).toThrow(/\(none\)/);
    expect(() => renderTemplate("{{note}}", { note: "", orderId: "SO-1" })).toThrow(/orderId/);
  });

  it("resolveStepArgs：对象走占位符，函数是逃生口（自己算）", () => {
    expect(resolveStepArgs({ action: "x", args: { text: "{{note}}" } }, { note: "hi" })).toEqual({ text: "hi" });
    expect(resolveStepArgs({ action: "x" }, {})).toEqual({});
    const step: FlowStep = { action: "x", args: (params) => ({ text: String(params.note).trim() }) };
    expect(resolveStepArgs(step, { note: "  hi  " })).toEqual({ text: "hi" });
  });

  it("describeFlow：逐步账本说成一句人话（跳过的可选步骤不是 ✗）", () => {
    expect(
      describeFlow({
        steps: [
          { index: 1, id: "search_query", ok: true },
          { index: 2, id: "dialog_save", ok: false },
          { index: 3, id: "tip_banner", ok: false, skipped: true },
        ],
        completed: 1,
        total: 3,
      }),
    ).toBe("1/3 steps: search_query✓ / dialog_save✗ / tip_banner(skipped)");
  });

  it("describeFlow：超长流程只报前 12 步 + 省略号（免得把上下文吃掉）", () => {
    const steps = Array.from({ length: 20 }, (_, index) => ({ index: index + 1, id: `s${index + 1}`, ok: true }));
    const text = describeFlow({ steps, completed: 20, total: 20 });
    expect(text.startsWith("20/20 steps: s1✓")).toBe(true);
    expect(text).toContain("s12✓");
    expect(text).not.toContain("s13");
    expect(text.endsWith(" …")).toBe(true);
  });

  it("describeFlowHuman：English labels for completion, handoff, and skipped steps", () => {
    expect(
      describeFlowHuman(
        {
          steps: [
            { index: 1, id: "search_query", ok: true, desc: "Search the order" },
            { index: 2, id: "upload", ok: true, desc: "Upload the receipt", handoff: "Choose a file" },
            { index: 3, id: "tip_banner", ok: false, skipped: true, desc: "Close the tip" },
          ],
          completed: 2,
          total: 3,
        },
        { locale: "en-US" },
      ),
    ).toBe("2/3 steps: Search the order✓ → Upload the receipt(manual)✓ → Close the tip(skipped)");
  });
});
