import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it } from "vitest";
import { createPling } from "../src/directive";

describe("开发期交互覆盖率扫描", () => {
  it("统计直接声明、容器级声明、未声明项，并排除禁用项和 Pling 自身界面", () => {
    const pi = createPling({ onWarn: () => {} });
    const host = document.createElement("div");
    host.setAttribute("data-pling-ui", "");
    document.body.append(host);
    const wrapper = mount(
      defineComponent({
        template: `<main>
          <button id="declared" v-tool="{ id: 'save', desc: '保存' }">保存</button>
          <input id="search" aria-label="搜索订单" />
          <button id="disabled" disabled>禁用</button>
          <div role="button" id="aria-disabled" aria-disabled="true">ARIA 禁用</div>
          <section v-tool="{ id: 'toolbar_action', desc: '工具栏操作' }">
            <button id="grouped">容器声明下的操作</button>
          </section>
          <div role="button" id="custom">自定义按钮</div>
          <div data-pling-ignore><button id="ignored">业务明确忽略</button></div>
          <div data-pling-ui><button id="internal">pling 界面</button></div>
        </main>`,
      }),
      { attachTo: host, global: { plugins: [pi.plugin] } },
    );

    try {
      const before = pi.registry.snapshot().actions.map((action) => action.id);
      const report = pi.inspectCoverage();

      expect(report).toMatchObject({
        total: 4,
        declared: 1,
        derived: 0,
        grouped: 1,
        missing: 2,
        coveragePercent: 50,
      });
      expect(report.targets).toEqual(
        expect.arrayContaining([
          { element: "input#search", label: "搜索订单", status: "missing" },
          { element: "button#grouped", label: "容器声明下的操作", status: "grouped", actions: ["toolbar_action"] },
          { element: "div#custom", label: "自定义按钮", status: "missing" },
        ]),
      );
      expect(pi.registry.snapshot().actions.map((action) => action.id)).toEqual(before);
    } finally {
      wrapper.unmount();
      pi.destroy();
      host.remove();
    }
  });

  it("把 L1 派生动作计为已覆盖，扫描前后动作清单不变", async () => {
    const pi = createPling({ derive: true, onWarn: () => {} });
    const wrapper = mount(
      defineComponent({ template: `<main><button id="derived">刷新列表</button></main>` }),
      { attachTo: document.body, global: { plugins: [pi.plugin] } },
    );

    try {
      const before = pi.registry.snapshot().actions.map((action) => action.id);
      const report = pi.inspectCoverage();
      expect(report).toMatchObject({ total: 1, declared: 0, derived: 1, grouped: 0, missing: 0, coveragePercent: 100 });
      expect(pi.registry.snapshot().actions.map((action) => action.id)).toEqual(before);
    } finally {
      wrapper.unmount();
      pi.destroy();
    }
  });

  it("未挂载或没有交互控件时不虚报百分比", () => {
    const pi = createPling({ onWarn: () => {} });
    expect(pi.inspectCoverage()).toMatchObject({ total: 0, coveragePercent: null, targets: [] });

    const wrapper = mount(defineComponent({ template: `<main><p>静态内容</p></main>` }), {
      attachTo: document.body,
      global: { plugins: [pi.plugin] },
    });
    try {
      expect(pi.inspectCoverage()).toMatchObject({ total: 0, coveragePercent: null, targets: [] });
    } finally {
      wrapper.unmount();
      pi.destroy();
    }
  });

  it("开发期自检：挂载后提示未声明控件，但不改变 Agent 能力", async () => {
    const warnings: string[] = [];
    const pi = createPling({ diagnostics: true, onWarn: (message) => warnings.push(message) });
    const wrapper = mount(
      defineComponent({
        template: `<main>
          <button v-tool="{ id: 'save', desc: '保存' }">保存</button>
          <input aria-label="搜索订单" />
        </main>`,
      }),
      { attachTo: document.body, global: { plugins: [pi.plugin] } },
    );

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(warnings.some((message) => message.includes("1/2") && message.includes("v-tool"))).toBe(true);
      expect(pi.registry.snapshot().actions.map((action) => action.id)).toEqual(["save"]);
    } finally {
      wrapper.unmount();
      pi.destroy();
    }
  });

  it("开发期自检可以关闭；全部声明时不产生噪音", async () => {
    const warnings: string[] = [];
    const disabled = createPling({ diagnostics: false, onWarn: (message) => warnings.push(message) });
    const first = mount(
      defineComponent({ template: `<main><button>未声明</button></main>` }),
      { attachTo: document.body, global: { plugins: [disabled.plugin] } },
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(warnings).toEqual([]);
    } finally {
      first.unmount();
      disabled.destroy();
    }

    const covered = createPling({ diagnostics: true, onWarn: (message) => warnings.push(message) });
    const second = mount(
      defineComponent({ template: `<main><button v-tool="{ id: 'save', desc: '保存' }">保存</button></main>` }),
      { attachTo: document.body, global: { plugins: [covered.plugin] } },
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(warnings).toEqual([]);
    } finally {
      second.unmount();
      covered.destroy();
    }
  });
});
