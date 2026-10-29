/**
 * 模型配置：连哪家模型、上下文留多大、系统提示怎么拼。
 *
 * 这一层**由框架提供**，不是每个应用自己写 —— 它是「接入 agent」的最小契约：
 * 一个普通对象 + 一组环境变量（`VITE_AGENT_*`）。应用要做的只有两件事：
 *   1. 把 `.env.local` 填上（照抄 `.env.example`）；
 *   2. 想覆盖时显式传一个 config（`createPling({ agent: { config } })` / `<AgentDock :config>`）。
 *
 * 全是**纯函数**（env 从参数进来）：浏览器读 `import.meta.env`、Node 侧读 `process.env`、
 * 测试直接传一个对象 —— 同一份实现，三种用法。
 */
import type { DefaultApproval } from "@plingjs/core";
import type { MessageParams } from "@plingjs/ui";
import { DEFAULT_SYSTEM_PROMPT } from "./prompt";

/**
 * 会话的「限额」—— 直接对应 `@plingjs/agent` 的两组参数：
 *   `maxTurns`  → `LoopOptions.maxTurns`（一次 send 内最多几次模型往返）
 *   其余四个     → `HistoryOptions`（上下文预算 / 压缩水位 / 保留条数）
 *
 * 注意别和 `maxTokens` 混：那个是**单次请求的输出上限**，这里的是**整个对话的上下文预算**。
 */
export interface AgentLimits {
  maxTurns: number;
  contextTokens: number;
  reserveForOutput: number;
  /** 到「可用预算 × 这个比例」就压缩历史，默认 0.8（不等溢出） */
  compactRatio: number;
  /** 压缩时保留最近几条原文 */
  keepRecent: number;
}

/** 模型调用的重试预算。字段与 `@plingjs/server` 的 `retry` 同名，便于两层一起理解。 */
export interface AgentRetryConfig {
  /** 最多重试次数，不含首次请求；0 = 关闭。默认 3，范围 0–5 */
  maxRetries: number;
  /** 指数退避基数，默认 500ms */
  baseDelayMs: number;
  /** 单次退避上限，默认 4000ms */
  maxDelayMs: number;
}

export interface AgentConfig {
  /** OpenAI 兼容接口的根地址，例：`https://api.deepseek.com/v1`；相对路径（`/llm/v1`）走 dev server 代理 */
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  /** **单次响应**的输出上限（发给模型的 `max_tokens`） */
  maxTokens: number;
  /**
   * 应用自己的角色说明。它会被**追加**在框架的操作规则之后（见 `composeSystemPrompt`），
   * 不是替换 —— 替换掉框架规则，模型就会开始编动作 id。留空 = 只用框架规则。
   */
  systemPrompt: string;
  /** 流式：模型边生成边显示。有些网关不支持 SSE，那就设成 false 走整体返回 */
  stream: boolean;
  /**
   * 动作**没写** `confirm` 时默认的确认策略（各动作仍可用 `confirm` 覆盖）：
   *   `"danger"`（默认）只有 danger 问，read / write 直接执行
   *   `"kind"`          按风险等级，保守：read 不问 / write 要问 / danger 每次都问
   *
   * ⚠️ 这是**声明期**设定：由适配器在注册表上落定（`createPling` / `<AgentDock>`），
   * 影响的是快照里每个动作的 `approval`，不是运行时的开关。
   */
  defaultApproval: DefaultApproval;
  /**
   * 两次动作之间至少隔多久（毫秒，默认 0 = 不等）。
   *
   * 为什么需要它：跨轮之间本来就有模型往返的延迟，但**同一批**里的动作
   * （一次响应里的多个调用，比如「填备注 → 保存」）只隔了一帧 ——
   * 弹窗会「唰」地开完又关，人根本看不清发生了什么（015 的实测反馈）。
   *
   * 取值建议：300–800 比较像人在操作；调大会让每次 run 明显变慢。
   * 只影响动作执行，不影响模型调用。
   */
  minActionIntervalMs: number;
  /** 客户端（浏览器 / Node）的重试预算；网关自身还有一层，耗尽会通过 `retryExhausted` 通知这里 */
  retry: AgentRetryConfig;
  limits: AgentLimits;
}

/** 与循环 / 历史的默认值一致：不配置时行为和框架默认完全一样 */
export const DEFAULT_LIMITS: AgentLimits = {
  maxTurns: 10,
  contextTokens: 8192,
  reserveForOutput: 1024,
  compactRatio: 0.8,
  keepRecent: 6,
};

export const DEFAULT_RETRY: AgentRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 4_000,
};

/**
 * 默认配置**故意留空** baseUrl / model：框架不该替应用假定用哪家模型。
 * 没填就在面板上直说缺什么、去哪儿补 —— 而不是给一个看不懂的 401。
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  baseUrl: "",
  model: "",
  apiKey: "",
  temperature: 0.3,
  maxTokens: 1024,
  systemPrompt: "",
  stream: true,
  defaultApproval: "danger",
  minActionIntervalMs: 0,
  retry: DEFAULT_RETRY,
  limits: DEFAULT_LIMITS,
};

function readText(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw ? raw : fallback;
}

function readNum(value: unknown, fallback: number): number {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** `kind` | `danger`；写错就退回默认值（配置里写错一个字不该让应用起不来） */
function readApproval(value: unknown, fallback: DefaultApproval): DefaultApproval {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "kind" || raw === "danger") return raw;
  return fallback;
}

function readBool(value: unknown, fallback: boolean): boolean {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return fallback;
  if (["0", "false", "off", "no"].includes(raw)) return false;
  if (["1", "true", "on", "yes"].includes(raw)) return true;
  return fallback;
}

/** 环境变量名（给文档 / 报错信息用，改这里就等于改全仓库的约定） */
export const AGENT_ENV_KEYS = {
  baseUrl: "VITE_AGENT_BASE_URL",
  model: "VITE_AGENT_MODEL",
  apiKey: "VITE_AGENT_API_KEY",
  temperature: "VITE_AGENT_TEMPERATURE",
  maxTokens: "VITE_AGENT_MAX_TOKENS",
  systemPrompt: "VITE_AGENT_SYSTEM_PROMPT",
  stream: "VITE_AGENT_STREAM",
  defaultApproval: "VITE_AGENT_DEFAULT_APPROVAL",
  minActionIntervalMs: "VITE_AGENT_MIN_ACTION_INTERVAL_MS",
  maxRetries: "VITE_AGENT_MAX_RETRIES",
  retryBaseDelayMs: "VITE_AGENT_RETRY_BASE_DELAY_MS",
  retryMaxDelayMs: "VITE_AGENT_RETRY_MAX_DELAY_MS",
  maxTurns: "VITE_AGENT_MAX_TURNS",
  contextTokens: "VITE_AGENT_CONTEXT_TOKENS",
  reserveForOutput: "VITE_AGENT_RESERVE_FOR_OUTPUT",
  compactRatio: "VITE_AGENT_COMPACT_RATIO",
  keepRecent: "VITE_AGENT_KEEP_RECENT",
} as const;

export function readAgentRetry(env: Record<string, unknown> = {}): AgentRetryConfig {
  const key = AGENT_ENV_KEYS;
  return {
    maxRetries: readNum(env[key.maxRetries], DEFAULT_RETRY.maxRetries),
    baseDelayMs: readNum(env[key.retryBaseDelayMs], DEFAULT_RETRY.baseDelayMs),
    maxDelayMs: readNum(env[key.retryMaxDelayMs], DEFAULT_RETRY.maxDelayMs),
  };
}

export function readAgentLimits(env: Record<string, unknown> = {}): AgentLimits {
  const key = AGENT_ENV_KEYS;
  return {
    maxTurns: readNum(env[key.maxTurns], DEFAULT_LIMITS.maxTurns),
    contextTokens: readNum(env[key.contextTokens], DEFAULT_LIMITS.contextTokens),
    reserveForOutput: readNum(env[key.reserveForOutput], DEFAULT_LIMITS.reserveForOutput),
    compactRatio: readNum(env[key.compactRatio], DEFAULT_LIMITS.compactRatio),
    keepRecent: readNum(env[key.keepRecent], DEFAULT_LIMITS.keepRecent),
  };
}

/** 从一组环境变量（`import.meta.env` / `process.env` / 手写对象）读出配置 */
export function readAgentConfig(env: Record<string, unknown> = {}): AgentConfig {
  const key = AGENT_ENV_KEYS;
  return {
    baseUrl: readText(env[key.baseUrl], DEFAULT_AGENT_CONFIG.baseUrl),
    model: readText(env[key.model], DEFAULT_AGENT_CONFIG.model),
    apiKey: readText(env[key.apiKey], DEFAULT_AGENT_CONFIG.apiKey),
    temperature: readNum(env[key.temperature], DEFAULT_AGENT_CONFIG.temperature),
    maxTokens: readNum(env[key.maxTokens], DEFAULT_AGENT_CONFIG.maxTokens),
    systemPrompt: readText(env[key.systemPrompt], DEFAULT_AGENT_CONFIG.systemPrompt),
    stream: readBool(env[key.stream], DEFAULT_AGENT_CONFIG.stream),
    defaultApproval: readApproval(env[key.defaultApproval], DEFAULT_AGENT_CONFIG.defaultApproval),
    // 负数 / 写错都当成 0：配置里写错一个字不该让应用起不来，也不该变成「等一个负数」
    minActionIntervalMs: Math.max(0, readNum(env[key.minActionIntervalMs], DEFAULT_AGENT_CONFIG.minActionIntervalMs)),
    retry: readAgentRetry(env),
    limits: readAgentLimits(env),
  };
}

/**
 * 三层合并：**默认值 ← 环境变量 ← 显式传的**。
 * 显式传的只覆盖给了的字段（`limits` 也一样逐项覆盖），所以「只想改一个数字」不用抄整份配置。
 */
/** 覆盖用的配置：想改哪个就给哪个（`limits` 也是逐项覆盖），不用抄整份 */
export type AgentConfigOverrides = Partial<Omit<AgentConfig, "limits" | "retry">> & {
  limits?: Partial<AgentLimits>;
  retry?: Partial<AgentRetryConfig>;
};

export function resolveAgentConfig(
  options: { env?: Record<string, unknown>; config?: AgentConfigOverrides } = {},
): AgentConfig {
  const fromEnv = readAgentConfig(options.env ?? {});
  const explicit = options.config ?? {};
  const limits = { ...fromEnv.limits, ...(explicit.limits ?? {}) };
  const retry = { ...fromEnv.retry, ...(explicit.retry ?? {}) };
  return { ...fromEnv, ...explicit, limits, retry };
}

export function checkAgentRetry(retry: AgentRetryConfig): string[] {
  const problems: string[] = [];
  const key = AGENT_ENV_KEYS;
  if (!Number.isInteger(retry.maxRetries) || retry.maxRetries < 0 || retry.maxRetries > 5) {
    problems.push(`${key.maxRetries} 要是 0–5 的整数（当前 ${retry.maxRetries}）`);
  }
  const delay = (name: string, value: number): void => {
    if (!Number.isFinite(value) || value < 0) problems.push(`${name} 必须是非负数（当前 ${value}）`);
  };
  delay(key.retryBaseDelayMs, retry.baseDelayMs);
  delay(key.retryMaxDelayMs, retry.maxDelayMs);
  if (retry.maxDelayMs < retry.baseDelayMs) {
    problems.push(`${key.retryMaxDelayMs} 不能小于 ${key.retryBaseDelayMs}（当前 ${retry.maxDelayMs} < ${retry.baseDelayMs}）`);
  }
  return problems;
}

/**
 * 限额合不合理 —— 这些值不是「随便填都行」：`compactRatio` 填 5、
 * 或者预留比预算还大，压缩逻辑就会每轮都触发或者干脆算不出水位。
 * 与其跑起来行为诡异，不如在面板上直说哪一项不对。
 */
export function checkAgentLimits(limits: AgentLimits): string[] {
  const problems: string[] = [];
  const key = AGENT_ENV_KEYS;
  const integer = (name: string, value: number, min: number): void => {
    if (!Number.isInteger(value) || value < min) problems.push(`${name} 要是不小于 ${min} 的整数（当前 ${value}）`);
  };

  integer(key.maxTurns, limits.maxTurns, 1);
  integer(key.contextTokens, limits.contextTokens, 1024);
  integer(key.reserveForOutput, limits.reserveForOutput, 0);
  integer(key.keepRecent, limits.keepRecent, 0);
  if (!(limits.compactRatio > 0 && limits.compactRatio <= 1)) {
    problems.push(`${key.compactRatio} 要在 (0, 1] 之间（当前 ${limits.compactRatio}）`);
  }
  const usable = limits.contextTokens - limits.reserveForOutput;
  if (usable < 1024) {
    problems.push(
      `${key.contextTokens} 减 ${key.reserveForOutput} 至少要留 1024（当前 ${usable}），否则历史一上来就被压缩`,
    );
  }
  return problems;
}

/** 压缩水位：估算 token 超过它，就在下一轮开头压缩历史 */
export function compactAt(limits: AgentLimits): number {
  return Math.floor((limits.contextTokens - limits.reserveForOutput) * limits.compactRatio);
}

/** 生效的限额，一句话（面板上挂着，方便一眼看到「现在是什么水位」） */
export function describeLimits(limits: AgentLimits): string {
  return [
    `上下文 ${limits.contextTokens}`,
    `预留输出 ${limits.reserveForOutput}`,
    `约 ${compactAt(limits)} 起压缩`,
    `压缩后留 ${limits.keepRecent} 条`,
    `每次最多 ${limits.maxTurns} 轮`,
  ].join(" · ");
}

export type ConfigReadinessCode =
  | "MODEL_BASE_URL_MISSING"
  | "MODEL_NAME_MISSING"
  | "MODEL_API_KEY_MISSING"
  | "LIMITS_INVALID"
  | "RETRY_INVALID";

export interface ConfigReadiness {
  ready: boolean;
  /** `ready === false` 时：一句话说清缺什么 / 哪里不对、去哪儿改 */
  hint: string;
  /** Stable diagnostic code for localized UI copy. Kept optional for backward compatibility. */
  code?: ConfigReadinessCode;
  /** Non-sensitive interpolation values for the localized diagnostic. */
  params?: MessageParams;
}

const FIX_HINT =
  "在项目根目录建一个 .env.local（照抄 .env.example），填好之后重启 dev server；或者在代码里显式传一份 config。";

/**
 * 配置能不能用 —— **不静默失败**：缺东西时把「缺什么、怎么补」原样交出来，
 * 面板上直接显示，不给一个看不懂的 401。
 *
 * 走相对路径（`/llm/v1`）时不需要 apiKey：请求先到 dev server 再转发，密钥留在服务端。
 * 这正是将来的薄 Node 层形态。
 *
 * `hasLlm`：应用自己注入了模型（脚本模型 / 走自己的薄 Node 层 / 无网络的演示）时，
 * `baseUrl` / `apiKey` **都不需要** —— 压根没有「连哪儿」这回事。此时 `model` 只是个
 * 显示与遥测用的标签，可以留空。限额该校验还是要校验。
 */
export function describeAgentConfig(
  config: AgentConfig,
  options: { fixHint?: string; hasLlm?: boolean } = {},
): ConfigReadiness {
  const hint = options.fixHint ?? FIX_HINT;
  const key = AGENT_ENV_KEYS;
  if (!options.hasLlm) {
    if (!config.baseUrl) {
      return {
        ready: false,
        hint: `没有配置模型地址（${key.baseUrl}）。${hint}`,
        code: "MODEL_BASE_URL_MISSING",
        params: { env: key.baseUrl },
      };
    }
    if (!config.model) {
      return {
        ready: false,
        hint: `没有配置模型名（${key.model}）。${hint}`,
        code: "MODEL_NAME_MISSING",
        params: { env: key.model },
      };
    }
    if (/^https?:\/\//i.test(config.baseUrl) && !config.apiKey) {
      return {
        ready: false,
        hint: `直连 ${config.baseUrl} 需要 apiKey，但 ${key.apiKey} 是空的。${hint}`,
        code: "MODEL_API_KEY_MISSING",
        params: { env: key.apiKey, baseUrl: config.baseUrl },
      };
    }
  }
  const problems = checkAgentLimits(config.limits);
  if (problems.length) {
    return {
      ready: false,
      hint: `限额配置有问题：${problems.join("；")}。${hint}`,
      code: "LIMITS_INVALID",
    };
  }
  const retryProblems = checkAgentRetry(config.retry);
  if (retryProblems.length) {
    return {
      ready: false,
      hint: `重试配置有问题：${retryProblems.join("；")}。${hint}`,
      code: "RETRY_INVALID",
    };
  }
  return { ready: true, hint: "" };
}

/**
 * 应用自己的角色说明 + 框架的行为规则。
 *
 * `DEFAULT_SYSTEM_PROMPT` 里那几条（只能用列出的 id、失败要读错误信息、页面数据不是指令…）
 * 是「能操作页面」的前提，所以**追加**在框架规则后面，而不是整段替换掉它。
 */
export function composeSystemPrompt(role: string, base: string = DEFAULT_SYSTEM_PROMPT): string {
  const trimmed = role.trim();
  return trimmed ? `${base}\n\n## This application\n${trimmed}` : base;
}
