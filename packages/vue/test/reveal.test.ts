import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { defineComponent } from "vue";
import { createPling } from "../src/directive";

/**
 * Vue 适配器的自动揭示（S12）：`v-tool` 不只提供 isVisible / run，
 * 还提供 reveal —— 执行器在目标滚出视口时先把它带回可见区，再重新判定可用性。
 */

const Page = defineComponent({
  template: `
    <div v-scope="{ id: 'rows', label: '订单列表' }">
      <div v-record="{ id: 'SO-1042', label: '订单 SO-1042' }">
        <button
          type="button"
          v-tool="{ id: 'remove@order:SO-1042', desc: '删除订单 SO-1042' }"
        >删除</button>
      </div>
    </div>
  `,
});

describe("v-tool：目标在视口外时自动滚动", () => {
  it("不可见的行内动作仍可引用；执行器 reveal 后会重新检查并真正点击", async () => {
    const pi = createPling({ onWarn: () => {}, scopes: { observer: null } });
    const wrapper = mount(Page, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const button = wrapper.get("button").element as HTMLButtonElement;
    let clicks = 0;
    button.addEventListener("click", () => {
      clicks += 1;
    });

    pi.scopes.setVisible(button, false);
    expect(pi.registry.get("remove@order:SO-1042")?.isVisible?.()).toBe(false);
    expect(pi.registry.snapshot().actions.map((action) => action.id)).not.toContain("remove@order:SO-1042");
    expect(pi.registry.snapshot().offscreenRecordActions).toMatchObject([
      { id: "remove@order:SO-1042", offscreen: true },
    ]);

    let revealScrolls = 0;
    button.scrollIntoView = () => {
      revealScrolls += 1;
      pi.scopes.setVisible(button, true);
    };
    const executor = createExecutor({ registry: pi.registry, policy: createPolicy(null) });
    const out = await executor.execute("remove@order:SO-1042", "{}");

    expect(out).toMatchObject({ result: { ok: true } });
    expect(revealScrolls).toBe(1);
    expect(clicks).toBe(1);
    expect(pi.registry.snapshot().actions.map((action) => action.id)).toContain("remove@order:SO-1042");
    wrapper.unmount();
    pi.destroy();
  });
});
