import type { Confirm, ConfirmRequest } from "@plingjs/core";

/**
 * 确认闸门（人机协同的关键件）。
 *
 * 语义（fail-closed 的具体落地）：
 *   - 没有通道 → 交给 core 的 `createPolicy(null)` 直接拒绝（这里不重复实现）
 *   - 超时未答 → **拒绝**（不是同意）
 *   - 认不出的回答 → **拒绝**（不是同意）
 *   - `danger` → 永远只给「本次批准」，不给「始终允许」
 *
 * 还有一个必须记住的工程约束（来自 lesson13 的 agent_bridge）：
 * 确认请求不能走「处理用户消息的同一条串行队列」——循环正阻塞等确认时已占用队列，
 * 确认回复再排队就是死锁。所以确认通道必须是独立入口。
 */
export type ApprovalChannel = (request: ConfirmRequest) => Promise<boolean | "always">;

export interface TimedApprovalOptions {
  channel: ApprovalChannel;
  /** 超时（毫秒），默认 2 分钟 */
  timeoutMs?: number;
  onTimeout?: (request: ConfirmRequest) => void;
  /** 注入定时器，测试里不必真等 */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export function createTimedApproval(options: TimedApprovalOptions): Confirm {
  const {
    channel,
    timeoutMs = 120_000,
    onTimeout,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  } = options;

  return async (request: ConfirmRequest): Promise<boolean | "always"> => {
    let handle: unknown;
    const timedOut = new Promise<false>((resolve) => {
      handle = setTimer(() => {
        onTimeout?.(request);
        resolve(false);
      }, timeoutMs);
    });

    try {
      const decision = await Promise.race([channel(request), timedOut]);
      if (decision === "always" && request.kind === "danger") return true;
      return decision;
    } finally {
      clearTimer(handle);
    }
  };
}

/** 演示 / 测试用：全部批准（danger 也只批本次） */
export const autoApprove: Confirm = async (request) => (request.kind === "danger" ? true : "always");

/** 全部拒绝 */
export const denyAll: Confirm = async () => false;

/**
 * 把「终端里的自由文本」翻译成三态决策 —— 认不出的输入一律拒绝。
 * 浏览器里由按钮承载，这个函数留给终端 / IM 通道复用。
 */
export function parseApprovalReply(text: string): boolean | "always" {
  const normalized = text.trim().toLowerCase();
  if (["批准", "同意", "允许", "y", "yes", "ok", "1"].includes(normalized)) return true;
  if (["始终允许", "always", "a", "3"].includes(normalized)) return "always";
  return false;
}
