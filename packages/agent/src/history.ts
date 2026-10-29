import type { Llm, LlmCallOptions, LlmMessage } from "@plingjs/core";
import { countTokens, estimateTokens } from "./tokens";

/**
 * 三层上下文：`system`（永不压缩） / `summary`（已压缩的旧历史） / `recent`（近期原文）。
 *
 * 不是等溢出才处理，而是到水位线（默认 80%）就提前压缩 —— 溢出那一刻已经来不及了。
 * 摘要要保留「目标、已确认的决策、关键事实、未完成事项」，丢掉过程性的啰嗦。
 */

export const MAX_TOOL_RESULT_TOKENS = 1000;

/** 超大结果保留头尾，中间省略 —— 模型需要的是「结果大概长什么样」，不是全部字节 */
export function truncateToolResult(text: string, maxTokens = MAX_TOOL_RESULT_TOKENS): string {
  const total = estimateTokens(text);
  if (total <= maxTokens) return text;

  // 关键：字符 / token 的比重要按内容算 —— 中文 1 字符 ≈ 1 token，英文 4 字符 ≈ 1 token。
  // 固定用 4 会让中文页面的「截断后」仍有 4 倍预算，等于没截。
  const charsPerToken = text.length / Math.max(1, total);
  const halfTokens = Math.floor(maxTokens / 2);
  const headChars = Math.floor(halfTokens * charsPerToken);
  const tailChars = headChars;
  const head = text.slice(0, headChars);
  const tail = text.slice(-tailChars);
  return `${head}\n...[${text.length - headChars - tailChars} characters omitted from the middle]...\n${tail}`;
}

export interface HistoryOptions {
  /** 总预算（context window） */
  maxTokens?: number;
  /** 给模型输出预留的 token */
  reserveForOutput?: number;
  /** 达到可用预算的多少比例触发压缩，默认 0.8 */
  compactRatio?: number;
  /** 压缩时保留最近多少条原文，默认 6 */
  keepRecent?: number;
  /** 单条工具结果的 token 上限 */
  maxToolResultTokens?: number;
  /** 历史变化（append / restore / clear / compact）后的同步回调；M4.7 用它落检查点。 */
  onChange?: () => void;
}

export interface HistorySnapshot {
  summary: string;
  messages: LlmMessage[];
}

const SUMMARIZE_SYSTEM = [
  "Compress this conversation history into a summary that later turns can continue from.",
  "Preserve: user goals and constraints, confirmed decisions, key facts and data, unfinished work, and user preferences or corrections.",
  "Discard: greetings, repeated wording, and resolved details that are no longer relevant.",
  "Output only the summary body, with no prefix.",
].join("\n");

export class History {
  private system: LlmMessage[] = [];
  private summaryText = "";
  private readonly messages: LlmMessage[] = [];
  private readonly maxTokens: number;
  private readonly compactThreshold: number;
  private readonly keepRecent: number;
  private readonly onChange?: () => void;
  readonly maxToolResultTokens: number;

  constructor(options: HistoryOptions = {}) {
    const { maxTokens = 8192, reserveForOutput = 1024, compactRatio = 0.8, keepRecent = 6 } = options;
    this.maxTokens = maxTokens;
    this.compactThreshold = Math.floor((maxTokens - reserveForOutput) * compactRatio);
    this.keepRecent = keepRecent;
    this.maxToolResultTokens = options.maxToolResultTokens ?? MAX_TOOL_RESULT_TOKENS;
    this.onChange = options.onChange;
  }

  setSystem(messages: LlmMessage[]): void {
    this.system = messages;
  }

  append(message: LlmMessage): void {
    this.messages.push(message);
    this.changed();
  }

  /** 保存当前对话（不含每轮重建的 system；system 在恢复后会按新页面重建）。 */
  snapshot(): HistorySnapshot {
    return { summary: this.summaryText, messages: this.messages.map((message) => ({ ...message })) };
  }

  /** 恢复一段检查点。`system` 刻意不存：新页面必须用新的页面快照重新生成。 */
  restore(snapshot: HistorySnapshot): void {
    this.summaryText = snapshot.summary;
    this.messages.length = 0;
    this.messages.push(...snapshot.messages.map((message) => ({ ...message })));
    this.changed();
  }

  /** 组装发给模型的消息。`system` 每轮重建（页面快照在变），所以允许覆盖。 */
  build(system?: LlmMessage[]): LlmMessage[] {
    const parts = [...(system ?? this.system)];
    if (this.summaryText) parts.push({ role: "user", content: `[Conversation history summary]\n${this.summaryText}` });
    parts.push(...this.messages);
    return parts;
  }

  get recent(): readonly LlmMessage[] {
    return this.messages;
  }

  get summary(): string {
    return this.summaryText;
  }

  get budget(): number {
    return this.maxTokens;
  }

  totalTokens(): number {
    return countTokens(this.build());
  }

  needsCompaction(): boolean {
    return this.totalTokens() > this.compactThreshold;
  }

  clear(): void {
    this.messages.length = 0;
    this.summaryText = "";
    this.changed();
  }

  private changed(): void {
    this.onChange?.();
  }

  /** `options` 会透给模型（取消信号）——用户取消时，压缩到一半的这次调用也该停 */
  async compact(llm: Llm, options?: LlmCallOptions): Promise<void> {
    if (this.messages.length <= this.keepRecent) return;

    let split = this.messages.length - this.keepRecent;
    // 切点不能落在 role="tool" 上：否则 assistant(toolCalls) 进了摘要、tool 结果留在 recent，
    // 配对断裂 → 下一次请求被服务端 400 拒绝。
    while (split > 0 && this.messages[split]?.role === "tool") split -= 1;
    if (split <= 0) return;

    const toSummarize = this.messages.slice(0, split);
    const remaining = this.messages.slice(split);

    const response = await llm(
      [
        { role: "system", content: SUMMARIZE_SYSTEM },
        { role: "user", content: `Compress the following conversation history:\n\n${JSON.stringify(toSummarize)}` },
      ],
      [],
      options,
    );

    const merged = [this.summaryText, (response.content ?? "").trim()].filter(Boolean).join("\n\n");
    this.summaryText = merged;
    this.messages.length = 0;
    this.messages.push(...remaining);
    this.changed();
  }
}

export function createHistory(options?: HistoryOptions): History {
  return new History(options);
}
