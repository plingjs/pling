import { describe, expect, it } from "vitest";
import { createPolicy, createRegistry, type Availability, type Registry } from "@plingjs/core";
import { Telemetry } from "../src/telemetry";
import { HookRegistry } from "../src/hooks";
import { createAgentLoop, defaultSettle, type LoopOptions } from "../src/loop";
import { createReplayLlm, type ReplayTurn } from "../src/replay";
import type { SessionEvent } from "../src/types";
import { allowAll, collectEvents, denyWrites, makeRegistry, noSettle, ofType, type FakeAction } from "./helpers";

function setup(turns: readonly ReplayTurn[], actions: readonly FakeAction[], extra: Partial<LoopOptions> = {}) {
  const registry = makeRegistry(actions);
  const llm = createReplayLlm(turns);
  const { events, onEvent } = collectEvents();
  const loop = createAgentLoop({ registry, policy: allowAll, llm, onEvent, settle: noSettle, ...extra });
  return { loop, llm, events, registry };
}

const toolMessages = (loop: { history: { recent: readonly { role: string; content: string }[] } }) =>
  loop.history.recent.filter((message) => message.role === "tool");

describe("循环：多步编排", () => {
  it("拆成多轮：输入 → 回车 → 审批，最后给出结论", async () => {
    const called: string[] = [];
    const { loop, events } = setup(
      [
        { calls: [{ tool: "search_query", args: { text: "SO-1001" } }, { tool: "search_enter", args: { key: "Enter" } }] },
        { calls: [{ tool: "approve@order:SO-1001" }] },
        { content: "已搜索并审批 SO-1001。" },
      ],
      [
        { id: "search_query", primitive: "type", onRun: () => called.push("search_query") },
        { id: "search_enter", primitive: "press", onRun: () => called.push("search_enter") },
        { id: "approve@order:SO-1001", onRun: () => called.push("approve") },
      ],
    );

    const answer = await loop.run("帮我审批 SO-1001");

    expect(called).toEqual(["search_query", "search_enter", "approve"]);
    expect(answer).toBe("已搜索并审批 SO-1001。");
    expect(ofType(events, "final")).toHaveLength(1);
    expect(ofType(events, "tool_call").map((event) => event.id)).toEqual([
      "search_query",
      "search_enter",
      "approve@order:SO-1001",
    ]);
  });

  it("回执要说清「做了什么」：模型拿到的 tool 结果里带这次动作的 id 与说明", async () => {
    // 实测的翻车：删掉「把周报发给团队」之后，那一行（记录 + 动作）都从快照里消失了，
    // 模型回头看到的就是「列表里没有这条待办」，于是认真地说「没找到目标，所以没删」。
    const { loop } = setup(
      [{ calls: [{ tool: "remove@t2" }] }, { content: "已删除。" }],
      [{ id: "remove@t2", description: "删除待办「把周报发给团队」（不可逆）" }],
    );
    await loop.run("删除发周报");

    expect(JSON.parse(toolMessages(loop)[0]!.content)).toMatchObject({
      result: { ok: true, action: { id: "remove@t2", description: "删除待办「把周报发给团队」（不可逆）" } },
    });
  });

  it("复合动作对循环就是 1 次工具调用（S6a：顺序从模型手里接过来，不是 N 轮往返）", async () => {
    const called: string[] = [];
    const { loop, events } = setup(
      [{ calls: [{ tool: "fill_note", args: { orderId: "SO-1002" } }] }, { content: "备注已改。" }],
      [
        { id: "search_query", primitive: "type", onRun: () => called.push("search_query") },
        { id: "edit@order:SO-1002", onRun: () => called.push("edit") },
        {
          id: "fill_note",
          description: "把订单备注改成指定内容",
          steps: [
            { action: "search_query", args: { text: "SO-1002" } },
            { action: "edit@order:SO-1002" },
          ],
        },
      ],
    );

    const answer = await loop.run("把 SO-1002 的备注改掉");

    expect(called).toEqual(["search_query", "edit"]);
    // 1 次 tool_call，2 步在里面 —— 这正是 S6a 要的效果：轮数不再随步骤数增长
    expect(ofType(events, "tool_call").map((event) => event.id)).toEqual(["fill_note"]);
    expect(JSON.parse(toolMessages(loop)[0]!.content)).toMatchObject({
      result: { ok: true, flow: { completed: 2, total: 2 } },
    });
    expect(answer).toBe("备注已改。");
  });

  it("复合动作中途失败 → 给出续跑句柄，并明确「别整条重跑」（S6a / S6c）", async () => {
    const { loop } = setup(
      [{ calls: [{ tool: "fill_note", args: { orderId: "SO-1002" } }] }, { content: "没做完。" }],
      [
        { id: "search_query", primitive: "type", onRun: () => {} },
        {
          id: "fill_note",
          description: "把订单备注改成指定内容",
          steps: [{ action: "search_query", args: { text: "SO-1002" } }, { action: "never_here" }],
        },
      ],
    );

    await loop.run("把 SO-1002 的备注改掉");

    const payload = JSON.parse(toolMessages(loop)[0]!.content) as {
      error: { code: string; message: string; resume?: { runId: string; from: number } };
    };
    expect(payload.error.code).toBe("STEP_FAILED");
    // 「失败」两个字会让模型从头再来一遍，而前几步是真的生效了 —— 提示必须把方向定死
    // ACTION_NOT_FOUND 是执行前失败：可以安全地从失败那一步继续。
    expect(payload.error.resume).toMatchObject({ from: 2 });
    expect(payload.error.message).toContain("pling_resume_flow");
    expect(payload.error.message).toContain("Do not restart from step one");
    // 错误信息里仍然要能看出「做到第几步」，以及当前还能用什么动作
    expect(payload.error.message).toContain("failed at step 2/2");
    expect(payload.error.message).toContain("Available actions");
  });

  it("S3：变更证据跟着回执走 —— 模型拿到的结果里有「执行前后差了什么」", async () => {
    // 只回报 `{ok:true, action}` 是不够的：「我调用了这个动作」和「页面真的变了」是两件事。
    const registry = createRegistry();
    const unbind = new Map<string, () => void>();
    for (const id of ["t1", "t2"]) unbind.set(id, registry.declareRecord({ id, fields: () => ({}) }));
    registry.bind({
      descriptor: { id: "remove@t1", primitive: "click", kind: "danger", description: "删除待办 t1（不可逆）" },
      isAvailable: () => true,
      run: async () => void unbind.get("t1")?.(),
    });

    const llm = createReplayLlm([{ calls: [{ tool: "remove@t1" }] }, { content: "删好了" }]);
    // danger 的「每次都要确认」不给「始终允许」，这里用一个全批的策略跳过确认
    const loop = createAgentLoop({ registry, policy: createPolicy(async () => true), llm, settle: noSettle });
    await loop.run("删掉 t1");

    const result = JSON.parse(toolMessages(loop)[0]!.content).result as {
      changed: { observed: boolean; records: { removed: string[]; total?: { from: number; to: number } } };
    };
    expect(result.changed.observed).toBe(true);
    expect(result.changed.records.removed).toEqual(["t1"]);
    // 被裁剪掉的行只在这里看得见：光看 records 数组不知道「页面上一共有几行」
    expect(result.changed.records.total).toEqual({ from: 2, to: 1 });
  });

  it("S3：什么都没观察到时告警（执行成功 ≠ 生效）；read 类动作不报，免得刷噪音", async () => {
    const nothingChanges: FakeAction[] = [{ id: "toggle@t1", kind: "write", description: "标记完成" }];
    const write = setup([{ calls: [{ tool: "toggle@t1" }] }, { content: "好了" }], nothingChanges);
    await write.loop.run("标记完成");
    const warned = JSON.parse(toolMessages(write.loop)[0]!.content).result as { warning?: string };
    expect(warned.warning).toContain("No change was observed between snapshots");

    const read = setup(
      [{ calls: [{ tool: "toggle@t1" }] }, { content: "好了" }],
      [{ id: "toggle@t1", primitive: "scroll", kind: "read", description: "滚一屏" }],
    );
    await read.loop.run("滚一屏");
    const quiet = JSON.parse(toolMessages(read.loop)[0]!.content).result as { warning?: string };
    expect(quiet.warning).toBeUndefined();
  });

  it("同一轮里的多个调用：每个都回填一条 tool 消息（配对不能断）", async () => {
    const { loop } = setup(
      [{ calls: [{ tool: "a" }, { tool: "b" }, { tool: "c" }] }, { content: "完成" }],
      [{ id: "a" }, { id: "b" }, { id: "c" }],
    );
    await loop.run("跑三个动作");

    const assistant = loop.history.recent.filter((message) => message.role === "assistant");
    const tool = toolMessages(loop);
    expect(assistant[0]!.toolCalls).toHaveLength(3);
    expect(tool).toHaveLength(3);
    // 配对：每条 tool 消息都指回一个 tool_call id
    const ids = new Set(
      assistant.flatMap((message) => (message as { toolCalls?: { id: string }[] }).toolCalls?.map((call) => call.id) ?? []),
    );
    for (const message of tool) expect(ids.has((message as { toolCallId?: string }).toolCallId!)).toBe(true);
  });
});

describe("循环：协议层（id ↔ function name）", () => {
  it("模型看到的是合法 name，执行与事件里是页面原始 id", async () => {
    const { loop, llm, events } = setup(
      [{ calls: [{ tool: "approve@order:SO-1001" }] }, { content: "好了" }],
      [{ id: "approve@order:SO-1001" }],
    );
    await loop.run("审批");

    expect(llm.toolsSeen[0]!.map((tool) => tool.function.name)).toEqual(["approve_order_SO-1001"]);
    const call = ofType(events, "tool_call")[0]!;
    expect(call.tool).toBe("approve_order_SO-1001");
    expect(call.id).toBe("approve@order:SO-1001");
  });
});

describe("循环：错误要可行动（模型靠它自救）", () => {
  it("未知动作 → 附上当前可用动作清单，并向面板/审计发出可见事件", async () => {
    const { loop, events } = setup(
      [{ calls: [{ tool: "not_declared" }] }, { content: "我改用搜索" }],
      [{ id: "search_query", primitive: "type" }],
    );
    const answer = await loop.run("随便点点");

    const first = toolMessages(loop)[0]!;
    expect(first.content).toContain("ACTION_NOT_FOUND");
    expect(first.content).toContain("Unknown action: not_declared");
    expect(first.content).toContain("Available actions");
    expect(first.content).toContain("search_query");
    expect(answer).toBe("我改用搜索");

    // 静默是 bug：面板与业务审计必须看得到「模型猜了一个不存在的动作」
    const results = ofType(events, "tool_result");
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("not_declared");
    expect(ofType(events, "tool_call")).toHaveLength(0); // 动作不存在，不谎报「要执行」
  });

  it("快照之后元素被卸载（浏览器里的真实竞态）→ ACTION_UNAVAILABLE + 提示先探索", async () => {
    // 第一轮里 refresh 先执行并把列表换掉，导致同一轮第二个动作的目标已不在 DOM 上
    let mounted = true;
    const { loop } = setup(
      [{ calls: [{ tool: "refresh" }, { tool: "row_delete" }] }, { content: "列表刷新了" }],
      [
        { id: "refresh", kind: "read", onRun: () => { mounted = false; } },
        { id: "row_delete", available: () => mounted },
        { id: "search_query", primitive: "type" },
      ],
    );
    await loop.run("删掉那一条");

    const content = toolMessages(loop)[1]!.content;
    expect(content).toContain("ACTION_UNAVAILABLE");
    expect(content).toContain("discovery action");
  });

  it("无确认通道时写动作被拒（fail-closed），循环继续而不是崩", async () => {
    const registry = makeRegistry([{ id: "delete_order", kind: "danger" }]);
    const llm = createReplayLlm([{ calls: [{ tool: "delete_order" }] }, { content: "删除被拒绝了" }]);
    const { events, onEvent } = collectEvents();
    const loop = createAgentLoop({ registry, policy: denyWrites, llm, onEvent, settle: noSettle });

    const answer = await loop.run("删除订单");

    expect(toolMessages(loop)[0]!.content).toContain("PERMISSION_DENIED");
    expect(ofType(events, "tool_result")[0]!.result).toMatchObject({ error: { code: "PERMISSION_DENIED" } });
    expect(answer).toBe("删除被拒绝了");
  });
});

describe("循环：防失控（只拦「原地打转」，不拦「天生要重复的流程」）", () => {
  it("真实翻车现场：填内容 → 提交，连着来四条都该落进去", async () => {
    // 浏览器实测翻车：让助手连加 4 条待办，`composer_submit{}` 的参数每次都是空对象，
    // 旧的「同名同参累计 3 次」把它判成死循环，还把当轮剩下的调用全跳过 —— 第 3、4 条没进页面。
    const ran: string[] = [];
    const { loop } = setup(
      [
        { calls: [{ tool: "composer_text", args: { text: "学习计划" } }, { tool: "composer_submit" }] },
        { calls: [{ tool: "composer_text", args: { text: "第 1 周" } }, { tool: "composer_submit" }] },
        // 这一批多打了一次提交（模型看不到上一条结果）→ 批内重复只执行第一条
        {
          calls: [
            { tool: "composer_text", args: { text: "第 2 周" } },
            { tool: "composer_submit" },
            { tool: "composer_submit" },
          ],
        },
        { calls: [{ tool: "composer_text", args: { text: "第 3 周" } }, { tool: "composer_submit" }] },
        { content: "四条都加好了" },
      ],
      [
        { id: "composer_text", primitive: "type", onRun: (args) => void ran.push(`text:${String(args.text)}`) },
        { id: "composer_submit", onRun: () => void ran.push("submit") },
      ],
    );

    const answer = await loop.run("制定一个四周学习计划");

    expect(answer).toBe("四条都加好了");
    expect(ran).toEqual([
      "text:学习计划",
      "submit",
      "text:第 1 周",
      "submit",
      "text:第 2 周",
      "submit",
      "text:第 3 周",
      "submit",
    ]);
    // 只有那条批内重复被拦，其余一次都没被误伤
    const blocked = toolMessages(loop).filter((message) => message.content.includes("LOOP_DETECTED"));
    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.content).toContain("same batch");
  });

  it("连着三轮只做同一件事、中间什么都没做 → 第 3 次拦下", async () => {
    const ran: string[] = [];
    const { loop, events } = setup(
      [
        { calls: [{ tool: "a" }] },
        { calls: [{ tool: "a" }] },
        { calls: [{ tool: "a" }] },
        { content: "我停下" },
      ],
      [{ id: "a", onRun: () => void ran.push("a") }],
    );

    const answer = await loop.run("卡住了吧");

    expect(answer).toBe("我停下");
    expect(ran).toEqual(["a", "a"]); // 前两次照跑，第三次才是打转
    expect(toolMessages(loop)).toHaveLength(3); // 一条都不能少（配对不能断）
    const detected = toolMessages(loop).filter((message) => message.content.includes("LOOP_DETECTED"));
    expect(detected).toHaveLength(1);
    expect(detected[0]!.content).toContain("treating this as a loop");
    expect(ofType(events, "notice").some((event) => event.text.includes("treating this as a loop"))).toBe(true);
  });

  it("同一批里重复：只执行第一条，其余跳过但照样回填", async () => {
    const ran: string[] = [];
    const { loop } = setup(
      [{ calls: [{ tool: "a" }, { tool: "a" }, { tool: "a" }] }, { content: "好" }],
      [{ id: "a", onRun: () => void ran.push("a") }],
    );

    await loop.run("连点三次");

    expect(ran).toEqual(["a"]);
    expect(toolMessages(loop)).toHaveLength(3);
    expect(
      toolMessages(loop).filter((message) => message.content.includes("LOOP_DETECTED")),
    ).toHaveLength(2);
  });

  it("错误预算耗尽 → 催模型直接回答（且只催一次）", async () => {
    const { loop, events } = setup(
      [
        { calls: [{ tool: "nope_1" }] },
        { calls: [{ tool: "nope_2" }] },
        { calls: [{ tool: "nope_3" }] },
        { content: "我答不上来" },
      ],
      [{ id: "search_query", primitive: "type" }],
      { errorBudget: 2 },
    );
    await loop.run("乱试");

    const nudges = loop.history.recent.filter(
      (message) => message.role === "user" && message.content.includes("actions have failed"),
    );
    expect(nudges).toHaveLength(1);
    expect(ofType(events, "notice").filter((event) => event.text.includes("Error budget"))).toHaveLength(1);
  });

  it("模型空回复 → 先催一次；再空就停", async () => {
    const { loop, events } = setup([{ content: "" }, { content: "" }], [{ id: "a" }], { maxNudges: 1 });
    const answer = await loop.run("在吗");
    expect(answer).toBe("(The model did not produce an answer)");
    expect(ofType(events, "notice").some((event) => event.text.includes("without calling any more actions"))).toBe(true);
    expect(
      loop.history.recent.filter((message) => message.content.includes("without calling any more actions")),
    ).toHaveLength(1);
  });

  it("达到最大轮数 → 明确告知未完成", async () => {
    const { loop } = setup(
      [{ calls: [{ tool: "a" }] }, { calls: [{ tool: "a", args: { i: 1 } }] }],
      [{ id: "a" }],
      { maxTurns: 2 },
    );
    expect(await loop.run("转圈")).toContain("Maximum turns reached");
  });

  it("取消：在下一个安全点退出", async () => {
    const { loop, events, onEvent } = (() => {
      const registry = makeRegistry([{ id: "a" }, { id: "b" }]);
      const llm = createReplayLlm([{ calls: [{ tool: "a" }] }, { calls: [{ tool: "b" }] }, { content: "不该到这" }]);
      const collected = collectEvents();
      let stop = false;
      const loop = createAgentLoop({
        registry,
        policy: allowAll,
        llm,
        settle: noSettle,
        shouldStop: () => stop,
        onEvent: (event) => {
          collected.onEvent(event);
          if (event.type === "tool_call") stop = true;
        },
      });
      return { loop, events: collected.events, onEvent: collected.onEvent };
    })();

    const answer = await loop.run("取消我");
    expect(answer).toBe("(Cancelled)");
    expect(ofType(events, "cancelled")).toHaveLength(1);
    expect(ofType(events, "tool_call")).toHaveLength(1); // 第二个动作没跑
  });
});

describe("循环：钩子（业务接管点）", () => {
  it("PreToolUse 可拦截；PostToolUse 可改写结果", async () => {
    const hooks = new HookRegistry();
    const seen: string[] = [];
    hooks.addPreToolUse(({ id }) => {
      seen.push(`pre:${id}`);
      return id === "dangerous" ? { blocked: true, reason: "风控拦截" } : undefined;
    });
    hooks.addPostToolUse(({ result }) => {
      seen.push("post");
      if ("result" in result && result.result && typeof result.result === "object") {
        (result.result as Record<string, unknown>).masked = true;
      }
    });

    const { loop, events } = setup(
      [{ calls: [{ tool: "dangerous" }, { tool: "harmless" }] }, { content: "一个被拦了" }],
      [{ id: "dangerous" }, { id: "harmless" }],
      { hooks },
    );
    await loop.run("试试");

    expect(ofType(events, "blocked")[0]!.reason).toBe("风控拦截");
    const contents = toolMessages(loop).map((message) => message.content);
    expect(contents[0]).toContain("HOOK_BLOCKED");
    expect(contents[1]).toContain("masked"); // PostToolUse 改写生效
    expect(seen).toEqual(["pre:dangerous", "pre:harmless", "post"]);
  });

  it("PostToolUse 返回新结果 → 真正替换回执（模型与事件看到的是替换后的那份）", async () => {
    const hooks = new HookRegistry();
    hooks.addPostToolUse(({ id }) =>
      id === "harmless"
        ? {
            result: {
              ok: true,
              action: { id, description: "被钩子改写过" },
              data: { masked: true },
            },
          }
        : undefined,
    );

    const { loop, events } = setup(
      [{ calls: [{ tool: "harmless" }] }, { content: "好" }],
      [{ id: "harmless", description: "原始说明" }],
      { hooks },
    );
    await loop.run("试试");

    const content = toolMessages(loop)[0]!.content;
    expect(content).toContain("被钩子改写过");
    expect(content).toContain('"masked":true');
    expect(content).not.toContain("原始说明");

    // 事件流也必须是最终结果：面板 / 业务审计不能看到被替换掉的那份
    const result = ofType(events, "tool_result")[0]!.result;
    expect(result).toMatchObject({ result: { data: { masked: true } } });
  });
});

describe("循环：轮数读数（turnsUsed）", () => {
  it("报的是**这一条指令**花了预算里的几轮：每次 run 重新数，不跨指令累加", async () => {
    const { loop } = setup(
      [{ calls: [{ tool: "ok_action" }] }, { calls: [{ tool: "ok_action" }] }, { content: "完" }],
      [{ id: "ok_action" }],
    );

    await loop.run("跑");
    expect(loop.turnsUsed).toBe(3);

    // 「累计调用」是另一个口径，由 `createLlmChain` 记进 telemetry（跨 send 一直涨）。
    // 这条只钉住轮数：上一条指令的 3 步不算进这一条（replay 脚本用完 → 一轮收口）。
    await loop.run("再跑");
    expect(loop.turnsUsed).toBe(1);
  });

  it("reset() 归零：面板上「清空」之后读数是 0，而不是上一次的残留", async () => {
    const { loop } = setup([{ content: "好" }], []);
    await loop.run("聊一句");
    expect(loop.turnsUsed).toBe(1);

    loop.reset();
    expect(loop.turnsUsed).toBe(0);
  });
});

describe("循环：折叠模板的调用（S2b）", () => {
  function foldSetup(onRun: (record: string) => void, turns: readonly ReplayTurn[]) {
    const registry = makeRegistry([
      { id: "remove@t1", onRun: () => onRun("t1") },
      { id: "remove@t2", onRun: () => onRun("t2") },
    ]);
    // 折叠的前提是「那一行有记录」：有读的行，才有写的模板
    registry.declareRecord({ id: "t1", fields: {} });
    registry.declareRecord({ id: "t2", fields: {} });
    const { events, onEvent } = collectEvents();
    const loop = createAgentLoop({ registry, policy: allowAll, llm: createReplayLlm(turns), onEvent, settle: noSettle });
    return { loop, events };
  }

  const errorOf = (events: readonly SessionEvent[]) =>
    (ofType(events, "tool_result")[0]!.result as { error: { code: string; message: string } }).error;

  it("模型给 `{ record }`，执行的是拼回来的真实 id（事件里也是人看得懂的那个 id）", async () => {
    const called: string[] = [];
    const { loop, events } = foldSetup((record) => called.push(record), [
      { calls: [{ tool: "remove", args: { record: "t2" } }] },
      { content: "删了。" },
    ]);

    expect(await loop.run("删掉第二条")).toBe("删了。");
    expect(called).toEqual(["t2"]);
    // 面板 / 审计看到的是元素级的真相：`remove@t2`，参数是模型原样给的
    expect(ofType(events, "tool_call")[0]).toMatchObject({
      id: "remove@t2",
      tool: "remove",
      args: { record: "t2" },
    });
  });

  it("一次响应里换不同的 record：不是重复调用（批量删多条不该被判成打转）", async () => {
    const called: string[] = [];
    const { loop } = foldSetup((record) => called.push(record), [
      { calls: [{ tool: "remove", args: { record: "t1" } }, { tool: "remove", args: { record: "t2" } }] },
      { content: "两条都删了。" },
    ]);
    expect(await loop.run("把前两条删掉")).toBe("两条都删了。");
    expect(called).toEqual(["t1", "t2"]);
  });

  it("record 指向不存在的行 → 可行动的错（列出这一轮有哪些 id），而且这一步在面板上看得见", async () => {
    const called: string[] = [];
    const { loop, events } = foldSetup((record) => called.push(record), [
      { calls: [{ tool: "remove", args: { record: "t404" } }] },
      { content: "换一条。" },
    ]);
    await loop.run("删掉 t404");

    expect(called).toEqual([]);
    expect(errorOf(events).code).toBe("INVALID_PARAMS");
    expect(errorOf(events).message).toContain("remove@t404");
    expect(errorOf(events).message).toContain("t1 / t2");
    // 动作并不存在，所以不发 tool_call —— 但要发结果，否则这一步是静默的
    expect(ofType(events, "tool_call")).toHaveLength(0);
    expect(ofType(events, "tool_result")).toHaveLength(1);
  });

  it("没给 record：报缺参数，并把可填的 id 列出来", async () => {
    const { loop, events } = foldSetup(() => {}, [{ calls: [{ tool: "remove" }] }, { content: "补上。" }]);
    await loop.run("删掉它");

    expect(errorOf(events).code).toBe("INVALID_PARAMS");
    expect(errorOf(events).message).toContain('Missing required parameter "record"');
    expect(errorOf(events).message).toContain("t1 / t2");
  });

  it("兼容旧路径：模型照着记录 id 拼出 `remove_t1`，执行的是同一个动作", async () => {
    const called: string[] = [];
    const { loop } = foldSetup((record) => called.push(record), [
      { calls: [{ tool: "remove@t1" }] },
      { content: "删了。" },
    ]);
    await loop.run("删掉第一条");
    expect(called).toEqual(["t1"]);
  });
});

describe("循环：观测", () => {
  it("每个动作记一条 toolCall（成功 / 失败都记）", async () => {
    const telemetry = new Telemetry();
    const { loop } = setup(
      [{ calls: [{ tool: "ok_action" }, { tool: "not_declared" }] }, { content: "完" }],
      [{ id: "ok_action" }],
      { telemetry },
    );
    await loop.run("跑");

    const summary = telemetry.summary();
    expect(summary.toolCalls).toBe(2);
    // 猜 id 也算一次调用记录，状态是 unknown —— 提示工程质量的核心指标
    expect(telemetry.events.filter((event) => event.type === "tool" && event.status === "unknown")).toHaveLength(1);
  });
});

describe("循环：页面落定（settle）", () => {
  it("每轮取快照前先 settle：上一步刚带出来的动作，下一步就调用得到", async () => {
    // 复现浏览器里的真实竞态：动作 A 让页面长出动作 B，
    // 但 B 要在「页面落定」之后才进快照（可见性 / 作用域是异步观察者更新的）。
    const registry = makeRegistry([{ id: "narrow" }]);
    const { events, onEvent } = collectEvents();
    let settled = 0;
    const loop = createAgentLoop({
      registry,
      policy: allowAll,
      llm: createReplayLlm([
        { calls: [{ tool: "narrow" }] },
        { calls: [{ tool: "row_action@row:1" }] },
        { content: "好了" },
      ]),
      onEvent,
      settle: async () => {
        settled += 1;
        // 第 2 次 settle = 第 1 轮取快照前：模拟「页面落定后」新出现的行内动作
        if (settled === 2) {
          registry.bind({
            descriptor: { id: "row_action@row:1", primitive: "click", description: "行内动作" },
            isAvailable: () => true,
            run: async () => {},
          });
        }
      },
    });

    // 不 settle 的话，第 2 轮的快照里没有 row_action@row:1，会被判成未知动作
    const answer = await loop.run("收敛后操作那一行");

    expect(answer).toBe("好了");
    expect(settled).toBeGreaterThanOrEqual(3);
    expect(ofType(events, "tool_call").map((event) => event.id)).toEqual(["narrow", "row_action@row:1"]);
    expect(ofType(events, "tool_result").every((event) => !("error" in event.result))).toBe(true);
  });

  it("同一轮里：前一步动作带出来的动作，后一步也调用得到（解析时重取快照）", async () => {
    // 真实场景：输入框是空的 → 「提交」按钮 disabled → 它压根不在本轮开头的快照里。
    // 模型却完全可能在一句话里连做两步（先填入，再提交）。
    // 这时不能按「未知动作」把它挡回去 —— 先落定，再拿新快照重新解析。
    const ran: string[] = [];
    let settled = 0;
    const registry = makeRegistry([
      {
        id: "composer_text",
        primitive: "type",
        onRun: () => {
          ran.push("composer_text");
          // 填入内容之后，「提交」才出现在页面上
          registry.bind({
            descriptor: { id: "composer_submit", primitive: "click", description: "提交" },
            isAvailable: () => true,
            run: async () => void ran.push("composer_submit"),
          });
        },
      },
    ]);
    const { events, onEvent } = collectEvents();
    const loop = createAgentLoop({
      registry,
      policy: allowAll,
      llm: createReplayLlm([
        { calls: [{ tool: "composer_text", args: { text: "周五团建" } }, { tool: "composer_submit" }] },
        { content: "加好了" },
      ]),
      onEvent,
      settle: async () => void (settled += 1),
    });

    const answer = await loop.run("新增一条「周五团建」");

    expect(answer).toBe("加好了");
    expect(ran).toEqual(["composer_text", "composer_submit"]);
    expect(ofType(events, "tool_result").every((event) => !("error" in event.result))).toBe(true);
    // 落定发生在三处：每轮取快照前（2 轮 → 2 次）、解析新名字前（1 次）；
    // 外加**每个动作**取「变更证据」的 after 快照前各一次（2 个动作 → 2 次）。
    expect(settled).toBe(5);
  });

  it("名字在最新的快照里也对不上，就还是按未知动作报错", async () => {
    const { loop } = setup(
      [{ calls: [{ tool: "不存在的动作" }] }, { content: "换个说法" }],
      [{ id: "real" }],
    );
    await loop.run("随便做点什么");

    const tool = toolMessages(loop);
    expect(tool[0]!.content).toContain("ACTION_NOT_FOUND");
    expect(tool[0]!.content).toContain("real");
  });

  it("defaultSettle 不会挂住：一轮宏任务 + 一帧（有渲染环境）", async () => {
    await expect(defaultSettle()).resolves.toBeUndefined();
  });
});

/**
 * 上一轮见过、这一轮不可用的动作，不能报「未知动作」。
 *
 * 实测病症：模型刚做成功一个动作，页面状态变了、它从清单里消失，
 * 模型转头告诉用户「这个页面没有这个功能」。报错必须说清「存在 + 为什么」。
 */
describe("报错不能把「不可用」说成「不存在」", () => {
  it("还用上一轮见过的名字 → ACTION_UNAVAILABLE + 真实原因", async () => {
    let availability: Availability = true;
    const { loop } = setup(
      [
        { calls: [{ tool: "clear_completed" }] },
        { calls: [{ tool: "clear_completed" }] },
        { content: "没有了。" },
      ],
      [
        {
          id: "clear_completed",
          description: "清除已完成",
          available: () => availability,
          onRun: () => {
            // 清完就没得清了 —— 动作从清单里消失的经典场景
            availability = { available: false, reason: "列表里已经没有已完成的待办" };
          },
        },
      ],
    );

    await loop.run("把已完成的清掉");

    const second = toolMessages(loop)[1]!.content;
    expect(second).toContain("ACTION_UNAVAILABLE");
    expect(second).toContain("列表里已经没有已完成的待办");
    expect(second).not.toContain("未知动作");
    expect(second).not.toContain("ACTION_NOT_FOUND");
    // 有确切原因时不能再猜「多半被裁剪了」：那会把模型支使去滚动 / 搜索，而它该做的是别的
    expect(second).not.toContain("先调用探索动作");
  });

  it("从没见过的名字仍然是 ACTION_NOT_FOUND（不兜底）", async () => {
    const { loop } = setup(
      [{ calls: [{ tool: "delete_everything" }] }, { content: "做不到。" }],
      [{ id: "toggle_sort", description: "切换排序" }],
    );

    await loop.run("全删了");

    const message = toolMessages(loop)[0]!.content;
    expect(message).toContain("ACTION_NOT_FOUND");
    expect(message).toContain("Available actions");
  });
});

/**
 * 「人性化延迟」：**动作和动作之间**至少停多久。
 *
 * 015 的真实反馈：一次模型响应里「填备注 → 保存」两个动作只隔一帧，
 * 弹窗唰地开完又关，人根本看不清发生了什么 —— 同一批里的动作之间是没有任何等待的。
 *
 * 语义是「上一个动作**结束**之后，下一个动作至少等这么久再开始」：
 * 目的不是限速，而是让人看清刚刚发生了什么。
 */
describe("每步之间的最小间隔（minActionIntervalMs）", () => {
  /** 假时钟 + 假睡眠：断言「等了多久」，不真的等 */
  function pacing(minActionIntervalMs: number, actionCost: number, betweenActions = 0) {
    let clock = 0;
    const slept: number[] = [];
    return {
      slept,
      now: () => clock,
      async sleep(ms: number) {
        slept.push(ms);
        clock += ms;
      },
      /** 一轮动作执行本身耗时 */
      advance: (ms: number) => (clock += ms),
      /** 动作之间框架自己的开销（settle + 取快照） */
      settle: async () => {
        clock += betweenActions;
      },
      actionCost,
    };
  }

  function makeLoop(pacer: ReturnType<typeof pacing>) {
    const ran: string[] = [];
    const { loop } = setup(
      [
        { calls: [{ tool: "a" }, { tool: "b" }, { tool: "c" }] },
        { calls: [{ tool: "d" }] },
        { content: "完成" },
      ],
      [
        { id: "a", onRun: () => { ran.push("a"); pacer.advance(pacer.actionCost); } },
        { id: "b", onRun: () => { ran.push("b"); pacer.advance(pacer.actionCost); } },
        { id: "c", onRun: () => { ran.push("c"); pacer.advance(pacer.actionCost); } },
        { id: "d", onRun: () => { ran.push("d"); pacer.advance(pacer.actionCost); } },
      ],
      {
        minActionIntervalMs: 100,
        now: pacer.now,
        sleep: pacer.sleep,
        settle: pacer.settle,
        observe: async () => pacer.settle(),
      },
    );
    return { loop, ran };
  }

  it("同一个 run 的第一个动作不等（点了立刻有反应），之后每个动作前都等", async () => {
    const pacer = pacing(100, 0);
    const { loop, ran } = makeLoop(pacer);
    await loop.run("来一遍");

    expect(ran).toEqual(["a", "b", "c", "d"]);
    expect(pacer.slept).toEqual([100, 100, 100]);
  });

  it("是「最少间隔」而不是固定睡眠：中间已经花掉的时间算得进去", async () => {
    const pacer = pacing(100, 0, 30);
    const { loop } = makeLoop(pacer);
    await loop.run("来一遍");
    // 批内：动作自己的观察窗口（observe）算在动作里 → 每步补满 100；
    // 跨轮：取快照前还有一次 settle（30ms）→ 那一步只补 70。
    expect(pacer.slept).toEqual([100, 100, 70]);
  });

  it("动作本身很慢时不额外叠成越来越慢", async () => {
    const pacer = pacing(100, 400); // 每个动作自己耗时 400ms
    const { loop } = makeLoop(pacer);
    await loop.run("来一遍");
    // 停的还是「每步之间 100ms」，不会变成 500（否则长流程会越来越拖）
    expect(pacer.slept).toEqual([100, 100, 100]);
  });

  it("默认 0：完全不等（老行为一点没变）", async () => {
    const slept: number[] = [];
    const { loop } = setup(
      [{ calls: [{ tool: "a" }, { tool: "b" }] }, { content: "完成" }],
      [{ id: "a" }, { id: "b" }],
      { sleep: async (ms) => void slept.push(ms) },
    );
    await loop.run("来一遍");
    expect(slept).toEqual([]);
  });
});

describe("循环：期望（S4）—— 「已经执行，但没等到期望的结果」", () => {
  /** 一个声明了成功判据、但判据永远不成立的动作 */
  function expectRegistry(): Registry {
    const registry = createRegistry();
    registry.bind({
      descriptor: { id: "submit", primitive: "click", description: "提交订单" },
      isAvailable: () => true,
      expect: { desc: "订单出现在列表里", check: () => false, timeout: 20 },
      run: async () => {},
    });
    return registry;
  }

  it("错误要可行动：明确「不要立刻重复同一个动作」，并附上当前可用动作", async () => {
    const registry = expectRegistry();
    const { events, onEvent } = collectEvents();
    const loop = createAgentLoop({
      registry,
      policy: allowAll,
      llm: createReplayLlm([{ calls: [{ tool: "submit" }] }, { content: "先看看列表" }]),
      onEvent,
      settle: noSettle,
    });

    await loop.run("提交订单");

    const tool = toolMessages(loop)[0]!.content;
    expect(tool).toContain("EXPECTATION_FAILED");
    // 说清「执行了」而不是「失败了」—— 否则模型的第一反应是重试（重复提交）
    expect(tool).toContain("Action submit ran");
    expect(tool).toContain("订单出现在列表里");
    expect(tool).toContain("do not repeat the same action immediately");
    expect(tool).toContain("Available actions");
    expect(ofType(events, "tool_result")).toHaveLength(1);
  });
});

describe("敏感数据：用户打的字也不出站", () => {
  it("已知敏感值出现在用户输入里 → 进模型前换成代号，事件里仍是原话", async () => {
    const registry = createRegistry();
    const phone = "13810005754";
    const token = registry.tokens.tokenOf(phone);
    const seen: { role: string; content: string }[][] = [];
    const { events, onEvent } = collectEvents();
    const loop = createAgentLoop({
      registry,
      policy: allowAll,
      llm: async (messages) => {
        seen.push(messages as { role: string; content: string }[]);
        return { content: "好的" };
      },
      onEvent,
      settle: noSettle,
    });

    await loop.run(`打给 ${phone}`);

    const user = seen[0]!.find((message) => message.role === "user")!;
    expect(user.content).toContain(token);
    expect(user.content).not.toContain(phone);
    // 用户自己看到的是原话（事件不被改写）
    expect(ofType(events, "user")[0]!.text).toBe(`打给 ${phone}`);
  });
});
