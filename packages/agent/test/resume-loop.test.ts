import { describe, expect, it } from "vitest";
import { RESUME_FLOW_ACTION_ID } from "@plingjs/core";
import { createAgentLoop } from "../src/loop";
import { makeRegistry, noSettle } from "./helpers";

/**
 * S6c：模型要能看见并使用 `pling_resume_flow`。
 *
 * 这条测试同时钉住三件事：
 *   1. 流程失败后，下一轮的工具清单里出现续跑动作；
 *   2. 失败回执里的 `resume.runId` 被原样带进工具消息（模型照抄就有用）；
 *   3. 续跑只做剩余步骤，前一步不重放。
 */
describe("agent 循环：流程续跑", () => {
  it("失败后模型调用 pling_resume_flow，从失败步骤继续", async () => {
    let available = false;
    const calls: string[] = [];
    const registry = makeRegistry([
      {
        id: "pick_day",
        primitive: "click",
        description: "选择日期",
        available: () => (available ? true : { available: false, reason: "这个月没有 30 日" }),
        onRun: () => calls.push("pick"),
      },
      { id: "save", primitive: "click", description: "保存", onRun: () => calls.push("save") },
      {
        id: "date_flow",
        description: "设置日期并保存",
        steps: [{ action: "pick_day" }, { action: "save" }],
      },
    ]);

    let turn = 0;
    let resumedWith: string | null = null;
    const llm = async (messages: Parameters<Parameters<typeof createAgentLoop>[0]["llm"]>[0]) => {
      turn += 1;
      if (turn === 1) {
        return {
          content: "",
          toolCalls: [{ id: "call_1", name: "date_flow", arguments: "{}" }],
        };
      }
      if (turn === 2) {
        const lastTool = [...messages].reverse().find((message) => message.role === "tool");
        const payload = JSON.parse(lastTool?.content ?? "{}") as { error?: { resume?: { runId?: string } } };
        resumedWith = payload.error?.resume?.runId ?? null;
        available = true;
        return {
          content: "",
          toolCalls: [
            {
              id: "call_2",
              name: RESUME_FLOW_ACTION_ID,
              arguments: JSON.stringify({ runId: resumedWith }),
            },
          ],
        };
      }
      return { content: "日期已保存" };
    };

    const loop = createAgentLoop({ registry, llm, policy: { check: async () => {} }, settle: noSettle, maxTurns: 5 });
    const answer = await loop.run("把回款日设成 30 号");

    expect(answer).toBe("日期已保存");
    expect(resumedWith).toMatch(/^run-/);
    expect(calls).toEqual(["pick", "save"]);
  });
});
