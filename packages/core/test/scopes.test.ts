import { describe, expect, it, vi } from "vitest";
import { createRegistry } from "../src/registry";

function bindScope(registry: ReturnType<typeof createRegistry>, id: string, scope: string): void {
  registry.bind({
    descriptor: { id, primitive: "click", description: id, kind: "write", scope },
    isAvailable: () => true,
    run: vi.fn(async () => {}),
  });
}

describe("区域（页面结构）", () => {
  it("父链 / 层级 / 角色 / 说明 / 阅读顺序都进快照，动作带从外到内的区域路径", () => {
    const registry = createRegistry();
    registry.declareScope({
      id: "orders_page",
      label: "订单后台",
      role: "page",
      description: "管理订单的主页面",
      order: () => 0,
    });
    registry.declareScope({
      id: "filters",
      label: "筛选与工具栏",
      role: "toolbar",
      description: "搜索、筛选、排序与导出",
      parent: "orders_page",
      order: () => 1,
    });
    registry.declareScope({
      id: "orders",
      label: "订单列表",
      role: "list",
      description: "每行一张订单",
      parent: "orders_page",
      order: () => 2,
    });
    registry.declareScope({
      id: "edit_dialog",
      label: "编辑订单弹窗",
      role: "dialog",
      description: "修改当前订单的备注",
      parent: "orders_page",
      order: () => 3,
    });

    bindScope(registry, "search_submit", "filters");
    bindScope(registry, "dialog_save", "edit_dialog");
    registry.setAutoScopes(["orders_page", "filters", "orders", "edit_dialog"]);

    const snapshot = registry.snapshot();
    expect(snapshot.scopes.map((scope) => scope.id)).toEqual(["orders_page", "filters", "orders", "edit_dialog"]);
    expect(snapshot.scopes.find((scope) => scope.id === "edit_dialog")).toMatchObject({
      label: "编辑订单弹窗",
      description: "修改当前订单的备注",
      role: "dialog",
      parent: "orders_page",
      depth: 2,
      active: true,
      order: 3,
    });

    expect(snapshot.actions.find((action) => action.id === "search_submit")?.scopePath).toEqual([
      "订单后台",
      "筛选与工具栏",
    ]);
    expect(snapshot.actions.find((action) => action.id === "dialog_save")?.scopePath).toEqual([
      "订单后台",
      "编辑订单弹窗",
    ]);
  });

  it("父区域可以延迟解析（Vue 子作用域先挂载）", () => {
    const registry = createRegistry();
    registry.declareScope({ id: "page", label: "页面", role: "page" });
    registry.declareScope({ id: "child", label: "子区域", parent: () => "page" });

    expect(registry.snapshot().scopes.find((scope) => scope.id === "child")).toMatchObject({
      parent: "page",
      depth: 2,
    });
  });
});
