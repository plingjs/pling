import type { PlingPage } from "./page";

/** 同源 iframe 之间共享页面运行时的唯一通道；Symbol.for 在同一个浏览器进程内稳定。 */
const PAGE_KEY = Symbol.for("@plingjs/dom/frame-page");
const SHARED_EVENT = "pling:page-shared";

type FrameWindow = Window & Record<PropertyKey, unknown>;

function isPage(value: unknown): value is PlingPage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PlingPage>;
  return Boolean(candidate.registry && candidate.scopes && typeof candidate.destroy === "function");
}

function frameWindow(frame: HTMLIFrameElement): FrameWindow | null {
  try {
    return (frame.contentWindow as FrameWindow | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * 把一个页面运行时显式共享给**同源** iframe。
 *
 * 不扫描 document、不自动寻找 iframe：只有调用者点名的那一个 frame 会拿到 `PlingPage`。
 * 跨域访问 `contentWindow` 会抛异常，本函数会安静地跳过；跨域页面应使用独立运行时与
 * 未来的 postMessage / Surface 桥，而不是共享内存对象。
 *
 * 返回的清理函数会移除 load 监听，并只在属性仍指向同一个 page 时删除它。
 */
export function sharePlingPageWithFrame(frame: HTMLIFrameElement, page: PlingPage): () => void {
  const install = (): void => {
    const win = frameWindow(frame);
    if (!win) return;
    win[PAGE_KEY] = page;
    try {
      const EventCtor = (win as unknown as { Event?: typeof Event }).Event ?? Event;
      win.dispatchEvent(new EventCtor(SHARED_EVENT));
    } catch {
      // 极老的引擎或已经卸载的窗口：属性已经写入，子页面仍可在启动时主动读取。
    }
  };

  install();
  frame.addEventListener("load", install);
  return () => {
    frame.removeEventListener("load", install);
    const win = frameWindow(frame);
    if (win && win[PAGE_KEY] === page) delete win[PAGE_KEY];
  };
}

/** 子页面主动读取父页面显式共享的运行时；非 iframe / 跨域 / 未共享时返回 undefined。 */
export function plingPageFromParent(win: Window = window): PlingPage | undefined {
  try {
    const own = (win as FrameWindow)[PAGE_KEY];
    if (isPage(own)) return own;
    if (!win.parent || win.parent === win) return undefined;
    const page = (win.parent as FrameWindow)[PAGE_KEY];
    return isPage(page) ? page : undefined;
  } catch {
    return undefined;
  }
}

export interface WaitForFramePageOptions {
  /** 要监听的子窗口；默认当前 `window`。 */
  window?: Window;
  /** 超时时间，默认 5000ms；传 0 表示一直等。 */
  timeoutMs?: number;
}

/**
 * 等父页面把共享运行时装进来。
 *
 * 子页面脚本通常早于 iframe 的 `load` 事件执行，所以不能只在启动瞬间读一次属性。
 */
export function waitForPlingPageFromParent(options: WaitForFramePageOptions = {}): Promise<PlingPage> {
  const win = options.window ?? window;
  const existing = plingPageFromParent(win);
  if (existing) return Promise.resolve(existing);

  const timeoutMs = options.timeoutMs ?? 5000;
  return new Promise<PlingPage>((resolve, reject) => {
    const timer = timeoutMs > 0
      ? setTimeout(() => {
          cleanup();
          reject(new Error("pling: 等待父页面共享运行时超时；确认 iframe 同源，并调用 sharePlingPageWithFrame()"));
        }, timeoutMs)
      : null;

    const onShared = (): void => {
      const page = plingPageFromParent(win);
      if (!page) return;
      cleanup();
      resolve(page);
    };

    const cleanup = (): void => {
      if (timer !== null) clearTimeout(timer);
      win.removeEventListener(SHARED_EVENT, onShared);
    };

    win.addEventListener(SHARED_EVENT, onShared);
  });
}

