import { describe, expect, it } from "vitest";
import {
  createPlingGateway,
  toNodeHandler,
  type GatewayAuditEvent,
  type NodeRequestLike,
  type NodeResponseLike,
} from "../src/index";

const UPSTREAM = "https://llm.example/v1";
const SECRET = "server-secret-key";

function chatRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://local/api/llm/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function jsonUpstream(payload: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

describe("createPlingGateway", () => {
  it("转发到固定上游，注入服务端密钥与固定模型", async () => {
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    const gateway = createPlingGateway({
      upstream: { baseUrl: `${UPSTREAM}/`, apiKey: SECRET },
      allowAnonymous: true,
      model: "server-model",
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        seenUrl = String(input);
        seenInit = init;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "ok" } }], usage: { total_tokens: 3 } }),
          { headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    const response = await gateway.handle(
      chatRequest({ model: "client-model", messages: [{ role: "user", content: "TOP_SECRET_PROMPT" }] }),
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('"content":"ok"');
    expect(text).not.toContain(SECRET);
    expect(seenUrl).toBe("https://llm.example/v1/chat/completions");
    expect(new Headers(seenInit?.headers).get("authorization")).toBe(`Bearer ${SECRET}`);
    expect(JSON.parse(String(seenInit?.body)).model).toBe("server-model");
  });

  it("没有 authorize 也没 allowAnonymous 时 fail-closed", async () => {
    let called = 0;
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      fetch: (async () => {
        called += 1;
        return Response.json({});
      }) as typeof fetch,
    });

    const response = await gateway.handle(chatRequest({ model: "m", messages: [] }));
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("GATEWAY_MISCONFIGURED");
    expect(called).toBe(0);
  });

  it("authorize 决定是否放行，并可给上游追加用户头", async () => {
    let allowed = false;
    let upstreamUser = "";
    const audits: GatewayAuditEvent[] = [];
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        upstreamUser = new Headers(init?.headers).get("x-upstream-user") ?? "";
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
      }) as typeof fetch,
      authorize: () =>
        allowed
          ? { ok: true, user: { id: "u1" }, headers: { "x-upstream-user": "u1" } }
          : false,
      onAudit: (event) => void audits.push(event),
    });

    const denied = await gateway.handle(chatRequest({ model: "m", messages: [] }));
    expect(denied.status).toBe(401);

    allowed = true;
    const accepted = await gateway.handle(chatRequest({ model: "m", messages: [] }));
    expect(accepted.status).toBe(200);
    expect(upstreamUser).toBe("u1");
    await Promise.resolve();
    expect(audits.at(-1)?.user).toEqual({ id: "u1" });
  });

  it("SSE 流原样透传，并标记 audit.stream", async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"你"}}]}\n\ndata: [DONE]\n\n';
    const audits: GatewayAuditEvent[] = [];
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      allowAnonymous: true,
      fetch: (async () =>
        new Response(sse, {
          headers: { "content-type": "text/event-stream; charset=utf-8" },
        })) as typeof fetch,
      onAudit: (event) => void audits.push(event),
    });

    const response = await gateway.handle(
      chatRequest({ model: "m", stream: true, messages: [] }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toBe(sse);
    await Promise.resolve();
    expect(audits.at(-1)?.stream).toBe(true);
  });

  it("瞬时 5xx 会重试，成功后审计 attempts", async () => {
    let calls = 0;
    const audits: GatewayAuditEvent[] = [];
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      allowAnonymous: true,
      retry: { maxRetries: 2, baseDelayMs: 0 },
      fetch: (async () => {
        calls += 1;
        if (calls === 1) return new Response("busy", { status: 503 });
        return new Response(JSON.stringify({ choices: [{ message: { content: "retry-ok" } }] }), {
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
      onAudit: (event) => void audits.push(event),
    });

    const response = await gateway.handle(chatRequest({ model: "m", messages: [] }));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("retry-ok");
    expect(calls).toBe(2);
    await Promise.resolve();
    expect(audits.at(-1)).toMatchObject({ status: 200, attempts: 2 });
  });

  it.each([408, 425, 501, 599])("状态 %i 也按瞬时故障重试", async (status) => {
    let calls = 0;
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      allowAnonymous: true,
      retry: { maxRetries: 1, baseDelayMs: 0 },
      fetch: (async () => {
        calls += 1;
        if (calls === 1) return new Response("transient", { status });
        return Response.json({ choices: [{ message: { content: "ok" } }] });
      }) as typeof fetch,
    });

    const response = await gateway.handle(chatRequest({ model: "m", messages: [] }));

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("流式请求只在上游响应头之前重试，开始透传后不再重放", async () => {
    let calls = 0;
    const sse = 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n';
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      allowAnonymous: true,
      retry: { maxRetries: 1, baseDelayMs: 0 },
      fetch: (async () => {
        calls += 1;
        if (calls === 1) return new Response("busy", { status: 502 });
        return new Response(sse, { headers: { "content-type": "text/event-stream" } });
      }) as typeof fetch,
    });

    const response = await gateway.handle(
      chatRequest({ model: "m", stream: true, messages: [] }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(sse);
    expect(calls).toBe(2);
  });

  it("重试耗尽后返回统一的可重试错误与 attempts", async () => {
    let calls = 0;
    const audits: GatewayAuditEvent[] = [];
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      allowAnonymous: true,
      retry: { maxRetries: 1, baseDelayMs: 0 },
      fetch: (async () => {
        calls += 1;
        return new Response("gateway timeout", { status: 504 });
      }) as typeof fetch,
      onAudit: (event) => void audits.push(event),
    });

    const response = await gateway.handle(chatRequest({ model: "m", messages: [] }));
    const payload = (await response.json()) as {
      error: {
        code: string;
        retryable: boolean;
        retryExhausted?: boolean;
        attempts?: number;
        message: string;
      };
    };

    expect(response.status).toBe(504);
    expect(payload.error).toMatchObject({
      code: "UPSTREAM_TIMEOUT",
      retryable: true,
      retryExhausted: true,
      attempts: 2,
    });
    expect(payload.error.message).toContain("已尝试 2 次");
    expect(calls).toBe(2);
    await Promise.resolve();
    expect(audits.at(-1)).toMatchObject({
      status: 504,
      upstreamStatus: 504,
      attempts: 2,
      error: "UPSTREAM_TIMEOUT",
      retryable: true,
      retryExhausted: true,
    });
  });

  it("限制请求体大小，超限不调用上游", async () => {
    let called = 0;
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      allowAnonymous: true,
      maxBodyBytes: 32,
      fetch: (async () => {
        called += 1;
        return Response.json({});
      }) as typeof fetch,
    });

    const response = await gateway.handle(
      chatRequest({ model: "m", messages: [{ role: "user", content: "x".repeat(100) }] }),
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(413);
    expect(payload.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(called).toBe(0);
  });

  it("非法 JSON 返回 400", async () => {
    const gateway = createPlingGateway({ upstream: UPSTREAM, allowAnonymous: true, fetch: jsonUpstream({}) });
    const response = await gateway.handle(
      new Request("http://local/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    const payload = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_JSON");
  });

  it("方法 / 路径 / 模型白名单都按约定拒绝", async () => {
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      allowAnonymous: true,
      allowedModels: ["cheap"],
      fetch: jsonUpstream({}),
    });

    const wrongMethod = await gateway.handle(
      new Request("http://local/v1/chat/completions", { method: "GET" }),
    );
    expect(wrongMethod.status).toBe(405);

    const wrongPath = await gateway.handle(
      new Request("http://local/v1/embeddings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(wrongPath.status).toBe(404);

    const expensive = await gateway.handle(chatRequest({ model: "expensive", messages: [] }));
    const payload = (await expensive.json()) as { error: { code: string } };
    expect(expensive.status).toBe(400);
    expect(payload.error.code).toBe("MODEL_NOT_ALLOWED");

    const health = await gateway.handle(new Request("http://local/health"));
    expect(health.status).toBe(200);
  });

  it("上游错误映射成 502，且不回传上游正文 / 密钥", async () => {
    let upstreamStatus = 0;
    let calls = 0;
    const gateway = createPlingGateway({
      upstream: { baseUrl: UPSTREAM, apiKey: SECRET },
      allowAnonymous: true,
      fetch: (async () => {
        calls += 1;
        upstreamStatus = 401;
        return new Response(`bad key ${SECRET}`, { status: 401 });
      }) as typeof fetch,
    });

    const response = await gateway.handle(chatRequest({ model: "m", messages: [] }));
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(calls).toBe(1);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("bad key");
    expect(text).toContain("UPSTREAM_ERROR");
    expect(text).toContain('"retryable":false');
    expect(text).toContain('"attempts":1');
    expect(text).not.toContain("retryExhausted");
    expect(upstreamStatus).toBe(401);
  });

  it("上游超时返回 504", async () => {
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      allowAnonymous: true,
      timeoutMs: 10,
      retry: false,
      fetch: ((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        })) as typeof fetch,
    });

    const response = await gateway.handle(chatRequest({ model: "m", messages: [] }));
    const payload = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(504);
    expect(payload.error.code).toBe("UPSTREAM_TIMEOUT");
  });

  it("客户端取消后不重试", async () => {
    const controller = new AbortController();
    let calls = 0;
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      allowAnonymous: true,
      retry: { maxRetries: 2, baseDelayMs: 0 },
      fetch: (async () => {
        calls += 1;
        controller.abort();
        throw new DOMException("Aborted", "AbortError");
      }) as typeof fetch,
    });
    const request = new Request("http://local/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "m", messages: [] }),
      signal: controller.signal,
    });

    const response = await gateway.handle(request);
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(499);
    expect(payload.error.code).toBe("CLIENT_ABORTED");
    expect(calls).toBe(1);
  });

  it("审计不记录 prompt / 回复正文", async () => {
    const audits: GatewayAuditEvent[] = [];
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      allowAnonymous: true,
      fetch: jsonUpstream({ choices: [{ message: { content: "ANSWER_SECRET" } }] }),
      onAudit: (event) => void audits.push(event),
    });

    await gateway.handle(
      chatRequest({ model: "m", messages: [{ role: "user", content: "PROMPT_SECRET" }] }),
    );
    await Promise.resolve();

    const text = JSON.stringify(audits);
    expect(text).not.toContain("PROMPT_SECRET");
    expect(text).not.toContain("ANSWER_SECRET");
    expect(audits[0]).toMatchObject({ model: "m", status: 200 });
  });

  it("upstream 配置非法时创建即失败（避免 SSRF / 错误协议）", () => {
    expect(() => createPlingGateway({ upstream: "ftp://example.com", allowAnonymous: true })).toThrow();
    expect(() => createPlingGateway({ upstream: "https://u:p@example.com/v1", allowAnonymous: true })).toThrow();
  });

  it("重试配置有界且在创建时校验", () => {
    expect(() =>
      createPlingGateway({ upstream: UPSTREAM, allowAnonymous: true, retry: { maxRetries: 6 } }),
    ).toThrow(/maxRetries/);
    expect(() =>
      createPlingGateway({
        upstream: UPSTREAM,
        allowAnonymous: true,
        retry: { baseDelayMs: 100, maxDelayMs: 50 },
      }),
    ).toThrow(/maxDelayMs/);
  });
});

describe("toNodeHandler", () => {
  it("把 node:http 风格的请求 / 响应接到 Web handler", async () => {
    const gateway = createPlingGateway({
      upstream: UPSTREAM,
      allowAnonymous: true,
      fetch: jsonUpstream({ choices: [{ message: { content: "node-ok" } }] }),
    });
    const body = JSON.stringify({ model: "m", messages: [] });
    const req: NodeRequestLike = {
      method: "POST",
      url: "/api/llm/v1/chat/completions",
      headers: { host: "localhost", "content-type": "application/json" },
      async *[Symbol.asyncIterator]() {
        yield new TextEncoder().encode(body);
      },
    };
    const chunks: Uint8Array[] = [];
    const headers: Record<string, string> = {};
    const res: NodeResponseLike = {
      statusCode: 200,
      setHeader(name, value) {
        headers[name] = String(value);
      },
      write(chunk) {
        chunks.push(chunk);
        return true;
      },
      end(chunk) {
        if (chunk) chunks.push(new TextEncoder().encode(String(chunk)));
      },
    };

    await toNodeHandler(gateway)(req, res);

    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder().decode(merged);
    expect(res.statusCode).toBe(200);
    expect(headers["content-type"] ?? "").toContain("application/json");
    expect(text).toContain("node-ok");
  });
});
