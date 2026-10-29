import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, DEFAULT_RETRY, type AgentConfig } from "../src/config";
import { createAgentRuntime } from "../src/runtime";
import { createReplayLlm } from "../src/replay";
import { HookRegistry } from "../src/hooks";
import { DEFAULT_CHAT_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT } from "../src/prompt";
import { errorFromStatus } from "../src/retry";
import { collectEvents, makeRegistry } from "./helpers";

const config = (overrides: Partial<AgentConfig> = {}): AgentConfig => ({
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
  ...overrides,
});

describe("会话接线：一份配置 → 一条能用的会话", () => {
  it("hooks：传进来的是同一份；不传也有一份空的，且真正接进循环", async () => {
    const hooks = new HookRegistry();
    const runtime = createAgentRuntime({ config: config(), hooks, llm: createReplayLlm([{ content: "好" }]) });
    expect(runtime.hooks).toBe(hooks);

    const empty = createAgentRuntime({ config: config(), llm: createReplayLlm([{ content: "好" }]) });
    expect(empty.hooks).toBeInstanceOf(HookRegistry);

    const ran: string[] = [];
    const guarded = new HookRegistry();
    guarded.addPreToolUse(({ id }) => (id === "save" ? { blocked: true, reason: "统一风控" } : undefined));
    const registry = makeRegistry([{ id: "save", onRun: () => void ran.push("saved") }]);
    const guardedRuntime = createAgentRuntime({
      config: config(),
      registry,
      hooks: guarded,
      llm: createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "被拦了" }]),
    });
    await guardedRuntime.session.send("保存");
    expect(ran).toEqual([]);
  });

  it("不传 registry = 纯聊天：底稿是聊天规则（不是操作规则），工具清单是空的", async () => {
    const llm = createReplayLlm([{ content: "你好" }]);
    const runtime = createAgentRuntime({ config: config(), llm });
    await runtime.session.send("在吗");

    const [messages, tools] = [llm.received[0]!, llm.toolsSeen[0]!];
    expect(tools).toEqual([]);
    expect(messages[0]!.content).toContain(DEFAULT_CHAT_SYSTEM_PROMPT);
    expect(messages[0]!.content).not.toContain("Available actions on this page");
  });

  it("纯聊天时，应用自己的角色说明也是追加在「聊天规则」之后", async () => {
    const llm = createReplayLlm([{ content: "你好" }]);
    const runtime = createAgentRuntime({ config: config({ systemPrompt: "你是这个应用里的助手。" }), llm });
    await runtime.session.send("在吗");

    const system = llm.received[0]![0]!.content!;
    expect(system.startsWith(DEFAULT_CHAT_SYSTEM_PROMPT)).toBe(true);
    expect(system).toContain("你是这个应用里的助手。");
  });

  it("传了 registry = 能操作页面：系统提示里带上动作清单，工具也跟着来", async () => {
    const registry = makeRegistry([{ id: "add_todo", primitive: "click", description: "新增一条待办" }]);
    const llm = createReplayLlm([{ content: "好" }]);
    const runtime = createAgentRuntime({ config: config(), registry, llm });
    await runtime.session.send("能干什么");

    expect(llm.received[0]![0]!.content).toContain(DEFAULT_SYSTEM_PROMPT);
    // 默认模式下 write 不问，所以清单里没有「需确认」标记
    expect(llm.received[0]![0]!.content).toContain("add_todo (click / write) 新增一条待办");
    expect(llm.toolsSeen[0]!.map((tool) => tool.function.name)).toEqual(["add_todo"]);
  });

  it("应用自己的角色说明是追加在框架规则后面的", async () => {
    const registry = makeRegistry([{ id: "a" }]);
    const llm = createReplayLlm([{ content: "好" }]);
    const runtime = createAgentRuntime({ config: config({ systemPrompt: "你是这个 Todo 应用里的助手。" }), registry, llm });
    await runtime.session.send("你好");

    const system = llm.received[0]![0]!.content!;
    expect(system.startsWith(DEFAULT_SYSTEM_PROMPT)).toBe(true);
    expect(system).toContain("你是这个 Todo 应用里的助手。");
  });

  it("界面语言为中文时在系统提示末尾追加中文回答约束，并跟随运行时切换", async () => {
    let locale = "en-US";
    const llm = createReplayLlm([{ content: "First" }, { content: "第二句" }]);
    const runtime = createAgentRuntime({
      config: config(),
      llm,
      responseLocale: () => locale,
    });

    await runtime.session.send("hello");
    expect(llm.received[0]![0]!.content).not.toContain("application UI is currently in Chinese");

    locale = "zh-CN";
    await runtime.session.send("你好");
    const system = llm.received[1]![0]!.content!;
    expect(system).toContain("The application UI is currently in Chinese.");
    expect(system).toMatch(/in Chinese unless the user's most recent message is in another language/);
  });

  it("默认提供确认通道：danger 动作停下来等确认，批了才执行", async () => {
    const ran: string[] = [];
    const registry = makeRegistry([{ id: "remove@t1", kind: "danger", onRun: () => void ran.push("removed") }]);
    const events = collectEvents();
    const runtime = createAgentRuntime({
      config: config(),
      registry,
      llm: createReplayLlm([{ calls: [{ tool: "remove@t1" }] }, { content: "删了" }]),
      onEvent: events.onEvent,
    });

    const running = runtime.session.send("删掉第一条");
    while (!runtime.approvals.current()) await new Promise((resolve) => setTimeout(resolve, 0));

    // 不批之前什么都没做
    expect(ran).toEqual([]);
    expect(runtime.approvals.current()!.request.approval).toBe("ask-always");
    runtime.approvals.reply(true);
    await running;

    expect(ran).toEqual(["removed"]);
    expect(runtime.approvals.current()).toBeNull();
  });

  it("应用级把闸门关掉：写动作直接执行（由应用自己负责）", async () => {
    const ran: string[] = [];
    const registry = makeRegistry([{ id: "remove@t1", kind: "danger", onRun: () => void ran.push("removed") }]);
    const runtime = createAgentRuntime({
      config: config(),
      registry,
      gate: () => false,
      llm: createReplayLlm([{ calls: [{ tool: "remove@t1" }] }, { content: "删了" }]),
    });

    await runtime.session.send("删掉第一条");
    expect(ran).toEqual(["removed"]);
    expect(runtime.approvals.current()).toBeNull();
  });

  it("开了闸门：danger 动作停下来等确认，批了才执行", async () => {
    const ran: string[] = [];
    const registry = makeRegistry([{ id: "remove@t1", kind: "danger", onRun: () => void ran.push("removed") }]);
    const pending: unknown[] = [];
    let gate = false;
    const runtime = createAgentRuntime({
      config: config(),
      registry,
      gate: () => gate,
      llm: createReplayLlm([{ calls: [{ tool: "remove@t1" }] }, { content: "删了" }]),
      onApproval: (request) => pending.push(request),
    });

    gate = true;
    const running = runtime.session.send("删掉第一条");
    while (!runtime.approvals.current()) await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runtime.approvals.current()!.request.kind).toBe("danger");
    expect(ran).toEqual([]); // 没批之前什么都没做
    runtime.approvals.reply(true);
    await running;

    expect(ran).toEqual(["removed"]);
    expect(pending.length).toBeGreaterThan(0);
  });

  it("配置不全时 readiness 说清楚缺什么（业务侧据此提示，而不是给个 401）", () => {
    const runtime = createAgentRuntime({ config: config({ baseUrl: "", model: "" }) });
    expect(runtime.readiness.ready).toBe(false);
    expect(runtime.readiness.hint).toContain("VITE_AGENT_BASE_URL");
    expect(runtime.model).toBe("");
  });

  it("注入了模型：一条 baseUrl 都不配也算就绪（脚本演示 / 自建薄 Node 层的形态）", () => {
    const runtime = createAgentRuntime({
      config: config({ baseUrl: "", model: "", apiKey: "" }),
      llm: async () => ({ content: "好" }),
    });
    expect(runtime.readiness).toEqual({ ready: true, hint: "" });
  });

  it("限额原样交给框架：填多小就压多小（这里只是确认它真的被用上了）", async () => {
    const runtime = createAgentRuntime({
      config: config({
        limits: { maxTurns: 2, contextTokens: 1024, reserveForOutput: 0, compactRatio: 0.1, keepRecent: 0 },
      }),
      llm: createReplayLlm([{ content: "好" }]),
    });
    expect(runtime.limits.maxTurns).toBe(2);
    expect(runtime.session.loop.history.budget).toBe(1024);
    await runtime.session.send("啰".repeat(2_000));

    // 水位 = (1024 − 0) × 0.1 = 102：这条长消息一进来就超过水位 → 下一轮开头会触发压缩
    expect(runtime.session.loop.history.needsCompaction()).toBe(true);
  });

  it("重试预算真的接到调用链，并在 telemetry 留下耗尽原因", async () => {
    let calls = 0;
    const runtime = createAgentRuntime({
      config: config({ retry: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 } }),
      llm: async () => {
        calls += 1;
        throw errorFromStatus(504, JSON.stringify({ error: { retryable: true, message: "upstream down" } }));
      },
    });

    await runtime.session.send("你好").catch(() => undefined);

    expect(calls).toBe(2);
    const summary = runtime.telemetry.summary();
    expect(summary.retries).toBe(1);
    expect(summary.retryExhausted).toBe(1);
    const failure = runtime.telemetry.events.find((event) => event.type === "llm" && !event.ok);
    expect(failure).toMatchObject({ status: 504, retryable: false, retryExhausted: true });
    expect(failure && "reason" in failure ? failure.reason : "").toContain("upstream down");
  });
});
