import {
  DEFAULT_LOCALE,
  createUiController,
  type MessageParams,
  type PlingClassNames,
  type PlingMessageKey,
  type PlingTheme,
  type PlingUiOptions,
} from "@plingjs/ui";

/** The plain-DOM UI controller. It updates subscribers in place, without a framework adapter. */
export interface VanillaUiController {
  readonly locale: string;
  readonly theme: PlingTheme;
  readonly resolvedTheme: "light" | "dark";
  readonly cssVars: Record<string, string>;
  readonly classNames: PlingClassNames;
  t(key: PlingMessageKey | (string & {}), params?: MessageParams): string;
  setLocale(locale: string): void;
  setTheme(theme: PlingTheme): void;
  subscribe(listener: () => void): () => void;
  destroy(): void;
}

export function createPlingUi(
  options?: PlingUiOptions,
  defaultLocale: string = DEFAULT_LOCALE,
): VanillaUiController {
  return createUiController(options, defaultLocale);
}
