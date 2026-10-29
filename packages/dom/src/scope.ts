/**
 * Pling · 页灵 —— 作用域与可见性（自动裁剪 + 探索）
 *
 * 解决 005 暴露的两个问题：
 *   1. 裁剪靠开发者手动维护（`setActiveScopes`）—— 这里改成「容器声明 + 视口自动判定」；
 *   2. 裁剪之后模型不知道「还有更多」—— 元信息给出 total/visible/hasMore + 探索动作。
 *
 * 两个观察面：
 *   · 页面级：作用域容器是否进入浏览器视口 → 决定该作用域是否「活跃」；
 *   · 容器级：容器内的元素是否进入容器可视区 → 决定单个动作是否暴露。
 *
 * 没有 IntersectionObserver 的环境（jsdom / 老浏览器）退化为「默认可见」，
 * 由 `setVisible()` / `setScopeInView()` 手动驱动（测试也走这条路）。
 *
 * 有原生观察器、且环境有真实布局（真浏览器）时，可见性以**同步几何判定**为准，
 * 观察器只负责「变了就广播」—— 回调是异步的，元素复用 / 移动后缓存会过期（见 `intersects`）。
 */

import type { RegionRole } from "@plingjs/core";
import {
  closestComposed,
  containsProjected,
  elementFromPointComposed,
  projectRectToTop,
  topDocumentOf,
} from "./projection";

/** 框架自己的界面（浮窗 / 面板）：它们遮住页面目标时不算「业务弹窗 / 遮罩」。 */
export const UI_ATTR = "data-pling-ui";

/** 只用到 IntersectionObserver 的最小能力，方便注入假实现 */
export interface IntersectionObserverEntryLike {
  target: Element;
  isIntersecting: boolean;
}

export interface IntersectionObserverLike {
  observe(target: Element): void;
  unobserve(target: Element): void;
  disconnect(): void;
}

export interface IntersectionObserverCtor {
  new (
    callback: (entries: IntersectionObserverEntryLike[]) => void,
    options?: { root?: Element | null; rootMargin?: string; threshold?: number | number[] },
  ): IntersectionObserverLike;
}

export interface ScopeDeclaration {
  /** 作用域 id（同时写进 DOM 的 `data-pling-scope`，供子元素继承） */
  id: string;
  /** 面向模型的区域名，如「订单列表」 */
  label?: string;
  /** 这块区域是干什么的（会进模型上下文） */
  description?: string;
  /** 结构角色（页头 / 工具栏 / 弹窗 …），只影响描述与阅读顺序 */
  role?: RegionRole;
}

export interface ScopeControllerOptions {
  /** 注入观察器实现（默认取 globalThis.IntersectionObserver；显式传 null 强制关闭） */
  observer?: IntersectionObserverCtor | null;
  /**
   * 可见性判定的真相来源：
   *   `"geometry"`（浏览器默认）—— 同步按几何位置判定；观察器只负责「变了就广播」。
  *   `"observer"`（无布局环境默认）—— 沿用观察器回调缓存（jsdom、注入假观察器的测试）。
   */
  visibility?: "geometry" | "observer";
  /**
   * 命中测试：某个视口坐标上最顶层的元素是谁（默认用 `document.elementFromPoint`）。
   *
   * 层叠判定必须用它，而不是「元素自己的矩形有没有相交」—— 遮罩盖在上面时，
   * 被遮住的元素**几何上仍然在视口里**。命中测试才是浏览器里「点下去会点到谁」的真相。
   * 显式注入它同时也表示「这个环境有布局」，因此在 jsdom 测试里也能验证层叠逻辑。
   */
  hitTest?: (x: number, y: number) => Element | null;
}

export interface ScopeController {
  /** 声明一个作用域容器（`v-scope` 所在元素），返回解除函数 */
  declare(el: Element, declaration: ScopeDeclaration): () => void;
  /** 把一个「属于某作用域」的元素登记进可见性观察，返回解除函数 */
  track(el: Element, scope: string): () => void;
  /** 某作用域是否已声明过容器 */
  isDeclared(scope: string): boolean;
  /** 该元素此刻是否在容器可视区内（未被观察过的元素默认可见） */
  isVisible(el: Element): boolean;
  /**
   * 该元素此刻是否被别人盖住（打开的弹窗 / 遮罩 / 悬浮层）。
   * 盖住时返回那个元素（用来写原因），没被盖住 / 判不了时返回 null。
   */
  coverOf(el: Element): Element | null;
  /** 该作用域容器此刻是否在页面视口内 */
  isScopeInView(scope: string): boolean;
  /** 该作用域内是否还有没进入可视区的元素 */
  hasMore(scope: string): boolean;
  /** 手动设置可见性（无观察器环境 / 测试 / 兜底） */
  setVisible(el: Element, visible: boolean): void;
  /** 手动设置容器是否在视口内 */
  setScopeInView(scope: string, inView: boolean): void;
  /** 当前活跃（容器在视口内）的作用域集合 */
  activeScopes(): Set<string>;
  /**
   * 主动重新广播一次「布局可能变了」。
   *
   * 观察器负责常规的滚动 / 尺寸变化；但有些变化它收不到（测试里改矩形、
   * 无布局环境手动驱动、弹窗刚插入时的下一帧）。适配器需要时可以调它，
   * 让注册表的自动活跃集合按当前几何重算。
   */
  refresh(): void;
  onChange(listener: () => void): () => void;
  destroy(): void;
}

export function createScopeController(options: ScopeControllerOptions = {}): ScopeController {
  const native = (globalThis as { IntersectionObserver?: IntersectionObserverCtor }).IntersectionObserver ?? null;
  const Ctor: IntersectionObserverCtor | null = options.observer !== undefined ? options.observer : native;

  /**
   * 环境有没有「真实布局」？jsdom 里 `getBoundingClientRect()` 恒为 0，
   * 拿它做可见性会把所有动作都判成不可见——所以先用一个探针量一下。
   */
  function hasLayout(): boolean {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc?.body) return false;
    const probe = doc.createElement("div");
    probe.setAttribute("style", "position:absolute;width:10px;height:10px;top:-9999px;left:-9999px");
    doc.body.appendChild(probe);
    const measured = probe.getBoundingClientRect().width > 0;
    probe.remove();
    return measured;
  }

  // 惰性求值：等真正要判可见性时，body 一定在了
  let geometryMode: boolean | null = options.visibility ? options.visibility === "geometry" : null;
  function useGeometry(): boolean {
    // 注入了命中测试 = 调用方保证这里有布局（jsdom 测试走这条路）
    if (geometryMode === null) geometryMode = options.hitTest !== undefined || (Ctor !== null && hasLayout());
    return geometryMode;
  }

  const listeners = new Set<() => void>();
  /** scope id → 容器元素 */
  const containers = new Map<string, Element>();
  /** 被跟踪元素 → scope */
  const elementScope = new Map<Element, string>();
  /** 已在观察器里报过到的元素（没报过 = 默认可见，避免首帧闪空） */
  const reported = new Set<Element>();
  const visibleElements = new Set<Element>();
  /** 已经在观察器里报过到的容器 */
  const reportedScopes = new Set<string>();
  const inViewScopes = new Set<string>();
  /** 容器观察器已建好前，先暂存该作用域的元素 */
  const pending = new Map<string, Set<Element>>();
  const elementObservers = new Map<string, IntersectionObserverLike>();
  const pageObservers = new Map<string, IntersectionObserverLike>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  /**
   * 几何判定：元素此刻是否落在容器的可视矩形里。
   *
   * 为什么不只用观察器回调：回调是**异步**的，而元素会被复用 / 移动
   * （典型：42 行列表搜索后只剩 1 行，那一行的 DOM 被复用、位置变了），
   * 缓存里它还是「不可见」，于是它的动作不会进快照 —— 浏览器实测到的
   * 「模型刚搜出来就去操作，却报 ACTION_NOT_FOUND」就是这么来的。
   * 观察器仍然留着，但只负责「变了就广播」，不再承担正确性。
   */
  function intersects(el: Element, container: Element): boolean {
    const r = projectRectToTop(el);
    if (r.width <= 0 && r.height <= 0) return false; // display:none / 未布局
    const c = projectRectToTop(container);
    return r.bottom > c.top && r.top < c.bottom && r.right > c.left && r.left < c.right;
  }

  function inViewport(el: Element): boolean {
    const r = projectRectToTop(el);
    if (r.width <= 0 && r.height <= 0) return false;
    const view = topDocumentOf(el).defaultView;
    const height = view?.innerHeight ?? 0;
    const width = view?.innerWidth ?? 0;
    if (height === 0 && width === 0) return true; // 没有视口概念 → 视为在视口内
    return r.bottom > 0 && r.top < height && r.right > 0 && r.left < width;
  }

  /**
   * 层叠判定：「点下去会点到谁」。
   *
   * 拿元素中心点做命中测试：命中的是自己 / 自己的后代（比如按钮里套着 span）/ 自己的祖先
   * （自定义组件根元素套着真正的原生元素）都算没被盖住；命中别的元素就是被盖住了 ——
   * 典型是弹窗的遮罩。这一条是几何判定的补充，几何判定解决不了「在视口里但被压住」。
   *
   * 判不了就返回 null（不臆断）：
   *   · 没有布局能力（jsdom 且没注入 hitTest）；
   *   · 元素尺寸为 0（交给可见性裁剪）；
   *   · 中心点不在视口内（滚出屏幕的元素，也交给可见性裁剪）。
   */
  function coverOfNow(el: Element): Element | null {
    if (!useGeometry()) return null;
    const rect = projectRectToTop(el);
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const view = topDocumentOf(el).defaultView;
    if (view && (x < 0 || y < 0 || x > view.innerWidth || y > view.innerHeight)) return null;

    // `rect` 已换算到顶层视口，命中测试也必须从顶层文档开始。
    // 不能拿 globalThis.document：框架代码运行在同源 iframe 里时，那就是子文档，
    // 用父视口坐标去查子文档会命中完全不同的元素（典型：输入框被判成被列表卡片盖住）。
    const hit = options.hitTest
      ? options.hitTest(x, y)
      : elementFromPointComposed(topDocumentOf(el), x, y);
    if (!hit || hit === el || containsProjected(el, hit) || containsProjected(hit, el)) return null;
    // 框架自己的浮窗（dock / panel）不是业务遮罩：agent 不该因为自己的聊天窗压在目标上
    // 就认为「人点不到，所以我也不能做」。它在 DOM 里是 fixed 层，但语义上不属于页面。
    if (closestComposed(hit, `[${UI_ATTR}]`)) return null;
    return hit;
  }

  function visibleNow(el: Element): boolean {
    const scope = elementScope.get(el);
    if (scope === undefined) return true;
    if (useGeometry()) {
      const container = containers.get(scope);
      return container ? intersects(el, container) : true;
    }
    if (!reported.has(el)) return true;
    return visibleElements.has(el);
  }

  function scopeInViewNow(scope: string): boolean {
    const container = containers.get(scope);
    if (!container) return true;
    if (useGeometry()) return inViewport(container);
    if (!reportedScopes.has(scope)) return true;
    return inViewScopes.has(scope);
  }

  function markVisible(el: Element, visible: boolean): boolean {
    const was = reported.has(el) ? visibleElements.has(el) : true;
    reported.add(el);
    if (visible) visibleElements.add(el);
    else visibleElements.delete(el);
    return was !== visible;
  }

  function markScopeInView(scope: string, inView: boolean): boolean {
    const was = reportedScopes.has(scope) ? inViewScopes.has(scope) : true;
    reportedScopes.add(scope);
    if (inView) inViewScopes.add(scope);
    else inViewScopes.delete(scope);
    return was !== inView;
  }

  function ensureObservers(scope: string, container: Element): void {
    if (!Ctor) return;

    if (!elementObservers.has(scope)) {
      const observer = new Ctor(
        (entries) => {
          let changed = false;
          for (const entry of entries) {
            if (markVisible(entry.target, entry.isIntersecting)) changed = true;
          }
          if (changed) notify();
        },
        { root: container, threshold: 0 },
      );
      elementObservers.set(scope, observer);
      for (const el of pending.get(scope) ?? []) observer.observe(el);
      pending.delete(scope);
    }

    if (!pageObservers.has(scope)) {
      const observer = new Ctor(
        (entries) => {
          let changed = false;
          for (const entry of entries) {
            if (markScopeInView(scope, entry.isIntersecting)) changed = true;
          }
          if (changed) notify();
        },
        { root: null, threshold: 0 },
      );
      pageObservers.set(scope, observer);
      observer.observe(container);
    }
  }

  return {
    declare(el, { id }) {
      containers.set(id, el);
      el.setAttribute(SCOPE_ATTR, id);
      ensureObservers(id, el);
      // 新声明的作用域默认「在视口内」，必须主动广播一次，否则自动作用域不会被激活
      notify();
      return () => {
        containers.delete(id);
        elementObservers.get(id)?.disconnect();
        pageObservers.get(id)?.disconnect();
        elementObservers.delete(id);
        pageObservers.delete(id);
        for (const tracked of [...elementScope.keys()]) {
          if (elementScope.get(tracked) === id) {
            elementScope.delete(tracked);
            reported.delete(tracked);
            visibleElements.delete(tracked);
          }
        }
        pending.delete(id);
        // 容器本身可能还留着属性，但作用域已注销：清掉计数
        reportedScopes.delete(id);
        inViewScopes.delete(id);
        notify();
      };
    },

    track(el, scope) {
      elementScope.set(el, scope);
      let observer = elementObservers.get(scope);
      if (observer) observer.observe(el);
      else {
        const queue = pending.get(scope) ?? new Set<Element>();
        queue.add(el);
        pending.set(scope, queue);
      }
      notify();
      return () => {
        elementObservers.get(scope)?.unobserve(el);
        pending.get(scope)?.delete(el);
        elementScope.delete(el);
        reported.delete(el);
        visibleElements.delete(el);
        notify();
      };
    },

    isDeclared(scope) {
      return containers.has(scope);
    },

    isVisible: visibleNow,

    coverOf: coverOfNow,

    isScopeInView: scopeInViewNow,

    hasMore(scope) {
      for (const [el, owner] of elementScope) {
        if (owner === scope && !visibleNow(el)) return true;
      }
      return false;
    },

    setVisible(el, visible) {
      if (markVisible(el, visible)) notify();
    },

    setScopeInView(scope, inView) {
      if (markScopeInView(scope, inView)) notify();
    },

    activeScopes() {
      const active = new Set<string>();
      for (const scope of containers.keys()) {
        if (scopeInViewNow(scope)) active.add(scope);
      }
      return active;
    },

    refresh() {
      notify();
    },

    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    destroy() {
      for (const observer of elementObservers.values()) observer.disconnect();
      for (const observer of pageObservers.values()) observer.disconnect();
      elementObservers.clear();
      pageObservers.clear();
      containers.clear();
      elementScope.clear();
      reported.clear();
      visibleElements.clear();
      reportedScopes.clear();
      inViewScopes.clear();
      pending.clear();
      listeners.clear();
    },
  };
}

/** 作用域容器在 DOM 上留的标记，子元素靠它「继承」作用域 */
export const SCOPE_ATTR = "data-pling-scope";

/** 从元素本身向上找最近的作用域容器 */
export function nearestScope(el: Element): string | undefined {
  const host = closestComposed(el, `[${SCOPE_ATTR}]`);
  return host?.getAttribute(SCOPE_ATTR) ?? undefined;
}
