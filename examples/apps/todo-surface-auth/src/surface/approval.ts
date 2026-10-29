import { shallowRef } from "vue";
import type { Confirm, ConfirmRequest } from "@plingjs/core";

export interface ExternalApprovalRequest extends ConfirmRequest {
  requestedAt: number;
  expiresAt: number;
}

/**
 * Human confirmation queue for an external Agent.
 *
 * It is rendered in the business page. The Agent receives only a pending state
 * and never gets a way to call `decide()`.
 */
export function createExternalApproval(options: { timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const current = shallowRef<ExternalApprovalRequest | null>(null);
  let settleCurrent: ((decision: boolean | "always") => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const settle = (decision: boolean | "always"): void => {
    const finish = settleCurrent;
    settleCurrent = null;
    if (timer) clearTimeout(timer);
    timer = null;
    current.value = null;
    finish?.(decision);
  };

  const confirm: Confirm = (request) =>
    new Promise((resolve) => {
      if (settleCurrent) settle(false);
      settleCurrent = resolve;
      const requestedAt = Date.now();
      const entry: ExternalApprovalRequest = { ...request, requestedAt, expiresAt: requestedAt + timeoutMs };
      current.value = entry;
      timer = setTimeout(() => {
        if (current.value === entry) settle(false);
      }, timeoutMs);
    });

  return {
    current,
    confirm,
    decide(approved: boolean) {
      if (settleCurrent) settle(approved);
    },
    close() {
      if (settleCurrent) settle(false);
    },
  };
}

export type ExternalApproval = ReturnType<typeof createExternalApproval>;
