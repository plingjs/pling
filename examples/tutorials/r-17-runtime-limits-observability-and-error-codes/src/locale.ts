export type DemoLocale = "en" | "zh";

export function resolveDemoLocale(): DemoLocale {
  return new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en";
}
