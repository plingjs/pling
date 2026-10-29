import type { Confirm, ConfirmRequest } from "@plingjs/core";

export interface ApprovalRequest extends ConfirmRequest {
  requestedAt: number;
}

export interface ApprovalStore {
  current(): ApprovalRequest | null;
  subscribe(listener: () => void): () => void;
  confirm: Confirm;
  decide(approved: boolean): void;
}

export function createApproval(): ApprovalStore {
  let current: ApprovalRequest | null = null;
  let resolve: ((decision: boolean | "always") => void) | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    current: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    confirm(request) {
      return new Promise((done) => {
        resolve?.(false);
        resolve = done;
        current = { ...request, requestedAt: Date.now() };
        emit();
      });
    },
    decide(approved) {
      resolve?.(approved);
      resolve = null;
      current = null;
      emit();
    },
  };
}
