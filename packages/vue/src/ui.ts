import { shallowRef } from "vue";
import {
  DEFAULT_LOCALE,
  createUiController,
  type MessageParams,
  type PlingClassNames,
  type PlingMessageKey,
  type PlingTheme,
  type PlingUiOptions,
  type PlingUiSnapshot,
} from "@plingjs/ui";

/** Locale used by the Vue adapter when `ui.locale` is omitted. */
export const DEFAULT_VUE_LOCALE = "en-US";

export interface PlingUiController {
  readonly locale: string;
  readonly theme: PlingTheme;
  readonly resolvedTheme: "light" | "dark";
  readonly cssVars: Record<string, string>;
  readonly classNames: PlingClassNames;
  t(key: PlingMessageKey | (string & {}), params?: MessageParams): string;
  setLocale(locale: string): void;
  setTheme(theme: PlingTheme): void;
  destroy(): void;
}

/**
 * Vue's reactive shell over the framework-independent UI controller.
 * The shared controller owns locale resolution, matchMedia and message lookup;
 * this file only turns its snapshot into Vue refs so templates update in place.
 */
export function createPlingUi(
  options: PlingUiOptions | undefined,
  defaultLocale: string = DEFAULT_LOCALE,
): PlingUiController {
  const core = createUiController(options, defaultLocale);
  const state = shallowRef<PlingUiSnapshot>(core.snapshot);
  const unsubscribe = core.subscribe(() => {
    state.value = core.getSnapshot();
  });

  return {
    get locale() {
      return state.value.locale;
    },
    get theme() {
      return state.value.theme;
    },
    get resolvedTheme() {
      return state.value.resolvedTheme;
    },
    get cssVars() {
      return state.value.cssVars;
    },
    classNames: core.classNames,
    t(key, params) {
      // Reading the snapshot inside t() is what makes computed/template calls track locale changes.
      void state.value.locale;
      return core.t(key, params);
    },
    setLocale(value) {
      core.setLocale(value);
    },
    setTheme(value) {
      core.setTheme(value);
    },
    destroy() {
      unsubscribe();
      core.destroy();
    },
  };
}

const STANDALONE = createUiController({ locale: DEFAULT_LOCALE });

/** Used by standalone <AgentChat> outside a Pling app. */
export const STANDALONE_UI: PlingUiController = {
  locale: DEFAULT_LOCALE,
  theme: "light",
  resolvedTheme: STANDALONE.resolvedTheme,
  cssVars: STANDALONE.cssVars,
  classNames: {},
  t: (key, params) => STANDALONE.t(key, params),
  setLocale: () => {},
  setTheme: () => {},
  destroy: () => {},
};
