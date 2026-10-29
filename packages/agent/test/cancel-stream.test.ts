import { describe, expect, it } from "vitest";
import type { Llm, LlmCallOptions } from "@plingjs/core";
import { createAgentLoop } from "../src/loop";
import { createLocalSession } from "../src/session";
import { collectEvents, ofType } from "./helpers";

/** 假模型：边生成边把增量给出去（真实适配器走 SSE 时就是这个形状） */
function streamingLlm(chunks: readonly string[]): Llm {
  return async (_messages, _tools, options?: LlmCallOptions) => {
    for (const chunk of chunks) options?.onDelta?.(chunk);
    return { content: chunks.join("") };
  };
}

/** 假模型：一直挂着，直到 signal 被 abort —— 模拟「请求还在飞」 */
function hangingLlm(onAbort: () => void): Llm {
  return (_messages, _tools, options?: LlmCallOptions) =>
    new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => {
        onAbort();
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
}

describe("流式：增量是事件流的一部分", () => {
  it("每段增量发一条 assistant_delta，收口仍然是 final（不会同一句话两条）", async () => {
    const { events, onEvent } = collectEvents();
    const loop = createAgentLoop({ llm: streamingLlm(["今", "天", "好"]), onEvent });

    const answer = await loop.run("打个招呼");

    expect(answer).toBe("今天好");
    expect(ofType(events, "assistant_delta").map((event) => event.text)).toEqual(["今", "天", "好"]);
    expect(ofType(events, "final")).toHaveLength(1);
    expect(ofType(events, "assistant")).toHaveLength(0);
  });

  it("非流式实现（不理会 onDelta）照常工作：只是没有增量事件", async () => {
    const { events, onEvent } = collectEvents();
    const loop = createAgentLoop({ llm: async () => ({ content: "一次性返回" }), onEvent });

    expect(await loop.run("你好")).toBe("一次性返回");
    expect(ofType(events, "assistant_delta")).toHaveLength(0);
    expect(ofType(events, "final")).toHaveLength(1);
  });
});

describe("取消：真的能打断在飞的请求", () => {
  it("loop.abort() → 发 cancelled、不发 error，返回「已取消」", async () => {
    let aborted = false;
    const { events, onEvent } = collectEvents();
    const loop = createAgentLoop({
      llm: hangingLlm(() => {
        aborted = true;
      }),
      onEvent,
    });

    const pending = loop.run("在吗");
    await new Promise((resolve) => setTimeout(resolve, 0));
    loop.abort();

    expect(await pending).toBe("(Cancelled)");
    expect(aborted).toBe(true);
    expect(ofType(events, "cancelled")).toHaveLength(1);
    // 取消不是故障：面板不该弹一条红色错误
    expect(ofType(events, "error")).toHaveLength(0);
  });

  it("取消不粘：abort 之后再 run 一次照常工作", async () => {
    const loop = createAgentLoop({ llm: streamingLlm(["好"]) });

    loop.abort();

    expect(await loop.run("再来")).toBe("好");
  });

  it("session.cancel() 走的就是这条路（面板上那个「停止」按钮）", async () => {
    let aborted = false;
    const session = createLocalSession({
      llm: hangingLlm(() => {
        aborted = true;
      }),
    });

    const pending = session.send("在吗");
    await new Promise((resolve) => setTimeout(resolve, 0));
    session.cancel();

    expect(await pending).toBe("(Cancelled)");
    expect(aborted).toBe(true);
    expect(session.status()).toBe("cancelled");
  });
});
