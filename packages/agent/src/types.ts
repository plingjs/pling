import type { ExecResult } from "@plingjs/core";
import type { MessageParams } from "@plingjs/ui";

/**
 * 会话事件：面板、审计、评测**只消费这一条流**。
 *
 * 之所以把「事件」当契约而不是回调返回值：循环跑在浏览器（Local）还是服务端（Remote）时，
 * 对外看到的东西必须完全一样——面板和业务代码因此不需要知道循环在哪。
 */
export type SessionEvent =
  /** 用户输入回显 */
  | { type: "user"; text: string }
  /** 模型的话：带动作的那一轮是「动手前的说明」（最终回答走 final，不重复发） */
  | { type: "assistant"; text: string }
  /** 流式增量：`text` 是**增量**不是累计；面板把它追加进同一个气泡，收口靠 assistant / final */
  | { type: "assistant_delta"; text: string }
  /** 准备执行某个动作（id 是页面声明里的原始 id） */
  | { type: "tool_call"; id: string; tool: string; args: Record<string, unknown> }
  /** 动作执行结果（成功或结构化错误） */
  | { type: "tool_result"; id: string; tool: string; result: ExecResult }
  /** 被钩子拦截，未执行 */
  | { type: "blocked"; id: string; tool: string; reason: string }
  /** 人工接力（S5）：requested 时面板请用户亲自完成；completed / cancelled / timeout 是结果 */
  | {
      type: "handoff";
      id: string;
      tool: string;
      status: "requested" | "completed" | "cancelled" | "timeout";
      reason: string;
    }
  /** 循环级提示：达到轮数上限、错误预算耗尽、模型空回复被催等 */
  | { type: "notice"; text: string }
  /** 最终回答 */
  | { type: "final"; text: string }
  /** 用户取消 */
  | { type: "cancelled" }
  /** 循环自身失败（模型不可用等），不是动作失败 */
  | {
      type: "error";
      code: string;
      message: string;
      /** Optional catalog key for a fully localized diagnostic. `code` remains authoritative. */
      messageKey?: string;
      params?: MessageParams;
    };

export type SessionEventListener = (event: SessionEvent) => void;
