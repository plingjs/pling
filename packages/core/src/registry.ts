import { ActionError } from "./errors";
import { actionShapeOf, rowRefOf } from "./ids";
import type { LlmToolSchema } from "./llm";
import { mergeParams } from "./primitives";
import { sanitizeState, type StateLimits } from "./state";
import { createTokenVault, type TokenVault } from "./sensitivity";
import type {
  Approval,
  Binding,
  DeclarationSource,
  DefaultApproval,
  FeedbackDeclaration,
  FeedbackSeverity,
  FeedbackSource,
  Fidelity,
  GuideTarget,
  JsonSchema,
  Kind,
  PresenceState,
  Primitive,
  RecordDeclaration,
  RegionRole,
  StateExposure,
} from "./types";
import { readAvailability, resolveApproval, resolveKind } from "./types";

/** 对模型可见的 action 视图（快照元素） */
export interface ActionView {
  id: string;
  primitive: Primitive;
  description: string;
  kind: Kind;
  /** 确认策略（由 `kind` + 声明里的 `confirm` 解析而来；policy 只认它） */
  approval: Approval;
  /** 这一步需要人工接管（S5）：模型仍可调用，但执行时会请用户亲自完成 */
  handoff?: { reason: string };
  params: JsonSchema;
  /** 作用域（省略 = 全局动作） */
  scope?: string;
  /**
   * 区域路径（从最外层到最近一层，用 label 优先、没有 label 用 id）。
   *
   * 这是 S7 的「页面地图」：动作清单是按区域分组的，工具描述也会带上这条路径。
   * 同一个「确认」在不同区域（订单详情 / 支付弹窗）里，模型才分得清。
   */
  scopePath?: string[];
  /** 触发保真度 */
  fidelity: Fidelity;
  /** 这条动作是谁给的：`declared`（开发者声明）或 `derived`（L1 自动派生） */
  source?: DeclarationSource;
  /**
   * 复合动作的步骤数（S6a）。有它 = 这条动作是一条**流程**：调用一次会按顺序走完这些步骤。
   *
   * 为什么要让模型知道：它会因此**不去自己拆开做**（拆开是 5 轮往返，还容易中途跑偏），
   * 也知道「这一条可能比别的动作慢」。给的是**步数**而不是步骤清单 ——
   * 步骤是开发者的实现细节，模型关心的是「它是一条流程、有几段」。
   */
  flowSteps?: number;
  /** 这条动作的目标当前不在视口内；执行器会先滚到它（只可能出现在 offscreenRecordActions 里） */
  offscreen?: true;
}

/**
 * 作用域元信息 —— 006 新增。
 * 裁剪只省 token，不长脑子；模型必须知道「这里还有没展示出来的东西」以及「怎么找」。
 */
export interface ScopeInfo {
  id: string;
  /** 面向模型的区域名（如「订单列表」） */
  label?: string;
  /** 这块区域是干什么的（人话，进提示词） */
  description?: string;
  /** 结构角色（header / main / dialog / toolbar …） */
  role?: RegionRole;
  /** 父区域 id（用于把扁平列表还原成页面树） */
  parent?: string;
  /** 树里的层级（根 = 1） */
  depth: number;
  /** 此刻是否活跃（在视口内 / 被手动激活） */
  active: boolean;
  /** 页面阅读顺序（DOM 位置；省略 = 按声明顺序） */
  order?: number;
  /** 已声明且可用的动作总数（含当前没暴露的） */
  total: number;
  /** 当前暴露的动作数 */
  visible: number;
  /** 是否还有未暴露的动作 */
  hasMore: boolean;
  /** 此刻可用的探索动作 id（滚动容器 / 滚动页面到该区域） */
  explore: string[];
}

/** 作用域声明（一般由 `v-scope` 产生） */
export interface ScopeDeclaration {
  id: string;
  label?: string;
  /** 面向模型的区域说明：「当前订单的金额、状态与操作入口」 */
  description?: string;
  /** 结构角色：header / main / dialog / toolbar …（只影响描述与排序） */
  role?: RegionRole;
  /** 父区域 id；可传函数（适配器延迟从 DOM 解析，Vue 的 mounted 子先于父） */
  parent?: string | (() => string | undefined);
  /** 页面阅读顺序；适配器用 DOM 位置报出来，core 据此排序 */
  order?(): number | undefined;
  /** 该作用域自动生成的探索动作 id */
  explore?: string[];
}

export interface StateView {
  key: string;
  /** 面向模型的说明（面板会给开发者看） */
  description?: string;
  /** 有界序列化之后的值 */
  value: unknown;
}

/**
 * 「存在，但此刻不可用」的动作。
 *
 * 它**不进** `actions`（免得模型去点一个点不动的按钮），但也不能不告诉模型：
 * 只从清单里消失，模型就会认为「这个页面没有这个功能」。
 * 带上原因，它就能先补齐前置条件（先选中 / 先清空筛选 / 先关掉弹窗）。
 */
export interface UnavailableView {
  id: string;
  description: string;
  /** 为什么不能用（框架给的：disabled / 不可见 / 被遮罩；或开发者声明的业务前置条件） */
  reason?: string;
  /** Localized UI text for a framework-generated reason. */
  reasonKey?: string;
  reasonParams?: Record<string, string | number>;
  /** Developer-authored text appended after the framework reason. */
  reasonSuffix?: string;
  /** 从外到内的区域路径（和 ActionView.scopePath 同一份规则） */
  scopePath?: string[];
}

/** 快照里最多带几**类**不可用动作（同一形状只占一个名额，见 snapshot()） */
export const MAX_UNAVAILABLE_IN_SNAPSHOT = 20;

/**
 * 一条记录投影给模型的样子（字段已经过有界序列化）。
 *
 * `source` 是给**人**看的（面板 / 审计）：`declared` = 开发者声明的，
 * `derived` = 框架自己推出来的（S2b：从行内动作的 id 形状里认出「这里有一批行」）。
 * 模型不需要知道这个区别，但「没人保证过的东西」必须能被看出来。
 */
export interface RecordView {
  id: string;
  label?: string;
  fields: Record<string, unknown>;
  scope?: string;
  source: DeclarationSource;
}

/** 快照里的一条页面反馈：已经解包、截断，并带上区域路径。 */
export interface FeedbackView {
  id: string;
  message: string;
  severity: FeedbackSeverity;
  field?: string;
  scope?: string;
  scopePath?: string[];
  source: FeedbackSource;
}

/**
 * 页面身份（S10a）：agent 当前「站在哪个页面」。
 *
 * 它和 `v-scope` 的区域结构不是一回事：
 *   - `scopes` 回答「这一页里有哪些块」；
 *   - `page` 回答「这是哪一页、从哪条路由来的」。
 *
 * 这些值由适配器从 `location` / `document.title` / 路由实例读取，
 * core 只做有界化与只读存储。`query` 默认不暴露；需要时由适配器按白名单挑 key，
 * 避免把 token、一次性签名之类的东西送进模型上下文。
 */
export interface PageView {
  /** 当前路径（不含 query；例：`/orders/SO-1002`） */
  path?: string;
  /** 页面标题（路由 meta.title 优先，其次 document.title） */
  title?: string;
  /** 路由名（Vue Router 的 `route.name`） */
  name?: string;
  /** 路由参数（例：`{ id: "SO-1002" }`） */
  params?: Record<string, unknown>;
  /** 按白名单挑出来的 query；默认不出现 */
  query?: Record<string, unknown>;
  /** 纯片段 hash（不带 query 形状的内容） */
  hash?: string;
}

const PAGE_STRING_LIMIT = 200;
const PAGE_DATA_LIMITS: StateLimits = { maxDepth: 2, maxArray: 5, maxKeys: 12, maxString: 120 };

function pageText(value: unknown, limit = PAGE_STRING_LIMIT): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function pageRecord(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const clean = sanitizeState(value, PAGE_DATA_LIMITS);
  if (!clean || typeof clean !== "object" || Array.isArray(clean)) return undefined;
  const keys = Object.keys(clean);
  if (keys.length === 0) return undefined;
  return clean as Record<string, unknown>;
}

/** 把适配器读到的页面身份收紧成可进上下文的小对象 */
export function normalizePage(page?: PageView): PageView | undefined {
  if (!page) return undefined;
  const out: PageView = {};
  const path = pageText(page.path);
  const title = pageText(page.title, 160);
  const name = pageText(page.name, 80);
  const hash = pageText(page.hash, 120);
  const params = pageRecord(page.params);
  const query = pageRecord(page.query);
  if (path) out.path = path;
  if (title) out.title = title;
  if (name) out.name = name;
  if (params) out.params = params;
  if (query) out.query = query;
  if (hash) out.hash = hash;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 记录的裁剪上限：42 行列表不能把上下文顶爆 */
export interface RecordLimits {
  /** 快照里最多列几条记录，默认 30（其余只报数） */
  maxRecords?: number;
  /**
   * 快照里最多带多少个**可引用记录 id**，默认 200。
   *
   * 它和 `maxRecords` 是两件事：`records` 带字段，给模型「读」；
   * `recordIds` 只带 id，给行内动作的 `record` 参数用。长列表里目标行常常在
   * 视口外、甚至超出字段列表的条数上限，但它的 id 仍应可见、可引用。
   */
  maxRecordIds?: number;
  /** 单条记录的字段序列化上限（比状态更紧：字段数 × 行数） */
  fields?: StateLimits;
}

export const DEFAULT_RECORD_LIMITS: Required<RecordLimits> = {
  maxRecords: 30,
  maxRecordIds: 200,
  // 深度 1 就够：一行就是一层键值；字符串压到 120，别让一条备注吃掉整段预算
  fields: { maxDepth: 2, maxKeys: 12, maxString: 120 },
};

export interface FeedbackLimits {
  /** 快照里最多列几条反馈，默认 12 */
  maxFeedback?: number;
  /** 单条消息的字符上限，默认 160（反馈是一句话，不是日志） */
  maxMessage?: number;
}

export const DEFAULT_FEEDBACK_LIMITS: Required<FeedbackLimits> = {
  maxFeedback: 12,
  maxMessage: 160,
};

/**
 * 按适配器报的「页面位置」排序：报不出位置的（`order()` 返回 undefined）排在最后，
 * 其余彼此相对顺序不变（`Array.prototype.sort` 是稳定的）。
 */
function byDeclaredOrder(a: RecordDeclaration, b: RecordDeclaration): number {
  const left = a.order?.();
  const right = b.order?.();
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}

function byDeclaredFeedbackOrder(a: FeedbackDeclaration, b: FeedbackDeclaration): number {
  const aDeclared = (a.source ?? "declared") === "declared" ? 0 : 1;
  const bDeclared = (b.source ?? "declared") === "declared" ? 0 : 1;
  if (aDeclared !== bDeclared) return aDeclared - bDeclared;
  const left = a.order?.();
  const right = b.order?.();
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}

/** 页面快照：交给模型的「世界观」——当前可用的动作 + 暴露的状态 + 区域裁剪情况 */
export interface Snapshot {
  /** 当前页面身份（S10a）；适配器没提供时省略 */
  page?: PageView;
  actions: ActionView[];
  /**
   * 这一页的「行」：一行业务数据一条（`v-record` 声明 / S2b 由动作形状派生）。
   * 按作用域裁剪 + 条数上限，完整数量看 `recordsTotal`。
   */
  records: RecordView[];
  /** 已声明的记录总数（含被裁剪掉没进上面列表的） */
  recordsTotal: number;
  /**
   * 当前**活跃区域**内的记录 id（按页面顺序，最多 `maxRecordIds` 条）。
   *
   * 它不受 `records` 字段列表的条数上限影响：列表滚到中段时，前面/后面的行
   * 仍然可以被行内动作按 id 引用。完整数量看 `recordIdsTotal`。
   */
  recordIds: string[];
  /** 当前活跃区域内可引用记录总数（含被 `maxRecordIds` 裁掉的） */
  recordIdsTotal: number;
  /**
   * 活跃区域内、当前不在可见区的**行内动作**（不在 `actions` 里的那部分）。
   *
   * 它们不是「不能用」：模型可以按 record 引用，执行时框架会先 `reveal()`，
   * 等滚动落定后再做可用性检查。把它们放在单独的数组里，是为了让可见动作清单
   * 保持原来的语义，同时让折叠模板仍能覆盖整个活跃列表。
   */
  offscreenRecordActions: ActionView[];
  /** 页面反馈（校验错误 / toast / 状态提示），有界裁剪；完整数量看 `feedbackTotal` */
  feedback: FeedbackView[];
  /** 已声明的反馈总数（含被裁剪 / 因区域不活跃没列出的） */
  feedbackTotal: number;
  /** 状态（key → 有界序列化后的值）：直接拼进模型上下文 */
  state: Record<string, unknown>;
  /** 同上，但带上说明——给面板 / 审计看，人需要知道「这组状态是什么」 */
  stateViews: StateView[];
  /** 已声明且可用的动作总数（未做任何裁剪），用于观察裁剪效果 */
  total: number;
  /**
   * 已声明但此刻不可用的动作（是否带原因由声明方决定）。**同一形状只留一条**
   * （`remove@order:*` 是同一类动作，42 行不该产生 42 条一模一样的原因）；
   * 有长度上限 `MAX_UNAVAILABLE_IN_SNAPSHOT`，完整数量看 `unavailableTotal`。
   */
  unavailable: UnavailableView[];
  /** 不可用动作的总数（含没进上面那个列表的） */
  unavailableTotal: number;
  /** 区域裁剪元信息 */
  scopes: ScopeInfo[];
}

/**
 * 取快照时对「行数据」的窗口控制。
 *
 * 动作清单与可引用 id 仍然完整；这里只影响带字段的 `records` 视图。
 * 用于 Surface 等长连接客户端做分页 / 按 id 精读，避免每轮都把整张表塞进上下文。
 */
export interface SnapshotOptions {
  /** 从当前活跃记录里的第几条开始（默认 0） */
  recordOffset?: number;
  /** 本轮最多返回多少条记录；省略时沿用 registry 的 `recordLimits.maxRecords` */
  recordLimit?: number;
  /** 只取这些记录 id；未知 id 会被忽略，不会伪造记录 */
  recordIds?: readonly string[];
}

export interface Registry {
  /** 设置当前页面身份（只读数据）；传 undefined 表示清空 */
  setPage(page?: PageView): void;
  /** 绑定元素（随组件生命周期注册 / 注销），返回解绑函数 */
  bind(binding: Binding): () => void;
  /** 声明一行业务数据（随组件生命周期注册 / 注销），返回取消声明函数 */
  declareRecord(record: RecordDeclaration): () => void;
  /** 声明一条页面反馈（只读），返回取消声明函数 */
  declareFeedback(feedback: FeedbackDeclaration): () => void;
  /** 暴露状态，返回取消暴露函数 */
  expose(exposure: StateExposure): () => void;
  /** 声明一个仅供指引高亮的目标（S17，不是动作），返回取消声明函数 */
  declareGuideTarget(id: string, target: GuideTarget): () => void;
  /** 给指引目标报视觉状态；返回 false 表示没有登记这个目标 */
  markGuideTarget(id: string, state: PresenceState): boolean;
  /** 声明一个作用域（标签 / 探索动作），返回取消声明函数 */
  declareScope(declaration: ScopeDeclaration): () => void;
  get(id: string): Binding | undefined;
  /** 手动设置「活跃的作用域」（保留 005 的用法） */
  setActiveScopes(scopes: Iterable<string>): void;
  /** 由可见性自动驱动的作用域（`v-scope` + IntersectionObserver） */
  setAutoScopes(scopes: Iterable<string>): void;
  /** 某个作用域此刻是否活跃（手动 ∪ 自动） */
  isScopeActive(scope: string): boolean;
  /**
   * 没写 `confirm` 的动作默认怎么处理（`"kind"` | `"danger"`）。
   * 应用在配置里选了之后由适配器调 `setDefaultApproval` 落下来 —— 声明期的事，改了就影响后续快照。
   */
  readonly defaultApproval: DefaultApproval;
  setDefaultApproval(mode: DefaultApproval): void;
  /** 只包含「此刻可用 + 在活跃作用域内 + 落在可见区」的 action —— 执行流水线第 5 步的过滤 */
  snapshot(options?: SnapshotOptions): Snapshot;
  toolSchemas(): LlmToolSchema[];
  onChange(listener: () => void): () => void;
  /**
   * 敏感值保险箱（S14）：同一页面会话一份。
   * 快照里的 `token` 模式值、审计里的反向脱敏都从它走。
   */
  readonly tokens: TokenVault;
  /**
   * 执行前把参数里的 `{{p:…}}` 换回真值（S14）。
   * 引用了保险箱里没有的 token 会抛 `INVALID_ARGS` —— 宁可报错，也不猜。
   */
  resolveSensitiveArgs(args: Record<string, unknown>): Record<string, unknown>;
  /** 出站文本的反向脱敏：已知真值 → token（错误信息 / 工具回执用） */
  redactText(text: string): string;
}

export interface RegistryOptions {
  /** 状态暴露的有界序列化上限（见 `sanitizeState`） */
  stateLimits?: StateLimits;
  /** 记录（行数据）的裁剪上限 */
  recordLimits?: RecordLimits;
  /** 页面反馈的裁剪上限 */
  feedbackLimits?: FeedbackLimits;
  /** 没写 `confirm` 的动作默认怎么办，默认 `"danger"`（只有 danger 问） */
  defaultApproval?: DefaultApproval;
  /** 固定 token 盐（测试用；生产默认每个页面会话随机） */
  tokenSalt?: string;
}

export function createRegistry(options: RegistryOptions = {}): Registry {
  let defaultApproval: DefaultApproval = options.defaultApproval ?? "danger";
  const recordLimits: Required<RecordLimits> = { ...DEFAULT_RECORD_LIMITS, ...options.recordLimits };
  const feedbackLimits: Required<FeedbackLimits> = { ...DEFAULT_FEEDBACK_LIMITS, ...options.feedbackLimits };
  let page: PageView | undefined;
  const bindings = new Map<string, Binding>();
  const records = new Map<string, RecordDeclaration[]>();
  const feedbacks = new Map<string, FeedbackDeclaration[]>();
  const exposures = new Map<string, StateExposure>();
  const guideTargets = new Map<string, GuideTarget>();
  const declarations = new Map<string, ScopeDeclaration>();
  const listeners = new Set<() => void>();
  let manualScopes = new Set<string>();
  let autoScopes = new Set<string>();
  const tokens = createTokenVault(options.tokenSalt === undefined ? {} : { salt: options.tokenSalt });

  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  const isScopeActive = (scope: string): boolean => manualScopes.has(scope) || autoScopes.has(scope);

  const scopeOf = (binding: Binding): string | undefined =>
    binding.resolveScope ? binding.resolveScope() : binding.descriptor.scope;

  const resolveSensitiveArgs = (args: Record<string, unknown>): Record<string, unknown> => {
    const unknown = tokens.unknownTokens(args);
    if (unknown.length > 0) {
      throw new ActionError(
        "INVALID_ARGS",
        `Arguments reference unknown sensitive-value tokens: ${unknown.join(", ")}. ` +
          "Only reuse {{p:…}} tokens exactly as they appear in page data; do not invent or rewrite them.",
      );
    }
    const walk = (input: unknown): unknown => {
      if (typeof input === "string") return tokens.resolve(input);
      if (Array.isArray(input)) return input.map(walk);
      if (input && typeof input === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(input as Record<string, unknown>)) out[key] = walk(value);
        return out;
      }
      return input;
    };
    return walk(args) as Record<string, unknown>;
  };

  return {
    get defaultApproval() {
      return defaultApproval;
    },
    tokens,
    resolveSensitiveArgs,
    redactText: (text) => tokens.redact(text),
    setDefaultApproval(mode) {
      if (mode === defaultApproval) return;
      defaultApproval = mode;
      // 声明期的设定变了 → 快照（含给模型的 approval 标记）跟着变，面板 / 审计也刷新
      emit();
    },
    setPage(next) {
      const normalized = normalizePage(next);
      if (JSON.stringify(normalized) === JSON.stringify(page)) return;
      page = normalized;
      emit();
    },
    bind(binding) {
      const { id } = binding.descriptor;
      if (bindings.has(id)) {
        throw new ActionError("DUPLICATE_ACTION_ID", `action id 重复: ${id}（id 必须全局唯一）`);
      }
      bindings.set(id, binding);
      emit();
      return () => {
        bindings.delete(id);
        emit();
      };
    },

    declareRecord(record) {
      // 同一个 id 允许多份声明（master-detail：列表行 + 详情区都可能登记同一条业务数据）。
      // 快照取**第一份**（先到先得，保持既有语义）；第一份注销后，下一份自动接棒。
      // 不抛异常：它是只读数据，不该因为一行的 :key 不唯一就把整页渲染搞崩。
      const list = records.get(record.id);
      if (list) list.push(record);
      else records.set(record.id, [record]);
      emit();
      return () => {
        const current = records.get(record.id);
        if (!current) return;
        const index = current.indexOf(record);
        if (index === -1) return;
        current.splice(index, 1);
        if (current.length === 0) records.delete(record.id);
        emit();
      };
    },

    declareFeedback(feedback) {
      // 同一 id 允许多份（面板 / 表单可能在多处同时声明同一类反馈）；
      // 快照取第一份，先到先得，第一份注销后下一份接棒 —— 和 record 一致。
      const list = feedbacks.get(feedback.id);
      if (list) list.push(feedback);
      else feedbacks.set(feedback.id, [feedback]);
      emit();
      return () => {
        const current = feedbacks.get(feedback.id);
        if (!current) return;
        const index = current.indexOf(feedback);
        if (index === -1) return;
        current.splice(index, 1);
        if (current.length === 0) feedbacks.delete(feedback.id);
        emit();
      };
    },

    expose(exposure) {
      if (exposures.has(exposure.key)) {
        throw new ActionError("DUPLICATE_STATE_KEY", `state key 重复: ${exposure.key}`);
      }
      exposures.set(exposure.key, exposure);
      emit();
      return () => {
        exposures.delete(exposure.key);
        emit();
      };
    },

    declareGuideTarget(id, target) {
      if (guideTargets.has(id)) {
        throw new ActionError("DUPLICATE_GUIDE_TARGET", `guide target 重复: ${id}（一个元素一个指引目标 id）`);
      }
      guideTargets.set(id, target);
      return () => {
        if (guideTargets.get(id) === target) guideTargets.delete(id);
      };
    },

    markGuideTarget(id, state) {
      const target = guideTargets.get(id);
      if (!target) return false;
      target.presence(state);
      return true;
    },

    declareScope(declaration) {
      declarations.set(declaration.id, declaration);
      emit();
      return () => {
        declarations.delete(declaration.id);
        emit();
      };
    },

    get(id) {
      return bindings.get(id);
    },

    setActiveScopes(scopes) {
      manualScopes = new Set(scopes);
      emit();
    },

    setAutoScopes(scopes) {
      autoScopes = new Set(scopes);
      emit();
    },

    isScopeActive,

    snapshot(view: SnapshotOptions = {}) {
      const actions: ActionView[] = [];
      const recordViews: RecordView[] = [];
      const recordIds: string[] = [];
      const activeRecordIds = new Set<string>();
      const offscreenRecordActions: ActionView[] = [];
      const stats = new Map<string, { total: number; visible: number }>();
      const unavailable: UnavailableView[] = [];
      const unavailableShapes = new Set<string>();
      let total = 0;
      let unavailableTotal = 0;

      /**
       * 区域树：区域声明可以是扁平的（子作用域挂载早于父作用域），
       * 所以父链、层级、页面顺序都在**取快照时**统一解析，而不是在声明时锁死。
       */
      const parentOf = new Map<string, string | undefined>();
      const orderOf = new Map<string, number | undefined>();
      for (const [id, declaration] of declarations) {
        const parent = typeof declaration.parent === "function" ? declaration.parent() : declaration.parent;
        if (parent !== undefined && parent !== id) parentOf.set(id, parent);
        const order = declaration.order?.();
        if (order !== undefined) orderOf.set(id, order);
      }

      const pathOf = (scope: string): string[] => {
        const path: string[] = [];
        const seen = new Set<string>();
        let current: string | undefined = scope;
        while (current !== undefined && !seen.has(current)) {
          seen.add(current);
          path.unshift(declarations.get(current)?.label ?? current);
          current = parentOf.get(current);
        }
        return path;
      };

      const feedbackViews: FeedbackView[] = [];
      const feedbackKeys = new Set<string>();
      const declaredFeedback = [...feedbacks.values()].map((list) => list[0]!);
      const orderedFeedback = declaredFeedback.some((item) => item.order)
        ? declaredFeedback.sort(byDeclaredFeedbackOrder)
        : declaredFeedback;

      for (const item of orderedFeedback) {
        const scope = item.resolveScope ? item.resolveScope() : item.scope;
        // 和动作 / 记录共用一个世界观：区域不活跃，就不把里面的反馈塞给模型
        if (scope !== undefined && !isScopeActive(scope)) continue;
        if (feedbackViews.length >= feedbackLimits.maxFeedback) continue;

        let message = "";
        try {
          const raw = typeof item.message === "function" ? item.message() : item.message;
          message = String(raw ?? "").trim();
        } catch (error) {
          message = `(read failed: ${error instanceof Error ? error.message : String(error)})`;
        }
        if (!message) continue;
        // 页面反馈也可能嵌着真值（「客户 138… 不能为空」）—— 出站前反向脱敏
        message = tokens.redact(message);
        if (message.length > feedbackLimits.maxMessage) message = `${message.slice(0, feedbackLimits.maxMessage)}…`;

        let field: string | undefined;
        let severity: FeedbackSeverity = "error";
        try {
          const rawField = typeof item.field === "function" ? item.field() : item.field;
          field = typeof rawField === "string" && rawField.trim() ? rawField.trim() : undefined;
          const rawSeverity = typeof item.severity === "function" ? item.severity() : item.severity;
          if (rawSeverity) severity = rawSeverity;
        } catch {
          // 字段 / 级别读失败不影响消息本身：宁可少一个定位提示，也不能把反馈丢掉
        }

        // 自动收集（ARIA）与显式声明可能指向同一句话：同一个字段 + 同一句话只留一条。
        const key = `${scope ?? ""}\u0000${field ?? ""}\u0000${severity}\u0000${message}`;
        if (feedbackKeys.has(key)) continue;
        feedbackKeys.add(key);

        const scopePath = scope === undefined ? undefined : pathOf(scope);
        feedbackViews.push({
          id: item.id,
          message,
          severity,
          ...(field === undefined ? {} : { field }),
          ...(scope === undefined ? {} : { scope }),
          ...(scopePath && scopePath.length > 0 ? { scopePath } : {}),
          source: item.source ?? "declared",
        });
      }

      // 顺序：适配器能报出「这一行在页面上的位置」就按它排。
      // 登记顺序靠不住 —— Vue 挂载 keyed 列表时新行是倒着创建的（见 `RecordDeclaration.order`）。
      const declared = [...records.values()].map((list) => list[0]!);
      const ordered = declared.some((record) => record.order)
        ? declared.sort(byDeclaredOrder)
        : declared;

      // 先过一遍记录表，得到「当前活跃区域里能按 id 引用的行」。
      // 注意这和 records 视图不是一回事：records 受字段条数上限约束，而 id 索引
      // 只装字符串，能让模型操作滚出可视区 / 超出字段列表的行。
      for (const record of ordered) {
        const scope = record.resolveScope ? record.resolveScope() : record.scope;
        if (scope !== undefined && !isScopeActive(scope)) continue;
        activeRecordIds.add(record.id);
        if (recordIds.length < recordLimits.maxRecordIds) recordIds.push(record.id);
      }

      const recordFilter = view.recordIds ? new Set(view.recordIds) : null;
      const recordOffset = Math.max(0, Math.floor(view.recordOffset ?? 0));
      const recordLimit = Math.max(0, Math.floor(view.recordLimit ?? recordLimits.maxRecords));
      let recordIndex = 0;
      for (const record of ordered) {
        const scope = record.resolveScope ? record.resolveScope() : record.scope;
        // 与动作同一条裁剪链：区域不活跃 → 这行数据也不进快照（但仍计入总数）
        if (scope !== undefined && !isScopeActive(scope)) continue;
        if (recordFilter && !recordFilter.has(record.id)) continue;
        if (recordIndex++ < recordOffset) continue;
        if (recordViews.length >= recordLimit) continue;
        let fields: Record<string, unknown>;
        try {
          const raw = typeof record.fields === "function" ? record.fields() : (record.fields ?? {});
          fields = (sanitizeState(raw, recordLimits.fields, { vault: tokens }) ?? {}) as Record<string, unknown>;
        } catch (error) {
          // 读失败也不能拖垮整个快照（和状态一个道理）
          fields = { "(read failed)": error instanceof Error ? error.message : String(error) };
        }
        recordViews.push({
          id: record.id,
          ...(record.label === undefined ? {} : { label: record.label }),
          fields,
          scope,
          source: "declared",
        });
      }

      /** 把运行时绑定投影成模型视图；offscreen 只用于单独那批「可揭示」动作 */
      const actionViewOf = (
        binding: Binding,
        scope: string | undefined,
        scopePath: string[] | undefined,
        offscreen = false,
      ): ActionView => {
        const { id, primitive, description, kind, params, fidelity, confirm, source, handoff } = binding.descriptor;
        const resolvedKind = resolveKind(primitive, kind);
        return {
          id,
          primitive,
          description,
          kind: resolvedKind,
          approval: resolveApproval(resolvedKind, confirm, defaultApproval),
          ...(handoff ? { handoff } : {}),
          params: mergeParams(primitive, binding.resolveParams ? binding.resolveParams() : params),
          scope,
          ...(scopePath && scopePath.length > 0 ? { scopePath } : {}),
          fidelity: fidelity ?? "high",
          source: source ?? "declared",
          ...(binding.steps && binding.steps.length > 0 ? { flowSteps: binding.steps.length } : {}),
          ...(offscreen ? { offscreen: true as const } : {}),
        };
      };

      for (const binding of bindings.values()) {
        const scope = scopeOf(binding);
        const scopePath = scope === undefined ? undefined : pathOf(scope);
        const availability = readAvailability(binding.isAvailable());
        if (!availability.available) {
          unavailableTotal += 1;
          // 同形状只留一条：42 行列表被遮罩盖住时是 126 个「一样的原因」，
          // 全带上是纯浪费 —— 真正有用的信息是「这一**类**动作用不了，因为 X」。
          const shape = actionShapeOf(binding.descriptor.id);
          if (unavailable.length < MAX_UNAVAILABLE_IN_SNAPSHOT && !unavailableShapes.has(shape)) {
            unavailableShapes.add(shape);
            unavailable.push({
              id: binding.descriptor.id,
              description: binding.descriptor.description,
              ...(availability.reason === undefined ? {} : { reason: availability.reason }),
              ...(availability.reasonKey === undefined ? {} : { reasonKey: availability.reasonKey }),
              ...(availability.reasonParams === undefined ? {} : { reasonParams: availability.reasonParams }),
              ...(availability.reasonSuffix === undefined ? {} : { reasonSuffix: availability.reasonSuffix }),
              ...(scopePath && scopePath.length > 0 ? { scopePath } : {}),
            });
          }
          continue;
        }
        total += 1;

        if (scope !== undefined) {
          const stat = stats.get(scope) ?? { total: 0, visible: 0 };
          stat.total += 1;
          stats.set(scope, stat);
        }

        // 作用域裁剪：全局动作始终暴露；带作用域的动作只在活跃作用域内暴露
        if (scope !== undefined && !isScopeActive(scope)) continue;
        // 可见性裁剪：元素没进入可视区就不放进 `actions`（但计入 total，供 hasMore 判断）。
        // 行内动作另存一份：模型仍可按 record 引用它，执行器会先滚到目标。
        if (binding.isVisible && !binding.isVisible()) {
          const ref = rowRefOf(binding.descriptor.id);
          if (ref && activeRecordIds.has(ref.record)) {
            offscreenRecordActions.push(actionViewOf(binding, scope, scopePath, true));
          }
          continue;
        }

        if (scope !== undefined) stats.get(scope)!.visible += 1;
        actions.push(actionViewOf(binding, scope, scopePath));
      }

      const state: Record<string, unknown> = {};
      const stateViews: StateView[] = [];
      for (const exposure of exposures.values()) {
        // 状态是页面数据：先有界序列化，再交给模型；读失败也不能拖垮整个快照
        let value: unknown;
        try {
          value = sanitizeState(exposure.read(), options.stateLimits, { vault: tokens });
        } catch (error) {
          value = `(read failed: ${error instanceof Error ? error.message : String(error)})`;
        }
        state[exposure.key] = value;
        stateViews.push({
          key: exposure.key,
          ...(exposure.description === undefined ? {} : { description: exposure.description }),
          value,
        });
      }

      const scopeIds = new Set<string>([...declarations.keys(), ...stats.keys()]);
      const scopes: ScopeInfo[] = [...scopeIds].map((id) => {
        const stat = stats.get(id) ?? { total: 0, visible: 0 };
        const declaration = declarations.get(id);
        const path = pathOf(id);
        const explore = (declaration?.explore ?? []).filter((actionId) => {
          const binding = bindings.get(actionId);
          if (!binding || !readAvailability(binding.isAvailable()).available) return false;
          return !binding.isVisible || binding.isVisible();
        });
        return {
          id,
          label: declaration?.label,
          description: declaration?.description,
          role: declaration?.role,
          parent: parentOf.get(id),
          depth: path.length,
          active: isScopeActive(id),
          order: orderOf.get(id),
          total: stat.total,
          visible: stat.visible,
          hasMore: stat.total > stat.visible,
          explore,
        };
      });
      // 页面阅读顺序：适配器报得出 DOM 位置就按它排；报不出的保持声明顺序（稳定排序）。
      scopes.sort((a, b) => {
        if (a.order === undefined && b.order === undefined) return 0;
        if (a.order === undefined) return 1;
        if (b.order === undefined) return -1;
        return a.order - b.order;
      });

      return {
        ...(page ? { page } : {}),
        actions,
        records: recordViews,
        recordsTotal: records.size,
        recordIds,
        recordIdsTotal: activeRecordIds.size,
        offscreenRecordActions,
        feedback: feedbackViews,
        feedbackTotal: feedbacks.size,
        state,
        stateViews,
        total,
        unavailable,
        unavailableTotal,
        scopes,
      };
    },

    toolSchemas() {
      return this.snapshot().actions.map((action) => ({
        type: "function" as const,
        function: {
          name: action.id,
          description: `${action.description} (primitive: ${action.primitive})`,
          parameters: action.params,
        },
      }));
    },

    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
