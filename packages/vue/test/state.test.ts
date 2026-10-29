import { mount } from "@vue/test-utils";
import { defineComponent, h, reactive, ref } from "vue";
import { describe, expect, it } from "vitest";
import { createPling } from "../src/directive";
import { useAgentState, useAgentStoreState } from "../src/state";

function mountWith(setup: () => unknown) {
  const pi = createPling(undefined, { onWarn: () => {} });
  const Component = defineComponent({ setup: () => setup() as never, render: () => h("div") });
  const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  return { pi, wrapper };
}

describe("状态暴露（useAgentState）", () => {
  it("注册即可读，且是「活的」——每次快照都重新取值", () => {
    const query = ref("foo");
    const { pi } = mountWith(() => {
      useAgentState("filters", () => ({ query: query.value }), { description: "当前的搜索词" });
      return {};
    });

    expect(pi.registry.snapshot().state).toEqual({ filters: { query: "foo" } });
    query.value = "bar";
    expect(pi.registry.snapshot().state).toEqual({ filters: { query: "bar" } });
  });

  it("可以直接给 ref / reactive 对象，不必包一层函数", () => {
    const count = ref(3);
    const cart = reactive({ items: 2, total: 99 });
    const { pi } = mountWith(() => {
      useAgentState("count", count);
      useAgentState("cart", cart);
      return {};
    });

    expect(pi.registry.snapshot().state).toEqual({ count: 3, cart: { items: 2, total: 99 } });
    count.value = 4;
    cart.items = 5;
    expect(pi.registry.snapshot().state).toEqual({ count: 4, cart: { items: 5, total: 99 } });
  });

  it("多组状态按 key 并列，说明书（description）也登记进去", () => {
    const { pi } = mountWith(() => {
      useAgentState("a", () => 1, "第一组");
      useAgentState("b", () => 2, { description: "第二组" });
      return {};
    });

    expect(Object.keys(pi.registry.snapshot().state)).toEqual(["a", "b"]);
  });

  it("组件卸载时自动注销（不会留下幽灵状态）", () => {
    const { pi, wrapper } = mountWith(() => {
      useAgentState("temp", () => "x");
      return {};
    });

    expect(pi.registry.snapshot().state).toEqual({ temp: "x" });
    wrapper.unmount();
    expect(pi.registry.snapshot().state).toEqual({});
  });

  it("超出上限的数组会被裁剪，并留下「还有多少」的说明", () => {
    const rows = Array.from({ length: 42 }, (_, i) => `SO-${i + 1}`);
    const { pi } = mountWith(() => {
      useAgentState("list", () => ({ rows }));
      return {};
    });

    const state = pi.registry.snapshot().state as { list: { rows: unknown[] } };
    expect(state.list.rows).toHaveLength(6);
    expect(state.list.rows[5]).toBe("… (42 items total; showing 5)");
  });

  it("没有 app.use(pling.plugin) 时给出明确报错", () => {
    const Component = defineComponent({
      setup() {
        useAgentState("x", () => 1);
        return {};
      },
      render: () => h("div"),
    });
    expect(() => mount(Component)).toThrow(/app\.use\(pling\.plugin\)/);
  });
});

describe("store 状态（useAgentStoreState）", () => {
  it("Pinia 结构：字段数组直接读 store，并保持响应式", () => {
    const store = reactive({ filter: "all", query: "", counts: { total: 2, active: 1 } });
    const { pi } = mountWith(() => {
      useAgentStoreState("todo", store, ["filter", "query", "counts"], "Todo 当前的筛选与计数");
      return {};
    });

    expect(pi.registry.snapshot().state).toEqual({
      todo: { filter: "all", query: "", counts: { total: 2, active: 1 } },
    });

    store.filter = "active";
    store.query = "猫";
    store.counts = { total: 1, active: 1 };
    expect(pi.registry.snapshot().state).toEqual({
      todo: { filter: "active", query: "猫", counts: { total: 1, active: 1 } },
    });
  });

  it("Vuex 结构：state 与 getters 都能挑，同名时 state 优先", () => {
    const store = reactive({
      state: { filter: "all", query: "", same: "state" },
      getters: { counts: { total: 2, active: 1 }, same: "getter" },
    });
    const { pi } = mountWith(() => {
      useAgentStoreState("todo", store, ["filter", "query", "counts", "same"]);
      return {};
    });

    expect(pi.registry.snapshot().state).toEqual({
      todo: { filter: "all", query: "", counts: { total: 2, active: 1 }, same: "state" },
    });
    store.state.filter = "active";
    expect((pi.registry.snapshot().state as { todo: { filter: string } }).todo.filter).toBe("active");
  });

  it("selector：可以改名、换算与嵌套取值", () => {
    const store = reactive({ filter: "all", visible: ["a", "b"], total: 3 });
    const { pi } = mountWith(() => {
      useAgentStoreState("todo", store, (s) => ({
        filter: s.filter,
        shown: s.visible.length,
        total: s.total,
      }));
      return {};
    });

    expect(pi.registry.snapshot().state).toEqual({ todo: { filter: "all", shown: 2, total: 3 } });
  });

  it("字段写错时在接入期直接报错，并说清 Pinia / Vuex 该去哪找", () => {
    expect(() =>
      mountWith(() => {
        useAgentStoreState("todo", reactive({ filter: "all" }), ["filter", "filtter"]);
        return {};
      }),
    ).toThrow(/useAgentStoreState\("todo"\) 找不到字段 "filtter"/);
  });

  it("组件卸载后整组状态一起注销", () => {
    const { pi, wrapper } = mountWith(() => {
      useAgentStoreState("todo", reactive({ filter: "all" }), ["filter"]);
      return {};
    });

    expect(pi.registry.snapshot().state).toEqual({ todo: { filter: "all" } });
    wrapper.unmount();
    expect(pi.registry.snapshot().state).toEqual({});
  });

  it("返回注销函数：应用级按路由 / 后端切换时不必靠换 key", () => {
    let off: (() => void) | undefined;
    const { pi } = mountWith(() => {
      off = useAgentStoreState("todo", reactive({ filter: "all" }), ["filter"]);
      return {};
    });

    expect(pi.registry.snapshot().state).toHaveProperty("todo");
    off!();
    expect(pi.registry.snapshot().state).toEqual({});
  });
});
