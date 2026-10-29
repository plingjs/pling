import { describe, expect, it } from "vitest";
import type { Llm } from "@plingjs/core";
import { History, truncateToolResult } from "../src/history";
import { estimateTokens } from "../src/tokens";

const summarizingLlm: Llm = async () => ({ content: "【旧历史摘要】" });

describe("工具结果截断", () => {
  it("不超预算就原样返回", () => {
    expect(truncateToolResult("短结果", 100)).toBe("短结果");
  });

  it("超预算保留头尾，中间标记截断", () => {
    const long = "中".repeat(3000);
    const result = truncateToolResult(long, 100);
    expect(result).toContain("characters omitted from the middle");
    // 中文页面：截断后必须真的落在预算内（固定 4 字符/token 的近似在这里会超 4 倍）
    expect(estimateTokens(result)).toBeLessThan(150);
    expect(result.startsWith("中")).toBe(true);
    expect(result.endsWith("中")).toBe(true);
  });
});

describe("三层上下文", () => {
  it("水位线到了才需要压缩", () => {
    const history = new History({ maxTokens: 100, reserveForOutput: 0, compactRatio: 0.8 });
    expect(history.needsCompaction()).toBe(false);
    history.append({ role: "user", content: "啊".repeat(200) });
    expect(history.needsCompaction()).toBe(true);
  });

  it("压缩后保留最近 keepRecent 条，旧段进摘要", async () => {
    const history = new History({ keepRecent: 2 });
    history.setSystem([{ role: "system", content: "S" }]);
    history.append({ role: "user", content: "u1" });
    history.append({ role: "assistant", content: "a1" });
    history.append({ role: "user", content: "u2" });
    history.append({ role: "assistant", content: "a2" });

    await history.compact(summarizingLlm);

    expect(history.recent.map((message) => message.content)).toEqual(["u2", "a2"]);
    expect(history.summary).toBe("【旧历史摘要】");
    expect(history.build()[1]!.content).toContain("[Conversation history summary]");
  });
});

describe("配对保护：压缩切点不能落在 tool 消息上", () => {
  const appendTurn = (history: History, index: number): void => {
    history.append({
      role: "assistant",
      content: "",
      toolCalls: [{ id: `c${index}`, name: `tool_${index}`, arguments: "{}" }],
    });
    history.append({ role: "tool", content: `result_${index}`, toolCallId: `c${index}`, name: `tool_${index}` });
  };

  it("切点会让 tool 消息失去配对的 assistant 时，切点前移", async () => {
    const history = new History({ keepRecent: 1 });
    history.append({ role: "user", content: "u" });
    appendTurn(history, 1);
    appendTurn(history, 2);

    await history.compact(summarizingLlm);

    // 留在这里的第一条不能是 tool —— 否则下一次请求会被服务端 400 拒绝
    expect(history.recent[0]!.role).toBe("assistant");
    expect(history.recent[0]!.toolCalls).toHaveLength(1);
    expect(history.recent[1]!.role).toBe("tool");
  });

  it("全部都是 tool 消息时不动手（避免压出孤儿）", async () => {
    const history = new History({ keepRecent: 1 });
    appendTurn(history, 1);
    await history.compact(summarizingLlm);
    expect(history.summary).toBe("");
  });
});
