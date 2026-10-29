import type { AgentConfig } from "@plingjs/agent";

/**
 * How much control the page exposes over the model connection.
 *
 * `off` is the default. `readonly` is for applications whose gateway owns the
 * endpoint and key. `byok` is an explicit opt-in for local tools and trusted
 * internal pages; it is not the public-demo path described in MODEL-ACCESS-01.
 */
export type ModelSettingsMode = "off" | "readonly" | "byok";

/** Where an explicitly entered BYOK configuration survives while the page is open. */
export type ModelSettingsPersistence = "memory" | "session";

export interface ModelSettingsOptions {
  mode: ModelSettingsMode;
  /**
   * `memory` (default) keeps the key for this mounted runtime only.
   * `session` keeps it in sessionStorage until the tab closes.
   *
   * localStorage is intentionally not supported.
   */
  persist?: ModelSettingsPersistence;
}

export type ModelSettingsSetting = ModelSettingsMode | ModelSettingsOptions;

export interface UserModelSettings {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface ResolvedModelSettings {
  mode: ModelSettingsMode;
  persist: ModelSettingsPersistence;
}

export const MODEL_SETTINGS_STORAGE_KEY = "pling:model-settings";

export function resolveModelSettings(setting?: ModelSettingsSetting): ResolvedModelSettings {
  if (typeof setting === "string") {
    return { mode: setting, persist: "memory" };
  }
  return {
    mode: setting?.mode ?? "off",
    persist: setting?.mode === "byok" ? (setting.persist ?? "memory") : "memory",
  };
}

function browserSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Read only the three fields we own; malformed or partial entries are ignored. */
export function readUserModelSettings(storage: Storage | null = browserSessionStorage()): UserModelSettings | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(MODEL_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<UserModelSettings> | null;
    const baseUrl = text(value?.baseUrl);
    const model = text(value?.model);
    const apiKey = text(value?.apiKey);
    if (!baseUrl || !model) return null;
    return { baseUrl, model, apiKey };
  } catch {
    return null;
  }
}

export function writeUserModelSettings(
  settings: UserModelSettings,
  storage: Storage | null = browserSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(MODEL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota, privacy mode, or a blocked storage origin: keeping the current
    // runtime useful matters more than failing the save.
  }
}

export function clearUserModelSettings(storage: Storage | null = browserSessionStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(MODEL_SETTINGS_STORAGE_KEY);
  } catch {
    // See writeUserModelSettings.
  }
}

/** Overlay the user's endpoint and model on the application-resolved config. */
export function applyUserModelSettings(base: AgentConfig, settings: UserModelSettings | null): AgentConfig {
  if (!settings) return base;
  return {
    ...base,
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKey: settings.apiKey,
  };
}

export type ModelSettingsError = "base_url" | "model" | "api_key";

/** Local validation used before replacing a working runtime. */
export function validateUserModelSettings(settings: UserModelSettings): ModelSettingsError | null {
  if (!settings.baseUrl.trim()) return "base_url";
  if (!settings.model.trim()) return "model";
  if (/^https?:\/\//i.test(settings.baseUrl.trim()) && !settings.apiKey.trim()) return "api_key";
  return null;
}
