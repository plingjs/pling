import type { Primitive } from "@plingjs/core";
import { closestComposed } from "./projection";
import { markScrolling, scrollBehavior, scrollElementIntoView } from "./scroll";

/** 给模型看的元素简介（`<button.btn>（删除）`）。 */
export function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const raw = typeof el.className === "string" ? el.className.trim() : "";
  const cls = raw ? `.${raw.split(/\s+/).slice(0, 2).join(".")}` : "";
  const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 16);
  return `<${tag}${id}${cls}>${label ? ` (${label})` : ""}`;
}

/** 元素此刻是否可操作；不可用时带上模型能据以自救的原因。 */
export function checkActionable(el: Element): {
  available: boolean;
  reason?: string;
  reasonKey?: string;
  reasonParams?: Record<string, string | number>;
} {
  if (!el.isConnected) {
    return { available: false, reason: "Element is no longer connected to the page", reasonKey: "availability.disconnected" };
  }
  if ((el as HTMLButtonElement).disabled) {
    return { available: false, reason: "Element is disabled (disabled)", reasonKey: "availability.disabled" };
  }
  const ariaDisabled = closestComposed(el, '[aria-disabled="true"]');
  if (ariaDisabled) {
    return {
      available: false,
      reason: `Element is disabled (aria-disabled): ${describeElement(ariaDisabled)}`,
      reasonKey: "availability.ariaDisabled",
      reasonParams: { element: describeElement(ariaDisabled) },
    };
  }

  const inert = closestComposed(el, "[inert]");
  if (inert) {
    return {
      available: false,
      reason: `Element is inside an inert subtree: ${describeElement(inert)}`,
      reasonKey: "availability.inert",
      reasonParams: { element: describeElement(inert) },
    };
  }
  const ariaHidden = closestComposed(el, '[aria-hidden="true"]');
  if (ariaHidden) {
    return {
      available: false,
      reason: `Element is inside an aria-hidden subtree: ${describeElement(ariaHidden)}`,
      reasonKey: "availability.ariaHidden",
      reasonParams: { element: describeElement(ariaHidden) },
    };
  }
  const hiddenAttr = closestComposed(el, "[hidden]");
  if (hiddenAttr) {
    return {
      available: false,
      reason: `Element is hidden by the hidden attribute: ${describeElement(hiddenAttr)}`,
      reasonKey: "availability.hidden",
      reasonParams: { element: describeElement(hiddenAttr) },
    };
  }

  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (style?.display === "none") {
    return { available: false, reason: "Element is not visible (display: none)", reasonKey: "availability.displayNone" };
  }
  if (style?.visibility === "hidden") {
    return { available: false, reason: "Element is not visible (visibility: hidden)", reasonKey: "availability.visibilityHidden" };
  }
  return { available: true };
}

export function isActionable(el: Element): boolean {
  return checkActionable(el).available;
}

/**
 * 绕过 React 等框架在元素实例上安装的 value setter，直接调用原型链上的原生 setter。
 * 否则受控输入框只会在框架内部更新 value，随后派发的 input/change 事件会被去重，
 * 业务自己的 onChange 收不到。
 */
function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const prototype = Object.getPrototypeOf(input) as object;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) descriptor.set.call(input, value);
  else input.value = value;
}

/** 框架无关的 DOM 原语执行（Vue / React / 原生共用这一层逻辑）。 */
export function performPrimitive(el: Element, primitive: Primitive, args: Record<string, unknown>): void {
  const win = el.ownerDocument.defaultView;
  const EventCtor = win?.Event ?? Event;
  const KeyboardCtor = win?.KeyboardEvent ?? KeyboardEvent;

  switch (primitive) {
    case "click":
      (el as HTMLElement).click();
      return;
    case "type": {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      input.focus();
      setNativeValue(input, String(args.text ?? ""));
      input.dispatchEvent(new EventCtor("input", { bubbles: true }));
      input.dispatchEvent(new EventCtor("change", { bubbles: true }));
      return;
    }
    case "select": {
      const select = el as HTMLSelectElement;
      setNativeValue(select, String(args.value ?? ""));
      select.dispatchEvent(new EventCtor("change", { bubbles: true }));
      return;
    }
    case "scroll": {
      const to = String(args.to ?? "element");
      markScrolling(win);
      const behavior = scrollBehavior(win);
      if (to === "top") win?.scrollTo({ top: 0, behavior });
      else if (to === "bottom") win?.scrollTo({ top: el.ownerDocument.body.scrollHeight, behavior });
      else scrollElementIntoView(el);
      return;
    }
    case "navigate":
      (el as HTMLElement).click();
      return;
    case "press": {
      const key = String(args.key ?? "Enter");
      const init = { key, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardCtor("keydown", init));
      el.dispatchEvent(new KeyboardCtor("keyup", init));
      return;
    }
    case "hover": {
      const Mouse = win?.MouseEvent ?? MouseEvent;
      const Pointer = win && "PointerEvent" in win ? win.PointerEvent : Mouse;
      const fire = (type: string, bubbles: boolean, Ctor: typeof MouseEvent) =>
        el.dispatchEvent(new Ctor(type, { bubbles, cancelable: true }));
      fire("pointerover", true, Pointer);
      fire("pointerenter", false, Pointer);
      fire("mouseover", true, Mouse);
      fire("mouseenter", false, Mouse);
      return;
    }
  }
}
