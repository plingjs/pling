import { describe, expect, it, vi } from "vitest";
import { RESUME_FLOW_ACTION_ID, createRegistry, type Binding } from "@plingjs/core";
import { createActionNamespace, getRegistryNamespace } from "../src/namespace";
import { createDeriver, markRecordElement, unmarkRecordElement } from "../src/derive";
import { createScopeController } from "../src/scope";

function action(id: string): Binding {
  return {
    descriptor: { id, primitive: "click", description: id },
    isAvailable: () => true,
    run: async () => {},
  };
}

describe("动作 id 命名空间", () => {
  it("两个岛可以复用同一个局部 id，底层注册表看到完整 id", () => {
    const base = createRegistry();
    const left = createActionNamespace(base, "left");
    const right = createActionNamespace(base, "right");

    const offLeft = left.bind(action("save"));
    const offRight = right.bind(action("save"));

    expect(base.snapshot().actions.map((item) => item.id)).toEqual(["left/save", "right/save"]);
    expect(left.get("save")?.descriptor.id).toBe("left/save");
    expect(right.get("save")?.descriptor.id).toBe("right/save");
    expect(left.get("right/save")?.descriptor.id).toBe("right/save");

    offLeft();
    expect(base.snapshot().actions.map((item) => item.id)).toEqual(["right/save"]);
    offRight();
    expect(base.snapshot().actions).toEqual([]);
  });

  it("复合步骤的局部 id 在绑定时固化成完整 id，跨岛引用保持原样", () => {
    const base = createRegistry();
    const todo = createActionNamespace(base, "todo");

    todo.bind(action("submit"));
    expect(todo.get("submit")?.descriptor.id).toBe("todo/submit");
    expect(todo.get("todo/submit")?.descriptor.id).toBe("todo/submit");

    const off = todo.bind(action("todo/already-qualified"));
    expect(base.get("todo/already-qualified")).toBeDefined();
    const offFlow = todo.bind({
      ...action("save"),
      steps: [
        { action: "submit", desc: "本地步骤" },
        { action: "other/submit", desc: "跨岛步骤" },
      ],
    });
    expect(base.get("todo/save")?.steps?.map((step) => step.action)).toEqual([
      "todo/submit",
      "other/submit",
    ]);
    offFlow();
    off();
  });

  it("执行器专用的续跑动作保留固定 id", () => {
    const base = createRegistry();
    const todo = createActionNamespace(base, "todo");

    todo.bind(action(RESUME_FLOW_ACTION_ID));
    expect(base.get(RESUME_FLOW_ACTION_ID)).toBeDefined();
    expect(base.get(`todo/${RESUME_FLOW_ACTION_ID}`)).toBeUndefined();
  });

  it("非法 namespace 当场报错", () => {
    const base = createRegistry();
    expect(() => createActionNamespace(base, "has space")).toThrow(/namespace/);
    expect(() => createActionNamespace(base, "todo/child")).toThrow(/namespace/);
  });

  it("记录、区域与状态 key 也落在同一个命名空间，行内动作引用本岛记录", () => {
    const base = createRegistry();
    const left = createActionNamespace(base, "left");
    const right = createActionNamespace(base, "right");

    left.declareScope({ id: "list", label: "左列表" });
    right.declareScope({ id: "list", label: "右列表" });
    left.declareRecord({ id: "t1", label: "左行", fields: { text: "左" }, scope: "list" });
    right.declareRecord({ id: "t1", label: "右行", fields: { text: "右" }, scope: "list" });
    left.expose({ key: "counts", read: () => ({ total: 1 }) });
    right.expose({ key: "counts", read: () => ({ total: 2 }) });

    left.bind(action("remove@t1"));
    right.bind(action("remove@t1"));
    left.bind(action("remove@foreign/t9"));
    base.setActiveScopes(["left/list", "right/list"]);

    const snapshot = base.snapshot();
    expect(snapshot.scopes.map((scope) => scope.id)).toEqual(["left/list", "right/list"]);
    expect(snapshot.records.map((record) => record.id)).toEqual(["left/t1", "right/t1"]);
    expect(snapshot.recordIds).toEqual(["left/t1", "right/t1"]);
    expect(Object.keys(snapshot.state)).toEqual(["left/counts", "right/counts"]);
    expect(snapshot.actions.map((item) => item.id)).toEqual([
      "left/remove@left/t1",
      "right/remove@right/t1",
      "left/remove@foreign/t9",
    ]);

    expect(left.get("remove@t1")?.descriptor.id).toBe("left/remove@left/t1");
    expect(right.get("remove@t1")?.descriptor.id).toBe("right/remove@right/t1");
    expect(left.get("right/remove@right/t1")?.descriptor.id).toBe("right/remove@right/t1");
    expect(getRegistryNamespace(left).record("t1")).toBe("left/t1");
    expect(getRegistryNamespace(base).record("t1")).toBe("t1");
  });

  it("L1 派生动作与记录身份共享同一个命名空间", () => {
    const base = createRegistry();
    const registry = createActionNamespace(base, "vue");
    const scopes = createScopeController({ observer: null });
    const deriver = createDeriver(registry, scopes, { observe: false });
    document.body.innerHTML = '<ul><li data-row><button>删除</button></li></ul>';
    const row = document.querySelector("li")!;
    markRecordElement(row, "vue/item-1");

    try {
      deriver.sync();
      expect(deriver.ids()).toEqual(["vue/remove@vue/item-1"]);
      expect(row.querySelector("button")?.getAttribute("data-pling-derived")).toBe("vue/remove@vue/item-1");
      expect(base.get("vue/remove@vue/item-1")?.descriptor.id).toBe("vue/remove@vue/item-1");
    } finally {
      deriver.stop();
      unmarkRecordElement(row);
      scopes.destroy();
      document.body.innerHTML = "";
    }
  });

  it("反馈 id 与指引目标也落在同一个命名空间，跨岛完整 id 保持原样", () => {
    const base = createRegistry();
    const left = createActionNamespace(base, "left");
    const right = createActionNamespace(base, "right");
    const leftPresence = vi.fn();
    const rightPresence = vi.fn();

    left.declareScope({ id: "form", label: "左表单" });
    right.declareScope({ id: "form", label: "右表单" });
    left.declareFeedback({
      id: "required",
      message: "左表单必填",
      field: "name",
      scope: "form",
    });
    right.declareFeedback({
      id: "required",
      message: "右表单必填",
      field: "name",
      resolveScope: () => "form",
    });
    left.declareGuideTarget("focus", { presence: leftPresence });
    right.declareGuideTarget("focus", { presence: rightPresence });
    base.setActiveScopes(["left/form", "right/form"]);

    const snapshot = base.snapshot();
    expect(snapshot.feedback.map((item) => [item.id, item.scope])).toEqual([
      ["left/required", "left/form"],
      ["right/required", "right/form"],
    ]);

    expect(left.markGuideTarget("focus", "waiting")).toBe(true);
    expect(right.markGuideTarget("right/focus", "idle")).toBe(true);
    expect(leftPresence).toHaveBeenCalledWith("waiting");
    expect(rightPresence).toHaveBeenCalledWith("idle");
    left.bind({
      ...action("submit"),
      handoff: {
        reason: "请本人复核",
        steps: [
          { text: "看左岛", highlight: "focus" },
          { text: "看右岛", highlight: "right/focus" },
        ],
      },
    });
    expect(base.get("left/submit")?.handoff?.steps).toEqual([
      { text: "看左岛", highlight: "left/focus" },
      { text: "看右岛", highlight: "right/focus" },
    ]);
    expect(getRegistryNamespace(left).feedback("required")).toBe("left/required");
    expect(getRegistryNamespace(base).feedback("required")).toBe("required");
  });
});
