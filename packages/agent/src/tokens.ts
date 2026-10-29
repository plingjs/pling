import type { LlmMessage } from "@plingjs/core";

/**
 * Token 估算（零依赖近似）。
 *
 * CJK 字符按 1 token/字，其余按 4 字符/token —— 中文界面的页面快照基本全是 CJK，
 * 不区分的话会低估 3~4 倍，预算管理直接失效。
 * 误差 10~20%，只用来判断「离上限还有多远」，不需要精确到个位。
 */
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/u;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (CJK.test(ch)) cjk += 1;
    else other += 1;
  }
  return cjk + Math.ceil(other / 4);
}

/** 单条消息的 token（含 role / tool_call 的固定开销近似） */
export function estimateMessageTokens(message: LlmMessage): number {
  let tokens = 4;
  if (message.content) tokens += estimateTokens(message.content);
  if (message.toolCalls) tokens += estimateTokens(JSON.stringify(message.toolCalls));
  if (message.toolCallId) tokens += 8;
  return tokens;
}

export function countTokens(messages: readonly LlmMessage[]): number {
  return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
}
