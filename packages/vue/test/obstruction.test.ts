import { mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createPling } from "../src/directive";
import { createScopeController } from "../src/scope";

/**
 * 层叠（S1②③）：元素在视口里、也 enabled，但**点下去会点到别人**。
 *
 * 两条路：
 *   语义信号（不依赖布局）—— 祖先 `inert` / `aria-hidden` / `hidden`。
 *     真实 UI 库打开模态时正是这么干的（Element Plus / Ant Design 都给背景加 aria-hidden）。
 *   几何信号（要有布局）—— 元素中心点的命中测试：命中的不是自己就是被盖住了。
 *
 * 都**只在能判的时候判**：没有布局能力（jsdom、没有 elementFromPoint）就不臆断，
 * 免得把所有动作都误判成不可用。
 */

const rect = (top: number, left = 0): DOMRect =>
  ({ top, bottom: top + 30, left, right: left + 100, width: 100, height: 30, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("语义信号：inert / aria-hidden / hidden", () => {
  function reasonOf(html: string): string | undefined {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Component = defineComponent({ template: html });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    const snapshot = pi.registry.snapshot();
    expect(snapshot.actions).toHaveLength(0);
    const reason = snapshot.unavailable[0]!.reason;
    wrapper.unmount();
    return reason;
  }

  it("祖先 inert → 不可用，并指认是哪个容器", () => {
    const reason = reasonOf(`<div id="page-root" inert><button v-tool="{ id: 'save', desc: '保存' }">保存</button></div>`);
    expect(reason).toContain("inert");
    expect(reason).toContain("#page-root");
  });

  it("祖先 aria-hidden=true → 不可用（UI 库打开模态时的标准做法）", () => {
    const reason = reasonOf(`<main class="shell" aria-hidden="true"><button v-tool="{ id: 'save', desc: '保存' }">保存</button></main>`);
    expect(reason).toContain("aria-hidden");
    expect(reason).toContain("main.shell");
  });

  it("祖先 hidden → 不可用", () => {
    const reason = reasonOf(`<div hidden><button v-tool="{ id: 'save', desc: '保存' }">保存</button></div>`);
    expect(reason).toContain("hidden");
  });

  it("没有这些标记时不受影响（不能误伤）", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Component = defineComponent({
      template: `<div><button v-tool="{ id: 'save', desc: '保存' }">保存</button></div>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(pi.registry.snapshot().actions.map((a) => a.id)).toEqual(["save"]);
    wrapper.unmount();
  });
});

describe("几何信号：命中测试（coverOf）", () => {
  function setup() {
    const button = document.createElement("button");
    const backdrop = document.createElement("div");
    const child = document.createElement("span");
    button.appendChild(child);
    document.body.append(button, backdrop);
    button.getBoundingClientRect = () => rect(100);

    let hit: Element | null = backdrop;
    // 注入 hitTest 同时表示「这个环境能判几何」
    const controller = createScopeController({ hitTest: () => hit });
    return { controller, button, backdrop, child, setHit: (next: Element | null) => (hit = next) };
  }

  it("命中的是别的元素 → 被盖住，返回它（用来写原因）", () => {
    const { controller, button, backdrop } = setup();
    expect(controller.coverOf(button)).toBe(backdrop);
  });

  it("命中自己 / 自己的后代 / 自己的祖先 → 没被盖住", () => {
    const { controller, button, child, setHit } = setup();

    setHit(button);
    expect(controller.coverOf(button)).toBeNull();

    setHit(child); // 按钮里套着 span，命中它仍然是点在这个按钮上
    expect(controller.coverOf(button)).toBeNull();

    setHit(document.body); // 祖先被命中：说不清，宁可不算
    expect(controller.coverOf(button)).toBeNull();
  });

  it("命中的是框架自己的 UI（data-pling-ui）→ 不算遮挡", () => {
    const { controller, button, backdrop } = setup();
    backdrop.setAttribute("data-pling-ui", "");

    expect(controller.coverOf(button)).toBeNull();
  });

  it("尺寸为 0 / 中心点不在视口内 → 不判（交给可见性裁剪）", () => {
    const { controller, button, setHit } = setup();
    setHit(document.body); // body 是祖先 → null；下面换成真正会被挡住的情形

    button.getBoundingClientRect = () => ({ ...rect(100), width: 0, height: 0, right: 0, bottom: 100 }) as DOMRect;
    expect(controller.coverOf(button)).toBeNull();

    button.getBoundingClientRect = () => rect(5000); // 滚出屏幕
    expect(controller.coverOf(button)).toBeNull();
  });

  it("没注入 hitTest 且环境没有 elementFromPoint（jsdom）→ 一律不判", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.getBoundingClientRect = () => rect(100);

    const controller = createScopeController({ observer: null });
    expect(controller.coverOf(button)).toBeNull();
  });
});

describe("弹窗打开时，底层动作从清单里消失但原因可读", () => {
  it("背景动作被遮罩盖住 → 进 unavailable 并说明被谁盖住；弹窗内的动作照常可用", async () => {
    let cover: Element | null = null;
    const pi = createPling(undefined, { onWarn: () => {}, scopes: { hitTest: () => cover } });

    const Component = defineComponent({
      setup: () => ({ open: ref(false) }),
      template: `
        <div class="shell">
          <button class="row-delete" v-tool="{ id: 'remove@row:t1', desc: '删除第 1 行' }">删除</button>
          <div v-if="open" class="modal">
            <button class="modal-save" v-tool="{ id: 'save_row', desc: '保存这一行' }">保存</button>
          </div>
        </div>`,
    });
    const wrapper = mount(Component, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    const rowDelete = wrapper.find(".row-delete").element;
    rowDelete.getBoundingClientRect = () => rect(100);

    // 弹窗还没开：只有背景那一行
    expect(pi.registry.snapshot().actions.map((a) => a.id)).toEqual(["remove@row:t1"]);

    // 打开弹窗：遮罩盖住了底下那一行
    (wrapper.vm as unknown as { open: boolean }).open = true;
    await wrapper.vm.$nextTick();
    wrapper.find(".modal-save").element.getBoundingClientRect = () => rect(300);
    cover = wrapper.find(".modal").element;

    const snapshot = pi.registry.snapshot();
    expect(snapshot.actions.map((a) => a.id)).toEqual(["save_row"]);
    expect(snapshot.unavailable[0]).toMatchObject({ id: "remove@row:t1" });
    expect(snapshot.unavailable[0]!.reason).toContain("Covered by <div.modal> (保存)");

    // 关掉弹窗：动作回来
    cover = null;
    (wrapper.vm as unknown as { open: boolean }).open = false;
    await wrapper.vm.$nextTick();
    expect(pi.registry.snapshot().actions.map((a) => a.id)).toEqual(["remove@row:t1"]);

    wrapper.unmount();
  });
});
