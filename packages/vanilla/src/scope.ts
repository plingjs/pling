import type { JsonSchema, Registry } from "@plingjs/core";
import {
  SCOPE_ATTR,
  getRegistryNamespace,
  markScrolling,
  nearestScope,
  queryAllComposed,
  scrollBehavior,
  scrollElementIntoView,
} from "@plingjs/dom";
import type { ScopeOptions, VanillaHost } from "./types";

function slug(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function domOrderOf(element: Element, attribute: string): number | undefined {
  const index = queryAllComposed(element.ownerDocument, `[${attribute}]`).indexOf(element);
  return index >= 0 ? index : undefined;
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

/**
 * 声明一块区域。
 *
 * 写 `data-pling-scope` 是为了让**后续绑定**的元素能靠 `closest()` 自动继承；
 * 区域本身进 `@plingjs/dom` 的可见性控制器，自动驱动活跃作用域。
 */
export function bindScope(host: VanillaHost, element: Element, options: ScopeOptions): () => void {
  const ids = getRegistryNamespace(host.registry);
  const scopeId = ids.scope(options.id);
  const revealId = `pling_reveal_${slug(options.id)}`;
  const scrollId = `pling_scroll_${slug(options.id)}`;
  const label = options.label ?? options.id;
  const unbinds: Array<() => void> = [];

  element.setAttribute(SCOPE_ATTR, scopeId);
  unbinds.push(host.scopes.declare(element, {
    id: scopeId,
    ...(options.label === undefined ? {} : { label: options.label }),
    ...(options.description === undefined ? {} : { description: options.description }),
    ...(options.role === undefined ? {} : { role: options.role }),
  }));
  unbinds.push(host.registry.declareScope({
    id: scopeId,
    ...(options.label === undefined ? {} : { label: options.label }),
    ...(options.description === undefined ? {} : { description: options.description }),
    ...(options.role === undefined ? {} : { role: options.role }),
    parent: () => (options.parent === undefined
      ? (element.parentElement ? nearestScope(element.parentElement) : undefined)
      : ids.scope(options.parent)),
    order: () => domOrderOf(element, SCOPE_ATTR),
    explore: [revealId, scrollId],
  }));

  unbinds.push(bindExplore(host.registry, {
    id: revealId,
    description: `Scroll the page to the "${label}" region (use when the region is outside the viewport)`,
    isAvailable: () =>
      host.scopes.isScopeInView(scopeId)
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

  unbinds.push(bindExplore(host.registry, {
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
      if (!host.scopes.isScopeInView(scopeId)) {
        return {
          available: false,
          reason: `The "${label}" region is outside the viewport; scroll it into view first`,
          reasonKey: "availability.scopeOutsideViewport",
          reasonParams: { label },
        };
      }
      if (!host.scopes.hasMore(scopeId)) {
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

  host.scopes.refresh();
  return () => {
    for (const unbind of unbinds.reverse()) unbind();
    if (element.getAttribute(SCOPE_ATTR) === scopeId) element.removeAttribute(SCOPE_ATTR);
    host.scopes.refresh();
  };
}
