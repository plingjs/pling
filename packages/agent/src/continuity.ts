import { normalizePage, type ExecResult, type LlmMessage, type PageView, type Registry } from "@plingjs/core";
import type { SessionEvent } from "./types";
import {
  DEFAULT_LEASE_TTL_MS,
  DEFAULT_RESIDENCY_PREFIX,
  DEFAULT_RESIDENCY_TASKS,
  RESIDENCY_VERSION,
  createBrowserContinuityAuthority,
  type ContinuityAuthority,
  type ContinuityRole,
  type ContinuityScope,
  type ContinuityTakeoverMode,
  type ContinuityTaskSummary,
  type ResidencyEnvelope,
} from "./residency";

/**
 * 跨整页导航的会话连续性（M4.7）。
 *
 * 这一层只做三件事：把「上次做到哪」存进一个可替换的同步存储、在下一个 document 里
 * 还原成一段合法的模型历史、把中断的 tool call 补成一条可解释的 tool 结果。
 *
 * 默认实现是 `sessionStorage`：同一标签页、同一 origin 的整页跳转能接上；
 * 新标签页、不同 origin 天然隔离。它不是「把整页 DOM 复制过去」——只保存有界对话检查点。
 */

export const CONTINUITY_VERSION = 1 as const;
export const DEFAULT_CONTINUITY_TTL_MS = 2 * 60 * 60 * 1000;
export const DEFAULT_CONTINUITY_MESSAGES = 20;
export const DEFAULT_CONTINUITY_EVENTS = 60;
export const DEFAULT_CONTINUITY_CHARS = 4000;
export const DEFAULT_CONTINUITY_KEY = "pling:continuity";

export type ContinuityStatus = "active" | "done";

/**
 * 恢复后的入口策略：
 *   ask  显示「继续上次任务」，用户点了才发消息（默认，最安全）
 *   auto 恢复后自动发一条受控的「继续」消息；危险动作仍走确认闸门
 *   off  只恢复上下文，不显示入口、不自动续跑（自定义 UI 自己接管）
 */
export type ContinuityResume = "ask" | "auto" | "off";

export interface ContinuityReturnOptions {
  /** 返回地址；省略时回到「这个任务开始时」的页面。必须是同源地址。 */
  to?: string;
  /** 完成到跳转之间的人性化延迟，默认 500ms。 */
  delayMs?: number;
}

/**
 * 恢复任务完成后的返回策略：
 *   false      不返回（默认）
 *   true       回到任务开始页
 *   string     回到这个同源地址
 *   object     显式指定地址 / 延迟
 */
export type ContinuityReturnSetting = false | true | string | ContinuityReturnOptions;

export interface ContinuityReturnTarget {
  href: string;
  delayMs: number;
}

export interface ContinuitySnapshot {
  version: typeof CONTINUITY_VERSION;
  updatedAt: number;
  status: ContinuityStatus;
  goal?: string;
  page?: PageView;
  /** 这次任务最先开始的地方；跨页任务完成后可回到这里。 */
  startPage?: PageView;
  summary: string;
  messages: LlmMessage[];
  events: SessionEvent[];
}

/** 同步存储：浏览器默认 sessionStorage；测试 / 企业可换成自己的实现。 */
export interface ContinuityStore {
  load(): ContinuitySnapshot | null;
  save(snapshot: ContinuitySnapshot): void;
  clear(): void;
}

export interface ContinuityOptions {
  /**
   * `tab` = 原来的同标签页 MPA 连续性；`browser` = 同 origin 跨标签页共享检查点与租约；
   * `remote` = 跨设备，检查点与租约由宿主注入的 authority 裁决。
   * 默认 `tab`，所以老配置行为不变。
   */
  scope?: ContinuityScope;
  /** 存储 key；同一次 MPA 的所有页面必须一致。默认 `pling:continuity`。 */
  key?: string;
  /** 超过这个时间未更新的检查点不再恢复；默认 2 小时。 */
  ttlMs?: number;
  /** 最多保留多少条完整消息；默认 20。 */
  maxMessages?: number;
  /** 最多保留多少条 UI 事件；默认 60。 */
  maxEvents?: number;
  /** 单条字符串 / 参数的字符上限；默认 4000。 */
  maxChars?: number;
  /** 自定义存储。给了它就不再使用 sessionStorage。 */
  store?: ContinuityStore;
  /** 共享任务 authority；`browser` 省略时使用浏览器实现，`remote` 必须显式提供。 */
  authority?: ContinuityAuthority;
  /** 共享任务的执行租约时长；默认 30 秒。 */
  leaseTtlMs?: number;
  /** `manual` = 只能由用户显式接管；`off` = 只读跟随，不允许接管。默认 manual。 */
  takeover?: ContinuityTakeoverMode;
  /** 任务发现列表上限；默认 20。 */
  maxTasks?: number;
  /** 测试注入时钟。 */
  now?: () => number;
  /** 恢复入口策略；默认 `"ask"`。 */
  resume?: ContinuityResume;
  /**
   * 跨页任务完成后的返回策略；默认关闭。
   * `true` = 回到任务开始页，字符串 = 显式同源地址。
   */
  returnOnDone?: ContinuityReturnSetting;
}

export type ContinuitySetting = false | "tab" | "browser" | ContinuityOptions;

export interface ContinuityCheckpoint {
  goal?: string;
  page?: PageView;
  startPage?: PageView;
  updatedAt: number;
  status: ContinuityStatus;
  /** 上次事件流停在动作执行中：很可能是整页导航把结果截断了。 */
  interrupted: boolean;
}

export interface ContinuityController {
  readonly enabled: boolean;
  /** 当前 continuity 是单标签页 MPA 还是同 origin 跨标签页。 */
  readonly scope: ContinuityScope;
  /** 当前上下文在共享任务里的角色。 */
  readonly role: ContinuityRole;
  /** 当前绑定 / 跟随的任务 id；没有任务时为 null。 */
  readonly sessionId: string | null;
  /** 是否因为另一处接管而失去租约。失去后本页只读。 */
  readonly leaseLost: boolean;
  /** 当前绑定的任务是否已经收口。已完成任务只读，但允许直接开始一个新任务。 */
  readonly completed: boolean;
  /** 本次 document 是否从检查点恢复。 */
  readonly restored: boolean;
  /** 恢复出来的只读摘要；UI 用它显示「继续上次任务」。 */
  readonly checkpoint: ContinuityCheckpoint | null;
  /** 恢复入口策略（未配置 continuity 时为 `"off"`）。 */
  readonly resume: ContinuityResume;
  /**
   * 消费一次「完成后返回」。只有恢复中的任务真正完成、配置了 `returnOnDone` 时返回目标；
   * 每次 document / 会话最多返回一次。内置浮窗会自动调用它。
   */
  claimReturn(): ContinuityReturnTarget | null;
  /**
   * 自动续跑只允许一个入口消费一次。`resume: "auto"` 且存在 active 检查点时返回 true；
   * 第二次调用返回 false。自定义 UI 应在真正发消息前调用它。
   */
  claimAutoResume(): boolean;
  /** 发现当前应用范围内未过期的共享任务。 */
  tasks(): Promise<ContinuityTaskSummary[]>;
  /** 只读跟随另一个任务；不会取得执行权，也不会自动发消息。 */
  follow(sessionId: string): Promise<void>;
  /** 用户显式接管另一个任务；会原子替换旧 owner，旧 owner 收到失权通知。 */
  takeover(sessionId: string): Promise<void>;
  /**
   * 从现有任务复制出一个新任务，并让本页成为新 owner。
   * 原任务的 owner、历史与租约都不受影响；`goal` 省略时沿用原任务目标。
   */
  fork(sessionId: string, options?: { goal?: string }): Promise<string>;
  /** 任务 / 租约 / 角色变化；UI 用它刷新列表或失权提示。 */
  subscribe(listener: () => void): () => void;
  /** 等当前排队中的共享检查点写完（测试与卸载前用）。 */
  flush(): Promise<void>;
  /** 立即写一次检查点（通常不需要手动调；会话会在事件与历史变化时自动写）。 */
  save(): void;
  /** 清空当前存储与内存状态（面板的「清空」会调它）。 */
  clear(): void;
}

export interface ResolvedContinuity {
  scope: ContinuityScope;
  store: ContinuityStore | null;
  authority: ContinuityAuthority | null;
  options: {
    ttlMs: number;
    maxMessages: number;
    maxEvents: number;
    maxChars: number;
    now: () => number;
    resume: ContinuityResume;
    leaseTtlMs: number;
    takeover: ContinuityTakeoverMode;
    maxTasks: number;
    returnOnDone: { to?: string; delayMs: number } | null;
  };
}

function memoryStore(initial: ContinuitySnapshot | null = null): ContinuityStore {
  let current = initial;
  return {
    load: () => current,
    save: (snapshot) => {
      current = snapshot;
    },
    clear: () => {
      current = null;
    },
  };
}

/** 测试 / 自定义宿主用：同一份 store 传给两个 document，就能模拟整页重挂载。 */
export function createMemoryContinuityStore(initial: ContinuitySnapshot | null = null): ContinuityStore {
  return memoryStore(initial);
}

function storageOf(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function createSessionStorageContinuityStore(options: { key?: string } = {}): ContinuityStore {
  const key = options.key ?? DEFAULT_CONTINUITY_KEY;
  return {
    load(): ContinuitySnapshot | null {
      const storage = storageOf();
      if (!storage) return null;
      try {
        const raw = storage.getItem(key);
        return raw ? (JSON.parse(raw) as ContinuitySnapshot) : null;
      } catch {
        return null;
      }
    },
    save(snapshot): void {
      const storage = storageOf();
      if (!storage) return;
      try {
        storage.setItem(key, JSON.stringify(snapshot));
      } catch {
        // 配额 / 隐私模式：连续性失败不能拖垮业务，退化成「这一页没有续接」。
      }
    },
    clear(): void {
      const storage = storageOf();
      if (!storage) return;
      try {
        storage.removeItem(key);
      } catch {
        // 同上：清理失败不影响页面本身。
      }
    },
  };
}

export function resolveContinuity(setting: ContinuitySetting | undefined): ResolvedContinuity | null {
  if (!setting) return null;
  const raw: ContinuityOptions =
    setting === "tab" || setting === "browser" ? { scope: setting } : setting;
  const scope = raw.scope ?? "tab";
  const now = raw.now ?? Date.now;
  const returned = raw.returnOnDone;
  const returnOnDone =
    !returned
      ? null
      : typeof returned === "string"
        ? { to: returned, delayMs: 500 }
        : returned === true
          ? { delayMs: 500 }
          : {
              ...(returned.to ? { to: returned.to } : {}),
              delayMs: Math.min(5_000, Math.max(0, returned.delayMs ?? 500)),
            };
  if (scope === "remote" && !raw.authority) {
    throw new Error("continuity.scope=remote 时必须显式提供 authority（由宿主后端裁决租约）");
  }
  const authority =
    scope === "browser"
      ? (raw.authority ??
        createBrowserContinuityAuthority({
          keyPrefix: raw.key ?? DEFAULT_RESIDENCY_PREFIX,
          ttlMs: raw.ttlMs ?? DEFAULT_CONTINUITY_TTL_MS,
          taskLimit: raw.maxTasks ?? DEFAULT_RESIDENCY_TASKS,
          now,
        }))
      : scope === "remote"
        ? (raw.authority ?? null)
        : null;
  return {
    scope,
    store:
      scope === "tab" ? (raw.store ?? createSessionStorageContinuityStore({ key: raw.key })) : null,
    authority,
    options: {
      ttlMs: raw.ttlMs ?? DEFAULT_CONTINUITY_TTL_MS,
      maxMessages: raw.maxMessages ?? DEFAULT_CONTINUITY_MESSAGES,
      maxEvents: raw.maxEvents ?? DEFAULT_CONTINUITY_EVENTS,
      maxChars: raw.maxChars ?? DEFAULT_CONTINUITY_CHARS,
      now,
      resume: raw.resume ?? "ask",
      leaseTtlMs: Math.max(1_000, raw.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS),
      takeover: raw.takeover === "off" ? "off" : "manual",
      maxTasks: Math.max(1, raw.maxTasks ?? DEFAULT_RESIDENCY_TASKS),
      returnOnDone,
    },
  };
}

function capText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const half = Math.max(0, Math.floor((maxChars - 24) / 2));
  return `${text.slice(0, half)}\n...[${text.length - half * 2} characters omitted]...\n${text.slice(-half)}`;
}

function capValue(value: unknown, maxChars: number): unknown {
  if (typeof value === "string") return capText(value, maxChars);
  if (Array.isArray(value)) return value.map((item) => capValue(item, maxChars));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = capValue(item, maxChars);
    }
    return out;
  }
  return value;
}

function capMessage(message: LlmMessage, maxChars: number): LlmMessage {
  const toolCalls = Array.isArray(message.toolCalls)
    ? message.toolCalls
        .filter(
          (call) =>
            call &&
            typeof call.id === "string" &&
            typeof call.name === "string" &&
            typeof call.arguments === "string",
        )
        .map((call) => ({ ...call, arguments: capText(call.arguments, maxChars) }))
    : undefined;
  return {
    role: message.role,
    content: capText(typeof message.content === "string" ? message.content : "", maxChars),
    ...(toolCalls?.length ? { toolCalls } : {}),
    ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
    ...(message.name ? { name: message.name } : {}),
  };
}

/**
 * 截最近的历史时不能从 `role=tool` 开头：assistant(toolCalls) 被截掉、tool 结果留下，
 * 下一次请求会因配对断裂被服务端 400。遇到 tool 就往回找到发起它的 assistant。
 */
export function trimContinuityMessages(
  messages: readonly LlmMessage[],
  maxMessages = DEFAULT_CONTINUITY_MESSAGES,
  maxChars = DEFAULT_CONTINUITY_CHARS,
): LlmMessage[] {
  const capped = messages
    .filter(
      (message): message is LlmMessage =>
        Boolean(message) && typeof message === "object" && typeof message.role === "string",
    )
    .map((message) => capMessage(message, maxChars));
  if (capped.length <= maxMessages) return capped;
  let start = capped.length - maxMessages;
  while (start > 0 && capped[start]?.role === "tool") start -= 1;
  return capped.slice(start);
}

export function trimContinuityEvents(
  events: readonly SessionEvent[],
  maxEvents = DEFAULT_CONTINUITY_EVENTS,
  maxChars = DEFAULT_CONTINUITY_CHARS,
): SessionEvent[] {
  return events
    .filter((event): event is SessionEvent => Boolean(event) && typeof (event as { type?: unknown }).type === "string")
    .slice(-maxEvents)
    .map((event) => capValue(event, maxChars) as SessionEvent);
}

/**
 * 修补一个被整页导航截断的工具调用。
 *
 * `assistant(toolCalls)` 已经写进历史，但页面在 `tool_result` 回来前就卸载了。直接恢复会让
 * 下一次模型请求缺一条 role=tool。这里补一条**如实说明结果未知**的结果，让模型先观察新页面，
 * 而不是假设动作成功。
 */
export function repairToolPairs(messages: readonly LlmMessage[]): LlmMessage[] {
  const out: LlmMessage[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    if (message.role !== "assistant" || !message.toolCalls?.length) {
      out.push({ ...message });
      continue;
    }

    out.push({ ...message });
    const following: LlmMessage[] = [];
    let cursor = index + 1;
    while (cursor < messages.length && messages[cursor]?.role === "tool") {
      following.push(messages[cursor]!);
      cursor += 1;
    }

    const answered = new Map(following.map((item) => [item.toolCallId, item]));
    for (const call of message.toolCalls) {
      const result = answered.get(call.id);
      if (result) {
        out.push({ ...result });
        answered.delete(call.id);
      } else {
        out.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: "(The page navigated or unmounted while the action was running, so the result of this step is unknown. Inspect the current page first and do not assume the action succeeded.)",
        });
      }
    }
    out.push(...answered.values());
    index = cursor - 1;
  }
  return out;
}

export function checkpointOf(snapshot: ContinuitySnapshot): ContinuityCheckpoint {
  const last = snapshot.events[snapshot.events.length - 1];
  const interrupted =
    last?.type === "tool_call" || (last?.type === "handoff" && last.status === "requested");
  return {
    ...(snapshot.goal ? { goal: snapshot.goal } : {}),
    ...(snapshot.page ? { page: snapshot.page } : {}),
    ...(snapshot.startPage ? { startPage: snapshot.startPage } : {}),
    updatedAt: snapshot.updatedAt,
    status: snapshot.status,
    interrupted,
  };
}

/** 把页面身份还原成一个可跳回的相对地址（只用于同源返回）。 */
export function pageHref(page: PageView | undefined): string | null {
  if (!page?.path) return null;
  let href = page.path;
  if (page.query && Object.keys(page.query).length > 0) {
    const query = new URLSearchParams();
    // 排序后再比较 / 还原：同一组 query 不应因为对象插入顺序不同而被当成另一页。
    for (const [key, value] of Object.entries(page.query).sort(([left], [right]) => left.localeCompare(right))) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        query.set(key, String(value));
      }
    }
    const text = query.toString();
    if (text) href += `${href.includes("?") ? "&" : "?"}${text}`;
  }
  if (page.hash && !href.includes("#")) {
    href += page.hash.startsWith("#") ? page.hash : `#${page.hash}`;
  }
  return href;
}

export function prepareContinuitySnapshot(
  snapshot: ContinuitySnapshot | null,
  options: ResolvedContinuity["options"],
): ContinuitySnapshot | null {
  if (!snapshot || snapshot.version !== CONTINUITY_VERSION) return null;
  if (!Number.isFinite(snapshot.updatedAt) || typeof snapshot.updatedAt !== "number") return null;
  if (!Array.isArray(snapshot.messages) || !Array.isArray(snapshot.events)) return null;
  if (options.now() - snapshot.updatedAt > options.ttlMs) return null;
  const messages = repairToolPairs(
    trimContinuityMessages(snapshot.messages ?? [], options.maxMessages, options.maxChars),
  );
  const goal = typeof snapshot.goal === "string" ? snapshot.goal : undefined;
  const page = normalizePage(snapshot.page);
  const startPage = normalizePage(snapshot.startPage);
  const status: ContinuityStatus = snapshot.status === "done" ? "done" : "active";
  return {
    ...snapshot,
    status,
    ...(goal ? { goal } : { goal: undefined }),
    ...(page ? { page } : { page: undefined }),
    ...(startPage ? { startPage } : { startPage: undefined }),
    messages,
    events: trimContinuityEvents(snapshot.events ?? [], options.maxEvents, options.maxChars),
  };
}

export interface ContinuitySource {
  status(): ContinuityStatus;
  goal(): string | undefined;
  page(): PageView | undefined;
  startPage(): PageView | undefined;
  summary(): string;
  messages(): readonly LlmMessage[];
  events(): readonly SessionEvent[];
}

export function buildContinuitySnapshot(
  source: ContinuitySource,
  options: ResolvedContinuity["options"],
): ContinuitySnapshot {
  const goal = source.goal();
  const page = source.page();
  const startPage = source.startPage();
  return {
    version: CONTINUITY_VERSION,
    updatedAt: options.now(),
    status: source.status(),
    ...(goal ? { goal } : {}),
    ...(page ? { page } : {}),
    ...(startPage ? { startPage } : {}),
    summary: source.summary(),
    messages: trimContinuityMessages(source.messages(), options.maxMessages, options.maxChars),
    events: trimContinuityEvents(source.events(), options.maxEvents, options.maxChars),
  };
}

export function continuitySnapshotOfEnvelope(envelope: ResidencyEnvelope): ContinuitySnapshot {
  return {
    version: CONTINUITY_VERSION,
    updatedAt: envelope.updatedAt,
    status: envelope.status === "done" ? "done" : "active",
    ...(envelope.goal ? { goal: envelope.goal } : {}),
    ...(envelope.page ? { page: envelope.page } : {}),
    ...(envelope.startPage ? { startPage: envelope.startPage } : {}),
    summary: envelope.summary,
    messages: envelope.messages,
    events: envelope.events,
  };
}

export interface EnvelopeHead {
  sessionId: string;
  revision: number;
  ownerId?: string;
  leaseId?: string;
  leaseExpiresAt?: number;
  status?: ResidencyEnvelope["status"];
}

export function continuityEnvelopeOfSnapshot(
  snapshot: ContinuitySnapshot,
  head: EnvelopeHead,
): ResidencyEnvelope {
  return {
    version: RESIDENCY_VERSION,
    sessionId: head.sessionId,
    revision: head.revision,
    ...(head.ownerId ? { ownerId: head.ownerId } : {}),
    ...(head.leaseId ? { leaseId: head.leaseId } : {}),
    ...(head.leaseExpiresAt ? { leaseExpiresAt: head.leaseExpiresAt } : {}),
    status: head.status ?? (snapshot.status === "done" ? "done" : "active"),
    ...(snapshot.goal ? { goal: snapshot.goal } : {}),
    ...(snapshot.page ? { page: snapshot.page } : {}),
    ...(snapshot.startPage ? { startPage: snapshot.startPage } : {}),
    summary: snapshot.summary,
    messages: snapshot.messages,
    events: snapshot.events,
    updatedAt: snapshot.updatedAt,
  };
}

function redactValue(value: unknown, redact: (text: string) => string): unknown {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, redact));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactValue(item, redact);
    }
    return out;
  }
  return value;
}

function redactEvent(event: SessionEvent, redact: (text: string) => string): SessionEvent {
  switch (event.type) {
    case "user":
    case "assistant":
    case "assistant_delta":
    case "notice":
    case "final":
      return { ...event, text: redact(event.text) };
    case "tool_call":
      return { ...event, args: redactValue(event.args, redact) as Record<string, unknown> };
    case "tool_result":
      return { ...event, result: redactValue(event.result, redact) as ExecResult };
    case "blocked":
      return { ...event, reason: redact(event.reason) };
    case "handoff":
      return { ...event, reason: redact(event.reason) };
    case "error":
      return { ...event, message: redact(event.message) };
    default:
      return event;
  }
}

/**
 * 落盘前把已知敏感值换回 token。模型本来只看过 token，恢复时也不该给出真值。
 * 未知来源的用户输入无法靠 vault 识别，这一点在文档里明确说明。
 */
export function redactContinuitySnapshot(
  snapshot: ContinuitySnapshot,
  registry: Registry | undefined,
): ContinuitySnapshot {
  if (!registry) return snapshot;
  const redact = (text: string): string => registry.redactText(text);
  return {
    ...snapshot,
    ...(snapshot.goal ? { goal: redact(snapshot.goal) } : {}),
    ...(snapshot.page ? { page: redactValue(snapshot.page, redact) as PageView } : {}),
    ...(snapshot.startPage
      ? { startPage: redactValue(snapshot.startPage, redact) as PageView }
      : {}),
    summary: redact(snapshot.summary),
    messages: snapshot.messages.map((message) => ({
      ...message,
      content: redact(message.content),
      ...(message.toolCalls
        ? {
            toolCalls: message.toolCalls.map((call) => ({
              ...call,
              arguments: redact(call.arguments),
            })),
          }
        : {}),
    })),
    events: snapshot.events.map((event) => redactEvent(event, redact)),
  };
}
