import * as React from "react";
import {
  createPling as createVanillaPling,
  type ActionOptions,
  type FeedbackValue,
  type ScopeOptions,
  type StateSource,
  type TaskValue,
  type ToolOptions,
  type VanillaDock,
  type VanillaDockOptions,
  type VanillaPling,
  type VanillaPlingOptions,
} from "@plingjs/vanilla";

export { createVanillaPling as createPling };
export type { ActionOptions, ScopeOptions, TaskValue, ToolOptions, VanillaDock, VanillaPlingOptions };
export type PlingElement = VanillaPling;
export type PlingToolOptions = ToolOptions;

export interface PlingProviderProps {
  pling: VanillaPling;
  children?: React.ReactNode;
}

const PlingContext = React.createContext<VanillaPling | null>(null);
PlingContext.displayName = "PlingContext";

/** React 16.3-compatible context provider. */
export function PlingProvider(props: PlingProviderProps): React.ReactElement {
  return React.createElement(PlingContext.Provider, { value: props.pling }, props.children);
}

export interface PlingConsumerProps {
  children: (pling: VanillaPling) => React.ReactNode;
}

/** Read the nearest Pling instance with the context API available in React 16.3. */
export function PlingConsumer(props: PlingConsumerProps): React.ReactElement {
  return React.createElement(
    PlingContext.Consumer,
    null,
    ((pling: VanillaPling | null) => {
      if (!pling) throw new Error("pling: wrap the tree in <PlingProvider pling={...}> first");
      return props.children(pling);
    }) as unknown as React.ReactNode,
  );
}

type RefCallback<T extends Element = Element> = (element: T | null) => void;

interface ElementBindingProps {
  pling: VanillaPling;
  deps: readonly unknown[];
  bind: (pling: VanillaPling, element: Element) => () => void;
  children: (ref: RefCallback) => React.ReactNode;
}

function sameDeps(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

class ElementBinding extends React.Component<ElementBindingProps> {
  private element: Element | null = null;
  private dispose: (() => void) | null = null;
  private mounted = false;

  private readonly setRef: RefCallback = (element) => {
    if (element === this.element) return;
    this.unbind();
    this.element = element;
    if (this.mounted) this.bind();
  };

  private bind(): void {
    if (!this.element) return;
    this.dispose = this.props.bind(this.props.pling, this.element);
  }

  private unbind(): void {
    this.dispose?.();
    this.dispose = null;
  }

  componentDidMount(): void {
    this.mounted = true;
    this.bind();
  }

  componentDidUpdate(previous: ElementBindingProps): void {
    if (previous.pling === this.props.pling && sameDeps(previous.deps, this.props.deps)) return;
    this.unbind();
    this.bind();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.unbind();
    this.element = null;
  }

  render(): React.ReactNode {
    return this.props.children(this.setRef);
  }
}

function withPling(
  render: (pling: VanillaPling) => React.ReactNode,
): React.ReactElement {
  return React.createElement(
    PlingContext.Consumer,
    null,
    ((pling: VanillaPling | null) => {
      if (!pling) throw new Error("pling: wrap the tree in <PlingProvider pling={...}> first");
      return render(pling);
    }) as unknown as React.ReactNode,
  );
}

export interface PlingToolProps {
  options: ToolOptions;
  children: (ref: RefCallback) => React.ReactNode;
}

/** Declare a DOM action without Hooks. */
export function PlingTool(props: PlingToolProps): React.ReactElement {
  return withPling((pling) =>
    React.createElement(ElementBinding, {
      pling,
      deps: [props.options],
      bind: (current, element) => current.tool(element, props.options),
      children: props.children,
    }),
  );
}

export interface PlingScopeProps {
  options: ScopeOptions;
  children: (ref: RefCallback) => React.ReactNode;
}

/** Declare a page region without Hooks. */
export function PlingScope(props: PlingScopeProps): React.ReactElement {
  return withPling((pling) =>
    React.createElement(ElementBinding, {
      pling,
      deps: [props.options],
      bind: (current, element) => current.scope(element, props.options),
      children: props.children,
    }),
  );
}

export interface PlingRecordProps {
  value: unknown;
  children: (ref: RefCallback) => React.ReactNode;
}

/** Bind one row to a DOM element without Hooks. */
export function PlingRecord(props: PlingRecordProps): React.ReactElement {
  return withPling((pling) =>
    React.createElement(ElementBinding, {
      pling,
      deps: [props.value],
      bind: (current, element) => current.record(element, props.value as never),
      children: props.children,
    }),
  );
}

export interface PlingFeedbackProps {
  value: FeedbackValue | readonly FeedbackValue[];
  children: (ref: RefCallback) => React.ReactNode;
}

/** Declare visible page feedback without Hooks. */
export function PlingFeedback(props: PlingFeedbackProps): React.ReactElement {
  return withPling((pling) =>
    React.createElement(ElementBinding, {
      pling,
      deps: [props.value],
      bind: (current, element) => current.declareFeedback(element, props.value),
      children: props.children,
    }),
  );
}

export interface PlingTaskProps {
  value: TaskValue;
  children: (ref: RefCallback<HTMLElement>) => React.ReactNode;
}

/** Declare a human-facing task entrance without Hooks. */
export function PlingTask(props: PlingTaskProps): React.ReactElement {
  return withPling((pling) =>
    React.createElement(ElementBinding, {
      pling,
      deps: [props.value],
      bind: (current, element) => current.declareTask(element as HTMLElement, props.value),
      children: props.children as (ref: RefCallback) => React.ReactNode,
    }),
  );
}

export interface PlingGuideTargetProps {
  id: string;
  children: (ref: RefCallback) => React.ReactNode;
}

/** Mark a handoff guide target without registering an action. */
export function PlingGuideTarget(props: PlingGuideTargetProps): React.ReactElement {
  return withPling((pling) =>
    React.createElement(ElementBinding, {
      pling,
      deps: [props.id],
      bind: (current, element) => current.guideTarget(element, props.id),
      children: props.children,
    }),
  );
}

interface StateBindingProps {
  pling: VanillaPling;
  name: string;
  source: StateSource;
  description?: string;
}

class StateBinding extends React.Component<StateBindingProps> {
  private dispose: (() => void) | null = null;

  private readonly read = (): unknown => {
    const source = this.props.source;
    return typeof source === "function" ? (source as () => unknown)() : source;
  };

  private bind(): void {
    this.dispose = this.props.pling.state(this.props.name, this.read, this.props.description);
  }

  componentDidMount(): void {
    this.bind();
  }

  componentDidUpdate(previous: StateBindingProps): void {
    if (previous.pling === this.props.pling && previous.name === this.props.name && previous.description === this.props.description) return;
    this.dispose?.();
    this.bind();
  }

  componentWillUnmount(): void {
    this.dispose?.();
    this.dispose = null;
  }

  render(): null {
    return null;
  }
}

export interface PlingStateProps {
  name: string;
  source: StateSource;
  description?: string;
}

/** Expose a read-only state view without Hooks. */
export function PlingState(props: PlingStateProps): React.ReactElement {
  return withPling((pling) =>
    React.createElement(StateBinding, {
      pling,
      name: props.name,
      source: props.source,
      description: props.description,
    }),
  );
}

export interface PlingActionProps {
  options: ActionOptions;
}

class ActionBinding extends React.Component<PlingActionProps & { pling: VanillaPling }> {
  private dispose: (() => void) | null = null;

  private bind(): void {
    this.dispose = this.props.pling.action(this.props.options);
  }

  componentDidMount(): void {
    this.bind();
  }

  componentDidUpdate(previous: PlingActionProps & { pling: VanillaPling }): void {
    if (previous.pling === this.props.pling && previous.options === this.props.options) return;
    this.dispose?.();
    this.bind();
  }

  componentWillUnmount(): void {
    this.dispose?.();
    this.dispose = null;
  }

  render(): null {
    return null;
  }
}

/** Declare a function action without a DOM element. */
export function PlingAction(props: PlingActionProps): React.ReactElement {
  return withPling((pling) => React.createElement(ActionBinding, { pling, options: props.options }));
}

export interface AgentDockProps extends Omit<VanillaDockOptions, "mount"> {
  className?: string;
  style?: React.CSSProperties;
}

export interface AgentDockHandle {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

interface DockHostProps extends AgentDockProps {
  pling: VanillaPling;
}

class DockHost extends React.Component<DockHostProps> {
  private element: HTMLDivElement | null = null;
  private controller: VanillaDock | null = null;
  private mounted = false;

  private readonly setRef = (element: HTMLDivElement | null): void => {
    this.element = element;
    if (this.mounted && element) this.create();
  };

  private create(): void {
    if (!this.element || this.controller) return;
    const { pling, className: _className, style: _style, ...options } = this.props;
    this.controller = pling.dock({ ...options, mount: this.element });
  }

  componentDidMount(): void {
    this.mounted = true;
    this.create();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.controller?.destroy();
    this.controller = null;
  }

  open = (): void => this.controller?.open();
  close = (): void => this.controller?.close();
  toggle = (): void => this.controller?.toggle();
  isOpen = (): boolean => this.controller?.isOpen() ?? false;
  destroy = (): void => {
    this.controller?.destroy();
    this.controller = null;
  };

  render(): React.ReactNode {
    return React.createElement("div", { ref: this.setRef, className: this.props.className, style: this.props.style });
  }
}

const AgentDockForwardRef = React.forwardRef<AgentDockHandle, AgentDockProps>(function AgentDock(
  props,
  ref,
): React.ReactElement {
  return withPling((pling) => React.createElement(
    DockHost,
    { ...props, pling, ref } as unknown as React.Attributes & DockHostProps,
  ));
});

/**
 * The call signature is written by hand instead of exposing
 * `React.ForwardRefExoticComponent` directly. React 19 types return
 * `ReactNode` from forwardRef components, which React 16's JSX checker
 * rejects; an explicit `ReactElement` return keeps one declaration usable
 * with both type versions.
 */
export interface AgentDockComponent {
  (props: AgentDockProps & { ref?: React.Ref<AgentDockHandle> }): React.ReactElement;
}

/** Mount the shared assistant hosted by the Vanilla runtime. */
export const AgentDock = AgentDockForwardRef as unknown as AgentDockComponent;

export interface AgentInlineProps extends AgentDockProps {}

/** Inline assistant surface for legacy React layouts. */
export function AgentInline(props: AgentInlineProps): React.ReactElement {
  return React.createElement(AgentDock, { ...props, layout: "inline" });
}
