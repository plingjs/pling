import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderPageContext } from "@plingjs/agent";
import { createPling } from "../src/directive";
import RegionTree from "./fixtures/RegionTree.vue";

function setup(): { pi: ReturnType<typeof createPling>; wrapper: ReturnType<typeof mount> } {
  const pi = createPling(undefined, { onWarn: () => {} });
  const wrapper = mount(RegionTree, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  return { pi, wrapper };
}

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("v-scope：区域语义与页面结构", () => {
  it("role / description / 父区域 / 层级 / 页面顺序进快照（父区域由 DOM 自动解析）", () => {
    const { pi, wrapper } = setup();
    const snapshot = pi.registry.snapshot();

    expect(snapshot.scopes.map((scope) => scope.id)).toEqual(["page", "toolbar", "list", "dialog"]);
    expect(snapshot.scopes.find((scope) => scope.id === "toolbar")).toMatchObject({
      label: "筛选与工具栏",
      description: "搜索与导出",
      role: "toolbar",
      parent: "page",
      depth: 2,
      active: true,
    });
    // 弹窗在 DOM 里不是 page 的后代（真实项目常挂在 body / 传送门里），显式 parent 把它接回页面树
    expect(snapshot.scopes.find((scope) => scope.id === "dialog")).toMatchObject({ parent: "page", depth: 2 });

    expect(snapshot.actions.find((action) => action.id === "confirm_filter")?.scopePath).toEqual([
      "订单后台",
      "筛选与工具栏",
    ]);
    expect(snapshot.actions.find((action) => action.id === "confirm_save")?.scopePath).toEqual([
      "订单后台",
      "编辑订单弹窗",
    ]);

    wrapper.unmount();
  });

  it("提示词自动带上页面结构；两个「确认」靠区域路径区分", () => {
    const { pi, wrapper } = setup();
    const context = renderPageContext(pi.registry.snapshot());

    expect(context).toContain("## Page structure (regions)");
    expect(context).toContain('page "订单后台" (page): 订单管理主页面');
    expect(context).toContain('  - toolbar "筛选与工具栏" (toolbar): 搜索与导出');
    expect(context).toContain('  - dialog "编辑订单弹窗" (dialog): 修改备注');
    expect(context).toContain("region:订单后台 / 筛选与工具栏");
    expect(context).toContain("region:订单后台 / 编辑订单弹窗");

    wrapper.unmount();
  });
});
