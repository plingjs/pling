import type { Llm, LlmCallOptions, LlmMessage, LlmResult, LlmToolSchema } from "@plingjs/core";
import { errorFromStatus, LlmError } from "../retry";

/**
 * 真模型适配器：任何 **OpenAI 兼容**的 `/chat/completions` 接口。
 *
 * 为什么是「兼容」而不是「OpenAI」：国内外的第三方服务（DeepSeek、Moonshot、Qwen、
 * 各家自建网关、以及上线的薄 Node 层）基本都实现了这套格式，一个适配器就够了。
 *
 * 职责边界：只负责「把我的消息格式翻译成 HTTP 请求、再把响应翻译回来」。
 * 重试 / 熔断 / 观测在 `createLlmChain` 里叠加，循环那边看到的仍然只是一个函数。
 *
 * 密钥不进代码：配置从 `.env.local` 之类的环境变量读，见案例 012 的 `agent.config.ts`。
 */
export interface OpenAiLlmConfig {
  /** 接口根地址，例：`https://api.openai.com/v1`、`/llm/v1`（走本地代理绕开 CORS） */
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  /** 额外请求头（自定义网关常用） */
  headers?: Record<string, string>;
  /** 合并进请求体的额外字段（各家兼容接口的私有参数） */
  extraBody?: Record<string, unknown>;
  /** 注入传输层：测试用假 fetch，上线可换成薄 Node 层的封装 */
  fetch?: typeof fetch;
  /**
   * 单次请求超时（毫秒），默认 60000；传 0 关闭。
   * 流式时它是**空闲**超时：每收到一段就重新计时，所以长回答不会被总时长掐断。
   */
  timeoutMs?: number;
  /** 允许流式（调用方给了 `onDelta` 时）。有些网关不支持 SSE，设 `false` 强制走整体返回 */
  stream?: boolean;
}

interface OpenAiToolCall {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAiChoice {
  message?: { content?: string | null; tool_calls?: OpenAiToolCall[] };
  delta?: { content?: string | null; tool_calls?: OpenAiToolCall[] };
}

interface OpenAiPayload {
  choices?: OpenAiChoice[];
  error?: { message?: string };
}

/**
 * 有些 OpenAI 兼容模型偶尔不返回原生 `tool_calls`，而是在正文里输出
 * `<｜｜DSML｜｜ invoke ...>` 这样的文本协议。它既不是正常回答，也不能直接显示给用户。
 *
 * 这里只做**兼容兜底**：外层仍以原生 `tool_calls` 为准；只有原生字段缺失时才解析文本。
 * 解析出的调用仍走同一套权限、确认、未知工具处理，不在这里绕过执行边界。
 */
const DSML_MARKER = "<｜｜DSML｜｜";
const DSML_OPEN = String.raw`<\s*[｜|]{2}\s*DSML\s*[｜|]{2}\s*`;
const DSML_CLOSE = String.raw`<\/\s*[｜|]{2}\s*DSML\s*[｜|]{2}\s*`;
const DSML_INVOKE = new RegExp(`${DSML_OPEN}invoke\\b([^>]*)>([\\s\\S]*?)${DSML_CLOSE}invoke\\s*>`, "gi");
const DSML_PARAMETER = new RegExp(
  `${DSML_OPEN}parameter\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)${DSML_CLOSE}parameter\\s*>)`,
  "gi",
);
const DSML_TAG = new RegExp(
  `<\\/?\\s*[｜|]{2}\\s*DSML\\s*[｜|]{2}\\s*[A-Za-z_][\\w-]*(?:\\s[^>]*)?>`,
  "gi",
);

function decodeDsmlEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return named[entity.toLowerCase()] ?? whole;
  });
}

function parseDsmlAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1]!] = decodeDsmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function parseDsmlValue(raw: string, attributes: Record<string, string>): unknown {
  const text = decodeDsmlEntities(raw.trim());
  const asString =
    attributes.string?.trim().toLowerCase() === "true" ||
    attributes.type?.trim().toLowerCase() === "string";
  if (asString) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

interface ParsedDsmlContent {
  content: string;
  toolCalls: { id: string; name: string; arguments: string }[];
}

/** 从正文里取出文本形式的工具调用，并移除协议标记，保留标记外的自然语言。 */
function parseDsmlToolCalls(raw: string): ParsedDsmlContent {
  const toolCalls: { id: string; name: string; arguments: string }[] = [];

  for (const match of raw.matchAll(DSML_INVOKE)) {
    const attributes = parseDsmlAttributes(match[1] ?? "");
    const name = attributes.name?.trim();
    if (!name) continue;

    const args: Record<string, unknown> = {};
    for (const parameter of (match[2] ?? "").matchAll(DSML_PARAMETER)) {
      const parameterAttributes = parseDsmlAttributes(parameter[1] ?? "");
      const parameterName = parameterAttributes.name?.trim();
      if (!parameterName) continue;
      args[parameterName] = parseDsmlValue(parameter[2] ?? "", parameterAttributes);
    }

    toolCalls.push({
      id: `call_dsml_${toolCalls.length}`,
      name,
      arguments: JSON.stringify(args),
    });
  }

  let content = raw.replace(DSML_INVOKE, "").replace(DSML_TAG, "");
  // 不完整的协议片段没有可执行内容，也不能原样当作回答展示。
  const orphan = content.search(new RegExp(DSML_OPEN, "i"));
  if (orphan >= 0) content = content.slice(0, orphan);
  content = content.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  return { content, toolCalls };
}

/** 流式时只暂存「可能是协议开头」的尾部，正常文本仍然立即输出。 */
class DsmlOutputFilter {
  private pending = "";
  private insideProtocol = false;

  constructor(private readonly onText: (text: string) => void) {}

  push(chunk: string): void {
    if (!chunk || this.insideProtocol) return;
    this.pending += chunk;

    const marker = this.pending.indexOf(DSML_MARKER);
    if (marker >= 0) {
      if (marker > 0) this.onText(this.pending.slice(0, marker));
      this.pending = this.pending.slice(marker);
      this.insideProtocol = true;
      return;
    }

    const keep = this.markerPrefixLength();
    if (keep < this.pending.length) {
      this.onText(this.pending.slice(0, this.pending.length - keep));
      this.pending = keep > 0 ? this.pending.slice(-keep) : "";
    }
  }

  finish(): void {
    if (!this.insideProtocol && this.pending) this.onText(this.pending);
    this.pending = "";
  }

  private markerPrefixLength(): number {
    const max = Math.min(this.pending.length, DSML_MARKER.length - 1);
    for (let length = max; length > 0; length -= 1) {
      if (this.pending.endsWith(DSML_MARKER.slice(0, length))) return length;
    }
    return 0;
  }
}

/** 内部消息 → OpenAI 消息。注意 assistant 带工具调用时 content 必须允许为 null。 */
export function toOpenAiMessages(messages: readonly LlmMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return { role: "tool", tool_call_id: message.toolCallId ?? "", content: message.content };
    }
    if (message.role === "assistant" && (message.toolCalls?.length ?? 0) > 0) {
      return {
        role: "assistant",
        content: message.content === "" ? null : message.content,
        tool_calls: message.toolCalls!.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: call.arguments },
        })),
      };
    }
    return { role: message.role, content: message.content };
  });
}

async function readBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "(无法读取响应体)";
  }
}

export function createOpenAiLlm(config: OpenAiLlmConfig): Llm {
  const doFetch = config.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function") {
    throw new Error("createOpenAiLlm: 当前环境没有 fetch，请通过 config.fetch 注入");
  }
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const timeoutMs = config.timeoutMs ?? 60_000;

  return async (
    messages: readonly LlmMessage[],
    tools: readonly LlmToolSchema[],
    callOptions: LlmCallOptions = {},
  ): Promise<LlmResult> => {
    const external = callOptions.signal;
    if (external?.aborted) throw new LlmError("已取消", { aborted: true });

    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    /** 起表 / 续表：流式时每收到一段就重置，超时只对「一直没动静」生效 */
    const arm = (): void => {
      if (timeoutMs <= 0) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
    };
    const onExternalAbort = (): void => controller.abort();
    external?.addEventListener("abort", onExternalAbort, { once: true });
    arm();

    const wantStream = config.stream !== false && typeof callOptions.onDelta === "function";
    const body: Record<string, unknown> = {
      model: config.model,
      messages: toOpenAiMessages(messages),
      ...(config.temperature === undefined ? {} : { temperature: config.temperature }),
      ...(config.maxTokens === undefined ? {} : { max_tokens: config.maxTokens }),
      ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
      ...(wantStream ? { stream: true } : {}),
      ...config.extraBody,
    };

    try {
      const response = await doFetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
          ...config.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) throw errorFromStatus(response.status, await readBody(response));
      return wantStream
        ? await readStream(response, callOptions.onDelta!, arm, tools.length > 0)
        : await readJson(response, tools.length > 0);
    } catch (error) {
      // 区分三种失败：用户取消（不重试、不算故障）/ 超时（可重试）/ 其他网络层失败（可重试）
      if (external?.aborted) throw new LlmError("已取消", { aborted: true, cause: error });
      if (timedOut) {
        throw new LlmError(
          `模型请求超时（${timeoutMs}ms）：检查模型服务是否可达；瞬时超时会按重试预算自动重试`,
          { retryable: true, cause: error },
        );
      }
      if (error instanceof LlmError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new LlmError(
        `模型请求失败：${message}。检查网络与 baseUrl；浏览器被 CORS 拦截时改用同源代理或薄 Node 网关`,
        { retryable: true, cause: error },
      );
    } finally {
      if (timer) clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    }
  };
}

async function readJson(response: Response, allowTextToolCalls: boolean): Promise<LlmResult> {
  let payload: OpenAiPayload;
  try {
    payload = (await response.json()) as OpenAiPayload;
  } catch (error) {
    throw new LlmError("模型返回的不是合法 JSON", { retryable: true, cause: error });
  }

  const message = payload.choices?.[0]?.message;
  if (!message) {
    const detail = payload.error?.message ?? JSON.stringify(payload).slice(0, 300);
    throw new LlmError(`模型返回里没有 choices[0].message: ${detail}`, { retryable: false });
  }

  const toolCalls = (message.tool_calls ?? []).map((call, index) => ({
    id: call.id ?? `call_${index}`,
    name: call.function?.name ?? "",
    arguments: call.function?.arguments ?? "{}",
  }));

  const parsed = parseDsmlToolCalls(message.content ?? "");
  const calls = toolCalls.length > 0 || !allowTextToolCalls ? toolCalls : parsed.toolCalls;

  return {
    content: parsed.content,
    ...(calls.length > 0 ? { toolCalls: calls } : {}),
  };
}

/**
 * 读 SSE 流。
 *
 * 三条实测出来的注意点：
 *   1. 按 `\n` 切、把最后一段留回缓冲 —— 网络分片不保证按行边界，直接解析半行会炸；
 *   2. 工具调用的 `arguments` 是**跨块拼接**的，`id` / `name` 只在第一块里给全；
 *   3. 出错时要 `cancel()` 掉 reader，否则连接挂着不放。
 */
async function readStream(
  response: Response,
  onDelta: (text: string) => void,
  arm: () => void,
  allowTextToolCalls: boolean,
): Promise<LlmResult> {
  const stream = response.body;
  if (!stream) return readJson(response, allowTextToolCalls); // 环境或网关没给流：退回整体解析

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const calls = new Map<number, { id: string; name: string; arguments: string }>();
  let content = "";
  let buffer = "";
  const output = new DsmlOutputFilter(onDelta);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      arm();
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        // 空行、`event:`、`: keep-alive` 之类的注释行都不是数据
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        let payload: OpenAiPayload;
        try {
          payload = JSON.parse(data) as OpenAiPayload;
        } catch (error) {
          throw new LlmError(`流式响应里有一段不是合法 JSON: ${data.slice(0, 120)}`, { retryable: false, cause: error });
        }
        if (payload.error) {
          throw new LlmError(`流式响应返回错误: ${payload.error.message ?? "(无描述)"}`, { retryable: false });
        }

        const delta = payload.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          content += delta.content;
          output.push(delta.content);
        }
        for (const part of delta.tool_calls ?? []) {
          const index = part.index ?? 0;
          const accumulated = calls.get(index) ?? { id: part.id ?? `call_${index}`, name: "", arguments: "" };
          if (part.id) accumulated.id = part.id;
          if (part.function?.name) accumulated.name = part.function.name;
          if (part.function?.arguments) accumulated.arguments += part.function.arguments;
          calls.set(index, accumulated);
        }
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  output.finish();

  const toolCalls = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, call]) => ({ ...call, arguments: call.arguments || "{}" }));

  const parsed = parseDsmlToolCalls(content);
  const finalCalls = toolCalls.length > 0 || !allowTextToolCalls ? toolCalls : parsed.toolCalls;

  return { content: parsed.content, ...(finalCalls.length > 0 ? { toolCalls: finalCalls } : {}) };
}
