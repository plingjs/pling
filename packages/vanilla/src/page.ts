/**
 * Page identity for plain DOM applications.
 *
 * The location, title and optional router snapshot all feed the same
 * `registry.setPage()` contract used by the Vue and React adapters. Query
 * parameters are opt-in because URLs often carry signatures or tokens.
 */
import type { PageView, Registry } from "@plingjs/core";

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
  enabled?: boolean;
  /** A router-like object. Plain DOM pages normally omit this. */
  router?: PageRouterLike;
  /** URL query keys allowed into agent context. Defaults to none. */
  queryKeys?: readonly string[];
  /** Include a non-query hash fragment. Defaults to true. */
  hash?: boolean;
  /** Title override or fallback. */
  title?: () => string | undefined;
}

export interface PageTracker {
  start(router?: PageRouterLike): void;
  sync(): void;
  stop(): void;
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

function readPage(options: PageOptions, router: PageRouterLike | undefined): PageView | undefined {
  const win = typeof window === "undefined" ? undefined : window;
  const doc = win?.document;
  const route = router?.currentRoute?.value;
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

const pageOwners = new WeakMap<Registry, symbol>();
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
    if (started || options.enabled === false) return;
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
