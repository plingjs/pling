import { translate, type MessageParams } from "./locale";
import type { PlingMessageKey } from "./messages";

/** Stable code → catalog key map for every `ActionErrorCode` in `@plingjs/core`. */
export const ACTION_ERROR_MESSAGE_KEYS = {
  DUPLICATE_ACTION_ID: "error.duplicate_action_id",
  DUPLICATE_STATE_KEY: "error.duplicate_state_key",
  DUPLICATE_GUIDE_TARGET: "error.duplicate_guide_target",
  ACTION_NOT_FOUND: "error.action_not_found",
  INVALID_ARGS: "error.invalid_args",
  INVALID_PARAMS: "error.invalid_params",
  PERMISSION_DENIED: "error.permission_denied",
  ACTION_UNAVAILABLE: "error.action_unavailable",
  EXECUTION_FAILED: "error.execution_failed",
  EXPECTATION_FAILED: "error.expectation_failed",
  HANDOFF_CANCELLED: "error.handoff_cancelled",
  HANDOFF_TIMEOUT: "error.handoff_timeout",
  HANDOFF_FAILED: "error.handoff_failed",
  STEP_FAILED: "error.step_failed",
  HOOK_BLOCKED: "error.hook_blocked",
  LOOP_DETECTED: "error.loop_detected",
} as const satisfies Record<string, PlingMessageKey>;

/** Runtime failures raised by the agent entry points, outside the action executor. */
export const RUNTIME_ERROR_MESSAGE_KEYS = {
  NOT_CONFIGURED: "error.not_configured",
  LLM_FAILED: "error.llm_failed",
  SEND_FAILED: "error.send_failed",
} as const satisfies Record<string, PlingMessageKey>;

export const ERROR_MESSAGE_KEYS = {
  ...ACTION_ERROR_MESSAGE_KEYS,
  ...RUNTIME_ERROR_MESSAGE_KEYS,
} as const satisfies Record<string, PlingMessageKey>;

/** Stable keys for configuration readiness diagnostics. */
export const DIAGNOSTIC_MESSAGE_KEYS = {
  MODEL_BASE_URL_MISSING: "diagnostic.config.base_url_missing",
  MODEL_NAME_MISSING: "diagnostic.config.model_missing",
  MODEL_API_KEY_MISSING: "diagnostic.config.api_key_missing",
  LIMITS_INVALID: "diagnostic.config.limits_invalid",
  RETRY_INVALID: "diagnostic.config.retry_invalid",
} as const satisfies Record<string, PlingMessageKey>;

export type PlingTranslator = (key: PlingMessageKey | (string & {}), params?: MessageParams) => string;

export interface PlingErrorText {
  /** Machine-readable code. It is never translated or omitted. */
  code: string;
  /** Developer/executor detail. Kept as a secondary diagnostic when useful. */
  message?: string;
  /** Optional catalog key for a fully localized diagnostic message. */
  messageKey?: string;
  params?: MessageParams;
}

export interface PlingDiagnosticText {
  ready: boolean;
  code?: string;
  params?: MessageParams;
  /** Developer-facing fallback used only when no structured diagnostic code exists. */
  hint?: string;
}

/** Map a known code to its catalog key; unknown codes still render with a localized generic label. */
export function knownErrorMessageKey(code: string): PlingMessageKey | undefined {
  return ERROR_MESSAGE_KEYS[code as keyof typeof ERROR_MESSAGE_KEYS];
}

export function errorMessageKey(code: string): PlingMessageKey {
  return knownErrorMessageKey(code) ?? "error.unknown";
}

export function diagnosticMessageKey(code: string | undefined): PlingMessageKey | undefined {
  if (!code) return undefined;
  return DIAGNOSTIC_MESSAGE_KEYS[code as keyof typeof DIAGNOSTIC_MESSAGE_KEYS];
}

function withoutCodePrefix(detail: string, code: string): string {
  return detail.replace(new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:：]\\s*`, "i"), "").trim();
}

/**
 * Render a runtime error without losing its protocol code.
 *
 * `messageKey` is reserved for diagnostics that are already localized end to end.
 * For ordinary executor errors, the localized code label comes first and the raw
 * technical detail remains a secondary (untranslated) payload.
 */
export function describePlingError(error: PlingErrorText, t: PlingTranslator): string {
  const requestedKey = error.messageKey?.trim();
  let key = requestedKey || errorMessageKey(error.code);
  let message = t(key, error.params);
  let localizedDiagnostic = Boolean(requestedKey) && message !== requestedKey;

  if (message === key) {
    key = errorMessageKey(error.code);
    message = t(key, error.params);
    localizedDiagnostic = false;
  }

  const summary = t("error.format.summary", { code: error.code, message });
  if (localizedDiagnostic) return summary;

  const detail = withoutCodePrefix((error.message ?? "").trim(), error.code);
  if (!detail || detail === error.code || detail === message) return summary;
  return t("error.format.detail", { summary, detail });
}

/** Render a structured configuration diagnostic. The raw hint is only a last-resort fallback. */
export function describePlingDiagnostic(diagnostic: PlingDiagnosticText, t: PlingTranslator): string {
  if (diagnostic.ready) return "";
  const key = diagnosticMessageKey(diagnostic.code);
  if (key) return t(key, diagnostic.params);
  return diagnostic.hint?.trim() || t("diagnostic.config.unknown");
}

/** Convenience for headless callers that only have a locale string. */
export function describePlingErrorForLocale(
  error: PlingErrorText,
  locale: string,
): string {
  return describePlingError(error, (key, params) => translate(locale, key, params));
}
