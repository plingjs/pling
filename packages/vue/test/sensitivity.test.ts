import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";
import { createPling, sensitive, useAgentState } from "../src";

/**
 * 敏感值（S14）在 Vue 侧的用法：**还是同一个标记**，不用记新 API。
 *
 *   v-record 的 fields / useAgentState 的返回值里直接包一层 `sensitive(...)`，
 *   进快照前就被换掉；业务组件其余部分一个字不用改。
 */

describe("v-record：字段脱敏", () => {
  it("hidden / masked / token 三种模式在快照里各就各位", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Host = defineComponent({
      template: `<ul><li v-for="row in rows" :key="row.id" v-record="row">x</li></ul>`,
      setup: () => ({
        rows: [
          {
            id: "SO-1",
            customer: "张三",
            phone: sensitive("13812341234"),
            idCard: sensitive("110101199001011234", "masked"),
            vip: sensitive("C-9001", "token"),
          },
        ],
      }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    const fields = pi.registry.snapshot().records[0]!.fields as Record<string, string>;
    expect(fields.customer).toBe("张三");
    expect(fields.phone).toBe("[hidden]");
    expect(fields.idCard).toBe("110***********1234");
    expect(fields.vip).toMatch(/^\{\{p:[0-9a-z]{7}\}\}$/);

    wrapper.unmount();
  });
});

describe("useAgentState：视图里也能标敏感", () => {
  it("只读视图里的手机号不会进上下文", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const app = defineComponent({ render: () => h("div") });
    const wrapper = mount(app, { global: { plugins: [pi.plugin] } });

    // 模拟业务在组件里暴露「当前用户」的一小块视图
    const Inner = defineComponent({
      setup() {
        useAgentState("me", () => ({
          name: "李四",
          phone: sensitive("13700000000"),
          level: "gold",
        }));
        return () => h("div");
      },
    });
    mount(Inner, { global: { plugins: [pi.plugin] } });

    expect(pi.registry.snapshot().state.me).toEqual({ name: "李四", phone: "[hidden]", level: "gold" });
    expect(JSON.stringify(pi.registry.snapshot())).not.toContain("13700000000");

    wrapper.unmount();
  });
});

describe("从 @plingjs/vue 直接拿得到", () => {
  it("sensitive 是 @plingjs/vue 的公开导出（不需要再装 @plingjs/core）", () => {
    const marked = sensitive("x", "hidden");
    expect(marked.mode).toBe("hidden");
  });
});
