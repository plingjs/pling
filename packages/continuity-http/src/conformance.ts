import type { ContinuityTaskSummary, LeaseGrant, ResidencyEnvelope } from "@plingjs/agent";
import type { ContinuityBackend } from "./types";

export interface ContinuityConformanceCheck {
  name: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface ContinuityConformanceReport {
  ok: boolean;
  checks: ContinuityConformanceCheck[];
}

export interface ContinuityBackendConformanceOptions {
  /** 正常路径使用的租约 TTL，默认 30 秒。 */
  leaseTtlMs?: number;
  /** 过期检查使用的租约 TTL，最小会被后端夹到 1 秒；默认 1.1 秒。 */
  expiryTtlMs?: number;
  /** 无法控制后端时钟时，等待租约过期的时间；默认 1.3 秒。 */
  expiryWaitMs?: number;
  /** 可注入假时钟推进；成功后不再等待。 */
  advanceTime?: () => Promise<void> | void;
  /** 与已有测试数据隔离的用户前缀。 */
  userIdPrefix?: string;
}

export class ContinuityConformanceError extends Error {
  readonly report: ContinuityConformanceReport;

  constructor(report: ContinuityConformanceReport) {
    const failures = report.checks
      .filter((check) => !check.ok)
      .map((check) => `${check.name}: ${check.error ?? "未通过"}`)
      .join("\n");
    super(`ContinuityBackend 一致性检查未通过\n${failures}`);
    this.name = "ContinuityConformanceError";
    this.report = report;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
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

function envelope(sessionId: string, summary = "conformance checkpoint"): ResidencyEnvelope {
  return {
    version: 2,
    sessionId,
    revision: 1,
    status: "active",
    summary,
    messages: [],
    events: [],
    updatedAt: 1,
  };
}

function assertGrant(grant: LeaseGrant, sessionId: string, ownerId: string): void {
  assert(grant && typeof grant === "object", "create/claim 必须返回 lease grant");
  assert(grant.sessionId === sessionId, "grant.sessionId 不一致");
  assert(grant.ownerId === ownerId, `grant.ownerId 应为 ${ownerId}`);
  assert(typeof grant.leaseId === "string" && grant.leaseId.length > 0, "grant.leaseId 缺失");
  assert(Number.isFinite(grant.leaseExpiresAt), "grant.leaseExpiresAt 必须是服务端时间戳");
  assert(grant.revision >= 1, "grant.revision 必须从 1 开始");
  assert(grant.envelope?.sessionId === sessionId, "grant.envelope 与 sessionId 不一致");
}

function assertSummary(
  tasks: ContinuityTaskSummary[],
  sessionId: string,
): void {
  assert(Array.isArray(tasks), "list 必须返回数组");
  assert(tasks.some((task) => task.sessionId === sessionId), `list 缺少 ${sessionId}`);
}

function randomId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}_${uuid ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runChecks(
  checks: ContinuityConformanceCheck[],
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
 * 验证一个 `ContinuityBackend` 是否满足跨设备任务的核心不变量。
 *
 * 它会创建、抢占和删除测试任务。请使用一次性命名空间 / 测试数据库，不要对生产用户运行。
 * `subscribe` 是可选加速器，不在这套事实来源检查里强制要求。
 */
export async function runContinuityBackendConformance(
  backend: ContinuityBackend,
  options: ContinuityBackendConformanceOptions = {},
): Promise<ContinuityConformanceReport> {
  const checks: ContinuityConformanceCheck[] = [];
  const runId = randomId("conf");
  const user = (label: string): string => `${options.userIdPrefix ?? "pling-continuity-conf"}-${runId}-${label}`;
  const userA = user("a");
  const userB = user("b");
  const leaseTtlMs = options.leaseTtlMs ?? 30_000;
  const expiryTtlMs = Math.max(1_000, options.expiryTtlMs ?? 1_100);
  const advanceTime = options.advanceTime ?? (() => sleep(options.expiryWaitMs ?? 1_300));

  const primaryId = randomId("task_conf_primary");
  const clearId = randomId("task_conf_clear");
  const expiryId = randomId("task_conf_expiry");
  let primary: LeaseGrant | undefined;
  let taken: LeaseGrant | undefined;
  let clearGrant: LeaseGrant | undefined;
  let currentRevision = 1;

  await runChecks(checks, "create:isolates-users", async () => {
    primary = await backend.create(userA, {
      envelope: envelope(primaryId),
      ownerId: "owner-a",
      ttlMs: leaseTtlMs,
    });
    assertGrant(primary, primaryId, "owner-a");
    assertSummary(await backend.list(userA), primaryId);
    assert((await backend.list(userB)).length === 0, "用户 B 不能看到用户 A 的任务");
    assert((await backend.read(userB, primaryId)) === null, "跨用户 read 必须返回 null");
  });

  await runChecks(checks, "create:rejects-live-duplicate", async () => {
    await expectCode(
      () => backend.create(userA, {
        envelope: envelope(primaryId),
        ownerId: "owner-a",
        ttlMs: leaseTtlMs,
      }),
      "TASK_EXISTS",
    );
  });

  await runChecks(checks, "read:returns-checkpoint", async () => {
    assert(primary, "前置 create 失败");
    const task = await backend.read(userA, primaryId);
    assert(task, "read 未返回任务");
    assert(task.sessionId === primaryId, "read 未返回正确任务");
    assert(task.summary === "conformance checkpoint", "read 未返回检查点正文");
    assert(task.revision === primary.revision, "read.revision 不一致");
  });

  await runChecks(checks, "claim:blocks-live-owner-without-preempt", async () => {
    await expectCode(
      () => backend.claim(userA, primaryId, {
        expectedRevision: 1,
        ownerId: "owner-b",
        ttlMs: leaseTtlMs,
      }),
      "LEASE_HELD",
    );
  });

  await runChecks(checks, "claim:preempt-revokes-old-owner", async () => {
    assert(primary, "前置 create 失败");
    taken = await backend.claim(userA, primaryId, {
      expectedRevision: primary.revision,
      ownerId: "owner-b",
      ttlMs: leaseTtlMs,
      preempt: true,
    });
    assertGrant(taken, primaryId, "owner-b");
    assert(taken.revision === primary.revision + 1, "接管必须递增 revision");
    currentRevision = taken.revision;
    await expectCode(
      () => backend.renew(userA, primaryId, {
        ownerId: "owner-a",
        leaseId: primary!.leaseId,
        ttlMs: leaseTtlMs,
      }),
      "OWNER_MISMATCH",
    );
  });

  await runChecks(checks, "cas:rejects-stale-revision", async () => {
    assert(taken, "前置 claim 失败");
    await expectCode(
      () => backend.compareAndSwap(userA, primaryId, {
        expectedRevision: 1,
        ownerId: "owner-b",
        leaseId: taken!.leaseId,
        next: envelope(primaryId, "stale write"),
      }),
      "REVISION_CONFLICT",
    );
  });

  await runChecks(checks, "cas:advances-revision-and-preserves-owner", async () => {
    assert(taken, "前置 claim 失败");
    const saved = await backend.compareAndSwap(userA, primaryId, {
      expectedRevision: currentRevision,
      ownerId: "owner-b",
      leaseId: taken.leaseId,
      next: envelope(primaryId, "updated checkpoint"),
    });
    assert(saved.summary === "updated checkpoint", "CAS 未写入新检查点");
    assert(saved.revision === currentRevision + 1, "CAS 必须递增 revision");
    assert(saved.ownerId === "owner-b", "CAS 不能改变 owner");
    currentRevision = saved.revision;
  });

  await runChecks(checks, "lease:renew-keeps-owner", async () => {
    assert(taken, "前置 claim 失败");
    const renewed = await backend.renew(userA, primaryId, {
      ownerId: "owner-b",
      leaseId: taken.leaseId,
      ttlMs: leaseTtlMs,
    });
    assertGrant(renewed, primaryId, "owner-b");
    assert(renewed.leaseId === taken.leaseId, "renew 不应更换 leaseId");
    assert(renewed.revision === currentRevision, "renew 不应递增 revision");
  });

  await runChecks(checks, "remove:rejects-non-owner", async () => {
    assert(primary && taken, "前置步骤失败");
    await expectCode(
      () => backend.remove(userA, primaryId, {
        ownerId: "owner-a",
        leaseId: primary!.leaseId,
      }),
      "OWNER_MISMATCH",
    );
    assert((await backend.read(userA, primaryId)) !== null, "失败的 remove 不能删除任务");
  });

  await runChecks(checks, "release:clears-owner-and-allows-reclaim", async () => {
    assert(taken, "前置 claim 失败");
    const released = await backend.release(userA, primaryId, {
      ownerId: "owner-b",
      leaseId: taken.leaseId,
    });
    assert(released === true, "owner release 必须成功");
    const task = await backend.read(userA, primaryId);
    assert(task, "release 后任务不应消失");
    assert(task.status === "suspended", "release 后任务必须 suspended");
    assert(!task.ownerId && !task.leaseId, "release 后不能残留 owner / lease");
    const reclaimed = await backend.claim(userA, primaryId, {
      expectedRevision: task.revision,
      ownerId: "owner-c",
      ttlMs: leaseTtlMs,
    });
    assertGrant(reclaimed, primaryId, "owner-c");
  });

  await runChecks(checks, "remove:deletes-only-own-task", async () => {
    clearGrant = await backend.create(userA, {
      envelope: envelope(clearId),
      ownerId: "owner-clear",
      ttlMs: leaseTtlMs,
    });
    assert((await backend.remove(userA, clearId, {
      ownerId: "owner-clear",
      leaseId: clearGrant.leaseId,
    })) === true, "owner remove 必须成功");
    assert((await backend.read(userA, clearId)) === null, "remove 后任务必须消失");
    assert((await backend.read(userB, clearId)) === null, "其他用户也必须看不到已删除任务");
  });

  await runChecks(checks, "lease:expired-fails-closed", async () => {
    const grant = await backend.create(userA, {
      envelope: envelope(expiryId),
      ownerId: "owner-expiry",
      ttlMs: expiryTtlMs,
    });
    await advanceTime();
    await expectCode(
      () => backend.renew(userA, expiryId, {
        ownerId: "owner-expiry",
        leaseId: grant.leaseId,
        ttlMs: leaseTtlMs,
      }),
      "LEASE_EXPIRED",
    );
  });

  return { ok: checks.every((check) => check.ok), checks };
}

export async function assertContinuityBackendConformance(
  backend: ContinuityBackend,
  options: ContinuityBackendConformanceOptions = {},
): Promise<ContinuityConformanceReport> {
  const report = await runContinuityBackendConformance(backend, options);
  if (!report.ok) throw new ContinuityConformanceError(report);
  return report;
}
