/** 模型返回的一次工具调用 */
export interface LlmToolCall {
  id: string;
  name: string;
  /** 模型给的参数，通常是 JSON 字符串——可能非法，必须容错 */
  arguments: string;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** role=assistant 发起工具调用时 */
  toolCalls?: LlmToolCall[];
  /** role=tool 时对应哪个调用 */
  toolCallId?: string;
  name?: string;
}

/** 喂给模型的工具声明（OpenAI function-calling 格式） */
export interface LlmToolSchema {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
}

export interface LlmResult {
  content?: string;
  toolCalls?: LlmToolCall[];
}

/**
 * 单次调用的附加能力（都是可选的，实现可以完全忽略）。
 *
 * 放在第三个参数而不是塞进 `LlmResult`：这两件事都是**过程**（取消、边生成边给），
 * 而不是「调用结果」。第三个参数可选，所以老的实现（`(messages, tools) => …`）
 * 一行都不用改就是合法的 `Llm`。
 */
export interface LlmCallOptions {
  /** 取消信号：适配器应该透给传输层（fetch 的 `signal`），让「停止」真的能停住 */
  signal?: AbortSignal;
  /**
   * 流式回调：每产生一段文本就调一次，`text` 是**增量**（不是累计）。
   * 不给它就应该走非流式路径 —— 有些网关不支持 SSE。
   */
  onDelta?: (text: string) => void;
}

/** 模型接口：测试期可用假实现，上线时接薄 Node 层 */
export type Llm = (messages: LlmMessage[], tools: LlmToolSchema[], options?: LlmCallOptions) => Promise<LlmResult>;
