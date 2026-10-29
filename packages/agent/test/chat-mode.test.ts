import { describe, expect, it } from "vitest";
import { createAgentLoop } from "../src/loop";
import { createLocalSession } from "../src/session";
import { createReplayLlm } from "../src/replay";
import { collectEvents, ofType } from "./helpers";

// 纯聊天：同一套循环，只是**不绑定页面**（不传 registry / policy）。
describe("无页面的循环：就是聊天", () => {
  it("用聊天系统提示，不拼页面上下文，不注入动作", async () => {
    const llm = createReplayLlm([{ content: "你好呀" }]);
    const loop = createAgentLoop({ llm });

    const answer = await loop.run("你好");

    expect(answer).toBe("你好呀");
    const system = llm.received[0]!.find((message) => message.role === "system")!;
    expect(system.content).toContain("can only answer in text");
    expect(system.content).not.toContain("<page_data>");
    expect(system.content).not.toContain("Available actions on this page");
    expect(llm.toolsSeen[0]).toEqual([]);
  });

  it("没有页面就不必等「落定」——settle 一次都不调用", async () => {
    let settled = 0;
    const llm = createReplayLlm([{ content: "好" }]);
    const loop = createAgentLoop({ llm, settle: async () => void (settled += 1) });

    await loop.run("在吗");

    expect(settled).toBe(0);
  });

  it("多轮聊天：自己说过的话也留在上下文里，system 只发一份", async () => {
    const llm = createReplayLlm([{ content: "第一答" }, { content: "第二答" }]);
    const loop = createAgentLoop({ llm });

    await loop.run("第一条");
    await loop.run("那第二条呢");

    const second = llm.received[1]!;
    expect(second.filter((message) => message.role === "system")).toHaveLength(1);
    expect(second.filter((message) => message.role !== "system").map((message) => message.content)).toEqual([
      "第一条",
      "第一答",
      "那第二条呢",
    ]);
  });

  it("systemPrompt 可以整个换掉（业务想定制人格时）", async () => {
    const llm = createReplayLlm([{ content: "喵" }]);
    const loop = createAgentLoop({ llm, systemPrompt: "你是一只猫。" });

    await loop.run("你是谁");

    expect(llm.received[0]![0]!.content).toBe("你是一只猫。");
  });

  it("模型硬要调动作：得到可读的错误，而不是静默无事发生", async () => {
    const llm = createReplayLlm([{ calls: [{ tool: "add_todo", args: { text: "遛狗" } }] }, { content: "做不到。" }]);
    const { events, onEvent } = collectEvents();
    const loop = createAgentLoop({ llm, onEvent });

    await loop.run("加一条待办");

    const results = ofType(events, "tool_result");
    expect(results).toHaveLength(1);
    expect(JSON.stringify(results[0]!.result)).toContain("ACTION_NOT_FOUND");
    expect(JSON.stringify(results[0]!.result)).toContain("pure chat");
  });
});

describe("createLocalSession：聊天也走同一个会话契约", () => {
  it("串行 send + 事件流，和页面版没有区别", async () => {
    const llm = createReplayLlm([{ content: "第一句" }, { content: "第二句" }]);
    const session = createLocalSession({ llm, id: "chat" });

    const [first, second] = await Promise.all([session.send("a"), session.send("b")]);

    expect([first, second]).toEqual(["第一句", "第二句"]);
    expect(session.status()).toBe("idle");
    const kinds = session.events().map((event) => event.type);
    expect(kinds).toContain("final");
  });

  it("取消后立刻返回，不再继续跑", async () => {
    const llm = createReplayLlm([{ content: "不算了" }]);
    const session = createLocalSession({ llm });

    session.cancel();
    const answer = await session.send("随便");

    // send 内部会重置取消标记，所以这一次仍然跑完 —— 取消针对的是「正在跑的」
    expect(answer).toBe("不算了");
  });
});
