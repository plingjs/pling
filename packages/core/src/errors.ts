import type { FlowResumeInfo } from "./flow";

/** 结构化错误码（对应参考实现的 ToolError 体系） */
export type ActionErrorCode =
  | "DUPLICATE_ACTION_ID"
  | "DUPLICATE_STATE_KEY"
  | "DUPLICATE_GUIDE_TARGET"
  | "ACTION_NOT_FOUND"
  | "INVALID_ARGS"
  | "INVALID_PARAMS"
  | "PERMISSION_DENIED"
  | "ACTION_UNAVAILABLE"
  | "EXECUTION_FAILED"
  /** 动作执行了，但声明里的「成功判据」（expect）没等到 —— 见 S4 */
  | "EXPECTATION_FAILED"
  /** 人工接管（S5）：用户取消了这一步 */
  | "HANDOFF_CANCELLED"
  /** 人工接管（S5）：等用户完成超时 */
  | "HANDOFF_TIMEOUT"
  /** 人工接管（S5）：没有接力通道，或用户说做完了但结果没发生 */
  | "HANDOFF_FAILED"
  /**
   * 复合动作的某一步失败了（S6）：流程**已经做了一部分**，错误信息里说清做到第几步、
   * 哪些已经生效 —— 好让模型接着做完，而不是从第一步重来。
   */
  | "STEP_FAILED"
  | "HOOK_BLOCKED"
  | "LOOP_DETECTED";

export interface ErrorResult {
  error: {
    code: ActionErrorCode;
    message: string;
    /** `STEP_FAILED` 且可安全续跑时带上（见 `@plingjs/core` 的 `FlowResumeInfo`） */
    resume?: FlowResumeInfo;
  };
}

export interface OkResult<T = unknown> {
  result: T;
}

/** 执行结果：要么成功，要么结构化错误（永远不抛给上层循环） */
export type ExecResult<T = unknown> = OkResult<T> | ErrorResult;

/** 业务错误：会被转成结构化结果回填给模型，而不是让循环崩溃 */
export class ActionError extends Error {
  readonly code: ActionErrorCode;

  constructor(code: ActionErrorCode, message: string) {
    super(message);
    this.name = "ActionError";
    this.code = code;
  }

  toResult(): ErrorResult {
    return { error: { code: this.code, message: this.message } };
  }
}
