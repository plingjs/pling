import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";
import { createPolicy, createRuntime } from "@plingjs/core";
import { createPling } from "../src/directive";

/**
 * `v-tool` 的**带参数**写法：一个元素上挂一条有输入的能力。
 *
 * 两条要钉住的规则（教程里也是这么写的）：
 *   1. `params` 怎么写，模型就怎么填（最终变成 JSON Schema，进快照 → 进上下文）；
 *   2. 写了 `params` → `run` 收到**整包参数**；没写（原子动作）→ 还是「那一个值」。
 *      第 2 条是这个能力不砸掉既有代码的关键：老声明一个字都不用改。
 */

const params = [
  { name: "item", label: "哪一条（记录 id）" },
  { name: "position", label: "目标位置，从 1 开始", type: "number" as const },
];

function setup(options: { params?: unknown; run?: (value?: unknown) => void; action?: string } = {}) {
  const warnings: string[] = [];
  const onRun = options.run ?? vi.fn();
  const pi = createPling(undefined, { onWarn: (message) => warnings.push(message) });
  const Component = defineComponent({
    template: `<ul v-tool="decl"><li>第一条</li></ul>`,
    setup: () => ({
      decl: {
        id: "reorder",
        desc: "把某条待办挪到指定位置",
        ...(options.params !== undefined ? { params: options.params } : {}),
        ...(options.action ? { action: options.action } : {}),
        run: onRun,
      },
    }),
  });
  const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  const runtime = createRuntime({
    registry: pi.registry,
    policy: createPolicy(async () => "always"),
    llm: async () => ({ content: "" }),
  });
  return { pi, wrapper, runtime, onRun, warnings };
}

describe("v-tool 带参数：声明 → schema", () => {
  it("参数进快照，模型看到的就是这份 schema（含必填与说明）", () => {
    const { pi } = setup({ params });
    const action = pi.registry.snapshot().actions.find((item) => item.id === "reorder")!;

    expect(action.params).toEqual({
      type: "object",
      properties: {
        item: { type: "string", description: "哪一条（记录 id）" },
        position: { type: "number", description: "目标位置，从 1 开始" },
      },
      required: ["item", "position"],
    });
  });

  it("也接受完整的 JSON Schema（要精细控制时不用绕道）", () => {
    const { pi } = setup({
      params: { type: "object", properties: { mode: { type: "string", enum: ["a"] } }, required: ["mode"] },
    });
    const action = pi.registry.snapshot().actions.find((item) => item.id === "reorder")!;
    expect(action.params.properties).toMatchObject({ mode: { enum: ["a"] } });
  });

  it("原语自己的参数和声明的参数**合并**（都进 schema）", () => {
    const { pi } = setup({ params, action: "fill" });
    const action = pi.registry.snapshot().actions.find((item) => item.id === "reorder")!;
    expect(action.params.properties).toHaveProperty("text");
    expect(action.params.required).toEqual(expect.arrayContaining(["text", "item", "position"]));
  });
});

describe("v-tool 带参数：run 收到什么", () => {
  it("写了 params：run 收到整包参数", async () => {
    const onRun = vi.fn();
    const { runtime } = setup({ params, run: onRun });

    await runtime.execute("reorder", JSON.stringify({ item: "t4", position: 3 }));
    expect(onRun).toHaveBeenCalledWith({ item: "t4", position: 3 });
  });

  it("没写 params（原子动作）：老规矩 —— 还是「那一个值」", async () => {
    const onRun = vi.fn();
    const { runtime } = setup({ run: onRun });

    await runtime.execute("reorder", JSON.stringify({ position: 3 }));
    expect(onRun).toHaveBeenCalledWith(undefined); // click 原语：点就是点，没有值
  });

  it("参数的「小毛病」在执行前就被规整（模型把数字写成字符串也一样能跑）", async () => {
    const onRun = vi.fn();
    const { runtime } = setup({ params, run: onRun });

    await runtime.execute("reorder", JSON.stringify({ item: "t4", position: "2" }));
    expect(onRun).toHaveBeenCalledWith({ item: "t4", position: 2 });
  });
});

describe("声明写错时的开发期告警", () => {
  it("声明了 params 但没接住它（click + 没有 run）：参数白声明，得说一声", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const local: string[] = [];
    const warnPi = createPling(undefined, { onWarn: (message) => local.push(message) });
    expect(pi).toBeDefined();

    const Component = defineComponent({
      template: `<ul v-tool="{ id: 'reorder', desc: '挪位置', params: [{ name: 'position', label: '第几位' }] }"><li>x</li></ul>`,
    });
    mount(Component, { attachTo: document.body, global: { plugins: [warnPi.plugin] } });

    expect(local.join("\n")).toContain("声明了 params 但没有 run");
  });
});
