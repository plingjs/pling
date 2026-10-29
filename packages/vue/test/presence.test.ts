import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling } from "../src/directive";

/**
 * 存在感（S13）在 Vue 里的表现：**零声明**。
 *
 *   1. 执行 `v-tool` 时自动在目标元素上画光圈，不用开发者写任何东西；
 *   2. 高亮的是 `currentTarget()`（真正被点的那个内层按钮），不是包在外面的壳；
 *   3. handoff 期间是 waiting 形态，一直亮着，直到用户做完；
 *   4. `createPling({ presence: false })` 一个开关就能全关掉。
 */

const allowAll = createPolicy(async () => true);

function overlay(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-pling-presence]");
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("存在感：默认就有", () => {
  it("执行动作 → 目标上出现光圈；最短显示时间后自动消失", async () => {
    vi.useFakeTimers();
    const pi = createPling(undefined, { onWarn: () => {} });
    const run = vi.fn();
    const Host = defineComponent({
      template: `<button v-tool="tool">保存</button>`,
      setup: () => ({ tool: { id: "save", desc: "保存", run } }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await createExecutor({ registry: pi.registry, policy: allowAll }).execute("save", "{}");

    const ring = overlay();
    expect(ring).not.toBeNull();
    expect(ring!.classList.contains("is-waiting")).toBe(false);
    // 框架自己的界面：派生 / 覆盖率 / 遮挡判定都会跳过它
    expect(ring!.hasAttribute("data-pling-ui")).toBe(true);

    // 动作 0ms 就结束了，但人至少要看得到 700ms
    vi.advanceTimersByTime(300);
    expect(overlay()).not.toBeNull();
    vi.advanceTimersByTime(500);
    expect(overlay()).toBeNull();

    wrapper.unmount();
  });

  it("圈住的是真正被操作的内部按钮（和点击目标同一个）", async () => {
    vi.useFakeTimers();
    const pi = createPling(undefined, { onWarn: () => {} });
    const Host = defineComponent({
      template: `
        <div class="shell" v-tool="tool">
          <button class="inner">保存</button>
        </div>`,
      setup: () => ({ tool: { id: "save", desc: "保存" } }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    const inner = wrapper.find("button.inner").element as HTMLElement;
    inner.getBoundingClientRect = () =>
      ({ left: 120, top: 80, width: 100, height: 40, right: 220, bottom: 120, x: 120, y: 80, toJSON: () => ({}) }) as DOMRect;

    await createExecutor({ registry: pi.registry, policy: allowAll }).execute("save", "{}");

    const ring = overlay()!;
    // 光圈留 6px 边距；如果圈的是外壳，left/top 会是 0（jsdom 默认 rect）
    expect(ring.style.left).toBe("114px");
    expect(ring.style.top).toBe("74px");
    expect(ring.style.width).toBe("112px");

    wrapper.unmount();
  });

  it("handoff 期间：waiting 形态，一直亮到用户完成", async () => {
    vi.useFakeTimers();
    const pi = createPling(undefined, { onWarn: () => {} });
    let duringGate: HTMLElement | null = null;
    let lingering: HTMLElement | null = null;
    const Host = defineComponent({
      template: `<button v-tool="tool">上传发票</button>`,
      setup: () => ({
        tool: { id: "upload", desc: "上传发票", handoff: "请选择发票文件" },
      }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const executor = createExecutor({
      registry: pi.registry,
      policy: allowAll,
      handoff: async () => {
        duringGate = overlay();
        // 接力可能要等几分钟：期间不能用「亮一下就灭」的规则
        vi.advanceTimersByTime(10_000);
        lingering = overlay();
        return "done";
      },
    });

    await executor.execute("upload", "{}");

    expect(duringGate).not.toBeNull();
    expect(duringGate!.classList.contains("is-waiting")).toBe(true);
    expect(lingering).toBe(duringGate);

    // 用户点了「我已完成」：再按最短显示时间收尾
    vi.advanceTimersByTime(1_000);
    expect(overlay()).toBeNull();

    wrapper.unmount();
  });

  it("presence: false 一个开关全关掉，动作照常执行", async () => {
    const pi = createPling(undefined, { onWarn: () => {}, presence: false });
    const run = vi.fn();
    const Host = defineComponent({
      template: `<button v-tool="tool">保存</button>`,
      setup: () => ({ tool: { id: "save", desc: "保存", run } }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await createExecutor({ registry: pi.registry, policy: allowAll }).execute("save", "{}");

    expect(run).toHaveBeenCalledOnce();
    expect(overlay()).toBeNull();

    wrapper.unmount();
  });

  it("自定义画法：render 返回自己的节点", async () => {
    vi.useFakeTimers();
    const pi = createPling(undefined, {
      onWarn: () => {},
      presence: {
        render: (el) => {
          const star = document.createElement("span");
          star.className = "my-star";
          star.textContent = el.tagName.toLowerCase();
          return star;
        },
      },
    });
    const Host = defineComponent({
      template: `<button v-tool="tool">保存</button>`,
      setup: () => ({ tool: { id: "save", desc: "保存" } }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await createExecutor({ registry: pi.registry, policy: allowAll }).execute("save", "{}");

    expect(overlay()!.querySelector(".my-star")?.textContent).toBe("button");

    wrapper.unmount();
  });
});
