import { inject, type App, type Directive, type InjectionKey } from "vue";
import { checkActionable, describeElement, performPrimitive } from "./dom";
import {
  createRegistry,
  hasDynamicParams,
  resolveKind,
  schemaOf,
  type FlowStep,
  type ActionDescriptor,
  type Expectation,
  type HandoffStep,
  type ParamDeclaration,
  type Fidelity,
  type Kind,
  type Primitive,
  type RecordDeclaration,
  type RegionRole,
  type Registry,
} from "@plingjs/core";
import { resolveAgentConfig, type AgentConfigOverrides, type AgentRuntimeOptions } from "@plingjs/agent";
import { createActionNamespace, getRegistryNamespace, queryAllComposed, type PlingPage } from "@plingjs/dom";
import { readViteEnv } from "./env";
import { normalizeRecordValue, recordSignature, rewireFields, toDeclaration, type RecordValue } from "./record";
import {
  createDeriver,
  markExplicit,
  markRecordElement,
  unmarkExplicit,
  unmarkRecordElement,
  type DeriveController,
  type DeriveOptions,
} from "./derive";
import {
  SCOPE_ATTR,
  createScopeController,
  nearestScope,
  type ScopeController,
  type ScopeControllerOptions,
} from "./scope";
import { markScrolling, scrollBehavior, scrollElementIntoView, scrollWatcher } from "./scroll";
import { createPresence, type PresenceOptions } from "./presence";
import { resolveTarget, targetWarning } from "./target";
import {
  createFeedbackCollector,
  normalizeFeedbackValue,
  toFeedbackDeclaration,
  type FeedbackCollector,
  type FeedbackValue,
} from "./feedback";
import { createPageTracker, type PageOptions, type PageRouterLike, type PageTracker } from "./page";
import { inspectCoverage, type CoverageReport } from "./coverage";
import { createPlingUi, DEFAULT_VUE_LOCALE, type PlingUiController } from "./ui";
import type { ModelSettingsSetting } from "./model-settings";
import { createTaskController, type PlingAskOptions, type PlingTaskController } from "./task";
import type { PlingUiOptions } from "@plingjs/ui";

/** Human-facing task entrance (`v-task` / `pling.ask()`); never an agent action. */
export interface TaskOptions {
  /** Natural-language instruction sent to the shared agent surface. */
  prompt: string;
  /** Optional named surface. Omit it for the page's single mounted surface. */
  surface?: string;
  /** Keep the entrance visible but stop it from sending tasks. */
  disabled?: boolean;
}

export type TaskValue = string | TaskOptions;

export interface ToolOptionsBase {
  /** 给 agent 的说明（必填）：这个元素是什么、做什么 */
  desc: string;
  /** 稳定 id；列表项建议显式传入，否则自动生成 */
  id?: string;
  /** 风险等级，默认 write（fail-closed） */
  kind?: Kind;
  /**
   * 确认策略（省略 = 按 `kind` 推导）：
   *   `false`     担保这个动作不用问（danger 也能标，但会告警）
   *   `true`      要问（读操作也能标，比如「导出全量数据」）
   *   `"always"`  每次都问，且不给「总是允许」
   */
  confirm?: boolean | "always";
  /** 覆盖动作类型推断（默认：表单输入→type，其余→click） */
  action?: "click" | "fill" | "select" | "press" | "hover";
  /** action: "press" 时按哪个键，默认 Enter */
  key?: string;
  /**
   * 作用域：省略时自动继承最近的 `v-scope` 容器。
   * 显式传入且没有对应容器时，只能被 `setActiveScopes()` 手动激活（005 的用法）。
   */
  scope?: string;
  /** 覆盖保真度推断（显式声明后不再自动定位目标） */
  fidelity?: Fidelity;
  /** 显式指定动作目标：在声明元素内部查找的 CSS 选择器（候选不唯一时用它消歧） */
  target?: string;
  /** 关掉「自动定位内层原生元素」，默认开启 */
  autoTarget?: boolean;
  /**
   * 可选：业务前置条件 —— 元素在，但此刻不该 / 不能操作时用它。
   * 返回 `false` 表示不可用；返回**字符串**时，这个字符串就是原因，
   * 会随快照和执行错误一起给到模型，例如：
   *   `available: () => (selected.value ? true : "先选中至少一条订单")`
   */
  available?: () => boolean | string | undefined;
  /**
   * 可选：这一步的**成功判据**（S4）—— 「做完之后，页面该变成什么样」。
   *
   * ```ts
   * expect: {
   *   desc: "新待办出现在列表里",
   *   check: () => todos.items.value.some((t) => t.text === "买牛奶"),
   * }
   * ```
   *
   * 给了它，框架会在动作之后**等它成立**（默认最长 2s）：
   *   · 成立   → 成功回执里带 `expect`（「我确认了这件事发生了」）；
   *   · 不成立 → `EXPECTATION_FAILED`：说清「已经执行，但没等到期望的结果」，
   *              而不是把「还在处理」当成「成功」或「无变化」。
   *
   * 异步动作（提交接口 / 带淡出的删除 / 弹窗动画）**应该**给它 ——
   * 否则框架只能靠「快照变了没有」猜，而那是同步读取，猜不准。
   */
  expect?: Expectation;
  /**
   * 人工接力（S5）：这一步由用户亲自完成，框架不模拟点击。
   *
   * ```ts
   * // 最省事：说明就是给人看的原因
   * v-tool="{ id: 'submit', desc: '提交注册（需要输入图形验证码）', handoff: true }"
   *
   * // 或者写清原因 + 成功判据
   * v-tool="{
   *   id: 'submit',
   *   desc: '提交注册',
   *   handoff: {
   *     reason: '请填写图形验证码后提交',
   *     expect: { desc: '注册成功页出现', check: () => registered.value },
   *   },
   * }"
   * ```
   *
   * 有 handoff 时：`run` 不会执行、`confirm` 不再单独询问（用户亲手做就是批准）；
   * 执行器会等用户点面板上的「我已完成」，再用 `expect` 确认真做成了。
   */
  handoff?: boolean | string | {
    /** 为什么需要人来做；省略用 `desc` */
    reason?: string;
    /** 用户点「我已完成」后用来确认结果真的发生 */
    expect?: Expectation;
    /** 分步指引（S17）：一句人话 + 可选高亮目标（v-guide-target / 动作 id） */
    steps?: readonly (string | HandoffStep)[];
    /** 最多等多久（ms），省略 5 分钟 */
    timeout?: number;
  };
  /**
   * 复合动作（S6a）：这条声明是一条**流程** —— 对模型是 1 个 tool，
   * 内部按顺序跑这些**已注册的动作**。
   *
   * ```ts
   * v-tool="{
   *   id: 'fill_note',
   *   desc: '把某个订单的备注改成指定内容',
   *   params: [{ name: 'orderId', label: '订单号' }, { name: 'note', label: '新的备注' }],
   *   steps: [
   *     { action: 'search_query', args: { text: '{{orderId}}' }, desc: '搜索这个订单' },
   *     { action: 'edit@order:{{orderId}}', desc: '打开编辑弹窗' },
   *     { action: 'dialog_note', args: { text: '{{note}}' }, desc: '填上备注' },
   *     { action: 'dialog_save', desc: '保存并关闭弹窗' },
   *   ],
   * }"
   * ```
   *
   * 三条要知道的事：
   *   · 步骤引用的是**动作 id**，和模型自己点的东西是同一批 —— 所以权限、可用性、
   *     审计、逐步回执一条都不用重新实现，也不会出现「流程能做、人手做不了」的动作；
   *   · **逐步解析**：第 N 步的 id 在跑到它的时候才查注册表（弹窗里的按钮那时才存在）；
   *   · 整个流程**只问一次**（风险取步骤里最严的那一档），也**只取一份证据**。
   *
   * 写了 `steps` 就不要写 `run`：编排交给框架，`run` 会被忽略（开发期会告警）。
   * 卸载 / 解绑与其它声明一样随组件生命周期走。
   */
  steps?: readonly FlowStep[];
}

/**
 * 原子动作（**默认，绝大多数声明都是它**）：点一下 / 填一个值 / 按一个键。
 *
 * `run` 收到的是「那一个值」：`type` → `text`、`select` → `value`、`press` → `key`、
 * `click` → `undefined`（点就是点，没有值）。
 */
export interface AtomicToolOptions extends ToolOptionsBase {
  params?: undefined;
  /** `run` 可以是异步的（提交接口 / 等一个动画）：框架会 `await` 它再取快照 */
  run?: (value?: unknown) => void | Promise<void>;
}

/**
 * 带参数的动作：一个元素上挂一条**有输入**的能力（「挪到第几位」「改成多少」）。
 *
 * 两条规则：
 *   1. `params` 怎么写，模型就怎么填（最终变成 JSON Schema，见 `@plingjs/core` 的 `ToolParam`）；
 *   2. 写了 `params` 之后，`run` 收到的是**整个参数对象**（`{ position: 3 }`）——
 *      参数是你定义的，框架不替你猜「哪个才是那个值」。
 */
export interface ParamsToolOptions extends ToolOptionsBase {
  params: ParamDeclaration;
  /** 同 `AtomicToolOptions.run`：允许异步，框架会等它 */
  run?: (args: Record<string, unknown>) => void | Promise<void>;
}

export type ToolOptions = AtomicToolOptions | ParamsToolOptions;

/** `v-scope` 的取值：字符串 = id；对象可带区域名、角色、说明与父区域 */
export type ScopeValue = string | {
  id: string;
  label?: string;
  description?: string;
  role?: RegionRole;
  /** 显式父区域：传送门 / 弹窗挂到 body 时，DOM 里找不到祖先也能接回页面树 */
  parent?: string;
};

/**
 * 问答入口（`<AgentDock />`）的接线 —— 都属于**应用级**，写一次。
 *
 * 全部可选：什么都不给就是「从 `.env.local` 读配置、闸门关着、循环跑在浏览器」。
 * 给 `llm` 就换成自己的实现（测试用脚本模型；上线换成走薄 Node 层的那份）。
 */
export type AgentSetup = Omit<AgentRuntimeOptions, "config" | "registry" | "gate"> & {
  /** 模型配置（只写想改的字段；没写的从 `.env.local` 的 `VITE_AGENT_*` 读） */
  config?: AgentConfigOverrides;
  /**
   * Activity 里的模型设置入口。默认 `off`。
   * `readonly` 只展示应用托管配置；`byok` 允许用户输入自己的端点与密钥（仅用于可信页面）。
   */
  modelSettings?: ModelSettingsSetting;
  /**
   * 确认通道开关：返回 false 时**所有**动作直接执行（危险动作也不问）。
   * 默认开启 —— 问不问由动作声明决定（`kind` + `confirm`），这个开关只决定
   * 「这个应用要不要提供人工确认通道」。
   */
  gate?: () => boolean;
};

export interface PlingOptions {
  /** Shared UI locale, theme, message overrides, and optional class names. */
  ui?: PlingUiOptions;
  /**
   * 开发期告警出口，默认 `console.warn`。
   * 典型用法：接到自己的 logger / 调试面板；生产环境传 `() => {}` 静音。
   */
  onWarn?: (message: string) => void;
  /**
   * 开发期接入自检：首次挂载后扫描一次可交互控件，若存在未声明项就通过 `onWarn`
   * 提示它们不会被 Agent 看到。默认只在 Vite dev 开启；生产与测试环境不主动输出。
   *
   * 它只提示，不注册动作，也不改变「未注册不兜底」的边界。
   */
  diagnostics?: boolean;
  /** 用自己的注册表（老写法是第一个参数直接传 registry） */
  registry?: Registry;
  /**
   * 混合框架页面共享的页面运行时（`createPlingPage()`）。
   * 传了它之后 `registry` / `scopes` 由页面统一持有，不能再单独覆盖。
   */
  shared?: PlingPage;
  /** 本适配器的动作 id 命名空间：`add` → `todo/add`。 */
  namespace?: string;
  /**
   * 可见性 / 层叠判定的注入点（`ScopeControllerOptions`）。
   * 绝大多数项目不用写；测试与特殊渲染环境（没有 `elementFromPoint`）用它注入命中测试。
   */
  scopes?: ScopeControllerOptions;
  /** 问答入口的接线（见 `AgentSetup`） */
  agent?: AgentSetup;
  /**
   * **L1 自动派生**（`./derive`）：什么都不写，框架自己从 DOM 里认出可点的原生元素，
   * 把它们登记成动作（标 `source: "derived"`）。传对象 = 细调（扫描范围 / 跳过规则 / 词表）。
   *
   * 默认**关**（当前阶段）：派生的语义是**猜**出来的，还没经过足够验证，
   * 贸然打开会悄悄改变已有页面的动作清单。等它在案例里被验证过，再把默认翻成开。
   */
  derive?: boolean | DeriveOptions;
  /**
   * 页面身份（S10a）：默认自动读 `location` / `document.title`；
   * 传 `{ router }` 可补上 Vue Router 的 name / params / meta.title。
   * 传 `false` 完全关闭。`query` 默认不进上下文，只有 `queryKeys` 里列的 key 才会读。
   *
   * 用 `shared` 接进同源 iframe 时，子页面默认**不**接管页面身份：用户所在的是顶层页面，
   * 子页面的地址不该覆盖它。确实要由子页面提供身份时，显式传 `page: { ... }`。
   */
  page?: false | PageOptions;
  /**
   * 存在感（S13）：agent 操作时把目标元素画出来。**默认开，不用写任何声明**。
   *
   * ```ts
   * createPling()                                  // 默认：光圈
   * createPling({ presence: false })               // 关掉
   * createPling({ presence: { effect: "spotlight" } }) // 压暗其余部分
   * ```
   *
   * 动作本身 20ms 就结束了，所以默认还有 700ms 的最短显示时间（`minVisibleMs`）。
   * 自定义画法（箭头 / 星星 / 气泡）走 `render`，返回一个节点即可。
   */
  presence?: boolean | PresenceOptions;

  /**
   * 聊天里把敏感数据的 `{{p:…}}` 代号还原成人能看的真值（S14）。**默认开**。
   *
   * 安全边界是「真值不出浏览器」，不是「瞒着操作者」：页面本来就有这些数据，
   * 用户在自己的会话里问「Globex 的电话是多少」，就该看到号码。
   * 还原只发生在渲染层 —— 历史、发给模型的请求、localStorage 里仍然是代号。
   *
   * 连屏幕都不想留痕（展厅、录屏、共享屏幕）时传 `false`。
   */
  revealSensitive?: boolean;
}

export interface PlingElement {
  registry: Registry;
  /** Locale / theme controller used by the built-in UI. */
  ui: PlingUiController;
  /** ARIA 页面反馈收集器（S9a）：随应用挂载开始，`destroy()` 时停止 */
  feedback: FeedbackCollector;
  /** 页面身份跟踪器（S10a）：随应用挂载开始，`destroy()` 时停止 */
  page: PageTracker;
  plugin: { install(app: App): void };
  /**
   * Route a task to the mounted agent surface.
   *
   * This is the imperative twin of `v-task`: it is an entrance for a person,
   * not a tool exposed to the model. It never registers an action.
   */
  ask(prompt: string, options?: PlingAskOptions): Promise<void>;
  /** @internal Shared task routing used by built-in surfaces. */
  task: PlingTaskController;
  /**
   * L1 派生器（只在 `createPling({ derive: ... })` 时非空）。配了就**一直**在，
   * 只是要等 `app.mount()` 之后才有东西可扫 —— 所以 `derived()?.ids()` 在挂载前一直是空的。
   */
  derived(): DeriveController | null;
  /** 开发期只读扫描：检查挂载范围里的交互控件是否有 pi 声明；不改变 Agent 能力。 */
  inspectCoverage(): CoverageReport;
  /** 可见性 / 作用域控制器（自动裁剪的引擎） */
  scopes: ScopeController;
  /** 声明「当前活跃的作用域」（手动通道，自动通道之外仍保留） */
  setActiveScopes(scopes: Iterable<string>): void;
  /** 收摊：停掉派生器与观察器（单页里反复建实例 / 测试用它） */
  destroy(): void;
  /** 应用级给的问答入口接线（`<AgentDock />` 会用它） */
  agent?: AgentSetup;
  /** 聊天里是否把 `{{p:…}}` 代号还原成真值（见 `PlingOptions.revealSensitive`） */
  revealSensitive: boolean;
}

export const PLING_KEY: InjectionKey<PlingElement> = Symbol("pling");

/** 在组件里取到当前应用的 pi（含 registry） */
export function usePling(): PlingElement {
  const found = inject(PLING_KEY, null);
  if (!found) throw new Error("pling: 请先在应用上 app.use(pling.plugin)");
  return found;
}

interface Registered {
  signature: string;
  unbind: () => void;
}

const states = new WeakMap<Element, Registered>();
const scopeStates = new WeakMap<Element, Registered>();
let autoId = 0;

/** `v-record` 的登记状态：签名变了才重新登记（字段内容是实时读的） */
interface RegisteredRecord extends Registered {
  id: string;
  declaration: RecordDeclaration;
}

const recordStates = new WeakMap<Element, RegisteredRecord>();

interface RegisteredFeedback extends Registered {
  baseId: string;
}

const feedbackStates = new WeakMap<Element, RegisteredFeedback>();

function inferPrimitive(el: Element, options: ToolOptions): Primitive {
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

/** `v-tool` 的 handoff 简写 → 执行器认识的规格（reason 必须有，否则面板没话可说） */
function normalizeHandoff(
  options: ToolOptions,
): { reason: string; steps?: readonly HandoffStep[]; expect?: Expectation; timeout?: number } | undefined {
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

/**
 * `v-tool` 的取值：
 *   - 字符串 = 只给一句说明（最常见的写法：`v-tool="'删除这条待办'"`），id 自动生成
 *   - 对象 / 数组 = 需要控制 id、风险等级、作用域、注入行为时用
 */
export type ToolValue = string | ToolOptions | ToolOptions[];

/** 归一化成声明列表：字符串简写等价于 `{ desc }` */
export function toolOptionsOf(value: ToolValue): ToolOptions[] {
  if (typeof value === "string") return [{ desc: value }];
  return Array.isArray(value) ? value : [value];
}

/**
 * 只取声明性字段做签名（忽略 `run` / `expect`：里面是内联函数，放进签名会每次渲染都重注册）。
 *
 * `steps` 要进签名：改了步骤就该重新登记（旧流程必须作废）。
 * 里面的 `args` 函数会被 JSON 丢掉 —— 那是**故意的**：内联函数每次都新建，
 * 放进签名等于每次渲染都重注册一遍。
 */
function signatureOf(values: ToolOptions[]): string {
  return JSON.stringify(
    values.map((v) => [v.id, v.desc, v.kind, v.action, v.key, v.scope, v.fidelity, paramSignature(v.params), v.steps ?? null]),
  );
}

/**
 * 参数声明的**稳定**序列化：`JSON.stringify` 会把 `RegExp` 变成 `{}`、把函数属性整个丢掉，
 * 于是「只改了正则 / 只换了 options」不会触发重新登记（旧 schema 留在注册表里）。
 * 这里把正则取源码、函数记成占位符 —— 函数实现变了不必重注册，但**声明形状**变了要重注册。
 */
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

/**
 * `run` 到底收什么 —— 只有一处判断，别的地方不用再关心这件事。
 *
 *   写了 `params`  → 整包参数（`{ item: "t4", position: 1 }`，类型已规整）
 *   没写（原子动作）→ 按原语的惯例给「那一个值」
 */
function runInjected(
  options: ToolOptions,
  primitive: Primitive,
  args: Record<string, unknown>,
): void | Promise<void> {
  if (options.params !== undefined) {
    return options.run?.(args);
  }
  return options.run?.(primitive === "click" ? undefined : NATIVE_RUN_VALUE[primitive]?.(args));
}

interface NormalizedScope {
  id: string;
  label?: string;
  description?: string;
  role?: RegionRole;
  parent?: string;
}

function normalizeScope(value: ScopeValue): NormalizedScope {
  return typeof value === "string" ? { id: value } : { ...value };
}

function scopeSignature(value: ScopeValue): string {
  const { id, label, description, role, parent } = normalizeScope(value);
  return JSON.stringify([id, label, description, role, parent]);
}

/** 作用域在页面上的阅读顺序：DOM 里第几个区域（父区域一定排在子区域前面）。 */
function scopeOrderOf(el: Element): number | undefined {
  const doc = el.ownerDocument;
  if (!doc) return undefined;
  const index = queryAllComposed(doc, "[data-pling-scope]").indexOf(el);
  return index === -1 ? undefined : index;
}

/** 作用域 id → 合法 action 名片段（模型 function name 只接受字母数字与 _-） */
function slug(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

const NATIVE_RUN_VALUE: Partial<Record<Primitive, (args: Record<string, unknown>) => unknown>> = {
  type: (args) => args.text,
  select: (args) => args.value,
  press: (args) => args.key,
};

/** 当前适配器是不是跑在 iframe 里；跨域读 `parent` 也不会抛，读不到就当是嵌套。 */
function isNestedWindow(): boolean {
  try {
    return typeof window !== "undefined" && window.parent !== window;
  } catch {
    return true;
  }
}

/**
 * 元素级工具：把 `v-tool` 声明登记成 action（一个元素可挂多个）。
 * 执行默认走 DOM 模拟；给了 `run` 则走注入。
 * 作用域默认继承最近的 `v-scope` 容器，可见性由 ScopeController 自动判定。
 */
/**
 * 建应用级实例。两种写法都行：
 *
 * ```ts
 * createPling({ agent: { config } })          // 推荐：一个对象说清所有事
 * createPling(myRegistry, { onWarn })         // 老写法：第一个参数传注册表
 * ```
 */
export function createPling(options?: PlingOptions): PlingElement;
export function createPling(registry: Registry | undefined, options?: PlingOptions): PlingElement;
export function createPling(
  // 注意别给 `first` 写默认值 `= {}`：JS 的默认参数在显式传 `undefined` 时也会生效，
  // 那样 `createPling(undefined, { onWarn })` 里的配置就被 `{}` 顶掉了。
  first: Registry | PlingOptions | undefined,
  second: PlingOptions = {},
): PlingElement {
  const isRegistry = typeof (first as Registry | undefined)?.bind === "function" && typeof (first as Registry | undefined)?.snapshot === "function";
  // `createPling(undefined, { onWarn })` 这种老写法：第一个参数没给，配置在第二个
  const plingOptions: PlingOptions = isRegistry ? second : ((first as PlingOptions | undefined) ?? second);
  const sharedPage = plingOptions.shared;
  if (sharedPage && (plingOptions.registry || plingOptions.scopes)) {
    throw new Error("pling: 传入 shared 时不能再传 registry / scopes；它们由页面统一持有");
  }
  const baseRegistry: Registry = sharedPage?.registry ?? (isRegistry
    ? (first as Registry)
    : (plingOptions.registry ?? createRegistry()));
  const registry = createActionNamespace(baseRegistry, plingOptions.namespace);
  const ids = getRegistryNamespace(registry);

  const warn = plingOptions.onWarn ?? ((message: string) => console.warn(message));
  const ui = createPlingUi(plingOptions.ui, DEFAULT_VUE_LOCALE);
  const viteEnv = readViteEnv();
  const diagnostics = plingOptions.diagnostics ?? (viteEnv.DEV === true && viteEnv.MODE !== "test");

  // 「动作没写 confirm 时默认问不问」是**声明期**设定，落在这里（注册表上）：
  // 三个来源与应用级配置同一条链 —— 默认值 ← `.env.local` ← `createPling({ agent: { config } })`。
  // `<AgentDock :config>` 更靠近页面，它拿到更具体的值后会再落一次。
  registry.setDefaultApproval(
    resolveAgentConfig({ env: readViteEnv(), config: plingOptions.agent?.config }).defaultApproval,
  );

  let stopped = false;
  const scopes = sharedPage?.scopes ?? createScopeController(plingOptions.scopes);
  const presence = createPresence(plingOptions.presence === false ? false : (plingOptions.presence ?? {}));
  if (!sharedPage) scopes.onChange(() => registry.setAutoScopes(scopes.activeScopes()));
  const feedback = sharedPage?.feedback ?? createFeedbackCollector(registry);
  const task = createTaskController(warn);
  const pageOptions: PageOptions = plingOptions.page === false
    ? { enabled: false }
    : (plingOptions.page ?? (sharedPage && isNestedWindow() ? { enabled: false } : {}));
  const page = createPageTracker(registry, pageOptions, baseRegistry);

  function unregister(el: Element): void {
    const state = states.get(el);
    if (state) {
      state.unbind();
      states.delete(el);
    }
    // 「这里已经有人声明过了」的记号（L1 自动派生靠它让路）：元素或祖先声明过 → 整棵子树不派生
    unmarkExplicit(el);
  }

  /**
   * 记录在**页面上的顺序**（`RecordDeclaration.order` 的来源）。
   *
   * 为什么不直接用登记顺序：Vue 挂载 keyed 列表时，同一次渲染里新行是**倒着**创建的
   * （实测：清空搜索后依次创建 t6…t1），于是快照里的顺序和用户看到的正好反过来 ——
   * 模型说「第一条是 X」，用户看着第一条是 Y。
   *
   * 排序只在「行数变了 / 位置变了」时做一遍，其余时候读一行是 O(1)。
   */
  const recordEls = new Set<Element>();
  let recordOrder: { list: Element[]; index: Map<Element, number> } | null = null;

  /** `compareDocumentPosition` 的位标志（写成常量，免得依赖全局 `Node`） */
  const DOCUMENT_POSITION_FOLLOWING = 4;

  /** 该元素没登记过 / 不在当前这一批里就返回 undefined（core 会把它排在最后） */
  function orderIndexOf(el: Element): number | undefined {
    if (!recordOrder?.index.has(el) || !isStillInOrder(recordOrder.list)) {
      const list = [...recordEls].sort((a, b) => {
        if (a === b) return 0;
        return a.compareDocumentPosition(b) & DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
      recordOrder = { list, index: new Map(list.map((element, at) => [element, at])) };
    }
    return recordOrder.index.get(el);
  }

  function isStillInOrder(list: readonly Element[]): boolean {
    if (list.length !== recordEls.size) return false;
    for (let i = 0; i + 1 < list.length; i += 1) {
      const rel = list[i]!.compareDocumentPosition(list[i + 1]!);
      if (!(rel & DOCUMENT_POSITION_FOLLOWING)) return false;
    }
    return true;
  }

  function unregisterRecord(el: Element): void {
    const state = recordStates.get(el);
    if (!state) return;
    state.unbind();
    recordStates.delete(el);
    recordEls.delete(el);
    unmarkRecordElement(el);
  }

  function unregisterFeedback(el: Element): void {
    const state = feedbackStates.get(el);
    if (!state) return;
    state.unbind();
    feedbackStates.delete(el);
  }

  /**
   * 显式反馈（`v-feedback`）。
   *
   * 空值 = 此刻没有反馈（`v-feedback="error || ''"` 的常见写法），不告警。
   * id 以元素为锚：同一元素上的文案变化不会把 id 改掉，面板和审计能对照。
   */
  function registerFeedback(el: Element, raw: FeedbackValue | FeedbackValue[]): void {
    const previous = feedbackStates.get(el);
    const baseId = previous?.baseId ?? `feedback_${++autoId}`;
    const { items, problem } = normalizeFeedbackValue(raw);
    if (problem) warn(problem);
    const signature = JSON.stringify(
      items.map((item) => [
        item.id ?? null,
        typeof item.message === "string" ? item.message : "dynamic",
        typeof item.field === "string" ? item.field : item.field ? "dynamic" : null,
        typeof item.severity === "string" ? item.severity : item.severity ? "dynamic" : null,
        item.scope ?? null,
      ]),
    );
    if (previous?.signature === signature) return;
    unregisterFeedback(el);
    if (items.length === 0) return;
    const unbinds = items.map((item, index) =>
      registry.declareFeedback(toFeedbackDeclaration(item, `${baseId}_${index}`, () => nearestScope(el))),
    );
    feedbackStates.set(el, { baseId, signature, unbind: () => unbindAll(unbinds) });
  }

  /**
   * 登记一行业务数据（`v-record`）。
   *
   * 它只往快照里加**读得到**的字段，不产生任何动作 —— 所以这里没有可用性、
   * 没有保真度、没有告警之外的兜底：读不出来的数据宁可没有，也不能编。
   */
  function registerRecord(el: Element, raw: RecordValue): void {
    const previous = recordStates.get(el);
    const { record, problem } = normalizeRecordValue(raw);
    if (!record) {
      if (problem) warn(problem);
      unregisterRecord(el);
      return;
    }
    // 同一行、只是数据变了：改字段引用就够了，不必注销再登记（42 行列表每渲染一次都重登记太吵）
    if (previous?.id === record.id && recordSignature(record) === previous.signature) {
      rewireFields(previous.declaration, record.fields);
      previous.declaration.label = record.label;
      return;
    }
    unregisterRecord(el);

    const recordId = ids.record(record.id);
    recordEls.add(el);
    // 行 id 绑到元素上（进程内，不写 DOM）：派生动作（L1）要拿它拼 `remove@t4` 这种带行身份的 id。
    // 绑元素而不是「让派生器去读 registry」——元素被复用 / 移动时，行的身份跟着它走。
    markRecordElement(el, recordId);
    const declaration = toDeclaration({ ...record, id: recordId }, () => nearestScope(el), () => orderIndexOf(el));
    const unbind = registry.declareRecord(declaration);
    recordStates.set(el, { id: record.id, signature: recordSignature(record), declaration, unbind });
  }

  function register(el: Element, raw: ToolValue): void {
    unregister(el);
    const values = toolOptionsOf(raw);

    // 延迟解析：Vue 的指令 mounted 是「子先于父」，v-scope 的容器此刻可能还没 mounted
    const resolveScope = (): string | undefined => nearestScope(el);

    const actionIds: string[] = [];
    const unbinds = values.map((options) => {
      const id = options.id ?? `tool_${++autoId}`;
      actionIds.push(id);
      // 复合动作：`steps` 一出现就是流程（哪怕写的是空数组 —— 空数组会告警，
      // 而不是悄悄退化成「点击这个元素」，那是最难查的一类静默错误）。
      const steps = options.steps ?? null;
      const isFlow = steps !== null;
      const primitive = isFlow ? "flow" : inferPrimitive(el, options);
      const resolution = resolveTarget(el, primitive, {
        hasInjectedRun: Boolean(options.run),
        declaredFidelity: options.fidelity,
        target: options.target,
        autoTarget: options.autoTarget,
      });
      const params = schemaOf(options.params);
      const handoff = normalizeHandoff(options);
      // 动态选项 / 动态边界：快照与执行前都要重新求值（见 `Binding.resolveParams`）
      const resolveParams = hasDynamicParams(options.params) ? () => schemaOf(options.params)! : undefined;
      const descriptor: ActionDescriptor = {
        id,
        primitive,
        description: options.desc,
        kind: options.kind,
        confirm: options.confirm,
        ...(handoff ? { handoff: { reason: handoff.reason } } : {}),
        scope: options.scope,
        fidelity: resolution.fidelity,
        ...(params ? { params } : {}),
      };

      // 注册期就能看出「多半不会生效」，就别等到模型点了才让人困惑
      const warning = targetWarning(id, el.tagName.toLowerCase(), primitive, resolution);
      if (warning) warn(warning);

      // 同时写了 steps 和 run：按 steps 走，run 会被忽略（执行流水线第 6 步先看 steps）
      if (isFlow && options.run) {
        warn(`v-tool「${id}」同时写了 steps 和 run：复合动作按 steps 执行，run 不会跑（只想注入行为的话去掉 steps）`);
      }
      // 空流程：一步都不会走，却会回一句 ok —— 说成「兜底」不如当场告诉开发者
      if (isFlow && steps && steps.length === 0) {
        warn(`v-tool「${id}」的 steps 是空的：这条流程一步都不会走（补上步骤，或去掉 steps 让它按普通动作走）`);
      }

      // 说明是模型唯一能看懂的东西：漏写就等于「注册了一个模型不敢用的动作」
      if (!options.desc?.trim()) warn(`v-tool「${id}」没有写说明（desc）：模型只能靠说明判断这个动作是干什么的`);

      // 声明了参数却没有接住它的地方：参数会被丢掉（click 原语 + 没有 run）
      if (options.params !== undefined && !options.run && primitive === "click") {
        warn(`v-tool「${id}」声明了 params 但没有 run：click 原语不会用到这些参数，等于白声明`);
      }

      // 危险动作被标成「不用问」是开发者的权利，但值得在开发期说一声：
      // 这条很容易是随手复制粘贴留下的，出了问题没人查得到。
      if (options.confirm === false && resolveKind(primitive, options.kind) === "danger") {
        warn(`v-tool「${id}」声明成了 confirm: false，但它是 danger 动作：执行前不会问用户`);
      }
      if (handoff && options.confirm !== undefined) {
        warn(`v-tool「${id}」同时写了 handoff 和 confirm：人工接力的动作由用户亲手完成，confirm 不会再单独询问`);
      }
      if (handoff && options.run) {
        warn(`v-tool「${id}」同时写了 handoff 和 run：接力动作不执行 run（这一步由用户亲自完成）`);
      }
      if (handoff && isFlow) {
        warn(`v-tool「${id}」同时写了 handoff 和 steps：整个流程交给用户完成，steps 不会执行`);
      }

      /** 原语作用在谁身上：目标默认在注册期算好，元素被重建时按同规则重算一次 */
      const currentTarget = (): Element => {
        if (resolution.element.isConnected || resolution.element === el) return resolution.element;
        const again = resolveTarget(el, primitive, {
          hasInjectedRun: Boolean(options.run),
          declaredFidelity: options.fidelity,
          target: options.target,
          autoTarget: options.autoTarget,
        });
        return again.element.isConnected ? again.element : el;
      };

      // 继承来的作用域 → 登记进可见性观察；显式作用域只有存在同 id 容器时才观察
      const inherited = resolveScope();
      const trackedScope = options.scope === undefined ? inherited : ids.scope(options.scope);
      const untrack =
        trackedScope && (options.scope === undefined || scopes.isDeclared(trackedScope))
          ? scopes.track(el, trackedScope)
          : null;

      const unbind = registry.bind({
        descriptor,
        ...(resolveParams ? { resolveParams } : {}),
        // 成功判据（S4）：不进 descriptor —— 它是给执行流水线用的，不是给模型看的
        ...(options.expect ? { expect: options.expect } : {}),
        ...(handoff ? { handoff } : {}),
        // 复合动作的编排（S6a）。给了它，执行流水线就不走 `run` 而是按顺序跑这些步骤。
        ...(isFlow ? { steps } : {}),
        // 可用性：元素本身（已挂载 / 未 disabled / 可见）→ 目标元素 → 开发者声明的前置条件。
        // 每一层都把**原因**带出去（见 packages/core 的 Availability）：模型据此知道下一步该做什么。
        isAvailable: () => {
          // 复合动作只看开发者声明的前置条件。
          // 为什么不做几何 / 遮挡检查：流程不是「点这个元素」，它是「按顺序做几件事」，
          // 声明它的那个元素只是个挂载点（可能在一个折叠的工具栏里，甚至一整个弹窗都还没开）——
          // 用挂载点的可见性去否决整条流程，会把「弹窗里的保存流程」这类正当用法杀掉。
          // 步骤自己会回答「此刻能不能做」（每一步都过第 5 步的可用性检查，并带上原因）。
          if (isFlow) {
            const declared = options.available?.();
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
          const declared = options.available?.();
          const own = checkActionable(el);
          if (!own.available) {
            // 原生 disabled / inert / 遮挡是框架先看见的硬事实；开发者写的业务前置条件
            // 往往更接近「下一步该做什么」。两者不冲突，合成一句一起交给模型。
            if (typeof declared === "string") {
              return { ...own, reason: own.reason ? `${own.reason}；${declared}` : declared, reasonSuffix: declared };
            }
            return own;
          }
          if (resolution.element !== el) {
            const target = checkActionable(resolution.element);
            if (!target.available) {
              if (typeof declared === "string") {
                return { ...target, reason: target.reason ? `${target.reason}；${declared}` : declared, reasonSuffix: declared };
              }
              return target;
            }
          }
          // 层叠：几何上在视口里、但被遮罩 / 弹窗压住 —— 点下去会点到别人（浏览器实测的经典翻车）
          const cover = scopes.coverOf(currentTarget());
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
        isVisible: untrack ? () => scopes.isVisible(el) : undefined,
        // 自动揭示（S12）：模型引用了当前滚在视口外的行时，执行器会先调用它。
        // 滚动本身是异步的，登记之后由执行器的 settle 等页面停稳，再做可用性检查。
        ...(isFlow ? {} : { reveal: async () => scrollElementIntoView(currentTarget()) }),
        // 存在感（S13）：和点击 / 填值用**同一个** currentTarget，圈住的就是真正被操作的元素。
        ...(presence && !isFlow ? { presence: (state) => presence.mark(currentTarget(), state) } : {}),
        resolveScope: options.scope === undefined ? resolveScope : undefined,
        // 复合动作**不挂 run**：它的实现是 steps（执行流水线看到 steps 就按顺序跑，不走这里）。
        // 挂一个跑不到的空函数只会让人以为「流程也是点击模拟」——声明里是什么样，注册结果就是什么样。
        ...(isFlow
          ? {}
          : {
              run: async (args: Record<string, unknown>) => {
                if (options.run) {
                  // 必须 `await`：注入的 run 可能是异步的（提交接口 / 等一个动画）。
                  // 不等它，框架会在「还没做完」时就去等期望、取快照 —— 那是 S4 之前的行为。
                  await runInjected(options, primitive, args);
                  return;
                }
                performPrimitive(
                  currentTarget(),
                  primitive,
                  primitive === "press" ? { key: options.key ?? "Enter", ...args } : args,
                );
              },
            }),
      });

      return () => {
        untrack?.();
        unbind();
      };
    });

    markExplicit(el, actionIds);

    states.set(el, {
      signature: signatureOf(values),
      unbind: () => unbindAll(unbinds),
    });
  }

  const toolDirective: Directive<HTMLElement, ToolValue> = {
    mounted(el, binding) {
      register(el, binding.value);
    },
    updated(el, binding) {
      if (states.get(el)?.signature !== signatureOf(toolOptionsOf(binding.value))) {
        register(el, binding.value);
      }
    },
    unmounted(el) {
      unregister(el);
    },
  };

  /** 指引目标（S17）：只负责在接力时被圈出来，不是动作、不进快照。 */
  interface RegisteredGuideTarget {
    id: string;
    off: () => void;
  }
  const guideTargetStates = new WeakMap<Element, RegisteredGuideTarget>();

  function registerGuideTarget(el: HTMLElement, value: unknown): void {
    const id = typeof value === "string" ? value.trim() : "";
    const current = guideTargetStates.get(el);
    if (current?.id === id) return;
    current?.off();
    guideTargetStates.delete(el);
    if (!id) return;
    try {
      const off = registry.declareGuideTarget(id, {
        presence: (state) => presence?.mark(el, state),
      });
      guideTargetStates.set(el, { id, off });
    } catch (error) {
      warn(error instanceof Error ? error.message : String(error));
    }
  }

  function unregisterGuideTarget(el: HTMLElement): void {
    const current = guideTargetStates.get(el);
    if (!current) return;
    current.off();
    guideTargetStates.delete(el);
  }

  const guideTargetDirective: Directive<HTMLElement, string> = {
    mounted(el, binding) {
      registerGuideTarget(el, binding.value);
    },
    updated(el, binding) {
      registerGuideTarget(el, binding.value);
    },
    unmounted(el) {
      unregisterGuideTarget(el);
    },
  };

  /**
   * 行级声明：把这一行的业务数据登记成模型读得到的记录。
   *
   * ```vue
   * <tr v-for="order in orders" :key="order.id" v-record="order">
   * ```
   */
  const recordDirective: Directive<HTMLElement, RecordValue> = {
    mounted(el, binding) {
      registerRecord(el, binding.value);
    },
    updated(el, binding) {
      registerRecord(el, binding.value);
    },
    unmounted(el) {
      unregisterRecord(el);
    },
  };

  const feedbackDirective: Directive<HTMLElement, FeedbackValue | FeedbackValue[]> = {
    mounted(el, binding) {
      registerFeedback(el, binding.value);
    },
    updated(el, binding) {
      registerFeedback(el, binding.value);
    },
    unmounted(el) {
      unregisterFeedback(el);
    },
  };

  /**
   * `v-task` — a person sends a task to the agent.
   *
   * This directive intentionally writes **nothing** to the registry. The button's
   * click is a prompt entrance, so the agent must not see it as something it can
   * click. `markExplicit()` is used only to keep L1 derivation away from it; the
   * coverage scanner then sees an intentionally handled control instead of a
   * forgotten one.
   */
  interface RegisteredTask {
    signature: string;
    disabled: boolean;
    prompt: string;
    surface?: string;
    off: () => void;
  }

  const taskStates = new WeakMap<Element, RegisteredTask>();

  function normalizeTask(value: TaskValue): { prompt: string; surface?: string; disabled: boolean } {
    if (typeof value === "string") return { prompt: value.trim(), disabled: false };
    const prompt = String(value?.prompt ?? "").trim();
    return {
      prompt,
      ...(value?.surface ? { surface: value.surface } : {}),
      disabled: value?.disabled === true,
    };
  }

  function unregisterTask(el: Element): void {
    const current = taskStates.get(el);
    if (!current) return;
    current.off();
    taskStates.delete(el);
    unmarkExplicit(el);
  }

  function registerTask(el: HTMLElement, value: TaskValue): void {
    const normalized = normalizeTask(value);
    const signature = JSON.stringify([normalized.prompt, normalized.surface ?? null, normalized.disabled]);
    const current = taskStates.get(el);
    if (current?.signature === signature) return;
    unregisterTask(el);
    if (!normalized.prompt) {
      warn("pling: v-task 需要一个非空的 prompt；这个入口不会发送任务。");
      return;
    }

    const state: RegisteredTask = {
      signature,
      disabled: normalized.disabled,
      prompt: normalized.prompt,
      ...(normalized.surface ? { surface: normalized.surface } : {}),
      off: () => {},
    };
    const onClick = (): void => {
      if (state.disabled) return;
      void task.ask(state.prompt, {
        source: el,
        ...(state.surface ? { surface: state.surface } : {}),
      }).catch(() => {
        // The task controller already reports missing surfaces through `onWarn`.
        // Swallow here so a click never becomes an unhandled rejection.
      });
    };
    el.addEventListener("click", onClick);
    state.off = () => el.removeEventListener("click", onClick);
    taskStates.set(el, state);
    markExplicit(el, []);
  }

  const taskDirective: Directive<HTMLElement, TaskValue> = {
    mounted(el, binding) {
      registerTask(el, binding.value);
    },
    updated(el, binding) {
      registerTask(el, binding.value);
    },
    unmounted(el) {
      unregisterTask(el);
    },
  };

  /**
   * 容器级作用域：子元素里的 `v-tool` 自动继承，无需逐个写 `scope`。
   * 同时为该区域自动生成两个「探索动作」：
   *   pling_reveal_<id> —— 页面不在这个区域时，把页面滚过去；
   *   pling_scroll_<id> —— 区域内还有没展示的条目时，滚动容器看更多。
   * 二者都是 read，且只在需要时出现（动态 isAvailable）。
   */
  function installScope(el: Element, value: ScopeValue): () => void {
    const local = normalizeScope(value);
    const id = ids.scope(local.id);
    const { label = local.id, description, role, parent } = local;
    const revealId = `pling_reveal_${slug(local.id)}`;
    const scrollId = `pling_scroll_${slug(local.id)}`;
    const disposers: Array<() => void> = [];

    // 父区域默认按 DOM 找：`v-scope` 可以只写 id，层级关系自动接上。
    // 传送门 / 弹窗挂到 body 时 DOM 里没有祖先，才需要显式写 `parent`。
    const parentOf = (): string | undefined => {
      if (parent !== undefined) return ids.scope(parent);
      const host = el.parentElement?.closest?.(`[${SCOPE_ATTR}]`);
      const found = host?.getAttribute(SCOPE_ATTR) ?? undefined;
      return found === id ? undefined : found;
    };

    disposers.push(scopes.declare(el, { id, label, ...(description === undefined ? {} : { description }), ...(role === undefined ? {} : { role }) }));
    disposers.push(
      registry.declareScope({
        id,
        label,
        ...(description === undefined ? {} : { description }),
        ...(role === undefined ? {} : { role }),
        parent: parentOf,
        order: () => scopeOrderOf(el),
        explore: [revealId, scrollId],
      }),
    );

    disposers.push(
      registry.bind({
        descriptor: {
          id: revealId,
          primitive: "scroll",
          description: `Scroll the page to the "${label}" region (use when the region is outside the viewport)`,
          kind: "read",
        },
        isAvailable: () =>
          scopes.isScopeInView(id)
            ? {
                available: false,
                reason: `The "${label}" region is already in the viewport`,
                reasonKey: "availability.scopeInViewport",
                reasonParams: { label },
              }
            : true,
        run: async () => {
          // 平滑滚动是异步的：登记之后 settle 会等它停（S4b），
          // 否则「滚完再看」拿到的是滚动途中的位置 —— 目标区域的动作照样进不了快照
          scrollElementIntoView(el);
        },
      }),
    );

    disposers.push(
      registry.bind({
        descriptor: {
          id: scrollId,
          primitive: "scroll",
          description: `Scroll inside the "${label}" region to reveal more content`,
          kind: "read",
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
        },
        isAvailable: () => {
          if (!scopes.isScopeInView(id)) {
            return {
              available: false,
              reason: `The "${label}" region is outside the viewport; scroll it into view first`,
              reasonKey: "availability.scopeOutsideViewport",
              reasonParams: { label },
            };
          }
          if (!scopes.hasMore(id)) {
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
          const container = el as HTMLElement;
          const step = container.clientHeight || 300;
          markScrolling(el.ownerDocument.defaultView);
          if (typeof container.scrollBy === "function") {
            container.scrollBy({ top: direction * step * 0.9, behavior: scrollBehavior(el.ownerDocument.defaultView) });
          }
        },
      }),
    );

    return () => unbindAll(disposers);
  }

  const scopeDirective: Directive<HTMLElement, ScopeValue> = {
    // created 先于子元素 mounted：把标记写进 DOM，后代 v-tool 才继承得到
    created(el, binding) {
      el.setAttribute("data-pling-scope", ids.scope(normalizeScope(binding.value).id));
    },
    mounted(el, binding) {
      scopeStates.set(el, { signature: scopeSignature(binding.value), unbind: installScope(el, binding.value) });
    },
    updated(el, binding) {
      if (scopeStates.get(el)?.signature !== scopeSignature(binding.value)) {
        el.setAttribute("data-pling-scope", ids.scope(normalizeScope(binding.value).id));
        scopeStates.get(el)?.unbind();
        scopeStates.set(el, { signature: scopeSignature(binding.value), unbind: installScope(el, binding.value) });
      }
    },
    unmounted(el) {
      scopeStates.get(el)?.unbind();
      scopeStates.delete(el);
      el.removeAttribute("data-pling-scope");
    },
  };

  /**
   * L1 派生器：配了就存在（`pi.derived()` 因此可以无条件调用），
   * 但**扫描范围要等 `app.mount()`** —— 在那之前 `mountRoot` 是 null，它什么都不扫
   * （见 `DeriveRoot`：宁可先不扫，也不要先扫一遍 body 再改主意）。
   */
  const deriveOptions: DeriveOptions | null =
    plingOptions.derive === true ? {} : plingOptions.derive ? plingOptions.derive : null;
  let mountRoot: Element | null = null;
  const deriver: DeriveController | null = deriveOptions
    ? createDeriver(registry, scopes, { ...deriveOptions, root: () => mountRoot, onWarn: deriveOptions.onWarn ?? warn })
    : null;

  const instance: PlingElement = {
    registry,
    ui,
    feedback,
    page,
    scopes,
    task,
    ask(prompt, options) {
      return task.ask(prompt, options);
    },
    revealSensitive: plingOptions.revealSensitive !== false,
    derived: () => deriver,
    inspectCoverage: () => inspectCoverage(mountRoot),
    ...(plingOptions.agent ? { agent: plingOptions.agent } : {}),
    plugin: {
      install(app: App) {
        // 页面级的滚动观察器：装上就开始看「页面在不在滚」——
        // 页面自己发起的滚动（不是框架发起的那些）也靠它被 settle 等到。
        // 一个窗口一份，多个应用共用（见 scroll.ts）。
        scrollWatcher((globalThis as { document?: Document }).document?.defaultView);
        app.directive("tool", toolDirective);
        app.directive("guide-target", guideTargetDirective);
        app.directive("record", recordDirective);
        app.directive("scope", scopeDirective);
        app.directive("feedback", feedbackDirective);
        app.directive("task", taskDirective);
        app.provide(PLING_KEY, instance);

        // 扫描范围必须是**挂载点**（不是 body）：挂在应用外面的东西（Vite 的错误浮层、
        // 别人的挂件）不该进清单。所以拦一次 `app.mount` 把容器拿在手里。
        const mount = app.mount.bind(app);
        app.mount = ((...args: Parameters<App["mount"]>) => {
          const result = mount(...args);
          if (!stopped) {
            const target = args[0];
            mountRoot =
              typeof target === "string"
                ? ((globalThis as { document?: Document }).document?.querySelector(target) ?? null)
                : (target as Element);
            if (!sharedPage) feedback.start();
            const router =
              pageOptions.router ??
              (app.config.globalProperties as { $router?: PageRouterLike }).$router;
            page.start(router);
            deriver?.sync();
            if (diagnostics) {
              queueMicrotask(() => {
                if (stopped || !mountRoot) return;
                const report = inspectCoverage(mountRoot);
                if (report.missing === 0) return;
                const percent = report.coveragePercent ?? 0;
                warn(
                  `pling: 交互声明覆盖率 ${percent}% —— ${report.missing}/${report.total} 个可操作控件还没有声明，Agent 看不到它们。` +
                    "需要开放的元素补上 v-tool；不打算开放就保持原样。调用 pling.inspectCoverage() 或打开 <AgentPanel /> 查看明细。",
                );
              });
            }
          }
          return result;
        }) as App["mount"];
      },
    },
    setActiveScopes(scopes_) {
      registry.setActiveScopes(scopes_);
    },
    destroy() {
      stopped = true;
      ui.destroy();
      deriver?.stop();
      presence?.destroy();
      if (!sharedPage) feedback.stop();
      page.stop();
      if (!sharedPage) scopes.destroy();
    },
  };
  return instance;
}

function unbindAll(unbinds: Array<() => void>): void {
  for (const unbind of unbinds) unbind();
}
