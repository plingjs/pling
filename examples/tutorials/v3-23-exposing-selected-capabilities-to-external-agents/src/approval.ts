import { shallowRef } from "vue";
import type { Confirm, ConfirmRequest } from "@plingjs/core";

export interface ApprovalRequest extends ConfirmRequest {
  requestedAt: number;
}

export function createApproval() {
  const current = shallowRef<ApprovalRequest | null>(null);
  let resolve: ((decision: boolean | "always") => void) | null = null;

  const confirm: Confirm = (request) =>
    new Promise((done) => {
      resolve?.(false);
      resolve = done;
      current.value = { ...request, requestedAt: Date.now() };
    });

  const decide = (approved: boolean): void => {
    resolve?.(approved);
    resolve = null;
    current.value = null;
  };

  return { current, confirm, decide };
}
