/**
 * 页面身份（S10a）：`location` / `document.title` / 可选的路由实例。
 *
 * 三层来源，越具体越优先：
 *   1. 显式传入的 Vue Router（能拿到 route.name / params / meta.title）；
 *   2. 浏览器地址（pathname / hash）与 document.title；
 *   3. `title` 选项的兜底 / 覆盖。
 *
 * `query` 默认**不读取**。URL 里常有一性签名、token、回跳地址；
 * 想要某个 key，必须写进 `queryKeys`，框架只挑这些 key 交给模型。
 */
import type { PageView, Registry } from "@plingjs/core";

/** Vue Router 4 的最小结构：不 import vue-router，避免把路由变成硬依赖 */
export interface PageRouteLike {
  path?: string;
  name?: unknown;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  hash?: string;
  meta?: Record<string, unknown>;
}

export interface PageRouterLike {
  currentRoute?: { value?: PageRouteLike };
  afterEach?(hook: () => void): (() => void) | void;
}

export interface PageOptions {
  /** 关掉自动收集（等价于 `createPling({ page: false })`） */
  enabled?: boolean;
  /** Vue Router 实例；不传时在 `app.mount()` 后尝试读 `app.config.globalProperties.$router` */
  router?: PageRouterLike;
  /** 允许进入上下文的 query key；默认空数组（query 一个都不给模型） */
  queryKeys?: readonly string[];
  /** 是否带 hash 片段，默认 true；带 `=` / `?` 的 hash 会被视为查询串而忽略 */
  hash?: boolean;
  /** 标题覆盖 / 兜底（优先于 route.meta.title 与 document.title） */
  title?: () => string | undefined;
}

export interface PageTracker {
  /** 应用挂载后启动；router 可显式传，也可省略（自动探测） */
  start(router?: PageRouterLike): void;
  /** 立即重读一次（测试 / 手动路由完成回调可调） */
  sync(): void;
  /** 停止监听；只有本实例写入过页面身份时才清空它 */
  stop(): void;
}

interface RouteSnapshot {
  route?: PageRouteLike;
}

function routeOf(router: PageRouterLike | undefined): RouteSnapshot {
  return { route: router?.currentRoute?.value };
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function routeName(value: unknown): string | undefined {
  if (typeof value === "string") return text(value);
  if (typeof value === "symbol") return value.description;
  return undefined;
}

function safeHash(value: string | undefined): string | undefined {
  const hash = text(value);
  if (!hash || hash === "#") return undefined;
  const raw = hash.replace(/^#/, "");
  // `#access_token=...` / `#/?a=b` 本质是查询串，默认不送进模型。
  if (raw.includes("=") || raw.includes("?")) return undefined;
  return hash;
}

function pickQuery(
  route: PageRouteLike | undefined,
  win: Window | undefined,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  if (keys.length === 0) return undefined;
  const params = new URLSearchParams(win?.location.search ?? "");
  const source = route?.query ?? {};
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = source[key] ?? params.get(key) ?? undefined;
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readPage(
  options: PageOptions,
  router: PageRouterLike | undefined,
): PageView | undefined {
  const win = typeof window === "undefined" ? undefined : window;
  const doc = win?.document;
  const route = routeOf(router).route;
  const metaTitle = text(route?.meta?.title);
  const title = text(options.title?.()) ?? metaTitle ?? text(doc?.title);
  const path = text(route?.path) ?? text(win?.location.pathname);
  const params = route?.params && Object.keys(route.params).length > 0 ? route.params : undefined;
  const hash = options.hash === false ? undefined : safeHash(route?.hash ?? win?.location.hash);
  const query = pickQuery(route, win, options.queryKeys ?? []);
  const page: PageView = {
    ...(path ? { path } : {}),
    ...(title ? { title } : {}),
    ...(routeName(route?.name) ? { name: routeName(route?.name)! } : {}),
    ...(params ? { params } : {}),
    ...(query ? { query } : {}),
    ...(hash ? { hash } : {}),
  };
  return Object.keys(page).length > 0 ? page : undefined;
}

/**
 * 一个共享页面只允许**第一个**页面跟踪器写入身份。
 *
 * 同源 iframe 显式共享 `PlingPage` 时，父子页面会拿到同一份 registry；子页面的
 * `location.pathname`（例如 `/frame.html`）不能覆盖用户真正所在的顶层页面。
 * 多个适配器共处同一 document 时它们读到的是同一份地址，先写者拥有也不会丢信息。
 * 所有权锚点是命名空间投影**之前**的 base registry —— `namespace` 会生成不同的 Proxy，
 * 不能让同一个 `PlingPage` 因为 id 前缀不同就变成两个页面。
 * 子页面卸载时也不会再把父页面的身份清空。
 */
const pageOwners = new WeakMap<Registry, symbol>();

/**
 * 全局 history 补丁：Vue Router / 手写 pushState 都不会触发 popstate。
 * 用引用计数共享一份补丁，最后一份监听退订时恢复原方法。
 */
const historyListeners = new Set<() => void>();
let historyWindow: Window | undefined;
let restoreHistory: (() => void) | undefined;

function ensureHistoryPatch(win: Window): void {
  if (historyWindow === win && restoreHistory) return;
  restoreHistory?.();
  historyWindow = win;
  const history = win.history;
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);

  const patchedPush = function (this: History, ...args: Parameters<History["pushState"]>): void {
    push(...args);
    for (const listener of historyListeners) listener();
  };
  const patchedReplace = function (this: History, ...args: Parameters<History["replaceState"]>): void {
    replace(...args);
    for (const listener of historyListeners) listener();
  };

  history.pushState = patchedPush as History["pushState"];
  history.replaceState = patchedReplace as History["replaceState"];
  restoreHistory = () => {
    if (history.pushState === patchedPush) history.pushState = push as History["pushState"];
    if (history.replaceState === patchedReplace) history.replaceState = replace as History["replaceState"];
    restoreHistory = undefined;
    historyWindow = undefined;
  };
}

function subscribeHistory(win: Window, listener: () => void): () => void {
  historyListeners.add(listener);
  ensureHistoryPatch(win);
  return () => {
    historyListeners.delete(listener);
    if (historyListeners.size === 0) restoreHistory?.();
  };
}

export function createPageTracker(
  registry: Registry,
  options: PageOptions = {},
  /** 页面所有权的稳定锚点；传 base registry，避免命名空间代理被当成不同页面。 */
  owner: Registry = registry,
): PageTracker {
  let started = false;
  const token = Symbol("pling-page");
  let ownsPage = false;
  let router: PageRouterLike | undefined;
  let offRouter: (() => void) | undefined;
  let offHistory: (() => void) | undefined;
  let offPop: (() => void) | undefined;
  let offHash: (() => void) | undefined;
  let titleObserver: MutationObserver | undefined;
  let headObserver: MutationObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let scheduled = false;

  const sync = (): void => {
    if (!started) return;
    const next = readPage(options, router);
    if (pageOwners.get(owner) === undefined) {
      pageOwners.set(owner, token);
      ownsPage = true;
    }
    if (ownsPage) registry.setPage(next);
  };

  /** 路由 / 标题可能是分两步更新的：微任务后再读一次，标题观察器会补第二次 */
  const schedule = (): void => {
    if (scheduled || !started) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      sync();
    });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      sync();
    }, 0);
  };

  const start = (explicitRouter?: PageRouterLike): void => {
    if (started) return;
    if (options.enabled === false) return;
    started = true;
    router = explicitRouter ?? options.router;
    sync();

    const win = typeof window === "undefined" ? undefined : window;
    const doc = win?.document;
    if (!win) return;

    offHistory = subscribeHistory(win, schedule);
    const onPop = (): void => schedule();
    const onHash = (): void => schedule();
    win.addEventListener("popstate", onPop);
    win.addEventListener("hashchange", onHash);
    offPop = () => win.removeEventListener("popstate", onPop);
    offHash = () => win.removeEventListener("hashchange", onHash);

    if (router?.afterEach) {
      const remove = router.afterEach(schedule);
      offRouter = typeof remove === "function" ? remove : undefined;
    }

    // 只观察 <title> 本身。整个 <head> 的 subtree 监听会被样式注入等无关变更淹没，
    // 在测试 / 热更新里会把每次动作都拖进一次页面重读。
    // head 上再留一个 childList 监听，只用于发现 <title> 被更换后重新挂观察器。
    if (doc && typeof MutationObserver !== "undefined") {
      const attachTitle = (): void => {
        titleObserver?.disconnect();
        const title = doc.querySelector("title");
        if (!title) return;
        titleObserver = new MutationObserver(schedule);
        titleObserver.observe(title, { subtree: true, childList: true, characterData: true });
      };
      attachTitle();
      if (doc.head) {
        headObserver = new MutationObserver((records) => {
          const titleChanged = records.some((record) =>
            [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeName === "TITLE"),
          );
          if (!titleChanged) return;
          attachTitle();
          schedule();
        });
        headObserver.observe(doc.head, { childList: true });
      }
    }
  };

  const stop = (): void => {
    if (!started) return;
    started = false;
    if (timer) clearTimeout(timer);
    timer = undefined;
    offRouter?.();
    offHistory?.();
    offPop?.();
    offHash?.();
    titleObserver?.disconnect();
    headObserver?.disconnect();
    offRouter = undefined;
    offHistory = undefined;
    offPop = undefined;
    offHash = undefined;
    titleObserver = undefined;
    headObserver = undefined;
    router = undefined;
    if (ownsPage) {
      if (pageOwners.get(owner) === token) {
        pageOwners.delete(owner);
        registry.setPage(undefined);
      }
      ownsPage = false;
    }
  };

  return { start, sync, stop };
}
