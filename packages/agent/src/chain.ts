import type { Llm, LlmCallOptions, LlmMessage, LlmResult, LlmToolSchema } from "@plingjs/core";
import { CircuitBreaker, isRetryable, LlmError, withRetry, type RetryInfo } from "./retry";
import { countTokens } from "./tokens";
import type { Telemetry } from "./telemetry";

/**
 * 生产级 LLM 调用链：`traced( withRetry( base ) )`。
 *
 * 装饰器层层包装的意义：循环拿到的仍然只是一个 `(messages, tools) => result` 的函数，
 * 重试、熔断、观测全部**透明**叠加 —— 循环代码一行都不用改。
 */
export interface LlmChainOptions {
  base: Llm;
  /** 观测用的模型名（价格表按它查） */
  model: string;
  telemetry: Telemetry;
  breaker?: CircuitBreaker;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface LlmChain {
  llm: Llm;
  breaker: CircuitBreaker;
}

export function createLlmChain(options: LlmChainOptions): LlmChain {
  const breaker = options.breaker ?? new CircuitBreaker({ now: options.now });
  const now = options.now ?? (() => Date.now());

  const retried = withRetry(
    (messages: LlmMessage[], tools: LlmToolSchema[], callOptions?: LlmCallOptions) =>
      options.base(messages, tools, callOptions),
    {
      maxRetries: options.maxRetries,
      baseDelayMs: options.baseDelayMs,
      maxDelayMs: options.maxDelayMs,
      breaker,
      sleep: options.sleep,
      onRetry: (info: RetryInfo) => options.telemetry.retry({ ...info }),
    },
  );

  const llm: Llm = async (messages, tools, callOptions) => {
    const startedAt = now();
    try {
      const result = await retried(messages, tools, callOptions);
      options.telemetry.llmCall({
        model: options.model,
        promptTokens: countTokens(messages),
        completionTokens: estimateCompletionTokens(result),
        durationMs: now() - startedAt,
        ok: true,
      });
      return result;
    } catch (error) {
      options.telemetry.llmCall({
        model: options.model,
        promptTokens: countTokens(messages),
        // 流式时可能已经吐了一部分，但这里只记「这次调用整体失败了」——不计部分输出，免得成本数字虚高
        completionTokens: 0,
        durationMs: now() - startedAt,
        ok: false,
        status: error instanceof LlmError ? error.status : null,
        retryable: isRetryable(error),
        retryExhausted: (error as { retryExhausted?: boolean } | null)?.retryExhausted === true,
        reason: (error instanceof Error ? error.message : String(error)).slice(0, 300),
      });
      throw error;
    }
  };

  return { llm, breaker };
}

export function estimateCompletionTokens(result: LlmResult): number {
  let text = result.content ?? "";
  for (const call of result.toolCalls ?? []) text += " " + call.arguments;
  return countTokens([{ role: "assistant", content: text }]);
}
