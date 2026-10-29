import { shallowRef } from "vue";
import type { Confirm, ConfirmRequest } from "@plingjs/core";

export interface ApprovalRequest extends ConfirmRequest {
  requestedAt: number;
  expiresAt: number;
}

type ApprovalListener = (request: ApprovalRequest | null) => void;
const APPROVAL_WINDOW_MS = 120_000;

export function createApproval() {
  const current = shallowRef<ApprovalRequest | null>(null);
  const listeners = new Set<ApprovalListener>();
  let resolve: ((decision: boolean | "always") => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const confirm: Confirm = (request) =>
    new Promise((done) => {
      if (timer) clearTimeout(timer);
      resolve?.(false);
      resolve = done;
      const requestedAt = Date.now();
      const next = { ...request, requestedAt, expiresAt: requestedAt + APPROVAL_WINDOW_MS };
      current.value = next;
      for (const listener of listeners) listener(next);
      timer = setTimeout(() => {
        if (current.value !== next) return;
        resolve?.(false);
        resolve = null;
        current.value = null;
        timer = null;
        for (const listener of listeners) listener(null);
      }, APPROVAL_WINDOW_MS);
    });

  const decide = (approved: boolean): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    resolve?.(approved);
    resolve = null;
    current.value = null;
    for (const listener of listeners) listener(null);
  };

  const subscribe = (listener: ApprovalListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return { current, confirm, decide, subscribe };
}
