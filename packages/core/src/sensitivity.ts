/**
 * 敏感数据（S14）：让模型**知道这是什么**，但**看不到具体值**。
 *
 * 为什么需要它：
 *   状态暴露和行数据是页面主动交给模型的。真实业务里这些字段常常是手机号、身份证、
 *   客户姓名、地址 —— 一旦进了 `<page_data>`，它就会跟着提示词发到模型服务商
 *   （还可能留在审计日志、历史摘要里）。「别暴露」不能靠开发者记得少写几个字段：
 *   字段本身往往正是 agent 判断要用的东西。
 *
 * 解法只有一句话：**值出站前换掉，字段名照留**。
 *
 * ```ts
 * fields: {
 *   客户: order.customer,                                  // 照常暴露
 *   手机: pling.sensitive(order.phone),                       // 默认 hidden → "[已隐藏]"
 *   身份证: pling.sensitive(order.idCard, "masked"),          // → "110***********1234"
 *   客户ID: pling.sensitive(order.customerId, "token"),       // → "{{p:1a2b3c4d}}"
 * }
 * ```
 *
 * 四种模式的区别：
 *
 *   hidden  只留字段名。模型知道「这里有手机号」，不知道号码。
 *   masked  保留形状（前 3 后 4）。适合「核对尾号」这类必须看一部分的场景。
 *   token   给一个稳定、不可逆的代号；模型可以把它**原样填进动作参数**，
 *           执行前一刻才由框架换回真值。这是「模型能用、但看不见」的唯一做法。
 *   hint    只给一句类型说明（`"中国手机号"`），连形状都不给。
 *
 * 为什么 default 是 hidden 而不是 masked：默认值是给「没想清楚」的人用的，
 * 这时候少泄露 > 多一点信息。要部分可见就显式写 `"masked"`。
 */

export type SensitivityMode = "hidden" | "masked" | "token" | "hint";

export interface SensitiveOptions {
  mode?: SensitivityMode;
  /** `masked` 的自定义遮罩（拿到原值，返回要展示的字符串） */
  mask?: (value: unknown) => string;
  /** `hint` 的说明文字，例如「中国手机号」 */
  hint?: string;
}

/** 用 `Symbol.for` 而不是类：同一个页面里多份打包产物也能互相识别 */
const MARK = Symbol.for("pling.sensitive");

export interface SensitiveValue<T = unknown> {
  readonly [MARK]: true;
  readonly value: T;
  readonly mode: SensitivityMode;
  readonly mask?: (value: unknown) => string;
  readonly hint?: string;
}

/** 标记一个值：出站（进快照 / 提示词）前必须按 `mode` 脱敏 */
export function sensitive<T>(value: T, options: SensitivityMode | SensitiveOptions = "hidden"): SensitiveValue<T> {
  const opts: SensitiveOptions = typeof options === "string" ? { mode: options } : options;
  return {
    [MARK]: true,
    value,
    mode: opts.mode ?? "hidden",
    ...(opts.mask ? { mask: opts.mask } : {}),
    ...(opts.hint === undefined ? {} : { hint: opts.hint }),
  };
}

export function isSensitive(value: unknown): value is SensitiveValue {
  return typeof value === "object" && value !== null && (value as { [MARK]?: unknown })[MARK] === true;
}

const HIDDEN = "[hidden]";

/** 通用遮罩：够长的保留前 3 后 4（手机 / 卡号一眼能核对尾号），短的只留首字 */
export function maskText(text: string): string {
  if (text.length === 0) return "";
  if (text.length <= 2) return "*".repeat(text.length);
  if (text.length < 8) return `${text[0]}${"*".repeat(text.length - 1)}`;
  return `${text.slice(0, 3)}${"*".repeat(text.length - 7)}${text.slice(-4)}`;
}

/** `masked` 模式下，任意值 → 可读的遮罩字符串 */
export function maskValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return maskText(value);
  if (typeof value === "number" || typeof value === "bigint") return maskText(String(value));
  if (typeof value === "boolean") return HIDDEN;
  if (Array.isArray(value)) return value.map((item) => maskValue(item)).join(", ");
  return HIDDEN;
}

/** 把敏感值渲染成**能进快照**的样子；token 需要 vault，没有就退化成隐藏（fail-closed） */
export function renderSensitive(value: SensitiveValue, vault?: TokenVault): unknown {
  const raw = value.value;
  if (raw === null || raw === undefined) return null;
  switch (value.mode) {
    case "masked":
      return value.mask ? value.mask(raw) : maskValue(raw);
    case "token":
      return vault ? vault.tokenOf(raw) : HIDDEN;
    case "hint":
      return `[${value.hint ?? "hidden"}]`;
    case "hidden":
    default:
      return HIDDEN;
  }
}

/**
 * token 保险箱（一个页面会话一份）。
 *
 * 三个不变量：
 *   1. **同一个值 → 同一个 token**（模型才能跨轮次引用「这个客户」）；
 *   2. token 不可逆：由「会话随机盐 + 值」算出，换一次页面就换一批；
 *   3. 模型引用了不存在的 token 时**不猜**，按未知参数报错（fail-closed）。
 *
 * 它同时是「反向脱敏」的依据：任何出站文本里出现已登记的真值，都会被换回 token。
 */
export interface TokenVault {
  /** 值的稳定代号（同一会话内幂等） */
  tokenOf(value: unknown): string;
  /** 把文本里的已知 token 换回真值（执行参数用） */
  resolve(text: string): string;
  /** 把文本里的真值换成 token（出站结果 / 错误信息用） */
  redact(text: string): string;
  /** 文本里引用了但保险箱里没有的 token（执行前校验用） */
  unknownTokens(value: unknown): string[];
  readonly size: number;
}

const TOKEN_RE = /\{\{p:([0-9a-z]+)\}\}/g;

/** 规范化：同样的业务值必须得到同样的 key（对象按字段顺序序列化） */
function canonical(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return `s:${value}`;
    case "number":
      return `n:${String(value)}`;
    case "boolean":
      return `b:${String(value)}`;
    case "bigint":
      return `i:${String(value)}`;
    default:
      try {
        // 注意别用 `JSON.stringify(value, keys)` 去「排序」：那个参数是**只保留这些键**，
        // 会把嵌套对象里的字段整片丢掉。对象在 JS 里本来就是按插入顺序序列化的。
        return `j:${JSON.stringify(value)}`;
      } catch {
        return `x:${String(value)}`;
      }
  }
}

/** FNV-1a 32 位：够短、够散；盐在闭包里，别人拿不到 token ↔ 值的映射 */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, "0").slice(0, 7);
}

export interface TokenVaultOptions {
  /** 固定盐（测试用；生产默认随机） */
  salt?: string;
}

export function createTokenVault(options: TokenVaultOptions = {}): TokenVault {
  const salt = options.salt ?? Math.random().toString(36).slice(2);
  /** token → 真值（只存在内存里） */
  const raw = new Map<string, unknown>();
  /** canonical → token */
  const assigned = new Map<string, string>();
  /** 真值文本 → token（反向脱敏用；只收长度 ≥ 4 的字符串，避免误伤短词） */
  const literals = new Map<string, string>();
  let pattern: { source: string; size: number } | null = null;

  const tokenOf = (value: unknown): string => {
    const key = canonical(value);
    const existing = assigned.get(key);
    if (existing) return `{{p:${existing}}}`;

    let id = hash(`${salt}|${key}`);
    let suffix = 1;
    // 碰撞时加后缀（不同值撞到同一个 token 比泄露更危险：模型会指错人）
    while (raw.has(id) && canonical(raw.get(id)) !== key) id = hash(`${salt}|${key}|${suffix++}`);

    assigned.set(key, id);
    raw.set(id, value);
    // 短到 2 个字符的值也登记（中文姓名常常就是两字）；纯空白没有意义，跳过
    if (typeof value === "string" && value.trim().length >= 2 && !literals.has(value)) {
      literals.set(value, `{{p:${id}}}`);
      pattern = null;
    }
    return `{{p:${id}}}`;
  };

  const replaceKnown = (text: string): string =>
    text.replace(TOKEN_RE, (match, id: string) => (raw.has(id) ? String(raw.get(id)) : match));

  return {
    tokenOf,
    resolve: replaceKnown,
    redact(text) {
      if (literals.size === 0) return text;
      if (!pattern || pattern.size !== literals.size) {
        // 长值优先：先换「13812341234」，免得被更短的子串抢先
        const keys = [...literals.keys()].sort((a, b) => b.length - a.length).map(escapeRe);
        pattern = { source: keys.join("|"), size: literals.size };
      }
      return text.replace(new RegExp(pattern.source, "g"), (match) => literals.get(match) ?? match);
    },
    unknownTokens(value) {
      const found: string[] = [];
      const walk = (input: unknown): void => {
        if (typeof input === "string") {
          for (const match of input.matchAll(TOKEN_RE)) {
            if (!raw.has(match[1]!)) found.push(match[0]);
          }
          return;
        }
        if (Array.isArray(input)) {
          for (const item of input) walk(item);
          return;
        }
        if (input && typeof input === "object") {
          for (const item of Object.values(input as Record<string, unknown>)) walk(item);
        }
      };
      walk(value);
      return found;
    },
    get size() {
      return raw.size;
    },
  };
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
