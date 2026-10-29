import { mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { describe, expect, it } from "vitest";
import { createPling } from "../src/directive";

/**
 * 「不可用」的两条路：
 *   1 框架看出来的 —— disabled / 不可见 / 已移除；
 *   2 开发者声明的 —— `available: () => "先选中至少一条订单"`（字符串就是原因）。
 *
 * 都要带原因：模型的世界观只有动作清单，只从清单里消失它就会说「页面没有这个功能」。
 */
describe("不可用要带原因", () => {
  it("disabled 的按钮不进动作清单，但快照里留下原因", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Component = defineComponent({
      template: `<button v-tool="{ id: 'submit', desc: '提交表单' }" disabled>提交</button>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    const snapshot = pi.registry.snapshot();
    expect(snapshot.actions).toHaveLength(0);
    expect(snapshot.unavailable).toEqual([
      {
        id: "submit",
        description: "提交表单",
        reason: "Element is disabled (disabled)",
        reasonKey: "availability.disabled",
      },
    ]);

    wrapper.unmount();
  });

  it("开发者声明的前置条件：返回字符串就是原因，满足后立刻回到清单", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const selected = ref(false);
    const Component = defineComponent({
      setup: () => ({ selected }),
      template: `<button
        v-tool="{ id: 'approve', desc: '审批选中的订单', available: () => (selected ? true : '先选中至少一条订单') }"
      >审批</button>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(pi.registry.snapshot().unavailable[0]).toMatchObject({ id: "approve", reason: "先选中至少一条订单" });

    selected.value = true;
    await wrapper.vm.$nextTick();

    expect(pi.registry.snapshot().actions.map((a) => a.id)).toEqual(["approve"]);
    expect(pi.registry.snapshot().unavailable).toHaveLength(0);

    wrapper.unmount();
  });

  it("原生 disabled 与业务前置条件同时存在时，两个原因都要给模型", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Component = defineComponent({
      template: `<button
        disabled
        v-tool="{ id: 'review', desc: '打开审核', available: () => '先上传营业执照和授权书' }"
      >审核</button>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(pi.registry.snapshot().unavailable[0]?.reason).toBe(
      "Element is disabled (disabled)；先上传营业执照和授权书",
    );

    wrapper.unmount();
  });

  it("声明没变就不重注册，但可用性每次都按最新状态算（不缓存）", async () => {
    // 模板里写的 `available: () => count > 0`，闭包在调用时才去读渲染上下文，
    // 所以重渲染之后就是新值 —— 前提是指令**每次都真的调 isAvailable()**，
    // 而不是把注册那一刻的结果缓存起来。这条测的就是后者。
    const pi = createPling(undefined, { onWarn: () => {} });
    const count = ref(0);
    const Component = defineComponent({
      setup: () => ({ count }),
      template: `<button v-tool="{ id: 'claim', desc: '领取', available: () => count > 0 }">领取</button>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    const binding = pi.registry.get("claim")!;
    expect(pi.registry.snapshot().actions).toHaveLength(0);

    count.value = 2;
    await wrapper.vm.$nextTick();

    expect(pi.registry.snapshot().actions.map((a) => a.id)).toEqual(["claim"]);
    // 声明没变 → 不重注册（同一个 binding 实例），可用性却是最新的
    expect(pi.registry.get("claim")).toBe(binding);

    wrapper.unmount();
  });

  it("返回 false（不给原因）时说「前置条件不满足」，仍然不是静默消失", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Component = defineComponent({
      template: `<button v-tool="{ id: 'settle', desc: '结算', available: () => false }">结算</button>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(pi.registry.snapshot().unavailable[0]).toMatchObject({
      id: "settle",
      reason: "This action's preconditions are not met",
    });

    wrapper.unmount();
  });
});
