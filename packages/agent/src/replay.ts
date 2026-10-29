import type { Llm, LlmMessage, LlmResult, LlmToolSchema } from "@plingjs/core";
import { toolNameOf } from "./protocol";

/**
 * 假模型（replay）：把「模型该说什么」录成脚本，让循环逻辑可**确定性**测试。
 *
 * 为什么必须有它：
 *   - 真模型不可重复，多步编排 / 错误自愈 / 死循环 / 确认这些逻辑不能靠真模型验
 *   - 带上它，业务方也能给自己的页面写「agent 行为回归测试」，不花 token、不联网
 *
 * 脚本里写的是**页面原始 id**（`approve@order:SO-1001`），驱动会自动转成给模型的合法 name，
 * 顺带把协议层（id ↔ name 映射）也测了。
 */
export interface ReplayCall {
  /** 页面声明里的原始 id */
  tool: string;
  args?: Record<string, unknown>;
  id?: string;
}

export interface ReplayTurn {
  content?: string;
  calls?: readonly ReplayCall[];
}

export interface ReplayLlm extends Llm {
  readonly received: readonly (readonly LlmMessage[])[];
  readonly toolsSeen: readonly (readonly LlmToolSchema[])[];
  readonly turn: number;
  reset(): void;
}

export function createReplayLlm(turns: readonly ReplayTurn[]): ReplayLlm {
  let turn = 0;
  const received: LlmMessage[][] = [];
  const toolsSeen: LlmToolSchema[][] = [];

  const llm = async (messages: LlmMessage[], tools: LlmToolSchema[]): Promise<LlmResult> => {
    received.push(messages.map((message) => ({ ...message })));
    toolsSeen.push(tools.map((tool) => ({ ...tool })));

    const scripted = turns[turn];
    const index = turn;
    turn += 1;
    if (!scripted) return { content: "（replay 脚本已用完）" };

    const toolCalls = (scripted.calls ?? []).map((call, position) => ({
      id: call.id ?? `call_${index}_${position}`,
      name: toolNameOf(call.tool),
      arguments: JSON.stringify(call.args ?? {}),
    }));

    return toolCalls.length ? { content: scripted.content ?? "", toolCalls } : { content: scripted.content ?? "" };
  };

  Object.defineProperties(llm, {
    received: { get: () => received },
    toolsSeen: { get: () => toolsSeen },
    turn: { get: () => turn },
    reset: {
      value: () => {
        turn = 0;
        received.length = 0;
        toolsSeen.length = 0;
      },
    },
  });

  return llm as ReplayLlm;
}
