import { describe, expect, it, vi } from "vitest";
import type { Llm } from "@plingjs/core";
import { createLocalSession } from "../src/session";
import { allowAll, makeRegistry, noSettle, ofType } from "./helpers";

const registry = () => makeRegistry([{ id: "a" }, { id: "b" }]);

describe("会话：串行与取消", () => {
  it("并发 send 会排队：同一时刻只跑一次循环", async () => {
    let active = 0;
    let maxActive = 0;
    const llm: Llm = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { content: "好" };
    };

    const session = createLocalSession({ registry: registry(), policy: allowAll, llm, settle: noSettle });
    const [first, second] = await Promise.all([session.send("一"), session.send("二")]);

    expect(first).toBe("好");
    expect(second).toBe("好");
    expect(maxActive).toBe(1);
  });

  it("cancel 后循环在安全点退出", async () => {
    const llm: Llm = async () => ({ content: "慢" });
    const session = createLocalSession({ registry: registry(), policy: allowAll, llm, settle: noSettle });
    const pending = session.send("跑");
    session.cancel();

    expect(await pending).toBe("(Cancelled)");
    expect(ofType(session.events(), "cancelled")).toHaveLength(1);
    expect(session.status()).toBe("cancelled");
  });

  it("事件流可累积；reset 之后清空", async () => {
    const llm: Llm = async () => ({ content: "完成" });
    const session = createLocalSession({ registry: registry(), policy: allowAll, llm, settle: noSettle });

    await session.send("做点事");
    expect(ofType(session.events(), "user")).toHaveLength(1);
    expect(ofType(session.events(), "final")[0]!.text).toBe("完成");

    session.reset();
    expect(session.events()).toHaveLength(0);
    expect(session.status()).toBe("idle");
  });

  it("send 期间状态是 running，跑完回到 idle", async () => {
    const seen: string[] = [];
    const llm: Llm = async () => {
      seen.push(session.status());
      return { content: "好" };
    };
    const session = createLocalSession({ registry: registry(), policy: allowAll, llm, settle: noSettle });

    await session.send("跑");
    expect(seen).toEqual(["running"]);
    expect(session.status()).toBe("idle");
  });

  it("循环失败不会卡死队列，下一次 send 照常", async () => {
    let calls = 0;
    const llm: Llm = async () => {
      calls += 1;
      if (calls === 1) throw new Error("模型挂了");
      return { content: "恢复了" };
    };
    const session = createLocalSession({ registry: registry(), policy: allowAll, llm, settle: noSettle });

    await expect(session.send("一")).resolves.toContain("Model call failed");
    await expect(session.send("二")).resolves.toBe("恢复了");
  });
});
