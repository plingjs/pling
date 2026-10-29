import type { DelegationEventBus, DelegationInvalidationEvent } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeDelegationEvent(value: unknown): DelegationInvalidationEvent | null {
  if (!isRecord(value)) return null;
  if (value.type !== "credential_revoked") return null;
  if (value.reason !== "revoked" && value.reason !== "rotated") return null;
  if (
    typeof value.at !== "number" ||
    typeof value.credentialId !== "string" ||
    typeof value.delegationId !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.agentId !== "string" ||
    (value.replacedBy !== undefined && typeof value.replacedBy !== "string")
  ) {
    return null;
  }
  return {
    type: "credential_revoked",
    reason: value.reason,
    at: value.at,
    credentialId: value.credentialId,
    delegationId: value.delegationId,
    sessionId: value.sessionId,
    userId: value.userId,
    agentId: value.agentId,
    ...(value.replacedBy === undefined ? {} : { replacedBy: value.replacedBy }),
  };
}

export interface MemoryDelegationEventBus extends DelegationEventBus {
  size(): number;
}

/** 进程内、按 userId 隔离的事件总线。单个订阅者抛错不会打断其他订阅者。 */
export function createMemoryDelegationEventBus(): MemoryDelegationEventBus {
  const byUser = new Map<string, Set<(event: DelegationInvalidationEvent) => void>>();
  let closed = false;

  const subscribe = (userId: string, listener: (event: DelegationInvalidationEvent) => void): (() => void) => {
    if (closed || !userId || typeof listener !== "function") return () => {};
    const listeners = byUser.get(userId) ?? new Set();
    listeners.add(listener);
    byUser.set(userId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) byUser.delete(userId);
    };
  };

  const publish = (event: DelegationInvalidationEvent): void => {
    if (closed) return;
    const normalized = normalizeDelegationEvent(event);
    if (!normalized) return;
    const listeners = byUser.get(normalized.userId);
    if (!listeners) return;
    for (const listener of [...listeners]) {
      try {
        listener(normalized);
      } catch {
        // 一个断开的 SSE 连接不能阻塞其他订阅者或业务请求。
      }
    }
  };

  const close = (): void => {
    closed = true;
    byUser.clear();
  };

  return {
    subscribe,
    publish,
    close,
    size: () => [...byUser.values()].reduce((total, listeners) => total + listeners.size, 0),
  };
}
