import { describe, expect, it } from "vitest";
import { toActivityRows } from "../src/activity";
import type { SessionEvent } from "../src/types";

/**
 * 「运行」的账本：`tool_call` 落一行（执行中），对应的 `tool_result` **回填**到那一行上。
 *
 * 为什么这一页必须有：对话里不刷 `composer_text{"text":…}` 这种流水了，
 * 但「它到底点了什么、参数是什么、结果如何」得有个地方能查 —— 尤其是出事的时候。
 */

const call = (id: string, args: Record<string, unknown> = {}): SessionEvent => ({
  type: "tool_call",
  id,
  tool: id,
  args,
});

const ok = (id: string, action?: { description?: string }, rest: Record<string, unknown> = {}): SessionEvent => ({
  type: "tool_result",
  id,
  tool: id,
  result: { result: { ok: true, ...(action ? { action: { id, ...action } } : {}), ...rest } },
});

const failed = (id: string, code: string, message = ""): SessionEvent => ({
  type: "tool_result",
  id,
  tool: id,
  result: { error: { code: code as never, message } },
});

describe("事件流 → 「运行」账本", () => {
  it("一次动作一条：调用先落「执行中」，结果回来回填到同一行（不是又加一条）", () => {
    const running = toActivityRows([call("save", { note: "x" })]);
    expect(running).toEqual([{ seq: 1, id: "save", args: { note: "x" }, status: "running" }]);

    const done = toActivityRows([call("save", { note: "x" }), ok("save")]);
    expect(done).toEqual([{ seq: 1, id: "save", args: { note: "x" }, status: "ok" }]);
  });

  it("模型填的参数原样留着（这一行是调查「它到底填了什么」的唯一可信来源）", () => {
    const rows = toActivityRows([call("note", { text: "客户 A 要续约", priority: "high" })]);
    expect(rows[0]!.args).toEqual({ text: "客户 A 要续约", priority: "high" });
  });

  it("成功回执里的动作说明（开发者写的 desc）变成这一行的人话", () => {
    const rows = toActivityRows([call("remove@t2"), ok("remove@t2", { description: "删除待办「发周报」（不可逆）" })]);
    expect(rows[0]).toMatchObject({ status: "ok", description: "删除待办「发周报」（不可逆）" });
  });

  it("复合动作（S6a）：一行一次业务操作，但明细摊开「它替我走了哪几步」", () => {
    const rows = toActivityRows([
      call("fill_note", { orderId: "SO-1002", note: "约吃饭" }),
      ok("fill_note", { description: "把订单备注改成指定内容" }, {
        flow: {
          steps: [
            { index: 1, id: "search_query", ok: true, desc: "搜索这个订单" },
            { index: 2, id: "edit@order:SO-1002", ok: true, desc: "打开编辑弹窗" },
            { index: 3, id: "tip_banner", ok: false, skipped: true, desc: "顺手关掉提示条" },
            { index: 4, id: "dialog_save", ok: true, desc: "保存并关闭弹窗" },
          ],
          completed: 3,
          total: 4,
        },
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.detail).toContain("流程 3/4 步");
    // 给人看的那一份优先用开发者写的 desc（id 是模型的坐标系，不是人的）
    expect(rows[0]!.detail).toContain("搜索这个订单✓");
    expect(rows[0]!.detail).toContain("打开编辑弹窗✓ → 顺手关掉提示条（跳过） → 保存并关闭弹窗✓");
  });

  it("一步一行的顺序 = 发生顺序，seq 从 1 连续", () => {
    const rows = toActivityRows([
      call("a"),
      call("b"),
      ok("a"),
      call("c"),
      ok("b"),
      ok("c"),
    ]);
    expect(rows.map((row) => [row.seq, row.id, row.status])).toEqual([
      [1, "a", "ok"],
      [2, "b", "ok"],
      [3, "c", "ok"],
    ]);
  });

  it("结果按 id 认领自己那一行（两条交织的动作不会串）", () => {
    const rows = toActivityRows([
      call("first", { text: "1" }),
      call("second", { text: "2" }),
      ok("second", { description: "第二条" }),
      ok("first", { description: "第一条" }),
    ]);
    expect(rows.map((row) => [row.id, row.description])).toEqual([
      ["first", "第一条"],
      ["second", "第二条"],
    ]);
  });

  it("失败：错误码和原因都摆出来（不能只给一句「失败」）", () => {
    const rows = toActivityRows([call("approve@order:SO-1003"), failed("approve@order:SO-1003", "ACTION_NOT_FOUND", "未知动作")]);
    expect(rows[0]).toMatchObject({ status: "failed", detail: "ACTION_NOT_FOUND：找不到动作 — 未知动作" });
  });

  it("没有 message 的错误也保留错误码，并给出本地化摘要", () => {
    expect(toActivityRows([failed("x", "PERMISSION_DENIED")])[0]).toMatchObject({
      detail: "PERMISSION_DENIED：没有权限",
    });
    expect(toActivityRows([failed("x", "PERMISSION_DENIED")], { locale: "en-US" })[0]).toMatchObject({
      detail: "PERMISSION_DENIED: Permission denied",
    });
  });

  it("低保真 / 告警也要露出来（「执行了」不等于「真的生效了」）", () => {
    const low = toActivityRows([call("save"), ok("save", undefined, { fidelity: "low", warning: "仅 DOM 模拟，效果未验证" })]);
    expect(low[0]!.detail).toBe("仅 DOM 模拟，效果未验证");

    const auto = toActivityRows([call("save"), ok("save", undefined, { fidelity: "auto" })]);
    expect(auto[0]!.detail).toBe("保真度 auto");

    // 高保真 + 没有别的话说：不刷一行没信息量的「成功」
    expect(toActivityRows([call("save"), ok("save")])[0]!.detail).toBeUndefined();
  });

  it("框架生成的英文告警在中文界面里翻译，开发者自己的告警原文保留", () => {
    expect(
      toActivityRows([
        call("save"),
        ok("save", undefined, { fidelity: "low", warning: "DOM simulation only; the effect was not verified" }),
      ])[0]!.detail,
    ).toBe("仅 DOM 模拟，效果未验证");

    expect(
      toActivityRows([
        call("save"),
        ok("save", undefined, {
          changed: { observed: false },
          warning:
            "No change was observed between snapshots (this page exposes 2 records / 3 actions; if the action changed data that is not exposed, the change cannot be seen here)",
        }),
      ])[0]!.detail,
    ).toBe(
      "变更：无变化；执行前后快照没有观察到变化（页面暴露了 2 条记录 / 3 个动作；若改动的是未暴露的数据，这里看不到）",
    );

    expect(
      toActivityRows([
        call("save"),
        ok("save", undefined, { warning: "1 optional step(s) were skipped after failing; the rest of the flow continued" }),
      ])[0]!.detail,
    ).toBe("1 个可选步骤失败后被跳过；流程其余步骤继续执行");

    expect(
      toActivityRows([call("save"), ok("save", undefined, { warning: "业务自己的告警" })])[0]!.detail,
    ).toBe("业务自己的告警");
  });

  it("变更证据（S3）摆在最前面：这一步**改了什么**比「调用了什么」更像用户想知道的事", () => {
    const changed = {
      observed: true,
      records: {
        updated: [{ id: "t2", fields: ["已完成"] }],
        added: [],
        removed: [],
        reordered: false,
        omitted: { added: 0, removed: 0, updated: 0 },
      },
    };
    const rows = toActivityRows([call("toggle@t2"), ok("toggle@t2", { description: "标记完成" }, { changed })]);
    expect(rows[0]!.detail).toBe("变更：改了 1 条（t2 的 已完成）");

    // 证据 + 告警一起出现时的顺序：先说改了什么，再说「没观察到变化」这类提醒
    const nothing = { observed: false };
    const warned = toActivityRows([
      call("toggle@t2"),
      ok("toggle@t2", undefined, { changed: nothing, warning: "执行前后快照没有观察到变化（…）" }),
    ]);
    expect(warned[0]!.detail).toBe("变更：无变化；执行前后快照没有观察到变化（…）");
  });

  it("被拦截的动作回填到那一行：状态是「已拦截」，不留在「执行中」（它压根没执行）", () => {
    const rows = toActivityRows([call("wipe"), { type: "blocked", id: "wipe", tool: "wipe", reason: "风控" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ seq: 1, id: "wipe", args: {}, status: "blocked", detail: "被拦截：风控" });
  });

  it("被拦截且配不上（事件流从中间开始）时也留一行", () => {
    const rows = toActivityRows([{ type: "blocked", id: "wipe", tool: "wipe", reason: "风控" }]);
    expect(rows[0]).toMatchObject({ seq: 1, id: "wipe", status: "blocked" });
  });

  it("没配对上的结果也要落一行（事件流被截断 / 从服务端推来一半时不丢信息）", () => {
    expect(toActivityRows([ok("save", { description: "保存" })])[0]).toMatchObject({
      seq: 1,
      id: "save",
      status: "ok",
      description: "保存",
    });
    expect(toActivityRows([failed("save", "EXECUTION_FAILED", "炸了")])[0]).toMatchObject({ status: "failed" });
  });

  it("非动作事件不算一步（用户说话、模型回话、通知都不进账本）", () => {
    const rows = toActivityRows([
      { type: "user", text: "删掉它" },
      { type: "assistant", text: "好" },
      { type: "notice", text: "重试" },
      { type: "final", text: "删了" },
    ]);
    expect(rows).toEqual([]);
  });

  it("English Activity copy has no framework-generated Chinese", () => {
    const changed = {
      observed: true,
      records: {
        updated: [{ id: "SO-2041", fields: ["fields"] }],
        added: [],
        removed: [],
        reordered: false,
        omitted: { added: 0, removed: 0, updated: 0 },
      },
      actions: {
        added: [],
        removed: ["approve@SO-2041"],
        omitted: { added: 0, removed: 0 },
      },
    };
    const rows = toActivityRows(
      [
        call("approve@SO-2041"),
        ok("approve@SO-2041", { description: "Approve order SO-2041" }, { changed }),
        call("upload"),
        ok("upload", { description: "Upload the receipt" }, {
          flow: {
            steps: [
              { index: 1, id: "choose_file", ok: true, desc: "Choose a file", handoff: "Pick a PDF" },
              { index: 2, id: "close_tip", ok: false, skipped: true, desc: "Close the tip" },
            ],
            completed: 1,
            total: 2,
          },
        }),
        call("remove"),
        { type: "blocked", id: "remove", tool: "remove", reason: "Policy" },
      ],
      { locale: "en-US" },
    );

    expect(rows[0]!.detail).toBe(
      "Changed: updated 1 record (SO-2041: fields); 1 action unavailable / removed (approve@SO-2041)",
    );
    expect(rows[1]!.detail).toBe(
      "Flow 1/2 steps: Choose a file(manual)✓ → Close the tip(skipped)",
    );
    expect(rows[2]).toMatchObject({ status: "blocked", detail: "Blocked: Policy" });
    expect(rows.map((row) => row.detail ?? "").join(" ")).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("English fidelity and missing-result fallbacks are localized", () => {
    expect(
      toActivityRows(
        [call("save"), ok("save", undefined, { fidelity: "auto" })],
        { locale: "en-US" },
      )[0]!.detail,
    ).toBe("Fidelity auto");

    expect(
      toActivityRows(
        [{ type: "tool_result", id: "save", tool: "save", result: { result: undefined } }],
        { locale: "en-US" },
      )[0]!.detail,
    ).toBe("No result returned");
  });
});
