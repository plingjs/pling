/**
 * 页面反馈（S9a）：把「页面已经告诉了用户什么」变成模型读得到的数据。
 *
 * 两条来源：
 *   1. `v-feedback`：开发者显式声明（表单错误、toast、状态提示）；
 *   2. ARIA 自动收集：只认 `role=alert` / `role=status` / `aria-live` /
 *      `aria-invalid=true` 这些**明确语义**，绝不按 CSS class 猜。
 *
 * 反馈只读：它不进动作清单，也不能被模型执行。
 */
import type { FeedbackDeclaration, FeedbackSeverity, Registry } from "@plingjs/core";
import { closestComposed, queryAllComposed } from "./projection";
import { UI_ATTR } from "./scope";

export type FeedbackValue =
  | string
  | null
  | undefined
  | {
      id?: string;
      message: string | (() => string);
      field?: string | (() => string | undefined);
      severity?: FeedbackSeverity | (() => FeedbackSeverity | undefined);
      scope?: string;
    };

export interface NormalizedFeedback {
  id?: string;
  message: string | (() => string);
  field?: string | (() => string | undefined);
  severity?: FeedbackSeverity | (() => FeedbackSeverity | undefined);
  scope?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 归一化 `v-feedback` 的取值。空字符串 / null 表示「此刻没有反馈」，不是错误。
 * 不抛异常：一条反馈写错不该把整个页面渲染搞崩。
 */
export function normalizeFeedbackValue(value: unknown): { items: NormalizedFeedback[]; problem?: string } {
  if (value === null || value === undefined || value === "") return { items: [] };
  if (typeof value === "string") return { items: [{ message: value }] };
  if (Array.isArray(value)) {
    const items: NormalizedFeedback[] = [];
    for (const item of value) {
      const normalized = normalizeFeedbackValue(item);
      if (normalized.problem) return normalized;
      items.push(...normalized.items);
    }
    return { items };
  }
  if (!isObject(value)) return { items: [], problem: "v-feedback expects a string, an object, or an array of them" };
  if (!("message" in value)) return { items: [], problem: "The object form of v-feedback requires a message field" };
  return {
    items: [
      {
        ...(typeof value.id === "string" && value.id.trim() ? { id: value.id.trim() } : {}),
        message: value.message as string | (() => string),
        ...(value.field === undefined ? {} : { field: value.field as string | (() => string | undefined) }),
        ...(value.severity === undefined ? {} : { severity: value.severity as FeedbackSeverity | (() => FeedbackSeverity | undefined) }),
        ...(typeof value.scope === "string" && value.scope.trim() ? { scope: value.scope.trim() } : {}),
      },
    ],
  };
}

/** 把归一化条目补上作用域解析，变成 core 的反馈声明。 */
export function toFeedbackDeclaration(
  item: NormalizedFeedback,
  fallbackId: string,
  resolveScope: () => string | undefined,
): FeedbackDeclaration {
  return {
    id: item.id ?? fallbackId,
    message: item.message,
    ...(item.field === undefined ? {} : { field: item.field }),
    ...(item.severity === undefined ? {} : { severity: item.severity }),
    ...(item.scope === undefined ? {} : { scope: item.scope }),
    resolveScope: () => item.scope ?? resolveScope(),
    source: "declared",
  };
}

export interface FeedbackCollector {
  /** 开始观察页面（重复调用无害） */
  start(): void;
  /** 立即同步一次（测试 / 手动刷新用） */
  sync(): void;
  /** 停止观察并撤掉自动收集的反馈 */
  stop(): void;
}

interface Candidate {
  element: Element;
  message: string;
  field?: string;
  severity: FeedbackSeverity;
}

interface Captured {
  unbind: () => void;
}

const AUTO_SELECTOR = [
  '[aria-invalid="true"]',
  '[role="alert"]',
  '[role="status"]',
  "[aria-live]",
].join(",");

function textOf(element: Element | null): string {
  if (!element) return "";
  return ((element.getAttribute("aria-label") ?? element.textContent) ?? "").replace(/\s+/g, " ").trim();
}

/** 在当前 Document / ShadowRoot 内按 id 找元素；ARIA 引用本来就不能跨根边界。 */
function elementById(element: Element, id: string): Element | null {
  const root = element.getRootNode();
  if (!root || typeof (root as ParentNode).querySelectorAll !== "function") return null;
  return Array.from((root as ParentNode).querySelectorAll("[id]")).find((node) => node.getAttribute("id") === id) ?? null;
}

function idsText(element: Element, attribute: string): string {
  const ids = (element.getAttribute(attribute) ?? "").split(/\s+/).filter(Boolean);
  return ids
    .map((id) => textOf(elementById(element, id)))
    .filter(Boolean)
    .join("；");
}

/** 只从明确标注里取字段名：aria-label / aria-labelledby / label / name / id。 */
export function fieldNameOf(element: Element): string | undefined {
  const explicit = element.getAttribute("data-pling-field")?.trim();
  if (explicit) return explicit;
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;
  const labelledBy = idsText(element, "aria-labelledby");
  if (labelledBy) return labelledBy;
  const labels = (element as HTMLInputElement).labels;
  const label = labels && labels.length > 0 ? textOf(labels[0]!) : "";
  if (label) return label;
  const closest = closestComposed(element, "label");
  if (closest) {
    const copy = closest.cloneNode(true) as Element;
    copy.querySelectorAll("input, select, textarea, button").forEach((node) => node.remove());
    const text = textOf(copy);
    if (text) return text;
  }
  const name = element.getAttribute("name")?.trim();
  if (name) return name;
  const id = element.getAttribute("id")?.trim();
  return id || undefined;
}

function invalidMessageOf(element: Element): string | undefined {
  const direct = element.getAttribute("aria-errormessage")?.trim();
  if (direct) {
    const message = textOf(elementById(element, direct));
    if (message) return message;
  }
  const described = idsText(element, "aria-describedby");
  if (described) return described;
  const native = (element as HTMLInputElement).validationMessage?.trim();
  if (native) return native;
  const field = fieldNameOf(element);
  return field ? `Invalid value for ${field}` : "The current input value is invalid";
}

function isMeaningful(element: Element): boolean {
  if (!element.isConnected) return false;
  if (closestComposed(element, `[${UI_ATTR}]`)) return false;
  if (closestComposed(element, "[hidden]")) return false;
  if (closestComposed(element, '[aria-hidden="true"]')) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style?.display === "none" || style?.visibility === "hidden") return false;
  return true;
}

function ariaSeverity(element: Element): FeedbackSeverity {
  const role = element.getAttribute("role");
  if (role === "alert") return "error";
  if (role === "status") return "info";
  const live = element.getAttribute("aria-live");
  return live === "assertive" ? "warning" : "info";
}

/**
 * 自动收集器。
 *
 * 它不替开发者解释业务，只搬运浏览器里已经有的无障碍语义。
 * 动态出现 / 消失由 MutationObserver 驱动；消息内容在快照时实时读取，
 * 因此「同一个提示框换了文案」不需要重新登记。
 */
export function createFeedbackCollector(registry: Registry): FeedbackCollector {
  const captured = new Map<Element, Captured>();
  const ids = new WeakMap<Element, string>();
  let sequence = 0;
  let observer: MutationObserver | null = null;
  let root: Element | null = null;
  let started = false;
  // 用 Set 而不是 WeakSet：`stop()` 后观察器会断开，重启时必须能重新 observe 同一批根。
  const observedRoots = new Set<Node>();

  const OBSERVE_OPTIONS: MutationObserverInit = {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["role", "aria-live", "aria-invalid", "aria-errormessage", "aria-describedby", "aria-label", "aria-labelledby", "hidden"],
  };

  /** MutationObserver 不自动穿过 shadow root；把当前能看见的根都显式观察起来。 */
  function observeDeep(scope: ParentNode): void {
    if (!observer || observedRoots.has(scope as Node)) return;
    observer.observe(scope as Node, OBSERVE_OPTIONS);
    observedRoots.add(scope as Node);
    for (const host of scope.querySelectorAll("*")) {
      if (host.shadowRoot) observeDeep(host.shadowRoot);
    }
  }

  function idOf(element: Element): string {
    let id = ids.get(element);
    if (!id) {
      id = `aria_feedback_${++sequence}`;
      ids.set(element, id);
    }
    return id;
  }

  function candidates(): Candidate[] {
    if (!root) return [];
    const invalid: Candidate[] = [];
    const messages: Candidate[] = [];
    for (const element of queryAllComposed(root, AUTO_SELECTOR)) {
      if (!isMeaningful(element)) continue;

      if (element.getAttribute("aria-invalid") === "true") {
        const message = invalidMessageOf(element);
        if (message) {
          const field = fieldNameOf(element);
          invalid.push({ element, message, ...(field ? { field } : {}), severity: "error" });
        }
      }

      const role = element.getAttribute("role");
      const live = element.getAttribute("aria-live");
      if (role === "alert" || role === "status" || (live && live !== "off")) {
        const message = textOf(element);
        if (message) {
          const field = element.getAttribute("data-pling-field")?.trim();
          messages.push({ element, message, ...(field ? { field } : {}), severity: ariaSeverity(element) });
        }
      }
    }

    // 同一句话可能既在 aria-invalid 的关联错误里，又在 role=alert 的提示框里。
    // 优先保留带 field 的那条：模型需要知道改哪个输入。
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const item of [...invalid, ...messages]) {
      const key = `${item.field ?? ""}\u0000${item.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  function sync(): void {
    if (!root) return;
    observeDeep(root);
    const next = new Map<Element, Candidate>();
    for (const item of candidates()) next.set(item.element, item);

    for (const [element, entry] of captured) {
      if (next.has(element) && element.isConnected) continue;
      entry.unbind();
      captured.delete(element);
    }

    for (const [element, item] of next) {
      if (captured.has(element)) continue;
      const unbind = registry.declareFeedback({
        id: idOf(element),
        message: () => {
          if (!element.isConnected || !isMeaningful(element)) return "";
          // aria-invalid 的提示来源可能变（动态更换 error 文案）；优先实时重算。
          return element.getAttribute("aria-invalid") === "true" ? (invalidMessageOf(element) ?? "") : textOf(element);
        },
        field: () => (element.getAttribute("aria-invalid") === "true" ? fieldNameOf(element) : item.field),
        severity: () => (element.getAttribute("aria-invalid") === "true" ? "error" : ariaSeverity(element)),
        resolveScope: () => closestComposed(element, "[data-pling-scope]")?.getAttribute("data-pling-scope") ?? undefined,
        order: () => domOrder(element),
        source: "aria",
      });
      captured.set(element, { unbind });
    }
  }

  function domOrder(element: Element): number | undefined {
    if (!root) return undefined;
    const index = queryAllComposed(root, AUTO_SELECTOR).indexOf(element);
    return index === -1 ? undefined : index;
  }

  function stop(): void {
    observer?.disconnect();
    observer = null;
    observedRoots.clear();
    for (const entry of captured.values()) entry.unbind();
    captured.clear();
    started = false;
  }

  return {
    start() {
      if (started) return;
      const doc = (globalThis as { document?: Document }).document;
      root = doc?.body ?? null;
      if (!root) return;
      started = true;
      const MutationObserverCtor = (globalThis as { MutationObserver?: typeof MutationObserver }).MutationObserver;
      if (MutationObserverCtor) {
        observer = new MutationObserverCtor(() => sync());
        observeDeep(root);
      }
      sync();
    },
    sync,
    stop,
  };
}
