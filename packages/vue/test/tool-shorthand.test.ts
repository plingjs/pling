import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it, vi } from "vitest";
import { createPling } from "../src/directive";

/**
 * `v-tool` 的两种写法：
 *   - 简写 `v-tool="'说明'"` —— 最常见的场景（元素本身已经干了活），一个字都不用多写
 *   - 对象 / 数组 —— 需要稳定 id、风险等级、作用域、注入行为时才用
 */
describe("v-tool 字符串简写", () => {
  it("只给一句说明也能注册成动作，并且执行的就是元素原本的行为", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const onClick = vi.fn();

    const Component = defineComponent({
      template: `<button v-tool="'删除这条待办（不可逆）'" @click="onClick">删除</button>`,
      setup: () => ({ onClick }),
    });

    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const actions = pi.registry.snapshot().actions;
    expect(actions).toHaveLength(1);
    expect(actions[0]!.description).toBe("删除这条待办（不可逆）");
    expect(actions[0]!.id).toMatch(/^tool_\d+$/);
    expect(actions[0]!.primitive).toBe("click");

    await pi.registry.get(actions[0]!.id)!.run!({});
    expect(onClick).toHaveBeenCalledOnce();

    wrapper.unmount();
    expect(pi.registry.snapshot().actions).toHaveLength(0);
  });

  it("对象写法照旧：显式 id 优先于自动生成", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Component = defineComponent({
      template: `<button v-tool="{ id: 'save', desc: '保存' }">保存</button>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(pi.registry.snapshot().actions.map((a) => a.id)).toEqual(["save"]);
    wrapper.unmount();
  });

  it("漏写说明时给开发者一行告警（模型唯一能看懂的东西）", () => {
    const warns: string[] = [];
    const pi = createPling(undefined, { onWarn: (message) => warns.push(message) });
    const Component = defineComponent({
      template: `<button v-tool="{ id: 'mystery' }">点我</button>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(warns.some((message) => message.includes("mystery") && message.includes("desc"))).toBe(true);
    wrapper.unmount();
  });

  it("值变化时重注册：说明改了，模型看到的就是新的", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Component = defineComponent({
      props: { label: { type: String, required: true } },
      template: `<button v-tool="{ id: 'act', desc: label }">点我</button>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, props: { label: "第一版" }, global: { plugins: [pi.plugin] } });
    expect(pi.registry.snapshot().actions[0]!.description).toBe("第一版");

    await wrapper.setProps({ label: "第二版" });
    expect(pi.registry.snapshot().actions[0]!.description).toBe("第二版");
    wrapper.unmount();
  });
});

/**
 * 确认策略：**声明期的事**，不在面板上给用户一个开关。
 *
 * 三档由 `kind`（兜底）+ `confirm`（覆盖）解析成 `approval`，policy 只认它。
 */
describe("v-tool 里的确认声明", () => {
  function approvalOf(template: string, onWarn: (message: string) => void = () => {}): string {
    const pi = createPling(undefined, { onWarn });
    const wrapper = mount(defineComponent({ template }), {
      attachTo: document.body,
      global: { plugins: [pi.plugin] },
    });
    const action = pi.registry.snapshot().actions[0]!;
    wrapper.unmount();
    return action.approval;
  }

  it("不写 = 按默认策略（danger）：click 是 write → 不打断", () => {
    expect(approvalOf(`<button v-tool="{ id: 'save', desc: '保存' }">保存</button>`)).toBe("none");
  });

  it("confirm: false → 担保不问；confirm: true → 读操作也要问", () => {
    expect(approvalOf(`<button v-tool="{ id: 'toggle', desc: '勾选', confirm: false }">勾</button>`)).toBe("none");
    expect(approvalOf(`<button v-tool="{ id: 'export', desc: '导出', kind: 'read', confirm: true }">导出</button>`)).toBe(
      "ask",
    );
  });

  it("danger → 每次都问；confirm: 'always' 也能把 write 提到同一档", () => {
    expect(approvalOf(`<button v-tool="{ id: 'wipe', desc: '清空', kind: 'danger' }">清空</button>`)).toBe("ask-always");
    expect(approvalOf(`<button v-tool="{ id: 'pay', desc: '付款', confirm: 'always' }">付款</button>`)).toBe(
      "ask-always",
    );
  });

  it("默认策略可配：createPling 的 config 会落到注册表（想保守就选 kind）", async () => {
    const pi = createPling(undefined, {
      onWarn: () => {},
      agent: { config: { defaultApproval: "kind" } },
    });
    const wrapper = mount(defineComponent({ template: `<button v-tool="{ id: 'save', desc: '保存' }">保存</button>` }), {
      attachTo: document.body,
      global: { plugins: [pi.plugin] },
    });

    expect(pi.registry.defaultApproval).toBe("kind");
    // kind 模式：write 要问；默认模式（danger）下它是 none
    expect(pi.registry.snapshot().actions[0]!.approval).toBe("ask");
    wrapper.unmount();
  });

  it("danger 被标成 confirm: false 也放行，但开发期要告警（很容易是复制粘贴留下的）", () => {
    const warned: string[] = [];
    const approval = approvalOf(
      `<button v-tool="{ id: 'wipe', desc: '清空', kind: 'danger', confirm: false }">清空</button>`,
      (message: string) => void warned.push(message),
    );
    expect(approval).toBe("none");
    expect(warned.some((message) => message.includes("danger"))).toBe(true);
  });
});
