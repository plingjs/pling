export type PlingThemeMode = "light" | "dark" | "auto";

/** `plain` is the current default surface; `legacy` preserves the pre-UI-01 palette. */
export type PlingThemePreset = "plain" | "legacy";

export interface PlingThemeTokens {
  colorBg: string;
  colorSurface: string;
  colorSurfaceMuted: string;
  colorText: string;
  colorTextMuted: string;
  colorTextSubtle: string;
  colorBorder: string;
  colorBorderMuted: string;
  colorPrimary: string;
  colorPrimaryStrong: string;
  colorPrimarySoft: string;
  colorOnPrimary: string;
  colorDanger: string;
  colorDangerSoft: string;
  colorWarning: string;
  colorWarningSoft: string;
  colorSuccess: string;
  colorSuccessSoft: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  shadowPanel: string;
  shadowLauncher: string;
  fontFamily: string;
  fontFamilyMono: string;
}

export interface PlingThemeOverrides {
  mode?: PlingThemeMode;
  preset?: PlingThemePreset;
  tokens?: Partial<PlingThemeTokens>;
}

export type PlingTheme = PlingThemeMode | PlingThemeOverrides;

export const PLAIN_LIGHT_THEME: PlingThemeTokens = {
  colorBg: "#ffffff",
  colorSurface: "#ffffff",
  colorSurfaceMuted: "#f7f8fa",
  colorText: "#17181c",
  colorTextMuted: "#6d7280",
  colorTextSubtle: "#9297a1",
  colorBorder: "#e8eaf0",
  colorBorderMuted: "#f1f2f5",
  colorPrimary: "#2e9df7",
  colorPrimaryStrong: "#086aa8",
  colorPrimarySoft: "#eaf6ff",
  colorOnPrimary: "#ffffff",
  colorDanger: "#a73737",
  colorDangerSoft: "#fff7f7",
  colorWarning: "#765a1f",
  colorWarningSoft: "#fffbf1",
  colorSuccess: "#17794e",
  colorSuccessSoft: "#eaf8f0",
  radiusSm: "7px",
  radiusMd: "10px",
  radiusLg: "14px",
  shadowPanel: "0 12px 32px rgb(22 24 32 / 8%)",
  shadowLauncher: "0 8px 22px rgb(22 58 86 / 12%)",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  fontFamilyMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

export const PLAIN_DARK_THEME: PlingThemeTokens = {
  ...PLAIN_LIGHT_THEME,
  colorBg: "#111216",
  colorSurface: "#17181c",
  colorSurfaceMuted: "#1d1f24",
  colorText: "#f3f4f6",
  colorTextMuted: "#a3a8b3",
  colorTextSubtle: "#7e8490",
  colorBorder: "#2a2d34",
  colorBorderMuted: "#21242a",
  colorPrimary: "#64b5ff",
  colorPrimaryStrong: "#9bd2ff",
  colorPrimarySoft: "#162b3d",
  colorOnPrimary: "#07131f",
  colorDanger: "#f3a7a7",
  colorDangerSoft: "#3b171c",
  colorWarning: "#f0cc80",
  colorWarningSoft: "#382b12",
  colorSuccess: "#8ee0b4",
  colorSuccessSoft: "#112d1d",
  shadowPanel: "0 18px 44px rgb(0 0 0 / 48%)",
  shadowLauncher: "0 10px 26px rgb(0 0 0 / 46%)",
};

/** Frozen pre-UI-01 palette, available through `preset: "legacy"`. */
export const LEGACY_LIGHT_THEME: PlingThemeTokens = {
  colorBg: "#ffffff",
  colorSurface: "#ffffff",
  colorSurfaceMuted: "#f8fafc",
  colorText: "#0f172a",
  colorTextMuted: "#64748b",
  colorTextSubtle: "#94a3b8",
  colorBorder: "#e3e8f0",
  colorBorderMuted: "#f1f5f9",
  colorPrimary: "#2e9df7",
  colorPrimaryStrong: "#1677c8",
  colorPrimarySoft: "#eaf6ff",
  colorOnPrimary: "#ffffff",
  colorDanger: "#b91c1c",
  colorDangerSoft: "#fee2e2",
  colorWarning: "#9a6700",
  colorWarningSoft: "#fff7ed",
  colorSuccess: "#15803d",
  colorSuccessSoft: "#f0fdf4",
  radiusSm: "6px",
  radiusMd: "8px",
  radiusLg: "12px",
  shadowPanel: "0 18px 40px rgb(15 23 42 / 16%)",
  shadowLauncher: "0 10px 24px rgb(46 157 247 / 32%)",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  fontFamilyMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

export const LEGACY_DARK_THEME: PlingThemeTokens = {
  ...LEGACY_LIGHT_THEME,
  colorBg: "#0f172a",
  colorSurface: "#111c31",
  colorSurfaceMuted: "#17243a",
  colorText: "#e5edf8",
  colorTextMuted: "#9db0c8",
  colorTextSubtle: "#7185a0",
  colorBorder: "#2a3b55",
  colorBorderMuted: "#1d2b43",
  colorPrimary: "#56b4ff",
  colorPrimaryStrong: "#8ccdff",
  colorPrimarySoft: "#112f4b",
  colorOnPrimary: "#07131f",
  colorDanger: "#fca5a5",
  colorDangerSoft: "#3b171c",
  colorWarning: "#fcd34d",
  colorWarningSoft: "#382b12",
  colorSuccess: "#86efac",
  colorSuccessSoft: "#112d1d",
  shadowPanel: "0 18px 44px rgb(0 0 0 / 48%)",
  shadowLauncher: "0 10px 26px rgb(0 0 0 / 46%)",
};

/** Current aliases. `LIGHT_THEME` and `DARK_THEME` now resolve to the plain preset. */
export const LIGHT_THEME = PLAIN_LIGHT_THEME;
export const DARK_THEME = PLAIN_DARK_THEME;

export interface ResolveThemeOptions {
  prefersDark?: boolean;
}

export interface ResolvedTheme {
  mode: "light" | "dark";
  tokens: PlingThemeTokens;
  cssVars: Record<string, string>;
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function themeCssVars(tokens: PlingThemeTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(tokens)) {
    vars[`--pling-${kebab(name)}`] = value;
  }
  return vars;
}

export function resolveTheme(theme: PlingTheme | undefined, options: ResolveThemeOptions = {}): ResolvedTheme {
  const config: PlingThemeOverrides = typeof theme === "string" || theme === undefined ? { mode: theme } : theme;
  const preference = config.mode ?? "light";
  const mode = preference === "auto" ? (options.prefersDark ? "dark" : "light") : preference;
  const preset = config.preset ?? "plain";
  const base =
    preset === "legacy"
      ? mode === "dark"
        ? LEGACY_DARK_THEME
        : LEGACY_LIGHT_THEME
      : mode === "dark"
        ? PLAIN_DARK_THEME
        : PLAIN_LIGHT_THEME;
  const tokens = { ...base, ...(config.tokens ?? {}) };
  return { mode, tokens, cssVars: themeCssVars(tokens) };
}

export interface PlingClassNames {
  dock?: string;
  panel?: string;
  launcher?: string;
  chat?: string;
}
