export type PlingThemeMode = "light" | "dark" | "auto";

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
  tokens?: Partial<PlingThemeTokens>;
}

export type PlingTheme = PlingThemeMode | PlingThemeOverrides;

export const LIGHT_THEME: PlingThemeTokens = {
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

export const DARK_THEME: PlingThemeTokens = {
  ...LIGHT_THEME,
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
  const base = mode === "dark" ? DARK_THEME : LIGHT_THEME;
  const tokens = { ...base, ...(config.tokens ?? {}) };
  return { mode, tokens, cssVars: themeCssVars(tokens) };
}

export interface PlingClassNames {
  dock?: string;
  panel?: string;
  launcher?: string;
  chat?: string;
}
