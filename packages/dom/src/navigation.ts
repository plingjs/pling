/**
 * 同源跳转的地址解析。
 *
 * 自动返回只允许落在当前 origin 内：`returnOnDone` 是开发者配置，但仍不应该成为
 * 「任务被提示注入后把用户带去外站」的出口。相对地址按当前 document 解析。
 */
export function sameOriginUrl(href: string, base?: string): string | null {
  if (!href.trim()) return null;
  const baseHref =
    base ?? (typeof location === "undefined" ? undefined : location.href);
  if (!baseHref) return null;
  try {
    const from = new URL(baseHref);
    const target = new URL(href, from);
    return target.origin === from.origin ? target.href : null;
  } catch {
    return null;
  }
}
