export type Locale = "en" | "zh";

export function resolveLocale(): Locale {
  return new URLSearchParams(location.search).get("lang")?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function bilingual(en: string, zh: string): string {
  return resolveLocale() === "zh" ? zh : en;
}
