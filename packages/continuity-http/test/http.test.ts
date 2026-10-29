// @vitest-environment node

import { describe, expect, it } from "vitest";
import { ContinuityAuthorityError } from "@plingjs/agent";
import type { ResidencyEnvelope } from "@plingjs/agent";
import { createHttpContinuityAuthority } from "../src/client";
import { createContinuityHandler } from "../src/server";
import { createMemoryContinuityBackend } from "../src/testing";
import type { ContinuityBackend, ContinuityEventSource } from "../src/index";

const BASE = "http://pling.test/pling/continuity";

function envelope(sessionId: string): ResidencyEnvelope {
  return {
    version: 2,
    sessionId,
    revision: 1,
    status: "active",
    goal: "把牙医预约改到周五",
    summary: "正在处理待办",
    messages: [{ role: "user", content: "把牙医预约改到周五" }],
    events: [],
    updatedAt: Date.now(),
  };
}

function setup() {
  const backend = createMemoryContinuityBackend();
  const handler = createContinuityHandler({
    backend,
    basePath: "/pling/continuity",
    heartbeatMs: 0,
    identity: {
      resolve({ request }) {
        const userId = request.headers.get("x-test-user");
        return userId ? { userId } : null;
      },
    },
  });

  const authFetch = (userId: string): typeof fetch => async (input, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("x-test-user", userId);
    const url = input instanceof Request ? input.url : String(input);
    const request = new Request(url, { ...init, headers });
    return handler.handle(request);
  };

  return { backend, handler, authFetch };
}

function asyncBackend(backend: ContinuityBackend): ContinuityBackend {
  return {
    list: async (userId) => backend.list(userId),
    read: async (userId, sessionId) => backend.read(userId, sessionId),
    create: async (userId, input) => backend.create(userId, input),
    claim: async (userId, sessionId, input) => backend.claim(userId, sessionId, input),
    renew: async (userId, sessionId, input) => backend.renew(userId, sessionId, input),
    release: async (userId, sessionId, input) => backend.release(userId, sessionId, input),
    compareAndSwap: async (userId, sessionId, input) =>
      backend.compareAndSwap(userId, sessionId, input),
    remove: async (userId, sessionId, input) => backend.remove(userId, sessionId, input),
    subscribe: backend.subscribe?.bind(backend),
  };
}

async function codeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "NO_ERROR";
  } catch (error) {
    return error instanceof ContinuityAuthorityError ? error.code : String(error);
  }
}

describe("@plingjs/continuity-http · Web handler + browser authority", () => {
  it("完成创建、读取、CAS 与清除，并按认证用户隔离", async () => {
    const { authFetch } = setup();
    const a = createHttpContinuityAuthority({ baseUrl: BASE, fetch: authFetch("alice") });
    const b = createHttpContinuityAuthority({ baseUrl: BASE, fetch: authFetch("bob") });

    const sessionId = "task_remote_1";
    const created = await a.create({ envelope: envelope(sessionId), ownerId: "owner-a", ttlMs: 30_000 });
    expect(created).toMatchObject({ sessionId, revision: 1, ownerId: "owner-a" });
    expect((await a.list()).map((task) => task.sessionId)).toEqual([sessionId]);
    expect(await b.list()).toEqual([]);
    expect(await b.read(sessionId)).toBeNull();

    const saved = await a.compareAndSwap({
      sessionId,
      expectedRevision: 1,
      ownerId: "owner-a",
      leaseId: created.leaseId,
      next: { ...envelope(sessionId), revision: 2, summary: "已找到牙医预约" },
    });
    expect(saved).toMatchObject({ revision: 2, summary: "已找到牙医预约", ownerId: "owner-a" });

    expect(await codeOf(() => b.compareAndSwap({
      sessionId,
      expectedRevision: 2,
      ownerId: "owner-b",
      leaseId: created.leaseId,
      next: envelope(sessionId),
    }))).toBe("NOT_FOUND");

    await a.remove({ sessionId, ownerId: "owner-a", leaseId: created.leaseId });
    expect(await a.read(sessionId)).toBeNull();
  });

  it("有 live lease 时不能无 preempt 抢占；显式接管后旧 owner 立即失权", async () => {
    const { authFetch } = setup();
    const a = createHttpContinuityAuthority({ baseUrl: BASE, fetch: authFetch("demo") });
    const b = createHttpContinuityAuthority({ baseUrl: BASE, fetch: authFetch("demo") });
    const sessionId = "task_takeover";
    const created = await a.create({ envelope: envelope(sessionId), ownerId: "owner-a", ttlMs: 30_000 });

    expect(await codeOf(() => b.claim({
      sessionId,
      expectedRevision: created.revision,
      ownerId: "owner-b",
      ttlMs: 30_000,
    }))).toBe("LEASE_HELD");

    const taken = await b.claim({
      sessionId,
      expectedRevision: created.revision,
      ownerId: "owner-b",
      ttlMs: 30_000,
      preempt: true,
    });
    expect(taken).toMatchObject({ ownerId: "owner-b", revision: 2 });
    expect(await codeOf(() => a.renew({
      sessionId,
      ownerId: "owner-a",
      leaseId: created.leaseId,
      ttlMs: 30_000,
    }))).toBe("OWNER_MISMATCH");

    expect(await codeOf(() => b.compareAndSwap({
      sessionId,
      expectedRevision: created.revision,
      ownerId: "owner-b",
      leaseId: taken.leaseId,
      next: envelope(sessionId),
    }))).toBe("REVISION_CONFLICT");
  });

  it("身份失败与网络失败都映射成明确的终止态", async () => {
    const { handler } = setup();
    const unauthorized = await handler.handle(new Request(`${BASE}/tasks`));
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });

    const offline = createHttpContinuityAuthority({
      baseUrl: BASE,
      fetch: async () => {
        throw new TypeError("offline");
      },
    });
    expect(await codeOf(() => offline.list())).toBe("STORE_UNAVAILABLE");
  });

  it("请求体里的 userId 不能越过认证身份", async () => {
    const { authFetch } = setup();
    const alice = createHttpContinuityAuthority({ baseUrl: BASE, fetch: authFetch("alice") });
    const bob = createHttpContinuityAuthority({ baseUrl: BASE, fetch: authFetch("bob") });
    const response = await authFetch("alice")(`${BASE}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "bob",
        envelope: envelope("task_identity"),
        ownerId: "owner-a",
        ttlMs: 30_000,
      }),
    });
    expect(response.status).toBe(200);
    expect((await alice.list()).map((task) => task.sessionId)).toEqual(["task_identity"]);
    expect(await bob.list()).toEqual([]);
  });

  it("handler 会 await 异步后端，Postgres 等实现无需改成同步", async () => {
    const memory = createMemoryContinuityBackend();
    const backend = asyncBackend(memory);
    const handler = createContinuityHandler({
      backend,
      basePath: "/pling/continuity",
      heartbeatMs: 0,
      identity: { resolve: () => ({ userId: "async-user" }) },
    });
    const request: typeof fetch = async (input, init = {}) => handler.handle(
      new Request(input instanceof Request ? input.url : String(input), init),
    );
    const authority = createHttpContinuityAuthority({ baseUrl: BASE, fetch: request });
    const created = await authority.create({
      envelope: envelope("task_async"),
      ownerId: "owner-async",
      ttlMs: 30_000,
    });
    expect((await authority.list())[0]).toMatchObject({ sessionId: "task_async", revision: 1 });
    await expect(authority.renew({
      sessionId: "task_async",
      ownerId: "owner-async",
      leaseId: created.leaseId,
      ttlMs: 30_000,
    })).resolves.toMatchObject({ sessionId: "task_async" });
    await expect(authority.release({
      sessionId: "task_async",
      ownerId: "owner-async",
      leaseId: created.leaseId,
    })).resolves.toBeUndefined();
  });

  it("SSE 只广播租约元数据，不广播检查点正文", async () => {
    const { handler, authFetch } = setup();
    const response = await handler.handle(
      new Request(`${BASE}/events`, { headers: { "x-test-user": "demo" } }),
    );
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    expect(decoder.decode((await reader.read()).value)).toContain("event: ready");

    const client = createHttpContinuityAuthority({ baseUrl: BASE, fetch: authFetch("demo") });
    await client.create({ envelope: envelope("task_sse"), ownerId: "owner-a", ttlMs: 30_000 });
    const update = decoder.decode((await reader.read()).value);
    expect(update).toContain("event: continuity");
    expect(update).toContain("task_sse");
    expect(update).not.toContain("把牙医预约改到周五");
    await reader.cancel();
  });

  it("没有订阅端口的后端仍可提供 SSE ready 与正常 HTTP 操作", async () => {
    const backend = asyncBackend(createMemoryContinuityBackend());
    delete backend.subscribe;
    const handler = createContinuityHandler({
      backend,
      basePath: "/pling/continuity",
      heartbeatMs: 0,
      identity: { resolve: () => ({ userId: "demo" }) },
    });
    const response = await handler.handle(new Request(`${BASE}/events`));
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("event: ready");
    await reader.cancel();
  });

  it("客户端 SSE 解析失败不会影响 authority 的事实来源", () => {
    let listener: ((event: MessageEvent<string>) => void) | undefined;
    const source: ContinuityEventSource = {
      addEventListener(type, next) {
        if (type === "continuity") listener = next;
      },
      close() {},
    };
    const authority = createHttpContinuityAuthority({
      baseUrl: BASE,
      fetch: async () => new Response("{}", { status: 200 }),
      createEventSource: () => source,
    });
    const changes: string[] = [];
    authority.subscribe!((change) => changes.push(change.sessionId));
    listener!({ data: "not-json" } as MessageEvent<string>);
    listener!({ data: JSON.stringify({ type: "lease", sessionId: "task_1", revision: 2, status: "active", at: 1 }) } as MessageEvent<string>);
    expect(changes).toEqual(["task_1"]);
  });

  it("错误请求体返回 422，未知路由返回 404", async () => {
    const { authFetch } = setup();
    const invalid = await authFetch("demo")(`${BASE}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "[]",
    });
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({ error: { code: "INVALID_STATE" } });

    const missing = await authFetch("demo")(`${BASE}/missing`);
    expect(missing.status).toBe(404);
  });
});
