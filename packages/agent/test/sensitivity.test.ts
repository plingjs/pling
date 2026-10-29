import { describe, expect, it } from "vitest";
import { createPolicy, createRegistry, sensitive } from "@plingjs/core";
import { createAgentLoop } from "../src/loop";
import { createReplayLlm } from "../src/replay";
import { noSettle } from "./helpers";

/**
 * 敏感数据（S14）在会话里的最后一道闸。
 *
 * 业务抛错 / 工具回执里完全可能带着真值（「客户 138… 已存在」）。
 * 模型看到的就是 history 里那串 JSON —— 所以必须在**进上下文之前**换回代号，
 * 而不是指望每个业务函数都记得自己脱敏。
 */

const allowAll = createPolicy(async () => true);

describe("工具回执出站脱敏", () => {
  it("业务抛错带着手机号 → 模型只看到 {{p:…}}", async () => {
    const registry = createRegistry({ tokenSalt: "t" });
    const token = registry.tokens.tokenOf("13812341234");
    registry.bind({
      descriptor: { id: "save_customer", primitive: "click", description: "保存客户", kind: "write" },
      isAvailable: () => true,
      run: async () => {
        throw new Error("客户 13812341234 已存在");
      },
    });

    const loop = createAgentLoop({
      registry,
      policy: allowAll,
      llm: createReplayLlm([{ calls: [{ tool: "save_customer" }] }, { content: "保存失败" }]),
      settle: noSettle,
    });

    await loop.run("保存这个客户");

    const toolText = loop.history.recent
      .filter((message) => message.role === "tool")
      .map((message) => message.content)
      .join("\n");
    expect(toolText).toContain(`客户 ${token} 已存在`);
    expect(toolText).not.toContain("13812341234");
  });

  it("记录里的 token 会进提示词；真值不会", async () => {
    const registry = createRegistry({ tokenSalt: "t" });
    registry.declareRecord({
      id: "SO-1",
      fields: { 客户: "张三", 手机: sensitive("13812341234", "token") },
    });

    const llm = createReplayLlm([{ content: "好的" }]);
    const loop = createAgentLoop({ registry, policy: allowAll, llm, settle: noSettle });
    await loop.run("这单是谁的");

    // 页面数据在 system prompt 里（history 只存对话），所以要读模型真正收到的消息
    const prompt = llm.received.flat().map((message) => message.content).join("\n");
    expect(prompt).toMatch(/\{\{p:[0-9a-z]{7}\}\}/);
    expect(prompt).not.toContain("13812341234");
  });
});
