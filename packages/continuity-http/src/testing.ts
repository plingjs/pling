import { RESIDENCY_VERSION } from "@plingjs/agent";
import type {
  ContinuityChange,
  ContinuityTaskSummary,
  LeaseGrant,
  ResidencyEnvelope,
} from "@plingjs/agent";
import { ContinuityBackendError } from "./errors";
import type {
  ContinuityBackend,
  ContinuityCasInput,
  ContinuityClaimInput,
  ContinuityCreateInput,
  ContinuityReleaseInput,
  ContinuityRenewInput,
} from "./types";

export * from "./conformance";

const DEFAULT_TASK_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_TASK_LIMIT = 20;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function taskTtl(ttlMs: number): number {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new ContinuityBackendError("INVALID_STATE", "租约 TTL 必须是正数");
  }
  return Math.max(1_000, Math.floor(ttlMs));
}

function assertOwnerId(ownerId: string): void {
  if (typeof ownerId !== "string" || !ownerId) {
    throw new ContinuityBackendError("INVALID_STATE", "ownerId 不能为空");
  }
}

function leaseId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return `lease_${random ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`}`;
}

function newLease(ownerId: string, ttlMs: number, now: number): {
  ownerId: string;
  leaseId: string;
  leaseExpiresAt: number;
} {
  assertOwnerId(ownerId);
  return {
    ownerId,
    leaseId: leaseId(),
    leaseExpiresAt: now + taskTtl(ttlMs),
  };
}

function hasLiveLease(envelope: ResidencyEnvelope | null, at: number): boolean {
  return Boolean(
    envelope?.ownerId &&
      envelope.leaseId &&
      typeof envelope.leaseExpiresAt === "number" &&
      envelope.leaseExpiresAt > at,
  );
}

function summaryOf(envelope: ResidencyEnvelope, at: number): ContinuityTaskSummary {
  return {
    sessionId: envelope.sessionId,
    revision: envelope.revision,
    status: envelope.status,
    ...(envelope.goal ? { goal: envelope.goal } : {}),
    updatedAt: envelope.updatedAt,
    ownerActive: hasLiveLease(envelope, at),
  };
}

function grantOf(envelope: ResidencyEnvelope): LeaseGrant {
  if (!envelope.ownerId || !envelope.leaseId || envelope.leaseExpiresAt === undefined) {
    throw new ContinuityBackendError("INVALID_STATE", "任务缺少有效租约");
  }
  return {
    sessionId: envelope.sessionId,
    revision: envelope.revision,
    ownerId: envelope.ownerId,
    leaseId: envelope.leaseId,
    leaseExpiresAt: envelope.leaseExpiresAt,
    envelope: clone(envelope),
  };
}

function changeOf(
  type: ContinuityChange["type"],
  envelope: ResidencyEnvelope,
  at: number,
): ContinuityChange {
  return {
    type,
    sessionId: envelope.sessionId,
    revision: envelope.revision,
    status: envelope.status,
    ...(envelope.ownerId ? { ownerId: envelope.ownerId } : {}),
    ...(envelope.leaseId ? { leaseId: envelope.leaseId } : {}),
    ...(envelope.leaseExpiresAt ? { leaseExpiresAt: envelope.leaseExpiresAt } : {}),
    at,
  };
}

function assertEnvelope(value: unknown): asserts value is ResidencyEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ContinuityBackendError("INVALID_STATE", "检查点必须是对象");
  }
  const candidate = value as Partial<ResidencyEnvelope>;
  if (
    candidate.version !== RESIDENCY_VERSION ||
    typeof candidate.sessionId !== "string" ||
    !candidate.sessionId ||
    typeof candidate.revision !== "number" ||
    !Number.isFinite(candidate.revision) ||
    !Array.isArray(candidate.messages) ||
    !Array.isArray(candidate.events) ||
    typeof candidate.summary !== "string" ||
    (candidate.status !== "active" && candidate.status !== "suspended" && candidate.status !== "done")
  ) {
    throw new ContinuityBackendError("INVALID_STATE", "检查点信封无效或版本不兼容");
  }
}

function assertOwner(
  envelope: ResidencyEnvelope | null,
  input: { ownerId: string; leaseId: string },
  at: number,
): ResidencyEnvelope {
  if (!envelope) throw new ContinuityBackendError("NOT_FOUND", "任务不存在或已过期");
  if (envelope.ownerId !== input.ownerId || envelope.leaseId !== input.leaseId) {
    throw new ContinuityBackendError("OWNER_MISMATCH", "当前上下文不是这个任务的执行 owner");
  }
  if (!hasLiveLease(envelope, at)) {
    throw new ContinuityBackendError("LEASE_EXPIRED", "任务租约已过期，请重新接管");
  }
  return envelope;
}

export interface MemoryContinuityBackendOptions {
  now?: () => number;
  taskTtlMs?: number;
  maxTasks?: number;
  onAudit?: (event: Record<string, unknown>) => void;
}

export interface MemoryContinuityBackend
  extends Omit<
    ContinuityBackend,
    "list" | "read" | "create" | "claim" | "renew" | "release" | "compareAndSwap" | "remove" | "subscribe"
  > {
  list(userId: string): ContinuityTaskSummary[];
  read(userId: string, sessionId: string): ResidencyEnvelope | null;
  create(userId: string, input: ContinuityCreateInput): LeaseGrant;
  claim(userId: string, sessionId: string, input: ContinuityClaimInput): LeaseGrant;
  renew(userId: string, sessionId: string, input: ContinuityRenewInput): LeaseGrant;
  release(userId: string, sessionId: string, input: ContinuityReleaseInput): boolean;
  compareAndSwap(userId: string, sessionId: string, input: ContinuityCasInput): ResidencyEnvelope;
  remove(userId: string, sessionId: string, input: ContinuityReleaseInput): boolean;
  subscribe(userId: string, listener: (change: ContinuityChange) => void): () => void;
  stats(userId: string): { tasks: number; listeners: number };
}

/**
 * 仅用于测试与本地参考的单进程内存实现。
 *
 * 它不是生产存储：没有持久化、事务隔离、跨进程广播或 SSO。生产环境应实现同一个
 * `ContinuityBackend` port（例如 Postgres 事务 + 服务端时间 + 外部事件总线）。
 */
export function createMemoryContinuityBackend(
  options: MemoryContinuityBackendOptions = {},
): MemoryContinuityBackend {
  const now = options.now ?? (() => Date.now());
  const taskTtlMs = taskTtl(options.taskTtlMs ?? DEFAULT_TASK_TTL_MS);
  const limit = Number.isFinite(options.maxTasks)
    ? Math.max(1, Math.floor(options.maxTasks as number))
    : DEFAULT_TASK_LIMIT;
  const byUser = new Map<string, Map<string, ResidencyEnvelope>>();
  const listeners = new Map<string, Set<(change: ContinuityChange) => void>>();
  const audit = options.onAudit ?? (() => {});

  const tasksOf = (userId: string): Map<string, ResidencyEnvelope> => {
    let tasks = byUser.get(userId);
    if (!tasks) {
      tasks = new Map();
      byUser.set(userId, tasks);
    }
    return tasks;
  };

  const fresh = (envelope: ResidencyEnvelope | null): ResidencyEnvelope | null => {
    if (!envelope) return null;
    return now() - envelope.updatedAt > taskTtlMs ? null : envelope;
  };

  const emit = (userId: string, type: ContinuityChange["type"], envelope: ResidencyEnvelope): ContinuityChange => {
    const change = changeOf(type, envelope, now());
    for (const listener of listeners.get(userId) ?? []) {
      try {
        listener(change);
      } catch {
        // 一个坏订阅者不能影响已经提交的租约事实。
      }
    }
    return change;
  };

  const auditEvent = (
    userId: string,
    action: string,
    sessionId: string,
    extra: Record<string, unknown> = {},
  ): void => {
    try {
      audit({ type: "pling.continuity.audit", userId, action, sessionId, at: now(), ...extra });
    } catch {
      // 审计接收器故障不改变存储结果；生产实现应在自己的事务 / outbox 中保证审计。
    }
  };

  return {
    list(userId: string): ContinuityTaskSummary[] {
      return [...tasksOf(userId).values()]
        .map(fresh)
        .filter((task): task is ResidencyEnvelope => task !== null)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, limit)
        .map((task) => summaryOf(task, now()));
    },

    read(userId: string, sessionId: string): ResidencyEnvelope | null {
      const task = fresh(tasksOf(userId).get(sessionId) ?? null);
      return task ? clone(task) : null;
    },

    create(userId: string, input: ContinuityCreateInput): LeaseGrant {
      assertEnvelope(input?.envelope);
      const tasks = tasksOf(userId);
      const current = fresh(tasks.get(input.envelope.sessionId) ?? null);
      if (current) throw new ContinuityBackendError("TASK_EXISTS", "同名任务已经存在");
      const at = now();
      const lease = newLease(input.ownerId, input.ttlMs, at);
      const envelope: ResidencyEnvelope = {
        ...clone(input.envelope),
        version: RESIDENCY_VERSION,
        revision: 1,
        status: "active",
        ...lease,
        updatedAt: at,
      };
      tasks.set(envelope.sessionId, envelope);
      emit(userId, "lease", envelope);
      auditEvent(userId, "create", envelope.sessionId, { revision: envelope.revision });
      return grantOf(envelope);
    },

    claim(userId: string, sessionId: string, input: ContinuityClaimInput): LeaseGrant {
      const tasks = tasksOf(userId);
      const current = fresh(tasks.get(sessionId) ?? null);
      if (!current) throw new ContinuityBackendError("NOT_FOUND", "任务不存在或已过期");
      if (current.status === "done") {
        throw new ContinuityBackendError("LEASE_REVOKED", "已完成的任务不能再接管");
      }
      if (current.revision !== input.expectedRevision) {
        throw new ContinuityBackendError("REVISION_CONFLICT", "任务版本已变化，请重新读取");
      }
      const at = now();
      if (hasLiveLease(current, at) && current.ownerId !== input.ownerId && !input.preempt) {
        throw new ContinuityBackendError("LEASE_HELD", "任务正在另一个上下文执行");
      }
      const lease = newLease(input.ownerId, input.ttlMs, at);
      const envelope: ResidencyEnvelope = {
        ...clone(current),
        revision: current.revision + 1,
        status: "active",
        ...lease,
        updatedAt: at,
      };
      tasks.set(sessionId, envelope);
      emit(userId, "lease", envelope);
      auditEvent(userId, input.preempt ? "takeover" : "claim", sessionId, {
        revision: envelope.revision,
      });
      return grantOf(envelope);
    },

    renew(userId: string, sessionId: string, input: ContinuityRenewInput): LeaseGrant {
      const tasks = tasksOf(userId);
      const current = assertOwner(fresh(tasks.get(sessionId) ?? null), input, now());
      const at = now();
      const envelope: ResidencyEnvelope = {
        ...clone(current),
        leaseExpiresAt: at + taskTtl(input.ttlMs),
      };
      tasks.set(sessionId, envelope);
      emit(userId, "lease", envelope);
      return grantOf(envelope);
    },

    release(userId: string, sessionId: string, input: ContinuityReleaseInput): boolean {
      const tasks = tasksOf(userId);
      const current = tasks.get(sessionId);
      if (!current) return false;
      if (current.ownerId !== input.ownerId || current.leaseId !== input.leaseId) return false;
      const envelope: ResidencyEnvelope = {
        ...clone(current),
        revision: current.revision + 1,
        status: current.status === "done" ? "done" : "suspended",
        updatedAt: now(),
      };
      delete envelope.ownerId;
      delete envelope.leaseId;
      delete envelope.leaseExpiresAt;
      tasks.set(sessionId, envelope);
      emit(userId, "lease", envelope);
      auditEvent(userId, "release", sessionId, { revision: envelope.revision });
      return true;
    },

    compareAndSwap(userId: string, sessionId: string, input: ContinuityCasInput): ResidencyEnvelope {
      const tasks = tasksOf(userId);
      const current = assertOwner(fresh(tasks.get(sessionId) ?? null), input, now());
      if (current.revision !== input.expectedRevision) {
        throw new ContinuityBackendError("REVISION_CONFLICT", "任务版本已变化，请重新读取");
      }
      assertEnvelope(input.next);
      const envelope: ResidencyEnvelope = {
        ...clone(input.next),
        version: RESIDENCY_VERSION,
        sessionId: current.sessionId,
        revision: current.revision + 1,
        ownerId: current.ownerId,
        leaseId: current.leaseId,
        leaseExpiresAt: current.leaseExpiresAt,
        updatedAt: now(),
      };
      tasks.set(sessionId, envelope);
      emit(userId, "checkpoint", envelope);
      return clone(envelope);
    },

    remove(userId: string, sessionId: string, input: ContinuityReleaseInput): boolean {
      const tasks = tasksOf(userId);
      const current = tasks.get(sessionId);
      if (!current) return false;
      if (current.ownerId !== input.ownerId || current.leaseId !== input.leaseId) {
        throw new ContinuityBackendError("OWNER_MISMATCH", "只有当前 owner 可以清除任务");
      }
      tasks.delete(sessionId);
      emit(userId, "cleared", current);
      auditEvent(userId, "remove", sessionId, { revision: current.revision });
      return true;
    },

    subscribe(userId: string, listener: (change: ContinuityChange) => void): () => void {
      let bucket = listeners.get(userId);
      if (!bucket) {
        bucket = new Set();
        listeners.set(userId, bucket);
      }
      bucket.add(listener);
      return () => {
        bucket?.delete(listener);
        if (bucket && !bucket.size) listeners.delete(userId);
      };
    },

    stats(userId: string): { tasks: number; listeners: number } {
      return { tasks: tasksOf(userId).size, listeners: listeners.get(userId)?.size ?? 0 };
    },
  };
}
