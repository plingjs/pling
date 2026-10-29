import type {
  DefaultApproval,
  Expectation,
  Fidelity,
  HandoffStep,
  Kind,
  Llm,
  ParamDeclaration,
  RecordValue,
  RegionRole,
  Registry,
} from "@plingjs/core";
import type {
  AgentConfigOverrides,
  AgentRuntime,
  AgentRuntimeOptions,
  HookRegistry,
  SessionEvent,
} from "@plingjs/agent";
import type {
  DeriveController,
  DeriveOptions,
  PlingPage,
  PresenceController,
  PresenceOptions,
  ScopeController,
  ScopeControllerOptions,
} from "@plingjs/dom";
import type { PlingUiController, PlingUiOptions } from "@plingjs/ui";

export interface ToolOptionsBase {
  /** 给 agent 的说明（必填）：这个元素是什么、做什么。 */
  desc: string;
  /** 稳定 id；省略时按绑定顺序生成一次。列表行建议显式传入。 */
  id?: string;
  /** 显式作用域；省略时继承最近的 `data-pling-scope`。 */
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
  /** 人工接力：这一步由用户亲自完成，框架不模拟点击。 */
  handoff?: boolean | string | {
    reason?: string;
    expect?: Expectation;
    steps?: readonly (string | HandoffStep)[];
    timeout?: number;
  };
}

export interface AtomicToolOptions extends ToolOptionsBase {
  params?: undefined;
  run?: (value?: unknown) => void | Promise<void>;
}

export interface ParamsToolOptions extends ToolOptionsBase {
  params: ParamDeclaration;
  run?: (args: Record<string, unknown>) => void | Promise<void>;
}

export type ToolOptions = AtomicToolOptions | ParamsToolOptions;

export interface ActionOptions {
  id: string;
  desc: string;
  kind?: Kind;
  confirm?: boolean | "always";
  params?: ParamDeclaration;
  available?: () => boolean | string;
  expect?: Expectation;
  run: (args: Record<string, unknown>) => unknown;
}

export interface ScopeOptions {
  /** 稳定区域 id（同时写进 DOM 的 `data-pling-scope`，供子元素继承）。 */
  id: string;
  /** 面向模型的区域名，如「待办列表」。 */
  label?: string;
  /** 这块区域是干什么的。 */
  description?: string;
  /** 结构角色：header / main / dialog / toolbar … */
  role?: RegionRole;
  /** 显式父区域；省略时从最近的祖先 scope 自动推断。 */
  parent?: string;
}

export interface StateOptions {
  /** 面向模型的说明：这组状态是什么（强烈建议写）。 */
  description?: string;
}

export type StateSource = unknown | (() => unknown);

/**
 * 应用级问答接线。与 Vue 的 `AgentSetup` / React 的 `AgentSetup` 同义：
 * 业务侧只在入口写一次，`pling.dock()` 自己取。
 */
export type AgentSetup = Omit<AgentRuntimeOptions, "config" | "registry" | "gate"> & {
  config?: AgentConfigOverrides;
  gate?: () => boolean;
};

export interface VanillaDockOptions {
  title?: string;
  placeholder?: string;
  emptyHint?: string;
  /** 推荐指令：点一下等于把这句话发出去。 */
  quick?: readonly string[];
  defaultOpen?: boolean;
  /** 覆盖模型配置（只写想改的字段；其余从 `.env.local` 读）。 */
  config?: AgentConfigOverrides;
  /** 注入模型（测试 / 自己的薄 Node 层 / 无网络演示）。 */
  llm?: Llm;
  /** 工具生命周期钩子；不传就用应用级 `agent.hooks`。 */
  hooks?: HookRegistry;
  /** 确认通道开关：返回 false 时所有动作直接执行。 */
  gate?: () => boolean;
  /** 注册表：一般不用传，默认用这个 Pling 实例的。 */
  registry?: Registry;
  /** 会话事件（业务要审计 / 自己记日志时用）。 */
  onSessionEvent?: (event: SessionEvent) => void;
  onOpenChange?: (open: boolean) => void;
  /** 任务完成后的导航实现；默认 `window.location.replace`。一般只在测试 / 自定义宿主要传。 */
  navigate?: (href: string) => void;
}

/** `pling.dock()` 返回的控制器：高级场景可主动开关 / 销毁。 */
export interface VanillaDock {
  readonly element: HTMLElement;
  readonly runtime: AgentRuntime;
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

export interface VanillaPlingOptions {
  /** Shared framework UI language, theme and message overrides. Defaults to English. */
  ui?: PlingUiOptions;
  registry?: Registry;
  /**
   * 混合框架页面共享的页面运行时（`createPlingPage()`）。
   * 传了它之后 `registry` / `scopes` 由页面统一持有，不能再单独覆盖。
   */
  shared?: PlingPage;
  /** 本适配器的动作 id 命名空间：`add` → `todo/add`。 */
  namespace?: string;
  onWarn?: (message: string) => void;
  /** 问答入口接线：模型、钩子、确认通道等都写在这里。 */
  agent?: AgentSetup;
  /** 聊天里把敏感值代号还原成真值；默认开。 */
  revealSensitive?: boolean;
  /** 动作没写 confirm 时的默认策略；省略沿用 registry 的当前值。 */
  defaultApproval?: DefaultApproval;
  /** 可见性 / 遮挡判定的注入点（测试与无布局环境用）。 */
  scopes?: ScopeControllerOptions;
  /** 动作高亮：默认开启；`false` 全关，或传对象换画法。 */
  presence?: boolean | PresenceOptions;
  /** L1 自动派生：默认关闭。 */
  derive?: boolean | DeriveOptions;
}

/** 适配器内部与公开实例共用的宿主能力。 */
export interface VanillaHost {
  ui: PlingUiController;
  registry: Registry;
  scopes: ScopeController;
  presence: PresenceController | null;
  agent?: AgentSetup;
  revealSensitive: boolean;
  warn(message: string): void;
  /** 把一个元素登记到某个作用域的可见性观察；同元素重复登记是幂等的。 */
  track(element: Element, scope: string): () => void;
}

export interface VanillaPling extends VanillaHost {
  /** 把一个 DOM 元素声明成动作；返回解绑函数。 */
  tool(element: Element, options: ToolOptions): () => void;
  /** 声明没有 DOM 元素的函数级动作；返回解绑函数。 */
  action(options: ActionOptions): () => void;
  /** 把一行数据声明成记录；返回解绑函数。 */
  record(element: Element, value: RecordValue | null | undefined): () => void;
  /** 声明一块页面区域；返回解绑函数。 */
  scope(element: Element, options: ScopeOptions): () => void;
  /** 暴露只读状态视图；返回注销函数。 */
  state(key: string, source: StateSource, options?: StateOptions | string): () => void;
  /** 手动声明活跃区域（自动判定之外的后门）。 */
  setActiveScopes(scopes: Iterable<string>): void;
  /** 挂一个原生浮动问答入口；返回控制器。 */
  dock(options?: VanillaDockOptions): VanillaDock;
  /** L1 自动派生器（只在 `derive` 开启时非空）。 */
  derived(): DeriveController | null;
  /** 停掉观察器并注销全部声明。 */
  destroy(): void;
}
