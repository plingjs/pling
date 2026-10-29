import { describe, expect, it } from "vitest";
import type { Llm, LlmMessage } from "@plingjs/core";
import {
  CONTINUITY_VERSION,
  createMemoryContinuityStore,
  type ContinuitySnapshot,
} from "../src/continuity";
import { createLocalSession } from "../src/session";
import { createAgentRuntime } from "../src/runtime";
import { DEFAULT_LIMITS, DEFAULT_RETRY, type AgentConfig } from "../src/config";
import { allowAll, makeRegistry, noSettle } from "./helpers";

const registry = () => makeRegistry([{ id: "open_detail" }, { id: "save" }]);

const config = (): AgentConfig => ({
  baseUrl: "/llm/v1",
  model: "test-model",
  apiKey: "",
  temperature: 0,
  maxTokens: 256,
  systemPrompt: "",
  stream: false,
  defaultApproval: "danger",
  minActionIntervalMs: 0,
  retry: { ...DEFAULT_RETRY },
  limits: { ...DEFAULT_LIMITS },
});

describe("跨整页导航的会话连续性", () => {
  it("同一份 store 在下一个 document 恢复目标、历史与事件", async () => {
    const store = createMemoryContinuityStore();
    const firstRegistry = registry();
    firstRegistry.setPage({ path: "/orders", query: { status: "open" }, hash: "#list" });
    const first = createLocalSession({
      registry: firstRegistry,
      policy: allowAll,
      llm: async () => ({ content: "第一页完成" }),
      settle: noSettle,
      continuity: { store, now: () => 1_000 },
    });

    await first.send("先看第一页");
    expect(first.continuity.restored).toBe(false);
    expect(store.load()?.goal).toBe("先看第一页");
    expect(store.load()?.status).toBe("done");
    expect(store.load()?.startPage).toEqual({ path: "/orders", query: { status: "open" }, hash: "#list" });

    const seen: LlmMessage[][] = [];
    const llm: Llm = async (messages) => {
      seen.push(messages);
      return { content: "第二页继续完成" };
    };
    const second = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm,
      settle: noSettle,
      continuity: { store, now: () => 2_000 },
    });

    expect(second.continuity.restored).toBe(true);
    expect(second.continuity.checkpoint?.goal).toBe("先看第一页");
    expect(second.continuity.checkpoint?.status).toBe("done");
    expect(second.events().length).toBe(first.events().length);

    await second.send("继续刚才的任务");
    const contents = seen[0]!.map((message) => message.content).join("\n");
    expect(contents).toContain("先看第一页");
    expect(contents).toContain("第一页完成");
    expect(contents).toContain("继续刚才的任务");
  });

  it("导航截断的 tool call 会被补成「结果未知」，下一次请求仍保持配对", async () => {
    const snapshot: ContinuitySnapshot = {
      version: CONTINUITY_VERSION,
      updatedAt: 1_000,
      status: "active",
      goal: "打开订单详情",
      summary: "",
      messages: [
        { role: "user", content: "打开订单详情" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "open_detail", arguments: "{}" }],
        },
      ],
      events: [
        { type: "user", text: "打开订单详情" },
        { type: "tool_call", id: "open_detail", tool: "open_detail", args: {} },
      ],
    };
    const store = createMemoryContinuityStore(snapshot);
    let seen: LlmMessage[] = [];
    const session = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async (messages) => {
        seen = messages;
        return { content: "已在新页面继续" };
      },
      settle: noSettle,
      continuity: { store, now: () => 2_000 },
    });

    expect(session.continuity.checkpoint?.interrupted).toBe(true);
    await session.send("继续");

    const tool = seen.find((message) => message.role === "tool");
    expect(tool?.toolCallId).toBe("call_1");
    expect(tool?.content).toContain("the result of this step is unknown");
  });

  it("超过 TTL 的检查点不会恢复", () => {
    const snapshot: ContinuitySnapshot = {
      version: CONTINUITY_VERSION,
      updatedAt: 100,
      status: "active",
      goal: "旧任务",
      summary: "",
      messages: [],
      events: [],
    };
    const store = createMemoryContinuityStore(snapshot);
    const session = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "好" }),
      settle: noSettle,
      continuity: { store, now: () => 10_000, ttlMs: 1_000 },
    });

    expect(session.continuity.restored).toBe(false);
    expect(session.events()).toHaveLength(0);
  });

  it("损坏的检查点不会恢复，也不会让页面崩溃", () => {
    const broken = {
      version: CONTINUITY_VERSION,
      updatedAt: 1_000,
      status: "active",
      summary: "",
      messages: "not-an-array",
      events: [{ type: "user", text: "ok" }],
    } as unknown as ContinuitySnapshot;
    const session = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "好" }),
      settle: noSettle,
      continuity: { store: createMemoryContinuityStore(broken), now: () => 2_000 },
    });

    expect(session.continuity.restored).toBe(false);
    expect(session.events()).toHaveLength(0);
  });

  it("reset 会清空当前标签页的检查点", async () => {
    const store = createMemoryContinuityStore();
    const session = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "完成" }),
      settle: noSettle,
      continuity: { store, now: () => 1_000 },
    });

    await session.send("做一件事");
    expect(store.load()).not.toBeNull();
    session.reset();
    expect(store.load()).toBeNull();
    expect(session.events()).toHaveLength(0);
  });

  it("reset 后控制器回到未恢复状态，auto 不能再消费", () => {
    const snapshot: ContinuitySnapshot = {
      version: CONTINUITY_VERSION,
      updatedAt: 1_000,
      status: "active",
      goal: "继续处理订单",
      summary: "",
      messages: [{ role: "user", content: "继续处理订单" }],
      events: [{ type: "user", text: "继续处理订单" }],
    };
    const session = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "完成" }),
      settle: noSettle,
      continuity: {
        store: createMemoryContinuityStore(snapshot),
        now: () => 2_000,
        resume: "auto",
      },
    });

    expect(session.continuity.restored).toBe(true);
    expect(session.continuity.checkpoint?.goal).toBe("继续处理订单");
    session.reset();
    expect(session.continuity.restored).toBe(false);
    expect(session.continuity.checkpoint).toBeNull();
    expect(session.continuity.claimAutoResume()).toBe(false);
  });

  it("上一件事收口后，下一条输入成为新的目标", async () => {
    const store = createMemoryContinuityStore();
    const session = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "完成" }),
      settle: noSettle,
      continuity: { store, now: () => 1_000 },
    });

    await session.send("第一件事");
    expect(store.load()?.goal).toBe("第一件事");
    expect(store.load()?.status).toBe("done");

    await session.send("第二件事");
    expect(store.load()?.goal).toBe("第二件事");
    expect(store.load()?.status).toBe("done");
  });

  it("落盘前把已知敏感真值换回代号，检查点里不出现真值", async () => {
    const store = createMemoryContinuityStore();
    const sensitiveRegistry = registry();
    const phone = "13800001111";
    const token = sensitiveRegistry.tokens.tokenOf(phone);
    const session = createLocalSession({
      registry: sensitiveRegistry,
      policy: allowAll,
      llm: async () => ({ content: `已记下 ${phone}` }),
      settle: noSettle,
      continuity: { store, now: () => 1_000 },
    });

    await session.send(`把 ${phone} 写进备注`);

    const saved = JSON.stringify(store.load());
    expect(token).toMatch(/^\{\{p:[0-9a-z]+\}\}$/);
    expect(saved).not.toContain(phone);
    expect(saved).toContain(token);
  });

  it("恢复不会自动重跑动作，待确认审批也不会被恢复", () => {
    const snapshot: ContinuitySnapshot = {
      version: CONTINUITY_VERSION,
      updatedAt: 1_000,
      status: "active",
      goal: "删除订单",
      summary: "",
      messages: [
        { role: "user", content: "删除订单" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_danger", name: "save", arguments: "{}" }],
        },
      ],
      events: [{ type: "tool_call", id: "save", tool: "save", args: {} }],
    };
    const store = createMemoryContinuityStore(snapshot);
    let calls = 0;
    const runtime = createAgentRuntime({
      config: config(),
      registry: registry(),
      llm: async () => {
        calls += 1;
        return { content: "继续" };
      },
      continuity: { store, now: () => 2_000 },
    });

    expect(runtime.continuity.restored).toBe(true);
    expect(runtime.continuity.checkpoint?.interrupted).toBe(true);
    expect(runtime.approvals.current()).toBeNull();
    expect(calls).toBe(0);
  });

  it("连续两次整页导航后，第三个 document 仍能看到最早的目标与中间页结果", async () => {
    const store = createMemoryContinuityStore();
    const first = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "第一页完成" }),
      settle: noSettle,
      continuity: { store, now: () => 1_000 },
    });
    await first.send("跨三页的任务");

    const second = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "第二页完成" }),
      settle: noSettle,
      continuity: { store, now: () => 2_000 },
    });
    await second.send("继续到第二页");

    const seen: LlmMessage[][] = [];
    const third = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async (messages) => {
        seen.push(messages);
        return { content: "第三页完成" };
      },
      settle: noSettle,
      continuity: { store, now: () => 3_000 },
    });
    expect(third.continuity.restored).toBe(true);
    // 第二页已经收口，第三页的「继续」是新目标；但更早的目标与结果必须还在历史里。
    expect(third.continuity.checkpoint?.goal).toBe("继续到第二页");

    await third.send("继续到第三页");
    const contents = seen[0]!.map((message) => message.content).join("\n");
    expect(contents).toContain("跨三页的任务");
    expect(contents).toContain("第一页完成");
    expect(contents).toContain("第二页完成");
    expect(contents).toContain("继续到第三页");
    expect(seen[0]!.at(-1)?.content).toBe("继续到第三页");
  });

  it("auto 策略只允许一个入口消费一次；ask / done 不会自动续跑", () => {
    const active: ContinuitySnapshot = {
      version: CONTINUITY_VERSION,
      updatedAt: 1_000,
      status: "active",
      goal: "继续处理订单",
      summary: "",
      messages: [{ role: "user", content: "继续处理订单" }],
      events: [{ type: "user", text: "继续处理订单" }],
    };

    const auto = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "完成" }),
      settle: noSettle,
      continuity: { store: createMemoryContinuityStore(active), now: () => 2_000, resume: "auto" },
    });
    expect(auto.continuity.resume).toBe("auto");
    expect(auto.continuity.claimAutoResume()).toBe(true);
    expect(auto.continuity.claimAutoResume()).toBe(false);

    const ask = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "完成" }),
      settle: noSettle,
      continuity: { store: createMemoryContinuityStore(active), now: () => 2_000 },
    });
    expect(ask.continuity.resume).toBe("ask");
    expect(ask.continuity.claimAutoResume()).toBe(false);

    const off = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "完成" }),
      settle: noSettle,
      continuity: { store: createMemoryContinuityStore(active), now: () => 2_000, resume: "off" },
    });
    expect(off.continuity.resume).toBe("off");
    expect(off.continuity.claimAutoResume()).toBe(false);

    const doneAuto = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "完成" }),
      settle: noSettle,
      continuity: {
        store: createMemoryContinuityStore({ ...active, status: "done" }),
        now: () => 2_000,
        resume: "auto",
      },
    });
    expect(doneAuto.continuity.claimAutoResume()).toBe(false);
  });

  describe("完成后返回开始页（returnOnDone）", () => {
    const active: ContinuitySnapshot = {
      version: CONTINUITY_VERSION,
      updatedAt: 1_000,
      status: "active",
      goal: "打开订单详情，填完备注后保存",
      page: { path: "/orders/SO-1001", query: { tab: "detail" } },
      startPage: { path: "/orders", query: { status: "open" }, hash: "#list" },
      summary: "",
      messages: [{ role: "user", content: "打开订单详情，填完备注后保存" }],
      events: [{ type: "user", text: "打开订单详情，填完备注后保存" }],
    };

    it("恢复中的任务产生 final 后，只返回一次任务开始页", async () => {
      const store = createMemoryContinuityStore(active);
      const session = createLocalSession({
        registry: registry(),
        policy: allowAll,
        llm: async () => ({ content: "备注已保存" }),
        settle: noSettle,
        continuity: { store, now: () => 2_000, resume: "auto", returnOnDone: true },
      });

      expect(session.continuity.claimReturn()).toBeNull();
      await session.send("继续");

      expect(session.continuity.claimReturn()).toEqual({
        href: "/orders?status=open#list",
        delayMs: 500,
      });
      expect(session.continuity.claimReturn()).toBeNull();
    });

    it("ask 策略下由用户手动继续，完成后同样可以返回", async () => {
      const session = createLocalSession({
        registry: registry(),
        policy: allowAll,
        llm: async () => ({ content: "完成" }),
        settle: noSettle,
        continuity: {
          store: createMemoryContinuityStore(active),
          now: () => 2_000,
          resume: "ask",
          returnOnDone: { delayMs: 1_200 },
        },
      });

      expect(session.continuity.resume).toBe("ask");
      await session.send("继续上次任务");
      expect(session.continuity.claimReturn()).toEqual({
        href: "/orders?status=open#list",
        delayMs: 1_200,
      });
    });

    it("显式 to 优先于任务开始页；跨源仍由浮窗导航层拒绝", async () => {
      const session = createLocalSession({
        registry: registry(),
        policy: allowAll,
        llm: async () => ({ content: "完成" }),
        settle: noSettle,
        continuity: {
          store: createMemoryContinuityStore(active),
          now: () => 2_000,
          returnOnDone: { to: "./index.html?done=1", delayMs: 80 },
        },
      });

      await session.send("继续");
      expect(session.continuity.claimReturn()).toEqual({
        href: "./index.html?done=1",
        delayMs: 80,
      });
    });

    it("已经在开始页时默认不 reload；显式 to 仍按开发者配置执行", async () => {
      const pageRegistry = registry();
      pageRegistry.setPage({ path: "/orders", query: { status: "open" }, hash: "#list" });
      const session = createLocalSession({
        registry: pageRegistry,
        policy: allowAll,
        llm: async () => ({ content: "完成" }),
        settle: noSettle,
        continuity: {
          store: createMemoryContinuityStore(active),
          now: () => 2_000,
          returnOnDone: true,
        },
      });

      await session.send("继续");
      expect(session.continuity.claimReturn()).toBeNull();
    });

    it("没有配置 returnOnDone 时不返回；reset 后也不会再返回", async () => {
      const disabled = createLocalSession({
        registry: registry(),
        policy: allowAll,
        llm: async () => ({ content: "完成" }),
        settle: noSettle,
        continuity: { store: createMemoryContinuityStore(active), now: () => 2_000 },
      });
      await disabled.send("继续");
      expect(disabled.continuity.claimReturn()).toBeNull();

      const reset = createLocalSession({
        registry: registry(),
        policy: allowAll,
        llm: async () => ({ content: "完成" }),
        settle: noSettle,
        continuity: {
          store: createMemoryContinuityStore(active),
          now: () => 2_000,
          returnOnDone: true,
        },
      });
      await reset.send("继续");
      reset.reset();
      expect(reset.continuity.claimReturn()).toBeNull();
    });

    it("恢复的是 done 任务时，新任务完成不会把用户重新带回旧页面", async () => {
      const session = createLocalSession({
        registry: registry(),
        policy: allowAll,
        llm: async () => ({ content: "新任务完成" }),
        settle: noSettle,
        continuity: {
          store: createMemoryContinuityStore({ ...active, status: "done" }),
          now: () => 2_000,
          returnOnDone: true,
        },
      });

      await session.send("在同一页做一个新任务");
      expect(session.continuity.claimReturn()).toBeNull();
    });

    it("旧检查点没有 startPage 时回退到 page，保持向后兼容", async () => {
      const session = createLocalSession({
        registry: registry(),
        policy: allowAll,
        llm: async () => ({ content: "完成" }),
        settle: noSettle,
        continuity: {
          store: createMemoryContinuityStore({
            ...active,
            startPage: undefined,
            page: { path: "/orders", query: { status: "open" } },
          }),
          now: () => 2_000,
          returnOnDone: true,
        },
      });

      await session.send("继续");
      expect(session.continuity.claimReturn()).toEqual({
        href: "/orders?status=open",
        delayMs: 500,
      });
    });
  });

  it("pageHref 稳定还原 query 与 hash，损坏的 startPage 不会让恢复崩溃", async () => {
    const broken = {
      version: CONTINUITY_VERSION,
      updatedAt: 1_000,
      status: "active",
      goal: "继续",
      page: { path: "/orders" },
      startPage: { path: 123, query: [] },
      summary: "",
      messages: [{ role: "user", content: "继续" }],
      events: [{ type: "user", text: "继续" }],
    } as unknown as ContinuitySnapshot;
    const session = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "完成" }),
      settle: noSettle,
      continuity: {
        store: createMemoryContinuityStore(broken),
        now: () => 2_000,
        returnOnDone: true,
      },
    });

    expect(session.continuity.checkpoint?.startPage).toBeUndefined();
    await session.send("继续");
    // 损坏的 startPage 被丢掉，回退到合法的 page；旧检查点因此仍能返回。
    expect(session.continuity.claimReturn()).toEqual({ href: "/orders", delayMs: 500 });
  });
});
