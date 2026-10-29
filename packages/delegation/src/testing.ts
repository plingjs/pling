import { isDelegationError } from "./errors";
import { randomId } from "./tokens";
import type {
  DelegationCredentialView,
  DelegationEventBus,
  DelegationInvalidationEvent,
  DelegationStore,
  IssuedDelegation,
} from "./types";

export interface DelegationConformanceCheck {
  name: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface DelegationConformanceReport {
  ok: boolean;
  checks: DelegationConformanceCheck[];
}

export interface DelegationStoreConformanceOptions {
  /** 正常凭证使用的 TTL，默认 60 秒。 */
  ttlMs?: number;
  /** 过期检查使用的 TTL，默认 1100ms，避免数据库只存秒级时间时误判。 */
  expiryTtlMs?: number;
  /** 过期检查等待时长；默认比 expiryTtlMs 多 200ms。 */
  expiryWaitMs?: number;
  /** 用于和已有测试数据隔离的用户前缀。 */
  userIdPrefix?: string;
  agentId?: string;
  scope?: readonly string[];
  sleep?: (ms: number) => Promise<void>;
}

export interface DelegationEventBusConformanceOptions {
  userIdPrefix?: string;
  agentId?: string;
}

export class DelegationConformanceError extends Error {
  readonly report: DelegationConformanceReport;

  constructor(report: DelegationConformanceReport) {
    const failures = report.checks
      .filter((check) => !check.ok)
      .map((check) => `${check.name}: ${check.error ?? "未通过"}`)
      .join("\n");
    super(`委托适配器一致性检查未通过\n${failures}`);
    this.name = "DelegationConformanceError";
    this.report = report;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function errorCode(error: unknown): string | null {
  if (isDelegationError(error)) return error.code;
  if (error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return null;
}

function describeError(error: unknown): string {
  const code = errorCode(error);
  const message = error instanceof Error ? error.message : String(error);
  return code ? `${code}: ${message}` : message;
}

async function expectCode(run: () => unknown | Promise<unknown>, expected: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    const actual = errorCode(error);
    assert(actual === expected, `期望 ${expected}，实际 ${actual ?? "无稳定错误码"}（${describeError(error)}）`);
    return;
  }
  throw new Error(`期望抛出 ${expected}，实际成功`);
}

function assertIssued(value: IssuedDelegation, label: string): void {
  assert(value && typeof value === "object", `${label} 必须返回对象`);
  assert(typeof value.token === "string" && value.token.length >= 24, `${label} 的 token 必须是足够长的字符串`);
  for (const field of ["credentialId", "delegationId", "sessionId", "userId", "agentId"] as const) {
    assert(typeof value[field] === "string" && value[field].length > 0, `${label} 缺少 ${field}`);
  }
  assert(Array.isArray(value.scope), `${label} 的 scope 必须是数组`);
  assert(Number.isFinite(value.issuedAt), `${label} 缺少有效 issuedAt`);
  assert(Number.isFinite(value.expiresAt) && value.expiresAt > value.issuedAt, `${label} 缺少有效 expiresAt`);
}

function assertSafeView(view: DelegationCredentialView, token: string, label: string): void {
  assert(view && typeof view === "object", `${label} 必须返回对象`);
  assert(!JSON.stringify(view).includes(token), `${label} 泄露了 bearer token`);
  const pending: unknown[] = [view];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    for (const [key, child] of Object.entries(current)) {
      assert(!/token|hash/i.test(key), `${label} 泄露了 ${key} 字段`);
      if (child && typeof child === "object") pending.push(child);
    }
  }
}

function sameScope(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function viewOf(issued: IssuedDelegation): Omit<IssuedDelegation, "token"> {
  const { token: _token, ...view } = issued;
  return view;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runChecks(
  checks: DelegationConformanceCheck[],
  name: string,
  run: () => unknown | Promise<unknown>,
): Promise<void> {
  const startedAt = Date.now();
  try {
    await run();
    checks.push({ name, ok: true, durationMs: Date.now() - startedAt });
  } catch (error) {
    checks.push({ name, ok: false, durationMs: Date.now() - startedAt, error: describeError(error) });
  }
}

/**
 * 在测试环境里验证一个 `DelegationStore` 是否满足包的生命周期契约。
 *
 * 这会签发若干一次性测试凭证，不提供删除方法；请使用测试数据库、临时命名空间或可丢弃的
 * 本地文件，不要对生产存储运行。
 */
export async function runDelegationStoreConformance(
  store: DelegationStore,
  options: DelegationStoreConformanceOptions = {},
): Promise<DelegationConformanceReport> {
  const checks: DelegationConformanceCheck[] = [];
  const runId = randomId("conf");
  const user = (label: string): string => `${options.userIdPrefix ?? "pling-conformance"}-${runId}-${label}`;
  const agentId = options.agentId ?? "conformance-agent";
  const requestedScope = options.scope ?? ["orders:read", "orders:write", "orders:read"];
  const normalizedScope = [...new Set(requestedScope)];
  const ttlMs = options.ttlMs ?? 60_000;
  const expiryTtlMs = options.expiryTtlMs ?? 1_100;
  const expiryWaitMs = options.expiryWaitMs ?? expiryTtlMs + 200;
  const sleep = options.sleep ?? defaultSleep;

  let issued: IssuedDelegation | undefined;
  let rotated: IssuedDelegation | undefined;
  let expiring: IssuedDelegation | undefined;
  let secondIssue: IssuedDelegation | undefined;

  await runChecks(checks, "issue:normalizes-scope", async () => {
    issued = await store.issue({ userId: user("owner"), agentId, scope: requestedScope, ttlMs });
    assertIssued(issued, "issue");
    assert(sameScope(issued.scope, normalizedScope), `scope 应去重并保持首次出现顺序，实际 ${JSON.stringify(issued.scope)}`);
  });

  await runChecks(checks, "issue:returns-safe-view", async () => {
    assert(issued, "前置 issue 失败");
    assertSafeView(await store.introspect({ token: issued.token }), issued.token, "introspect");
  });

  await runChecks(checks, "issue:unique-identities", async () => {
    assert(issued, "前置 issue 失败");
    secondIssue = await store.issue({ userId: user("second"), agentId, scope: ["orders:read"], ttlMs });
    assertIssued(secondIssue, "second issue");
    assert(secondIssue.token !== issued.token, "两次签发不能复用 token");
    assert(secondIssue.credentialId !== issued.credentialId, "两次签发不能复用 credentialId");
    assert(secondIssue.delegationId !== issued.delegationId, "两次签发不能复用 delegationId");
    assert(secondIssue.sessionId !== issued.sessionId, "两次签发不能复用 sessionId");
  });

  await runChecks(checks, "refresh:rotates-token-and-preserves-identity", async () => {
    assert(issued, "前置 issue 失败");
    rotated = await store.refresh({ token: issued.token, userId: issued.userId });
    assertIssued(rotated, "refresh");
    assert(rotated.token !== issued.token, "refresh 必须返回新 token");
    for (const field of ["userId", "agentId", "sessionId", "delegationId", "expiresAt"] as const) {
      assert(rotated[field] === issued[field], `refresh 必须保持 ${field}`);
    }
    assert(sameScope(rotated.scope, issued.scope), "refresh 必须保持 scope");
    await expectCode(() => store.introspect({ token: issued!.token }), "DELEGATION_REVOKED");
    const view = await store.introspect({ token: rotated.token });
    assert(view.credentialId === rotated.credentialId, "轮换后的 token 必须可 introspect");
    assert(viewOf(rotated).credentialId === view.credentialId, "轮换结果与 introspect 视图不一致");
  });

  await runChecks(checks, "refresh:rejects-cross-user-without-mutation", async () => {
    assert(rotated, "前置 refresh 失败");
    await expectCode(
      () => store.refresh({ token: rotated!.token, userId: user("intruder") }),
      "DELEGATION_BINDING_MISMATCH",
    );
    await store.introspect({ token: rotated.token });
  });

  await runChecks(checks, "revoke:rejects-cross-user-without-mutation", async () => {
    assert(rotated, "前置 refresh 失败");
    await expectCode(
      () => store.revoke({ token: rotated!.token, userId: user("intruder") }),
      "DELEGATION_BINDING_MISMATCH",
    );
    await store.introspect({ token: rotated.token });
  });

  await runChecks(checks, "revoke:invalidates-immediately", async () => {
    assert(rotated, "前置 refresh 失败");
    const revoked = await store.revoke({ token: rotated.token, userId: rotated.userId });
    assert(revoked.credentialId === rotated.credentialId, "revoke 返回了错误的 credentialId");
    assert(Number.isFinite(revoked.revokedAt), "revoke 结果必须带 revokedAt");
    await expectCode(() => store.introspect({ token: rotated!.token }), "DELEGATION_REVOKED");
  });

  await runChecks(checks, "introspect:rejects-forged-token", async () => {
    await expectCode(() => store.introspect({ token: `${randomId("forged")}` }), "DELEGATION_INVALID_CREDENTIAL");
  });

  await runChecks(checks, "issue:rejects-empty-scope", async () => {
    await expectCode(
      () => store.issue({ userId: user("invalid"), agentId, scope: [] }),
      "DELEGATION_INVALID_REQUEST",
    );
  });

  await runChecks(checks, "expiry:fails-closed", async () => {
    expiring = await store.issue({
      userId: user("expiring"),
      agentId,
      scope: ["orders:read"],
      ttlMs: expiryTtlMs,
    });
    assertIssued(expiring, "expiring issue");
    await sleep(expiryWaitMs);
    await expectCode(() => store.introspect({ token: expiring!.token }), "DELEGATION_EXPIRED");
  });

  // 保留引用，让调试器能看到最后一次签发结果。
  void secondIssue;

  return { ok: checks.every((check) => check.ok), checks };
}

/** 运行 store 一致性检查；有失败时抛出包含完整报告的异常。 */
export async function assertDelegationStoreConformance(
  store: DelegationStore,
  options: DelegationStoreConformanceOptions = {},
): Promise<DelegationConformanceReport> {
  const report = await runDelegationStoreConformance(store, options);
  if (!report.ok) throw new DelegationConformanceError(report);
  return report;
}

function eventFor(userId: string, agentId: string, extra: Record<string, unknown> = {}): DelegationInvalidationEvent {
  return {
    type: "credential_revoked",
    reason: "revoked",
    at: Date.now(),
    credentialId: `${randomId("dcr")}`,
    delegationId: `${randomId("del")}`,
    sessionId: `${randomId("ses")}`,
    userId,
    agentId,
    ...extra,
  } as DelegationInvalidationEvent;
}

/**
 * 验证事件总线是否按 userId 隔离、过滤未知字段，并且单个坏订阅者不会影响其他订阅者。
 * 不调用 `close()`，因为传入的 bus 可能还被其他测试复用；`publish` 可以是异步的。
 */
export async function runDelegationEventBusConformance(
  bus: DelegationEventBus,
  options: DelegationEventBusConformanceOptions = {},
): Promise<DelegationConformanceReport> {
  const checks: DelegationConformanceCheck[] = [];
  const runId = randomId("conf");
  const userA = `${options.userIdPrefix ?? "pling-conformance"}-${runId}-a`;
  const userB = `${options.userIdPrefix ?? "pling-conformance"}-${runId}-b`;
  const agentId = options.agentId ?? "conformance-agent";
  const receivedA: DelegationInvalidationEvent[] = [];
  const receivedB: DelegationInvalidationEvent[] = [];
  const statuses: DelegationInvalidationEvent[] = [];
  const cleanup: Array<() => void> = [];
  let unsubscribeA = (): void => {};

  const check = async (name: string, run: () => void | Promise<void>): Promise<void> => {
    const startedAt = Date.now();
    try {
      await run();
      checks.push({ name, ok: true, durationMs: Date.now() - startedAt });
    } catch (error) {
      checks.push({ name, ok: false, durationMs: Date.now() - startedAt, error: describeError(error) });
    }
  };

  await check("event-bus:isolates-users", async () => {
    unsubscribeA = bus.subscribe(userA, (event) => receivedA.push(event));
    cleanup.push(unsubscribeA);
    cleanup.push(bus.subscribe(userB, (event) => receivedB.push(event)));
    const event = eventFor(userA, agentId);
    await bus.publish(event);
    assert(receivedA.length === 1, "目标用户没有收到事件");
    assert(receivedB.length === 0, "事件串到了另一个用户");
    assert(receivedA[0]?.credentialId === event.credentialId, "事件字段被意外改写");
  });

  await check("event-bus:strips-unknown-fields", async () => {
    receivedA.splice(0);
    await bus.publish(eventFor(userA, agentId, { token: "plg_dlg_should_not_escape", secret: "hidden" }));
    assert(receivedA.length === 1, "事件未送达");
    assert(!("token" in (receivedA[0] ?? {})), "事件保留了 token 字段");
    assert(!("secret" in (receivedA[0] ?? {})), "事件保留了未知字段");
    assert(!JSON.stringify(receivedA[0]).includes("plg_dlg_"), "事件泄露了 token 值");
  });

  await check("event-bus:unsubscribe", async () => {
    receivedA.splice(0);
    unsubscribeA();
    await bus.publish(eventFor(userA, agentId));
    assert(receivedA.length === 0, "取消订阅后仍收到事件");
  });

  await check("event-bus:isolates-subscriber-errors", async () => {
    statuses.splice(0);
    const throwing = bus.subscribe(userB, () => {
      throw new Error("subscriber failed");
    });
    const receiving = bus.subscribe(userB, (event) => statuses.push(event));
    try {
      await bus.publish(eventFor(userB, agentId));
      assert(statuses.length === 1, "一个订阅者抛错阻塞了其他订阅者");
    } finally {
      throwing();
      receiving();
    }
  });

  await check("event-bus:ignores-malformed-events", async () => {
    receivedA.splice(0);
    await bus.publish({ type: "unknown", userId: userA } as unknown as DelegationInvalidationEvent);
    assert(receivedA.length === 0, "未知事件类型不应被广播");
  });

  for (const unsubscribe of cleanup.splice(0)) unsubscribe();
  return { ok: checks.every((entry) => entry.ok), checks };
}

/** 运行事件总线一致性检查；有失败时抛出包含完整报告的异常。 */
export async function assertDelegationEventBusConformance(
  bus: DelegationEventBus,
  options: DelegationEventBusConformanceOptions = {},
): Promise<DelegationConformanceReport> {
  const report = await runDelegationEventBusConformance(bus, options);
  if (!report.ok) throw new DelegationConformanceError(report);
  return report;
}
