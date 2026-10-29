/**
 * 观测：**发生得怎么样**（性能 / token / 成本 / 错误率）。
 *
 * 与「审计」的分工（审计 = 该不该发生，可插拔，见 008 的 `@executed`）：
 *   - 审计回答合规问题：谁在什么时候批准了什么
 *   - 观测回答工程问题：花了多少钱、慢在哪、哪一步在报错
 */
export interface LlmCallEvent {
  type: "llm";
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  ok: boolean;
  /** 失败时的 HTTP / 适配器状态码；网络错误为 null */
  status?: number | null;
  /** 失败时：此刻是否还可以自动重试 */
  retryable?: boolean;
  /** 失败时：网关或本层重试预算是否已经用完 */
  retryExhausted?: boolean;
  /** 失败原因（已截断）；不含 prompt / 回复正文 */
  reason?: string;
}

export interface ToolCallEvent {
  type: "tool";
  id: string;
  tool: string;
  /** unknown：模型调了一个页面上不存在的名字（幻觉），用于观测「模型有多常猜 id」 */
  status: "ok" | "error" | "blocked" | "unknown";
  durationMs: number;
}

export interface RetryEvent {
  type: "retry";
  attempt: number;
  delayMs: number;
  reason: string;
  status: number | null;
}

export type TelemetryEvent = LlmCallEvent | ToolCallEvent | RetryEvent;

export interface TelemetrySummary {
  llmCalls: number;
  toolCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostYuan: number;
  avgLlmDurationMs: number;
  llmErrorRate: number;
  retries: number;
  /** 有多少次逻辑模型调用在重试预算耗尽后失败 */
  retryExhausted: number;
}

/** 简化价格表（元 / 百万 token，教学用近似值，上线换成自己的口径） */
export const DEFAULT_PRICE_TABLE: Record<string, { input: number; output: number }> = {
  "glm-4-flash": { input: 0.1, output: 0.1 },
  "glm-4": { input: 0.5, output: 0.5 },
  "deepseek-chat": { input: 1.0, output: 2.0 },
  default: { input: 0.5, output: 1.5 },
};

export interface TelemetryOptions {
  now?: () => number;
  priceTable?: Record<string, { input: number; output: number }>;
}

export class Telemetry {
  readonly events: Array<{ ts: number } & TelemetryEvent> = [];
  private readonly now: () => number;
  private readonly priceTable: Record<string, { input: number; output: number }>;

  constructor(options: TelemetryOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.priceTable = options.priceTable ?? DEFAULT_PRICE_TABLE;
  }

  record(event: TelemetryEvent): void {
    this.events.push({ ts: this.now(), ...event });
  }

  /** 清空统计（面板上的「清空」= 开一段新的会话，计数不该跨段累加） */
  clear(): void {
    this.events.length = 0;
  }

  llmCall(event: Omit<LlmCallEvent, "type">): void {
    this.record({ type: "llm", ...event });
  }

  toolCall(event: Omit<ToolCallEvent, "type">): void {
    this.record({ type: "tool", ...event });
  }

  retry(event: Omit<RetryEvent, "type">): void {
    this.record({ type: "retry", ...event });
  }

  estimateCost(model: string, promptTokens: number, completionTokens: number): number {
    const price = this.priceTable[model] ?? this.priceTable.default!;
    return (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;
  }

  summary(): TelemetrySummary {
    const llm = this.events.filter((event): event is { ts: number } & LlmCallEvent => event.type === "llm");
    const tools = this.events.filter((event) => event.type === "tool");
    const retries = this.events.filter((event) => event.type === "retry").length;
    const retryExhausted = llm.filter((event) => event.retryExhausted).length;

    let promptTokens = 0;
    let completionTokens = 0;
    let durationMs = 0;
    let errors = 0;
    for (const event of llm) {
      promptTokens += event.promptTokens;
      completionTokens += event.completionTokens;
      durationMs += event.durationMs;
      if (!event.ok) errors += 1;
    }

    const model = llm[0]?.model ?? "";
    const cost = this.estimateCost(model, promptTokens, completionTokens);

    return {
      llmCalls: llm.length,
      toolCalls: tools.length,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostYuan: Number(cost.toFixed(6)),
      avgLlmDurationMs: llm.length ? Math.round(durationMs / llm.length) : 0,
      llmErrorRate: llm.length ? Number((errors / llm.length).toFixed(2)) : 0,
      retries,
      retryExhausted,
    };
  }
}
