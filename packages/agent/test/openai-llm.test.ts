import { describe, expect, it } from "vitest";
import type { Llm } from "@plingjs/core";
import { createOpenAiLlm, toOpenAiMessages } from "../src/llm/openai";
import { LlmError } from "../src/retry";

// 真模型适配器的测试：**不发真请求**，把 fetch 换成假的，断言「发出去的是什么、收回来的怎么解析」。
const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

/** 拼一个 SSE 响应体：chunks 是**原始分片**，可以故意把一个 JSON 切断，验证跨片拼行 */
const sseResponse = (chunks: readonly string[]): Response => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
};

const delta = (text: string): string => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

function capture(respond: () => Response) {
  const seen: { url: string; init: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    seen.push({ url: String(input), init: init ?? {} });
    return respond();
  };
  return { seen, fetchImpl };
}

describe("createOpenAiLlm：请求怎么发", () => {
  it("打到 baseUrl + /chat/completions，带 Bearer，默认不带 tools 字段", async () => {
    const { seen, fetchImpl } = capture(() => jsonResponse({ choices: [{ message: { content: "你好" } }] }));
    const llm = createOpenAiLlm({
      baseUrl: "https://api.example.com/v1/",
      model: "test-model",
      apiKey: "sk-test",
      temperature: 0.3,
      maxTokens: 100,
      fetch: fetchImpl,
    });

    const result = await llm(
      [
        { role: "system", content: "S" },
        { role: "user", content: "U" },
      ],
      [],
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe("https://api.example.com/v1/chat/completions");
    const headers = seen[0]!.init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.authorization).toBe("Bearer sk-test");

    const body = JSON.parse(String(seen[0]!.init.body)) as Record<string, unknown>;
    expect(body.model).toBe("test-model");
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(100);
    expect(body.messages).toEqual([
      { role: "system", content: "S" },
      { role: "user", content: "U" },
    ]);
    expect("tools" in body).toBe(false);
    expect(result).toEqual({ content: "你好" });
  });

  it("有工具时带上 tools 与 tool_choice", async () => {
    const { seen, fetchImpl } = capture(() => jsonResponse({ choices: [{ message: { content: "" } }] }));
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    await llm([{ role: "user", content: "U" }], [
      { type: "function", function: { name: "add_todo", description: "加一条", parameters: { type: "object" } } },
    ]);

    const body = JSON.parse(String(seen[0]!.init.body)) as Record<string, unknown>;
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toBe("auto");
    // 没有 key 时不该凭空造一个 Authorization
    expect((seen[0]!.init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("模型返回 tool_calls 时翻译成内部结构；缺 id / 缺参数都有兜底", async () => {
    const { fetchImpl } = capture(() =>
      jsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { id: "call_1", function: { name: "add_todo", arguments: '{"text":"遛狗"}' } },
                { function: { name: "no_args" } },
              ],
            },
          },
        ],
      }),
    );
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    const result = await llm([{ role: "user", content: "U" }], []);

    expect(result.content).toBe("");
    expect(result.toolCalls).toEqual([
      { id: "call_1", name: "add_todo", arguments: '{"text":"遛狗"}' },
      { id: "call_1", name: "no_args", arguments: "{}" },
    ]);
  });

  it("原生 tool_calls 缺失时解析 DSML 文本调用，协议标记不进入回答", async () => {
    const content = [
      "我来添加。",
      "<｜｜DSML｜｜ calls>",
      '<｜｜DSML｜｜ invoke name="add_task">',
      '<｜｜DSML｜｜ parameter name="text" string="true">回复客户</｜｜DSML｜｜ parameter>',
      "</｜｜DSML｜｜ invoke>",
      "</｜｜DSML｜｜ calls>",
    ].join("\n");
    const { fetchImpl } = capture(() => jsonResponse({ choices: [{ message: { content } }] }));
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    const result = await llm([{ role: "user", content: "添加一条待办" }], [
      { type: "function", function: { name: "add_task", description: "加一条", parameters: { type: "object" } } },
    ]);

    expect(result.content).toBe("我来添加。");
    expect(result.toolCalls).toEqual([
      { id: "call_dsml_0", name: "add_task", arguments: '{"text":"回复客户"}' },
    ]);
  });

  it("DSML 支持多个 invoke 与字符串 / 数字 / 布尔 / JSON 参数", async () => {
    const content = [
      "<｜｜DSML｜｜ tool_calls>",
      '<｜｜DSML｜｜ invoke name="add_task">',
      '<｜｜DSML｜｜ parameter name="text" string="true">回复客户</｜｜DSML｜｜ parameter>',
      "</｜｜DSML｜｜ invoke>",
      '<｜｜DSML｜｜ invoke name="rank_task">',
      '<｜｜DSML｜｜ parameter name="position" string="false">2</｜｜DSML｜｜ parameter>',
      '<｜｜DSML｜｜ parameter name="urgent" string="false">true</｜｜DSML｜｜ parameter>',
      '<｜｜DSML｜｜ parameter name="meta" string="false">{"source":"chat"}</｜｜DSML｜｜ parameter>',
      "</｜｜DSML｜｜ invoke>",
      "</｜｜DSML｜｜ tool_calls>",
    ].join("\n");
    const { fetchImpl } = capture(() => jsonResponse({ choices: [{ message: { content } }] }));
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    const result = await llm([], [
      { type: "function", function: { name: "add_task", description: "加一条", parameters: { type: "object" } } },
      { type: "function", function: { name: "rank_task", description: "排序", parameters: { type: "object" } } },
    ]);

    expect(result.content).toBe("");
    expect(result.toolCalls).toEqual([
      { id: "call_dsml_0", name: "add_task", arguments: '{"text":"回复客户"}' },
      { id: "call_dsml_1", name: "rank_task", arguments: '{"position":2,"urgent":true,"meta":{"source":"chat"}}' },
    ]);
  });

  it("原生 tool_calls 存在时优先使用原生字段，只清理正文里的 DSML", async () => {
    const content = [
      "开始处理。",
      "<｜｜DSML｜｜ calls>",
      '<｜｜DSML｜｜ invoke name="add_task">',
      '<｜｜DSML｜｜ parameter name="text" string="true">不应执行</｜｜DSML｜｜ parameter>',
      "</｜｜DSML｜｜ invoke>",
      "</｜｜DSML｜｜ calls>",
    ].join("\n");
    const { fetchImpl } = capture(() =>
      jsonResponse({
        choices: [
          {
            message: {
              content,
              tool_calls: [{ id: "call_native", function: { name: "remove_task", arguments: '{"id":"t1"}' } }],
            },
          },
        ],
      }),
    );
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    const result = await llm([], [
      { type: "function", function: { name: "add_task", description: "加一条", parameters: { type: "object" } } },
    ]);

    expect(result.content).toBe("开始处理。");
    expect(result.toolCalls).toEqual([{ id: "call_native", name: "remove_task", arguments: '{"id":"t1"}' }]);
  });

  it("没有可用工具时只清理 DSML，不凭空执行文本调用", async () => {
    const content = [
      "示例：",
      "<｜｜DSML｜｜ calls>",
      '<｜｜DSML｜｜ invoke name="add_task">',
      '<｜｜DSML｜｜ parameter name="text" string="true">回复客户</｜｜DSML｜｜ parameter>',
      "</｜｜DSML｜｜ invoke>",
      "</｜｜DSML｜｜ calls>",
    ].join("\n");
    const { fetchImpl } = capture(() => jsonResponse({ choices: [{ message: { content } }] }));
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    const result = await llm([], []);

    expect(result).toEqual({ content: "示例：" });
  });
});

describe("createOpenAiLlm：消息怎么翻", () => {
  it("assistant 的工具调用要把 content 置为 null，tool 要带 tool_call_id", () => {
    const messages = toOpenAiMessages([
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "f", arguments: "{}" }] },
      { role: "tool", content: '{"ok":true}', toolCallId: "c1", name: "f" },
    ]);

    expect(messages).toEqual([
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "c1", type: "function", function: { name: "f", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "c1", content: '{"ok":true}' },
    ]);
  });
});

describe("createOpenAiLlm：错误怎么分类", () => {
  it("429 / 5xx 可重试，400 / 401 不可重试", async () => {
    const make = (status: number) =>
      createOpenAiLlm({
        baseUrl: "/llm/v1",
        model: "m",
        fetch: (async () => new Response("boom", { status })) as typeof fetch,
      });

    await expect(make(429)([], [])).rejects.toMatchObject({ status: 429, retryable: true });
    await expect(make(500)([], [])).rejects.toMatchObject({ status: 500, retryable: true });
    await expect(make(400)([], [])).rejects.toMatchObject({ status: 400, retryable: false });
    await expect(make(401)([], [])).rejects.toMatchObject({ status: 401, retryable: false });
  });

  it("网关重试耗尽后，OpenAI 适配器保留 retryExhausted 并停止重试分类", async () => {
    const llm = createOpenAiLlm({
      baseUrl: "/llm/v1",
      model: "m",
      fetch: (async () =>
        jsonResponse(
          {
            error: {
              code: "UPSTREAM_TIMEOUT",
              message: "上游超时",
              retryable: true,
              retryExhausted: true,
              attempts: 3,
            },
          },
          504,
        )) as typeof fetch,
    });

    await expect(llm([], [])).rejects.toMatchObject({
      status: 504,
      retryable: false,
      retryExhausted: true,
    });
  });

  it("网络层失败标记为可重试", async () => {
    const llm = createOpenAiLlm({
      baseUrl: "/llm/v1",
      model: "m",
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
    });

    const error = await llm([], []).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).retryable).toBe(true);
    expect((error as LlmError).message).toContain("CORS");
  });

  it("返回体里没有 choices 时给出可读错误（不该重试）", async () => {
    const llm = createOpenAiLlm({
      baseUrl: "/llm/v1",
      model: "m",
      fetch: (async () => jsonResponse({ error: { message: "额度不足" } })) as typeof fetch,
    });

    await expect(llm([], [])).rejects.toThrow(/额度不足/);
  });
});

describe("createOpenAiLlm：流式", () => {
  it("给了 onDelta 就走 SSE：增量逐段回调，最后拼成完整 content", async () => {
    const { seen, fetchImpl } = capture(() => sseResponse([delta("你"), delta("好"), "data: [DONE]\n\n"]));
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    const chunks: string[] = [];
    const result = await llm([{ role: "user", content: "U" }], [], { onDelta: (text) => chunks.push(text) });

    expect(chunks).toEqual(["你", "好"]);
    expect(result).toEqual({ content: "你好" });
    expect(JSON.parse(String(seen[0]!.init.body))).toMatchObject({ stream: true });
  });

  it("网络分片不按行边界切也没事（半行留回缓冲）", async () => {
    const line = `data: {"choices":[{"delta":{"content":"好"}}]}\n\n`;
    const { fetchImpl } = capture(() => sseResponse([delta("你"), line.slice(0, 20), line.slice(20), "data: [DONE]\n\n"]));
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    const chunks: string[] = [];
    const result = await llm([], [], { onDelta: (text) => chunks.push(text) });

    expect(chunks).toEqual(["你", "好"]);
    expect(result.content).toBe("你好");
  });

  it("工具调用的参数是跨块拼起来的，id / name 只在第一块给", async () => {
    const call = (payload: unknown): string => `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [payload] } }] })}\n\n`;
    const { fetchImpl } = capture(() =>
      sseResponse([
        call({ index: 0, id: "call_1", function: { name: "add_todo", arguments: '{"text":' } }),
        call({ index: 0, function: { arguments: '"遛狗"}' } }),
        "data: [DONE]\n\n",
      ]),
    );
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    const result = await llm([], [], { onDelta: () => undefined });

    expect(result.content).toBe("");
    expect(result.toolCalls).toEqual([{ id: "call_1", name: "add_todo", arguments: '{"text":"遛狗"}' }]);
  });

  it("流式 DSML 即使被拆进多个 chunk，也不会把协议标记透给用户", async () => {
    const content = [
      "正在添加。",
      "<｜｜DSML｜｜ calls>",
      '<｜｜DSML｜｜ invoke name="add_task">',
      '<｜｜DSML｜｜ parameter name="text" string="true">回复客户</｜｜DSML｜｜ parameter>',
      "</｜｜DSML｜｜ invoke>",
      "</｜｜DSML｜｜ calls>",
    ].join("\n");
    const chunks = content.match(/[\s\S]{1,3}/g) ?? [];
    const { fetchImpl } = capture(() => sseResponse([...chunks.map(delta), "data: [DONE]\n\n"]));
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    const streamed: string[] = [];
    const result = await llm([], [
      { type: "function", function: { name: "add_task", description: "加一条", parameters: { type: "object" } } },
    ], { onDelta: (text) => streamed.push(text) });

    expect(streamed.join("")).toBe("正在添加。\n");
    expect(streamed.join("")).not.toContain("DSML");
    expect(result.content).toBe("正在添加。");
    expect(result.toolCalls).toEqual([
      { id: "call_dsml_0", name: "add_task", arguments: '{"text":"回复客户"}' },
    ]);
  });

  it("不完整的 DSML 片段不会被当作正常回答显示", async () => {
    const { fetchImpl } = capture(() => sseResponse([delta("这不是调用"), delta(" <｜｜DSML"), delta("｜｜ invoke name="), "data: [DONE]\n\n"]));
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    const streamed: string[] = [];
    const result = await llm([], [
      { type: "function", function: { name: "add_task", description: "加一条", parameters: { type: "object" } } },
    ], { onDelta: (text) => streamed.push(text) });

    expect(streamed.join("").trimEnd()).toBe("这不是调用");
    expect(result).toEqual({ content: "这不是调用" });
  });

  it("stream: false 时不发 SSE 请求，也不回调增量", async () => {
    const { seen, fetchImpl } = capture(() => jsonResponse({ choices: [{ message: { content: "整体返回" } }] }));
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl, stream: false });

    const chunks: string[] = [];
    const result = await llm([], [], { onDelta: (text) => chunks.push(text) });

    expect(chunks).toEqual([]);
    expect(result.content).toBe("整体返回");
    expect(JSON.parse(String(seen[0]!.init.body))).not.toHaveProperty("stream");
  });

  it("流里夹着 keep-alive 注释行不影响解析", async () => {
    const { fetchImpl } = capture(() => sseResponse([": keep-alive\n\n", delta("嗨"), "\n", "data: [DONE]\n\n"]));
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: fetchImpl });

    const result = await llm([], [], { onDelta: () => undefined });
    expect(result.content).toBe("嗨");
  });
});

describe("createOpenAiLlm：取消与超时", () => {
  const hangingFetch = (onAbort?: () => void): typeof fetch =>
    ((_input: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          onAbort?.();
          reject(new DOMException("Aborted", "AbortError"));
        });
      })) as typeof fetch;

  it("外部 signal 一 abort，请求立刻停下来，而且标成「取消」而不是「故障」", async () => {
    let aborted = false;
    const llm: Llm = createOpenAiLlm({
      baseUrl: "/llm/v1",
      model: "m",
      fetch: hangingFetch(() => {
        aborted = true;
      }),
    });
    const controller = new AbortController();

    const pending = llm([], [], { signal: controller.signal });
    controller.abort();
    const error = await pending.catch((caught: unknown) => caught);

    expect(aborted).toBe(true);
    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).aborted).toBe(true);
    expect((error as LlmError).retryable).toBe(false);
  });

  it("已经取消的 signal 直接拒绝，连请求都不发", async () => {
    let called = false;
    const llm = createOpenAiLlm({
      baseUrl: "/llm/v1",
      model: "m",
      fetch: (async () => {
        called = true;
        return jsonResponse({});
      }) as typeof fetch,
    });
    const controller = new AbortController();
    controller.abort();

    await expect(llm([], [], { signal: controller.signal })).rejects.toMatchObject({ aborted: true });
    expect(called).toBe(false);
  });

  it("超时是可重试的（和「用户取消」分开）", async () => {
    const llm = createOpenAiLlm({ baseUrl: "/llm/v1", model: "m", fetch: hangingFetch(), timeoutMs: 20 });

    const error = await llm([], []).catch((caught: unknown) => caught);

    expect((error as LlmError).aborted).toBe(false);
    expect((error as LlmError).retryable).toBe(true);
    expect((error as Error).message).toContain("超时");
  });
});
