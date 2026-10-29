import { describe, expect, it } from "vitest";
import { countTokens, estimateMessageTokens, estimateTokens } from "../src/tokens";

describe("token 估算（CJK 感知）", () => {
  it("中文按 1 token/字，英文按 4 字符/token", () => {
    expect(estimateTokens("提交订单")).toBe(4);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("")).toBe(0);
  });

  it("中英混排分别计价（这就是不区分会低估 3~4 倍的地方）", () => {
    expect(estimateTokens("订单 abcdefgh")).toBe(2 + 3);
  });

  it("消息带固定开销；tool 消息带 id 开销", () => {
    expect(estimateMessageTokens({ role: "user", content: "" })).toBe(4);
    expect(estimateMessageTokens({ role: "tool", content: "", toolCallId: "c1" })).toBe(12);
  });

  it("countTokens 累加", () => {
    const tokens = countTokens([
      { role: "system", content: "规则" },
      { role: "user", content: "abcd" },
    ]);
    expect(tokens).toBe(4 + 2 + 4 + 1);
  });
});
