import { describe, expect, it } from "vitest";
import type { ActionView, JsonSchema } from "@plingjs/core";
import { buildProtocol, toolNameOf } from "../src/protocol";
import { snapshotOf, type FakeAction } from "./helpers";

const action = (id: string, extra: Partial<ActionView> = {}): ActionView => ({
  id,
  primitive: "click",
  description: `${id} 的说明`,
  kind: "write",
  approval: "ask",
  params: { type: "object", properties: {}, required: [] },
  fidelity: "high",
  ...extra,
});

const hiddenAction = (id: string, extra: Partial<FakeAction> = {}): FakeAction => ({
  id,
  visible: false,
  ...extra,
});

describe("模型协议层：id ↔ function name", () => {
  it("框架生成的工具描述与参数脚手架固定为英文", () => {
    const protocol = buildProtocol(
      snapshotOf(
        [
          action("remove@t1", { description: "Remove this row", kind: "danger" }),
          action("remove@t2", { description: "Remove this row", kind: "danger" }),
        ],
        [{ id: "t1" }, { id: "t2" }],
      ),
    );
    expect(JSON.stringify(protocol.tools)).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it("把非法字符换成下划线，并保证首字符是字母", () => {
    expect(toolNameOf("approve@order:SO-1001")).toBe("approve_order_SO-1001");
    expect(toolNameOf("1st_action")).toBe("t_1st_action");
  });

  it("超长 id 截断到 64 字符以内", () => {
    expect(toolNameOf("a".repeat(200)).length).toBe(64);
  });

  it("派生名唯一：不同 id 撞名时加后缀，且能双向查回", () => {
    const protocol = buildProtocol(snapshotOf([action("approve@order:1"), action("approve_order_1")]));
    const names = [...protocol.idToName.values()];
    expect(new Set(names).size).toBe(2);

    for (const [name, id] of protocol.nameToId) {
      expect(protocol.idToName.get(id)).toBe(name);
    }
  });

  it("复合动作的工具描述说「flow: N steps」（工具列表里没有表头，标签位只有一格）", () => {
    const protocol = buildProtocol(
      snapshotOf([
        {
          id: "fill_note",
          description: "把订单备注改成指定内容",
          steps: [
            { action: "search_query" },
            { action: "dialog_save" },
          ],
        },
      ]),
    );
    const description = protocol.tools[0]!.function.description;
    expect(description).toContain("flow: 2 steps");
    expect(description).not.toContain("primitive: flow");
  });

  it("人工接力的工具描述带「requires human」", () => {
    const snapshot = snapshotOf([
      {
        id: "submit_export",
        kind: "danger",
        description: "提交导出（需要输入图形验证码）",
        handoff: { reason: "请填写图形验证码后提交" },
      },
    ]);
    const tool = buildProtocol(snapshot).tools.find((item) => item.function.name === "submit_export");
    expect(tool?.function.description).toContain("requires human");
  });

  it("工具描述带上原语 / 风险，非 high 时还带保真度与区域", () => {
    const protocol = buildProtocol(
      snapshotOf([action("remove@row:t3", { kind: "danger", fidelity: "low", scope: "rows" })], [], ["rows"]),
    );
    const description = protocol.tools[0]!.function.description;
    expect(description).toContain("primitive: click");
    expect(description).toContain("kind: danger");
    expect(description).toContain("fidelity: low");
    expect(description).toContain("region: rows");
  });

  it("区域路径也进工具描述：两个同名「确认」靠它区分", () => {
    const base = snapshotOf([]);
    const protocol = buildProtocol({
      ...base,
      actions: [
        action("confirm_filter", {
          description: "确认当前筛选条件",
          scope: "filters",
          scopePath: ["订单后台", "筛选与工具栏"],
        }),
        action("confirm_save", {
          description: "确认并保存备注",
          scope: "edit_dialog",
          scopePath: ["订单后台", "编辑订单弹窗"],
        }),
      ],
      total: 2,
    });
    const descriptions = protocol.tools.map((tool) => tool.function.description);
    expect(descriptions[0]).toContain("region: 订单后台 / 筛选与工具栏");
    expect(descriptions[1]).toContain("region: 订单后台 / 编辑订单弹窗");
  });

  it("重复 id 只出一个工具", () => {
    // 注册表不允许重复 id，这里直接造快照：测的是协议层对重复项的去重
    const snapshot = snapshotOf([]);
    const protocol = buildProtocol({ ...snapshot, actions: [action("dup"), action("dup")] });
    expect(protocol.tools).toHaveLength(1);
  });

  it("同类行内动作折叠成一个带 record 参数的工具（S2b）", () => {
    const protocol = buildProtocol(
      snapshotOf(
        [
          action("remove@t1", { description: "删除待办「第一条」（不可逆）", kind: "danger" }),
          action("remove@t2", { description: "删除待办「第二条」（不可逆）", kind: "danger" }),
          action("reorder"),
        ],
        [{ id: "t1" }, { id: "t2" }],
      ),
    );

    const remove = protocol.tools.find((tool) => tool.function.name === "remove")!;
    expect(remove).toBeDefined();
    // 参数：record 必填，例子就是这一轮的记录 id
    const params = remove.function.parameters as JsonSchema;
    expect(params.required).toEqual(["record"]);
    expect((params.properties!.record as { description?: string }).description).toContain("for example, t1");
    // 说明里的逐行小名换成了 {record} 占位符：折叠后的动作对所有行都适用，句子也不破
    expect(remove.function.description).toContain("删除待办「{record}」（不可逆）");
    expect(remove.function.description).not.toContain("第一条");
    expect(remove.function.description).toContain("Row actions of the same type are folded into one");

    // 每行一个 id 的旧清单没有了；但成员的原名仍然可解析（同一个动作，不是一个新动作）
    expect(protocol.tools.map((tool) => tool.function.name).sort()).toEqual(["remove", "reorder"]);
    expect(protocol.nameToId.get("remove_t1")).toBe("remove@t1");
    expect(protocol.idToName.get("remove@t1")).toBe("remove");
    expect(protocol.templates.get("remove")!.template).toBe("remove@");
  });

  it("只有一条的行内动作不折叠：`remove@t1` 比 `remove { record }` 更短", () => {
    const protocol = buildProtocol(snapshotOf([action("remove@t1")], [{ id: "t1" }]));
    expect(protocol.tools.map((tool) => tool.function.name)).toEqual(["remove_t1"]);
    expect(protocol.templates.size).toBe(0);
  });

  it("折叠模板覆盖视口外的行：工具说明与 record 参数都说明会自动滚动", () => {
    const protocol = buildProtocol(
      snapshotOf(
        [
          action("remove@t1", { description: "删除待办「甲」", kind: "danger" }),
          hiddenAction("remove@t2", { description: "删除待办「乙」", kind: "danger" }),
        ],
        [{ id: "t1" }, { id: "t2" }],
      ),
    );
    const remove = protocol.tools.find((tool) => tool.function.name === "remove")!;
    expect(remove.function.description).toContain("1 row outside the viewport (auto-scroll before execution)");
    expect((remove.function.parameters as JsonSchema).properties!.record).toMatchObject({
      description: expect.stringContaining("Offscreen targets are scrolled into view before execution"),
    });
    expect(protocol.nameToId.get("remove_t2")).toBe("remove@t2");
  });

  it("整类动作都在视口外时也能产出模板与成员映射", () => {
    const protocol = buildProtocol(
      snapshotOf(
        [
          hiddenAction("remove@t1"),
          hiddenAction("remove@t2"),
        ],
        [{ id: "t1" }, { id: "t2" }],
      ),
    );
    expect(protocol.tools.map((tool) => tool.function.name)).toEqual(["remove"]);
    expect(protocol.nameToId.get("remove_t1")).toBe("remove@t1");
    expect(protocol.nameToId.get("remove_t2")).toBe("remove@t2");
  });

  it("没有记录的行内动作不折叠：id 里的 `@` 不代表它就是一行", () => {
    const protocol = buildProtocol(
      snapshotOf([action("send@email"), action("send@wechat")], [{ id: "t1" }]),
    );
    expect(protocol.tools.map((tool) => tool.function.name).sort()).toEqual(["send_email", "send_wechat"]);
  });
});
