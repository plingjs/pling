import { mount } from "@vue/test-utils";
import { defineComponent, h, onMounted, ref, type PropType } from "vue";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { createRegistry } from "@plingjs/core";
import { createDeriver, DERIVED_ATTR, DERIVE_SELECTOR, verbOf } from "../src/derive";
import { createPling, usePling } from "../src/directive";
import { createScopeController } from "../src/scope";

/** 手动驱动的派生器：测试不开 MutationObserver，`sync()` 在自己手里才可复现 */
function harness(html: string, options: Parameters<typeof createDeriver>[2] = {}) {
  const registry = createRegistry();
  const scopes = createScopeController({ observer: null });
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  const deriver = createDeriver(registry, scopes, { root: host, observe: false, onWarn: () => {}, ...options });
  return {
    registry,
    scopes,
    host,
    deriver,
    ids: () => registry.snapshot().actions.map((action) => action.id),
    action(id: string) {
      const found = registry.snapshot().actions.find((action) => action.id === id);
      if (!found) throw new Error(`没有派生动作 ${id}（现有：${registry.snapshot().actions.map((a) => a.id).join(", ")}）`);
      return found;
    },
    cleanup() {
      deriver.stop();
      host.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("L1 自动派生 · 认什么", () => {
  it("原生 button：id 取动词、说明带原文案、标记成 derived", () => {
    const h = harness(`<button>删除</button>`);
    expect(h.ids()).toEqual(["remove"]);
    const action = h.action("remove");
    expect(action.description).toBe('Click "删除"');
    expect(action.primitive).toBe("click");
    expect(action.source).toBe("derived");
    // 触发可靠（原生元素 + 直接绑定）≠ 语义可信（没人背书）：前者 fidelity，后者 source
    expect(action.fidelity).toBe("high");
    h.cleanup();
  });

  it("执行派生动作就是点那个按钮", async () => {
    const h = harness(`<button id="save">保存</button>`);
    const clicked = vi.fn();
    h.host.querySelector("#save")!.addEventListener("click", clicked);
    await h.registry.get("save")!.run!({});
    expect(clicked).toHaveBeenCalledOnce();
    h.cleanup();
  });

  it("元素上留 `data-pling-derived` 记号（人看 devtools / 排查用）", () => {
    const h = harness(`<button>提交</button>`);
    expect(h.host.querySelector("button")!.getAttribute(DERIVED_ATTR)).toBe("submit");
    h.cleanup();
  });

  it("`<a href>` 也派生，但说明说清它会跳走", () => {
    const h = harness(`<a href="/docs">文档</a>`);
    expect(h.ids()).toEqual(["link"]);
    expect(h.action("link").description).toBe('Click link "文档" (navigates to the link target)');
    h.cleanup();
  });

  it("`[role=button]` **不**派生：DOM 模拟在它身上是静默失效的（002 的结论）", () => {
    const h = harness(`<div role="button">假的按钮</div>`);
    expect(h.ids()).toEqual([]);
    h.cleanup();
  });

  it("没有可读文案的元素不派生（宁可没有，不能编），并给开发者一行告警", () => {
    const warns: string[] = [];
    const h = harness(`<button></button>`, { onWarn: (m) => warns.push(m) });
    expect(h.ids()).toEqual([]);
    expect(warns.join()).toContain("没有可读文案");
    h.cleanup();
  });

  it("候选选择器只挑原生可靠的那几种", () => {
    expect(DERIVE_SELECTOR).toContain("button");
    expect(DERIVE_SELECTOR).toContain("a[href]");
    expect(DERIVE_SELECTOR).not.toContain("role=");
  });
});

describe("L1 自动派生 · 让路规则", () => {
  it("元素自己写了 v-tool → 不派生（显式永远赢）", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Component = defineComponent({
      template: `<button v-tool="{ id: 'declared', desc: '开发者说的' }">删除</button>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const deriver = createDeriver(pi.registry, pi.scopes, { root: document.body, observe: false, onWarn: () => {} });
    expect(deriver.ids()).toEqual([]);
    expect(pi.registry.snapshot().actions.map((a) => a.id)).toEqual(["declared"]);
    deriver.stop();
    wrapper.unmount();
  });

  it("**祖先**写了 v-tool **不**牵连子树：容器上的动作不代表容器里的东西不是东西", () => {
    // 这条规则是 020 撞出来的：`<ul v-tool="reorder">` 是容器级的语义动作，
    // 但「按文案最钝的做法」曾把整张列表 12 个按钮一起干掉 —— agent 连删除都看不到了。
    // 要「整块别派生」有专门的开关：`data-pling-ignore`。
    const pi = createPling(undefined, { onWarn: () => {} });
    const Component = defineComponent({
      template: `<div v-tool="{ id: 'card', desc: '整块卡片是一个动作' }"><button>删除</button></div>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const deriver = createDeriver(pi.registry, pi.scopes, { root: document.body, observe: false, onWarn: () => {} });
    expect(deriver.ids()).toEqual(["remove"]);
    expect(pi.registry.snapshot().actions.map((a) => a.id).sort()).toEqual(["card", "remove"]);
    deriver.stop();
    wrapper.unmount();
  });

  it("容器上有 v-tool + `data-pling-ignore`：这才是「整块都别碰」", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Component = defineComponent({
      template: `<ul v-tool="{ id: 'reorder', desc: '挪到第几位' }" data-pling-ignore><li><button>删除</button></li></ul>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const deriver = createDeriver(pi.registry, pi.scopes, { root: document.body, observe: false, onWarn: () => {} });
    expect(deriver.ids()).toEqual([]);
    deriver.stop();
    wrapper.unmount();
  });

  it("`data-pling-ignore` 的子树不派生（开发者的排除开关）", () => {
    const h = harness(`<div data-pling-ignore><button>删除</button></div><button>保存</button>`);
    expect(h.ids()).toEqual(["save"]);
    h.cleanup();
  });

  it("框架自己的界面（`data-pling-ui`）不派生：浮窗的按钮是给人的", () => {
    const h = harness(`<div data-pling-ui><button>收起</button></div><button>保存</button>`);
    expect(h.ids()).toEqual(["save"]);
    h.cleanup();
  });

  it("skip 回调可以再排除（在框架规则之后追加判断）", () => {
    const h = harness(`<button class="danger">删除</button><button>保存</button>`, {
      skip: (el) => el.classList.contains("danger"),
    });
    expect(h.ids()).toEqual(["save"]);
    h.cleanup();
  });
});

describe("L1 自动派生 · 行与危险动作", () => {
  it("v-record 的行内按钮带上行身份（`remove@t4`）——42 行里同文案的按钮才分得清", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const rows = [{ id: "t1" }, { id: "t2" }];
    const Component = defineComponent({
      props: { rows: { type: Array as PropType<Array<{ id: string }>>, default: () => rows } },
      template: `<li v-for="row in rows" :key="row.id" v-record="row"><button>删除</button></li>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const deriver = createDeriver(pi.registry, pi.scopes, { root: document.body, observe: false, onWarn: () => {} });
    expect(deriver.ids()).toEqual(["remove@t1", "remove@t2"]);
    deriver.stop();
    wrapper.unmount();
  });

  it("没有行上下文时用 `_2` / `_3` 兜底（那种 id 不稳，是无奈之举）", () => {
    const h = harness(`<button>保存</button><button>保存</button>`);
    expect(h.ids()).toEqual(["save", "save_2"]);
    h.cleanup();
  });

  it("危险文案标 danger：派生不该让「删除」绕过确认闸门", () => {
    const h = harness(`<button>删除</button><button>清空搜索</button><button>重命名</button>`);
    expect(h.action("remove").kind).toBe("danger");
    expect(h.action("remove").approval).toBe("ask-always");
    expect(h.action("clear").kind).toBe("danger");
    expect(h.action("click").kind).toBe("write");
    h.cleanup();
  });

  it("词表可以关掉（danger: false）", () => {
    const h = harness(`<button>删除</button>`, { danger: false });
    expect(h.action("remove").kind).toBe("write");
    h.cleanup();
  });

  it("禁用的按钮仍然登记，但**不可用 + 带原因**（模型要知道它在那儿）", () => {
    const h = harness(`<button disabled>提交</button>`);
    expect(h.ids()).toEqual([]);
    expect(h.registry.snapshot().unavailable[0]?.reason).toContain("disabled");
    h.cleanup();
  });

  it("动词表：命中的第一个规则生效（「清空搜索」要得到 clear 而不是 search）", () => {
    const el = document.createElement("button");
    expect(verbOf("清空搜索", el)).toBe("clear");
    expect(verbOf("保存", el)).toBe("save");
    expect(verbOf("随便写点什么", el)).toBe("click");
    expect(verbOf("随便写点什么", document.createElement("a"))).toBe("link");
  });
});

describe("L1 自动派生 · 增量与生命周期", () => {
  it("文案变了：**id 不变**，只刷新说明（换了 id 模型手上的 id 就失效了）", () => {
    const h = harness(`<button id="b">全部完成</button>`);
    expect(h.ids()).toEqual(["complete"]);
    h.host.querySelector("#b")!.textContent = "全部取消";
    h.deriver.sync();
    expect(h.ids()).toEqual(["complete"]);
    expect(h.action("complete").description).toBe('Click "全部取消"');
    h.cleanup();
  });

  it("元素没了：派生动作跟着消失", () => {
    const h = harness(`<button id="b">删除</button>`);
    expect(h.ids()).toEqual(["remove"]);
    h.host.querySelector("#b")!.remove();
    h.deriver.sync();
    expect(h.ids()).toEqual([]);
    h.cleanup();
  });

  it("停止之后清空，并且不再登记", () => {
    const h = harness(`<button>删除</button>`);
    expect(h.ids()).toEqual(["remove"]);
    h.deriver.stop();
    expect(h.registry.snapshot().actions).toEqual([]);
    h.deriver.sync();
    expect(h.registry.snapshot().actions).toEqual([]);
    h.cleanup();
  });
});

describe("L1 自动派生 · 接线", () => {
  it("默认**关**：不写 derive 时一个派生动作都没有", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Component = defineComponent({ template: `<button>删除</button>` });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    expect(pi.registry.snapshot().actions).toEqual([]);
    expect(pi.derived()).toBeNull();
    wrapper.unmount();
  });

  it("createPling({ derive: true })：挂载后派生器就位，页面里的原生按钮进了清单", () => {
    const pi = createPling(undefined, { derive: true, onWarn: () => {} });
    const Component = defineComponent({ template: `<button>删除</button><a href="/x">文档</a>` });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    expect(pi.derived()?.ids()).toEqual(["remove", "link"]);
    expect(pi.registry.snapshot().actions.map((a) => a.source)).toEqual(["derived", "derived"]);
    pi.destroy();
    wrapper.unmount();
  });

  it("组件里能拿到同一个派生器（usePling().derived()）：setup / onMounted 都是它", () => {
    const pi = createPling(undefined, { derive: true, onWarn: () => {} });
    const seen: Array<unknown> = [];
    const Probe = defineComponent({
      setup() {
        // setup 阶段还没有 DOM，派生器当然还没建（这是刻意的：先有页面才有东西可扫）
        seen.push(usePling().derived());
        onMounted(() => seen.push(usePling().derived()));
        return () => h("button", "删除");
      },
    });
    const wrapper = mount(Probe, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    // 派生器**一直**在（配了就存在），只是在挂载前扫不到东西
    expect(seen[0]).toBe(pi.derived());
    expect(seen[1]).toBe(pi.derived());
    expect(pi.derived()?.ids()).toEqual(["remove"]);
    pi.destroy();
    wrapper.unmount();
  });

  it("DOM 变了会自动跟上（观察器这条路）", async () => {
    const pi = createPling(undefined, { derive: true, onWarn: () => {} });
    const extra = ref(false);
    const Component = defineComponent({
      setup: () => () => h("div", [h("button", "删除"), extra.value ? h("button", "保存") : null]),
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    expect(pi.derived()?.ids()).toEqual(["remove"]);
    extra.value = true;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(pi.derived()?.ids()).toEqual(["remove", "save"]);
    pi.destroy();
    wrapper.unmount();
  });
});

describe("类型契约", () => {
  it("snapshot 的 action 带 source 字段", () => {
    const registry = createRegistry();
    expectTypeOf(registry.snapshot().actions[0]?.source).toEqualTypeOf<"declared" | "derived" | undefined>();
  });
});
