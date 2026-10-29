/**
 * pi core · 类型契约（框架无关）
 *
 * 这里定义 core 唯一认识的一套接口。React / Vue / 原生适配器的职责，
 * 就是把各自框架的「挂载 / 卸载」「响应式」「元素 ref」翻译成这套接口。
 * 本文件（以及整个 core/）不允许出现任何框架概念。
 */
import type { FlowStep } from "./flow";

/** 风险等级：声明期静态标注，可审计（对应参考实现的 Kind） */
export type Kind = "read" | "write" | "danger";

/**
 * 区域在页面里的**结构角色**（S7）。
 *
 * 它不是 CSS / 框架概念，而是给模型看的「读页面」提示：
 * 人扫一眼知道哪块是页头、哪块是弹窗、哪块是工具栏；模型只有 token，
 * 需要把这件事显式写出来。`role` 只影响描述与顺序，不参与执行与权限。
 */
export type RegionRole =
  | "page"
  | "header"
  | "nav"
  | "main"
  | "aside"
  | "section"
  | "form"
  | "dialog"
  | "toolbar"
  | "list"
  | "footer";

/** 风险等级的严格程度，用于取「下限」 */
export const KIND_ORDER: Record<Kind, number> = { read: 0, write: 1, danger: 2 };

/**
 * UI 原语：固定动词表。原语决定执行方式与参数形状。
 *
 * `flow`（S6a）不是 DOM 原语，而是「**按步骤编排**」—— 复合动作对模型是 1 个 tool，
 * 内部按 `Binding.steps` 顺序执行一批已注册的动作。它单独一档而不是借 `click`，
 * 是为了让清单、审计、`kind` 下限都说真话：流程不是点击，它可以只读。
 */
export type Primitive = "click" | "type" | "select" | "scroll" | "navigate" | "press" | "hover" | "flow" | "call";

/** 每个原语的 kind 下限（绑定的声明不得低于它） */
export const PRIMITIVE_KIND_FLOOR: Record<Primitive, Kind> = {
  click: "write",
  type: "write",
  select: "write",
  scroll: "read",
  navigate: "read",
  press: "write",
  // hover 只表达「指针移进来了」：它本身不改业务数据（菜单是否打开由页面决定），
  // 所以下限是 read。省略 kind 时仍然按 fail-closed 视为 write（resolveKind）。
  hover: "read",
  // 流程本身不产生副作用，副作用来自它的步骤 —— 所以下限是 read（步骤各自过闸门），
  // 声明省略时仍然是 fail-closed 的 write（见 resolveKind）。
  flow: "read",
  // 函数级动作（S15）：没有 DOM 元素，实现由开发者注入。下限是 read ——
  // 它做不做事只有开发者知道；省略 kind 时仍按 fail-closed 视为 write。
  call: "read",
};

/**
 * 触发保真度 —— 回答「这个动作有多可信」，本质是**谁为它背书**：
 *
 *   high —— 有保证。开发者给了 run（注入），或声明元素本身就是原生可交互元素（DOM 模拟可靠）
 *   auto —— 框架自动把目标定位到了内层唯一的原生元素（大概率对，但没有开发者背书）
 *   low  —— 没有任何保证。只能对声明元素做 DOM 模拟，可能不生效
 */
export type Fidelity = "high" | "auto" | "low";

/** 极简 JSON Schema 片段（参数协议） */
export interface JsonSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
}

/**
 * 一条声明是谁给的 —— 这个字段是给**人**看的（面板 / 审计 / 调试），模型不需要它。
 *
 *   `declared` —— 开发者显式写的（`v-tool` / `v-record`）：有人为它的语义背书
 *   `derived`  —— 框架自己推出来的（L1 自动派生）：**没人保证过**，别当成事实
 *
 * 为什么非要区分（PERCEPTION-01 §5）：自动派生的东西一旦和人工声明长得一模一样，
 * 出了问题就没人分得清「这是开发者说的」还是「这是框架猜的」。
 * 猜的依据（文案、元素类型）会变，一份带着 `derived` 的清单才能被有折扣地信任。
 */
export type DeclarationSource = "declared" | "derived";

/**
 * 页面反馈的类型。
 *
 * 它不是动作，也不参与权限判定：只回答「为什么刚才那一步没成 / 页面刚说了什么」。
 * `success` 也保留：有些业务会把「保存成功」放在同一块提示区里，模型同样需要读懂。
 */
export type FeedbackSeverity = "error" | "warning" | "info" | "success";

/** 反馈来自哪里：开发者显式声明，还是适配器从 ARIA 语义里收上来的 */
export type FeedbackSource = "declared" | "aria";

/** 对模型可见的「能力单元」：由 Binding 投影而来 */
export interface ActionDescriptor {
  /** 稳定 id，模型调用时使用 */
  id: string;
  primitive: Primitive;
  /** 自然语言语义：这个元素是什么、做什么（喂给模型的提示工程所在） */
  description: string;
  /** 风险等级。fail-closed：省略视为 write。 */
  kind?: Kind;
  /**
   * 确认策略覆盖（省略 = 按 `kind` 推导，见 `resolveApproval`）：
   *   `false`     我担保这个动作不用问（danger 也照此执行，dev 下会告警）
   *   `true`      要问（读操作也能标，比如「导出全量数据」）
   *   `"always"`  每次都问，且不给「总是允许」（把一个 write 提升到 danger 的强度）
   */
  confirm?: boolean | "always";
  /**
   * 这一步需要人工接管（S5）。有它时动作仍然出现在清单里，但执行时会请用户亲自完成；
   * 这里只带 `reason`，给模型和工具描述看的。运行时规格（`expect` / `timeout`）在 `Binding.handoff`。
   */
  handoff?: { reason: string };
  /** 参数 schema 扩展（原语自带基础形状，这里补充约束 / 说明） */
  params?: JsonSchema;
  /** 作用域：用于裁剪（列表 / 区域）。省略 = 全局动作，始终暴露。 */
  scope?: string;
  /** 触发保真度；省略视为 high */
  fidelity?: Fidelity;
  /** 这条动作是谁给的（省略视为 `declared`）。自动派生（L1）必须标 `derived`。 */
  source?: DeclarationSource;
}

/**
 * 「这一步成功的判据」（S4）—— 声明式期望。
 *
 * 为什么需要它：很多动作是**异步**的。「点下去」只说明事件发出去了，
 * 不代表「事情发生了」—— 提交要走一次网络，删除要等动画，抽屉要 300ms 才出现。
 * 框架取快照是同步的，不等就只能靠「快照变了没有」猜：把「还在处理」当成「无变化」，
 * 于是把成功报成失败、把失败报成成功。
 *
 * 给了 `expect` 之后，执行流水线会在 `run` 之后**等它成立**：
 *   · 成立   → 正常成功，回执里带上 `expect` 的说明（「我确认了这件事发生了」）；
 *   · 不成立 → `EXPECTATION_FAILED`，明确说「已经执行，但没等到期望的结果」，
 *             而不是假装成功。
 *
 * 注意它是**给执行用的**，不进 `descriptor`：模型不需要知道「框架等到了什么」，
 * 它需要的是「这一步到底成没成」。
 */
export interface Expectation {
  /** 人话版的期望（失败时原样带回给模型）：「新待办出现在列表里」 */
  desc?: string;
  /** 判据：此刻世界符合期望了吗（可以读 DOM、可以读业务状态） */
  check(): boolean | Promise<boolean>;
  /** 最多等多久（ms）；省略用 `DEFAULT_WAIT_TIMEOUT`（2000） */
  timeout?: number;
}

/**
 * 人工接管（S5）：这一步**不由 agent 操作**，而是请用户亲自完成。
 *
 * 典型场景：图形验证码、滑块、U 盾 / 本人复核。这些步骤如果让模型猜着填，
 * 不是失败就是绕过业务真正的安全边界 —— 所以框架把它们从「动作」变成「接力」：
 *   · 模型仍然调用声明了 handoff 的动作（它知道该办这件事）；
 *   · 执行流水线不模拟点击，而是在面板里说明原因，等用户说「我已完成」；
 *   · 用户完成后，框架用 `expect` 确认结果真的发生，再把回执交还给模型。
 *
 * `expect` 强烈建议写：否则「我已完成」只是一个口头承诺，框架无法区分
 * 「用户真的做完了」和「用户点了按钮但其实没成功」。
 */
export interface HandoffSpec {
  /** 为什么需要人工（面板上原样显示给用户） */
  reason: string;
  /**
   * 分步指引（S17，可选）：把「请用户做」拆成一步一步。
   *
   * 每一步只写一句人话；`highlight` 指向一个 `v-guide-target` 或已注册动作的 id，
   * 适配器会把那一步该看 / 该点的元素亮出来。步骤只是**指引**，不产生新动作，
   * 也不会替用户操作。
   */
  steps?: readonly HandoffStep[];
  /** 用户点「我已完成」之后，框架据此确认结果是否真的发生 */
  expect?: Expectation;
  /** 最多等用户多久（ms）；省略用 `DEFAULT_HANDOFF_TIMEOUT`（5 分钟） */
  timeout?: number;
}

/** 人工接力里的一步：一句人话 + 可选的高亮目标（S17） */
export interface HandoffStep {
  /** 让用户做什么（原样显示在面板上） */
  text: string;
  /**
   * 这一步该看 / 该点的元素：填 `v-guide-target` 的 id，或一个已注册动作的 id。
   * 省略时高亮发起接力动作自己的元素。
   */
  highlight?: string;
}

/**
 * 视觉存在感（S13）：执行器只报「现在在干什么」，怎么画由适配器决定。
 *
 *   acting   正在操作这个元素（高亮一下，让人看见 agent 点到了哪）
 *   waiting  这一步交给用户（高亮要填 / 要点的地方）
 *   idle     结束（适配器可以收掉高亮）
 *
 * core 不认识 DOM、样式、动画 —— 这里只是一个通知，省略就等于不显示。
 */
export type PresenceState = "acting" | "waiting" | "idle";

/**
 * 指引目标（S17）：只负责「被高亮」，不是可执行动作。
 *
 * 典型写法是 Vue 的 `v-guide-target="'captcha_input'"`：验证码输入框不应该注册成
 * agent 动作（未注册不兜底），但用户接力时框架仍然需要圈出它。
 */
export interface GuideTarget {
  presence(state: PresenceState): void;
}

/** 运行时绑定：一个被声明可交互的元素实例 */
export interface Binding {
  descriptor: ActionDescriptor;
  /**
   * 这一步的**成功判据**（S4，可选）。见 {@link Expectation}：
   * 执行流水线会在 `run` 之后等它成立（默认最长 2s），不成立就报 `EXPECTATION_FAILED`。
   */
  expect?: Expectation;
  /**
   * 人工接管规格（S5）。有它时执行流水线**跳过 `run`**：这一步由用户亲自完成。
   * 与确认闸门（approval）的关系：接力是「人来做」，不是「人来批」，
   * 所以同一个动作上两者不叠加 —— 用户亲手做这件事本身就是批准。
   */
  handoff?: HandoffSpec;
  /**
   * 视觉存在感（S13，可选）：执行器在「开始操作 / 交给用户 / 结束」时调用。
   * 适配器据此把目标元素画出来 —— 开发者不用为「高亮」写任何声明。
   */
  presence?(state: PresenceState): void;
  /** 元素此刻是否可用（已挂载 / 未 disabled / 可见 / 业务前置条件满足）——对应执行流水线第 5 步 */
  isAvailable(): Availability;
  /**
   * 元素此刻是否落在「可见区域」内（视口 / 滚动容器）。
   * 省略 = 不参与可见性裁剪；返回 false 时该动作不进 `actions`（仍计入 total）。
   * 若它是活跃区域内的行内动作，会进入 `offscreenRecordActions`，执行前可 `reveal`。
   */
  isVisible?(): boolean;
  /**
   * 把动作目标带到可见区（可选；S12）。
   *
   * 只在 `isVisible()` 返回 false 时由执行器调用：模型可以引用活跃区域内、
   * 但暂时滚在视口外的行（例如长列表第 42 行），框架先滚到它再执行，
   * 而不是要求模型先搜索、再滚动、最后再猜一次 id。
   *
   * 适配器负责「怎么滚」（Vue 用 `scrollIntoView` + 滚动观察器）；core 只负责
   * 在权限通过后调用它、等页面落定，再重新检查可见性与可用性。
   */
  reveal?(): void | Promise<void>;
  /**
   * 动态解析作用域（容器自动继承用）。优先于 `descriptor.scope`。
   * 存在的原因：Vue 指令的 mounted 是「子先于父」，作用域只能延迟解析。
   */
  resolveScope?(): string | undefined;
  /**
   * 执行原语（真实 DOM 操作由适配器实现）。**复合动作没有它** —— 见 `steps`
   *
   * 返回值（S15）：可以是任何东西，执行器会做**有界序列化**后放进回执的 `data`。
   * 典型用法是函数级动作返回「影响了几条 / 导出了什么」，让模型拿到业务结果，
   * 而不是只能从「快照没变化」里猜。返回 `undefined` 时回执里不会出现 `data`，
   * 所以现有的 `v-tool` 注入实现完全不受影响。
   */
  run?(args: Record<string, unknown>): Promise<unknown>;
  /**
   * 重新生成参数 schema（S6b-1）。
   *
   * 只有**动态参数**（`options()` / 函数形式的 `min` / `max`）才需要它：
   * 选项和边界随页面数据变化，模型看到的 schema 与执行前的校验都必须用**此刻**的那份。
   * 静态声明直接读 `descriptor.params`。
   */
  resolveParams?(): JsonSchema;
  /**
   * 复合动作的步骤（S6a）：给 `steps` 就不要 `run` —— 对模型是 1 个 tool，
   * 内部按顺序执行已注册的动作（见 `flow.ts`）。
   *
   * 用 `steps` 而不是让适配器在 `run` 里自己 `execute` 出一串动作，是为了让**框架**
   * 拿到「这条动作是一条流程、有几步」这件事：权限聚合、逐步回执、失败定位、
   * 清单里的「流程:N 步」标签、面板里的一行账，全都得有它。
   */
  steps?: readonly FlowStep[];
}

/** 状态暴露（读）：响应式、按需计算，与 Action 并列 */
export interface StateExposure {
  key: string;
  description?: string;
  read(): unknown;
}

/**
 * 记录（record）：页面上的**一行业务数据** —— `v-for` 的每一行。
 *
 * 为什么要有它（PERCEPTION-01 §4.2）：动作是**元素级**的，42 行列表就有 84 个行内动作，
 * 模型只看得到「能删 SO-1001」，看不到「SO-1001 的金额是 3200、状态是逾期」。
 * 把「行」升级成一等公民之后：
 *   读（字段）与写（行内动作）对称；动作可以按形状收敛成一条；
 *   模型能**基于数据判断**（「找出逾期且金额 > 3000 的」），而不是只能照着清单点。
 *
 * 和 `v-tool` 的关系：记录只解决**读**。它不产生任何可执行动作 ——
 * 读到的数据无法凭空造出一个按钮，所以「未注册不兜底」这条原则不受影响。
 */
export interface RecordDeclaration {
  /** 稳定 id（业务主键，如订单号）：模型按它引用这一行 */
  id: string;
  /** 面向模型的说明（如「订单 SO-1001」）；省略就没有额外说明 */
  label?: string;
  /**
   * 字段：读得到的业务数据。值会在快照组装时做有界序列化（见 `sanitizeState`）。
   *
   * 也可以传一个**函数**：快照组装时才读（适配器用它做「实时读 + 解包 ref」——
   * Vue 的 `ref` 套在普通对象里不会被自动解包，直接读会把 `{__v_isRef: true, …}` 喂给模型）。
   */
  fields?: Record<string, unknown> | (() => Record<string, unknown>);
  /** 所属作用域（与动作同一条裁剪链）：区域不活跃时，这一行的数据也不进快照 */
  scope?: string;
  /**
   * 动态解析作用域（容器自动继承用）。理由同 `Binding.resolveScope`：
   * Vue 指令的 mounted 是「子先于父」，作用域只能延迟解析。
   */
  resolveScope?(): string | undefined;
  /**
   * 这一行在**页面上的位置**（越小越靠前），可选。
   *
   * 模型看到的「第一行」必须是用户看到的「第一行」。而**登记顺序不一定等于页面顺序**：
   * Vue 挂载 keyed 列表时，新行是倒着创建的（实测：清空搜索后依次创建 t6…t1），
   * 于是 `records` 里的顺序和 DOM 反过来 —— 模型说「第一条是 X」，用户看着第一条是 Y。
   * 适配器用这个回调报出 DOM 位置，core 组装快照时按它排一遍（不写就按登记顺序）。
   */
  order?(): number | undefined;
}

/**
 * 页面反馈（S9a）：校验错误 / toast / 状态提示。
 *
 * 为什么要有它：动作失败后，模型现在只能看到「动作执行了，但页面没变」，
 * 而真正的原因（「客户不能为空」）往往写在页面的一段红字里 —— 这段文字不在动作清单里。
 * 反馈是一等公民后，模型才能从「为什么没成」直接找到「该改哪个字段」。
 *
 * 它是**只读数据**：不能用来触发任何操作；写回仍然必须声明成 `v-tool` 动作。
 */
export interface FeedbackDeclaration {
  /** 稳定 id（同一类错误建议用同一个 id，便于去重与面板对照） */
  id: string;
  /** 给人 / 模型看的那句话；可以传函数，快照组装时再读 */
  message: string | (() => string);
  /** 关联的字段（如 `customer` / `amount`）：模型据此决定改哪一个输入 */
  field?: string | (() => string | undefined);
  /** 严重级别；省略按 `error` 处理（表单反馈里最常见） */
  severity?: FeedbackSeverity | (() => FeedbackSeverity | undefined);
  /** 所属作用域（与动作同一条裁剪链） */
  scope?: string;
  /** 动态解析作用域（Vue 子元素先于 v-scope 挂载时用） */
  resolveScope?(): string | undefined;
  /** 页面上的阅读顺序（越小越靠前） */
  order?(): number | undefined;
  /** 来源：显式声明 / ARIA 自动收集 */
  source?: FeedbackSource;
}

/**
 * 可用性判定结果：要么一个布尔，要么「不可用 + 为什么」。
 *
 * 带原因是刻意的：模型的世界观只有「动作清单」。
 * 一个按钮因为「没选中订单」而不能点，如果它只是从清单里消失，
 * 模型就会得出「这个页面没有这个功能」——这正是实测过的失败模式。
 * 有了原因，它就能先去做那个前置动作（选中 / 清空筛选 / 关掉弹窗）。
 */
export type Availability = boolean | {
  available: boolean;
  /** Stable English text for the model. */
  reason?: string;
  /** Catalog key for the same reason in the human-facing UI. */
  reasonKey?: string;
  reasonParams?: Record<string, string | number>;
  /** Application-authored suffix appended after a framework reason. */
  reasonSuffix?: string;
};

/** 把两种写法归一成「有没有 + 为什么」 */
export function readAvailability(value: Availability): {
  available: boolean;
  reason?: string;
  reasonKey?: string;
  reasonParams?: Record<string, string | number>;
  reasonSuffix?: string;
} {
  return typeof value === "boolean" ? { available: value } : value;
}

/**
 * 适配器契约 —— core 只认识这个接口。
 * React / Vue 适配器把框架的生命周期 / 响应式 / ref 翻译成它。
 */
export interface Adapter {
  /** 绑定一个元素，返回解绑函数（随组件卸载调用） */
  bind(binding: Binding): () => void;
  /** 暴露一份状态，返回取消暴露函数 */
  expose(exposure: StateExposure): () => void;
  /** 可选：订阅「世界变了」信号（如路由变化），core 据此作废快照 */
  onInvalidate?(listener: () => void): () => void;
}

/** 合并风险等级：最终 kind = max(原语下限, 声明值)；省略声明按 fail-closed 视为 write */
export function resolveKind(primitive: Primitive, declared?: Kind): Kind {
  const floor = PRIMITIVE_KIND_FLOOR[primitive];
  const value = declared ?? "write";
  return KIND_ORDER[value] >= KIND_ORDER[floor] ? value : floor;
}

/**
 * 确认策略 —— 「这个动作执行前要不要人点头」，只有三档：
 *
 *   none         不问，直接执行
 *   ask          要问；用户答过「总是允许」之后，本会话同形状的动作不再问
 *   ask-always   每次都问，不给「总是允许」
 *
 * 由「声明里的 `confirm` + 风险等级」解析而来，**policy 只认这一个字段**：
 * `confirm` 是显式覆盖，省略则按 `kind` 推导（fail-closed）——
 * 漏标一个危险操作最多是多问几次，绝不会静默执行。
 */
export type Approval = "none" | "ask" | "ask-always";

/**
 * 没写 `confirm` 的动作默认怎么办 —— 应用可以在配置里选（`VITE_AGENT_DEFAULT_APPROVAL`，
 * 或 `createPling({ agent: { config: { defaultApproval } } })`）：
 *
 *   "danger"  （默认）只有 `danger` 才问：read / write 直接执行，不打断用户
 *   "kind"    按风险等级，保守：read 不问 / write 要问 / danger 每次都问
 *             （适合「页面上的写操作都是可逆的小动作、不想被反复打断」的应用；
 *              代价是漏标一个破坏性动作就会静默执行 —— 那就用 `confirm: true` 标回来）
 *
 * 无论选哪个：`confirm` 永远优先，`danger` 永远每次都问。
 */
export type DefaultApproval = "danger" | "kind";

export function resolveApproval(
  kind: Kind,
  confirm?: boolean | "always",
  fallback: DefaultApproval = "danger",
): Approval {
  if (confirm === false) return "none";
  if (confirm === "always") return "ask-always";
  if (confirm === true) return kind === "danger" ? "ask-always" : "ask";
  // danger 永远不给「总是允许」：只能更严不能更松
  if (kind === "danger") return "ask-always";
  if (fallback === "danger") return "none";
  return kind === "read" ? "none" : "ask";
}
