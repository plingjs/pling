import { mount } from "@vue/test-utils";
import { createExecutor, createPolicy } from "@plingjs/core";
import { describe, expect, it } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { createPling } from "../src/directive";

/**
 * S6b-2：`hover` 是唯一新加的浏览器原语。
 *
 * 复杂控件（日期选择器 / 拖拽 / 上传 / 图表）都不该各造一个原语：
 * 它们要么是动作序列（`steps`），要么必须由业务注入（上传）。
 * 但「把指针移进来」是浏览器真实存在的交互，菜单 / 提示框靠它展开，所以补这一档。
 */
describe("hover 原语（S6b-2）", () => {
  it("注册成 primitive=hover；只送鼠标进入，菜单因此打开，下一步的动作才出现", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const opened = ref(false);

    const Host = defineComponent({
      template: `
        <div>
          <button
            id="more"
            v-tool="{ id: 'open_menu', desc: '把指针移到「更多」上，展开菜单', action: 'hover', kind: 'read' }"
            @mouseenter="opened = true"
          >更多</button>
          <button v-if="opened" id="archive" v-tool="{ id: 'archive', desc: '归档这一条', kind: 'write' }">归档</button>
        </div>
      `,
      setup: () => ({ opened }),
    });

    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    const hover = pi.registry.snapshot().actions.find((action) => action.id === "open_menu")!;
    expect(hover).toMatchObject({ primitive: "hover", kind: "read", approval: "none" });
    // 逐步解析的另一面：菜单没打开时，菜单项根本不在清单里
    expect(pi.registry.snapshot().actions.map((action) => action.id)).not.toContain("archive");

    const executor = createExecutor({ registry: pi.registry, policy: createPolicy(async () => true) });
    const out = await executor.execute("open_menu", "{}");
    await nextTick();

    expect(out).toMatchObject({ result: { ok: true } });
    expect(opened.value).toBe(true);
    expect(pi.registry.snapshot().actions.map((action) => action.id)).toContain("archive");

    wrapper.unmount();
  });

  it("hover 也支持 @mouseover（有些组件监听的是冒泡版本）", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const seen: string[] = [];

    const Host = defineComponent({
      template: `<div id="hot" v-tool="{ id: 'hot', desc: '移入热区', action: 'hover', kind: 'read' }" @mouseover="seen.push('over')" @mouseenter="seen.push('enter')">热区</div>`,
      setup: () => ({ seen }),
    });

    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    await pi.registry.get("hot")!.run!({});

    // 真实浏览器的顺序：over 先、enter 后；不要求实现方依赖顺序，但两个都要到
    expect(seen).toContain("over");
    expect(seen).toContain("enter");
    wrapper.unmount();
  });

  it("省略 kind 时仍按 fail-closed 视为 write（hover 的下限只是 read，不是默认值）", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Host = defineComponent({
      template: `<button v-tool="{ id: 'h', desc: '移入', action: 'hover' }">x</button>`,
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    expect(pi.registry.snapshot().actions[0]!.kind).toBe("write");
    wrapper.unmount();
  });
});
