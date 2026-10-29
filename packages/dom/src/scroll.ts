import { beginPending } from "@plingjs/core";
import { frameChainOf } from "./projection";

/** 多久没有新的滚动事件算「停下了」。 */
export const SCROLL_QUIET_MS = 120;

const watchers = new WeakMap<object, ScrollWatcher>();

export interface ScrollWatcher {
  begin(): void;
  stop(): void;
}

function createWatcher(win: Window): ScrollWatcher {
  let end: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const begin = (): void => {
    if (end) end();
    end = beginPending();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      end?.();
      end = null;
    }, SCROLL_QUIET_MS);
  };

  const stop = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    end?.();
    end = null;
  };

  const listener = (): void => begin();
  win.addEventListener("scroll", listener, { capture: true, passive: true });
  win.document?.addEventListener("scroll", listener, { capture: true, passive: true });

  return { begin, stop };
}

/** 拿这个窗口的滚动观察器（没有窗口就返回 `null`：SSR / Node）。 */
export function scrollWatcher(win: Window | null | undefined): ScrollWatcher | null {
  if (!win || typeof win.addEventListener !== "function") return null;
  const found = watchers.get(win);
  if (found) return found;
  const created = createWatcher(win);
  watchers.set(win, created);
  return created;
}

/** 框架自己发起滚动之前调这个（登记 + 续期）。 */
export function markScrolling(win: Window | null | undefined): void {
  scrollWatcher(win)?.begin();
}

export function scrollBehavior(win: Window | null | undefined): ScrollBehavior {
  const query = (win as { matchMedia?: (query: string) => MediaQueryList } | null | undefined)?.matchMedia;
  if (typeof query !== "function") return "smooth";
  try {
    return query.call(win, "(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  } catch {
    return "smooth";
  }
}

/** 把元素滚进视口，并在动手前登记「页面要开始动了」。 */
export function scrollElementIntoView(el: Element): void {
  const frames = frameChainOf(el);
  for (const frame of frames) {
    const frameWin = frame.ownerDocument.defaultView;
    markScrolling(frameWin);
    if (typeof frame.scrollIntoView === "function") {
      frame.scrollIntoView({ block: "center", inline: "nearest", behavior: scrollBehavior(frameWin) });
    }
  }
  const win = el.ownerDocument.defaultView;
  markScrolling(win);
  if (typeof (el as HTMLElement).scrollIntoView === "function") {
    (el as HTMLElement).scrollIntoView({ block: "center", inline: "nearest", behavior: scrollBehavior(win) });
  }
}
