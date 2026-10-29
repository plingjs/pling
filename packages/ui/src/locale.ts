import {
  BUILTIN_MESSAGES,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  type PlingCatalogOverrides,
  type PlingMessageKey,
} from "./messages";

function canonical(value: string): string {
  return value.trim().replaceAll("_", "-").toLowerCase();
}

function baseLanguage(value: string): string {
  return canonical(value).split("-")[0] ?? canonical(value);
}

function matchOne(requested: string, available: readonly string[]): string | null {
  const wanted = canonical(requested);
  if (!wanted) return null;
  const exact = available.find((item) => canonical(item) === wanted);
  if (exact) return exact;
  const language = baseLanguage(wanted);
  return available.find((item) => baseLanguage(item) === language) ?? null;
}

export interface ResolveLocaleOptions {
  /** Browser language list, in preference order. Used only when locale is "auto". */
  languages?: readonly string[];
  /** Additional locale tags supplied through custom catalogs. */
  catalogs?: PlingCatalogOverrides;
}

export function availableLocales(catalogs?: PlingCatalogOverrides): string[] {
  const names = new Set<string>([...Object.keys(BUILTIN_MESSAGES), ...Object.keys(catalogs ?? {})]);
  return [...names];
}

/**
 * Resolve a locale without silently switching languages.
 * "auto" must be opted into; otherwise an unsupported locale falls back to English.
 */
export function resolveLocale(locale: string | undefined, options: ResolveLocaleOptions = {}): string {
  const available = availableLocales(options.catalogs);
  const requested = locale?.trim();
  if (requested && requested !== "auto") {
    return matchOne(requested, available) ?? FALLBACK_LOCALE;
  }
  if (requested === "auto") {
    for (const language of options.languages ?? []) {
      const matched = matchOne(language, available);
      if (matched) return matched;
    }
  }
  return DEFAULT_LOCALE;
}

function catalogFor(locale: string, catalogs?: PlingCatalogOverrides): Readonly<Record<string, string>> {
  const builtin = BUILTIN_MESSAGES[locale] ?? BUILTIN_MESSAGES[FALLBACK_LOCALE] ?? {};
  const extra = catalogs?.[locale] ?? {};
  return { ...builtin, ...extra };
}

export interface TranslateOptions {
  catalogs?: PlingCatalogOverrides;
  fallbackLocale?: string;
}

export type MessageParams = Record<string, string | number | boolean | null | undefined>;

export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/** Translate a stable message key. Missing translations fall back, then return the key. */
export function translate(
  locale: string,
  key: PlingMessageKey | (string & {}),
  params?: MessageParams,
  options: TranslateOptions = {},
): string {
  const catalog = catalogFor(locale, options.catalogs);
  const fallback = catalogFor(options.fallbackLocale ?? FALLBACK_LOCALE, options.catalogs);
  const template = catalog[key] ?? fallback[key] ?? key;
  return interpolate(template, params);
}

export function createTranslator(
  getLocale: () => string,
  options: TranslateOptions = {},
): (key: PlingMessageKey | (string & {}), params?: MessageParams) => string {
  return (key, params) => translate(getLocale(), key, params, options);
}
