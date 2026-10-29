import { createExecutor, createPolicy, createRegistry } from "@plingjs/core";
import { describe, expect, it, vi } from "vitest";
import {
  createSurface,
  SURFACE_PROTOCOL,
  SurfaceSessionError,
  type SurfaceExpose,
  type SurfaceOptions,
  type SurfaceRateLimiter,
  type SurfaceReplayGuard,
  type SurfaceSession,
  type SurfaceSessionSource,
} from "../src";

function harness() {
  const registry = createRegistry();
  const add = vi.fn(async () => {});
  const view = vi.fn(async () => {});

  registry.setPage({ path: "/todos", title: "Todo" });
  registry.bind({
    descriptor: {
      id: "todo.add",
      primitive: "type",
      description: "新增一条待办",
      kind: "write",
      params: {
        type: "object",
        properties: { text: { type: "string", description: "内容" } },
        required: ["text"],
      },
    },
    isAvailable: () => true,
    run: add,
  });
  registry.bind({
    descriptor: {
      id: "todo.view",
      primitive: "click",
      description: "查看待办详情",
      kind: "read",
    },
    isAvailable: () => true,
    run: view,
  });
  registry.bind({
    descriptor: {
      id: "todo.archived",
      primitive: "click",
      description: "归档待办（不可用）",
      kind: "write",
    },
    isAvailable: () => false,
    run: vi.fn(async () => {}),
  });
  registry.bind({
    descriptor: {
      id: "todo.delete",
      primitive: "click",
      description: "删除待办",
      kind: "danger",
      confirm: "always",
    },
    isAvailable: () => true,
    run: vi.fn(async () => {}),
  });
  registry.expose({ key: "count", description: "待办总数", read: () => 3 });
  registry.declareRecord({ id: "t1", label: "买牛奶", fields: { done: false } });

  const executor = createExecutor({ registry, policy: createPolicy(async () => true) });
  const surface = createSurface({
    registry,
    execute: (id, args) => executor.execute(id, args),
    app: "todo-demo",
  });

  return { registry, surface, add, view, executor };
}

function foldedHarness(
  expose?: readonly string[] | ((id: string) => boolean),
  options: Partial<SurfaceOptions> = {},
) {
  const registry = createRegistry();
  const remove = vi.fn(async () => {});
  for (const [id, label] of [["t1", "买牛奶"], ["t2", "写周报"]] as const) {
    registry.declareRecord({ id, label, fields: { done: false } });
    registry.bind({
      descriptor: {
        id: `remove@todo:${id}`,
        primitive: "click",
        description: `删除待办「${label}」`,
        kind: "write",
        params: {
          type: "object",
          properties: { reason: { type: "string", description: "原因" } },
        },
      },
      isAvailable: () => true,
      run: remove,
    });
  }
  const executor = createExecutor({ registry, policy: createPolicy(async () => true) });
  const surface = createSurface({
    registry,
    execute: (id, args) => executor.execute(id, args),
    ...(expose === undefined ? {} : { expose }),
    ...options,
  });
  return { registry, surface, remove };
}

function windowHarness(recordLimit = 2) {
  const registry = createRegistry();
  for (let index = 1; index <= 5; index += 1) {
    registry.declareRecord({ id: `t${index}`, label: `待办 ${index}`, fields: { index } });
  }
  const surface = createSurface({
    registry,
    execute: async () => ({ result: { ok: true } }),
    recordLimit,
  });
  return { registry, surface };
}

function sessionHarness(
  session: SurfaceSessionSource,
  expose: SurfaceExpose = ["todo.view", "todo.add"],
  options: Partial<SurfaceOptions> = {},
) {
  const registry = createRegistry();
  const view = vi.fn(async () => {});
  const add = vi.fn(async () => {});
  registry.bind({
    descriptor: { id: "todo.view", primitive: "click", description: "查看待办", kind: "read" },
    isAvailable: () => true,
    run: view,
  });
  registry.bind({
    descriptor: { id: "todo.add", primitive: "type", description: "新增待办", kind: "write" },
    isAvailable: () => true,
    run: add,
  });
  const executor = createExecutor({ registry, policy: createPolicy(async () => true) });
  const surface = createSurface({
    registry,
    execute: (id, args) => executor.execute(id, args),
    expose,
    session,
    ...options,
  });
  return { registry, surface, view, add };
}

function liveSession(overrides: Partial<SurfaceSession> = {}): SurfaceSession {
  return {
    agentId: "codex",
    sessionId: "session-a",
    userId: "user-1",
    expiresAt: Date.now() + 60_000,
    scope: ["todo.view", "todo.add"],
    ...overrides,
  };
}

const request = (id: string, method: "describe" | "invoke", extra: Record<string, unknown> = {}) => ({
  protocol: SURFACE_PROTOCOL,
  id,
  method,
  ...extra,
});

describe("Agent Surface：describe", () => {
  it("把当前可用能力映射成稳定协议字段，并保留有界上下文", () => {
    const { surface } = harness();
    const out = surface.describe();

    expect(out).toMatchObject({
      protocol: SURFACE_PROTOCOL,
      app: "todo-demo",
      context: {
        page: { path: "/todos", title: "Todo" },
        state: { count: 3 },
        records: [{ id: "t1", label: "买牛奶" }],
        recordsTotal: 1,
      },
    });

    const add = out.capabilities.find((item) => item.id === "todo.add");
    expect(add).toMatchObject({
      effect: "write",
      inputSchema: { required: ["text"] },
    });
    expect(add).not.toHaveProperty("approval");
    expect(add).not.toHaveProperty("source");
    expect(add).not.toHaveProperty("fidelity");
    expect(out.capabilities.find((item) => item.id === "todo.delete")).toMatchObject({
      effect: "destructive",
      approval: "always",
    });
    expect(out.capabilities.some((item) => item.id === "todo.archived")).toBe(false);
  });

  it("每次 describe 都读取此刻的 registry，而不是创建 Surface 时的旧快照", () => {
    const { registry, surface } = harness();
    expect(surface.describe().capabilities.some((item) => item.id === "todo.edit")).toBe(false);

    registry.bind({
      descriptor: {
        id: "todo.edit",
        primitive: "click",
        description: "编辑待办",
        kind: "write",
      },
      isAvailable: () => true,
      run: vi.fn(async () => {}),
    });

    expect(surface.describe().capabilities.some((item) => item.id === "todo.edit")).toBe(true);
  });

  it("allowlist 同时收敛 describe 与 invoke", async () => {
    const { registry, add, view } = harness();
    const executor = createExecutor({ registry, policy: createPolicy(async () => true) });
    const surface = createSurface({
      registry,
      execute: (id, args) => executor.execute(id, args),
      expose: ["todo.view"],
    });

    expect(surface.describe().capabilities.map((item) => item.id)).toEqual(["todo.view"]);

    const blocked = await surface.handle(
      request("r1", "invoke", { capability: "todo.add", input: { text: "买牛奶" } }),
    );
    expect(blocked).toMatchObject({ ok: false, error: { code: "CAPABILITY_NOT_EXPOSED" } });
    expect(add).not.toHaveBeenCalled();
    expect(view).not.toHaveBeenCalled();
  });

  it("默认只给一页记录，并明确给出下一页 offset", () => {
    const { surface } = windowHarness(2);
    const first = surface.describe();

    expect(first.context.records.map((record) => record.id)).toEqual(["t1", "t2"]);
    expect(first.context.recordIds).toEqual(["t1", "t2", "t3", "t4", "t5"]);
    expect(first.context.recordWindow).toEqual({ offset: 0, limit: 2, returned: 2, total: 5, next: 2 });

    const second = surface.describe({ offset: 2, limit: 2 });
    expect(second.context.records.map((record) => record.id)).toEqual(["t3", "t4"]);
    expect(second.context.recordWindow).toMatchObject({ offset: 2, returned: 2, next: 4 });
  });

  it("可以按记录 id 精读，不受默认分页影响", () => {
    const { surface } = windowHarness(2);
    const picked = surface.describe({ record: ["t5"] });

    expect(picked.context.records.map((record) => record.id)).toEqual(["t5"]);
    expect(picked.context.recordWindow).toMatchObject({ returned: 1, total: 5 });
    expect(picked.context.recordWindow).not.toHaveProperty("next");
  });

  it("capabilities=changed 时只回能力增量，能力变化后自动恢复完整清单", () => {
    const { registry, surface } = harness();
    const first = surface.describe({ capabilities: "changed" });
    expect(first.capabilities.some((item) => item.id === "todo.add")).toBe(true);

    const unchanged = surface.describe({ capabilities: "changed" });
    expect(unchanged.capabilities).toEqual([]);
    expect(unchanged).toMatchObject({ capabilitiesUnchanged: true, capabilitiesTotal: first.capabilities.length });

    registry.bind({
      descriptor: { id: "todo.edit", primitive: "click", description: "编辑待办", kind: "write" },
      isAvailable: () => true,
      run: vi.fn(async () => {}),
    });
    const changed = surface.describe({ capabilities: "changed" });
    expect(changed.capabilities.some((item) => item.id === "todo.edit")).toBe(true);
    expect(changed).not.toHaveProperty("capabilitiesUnchanged");
  });

  it("describe.input 在协议边界 fail-closed", async () => {
    const { surface } = windowHarness(2);
    const out = await surface.handle(request("r-input", "describe", { input: { limit: -1 } }));
    expect(out).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });

    const conflict = await surface.handle(request("r-conflict", "describe", { input: { record: "t1", limit: 1 } }));
    expect(conflict).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });

    const capabilities = await surface.handle(
      request("r-capabilities", "describe", { input: { capabilities: "sometimes" } }),
    );
    expect(capabilities).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
  });
});

describe("Agent Surface：分布式闸门 port", () => {
  it("自定义限流器可跨两个 Surface 共享预算", async () => {
    const counts = new Map<string, number[]>();
    const limiter: SurfaceRateLimiter = {
      async consume({ session, maxRequests, windowMs, now }) {
        const key = session ? `${session.agentId}:${session.sessionId}:${session.userId}` : "open";
        const recent = (counts.get(key) ?? []).filter((at) => now - at < windowMs);
        if (recent.length >= maxRequests) {
          return { allowed: false, retryAfterMs: windowMs - (now - recent[0]!) };
        }
        recent.push(now);
        counts.set(key, recent);
        return { allowed: true };
      },
    };
    const session = liveSession({ sessionId: "shared-rate" });
    const rateLimit = { maxRequests: 1, windowMs: 60_000, limiter };
    const a = sessionHarness(session, undefined, { rateLimit });
    const b = sessionHarness(session, undefined, { rateLimit });

    expect(await a.surface.handle(request("shared-rate-a", "describe"))).toMatchObject({ ok: true });
    expect(await b.surface.handle(request("shared-rate-b", "describe"))).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
  });

  it("自定义防重放守卫跨两个 Surface 只放行一次，且不产生第二次副作用", async () => {
    const seen = new Set<string>();
    const guard: SurfaceReplayGuard = {
      async reserve({ session, requestId }) {
        const key = `${session?.sessionId ?? "open"}\u0000${requestId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      },
    };
    const session = liveSession({ sessionId: "shared-replay" });
    const replay = { guard };
    const a = sessionHarness(session, undefined, { replay });
    const b = sessionHarness(session, undefined, { replay });
    const invoke = request("shared-replay-1", "invoke", {
      capability: "todo.add",
      input: { text: "买牛奶" },
    });

    const results = await Promise.all([a.surface.handle(invoke), b.surface.handle(invoke)]);
    expect(results.filter((item) => item.ok)).toHaveLength(1);
    expect(results.filter((item) => !item.ok && item.error.code === "REPLAY_DETECTED")).toHaveLength(1);
    expect(a.add.mock.calls.length + b.add.mock.calls.length).toBe(1);
  });

  it("限流或防重放适配器异常时 fail-closed，executor 不会执行", async () => {
    const rateLimited = sessionHarness(liveSession(), undefined, {
      rateLimit: {
        maxRequests: 1,
        windowMs: 60_000,
        limiter: { consume: async () => { throw new Error("redis down"); } },
      },
    });
    expect(await rateLimited.surface.handle(request("rate-down", "describe"))).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMIT_UNAVAILABLE" },
    });

    const replayBlocked = sessionHarness(liveSession(), undefined, {
      replay: {
        guard: { reserve: async () => { throw new Error("redis down"); } },
      },
    });
    expect(
      await replayBlocked.surface.handle(
        request("replay-down", "invoke", { capability: "todo.add", input: { text: "买牛奶" } }),
      ),
    ).toMatchObject({ ok: false, error: { code: "REPLAY_GUARD_UNAVAILABLE" } });
    expect(replayBlocked.add).not.toHaveBeenCalled();
  });
});

describe("Agent Surface：invoke", () => {
  it("复用 executor 执行真实业务动作，协议层不复制执行逻辑", async () => {
    const { surface, add } = harness();
    const out = await surface.handle(
      request("r2", "invoke", { capability: "todo.add", input: { text: "买牛奶" } }),
    );

    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result).toMatchObject({ result: { ok: true } });
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith({ text: "买牛奶" });
  });

  it("未在 describe 中出现的能力在协议层拒绝，不交给执行器碰运气", async () => {
    const { surface } = harness();
    const out = await surface.handle(
      request("r3", "invoke", { capability: "todo.missing", input: {} }),
    );

    expect(out).toMatchObject({ ok: false, error: { code: "CAPABILITY_NOT_EXPOSED" } });
  });

  it("成功回执带上增量：变化记录、状态与新出现的能力，不需要再 describe", async () => {
    const registry = createRegistry();
    let count = 0;
    registry.expose({ key: "count", read: () => count });
    registry.bind({
      descriptor: {
        id: "todo.add",
        primitive: "type",
        description: "新增待办",
        kind: "write",
        params: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      },
      isAvailable: () => true,
      run: async () => {
        count += 1;
        registry.declareRecord({ id: "t9", label: "新待办", fields: { title: "写周报" } });
        registry.bind({
          descriptor: { id: "todo.open", primitive: "click", description: "打开待办", kind: "read" },
          isAvailable: () => true,
          run: async () => {},
        });
      },
    });
    const executor = createExecutor({ registry, policy: createPolicy(async () => true) });
    const surface = createSurface({ registry, execute: (id, args) => executor.execute(id, args) });
    surface.describe();

    const out = await surface.handle(
      request("r-after", "invoke", { capability: "todo.add", input: { text: "写周报" } }),
    );
    expect(out).toMatchObject({
      ok: true,
      after: {
        state: { count: 1 },
        records: [{ id: "t9", label: "新待办", fields: { title: "写周报" } }],
        capabilities: [{ id: "todo.open" }],
      },
    });
  });
});

describe("Agent Surface：行内动作折叠", () => {
  it("同类行内动作收敛成一条 record 模板，而不是每行一条能力", () => {
    const { surface } = foldedHarness();
    const out = surface.describe();

    expect(out.capabilities.map((item) => item.id)).toEqual(["remove@todo"]);
    expect(out.capabilities[0]).toMatchObject({
      record: { param: "record", total: 2 },
    });
    expect(out.capabilities[0]?.record).not.toHaveProperty("offscreen");
    expect(out.capabilities[0]?.inputSchema).toMatchObject({
      properties: { reason: { type: "string" } },
    });
    expect(out.capabilities[0]?.inputSchema?.required).toBeUndefined();
    expect(out.capabilities[0]?.inputSchema?.properties).not.toHaveProperty("record");
  });

  it("invoke 用 record 拼回真实 id，并去掉协议参数后再交给 executor", async () => {
    const { surface, remove } = foldedHarness();
    const out = await surface.handle(
      request("r8", "invoke", {
        capability: "remove@todo",
        input: { record: "t2", reason: "重复" },
      }),
    );

    expect(out).toMatchObject({ ok: true, result: { result: { ok: true } } });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith({ reason: "重复" });
  });

  it("record 不在当前可引用集合里时 fail-closed", async () => {
    const { surface, remove } = foldedHarness();
    const out = await surface.handle(
      request("r9", "invoke", { capability: "remove@todo", input: { record: "t404" } }),
    );

    expect(out).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
    expect(remove).not.toHaveBeenCalled();
  });

  it("函数式 allowlist 在折叠前裁剪成员（只暴露一行时就不折叠）", () => {
    const { surface } = foldedHarness((id) => id === "remove@todo:t2");
    const out = surface.describe();

    expect(out.capabilities.map((item) => item.id)).toEqual(["remove@todo:t2"]);
  });
});

describe("Agent Surface：协议边界", () => {
  it("拒绝不兼容版本、缺失 id、未知方法与非法 input", async () => {
    const { surface } = harness();

    expect(
      await surface.handle({ protocol: "pling.surface/9", id: "r4", method: "describe" }),
    ).toMatchObject({ error: { code: "PROTOCOL_VERSION_UNSUPPORTED" } });
    expect(await surface.handle({ protocol: SURFACE_PROTOCOL, id: "", method: "describe" })).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
    expect(await surface.handle(request("r5", "unknown" as "describe"))).toMatchObject({
      error: { code: "METHOD_NOT_SUPPORTED" },
    });
    expect(
      await surface.handle(request("r6", "invoke", { capability: "todo.add", input: [1, 2] })),
    ).toMatchObject({ error: { code: "INVALID_REQUEST" } });
  });

  it("执行入口抛错时 fail-closed，不把异常漏给传输层", async () => {
    const { registry } = harness();
    const surface = createSurface({
      registry,
      execute: async () => {
        throw new Error("boom");
      },
    });

    expect(
      await surface.handle(request("r7", "invoke", { capability: "todo.add", input: {} })),
    ).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
  });
});

describe("Agent Surface：会话身份与作用域", () => {
  it("要求已验证会话；缺失时 describe / invoke 都 fail-closed，且不执行动作", async () => {
    const { surface, add } = sessionHarness(() => null);

    const described = await surface.handle(request("r-session-1", "describe"));
    expect(described).toMatchObject({ ok: false, error: { code: "SESSION_REQUIRED" } });
    expect(() => surface.describe()).toThrow(SurfaceSessionError);

    const invoked = await surface.handle(
      request("r-session-2", "invoke", { capability: "todo.add", input: { text: "买牛奶" } }),
    );
    expect(invoked).toMatchObject({ ok: false, error: { code: "SESSION_REQUIRED" } });
    expect(add).not.toHaveBeenCalled();
  });

  it("会话过期或撤销后拒绝请求，不调用 executor", async () => {
    const expired = sessionHarness(liveSession({ expiresAt: Date.now() - 1 }));
    const expiredOut = await expired.surface.handle(
      request("r-expired", "invoke", { capability: "todo.add", input: { text: "买牛奶" } }),
    );
    expect(expiredOut).toMatchObject({ ok: false, error: { code: "SESSION_EXPIRED" } });
    expect(expired.add).not.toHaveBeenCalled();

    const revoked = sessionHarness(liveSession({ revokedAt: Date.now() - 1 }));
    const revokedOut = await revoked.surface.handle(request("r-revoked", "describe"));
    expect(revokedOut).toMatchObject({ ok: false, error: { code: "SESSION_REVOKED" } });
  });

  it("会话格式非法或缺少显式 scope 时 fail-closed", async () => {
    const { surface, add } = sessionHarness(
      () => ({ ...liveSession(), scope: undefined }) as unknown as SurfaceSession,
    );

    const out = await surface.handle(
      request("r-invalid", "invoke", { capability: "todo.add", input: { text: "买牛奶" } }),
    );
    expect(out).toMatchObject({ ok: false, error: { code: "SESSION_INVALID" } });
    expect(add).not.toHaveBeenCalled();
  });

  it("会话 scope 与站点 expose 取交集：describe 不泄漏，invoke 也拒绝越权", async () => {
    const { surface, add } = sessionHarness(liveSession({ scope: ["todo.view"] }));

    expect(surface.describe().capabilities.map((item) => item.id)).toEqual(["todo.view"]);

    const out = await surface.handle(
      request("r-scope", "invoke", { capability: "todo.add", input: { text: "买牛奶" } }),
    );
    expect(out).toMatchObject({ ok: false, error: { code: "CAPABILITY_NOT_EXPOSED" } });
    expect(add).not.toHaveBeenCalled();
  });

  it("切换会话会重置增量缓存：上一个会话的能力不会被误报为 unchanged", () => {
    let current = liveSession({ sessionId: "session-a", scope: ["todo.view", "todo.add"] });
    const { surface } = sessionHarness(() => current);

    const first = surface.describe({ capabilities: "changed" });
    expect(first.capabilities.map((item) => item.id)).toEqual(["todo.view", "todo.add"]);

    current = liveSession({ sessionId: "session-b", scope: ["todo.view"] });
    const second = surface.describe({ capabilities: "changed" });
    expect(second.capabilities.map((item) => item.id)).toEqual(["todo.view"]);
    expect(second.capabilitiesUnchanged).toBeUndefined();

    current = liveSession({ sessionId: "session-a", scope: ["todo.view", "todo.add"] });
    const third = surface.describe({ capabilities: "changed" });
    expect(third.capabilities.map((item) => item.id)).toEqual(["todo.view", "todo.add"]);
    expect(third.capabilitiesUnchanged).toBeUndefined();
  });

  it("数组 scope 支持折叠模板：允许 approve@order 这一族行内能力", async () => {
    const registry = createRegistry();
    const remove = vi.fn(async () => {});
    for (const id of ["t1", "t2"]) {
      registry.declareRecord({ id, label: id, fields: {} });
      registry.bind({
        descriptor: {
          id: `remove@todo:${id}`,
          primitive: "click",
          description: `删除待办 ${id}`,
          kind: "write",
        },
        isAvailable: () => true,
        run: remove,
      });
    }
    const executor = createExecutor({ registry, policy: createPolicy(async () => true) });
    const surface = createSurface({
      registry,
      execute: (id, args) => executor.execute(id, args),
      expose: ["remove@todo"],
      session: liveSession({ scope: ["remove@todo"] }),
    });

    expect(surface.describe().capabilities.map((item) => item.id)).toEqual(["remove@todo"]);
    const out = await surface.handle(
      request("r-template", "invoke", { capability: "remove@todo", input: { record: "t2" } }),
    );
    expect(out).toMatchObject({ ok: true, result: { result: { ok: true } } });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("会话凭证不出现在协议响应里，额外字段一律丢弃", async () => {
    const secret = "do-not-leak";
    const { surface } = sessionHarness({
      ...liveSession(),
      credential: secret,
    } as SurfaceSession);

    const out = await surface.handle(request("r-no-token", "describe"));
    expect(JSON.stringify(out)).not.toContain(secret);
  });
});

describe("Agent Surface：限流、防重放与审计", () => {
  it("限流按会话隔离，超限返回 RATE_LIMITED 与 retryAfterMs", async () => {
    let current = liveSession({ sessionId: "rate-a" });
    const { surface } = sessionHarness(() => current, undefined, {
      rateLimit: { maxRequests: 2, windowMs: 60_000 },
    });

    expect(await surface.handle(request("rate-1", "describe"))).toMatchObject({ ok: true });
    expect(await surface.handle(request("rate-2", "describe"))).toMatchObject({ ok: true });
    const limited = await surface.handle(request("rate-3", "describe"));
    expect(limited).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
    expect((limited as { error: { retryAfterMs?: number } }).error.retryAfterMs).toBeGreaterThan(0);

    // 另一个会话有自己的桶，不会被上一个会话的预算拖累。
    current = liveSession({ sessionId: "rate-b" });
    expect(await surface.handle(request("rate-4", "describe"))).toMatchObject({ ok: true });
  });

  it("同一会话重复 request.id 不会产生第二次业务副作用", async () => {
    const { surface, add } = sessionHarness(liveSession(), undefined, { replay: true });
    const invoke = request("replay-1", "invoke", {
      capability: "todo.add",
      input: { text: "买牛奶" },
    });

    expect(await surface.handle(invoke)).toMatchObject({ ok: true });
    expect(await surface.handle(invoke)).toMatchObject({ ok: false, error: { code: "REPLAY_DETECTED" } });
    expect(add).toHaveBeenCalledTimes(1);

    expect(await surface.handle({ ...invoke, id: "replay-2" })).toMatchObject({ ok: true });
    expect(add).toHaveBeenCalledTimes(2);
  });

  it("并发重放也只会执行一次：request.id 在执行前就被占用", async () => {
    const { surface, add } = sessionHarness(liveSession(), undefined, { replay: true });
    const invoke = request("replay-race", "invoke", {
      capability: "todo.add",
      input: { text: "买牛奶" },
    });

    const results = await Promise.all([surface.handle(invoke), surface.handle(invoke)]);
    expect(results.filter((item) => item.ok)).toHaveLength(1);
    expect(results.filter((item) => !item.ok && item.error.code === "REPLAY_DETECTED")).toHaveLength(1);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it("防重放按会话隔离：不同会话可以使用相同 request.id", async () => {
    let current = liveSession({ sessionId: "replay-a" });
    const { surface, add } = sessionHarness(() => current, undefined, { replay: true });
    const invoke = request("shared-id", "invoke", {
      capability: "todo.add",
      input: { text: "买牛奶" },
    });

    expect(await surface.handle(invoke)).toMatchObject({ ok: true });
    current = liveSession({ sessionId: "replay-b" });
    expect(await surface.handle(invoke)).toMatchObject({ ok: true });
    expect(add).toHaveBeenCalledTimes(2);
  });

  it("审计只记元数据：含身份、能力与结果，不含输入参数", async () => {
    const secret = "13800001234";
    const onAudit = vi.fn();
    const { surface } = sessionHarness(liveSession(), undefined, { onAudit });

    const ok = await surface.handle(
      request("audit-ok", "invoke", { capability: "todo.add", input: { text: secret } }),
    );
    const denied = await surface.handle(
      request("audit-denied", "invoke", { capability: "todo.missing", input: {} }),
    );
    expect(ok.ok).toBe(true);
    expect(denied).toMatchObject({ ok: false, error: { code: "CAPABILITY_NOT_EXPOSED" } });

    const events = onAudit.mock.calls.map(([event]) => event);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      requestId: "audit-ok",
      method: "invoke",
      agentId: "codex",
      sessionId: "session-a",
      userId: "user-1",
      capability: "todo.add",
      outcome: "completed",
    });
    expect(events[1]).toMatchObject({
      requestId: "audit-denied",
      capability: "todo.missing",
      outcome: "denied",
      code: "CAPABILITY_NOT_EXPOSED",
    });
    expect(typeof events[0].durationMs).toBe("number");
    expect(JSON.stringify(events)).not.toContain(secret);
    expect(JSON.stringify(events)).not.toContain("input");
  });

  it("业务失败记为 business_error，而不是协议成功", async () => {
    const onAudit = vi.fn();
    const { surface } = sessionHarness(liveSession(), undefined, {
      onAudit,
      execute: async () => ({ error: { code: "PERMISSION_DENIED", message: "不允许" } }),
    });

    const out = await surface.handle(
      request("audit-business", "invoke", { capability: "todo.add", input: { text: "买牛奶" } }),
    );
    expect(out).toMatchObject({ ok: true, result: { error: { code: "PERMISSION_DENIED" } } });
    expect(onAudit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "business_error", code: "PERMISSION_DENIED" }),
    );
  });

  it("执行器可以附带审批证据：进入审计，但不透传给 Agent", async () => {
    const approvalId = "apc_public_approval_1";
    const execute = vi.fn(async () => ({
      result: { ok: true },
      approval: { id: approvalId },
    }));
    const onAudit = vi.fn();
    const { surface } = sessionHarness(liveSession(), undefined, { execute, onAudit });

    const out = await surface.handle(
      request("audit-approval", "invoke", { capability: "todo.add", input: { text: "买牛奶" } }),
    );
    expect(out).toMatchObject({ ok: true, result: { result: { ok: true } } });
    expect(JSON.stringify(out)).not.toContain(approvalId);
    expect(execute).toHaveBeenCalledWith(
      "todo.add",
      JSON.stringify({ text: "买牛奶" }),
      {
        requestId: "audit-approval",
        capability: "todo.add",
        session: { agentId: "codex", sessionId: "session-a", userId: "user-1" },
      },
    );
    expect(onAudit).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "audit-approval", approvalId, outcome: "completed" }),
    );
  });

  it("审批后业务失败仍保留审批关联，且执行上下文带折叠记录", async () => {
    const execute = vi.fn(async () => ({
      error: { code: "PERMISSION_DENIED" as const, message: "业务拒绝" },
      approval: { id: "apc_public_approval_2" },
    }));
    const onAudit = vi.fn();
    const { surface } = foldedHarness(undefined, { execute, onAudit });

    const out = await surface.handle(
      request("audit-folded", "invoke", { capability: "remove@todo", input: { record: "t1" } }),
    );
    expect(out).toMatchObject({ ok: true, result: { error: { code: "PERMISSION_DENIED" } } });
    expect(JSON.stringify(out)).not.toContain("apc_public_approval_2");
    expect(execute).toHaveBeenCalledWith(
      "remove@todo:t1",
      JSON.stringify({}),
      {
        requestId: "audit-folded",
        capability: "remove@todo",
        record: "t1",
        session: null,
      },
    );
    expect(onAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "audit-folded",
        capability: "remove@todo",
        record: "t1",
        approvalId: "apc_public_approval_2",
        outcome: "business_error",
      }),
    );
  });

  it("审计失败会上报错误，但不影响协议结果；错误处理自身失败也不外溢", async () => {
    const onAuditError = vi.fn(() => {
      throw new Error("logger down");
    });
    const { surface } = sessionHarness(liveSession(), undefined, {
      onAudit: () => {
        throw new Error("audit down");
      },
      onAuditError,
    });

    await expect(surface.handle(request("audit-throws", "describe"))).resolves.toMatchObject({ ok: true });
    expect(onAuditError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "audit down" }),
      expect.objectContaining({ requestId: "audit-throws", method: "describe", outcome: "completed" }),
    );
  });

  it("异步审计失败也会上报同一个事件", async () => {
    const onAuditError = vi.fn();
    const { surface } = sessionHarness(liveSession(), undefined, {
      onAudit: async () => {
        throw new Error("audit insert failed");
      },
      onAuditError,
    });

    await expect(surface.handle(request("audit-async", "describe"))).resolves.toMatchObject({ ok: true });
    await vi.waitFor(() => {
      expect(onAuditError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "audit insert failed" }),
        expect.objectContaining({ requestId: "audit-async", method: "describe", outcome: "completed" }),
      );
    });
  });

  it("限流 / 防重放配置非法时创建即失败，避免静默关闭", () => {
    expect(() =>
      sessionHarness(liveSession(), undefined, { rateLimit: { maxRequests: 0, windowMs: 60_000 } }),
    ).toThrow(/rateLimit\.maxRequests/);
    expect(() =>
      sessionHarness(liveSession(), undefined, { replay: { windowMs: 0 } }),
    ).toThrow(/replay\.windowMs/);
  });
});
