import { afterEach, describe, expect, it, vi } from "vitest";
import Vue from "vue";
import type { CreateElement, VNode } from "vue";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling, useAgentState } from "../src";

afterEach(() => {
  document.body.innerHTML = "";
});

const allowAll = () => createPolicy(vi.fn(async () => true));

function mount(render: (h: CreateElement) => VNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const pling = createPling({ presence: false, onWarn: () => {} });
  Vue.use(pling.plugin);
  const vm = new Vue({ render });
  vm.$mount(host);
  return { host, pling, vm };
}

describe("@plingjs/vue2", () => {
  it("v-tool / v-scope / v-record 接入同一份注册表", async () => {
    const clicked = vi.fn();
    const { pling, vm } = mount((h) => h("section", {
      directives: [{ name: "scope", value: { id: "todos", label: "待办列表", role: "list" } }],
    }, [
      h("ul", [
        h("li", {
          directives: [
            { name: "record", value: { data: { id: "t1", title: "买牛奶" }, label: "待办：买牛奶" } },
          ],
        }, [
          h("button", {
            directives: [{ name: "tool", value: { id: "toggle@t1", desc: "切换第一条待办", action: "click" } }],
            on: { click: clicked },
          }, "完成"),
        ]),
      ]),
    ]));

    pling.setActiveScopes(["todos"]);
    const snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map(({ id, description }) => ({ id, description }))).toContainEqual({
      id: "toggle@t1",
      description: "切换第一条待办",
    });
    expect(snapshot.records).toMatchObject([{ id: "t1", label: "待办：买牛奶" }]);
    expect(snapshot.scopes.map(({ id, label, role, active }) => ({ id, label, role, active }))).toContainEqual({
      id: "todos",
      label: "待办列表",
      role: "list",
      active: true,
    });

    await expect(createExecutor({ registry: pling.registry, policy: allowAll() }).execute("toggle@t1", "{}"))
      .resolves.toMatchObject({ result: { ok: true } });
    expect(clicked).toHaveBeenCalledOnce();

    vm.$destroy();
    pling.destroy();
  });

  it("useAgentState 每份快照重读，组件销毁后注销", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pling = createPling({ presence: false, onWarn: () => {} });
    Vue.use(pling.plugin);
    const vm = new Vue({
      setup() {
        useAgentState("todo", () => ({ total: 2, open: 1 }), { description: "待办计数" });
        return { total: 2 };
      },
      render(h) { return h("div", String(this.total)); },
    }).$mount(host);

    expect(pling.registry.snapshot().state).toEqual({ todo: { total: 2, open: 1 } });
    vm.$destroy();
    expect(pling.registry.snapshot().state).toEqual({});
    pling.destroy();
  });

  it("Vue 2.7 插件可以做普通 Vue.use() 安装", () => {
    const pling = createPling({ presence: false, onWarn: () => {} });
    expect(() => Vue.use(pling.plugin)).not.toThrow();
    pling.destroy();
  });
});
