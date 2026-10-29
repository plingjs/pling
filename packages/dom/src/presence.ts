import type { PresenceState } from "@plingjs/core";
import { projectRectToDocument } from "./projection";

/**
 * 存在感（S13）—— 「agent 现在动的是哪一个」。
 *
 * 设计约束（本框架的第一原则：少记东西）：
 *   开发者**不用写任何声明**。`v-tool` 注册时顺手把元素交给这里，
 *   执行器在开始 / 交给用户 / 结束时各报一次状态，高亮就有了。
 *
 * 这一层只做「画」，不做「找」：
 *   目标元素由适配器在执行流水线里算好（`currentTarget()`，和点击 / 填值用的是同一个），
 *   所以高亮的位置**一定**是动作真正作用的位置，不会出现「圈了一个壳、点的是里面」。
 *
 * 三个硬性要求：
 *   1. 不挡操作：`pointer-events: none`，也不参与层叠 / 命中判定（`data-pling-ui`）。
 *   2. 不进快照：它带 `data-pling-ui`，L1 派生与覆盖率扫描都会跳过；
 *      它是**给人看的**，不是页面能力。
 *   3. 不打扰：`prefers-reduced-motion` 下关掉动画，只留静态轮廓。
 */

export type PresenceEffect = "ring" | "spotlight" | "none";

export interface PresenceOptions {
  /**
   * 画法：
   *   ring       光圈（默认）—— 最轻，不改变页面明暗
   *   spotlight  聚光 —— 压暗其余部分，适合「必须看这里」的引导
   *   none       关闭
   */
  effect?: PresenceEffect;
  /**
   * 至少显示多久（ms，默认 700）。动作本身可能 20ms 就结束了，
   * 不兜底的话人眼只会看到「闪了一下」。
   */
  minVisibleMs?: number;
  /** 交给用户操作（handoff）时是否也高亮，默认 true */
  waiting?: boolean;
  /**
   * 完全自定义：给元素和状态，返回自己的节点（会被塞进 overlay）。
   * 返回 null = 用默认画法。星星 / 箭头 / 自定义气泡都从这里接。
   */
  render?: (el: Element, state: PresenceState) => HTMLElement | null | undefined;
}

export interface PresenceController {
  /** 执行器调用的唯一入口；`idle` 表示这一趟结束 */
  mark(el: Element, state: PresenceState): void;
  /** 立刻收掉（卸载 / 取消时用，不等最短显示时间） */
  clear(): void;
  destroy(): void;
}

/** 页面业务内容之上的「动作高亮」层。 */
export const PLING_PRESENCE_Z_INDEX = 2147483000;
/** Pling 自己的问答入口 / 面板层：必须高于高亮，否则光圈会透出面板。 */
export const PLING_UI_Z_INDEX = PLING_PRESENCE_Z_INDEX + 1;

const STYLE_ID = "pling-presence-style";
const OVERLAY_ATTR = "data-pling-presence";
const RING_PAD = 6;

/** 只用一次：同一页面多个应用 / 多个实例共用一份样式 */
function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
[${OVERLAY_ATTR}] {
  position: fixed;
  z-index: ${PLING_PRESENCE_Z_INDEX};
  pointer-events: none;
  border-radius: 10px;
  box-sizing: border-box;
  transition: opacity 140ms ease, box-shadow 140ms ease;
}
[${OVERLAY_ATTR}].is-hidden { opacity: 0; }
[${OVERLAY_ATTR}]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 2px solid #2e9df7;
  box-shadow: 0 0 0 3px rgba(46, 157, 247, 0.22), 0 0 18px rgba(46, 157, 247, 0.45);
}
[${OVERLAY_ATTR}][data-effect="ring"].is-waiting::before {
  animation: pling-presence-pulse 1.6s ease-in-out infinite;
}
[${OVERLAY_ATTR}][data-effect="spotlight"] {
  box-shadow: 0 0 0 9999px rgba(12, 22, 34, 0.42);
}
[${OVERLAY_ATTR}][data-effect="spotlight"]::before { box-shadow: none; }
@keyframes pling-presence-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(46, 157, 247, 0.18), 0 0 14px rgba(46, 157, 247, 0.35); }
  50% { box-shadow: 0 0 0 8px rgba(46, 157, 247, 0.10), 0 0 26px rgba(46, 157, 247, 0.55); }
}
@media (prefers-reduced-motion: reduce) {
  [${OVERLAY_ATTR}], [${OVERLAY_ATTR}]::before { animation: none !important; transition: none !important; }
}
`;
  doc.head.appendChild(style);
}

function prefersReducedMotion(win: Window): boolean {
  return typeof win.matchMedia === "function" && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 没有 DOM（SSR / 单元测试的纯逻辑环境）就返回 null —— 调用方不需要判断环境。
 */
export function createPresence(options: PresenceOptions | boolean = {}): PresenceController | null {
  const doc = (globalThis as { document?: Document }).document;
  const win = doc?.defaultView;
  if (!doc || !win || options === false) return null;

  // true 只是「我要，按默认来」—— 归一化掉，后面就只剩一种形状
  const opts: PresenceOptions = typeof options === "object" ? options : {};
  const effect = opts.effect ?? "ring";
  if (effect === "none") return null;

  const minVisibleMs = Math.max(0, opts.minVisibleMs ?? 700);
  const showWaiting = opts.waiting !== false;

  let overlay: HTMLElement | null = null;
  let host: Element | null = null;
  let state: PresenceState = "idle";
  let shownAt = 0;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let frame: number | null = null;
  let listening = false;
  let destroyed = false;

  ensureStyle(doc);

  const mount = (): HTMLElement => {
    if (!overlay) {
      overlay = doc.createElement("div");
      // data-pling-ui：派生 / 覆盖率 / 层叠判定一律跳过框架自己的界面
      overlay.setAttribute("data-pling-ui", "");
      overlay.setAttribute(OVERLAY_ATTR, "");
      overlay.setAttribute("data-effect", effect);
      overlay.setAttribute("aria-hidden", "true");
    }
    if (!overlay.isConnected) doc.body.appendChild(overlay);
    return overlay;
  };

  const place = (): void => {
    if (!overlay || !host) return;
    const rect = projectRectToDocument(host, doc);
    overlay.style.left = `${rect.left - RING_PAD}px`;
    overlay.style.top = `${rect.top - RING_PAD}px`;
    overlay.style.width = `${rect.width + RING_PAD * 2}px`;
    overlay.style.height = `${rect.height + RING_PAD * 2}px`;
  };

  const tick = (): void => {
    frame = null;
    if (destroyed || state === "idle" || !host) return;
    place();
    frame = win.requestAnimationFrame(tick);
  };

  const stopFrame = (): void => {
    if (frame !== null) {
      // 测试环境可能在 teardown 后先撤掉 rAF 的取消函数；此时不能再抛异常。
      win.cancelAnimationFrame?.(frame);
      frame = null;
    }
  };

  // waiting 可能是 5 分钟。这种情况不能挂 rAF（60fps 跑五分钟），只需要跟住滚动 / 改窗口。
  const onViewportChange = (): void => place();
  const startListeners = (): void => {
    if (listening) return;
    listening = true;
    win.addEventListener("scroll", onViewportChange, true);
    win.addEventListener("resize", onViewportChange);
  };
  const stopListeners = (): void => {
    if (!listening) return;
    listening = false;
    win.removeEventListener("scroll", onViewportChange, true);
    win.removeEventListener("resize", onViewportChange);
  };

  const startLoop = (): void => {
    if (state === "waiting") {
      stopFrame();
      startListeners();
      place();
      return;
    }
    stopListeners();
    if (prefersReducedMotion(win)) place();
    else if (frame === null) frame = win.requestAnimationFrame(tick);
    else place();
  };

  const paint = (): void => {
    const el = mount();
    el.classList.toggle("is-waiting", state === "waiting");
    el.classList.toggle("is-hidden", false);
    place();
    startLoop();
  };

  const hide = (): void => {
    hideTimer = null;
    state = "idle";
    host = null;
    stopFrame();
    stopListeners();
    if (overlay) {
      overlay.classList.add("is-hidden");
      // 等过渡结束再摘掉；没有过渡（reduced motion）时同一帧也不影响
      overlay.remove();
    }
  };

  const mark = (el: Element, next: PresenceState): void => {
    if (destroyed) return;
    if (next === "waiting" && !showWaiting) return;

    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    if (next === "idle") {
      if (!host || state === "idle") return;
      const elapsed = Date.now() - shownAt;
      const remain = Math.max(0, minVisibleMs - elapsed);
      if (remain === 0) hide();
      else hideTimer = setTimeout(hide, remain);
      return;
    }

    // 元素已经被替换 / 卸载：让它自然消失，不画一个不存在的目标
    if (!el.isConnected) return;

    if (host !== el) {
      host = el;
      shownAt = Date.now();
    }
    state = next;

    const custom = opts.render?.(el, next);
    if (custom) {
      const box = mount();
      box.replaceChildren(custom);
    } else if (overlay && overlay.firstElementChild) {
      overlay.replaceChildren();
    }
    paint();
  };

  return {
    mark,
    clear(): void {
      if (hideTimer !== null) clearTimeout(hideTimer);
      hideTimer = null;
      hide();
    },
    destroy(): void {
      destroyed = true;
      if (hideTimer !== null) clearTimeout(hideTimer);
      hideTimer = null;
      stopFrame();
      stopListeners();
      overlay?.remove();
      overlay = null;
      host = null;
      state = "idle";
    },
  };
}
