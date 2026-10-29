import { describe, expect, it } from "vitest";
import type { SessionEvent } from "../src/types";
import { toTranscriptLine, toTranscriptLines, type TranscriptLine } from "../src/transcript";

/** 断言辅助：确认拿到的是「结果行」并取出 detail */
const detailOf = (event: Parameters<typeof toTranscriptLine>[0]): string => {
  const line = toTranscriptLine(event) as Extract<TranscriptLine, { kind: "result" }>;
  expect(line.kind).toBe("result");
  return line.detail;
};

describe("事件流 → 展示行", () => {
  it("工具调用显示原始 id 与参数", () => {
    expect(
      toTranscriptLine({ type: "tool_call", id: "remove@order:SO-1001", tool: "remove_order_SO-1001", args: { a: 1 } }),
    ).toEqual({ kind: "call", id: "remove@order:SO-1001", tool: "remove_order_SO-1001", args: '{"a":1}' });
  });

  it("成功的动作带上保真度；low 保真度的告警要露出来", () => {
    expect(detailOf({ type: "tool_result", id: "a", tool: "a", result: { result: { ok: true } } })).toBe("ok");
    expect(
      detailOf({ type: "tool_result", id: "a", tool: "a", result: { result: { ok: true, fidelity: "auto" } } }),
    ).toBe("ok（保真度 auto）");
    expect(
      detailOf({
        type: "tool_result",
        id: "a",
        tool: "a",
        result: { result: { ok: true, fidelity: "low", warning: "仅 DOM 模拟，效果未验证" } },
      }),
    ).toBe("仅 DOM 模拟，效果未验证");
  });

  it("失败的动作只显示错误码，不刷屏", () => {
    expect(
      toTranscriptLine({
        type: "tool_result",
        id: "a",
        tool: "a",
        result: { error: { code: "PERMISSION_DENIED", message: "用户拒绝" } },
      }),
    ).toMatchObject({ ok: false, detail: "PERMISSION_DENIED" });
  });

  it("被钩子拦截的动作单独一类：它压根没执行，跟「执行失败」不是一回事", () => {
    expect(toTranscriptLine({ type: "blocked", id: "a", tool: "a", reason: "风控" })).toEqual({
      kind: "blocked",
      id: "a",
      text: "被拦截：风控",
    });
  });

  it("English locale localizes every framework-generated transcript line", () => {
    const options = { locale: "en-US" };
    expect(toTranscriptLine({ type: "cancelled" }, options)).toEqual({
      kind: "cancelled",
      text: "Cancelled",
    });
    expect(
      toTranscriptLine({ type: "blocked", id: "a", tool: "a", reason: "risk" }, options),
    ).toEqual({ kind: "blocked", id: "a", text: "Blocked: risk" });
    expect(
      toTranscriptLine(
        {
          type: "tool_result",
          id: "a",
          tool: "a",
          result: { result: { ok: true, fidelity: "low" } },
        },
        options,
      ),
    ).toMatchObject({ detail: "ok (fidelity low)" });

    const handoff = (status: "requested" | "completed" | "cancelled" | "timeout") =>
      toTranscriptLine(
        { type: "handoff", id: "upload", tool: "upload", status, reason: "choose a file" },
        options,
      );
    expect(handoff("requested")).toMatchObject({ text: "Take over (upload): choose a file" });
    expect(handoff("completed")).toMatchObject({ text: "Manual step completed: upload" });
    expect(handoff("cancelled")).toMatchObject({ text: "Manual step cancelled: upload" });
    expect(handoff("timeout")).toMatchObject({ text: "Manual step timed out: upload" });
    expect(
      toTranscriptLine({ type: "error", code: "LLM_FAILED", message: "Failed to fetch" }, options),
    ).toEqual({ kind: "error", text: "LLM_FAILED: Model request failed — Failed to fetch" });
    expect(
      toTranscriptLine({ type: "error", code: "NEW_SAFE_ERROR", message: "try later" }, options),
    ).toEqual({ kind: "error", text: "NEW_SAFE_ERROR: Unknown error — try later" });
  });
});

/**
 * 对话里**不刷动作流水**。
 *
 * 用户看到的应该是「它在动」（面板另画一个正在执行的指示），而不是
 * `composer_text{"text":"…"}` / `composer_textok` 这种一步步的原文 ——
 * 那串东西该进「运行」（`toActivityRows`），出事时好查。
 */
describe("动作流水默认不进对话", () => {
  const events: SessionEvent[] = [
    { type: "user", text: "保存" },
    { type: "tool_call", id: "save", tool: "save", args: { note: "x" } },
    { type: "tool_result", id: "save", tool: "save", result: { result: { ok: true } } },
    { type: "blocked", id: "wipe", tool: "wipe", reason: "风控" },
    { type: "final", text: "好了" },
  ];

  it("tools: false：只剩人话 —— 被拦截的说明留着（那是「没做」的解释）", () => {
    expect(toTranscriptLines(events, { tools: false }).map((line) => line.kind)).toEqual(["user", "blocked", "final"]);
  });

  it("tools: true：全画出来（终端 / 调试器 / 想全看的自定义面板）", () => {
    expect(toTranscriptLines(events, { tools: true }).map((line) => line.kind)).toEqual([
      "user",
      "call",
      "result",
      "blocked",
      "final",
    ]);
  });

  it("不给 options 时保持原样（老调用方不会被悄悄改掉行为）", () => {
    expect(toTranscriptLines(events).map((line) => line.kind)).toEqual([
      "user",
      "call",
      "result",
      "blocked",
      "final",
    ]);
  });
});

describe("流式增量怎么并进展示行", () => {
  const delta = (text: string) => ({ type: "assistant_delta", text }) as const;

  it("多个增量并成一个气泡，最后一个 final 用权威文本收口（不是再来一行）", () => {
    const lines = toTranscriptLines([
      { type: "user", text: "你好" },
      delta("我"),
      delta("很好"),
      { type: "final", text: "我很好" },
    ]);

    expect(lines).toEqual([
      { kind: "user", text: "你好" },
      { kind: "final", text: "我很好" },
    ]);
  });

  it("还没收口时，那一行是 streaming 状态（面板据此画光标）", () => {
    const lines = toTranscriptLines([delta("正在"), delta("生成")]);

    expect(lines).toEqual([{ kind: "assistant", text: "正在生成", streaming: true }]);
  });

  it("带动作的那一轮：assistant 收口流式行，后面照常跟工具行", () => {
    const lines = toTranscriptLines([
      delta("我先搜一下"),
      { type: "assistant", text: "我先搜一下" },
      { type: "tool_call", id: "search", tool: "search", args: {} },
    ]);

    expect(lines.map((line) => line.kind)).toEqual(["assistant", "call"]);
    expect(lines[0]).toEqual({ kind: "assistant", text: "我先搜一下" });
  });

  it("中途取消：半句留着，但不再闪「正在生成」", () => {
    const lines = toTranscriptLines([delta("我刚说到一半"), { type: "cancelled" }]);

    expect(lines).toEqual([
      { kind: "assistant", text: "我刚说到一半", streaming: false },
      { kind: "cancelled", text: "已取消" },
    ]);
  });

  it("两轮的增量不会串到同一个气泡里", () => {
    const lines = toTranscriptLines([
      delta("第一句"),
      { type: "final", text: "第一句" },
      { type: "user", text: "再来" },
      delta("第二句"),
      { type: "final", text: "第二句" },
    ]);

    expect(lines.map((line) => ("text" in line ? line.text : ""))).toEqual(["第一句", "再来", "第二句"]);
  });
});
