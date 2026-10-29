import { mount } from "@vue/test-utils";
import { defineComponent, h, resolveDirective, withDirectives, type VNode } from "vue";
import { describe, expect, it, vi } from "vitest";
import { createPolicy, createRuntime } from "@plingjs/core";
import { createPling } from "../src/directive";

interface Case {
  tag: string;
  attrs?: Record<string, unknown>;
  options: Record<string, unknown>;
  children?: VNode[] | string;
}

/** 用 render 函数搭一个宿主组件，把若干 v-tool 声明挂上去 */
function host(cases: Case[]) {
  return defineComponent({
    render() {
      const tool = resolveDirective("tool")!;
      return h(
        "div",
        cases.map((item) => withDirectives(h(item.tag, item.attrs ?? {}, item.children ?? "x"), [[tool, item.options]])),
      );
    },
  });
}

function setup(cases: Case[]) {
  const warnings: string[] = [];
  const pi = createPling(undefined, { onWarn: (message) => warnings.push(message) });
  const wrapper = mount(host(cases), { attachTo: document.body, global: { plugins: [pi.plugin] } });
  const runtime = createRuntime({
    registry: pi.registry,
    policy: createPolicy(async () => true),
    llm: async () => ({ content: "" }),
  });
  const fidelityOf = (id: string): string | undefined =>
    pi.registry.snapshot().actions.find((a) => a.id === id)?.fidelity;
  return { pi, wrapper, runtime, warnings, fidelityOf };
}

describe("目标解析：注册期就算出「这个原语该作用在谁身上」", () => {
  it("声明元素本身是原生可交互元素 → high，不告警", async () => {
    const onClick = vi.fn();
    const { runtime, warnings, fidelityOf, wrapper } = setup([
      { tag: "button", attrs: { onClick }, options: { id: "native_btn", desc: "原生按钮" } },
    ]);
    expect(fidelityOf("native_btn")).toBe("high");
    expect(warnings).toEqual([]);
    expect(await runtime.execute("native_btn", "{}")).toMatchObject({ result: { ok: true } });
    expect(onClick).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("给了 run → high（注入），不做自动定位、不告警", async () => {
    const run = vi.fn();
    const { runtime, warnings, fidelityOf, wrapper } = setup([
      { tag: "div", options: { id: "injected", desc: "注入", run } },
    ]);
    expect(fidelityOf("injected")).toBe("high");
    expect(warnings).toEqual([]);
    await runtime.execute("injected", "{}");
    expect(run).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("★ 自定义组件根元素 + 内层唯一原生 button → auto，而且真的生效", async () => {
    const onClick = vi.fn();
    const { runtime, warnings, fidelityOf, wrapper } = setup([
      {
        tag: "div",
        attrs: { class: "wrapper" },
        options: { id: "auto_btn", desc: "包装 div 里的按钮" },
        children: [h("button", { onClick, "data-testid": "inner" }, "点我")],
      },
    ]);

    expect(fidelityOf("auto_btn")).toBe("auto");
    expect(warnings).toEqual([]); // 自动解决了，就不该吵

    const result = await runtime.execute("auto_btn", "{}");
    expect(result).toMatchObject({ result: { ok: true, fidelity: "auto" } });
    expect(onClick).toHaveBeenCalledOnce(); // 关键：目标定位对了，动作真的发生
    wrapper.unmount();
  });

  it("候选不唯一 → 保持 low，并告警说明有几个候选", async () => {
    const onClick = vi.fn();
    const { runtime, warnings, fidelityOf, wrapper } = setup([
      {
        tag: "div",
        options: { id: "two_buttons", desc: "两个按钮，说不清点哪个" },
        children: [h("button", { onClick }, "A"), h("button", {}, "B")],
      },
    ]);

    expect(fidelityOf("two_buttons")).toBe("low");
    expect(warnings.some((w) => w.includes("two_buttons") && w.includes("2 个候选"))).toBe(true);

    const result = await runtime.execute("two_buttons", "{}");
    expect(result).toMatchObject({ result: { ok: true, fidelity: "low" } });
    expect(onClick).not.toHaveBeenCalled(); // 没有瞎猜
    wrapper.unmount();
  });

  it("内层没有可用的原生元素 → 保持 low，并告警给两种修法", async () => {
    const { warnings, fidelityOf, wrapper } = setup([
      { tag: "span", attrs: { class: "plain" }, options: { id: "no_target", desc: "纯文本" } },
    ]);
    expect(fidelityOf("no_target")).toBe("low");
    const message = warnings.find((w) => w.includes("no_target"))!;
    expect(message).toContain("run");
    expect(message).toContain("target");
    wrapper.unmount();
  });

  it("显式 target 选择器 → high，命中指定元素（多候选也能消歧）", async () => {
    const onA = vi.fn();
    const onB = vi.fn();
    const { runtime, warnings, fidelityOf, wrapper } = setup([
      {
        tag: "div",
        options: { id: "pick_b", desc: "点第二个", target: "button.b" },
        children: [h("button", { class: "a", onClick: onA }, "A"), h("button", { class: "b", onClick: onB }, "B")],
      },
    ]);

    expect(fidelityOf("pick_b")).toBe("high");
    expect(warnings).toEqual([]);
    await runtime.execute("pick_b", "{}");
    expect(onB).toHaveBeenCalledOnce();
    expect(onA).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("显式 target 查不到 → low + 告警", async () => {
    const { warnings, fidelityOf, wrapper } = setup([
      { tag: "div", options: { id: "bad_target", desc: "选择器写错了", target: "button.nope" } },
    ]);
    expect(fidelityOf("bad_target")).toBe("low");
    expect(warnings.some((w) => w.includes("bad_target") && w.includes("没匹配到"))).toBe(true);
    wrapper.unmount();
  });

  it("autoTarget: false → 关掉自动定位，回到 low + 告警", async () => {
    const onClick = vi.fn();
    const { warnings, fidelityOf, wrapper } = setup([
      {
        tag: "div",
        options: { id: "opt_out", desc: "不要自动找", autoTarget: false },
        children: [h("button", { onClick }, "唯一的按钮")],
      },
    ]);
    expect(fidelityOf("opt_out")).toBe("low");
    expect(warnings.some((w) => w.includes("opt_out"))).toBe(true);
    wrapper.unmount();
  });

  it("显式 fidelity 是开发者的选择，不自动定位也不告警", async () => {
    const { warnings, fidelityOf, wrapper } = setup([
      {
        tag: "div",
        options: { id: "declared", desc: "我自己说了算", fidelity: "low" },
        children: [h("button", {}, "唯一的按钮")],
      },
    ]);
    expect(fidelityOf("declared")).toBe("low");
    expect(warnings).toEqual([]);
    wrapper.unmount();
  });

  it("候选选择器按原语区分：要填输入框，就不会去找按钮", async () => {
    const { runtime, fidelityOf, wrapper } = setup([
      {
        tag: "div",
        options: { id: "wrap_input", action: "fill", desc: "包装 div 里的输入框" },
        children: [
          h("button", { onClick: vi.fn() }, "别点我"),
          h("input", { "data-testid": "inner-input" }),
        ],
      },
    ]);

    // 点按钮的场景会因为「2 个候选」失败；填输入框的场景只看输入框 → 唯一候选 → auto
    expect(fidelityOf("wrap_input")).toBe("auto");
    await runtime.execute("wrap_input", JSON.stringify({ text: "hi" }));
    expect((wrapper.get('[data-testid="inner-input"]').element as HTMLInputElement).value).toBe("hi");
    wrapper.unmount();
  });
});
