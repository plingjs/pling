import {
  hasDynamicParams,
  schemaOf,
  type ActionDescriptor,
  type HandoffSpec,
  type Primitive,
} from "@plingjs/core";
import {
  checkActionable,
  describeElement,
  getRegistryNamespace,
  markExplicit,
  nearestScope,
  performPrimitive,
  resolveTarget,
  scrollElementIntoView,
  targetWarning,
  unmarkExplicit,
} from "@plingjs/dom";
import type { ActionOptions, ToolOptions, VanillaHost } from "./types";

let autoId = 0;

const NATIVE_RUN_VALUE: Partial<Record<Primitive, (args: Record<string, unknown>) => unknown>> = {
  type: (args) => args.text,
  select: (args) => args.value,
  press: (args) => args.key,
};

export function inferPrimitive(element: Element, options: ToolOptions): Primitive {
  if (options.action === "press") return "press";
  if (options.action === "hover") return "hover";
  if (options.action === "click") return "click";
  if (options.action === "select") return "select";
  if (options.action === "fill") return "type";
  const tag = element.tagName.toLowerCase();
  if (tag === "select") return "select";
  if (tag === "textarea") return "type";
  if (tag === "input") {
    const type = (element as HTMLInputElement).type;
    return type === "checkbox" || type === "radio" ? "click" : "type";
  }
  return "click";
}

function normalizeHandoff(options: ToolOptions): HandoffSpec | undefined {
  const value = options.handoff;
  if (!value) return undefined;
  const fallback = options.desc?.trim() || "This step requires the user to complete it";
  if (value === true) return { reason: fallback };
  if (typeof value === "string") return { reason: value.trim() || fallback };
  const steps = value.steps
    ?.map((step) => (typeof step === "string" ? { text: step.trim() } : { ...step, text: step.text.trim() }))
    .filter((step) => step.text.length > 0);
  return {
    reason: value.reason?.trim() || fallback,
    ...(steps?.length ? { steps } : {}),
    ...(value.expect ? { expect: value.expect } : {}),
    ...(value.timeout === undefined ? {} : { timeout: value.timeout }),
  };
}

function runInjected(options: ToolOptions, primitive: Primitive, args: Record<string, unknown>): void | Promise<void> {
  if (options.params !== undefined) return options.run?.(args);
  return options.run?.(primitive === "click" ? undefined : NATIVE_RUN_VALUE[primitive]?.(args));
}

function closestScope(element: Element | null | undefined): string | undefined {
  return element ? nearestScope(element) : undefined;
}

/**
 * 原生 JS 的元素声明。
 *
 * 和 Vue / React 的差异只在「什么时候调用」：这里由开发者显式在元素挂载后调用，
 * 返回值是解绑函数。执行、目标解析、可用性、可见性与存在感全部复用 core / dom。
 */
export function bindTool(host: VanillaHost, element: Element, options: ToolOptions): () => void {
  const ids = getRegistryNamespace(host.registry);
  const id = options.id ?? `tool_${++autoId}`;
  const primitive = inferPrimitive(element, options);
  const resolution = resolveTarget(element, primitive, {
    hasInjectedRun: Boolean(options.run),
    declaredFidelity: options.fidelity,
    target: options.target,
    autoTarget: options.autoTarget,
  });
  const params = schemaOf(options.params);
  const handoff = normalizeHandoff(options);
  const descriptor: ActionDescriptor = {
    id,
    primitive,
    description: options.desc,
    kind: options.kind,
    confirm: options.confirm,
    ...(handoff ? { handoff: { reason: handoff.reason } } : {}),
    fidelity: resolution.fidelity,
    ...(params ? { params } : {}),
  };

  const warning = targetWarning(id, element.tagName.toLowerCase(), primitive, resolution);
  if (warning) host.warn(warning);
  if (!options.desc?.trim()) host.warn(`pling.tool「${id}」没有写说明（desc）`);
  if (options.params !== undefined && !options.run && primitive === "click") {
    host.warn(`pling.tool「${id}」声明了 params 但没有 run：click 原语不会用到这些参数`);
  }
  if (handoff && options.confirm !== undefined) {
    host.warn(`pling.tool「${id}」同时写了 handoff 和 confirm：人工接力的动作由用户亲手完成，confirm 不会再单独询问`);
  }
  if (handoff && options.run) {
    host.warn(`pling.tool「${id}」同时写了 handoff 和 run：接力动作不执行 run（这一步由用户亲自完成）`);
  }

  const currentTarget = (): Element => {
    if (resolution.element.isConnected || resolution.element === element) return resolution.element;
    const again = resolveTarget(element, primitive, {
      hasInjectedRun: Boolean(options.run),
      declaredFidelity: options.fidelity,
      target: options.target,
      autoTarget: options.autoTarget,
    });
    return again.element.isConnected ? again.element : element;
  };

  let untrack: (() => void) | null = null;
  const initialScope = options.scope === undefined ? closestScope(element) : ids.scope(options.scope);
  if (initialScope) untrack = host.track(element, initialScope);

  const unbind = host.registry.bind({
    descriptor,
    ...(options.expect ? { expect: options.expect } : {}),
    ...(handoff ? { handoff } : {}),
    ...(hasDynamicParams(options.params) ? { resolveParams: () => schemaOf(options.params)! } : {}),
    resolveScope: () => (options.scope === undefined ? closestScope(element) : ids.scope(options.scope)),
    isAvailable: () => {
      const declared = options.available?.();
      const own = checkActionable(element);
      if (!own.available) {
        if (typeof declared === "string") {
          return { ...own, reason: own.reason ? `${own.reason}；${declared}` : declared, reasonSuffix: declared };
        }
        return own;
      }
      const target = currentTarget();
      if (target !== element) {
        const targetState = checkActionable(target);
        if (!targetState.available) {
          if (typeof declared === "string") {
            return {
              ...targetState,
              reason: targetState.reason ? `${targetState.reason}；${declared}` : declared,
              reasonSuffix: declared,
            };
          }
          return targetState;
        }
      }
      const cover = host.scopes.coverOf(target);
      if (cover) {
        const element = describeElement(cover);
        return {
          available: false,
          reason: `Covered by ${element} (possibly an open dialog or overlay)`,
          reasonKey: "availability.covered",
          reasonParams: { element },
        };
      }
      if (typeof declared === "string") return { available: false, reason: declared };
      if (declared === false) {
        return {
          available: false,
          reason: "This action's preconditions are not met",
          reasonKey: "availability.preconditions",
        };
      }
      return true;
    },
    isVisible: () => host.scopes.isVisible(element),
    ...(host.presence ? { presence: (state) => host.presence?.mark(currentTarget(), state) } : {}),
    reveal: async () => scrollElementIntoView(currentTarget()),
    run: async (args) => {
      if (options.run) {
        await runInjected(options, primitive, args);
        return;
      }
      performPrimitive(currentTarget(), primitive, primitive === "press" ? { key: options.key ?? "Enter", ...args } : args);
    },
  });

  markExplicit(element, [id]);
  return () => {
    unbind();
    untrack?.();
    untrack = null;
    unmarkExplicit(element);
    host.scopes.refresh();
  };
}

/** 函数级工具：没有 DOM 元素，由调用方提供 run。 */
export function bindAction(
  host: Pick<VanillaHost, "registry" | "warn">,
  options: ActionOptions,
): () => void {
  if (!options.desc?.trim()) throw new Error(`pling.action「${options.id}」缺少 desc：模型只能靠说明判断它是干什么的`);
  const params = schemaOf(options.params);
  return host.registry.bind({
    descriptor: {
      id: options.id,
      primitive: "call",
      description: options.desc,
      kind: options.kind,
      confirm: options.confirm,
      fidelity: "high",
      ...(params ? { params } : {}),
    },
    ...(options.expect ? { expect: options.expect } : {}),
    ...(hasDynamicParams(options.params) ? { resolveParams: () => schemaOf(options.params)! } : {}),
    isAvailable: () => {
      const declared = options.available?.();
      if (typeof declared === "string") return { available: false, reason: declared };
      if (declared === false) {
        return {
          available: false,
          reason: "This action's preconditions are not met",
          reasonKey: "availability.preconditions",
        };
      }
      return true;
    },
    run: async (args) => options.run(args),
  });
}
