import type { PageView } from "@plingjs/core";

const SAFE_QUERY_KEYS = ["lang"] as const;

function safeQuery(search: URLSearchParams): Record<string, string> | undefined {
  const query: Record<string, string> = {};
  for (const key of SAFE_QUERY_KEYS) {
    const value = search.get(key);
    if (value) query[key] = value;
  }
  return Object.keys(query).length > 0 ? query : undefined;
}

/**
 * 页面身份必须来自当前部署位置，不能写死站点根路径。
 *
 * 教程预览会挂在 `/demos/tutorials/vanilla/j-11/demo/` 这样的子目录下；
 * 连续性返回如果使用 `/demo/index.html`，整页跳转就会落到文档站的 404。
 */
export function currentPage(title: string): PageView {
  if (typeof location === "undefined") return { title };
  const query = safeQuery(new URL(location.href).searchParams);
  return {
    path: location.pathname || "/",
    title,
    ...(query ? { query } : {}),
  };
}

/** 同目录页面的可导航地址，并保留教程语言参数。 */
export function siblingHref(name: string): string {
  if (typeof location === "undefined") return name;
  const current = new URL(location.href);
  const target = new URL(name, current);
  const query = safeQuery(current.searchParams);
  if (query) {
    for (const [key, value] of Object.entries(query)) target.searchParams.set(key, value);
  }
  return `${target.pathname}${target.search}${target.hash}`;
}
