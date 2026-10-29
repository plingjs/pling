import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefCallback,
} from "react";
import type { JsonSchema, RegionRole, Registry } from "@plingjs/core";
import {
  getRegistryNamespace,
  markScrolling,
  nearestScope,
  queryAllComposed,
  scrollBehavior,
  scrollElementIntoView,
  SCOPE_ATTR,
} from "@plingjs/dom";
import { usePling } from "./context";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface PlingScopeOptions {
  /** 稳定区域 id（同时写进 DOM 的 `data-pling-scope`，供子元素继承）。 */
  id: string;
  /** 面向模型的区域名，如「订单列表」。 */
  label?: string;
  /** 这块区域是干什么的。 */
  description?: string;
  /** 结构角色：header / main / dialog / toolbar … */
  role?: RegionRole;
  /** 显式父区域；省略时从最近的祖先 scope 自动推断。 */
  parent?: string;
}

function slug(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * 声明一块页面区域，返回要挂到容器上的 ref。
 *
 * 与 Vue 的 `v-scope` 同义：
 *   - 区域进入浏览器视口后自动变为「活跃」，子元素动作才会进模型清单；
 *   - 自动生成两个探索动作 `pling_reveal_<id>` / `pling_scroll_<id>`；
 *   - 子元素动作与记录自动继承最近的作用域；
 *   - 容器内滚出可视区的元素会被裁剪，但行内动作仍可按 record 引用。
 *
 * 可见性真相来自 `@plingjs/dom` 的共享控制器：有布局时用同步几何判定，
 * IntersectionObserver 只负责「变了就广播」；被弹窗 / 遮罩盖住由命中测试判定。
 */
export function usePlingScope<T extends Element = HTMLElement>(options: PlingScopeOptions): RefCallback<T> {
  const pling = usePling();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [element, setElement] = useState<T | null>(null);
  const signature = JSON.stringify([options.id, options.label, options.description, options.role, options.parent]);

  useIsomorphicLayoutEffect(() => {
    if (!element) return;
    const current = optionsRef.current;
    const scopes = pling.scopes;
    const ids = getRegistryNamespace(pling.registry);
    const scopeId = ids.scope(current.id);
    const revealId = `pling_reveal_${slug(current.id)}`;
    const scrollId = `pling_scroll_${slug(current.id)}`;
    const unbinds: Array<() => void> = [];

    element.setAttribute(SCOPE_ATTR, scopeId);
    unbinds.push(scopes.declare(element, {
      id: scopeId,
      ...(current.label === undefined ? {} : { label: current.label }),
      ...(current.description === undefined ? {} : { description: current.description }),
      ...(current.role === undefined ? {} : { role: current.role }),
    }));
    unbinds.push(pling.registry.declareScope({
      id: scopeId,
      ...(current.label === undefined ? {} : { label: current.label }),
      ...(current.description === undefined ? {} : { description: current.description }),
      ...(current.role === undefined ? {} : { role: current.role }),
      parent: () => (current.parent === undefined ? closestScopeOf(element.parentElement) : ids.scope(current.parent)),
      order: () => domOrderOf(element, SCOPE_ATTR),
      explore: [revealId, scrollId],
    }));

    const label = current.label ?? current.id;
    unbinds.push(bindExplore(pling.registry, {
      id: revealId,
      description: `Scroll the page to the "${label}" region (use when the region is outside the viewport)`,
      isAvailable: () =>
        scopes.isScopeInView(scopeId)
          ? {
              available: false,
              reason: `The "${label}" region is already in the viewport`,
              reasonKey: "availability.scopeInViewport",
              reasonParams: { label },
            }
          : true,
      run: async () => {
        scrollElementIntoView(element);
      },
    }));
    unbinds.push(bindExplore(pling.registry, {
      id: scrollId,
      description: `Scroll inside the "${label}" region to reveal more content`,
      params: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["next", "prev"],
            description: "Scroll direction; defaults to next (forward / down)",
          },
        },
        required: [],
      },
      isAvailable: () => {
        if (!scopes.isScopeInView(scopeId)) {
          return {
            available: false,
            reason: `The "${label}" region is outside the viewport; scroll it into view first`,
            reasonKey: "availability.scopeOutsideViewport",
            reasonParams: { label },
          };
        }
        if (!scopes.hasMore(scopeId)) {
          return {
            available: false,
            reason: `All content in the "${label}" region is already shown`,
            reasonKey: "availability.scopeAllShown",
            reasonParams: { label },
          };
        }
        return true;
      },
      run: async (args) => {
        const direction = args.direction === "prev" ? -1 : 1;
        const container = element as unknown as HTMLElement;
        const step = container.clientHeight || 300;
        const win = element.ownerDocument.defaultView;
        markScrolling(win);
        if (typeof container.scrollBy === "function") {
          container.scrollBy({ top: direction * step * 0.9, behavior: scrollBehavior(win) });
        }
      },
    }));

    return () => {
      for (const unbind of unbinds.reverse()) unbind();
      if (element.getAttribute(SCOPE_ATTR) === scopeId) element.removeAttribute(SCOPE_ATTR);
    };
  }, [pling, element, signature]);

  return useCallback<RefCallback<T>>((node) => setElement(node), []);
}

interface ExploreOptions {
  id: string;
  description: string;
  params?: JsonSchema;
  isAvailable: () => true | { available: false; reason: string };
  run: (args: Record<string, unknown>) => void | Promise<void>;
}

function bindExplore(registry: Registry, options: ExploreOptions): () => void {
  return registry.bind({
    descriptor: {
      id: options.id,
      primitive: "scroll",
      description: options.description,
      kind: "read",
      ...(options.params ? { params: options.params } : {}),
    },
    isAvailable: options.isAvailable,
    run: async (args) => options.run(args),
  });
}

/** 最近的作用域 id；没有返回 undefined。 */
export function closestScopeOf(element: Element | null | undefined): string | undefined {
  return element ? nearestScope(element) : undefined;
}

/** 元素在一类标记里的 DOM 顺序（页面阅读顺序）。 */
export function domOrderOf(element: Element, attribute: string): number | undefined {
  const index = queryAllComposed(element.ownerDocument, `[${attribute}]`).indexOf(element);
  return index >= 0 ? index : undefined;
}
