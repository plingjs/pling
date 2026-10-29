import { resolveLocale, translate, type MessageParams } from "./locale";
import {
  resolveTheme,
  type PlingClassNames,
  type PlingTheme,
  type PlingThemeTokens,
} from "./theme";
import { DEFAULT_LOCALE, type PlingCatalogOverrides, type PlingLocale } from "./messages";

export interface PlingUiOptions {
  /** BCP 47 language tag. Use "auto" to opt into browser language detection. */
  locale?: PlingLocale;
  theme?: PlingTheme;
  /** Extra or replacement messages, keyed by locale. */
  messages?: PlingCatalogOverrides;
  classNames?: PlingClassNames;
}

/** Framework-independent snapshot. React / Vue / Vanilla render from this same shape. */
export interface PlingUiSnapshot {
  locale: string;
  theme: PlingTheme;
  resolvedTheme: "light" | "dark";
  cssVars: Record<string, string>;
  tokens: PlingThemeTokens;
}

export interface PlingUiController {
  readonly classNames: PlingClassNames;
  readonly snapshot: PlingUiSnapshot;
  readonly locale: string;
  readonly theme: PlingTheme;
  readonly resolvedTheme: "light" | "dark";
  readonly cssVars: Record<string, string>;
  readonly tokens: PlingThemeTokens;
  t(key: string, params?: MessageParams): string;
  setLocale(locale: string): void;
  setTheme(theme: PlingTheme): void;
  getSnapshot(): PlingUiSnapshot;
  subscribe(listener: () => void): () => void;
  destroy(): void;
}

function browserLanguages(): string[] {
  if (typeof navigator === "undefined") return [];
  if (Array.isArray(navigator.languages) && navigator.languages.length) return [...navigator.languages];
  return navigator.language ? [navigator.language] : [];
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function sameSnapshot(a: PlingUiSnapshot, b: PlingUiSnapshot): boolean {
  return (
    a.locale === b.locale &&
    sameTheme(a.theme, b.theme) &&
    a.resolvedTheme === b.resolvedTheme &&
    sameRecord(a.cssVars, b.cssVars)
  );
}

function sameTheme(a: PlingTheme, b: PlingTheme): boolean {
  if (typeof a === "string" || typeof b === "string") return a === b;
  return a.mode === b.mode && sameOptionalRecord(a.tokens, b.tokens);
}

function sameOptionalRecord(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined,
): boolean {
  if (!a || !b) return a === b;
  return sameRecord(a, b);
}

function sameRecord(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

/**
 * The single source of truth for framework UI language and theme.
 *
 * It stays outside every adapter: Vue wraps it in refs, React reads it through
 * `useSyncExternalStore`, and Vanilla subscribes directly. That keeps message
 * keys and CSS variables identical across all three surfaces.
 */
export function createUiController(
  options: PlingUiOptions = {},
  defaultLocale: string = DEFAULT_LOCALE,
): PlingUiController {
  let locale = resolveLocale(options.locale ?? defaultLocale, {
    languages: browserLanguages(),
    catalogs: options.messages,
  });
  let theme: PlingTheme = options.theme ?? "light";
  let prefersDark = systemPrefersDark();
  let resolved = resolveTheme(theme, { prefersDark });

  function snapshotOf(): PlingUiSnapshot {
    return {
      locale,
      theme,
      resolvedTheme: resolved.mode,
      cssVars: resolved.cssVars,
      tokens: resolved.tokens,
    };
  }

  let snapshot = snapshotOf();
  const listeners = new Set<() => void>();

  function notify(): void {
    const next = snapshotOf();
    if (sameSnapshot(snapshot, next)) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  }

  let media: MediaQueryList | null = null;
  const onMediaChange = (event: MediaQueryListEvent): void => {
    prefersDark = event.matches;
    resolved = resolveTheme(theme, { prefersDark });
    notify();
  };
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    media = window.matchMedia("(prefers-color-scheme: dark)");
    if (typeof media.addEventListener === "function") media.addEventListener("change", onMediaChange);
    else media.addListener?.(onMediaChange);
  }

  return {
    classNames: options.classNames ?? {},
    get snapshot() {
      return snapshot;
    },
    get locale() {
      return locale;
    },
    get theme() {
      return theme;
    },
    get resolvedTheme() {
      return resolved.mode;
    },
    get cssVars() {
      return resolved.cssVars;
    },
    get tokens() {
      return resolved.tokens;
    },
    t(key, params) {
      return translate(locale, key, params, { catalogs: options.messages });
    },
    setLocale(value) {
      const next = resolveLocale(value, {
        languages: browserLanguages(),
        catalogs: options.messages,
      });
      if (next === locale) return;
      locale = next;
      notify();
    },
    setTheme(value) {
      theme = value;
      resolved = resolveTheme(theme, { prefersDark });
      notify();
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (!media) return;
      if (typeof media.removeEventListener === "function") media.removeEventListener("change", onMediaChange);
      else media.removeListener?.(onMediaChange);
      media = null;
      listeners.clear();
    },
  };
}
