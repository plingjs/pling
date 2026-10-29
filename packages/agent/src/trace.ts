import type { LlmMessage, LlmResult, LlmToolCall, LlmToolSchema, Snapshot } from "@plingjs/core";
import { countTokens } from "./tokens";

/** How many model calls a trace keeps. Old entries are dropped first. */
export const DEFAULT_TRACE_CALLS = 20;

export interface AgentTraceOptions {
  /** Maximum calls retained in memory. Defaults to 20. */
  maxCalls?: number;
}

export type AgentTraceStatus = "ok" | "error" | "cancelled";

/**
 * One model request exactly as the loop sent it.
 *
 * This is an inspection record, not an event. It intentionally keeps the full
 * message list and tool schemas because reconstructing them from SessionEvents
 * cannot answer the question developers actually ask: "what did the model see?"
 */
export interface AgentTraceCall {
  seq: number;
  turn: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  status: AgentTraceStatus;
  contextTokens: number;
  messages: readonly LlmMessage[];
  tools: readonly LlmToolSchema[];
  snapshot: Snapshot;
  response?: {
    content: string;
    toolCalls: readonly LlmToolCall[];
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface AgentTraceRecordInput {
  turn: number;
  startedAt: number;
  durationMs: number;
  status: AgentTraceStatus;
  messages: readonly LlmMessage[];
  tools: readonly LlmToolSchema[];
  snapshot: Snapshot;
  result?: LlmResult;
  error?: {
    code: string;
    message: string;
  };
}

export interface AgentTraceRecorder {
  /** Retained calls, oldest first. */
  readonly calls: readonly AgentTraceCall[];
  /** Add one completed request and notify UI subscribers. */
  record(input: AgentTraceRecordInput): AgentTraceCall;
  /** Drop everything, for example when the current conversation is cleared. */
  clear(): void;
  /** Subscribe to additions / clears. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

function copyMessage(message: LlmMessage): LlmMessage {
  return {
    role: message.role,
    content: message.content,
    ...(message.toolCalls ? { toolCalls: message.toolCalls.map((call) => ({ ...call })) } : {}),
    ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
    ...(message.name ? { name: message.name } : {}),
  };
}

function copyTool(tool: LlmToolSchema): LlmToolSchema {
  return {
    type: "function",
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    },
  };
}

/** Bounded in-memory trace used by the built-in inspector. */
export function createAgentTrace(options: AgentTraceOptions = {}): AgentTraceRecorder {
  const maxCalls = Math.max(1, Math.floor(options.maxCalls ?? DEFAULT_TRACE_CALLS));
  const listeners = new Set<() => void>();
  let calls: AgentTraceCall[] = [];
  let seq = 0;

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  return {
    get calls() {
      return calls;
    },
    record(input) {
      const messages = input.messages.map(copyMessage);
      const call: AgentTraceCall = {
        seq: ++seq,
        turn: input.turn,
        startedAt: input.startedAt,
        completedAt: input.startedAt + input.durationMs,
        durationMs: input.durationMs,
        status: input.status,
        contextTokens: countTokens(messages),
        messages,
        tools: input.tools.map(copyTool),
        snapshot: input.snapshot,
        ...(input.result
          ? {
              response: {
                content: input.result.content ?? "",
                toolCalls: (input.result.toolCalls ?? []).map((toolCall) => ({ ...toolCall })),
              },
            }
          : {}),
        ...(input.error ? { error: { ...input.error } } : {}),
      };
      calls = maxCalls === 1 ? [call] : [...calls.slice(-(maxCalls - 1)), call];
      notify();
      return call;
    },
    clear() {
      if (calls.length === 0) return;
      calls = [];
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
