import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { createPlingVue } from "../src/adapter";

describe("Vue 适配器", () => {
  it("挂载后动作进入快照并可被执行；卸载后消失", async () => {
    const pi = createPlingVue();
    const onClick = vi.fn();

    const Component = defineComponent({
      setup() {
        const button = ref<HTMLButtonElement | null>(null);
        pi.useAgentAction(button, {
          id: "open_settings",
          primitive: "click",
          description: "打开设置面板",
          kind: "read",
        });
        return () => h("button", { ref: button, onClick }, "设置");
      },
    });

    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    expect(pi.registry.snapshot().actions.map((a) => a.id)).toContain("open_settings");

    const binding = pi.registry.get("open_settings");
    await binding?.run?.({});
    expect(onClick).toHaveBeenCalledOnce();

    wrapper.unmount();
    expect(pi.registry.snapshot().actions.map((a) => a.id)).not.toContain("open_settings");
  });

  it("disabled 的元素不可用，不进快照（不兜底）", () => {
    const pi = createPlingVue();
    const Component = defineComponent({
      setup() {
        const button = ref<HTMLButtonElement | null>(null);
        pi.useAgentAction(button, { id: "danger", primitive: "click", description: "删除", kind: "danger" });
        return () => h("button", { ref: button, disabled: true }, "删除");
      },
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    expect(pi.registry.snapshot().actions.map((a) => a.id)).not.toContain("danger");
    wrapper.unmount();
  });

  it("状态暴露进入快照", () => {
    const pi = createPlingVue();
    const count = ref(3);
    const Component = defineComponent({
      setup() {
        pi.useAgentState("cart", () => ({ count: count.value }), "购物车");
        return () => h("div", "cart");
      },
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    expect(pi.registry.snapshot().state).toEqual({ cart: { count: 3 } });
    count.value = 5;
    expect(pi.registry.snapshot().state).toEqual({ cart: { count: 5 } });
    wrapper.unmount();
  });
});
