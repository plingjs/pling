import type { Fidelity, Primitive } from "@plingjs/core";

const CANDIDATE_SELECTORS: Record<Primitive, string[]> = {
  click: [
    "button",
    "a[href]",
    "summary",
    "input[type=checkbox]",
    "input[type=radio]",
    '[role="button"]',
    "[tabindex]",
  ],
  type: [
    "input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])",
    "textarea",
    '[contenteditable="true"]',
    '[contenteditable=""]',
  ],
  select: ["select"],
  press: ["input", "textarea", '[contenteditable="true"]'],
  navigate: ["a[href]"],
  scroll: [],
  hover: [],
  flow: [],
  call: [],
};

const NATIVE_TAGS = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "OPTION", "SUMMARY"]);

export function isNativeInteractive(el: Element): boolean {
  const tag = el.tagName;
  if (tag === "A") return el.hasAttribute("href");
  if (NATIVE_TAGS.has(tag)) return true;
  return el.hasAttribute("contenteditable");
}

export type TargetReason = "injected" | "flow" | "declared" | "native" | "auto" | "unresolved" | "ambiguous" | "target-missing";

export interface TargetResolution {
  element: Element;
  fidelity: Fidelity;
  reason: TargetReason;
  candidates: number;
}

export interface TargetOptions {
  hasInjectedRun: boolean;
  declaredFidelity?: Fidelity;
  target?: string;
  autoTarget?: boolean;
}

/** 注册期算出「这个原语到底该作用在谁身上」。 */
export function resolveTarget(el: Element, primitive: Primitive, options: TargetOptions): TargetResolution {
  const base = { element: el, candidates: 0 };
  if (primitive === "flow") return { ...base, fidelity: "high", reason: "flow" };
  if (options.hasInjectedRun) return { ...base, fidelity: "high", reason: "injected" };
  if (options.declaredFidelity) return { ...base, fidelity: options.declaredFidelity, reason: "declared" };
  if (options.target) {
    const found = el.querySelector(options.target);
    return found
      ? { element: found, fidelity: "high", reason: "declared", candidates: 1 }
      : { ...base, fidelity: "low", reason: "target-missing" };
  }
  if (isNativeInteractive(el)) return { ...base, fidelity: "high", reason: "native" };
  if (options.autoTarget === false) return { ...base, fidelity: "low", reason: "unresolved" };
  const selector = CANDIDATE_SELECTORS[primitive];
  if (!selector.length) return { ...base, fidelity: "low", reason: "unresolved" };
  const found = el.querySelectorAll(selector.join(","));
  if (found.length === 1) return { element: found[0]!, fidelity: "auto", reason: "auto", candidates: 1 };
  if (found.length === 0) return { ...base, fidelity: "low", reason: "unresolved" };
  return { ...base, fidelity: "low", reason: "ambiguous", candidates: found.length };
}

export function targetWarning(
  actionId: string,
  tagName: string,
  primitive: Primitive,
  resolution: TargetResolution,
): string | null {
  const fixRun = `  修法一（就近注入）：run 直接写你的处理函数`;
  const fixTarget = `  修法二（指定目标）：target: 'CSS 选择器'`;
  switch (resolution.reason) {
    case "unresolved":
      return (
        `[pling] 动作 "${actionId}" 注册在 <${tagName}> 上，既不是原生可交互元素，内层也没有找到能执行 ${primitive} 的原生元素。\n` +
        `  现在只能对 <${tagName}> 做 DOM 模拟，多半不会生效。\n${fixRun}\n${fixTarget}`
      );
    case "ambiguous":
      return (
        `[pling] 动作 "${actionId}"（<${tagName}>）内层找到 ${resolution.candidates} 个候选元素，无法确定动作目标。\n` +
        `  请显式指定其中之一，否则动作会作用在 <${tagName}> 上、多半不生效。\n${fixTarget}\n${fixRun}`
      );
    case "target-missing":
      return `[pling] 动作 "${actionId}"（<${tagName}>）的 target 选择器没匹配到任何元素。检查选择器是否写错，或元素是否还没渲染。`;
    default:
      return null;
  }
}
