import type { MessageParams } from "./locale";

export interface AvailabilityReasonFields {
  reason?: string;
  reasonKey?: string;
  reasonParams?: MessageParams;
  reasonSuffix?: string;
}

/**
 * Format a reason for people without changing the stable English reason sent
 * to the model. Developer-authored text is appended after framework text.
 */
export function formatAvailabilityReason(
  value: AvailabilityReasonFields,
  t: (key: string, params?: MessageParams) => string,
): string {
  if (value.reasonKey) {
    const primary = t(value.reasonKey, value.reasonParams);
    return value.reasonSuffix ? `${primary} · ${value.reasonSuffix}` : primary;
  }
  return value.reason ?? value.reasonSuffix ?? "";
}
