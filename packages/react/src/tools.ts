import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefCallback,
} from "react";
import {
  hasDynamicParams,
  schemaOf,
  type ActionDescriptor,
  type Expectation,
  type Fidelity,
  type FlowStep,
  type HandoffStep,
  type Kind,
  type ParamDeclaration,
  type PresenceState,
  type Primitive,
  type Registry,
} from "@plingjs/core";
import {
  checkActionable,
  describeElement,
  getRegistryNamespace,
  markExplicit,
  performPrimitive,
  resolveTarget,
  scrollElementIntoView,
  targetWarning,
  unmarkExplicit,
} from "@plingjs/dom";
import { usePling } from "./context";
import { closestScopeOf } from "./scope";
import type { PlingElement } from "./context";

export interface ToolOptionsBase {
  /** 给 agent 的说明（必填）：这个元素是什么、做什么。 */
  desc: string;
  /** 稳定 id；省略时按 hook 实例生成一次。 */
  id?: string;
  /** 显式作用域；省略时继承最近的 `data-pling-scope`。portal / 弹窗挂到 body 时用它。 */
  scope?: string;
  /** 风险等级，默认 write（fail-closed）。 */
  kind?: Kind;
  /** 确认策略覆盖；省略时按 kind 推导。 */
  confirm?: boolean | "always";
  /** 覆盖原语推断（默认：表单输入→type，其余→click）。 */
  action?: "click" | "fill" | "select" | "press" | "hover";
  /** action: "press" 时按哪个键，默认 Enter。 */
  key?: string;
  /** 显式声明保真度，不再自动定位目标。 */
  fidelity?: Fidelity;
  /** 在声明元素内部查找目标的 CSS 选择器。 */
  target?: string;
  /** 关掉「自动定位内层原生元素」，默认开启。 */
  autoTarget?: boolean;
  /** 业务前置条件；返回字符串时，该字符串就是给模型看的原因。 */
  available?: () => boolean | string | undefined;
  /** 成功判据：动作后等它成立，等不到则如实报 EXPECTATION_FAILED。 */
  expect?: Expectation;
  /**
   * 人工接力：这一步由用户亲自完成，框架不模拟点击。
   *
   * `true` / 字符串是简写；对象可写清原因、成功判据、分步指引与超时。
   * 有它时 `run` 不会执行，`confirm` 也不再单独询问（用户亲手完成就是批准）。
   */
  handoff?: boolean | string | {
    reason?: string;
    expect?: Expectation;
    steps?: readonly (string | HandoffStep)[];
    timeout?: number;
  };
  /**
   * 复合动作：对模型是一个 tool，内部按顺序执行这些已注册动作。
   * 步骤在轮到它时才解析，因此弹窗中稍后出现的动作也可以引用。
   */
  steps?: readonly FlowStep[];
}

export interface AtomicToolOptions extends ToolOptionsBase {
  params?: undefined;
  run?: (value?: unknown) => void | Promise<void>;
}

export interface ParamsToolOptions extends ToolOptionsBase {
  params: ParamDeclaration;
  run?: (args: Record<string, unknown>) => void | Promise<void>;
}

export type PlingToolOptions = AtomicToolOptions | ParamsToolOptions;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
let autoId = 0;

const NATIVE_RUN_VALUE: Partial<Record<Primitive, (args: Record<string, unknown>) => unknown>> = {
  type: (args) => args.text,
  select: (args) => args.value,
  press: (args) => args.key,
};

function inferPrimitive(el: Element, options: PlingToolOptions): Primitive {
  if (options.action === "press") return "press";
  if (options.action === "hover") return "hover";
  if (options.action === "click") return "click";
  if (options.action === "select") return "select";
  if (options.action === "fill") return "type";
  const tag = el.tagName.toLowerCase();
  if (tag === "select") return "select";
  if (tag === "textarea") return "type";
  if (tag === "input") {
    const type = (el as HTMLInputElement).type;
    return type === "checkbox" || type === "radio" ? "click" : "type";
  }
  return "click";
}

function paramSignature(params: ParamDeclaration | undefined): unknown {
  if (!params || !Array.isArray(params)) return params ?? null;
  return params.map((param) => ({
    ...param,
    pattern: param.pattern instanceof RegExp ? param.pattern.source : param.pattern,
    options: param.options ? "[options]" : undefined,
    min: typeof param.min === "function" ? "[fn]" : param.min,
    max: typeof param.max === "function" ? "[fn]" : param.max,
  }));
}

function signatureOf(id: string, options: PlingToolOptions): string {
  return JSON.stringify([
    id,
    options.desc,
    options.kind,
    options.confirm,
    options.action,
    options.key,
    options.fidelity,
    options.target,
    options.autoTarget,
    options.scope,
    options.handoff,
    options.steps ?? null,
    paramSignature(options.params),
  ]);
}

function normalizeHandoff(options: PlingToolOptions): {
  reason: string;
  steps?: readonly HandoffStep[];
  expect?: Expectation;
  timeout?: number;
} | undefined {
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

function runInjected(
  options: PlingToolOptions,
  primitive: Primitive,
  args: Record<string, unknown>,
): void | Promise<void> {
  if (options.params !== undefined) return options.run?.(args);
  return options.run?.(primitive === "click" ? undefined : NATIVE_RUN_VALUE[primitive]?.(args));
}

/**
 * 把一个 DOM 元素声明成 agent 动作，并返回要挂到元素上的 ref。
 *
 * ```tsx
 * const add = usePlingTool<HTMLButtonElement>({ id: "add_todo", desc: "新增待办" });
 * return <button ref={add} onClick={onAdd}>新增</button>;
 * ```
 */
export function usePlingTool<T extends Element = HTMLElement>(options: PlingToolOptions): RefCallback<T> {
  const pling = usePling();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const generatedId = useRef<string | null>(null);
  if (!generatedId.current) generatedId.current = `tool_${++autoId}`;
  const id = options.id ?? generatedId.current;
  const signature = signatureOf(id, options);
  const [element, setElement] = useState<T | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useIsomorphicLayoutEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!element) return;
    cleanupRef.current = bindElement(pling, element, id, optionsRef);
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [pling, element, id, signature]);

  // 作用域标记由父容器的 layout effect 写入；被动 effect 在所有 layout effect 之后运行，
  // 这时才去认「最近的作用域」才不会因为 React 的子先父后而漏掉。
  useEffect(() => {
    if (!element) return;
    const ids = getRegistryNamespace(pling.registry);
    const declared = optionsRef.current.scope;
    const scope = declared === undefined ? closestScopeOf(element) : ids.scope(declared);
    if (!scope) return;
    return pling.scopes.track(element, scope);
  }, [pling, element, signature]);

  return useCallback<RefCallback<T>>((node) => setElement(node), []);
}

function bindElement(
  pling: Pick<PlingElement, "registry" | "warn" | "scopes" | "presence">,
  element: Element,
  id: string,
  optionsRef: { current: PlingToolOptions },
): () => void {
  const ids = getRegistryNamespace(pling.registry);
  const options = optionsRef.current;
  const steps = options.steps ?? null;
  const isFlow = steps !== null;
  const primitive = isFlow ? "flow" : inferPrimitive(element, options);
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
  const warn = pling.warn;
  const warning = targetWarning(id, element.tagName.toLowerCase(), primitive, resolution);
  if (warning) warn(warning);
  if (!options.desc?.trim()) warn(`usePlingTool「${id}」没有写说明（desc）`);
  if (isFlow && options.run) {
    warn(`usePlingTool「${id}」同时写了 steps 和 run：复合动作按 steps 执行，run 不会运行`);
  }
  if (isFlow && steps && steps.length === 0) {
    warn(`usePlingTool「${id}」的 steps 是空的：这条流程一步都不会走`);
  }
  if (options.params !== undefined && !options.run && primitive === "click") {
    warn(`usePlingTool「${id}」声明了 params 但没有 run：click 原语不会用到这些参数`);
  }
  if (handoff && options.confirm !== undefined) {
    warn(`usePlingTool「${id}」同时写了 handoff 和 confirm：人工接力的动作由用户亲手完成，confirm 不会再单独询问`);
  }
  if (handoff && options.run) {
    warn(`usePlingTool「${id}」同时写了 handoff 和 run：接力动作不执行 run（这一步由用户亲自完成）`);
  }
  if (handoff && isFlow) {
    warn(`usePlingTool「${id}」同时写了 handoff 和 steps：整个流程交给用户完成，steps 不会执行`);
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

  const unbind = pling.registry.bind({
    descriptor,
    ...(options.expect ? { expect: options.expect } : {}),
    ...(handoff ? { handoff } : {}),
    ...(isFlow ? { steps } : {}),
    ...(hasDynamicParams(options.params) ? { resolveParams: () => schemaOf(optionsRef.current.params)! } : {}),
    resolveScope: () => {
      const declared = optionsRef.current.scope;
      return declared === undefined ? closestScopeOf(element) : ids.scope(declared);
    },
    isAvailable: () => {
      const latest = optionsRef.current;
      const declared = latest.available?.();
      if (isFlow) {
        if (typeof declared === "string") return { available: false, reason: declared };
        if (declared === false) {
          return {
            available: false,
            reason: "This flow's preconditions are not met",
            reasonKey: "availability.flowPreconditions",
          };
        }
        return true;
      }
      const own = checkActionable(element);
      if (!own.available) {
        if (typeof declared === "string") {
          return { ...own, reason: own.reason ? `${own.reason}；${declared}` : declared, reasonSuffix: declared };
        }
        return own;
      }
      if (resolution.element !== element) {
        const target = checkActionable(resolution.element);
        if (!target.available) {
          if (typeof declared === "string") {
            return { ...target, reason: target.reason ? `${target.reason}；${declared}` : declared, reasonSuffix: declared };
          }
          return target;
        }
      }
      // 层叠：几何上在视口里、但被遮罩 / 弹窗压住 —— 点下去会点到别人。
      // 框架自己的聊天浮窗有 data-pling-ui，不会被当成业务遮罩。
      const cover = pling.scopes.coverOf(currentTarget());
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
    isVisible: () => pling.scopes.isVisible(element),
    ...(isFlow
      ? {}
      : {
          ...(pling.presence ? { presence: (state: PresenceState) => pling.presence?.mark(currentTarget(), state) } : {}),
          reveal: async () => scrollElementIntoView(currentTarget()),
          run: async (args: Record<string, unknown>) => {
            const latest = optionsRef.current;
            if (latest.run) {
              await runInjected(latest, primitive, args);
              return;
            }
            performPrimitive(currentTarget(), primitive, primitive === "press" ? { key: latest.key ?? "Enter", ...args } : args);
          },
        }),
  });
  markExplicit(element, [id]);
  return () => {
    unbind();
    unmarkExplicit(element);
  };
}

export interface AgentToolOptions {
  id: string;
  desc: string;
  kind?: Kind;
  confirm?: boolean | "always";
  params?: ParamDeclaration;
  available?: () => boolean | string;
  expect?: Expectation;
  run: (args: Record<string, unknown>) => unknown;
}

/** 注册没有 DOM 元素的函数级动作；随组件卸载自动注销。 */
export function useAgentTool(options: AgentToolOptions): void {
  const pling = usePling();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  if (!options.desc?.trim()) {
    throw new Error(`useAgentTool「${options.id}」缺少 desc：模型只能靠说明判断它是干什么的`);
  }
  const params = schemaOf(options.params);
  const signature = JSON.stringify([options.id, options.desc, options.kind, options.confirm, paramSignature(options.params)]);

  useEffect(() => {
    const latest = optionsRef.current;
    const descriptor: ActionDescriptor = {
      id: latest.id,
      primitive: "call",
      description: latest.desc,
      kind: latest.kind,
      confirm: latest.confirm,
      fidelity: "high",
      ...(params ? { params } : {}),
    };
    const unbind = pling.registry.bind({
      descriptor,
      ...(latest.expect ? { expect: latest.expect } : {}),
      ...(hasDynamicParams(latest.params) ? { resolveParams: () => schemaOf(optionsRef.current.params)! } : {}),
      isAvailable: () => {
        const declared = optionsRef.current.available?.();
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
      run: async (args) => optionsRef.current.run(args),
    });
    return unbind;
  }, [pling, signature]);
}
