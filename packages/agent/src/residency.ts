import type { LlmMessage, PageView } from "@plingjs/core";
import type { SessionEvent } from "./types";

/**
 * 跨上下文任务驻留。
 *
 * 这里只放「谁有权执行」的租约与检查点信封，不放页面执行逻辑：
 * authority 原子裁决 claim / renew / release / compareAndSwap，
 * 会话层拿到 grant 之后仍然使用本页自己的 registry 与 executor。
 */

export const RESIDENCY_VERSION = 2 as const;
export const DEFAULT_RESIDENCY_PREFIX = "pling:continuity:v2";
export const DEFAULT_LEASE_TTL_MS = 30_000;
export const DEFAULT_RESIDENCY_TASKS = 20;

export type ContinuityScope = "tab" | "browser" | "remote";
export type ContinuityRole = "owner" | "follower" | "unowned";
export type ContinuityTaskStatus = "active" | "suspended" | "done";
export type ContinuityTakeoverMode = "manual" | "off";

export interface ResidencyEnvelope {
  version: typeof RESIDENCY_VERSION;
  sessionId: string;
  revision: number;
  ownerId?: string;
  leaseId?: string;
  leaseExpiresAt?: number;
  status: ContinuityTaskStatus;
  goal?: string;
  page?: PageView;
  startPage?: PageView;
  summary: string;
  messages: LlmMessage[];
  events: SessionEvent[];
  updatedAt: number;
}

export interface ContinuityTaskSummary {
  sessionId: string;
  revision: number;
  status: ContinuityTaskStatus;
  goal?: string;
  updatedAt: number;
  ownerActive: boolean;
}

export interface LeaseGrant {
  sessionId: string;
  revision: number;
  ownerId: string;
  leaseId: string;
  leaseExpiresAt: number;
  envelope: ResidencyEnvelope;
}

export interface CreateTaskInput {
  envelope: ResidencyEnvelope;
  ownerId: string;
  ttlMs: number;
}

export interface ClaimTaskInput {
  sessionId: string;
  expectedRevision: number;
  ownerId: string;
  ttlMs: number;
  /** 只有用户显式点「接管」时才为 true；普通恢复不能抢已有 owner。 */
  preempt?: boolean;
}

export interface RenewLeaseInput {
  sessionId: string;
  ownerId: string;
  leaseId: string;
  ttlMs: number;
}

export interface ReleaseLeaseInput {
  sessionId: string;
  ownerId: string;
  leaseId: string;
}

export interface CompareAndSwapInput {
  sessionId: string;
  expectedRevision: number;
  ownerId: string;
  leaseId: string;
  next: ResidencyEnvelope;
}

export interface ContinuityChange {
  type: "checkpoint" | "lease" | "status" | "cleared";
  sessionId: string;
  revision: number;
  status: ContinuityTaskStatus;
  ownerId?: string;
  leaseId?: string;
  leaseExpiresAt?: number;
  at: number;
}

export interface ContinuityAuthority {
  list(): Promise<ContinuityTaskSummary[]>;
  read(sessionId: string): Promise<ResidencyEnvelope | null>;
  create(input: CreateTaskInput): Promise<LeaseGrant>;
  claim(input: ClaimTaskInput): Promise<LeaseGrant>;
  renew(input: RenewLeaseInput): Promise<LeaseGrant>;
  release(input: ReleaseLeaseInput): Promise<void>;
  compareAndSwap(input: CompareAndSwapInput): Promise<ResidencyEnvelope>;
  remove(input: ReleaseLeaseInput): Promise<void>;
  subscribe?(listener: (change: ContinuityChange) => void): () => void;
  dispose?(): void;
}

export type ContinuityAuthorityErrorCode =
  | "TASK_EXISTS"
  | "NOT_FOUND"
  | "REVISION_CONFLICT"
  | "LEASE_HELD"
  | "LEASE_EXPIRED"
  | "OWNER_MISMATCH"
  | "LEASE_REVOKED"
  | "UNAUTHORIZED"
  | "STORE_UNAVAILABLE"
  | "INVALID_STATE";

export class ContinuityAuthorityError extends Error {
  readonly code: ContinuityAuthorityErrorCode;

  constructor(code: ContinuityAuthorityErrorCode, message: string) {
    super(message);
    this.name = "ContinuityAuthorityError";
    this.code = code;
  }
}

export function createContinuitySessionId(): string {
  const crypto = (globalThis as { crypto?: Crypto }).crypto;
  if (typeof crypto?.randomUUID === "function") return `task_${crypto.randomUUID()}`;
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function hasLiveLease(
  envelope: ResidencyEnvelope | null | undefined,
  now: number,
): boolean {
  return Boolean(
    envelope &&
      envelope.ownerId &&
      envelope.leaseId &&
      typeof envelope.leaseExpiresAt === "number" &&
      envelope.leaseExpiresAt > now,
  );
}

export function summaryOfEnvelope(
  envelope: ResidencyEnvelope,
  now: number,
): ContinuityTaskSummary {
  return {
    sessionId: envelope.sessionId,
    revision: envelope.revision,
    status: envelope.status,
    ...(envelope.goal ? { goal: envelope.goal } : {}),
    updatedAt: envelope.updatedAt,
    ownerActive: hasLiveLease(envelope, now),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function grantOf(envelope: ResidencyEnvelope): LeaseGrant {
  return {
    sessionId: envelope.sessionId,
    revision: envelope.revision,
    ownerId: envelope.ownerId!,
    leaseId: envelope.leaseId!,
    leaseExpiresAt: envelope.leaseExpiresAt!,
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

function assertTtl(ttlMs: number): number {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new ContinuityAuthorityError("INVALID_STATE", "租约 TTL 必须是正数");
  }
  return Math.max(1_000, Math.floor(ttlMs));
}

function newLease(ownerId: string, ttlMs: number, now: number): { leaseId: string; leaseExpiresAt: number } {
  return {
    leaseId: `lease_${Math.random().toString(36).slice(2, 12)}`,
    leaseExpiresAt: now + assertTtl(ttlMs),
  };
}

function assertOwner(
  envelope: ResidencyEnvelope | null,
  input: { ownerId: string; leaseId: string },
  now: number,
): ResidencyEnvelope {
  if (!envelope) throw new ContinuityAuthorityError("NOT_FOUND", "任务不存在或已过期");
  if (envelope.ownerId !== input.ownerId || envelope.leaseId !== input.leaseId) {
    throw new ContinuityAuthorityError("OWNER_MISMATCH", "当前上下文不是这个任务的执行 owner");
  }
  if (!hasLiveLease(envelope, now)) {
    throw new ContinuityAuthorityError("LEASE_EXPIRED", "任务租约已过期，请重新接管");
  }
  return envelope;
}

export interface MemoryContinuityAuthorityOptions {
  now?: () => number;
  ttlMs?: number;
  taskLimit?: number;
}

export function createMemoryContinuityAuthority(
  options: MemoryContinuityAuthorityOptions = {},
): ContinuityAuthority {
  const now = options.now ?? (() => Date.now());
  const ttlMs = assertTtl(options.ttlMs ?? 2 * 60 * 60 * 1000);
  const taskLimit = Math.max(1, options.taskLimit ?? DEFAULT_RESIDENCY_TASKS);
  const tasks = new Map<string, ResidencyEnvelope>();
  const listeners = new Set<(change: ContinuityChange) => void>();

  const notify = (type: ContinuityChange["type"], envelope: ResidencyEnvelope): void => {
    const change = changeOf(type, envelope, now());
    for (const listener of listeners) listener(change);
  };

  const fresh = (envelope: ResidencyEnvelope | null): ResidencyEnvelope | null => {
    if (!envelope) return null;
    return now() - envelope.updatedAt > ttlMs ? null : envelope;
  };

  return {
    async list() {
      return [...tasks.values()]
        .filter((task) => Boolean(fresh(task)))
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, taskLimit)
        .map((task) => summaryOfEnvelope(task, now()));
    },
    async read(sessionId) {
      const task = fresh(tasks.get(sessionId) ?? null);
      return task ? clone(task) : null;
    },
    async create(input) {
      const current = fresh(tasks.get(input.envelope.sessionId) ?? null);
      if (current) throw new ContinuityAuthorityError("TASK_EXISTS", "同名任务已经存在");
      const at = now();
      const lease = newLease(input.ownerId, input.ttlMs, at);
      const envelope: ResidencyEnvelope = {
        ...clone(input.envelope),
        version: RESIDENCY_VERSION,
        revision: 1,
        status: "active",
        ownerId: input.ownerId,
        ...lease,
        updatedAt: at,
      };
      tasks.set(envelope.sessionId, envelope);
      notify("lease", envelope);
      return grantOf(envelope);
    },
    async claim(input) {
      const current = fresh(tasks.get(input.sessionId) ?? null);
      if (!current) throw new ContinuityAuthorityError("NOT_FOUND", "任务不存在或已过期");
      if (current.status === "done") {
        throw new ContinuityAuthorityError("LEASE_REVOKED", "已完成的任务不能再接管");
      }
      if (current.revision !== input.expectedRevision) {
        throw new ContinuityAuthorityError("REVISION_CONFLICT", "任务版本已变化，请重新读取");
      }
      const at = now();
      const held = hasLiveLease(current, at);
      if (held && current.ownerId !== input.ownerId && !input.preempt) {
        throw new ContinuityAuthorityError("LEASE_HELD", "任务正在另一个上下文执行");
      }
      const lease = newLease(input.ownerId, input.ttlMs, at);
      const envelope: ResidencyEnvelope = {
        ...clone(current),
        revision: current.revision + 1,
        status: "active",
        ownerId: input.ownerId,
        ...lease,
        updatedAt: at,
      };
      tasks.set(envelope.sessionId, envelope);
      notify("lease", envelope);
      return grantOf(envelope);
    },
    async renew(input) {
      const current = assertOwner(fresh(tasks.get(input.sessionId) ?? null), input, now());
      const at = now();
      const envelope: ResidencyEnvelope = {
        ...clone(current),
        leaseExpiresAt: at + assertTtl(input.ttlMs),
      };
      tasks.set(envelope.sessionId, envelope);
      notify("lease", envelope);
      return grantOf(envelope);
    },
    async release(input) {
      const current = tasks.get(input.sessionId);
      if (!current) return;
      if (current.ownerId !== input.ownerId || current.leaseId !== input.leaseId) return;
      const at = now();
      const envelope: ResidencyEnvelope = {
        ...clone(current),
        revision: current.revision + 1,
        status: current.status === "done" ? "done" : "suspended",
        updatedAt: at,
      };
      delete envelope.ownerId;
      delete envelope.leaseId;
      delete envelope.leaseExpiresAt;
      tasks.set(envelope.sessionId, envelope);
      notify("lease", envelope);
    },
    async compareAndSwap(input) {
      const current = assertOwner(fresh(tasks.get(input.sessionId) ?? null), input, now());
      if (current.revision !== input.expectedRevision) {
        throw new ContinuityAuthorityError("REVISION_CONFLICT", "任务版本已变化，请重新读取");
      }
      const at = now();
      const envelope: ResidencyEnvelope = {
        ...clone(input.next),
        version: RESIDENCY_VERSION,
        sessionId: current.sessionId,
        revision: current.revision + 1,
        ownerId: current.ownerId,
        leaseId: current.leaseId,
        leaseExpiresAt: current.leaseExpiresAt,
        updatedAt: at,
      };
      tasks.set(envelope.sessionId, envelope);
      notify("checkpoint", envelope);
      return clone(envelope);
    },
    async remove(input) {
      const current = tasks.get(input.sessionId);
      if (!current) return;
      if (current.ownerId !== input.ownerId || current.leaseId !== input.leaseId) {
        throw new ContinuityAuthorityError("OWNER_MISMATCH", "只有当前 owner 可以清除任务");
      }
      tasks.delete(input.sessionId);
      notify("cleared", current);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T> | T): Promise<T>;
};

export interface BrowserContinuityAuthorityOptions {
  keyPrefix?: string;
  now?: () => number;
  ttlMs?: number;
  taskLimit?: number;
  storage?: Storage | null;
  locks?: LockManagerLike | null;
  channel?: BroadcastChannel | null;
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function defaultLocks(): LockManagerLike | null {
  try {
    const navigator = (globalThis as { navigator?: Navigator }).navigator;
    const locks = (navigator as Navigator & { locks?: LockManagerLike } | undefined)?.locks;
    return locks && typeof locks.request === "function" ? locks : null;
  } catch {
    return null;
  }
}

function defaultChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel("pling:continuity:v2");
}

export function createBrowserContinuityAuthority(
  options: BrowserContinuityAuthorityOptions = {},
): ContinuityAuthority {
  const keyPrefix = `${(options.keyPrefix ?? DEFAULT_RESIDENCY_PREFIX).replace(/:+$/, "")}:`;
  const now = options.now ?? (() => Date.now());
  const ttlMs = assertTtl(options.ttlMs ?? 2 * 60 * 60 * 1000);
  const taskLimit = Math.max(1, options.taskLimit ?? DEFAULT_RESIDENCY_TASKS);
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const locks = options.locks === undefined ? defaultLocks() : options.locks;
  const channel = options.channel === undefined ? defaultChannel() : options.channel;
  const listeners = new Set<(change: ContinuityChange) => void>();

  const parse = (raw: string | null): ResidencyEnvelope | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<ResidencyEnvelope>;
      if (
        parsed.version !== RESIDENCY_VERSION ||
        typeof parsed.sessionId !== "string" ||
        typeof parsed.revision !== "number" ||
        typeof parsed.updatedAt !== "number" ||
        !Array.isArray(parsed.messages) ||
        !Array.isArray(parsed.events) ||
        (parsed.status !== "active" && parsed.status !== "suspended" && parsed.status !== "done")
      ) {
        return null;
      }
      return parsed as ResidencyEnvelope;
    } catch {
      return null;
    }
  };

  const readRaw = (sessionId: string): ResidencyEnvelope | null => {
    if (!storage) return null;
    try {
      return parse(storage.getItem(`${keyPrefix}${sessionId}`));
    } catch {
      return null;
    }
  };

  const fresh = (envelope: ResidencyEnvelope | null): ResidencyEnvelope | null => {
    if (!envelope) return null;
    return now() - envelope.updatedAt > ttlMs ? null : envelope;
  };

  const write = (envelope: ResidencyEnvelope): void => {
    if (!storage) {
      throw new ContinuityAuthorityError("STORE_UNAVAILABLE", "浏览器本地存储不可用，无法共享任务");
    }
    try {
      storage.setItem(`${keyPrefix}${envelope.sessionId}`, JSON.stringify(envelope));
    } catch {
      throw new ContinuityAuthorityError("STORE_UNAVAILABLE", "浏览器本地存储写入失败");
    }
  };

  const notify = (type: ContinuityChange["type"], envelope: ResidencyEnvelope): void => {
    const change = changeOf(type, envelope, now());
    for (const listener of listeners) listener(change);
    channel?.postMessage(change);
  };

  const withLock = async <T>(sessionId: string, run: () => T): Promise<T> => {
    if (!locks) {
      throw new ContinuityAuthorityError(
        "STORE_UNAVAILABLE",
        "浏览器不支持 Web Locks，无法保证跨标签页单写；请注入 authority 或退回 tab 模式",
      );
    }
    return locks.request(`pling:continuity:${sessionId}`, run);
  };

  const onChannel = (event: MessageEvent<ContinuityChange>): void => {
    const change = event.data;
    if (!change || typeof change.sessionId !== "string") return;
    for (const listener of listeners) listener(change);
  };
  if (channel) channel.addEventListener("message", onChannel);

  const onStorage = (event: StorageEvent): void => {
    if (!event.key?.startsWith(keyPrefix)) return;
    const envelope = parse(event.newValue);
    if (!envelope) {
      const sessionId = event.key.slice(keyPrefix.length);
      for (const listener of listeners) {
        listener({ type: "cleared", sessionId, revision: 0, status: "done", at: now() });
      }
      return;
    }
    const change = changeOf("lease", envelope, now());
    for (const listener of listeners) listener(change);
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

  return {
    async list() {
      if (!storage) return [];
      const out: ResidencyEnvelope[] = [];
      try {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (!key?.startsWith(keyPrefix)) continue;
          const envelope = fresh(parse(storage.getItem(key)));
          if (envelope) out.push(envelope);
        }
      } catch {
        return [];
      }
      return out
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, taskLimit)
        .map((task) => summaryOfEnvelope(task, now()));
    },
    async read(sessionId) {
      const task = fresh(readRaw(sessionId));
      return task ? clone(task) : null;
    },
    async create(input) {
      return withLock(input.envelope.sessionId, () => {
        const current = fresh(readRaw(input.envelope.sessionId));
        if (current) throw new ContinuityAuthorityError("TASK_EXISTS", "同名任务已经存在");
        const at = now();
        const lease = newLease(input.ownerId, input.ttlMs, at);
        const envelope: ResidencyEnvelope = {
          ...clone(input.envelope),
          version: RESIDENCY_VERSION,
          revision: 1,
          status: "active",
          ownerId: input.ownerId,
          ...lease,
          updatedAt: at,
        };
        write(envelope);
        notify("lease", envelope);
        return grantOf(envelope);
      });
    },
    async claim(input) {
      return withLock(input.sessionId, () => {
        const current = fresh(readRaw(input.sessionId));
        if (!current) throw new ContinuityAuthorityError("NOT_FOUND", "任务不存在或已过期");
        if (current.status === "done") {
          throw new ContinuityAuthorityError("LEASE_REVOKED", "已完成的任务不能再接管");
        }
        if (current.revision !== input.expectedRevision) {
          throw new ContinuityAuthorityError("REVISION_CONFLICT", "任务版本已变化，请重新读取");
        }
        const at = now();
        const held = hasLiveLease(current, at);
        if (held && current.ownerId !== input.ownerId && !input.preempt) {
          throw new ContinuityAuthorityError("LEASE_HELD", "任务正在另一个上下文执行");
        }
        const lease = newLease(input.ownerId, input.ttlMs, at);
        const envelope: ResidencyEnvelope = {
          ...clone(current),
          revision: current.revision + 1,
          status: "active",
          ownerId: input.ownerId,
          ...lease,
          updatedAt: at,
        };
        write(envelope);
        notify("lease", envelope);
        return grantOf(envelope);
      });
    },
    async renew(input) {
      return withLock(input.sessionId, () => {
        const current = assertOwner(fresh(readRaw(input.sessionId)), input, now());
        const envelope: ResidencyEnvelope = {
          ...clone(current),
          leaseExpiresAt: now() + assertTtl(input.ttlMs),
        };
        write(envelope);
        notify("lease", envelope);
        return grantOf(envelope);
      });
    },
    async release(input) {
      await withLock(input.sessionId, () => {
        const current = readRaw(input.sessionId);
        if (!current) return;
        if (current.ownerId !== input.ownerId || current.leaseId !== input.leaseId) return;
        const envelope: ResidencyEnvelope = {
          ...clone(current),
          revision: current.revision + 1,
          status: current.status === "done" ? "done" : "suspended",
          updatedAt: now(),
        };
        delete envelope.ownerId;
        delete envelope.leaseId;
        delete envelope.leaseExpiresAt;
        write(envelope);
        notify("lease", envelope);
      });
    },
    async compareAndSwap(input) {
      return withLock(input.sessionId, () => {
        const current = assertOwner(fresh(readRaw(input.sessionId)), input, now());
        if (current.revision !== input.expectedRevision) {
          throw new ContinuityAuthorityError("REVISION_CONFLICT", "任务版本已变化，请重新读取");
        }
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
        write(envelope);
        notify("checkpoint", envelope);
        return clone(envelope);
      });
    },
    async remove(input) {
      await withLock(input.sessionId, () => {
        const current = readRaw(input.sessionId);
        if (!current) return;
        if (current.ownerId !== input.ownerId || current.leaseId !== input.leaseId) {
          throw new ContinuityAuthorityError("OWNER_MISMATCH", "只有当前 owner 可以清除任务");
        }
        if (!storage) throw new ContinuityAuthorityError("STORE_UNAVAILABLE", "浏览器本地存储不可用");
        storage.removeItem(`${keyPrefix}${input.sessionId}`);
        notify("cleared", current);
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      channel?.removeEventListener("message", onChannel);
    },
  };
}
