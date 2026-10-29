import { DEFAULT_HANDOFF_TIMEOUT, type HandoffDecision, type HandoffGate, type HandoffRequest } from "@plingjs/core";

/**
 * 人工接力队列（S5）：把「请用户亲自完成这一步」变成 UI 可以直接渲染的状态。
 *
 * 和 ApprovalQueue 的分工一样：
 *   - 队列（框架无关）：持有当前待接管的请求，提供 `reply()` 给按钮回调；
 *   - 渲染（各适配器）：`@plingjs/vue` 的 `<AgentChat>` 只读 `current()`，把按钮事件转成 `reply()`。
 *
 * 三个语义：
 *   1. 超时 → `timeout`（不是「完成」）：宁可让模型知道没做成，也不能假装成功；
 *   2. 用户取消 → `cancelled`：循环拿到可行动的错误，不会永远挂着；
 *   3. 同一时刻只有一个接力请求（循环本身是串行的）。
 */
export interface PendingHandoff {
  request: HandoffRequest;
  createdAt: number;
  /** 分步指引里的当前步骤（0 起）；没有 steps 时恒为 0 */
  step: number;
}

export interface HandoffQueueOptions {
  /** 默认等待上限（ms），默认 5 分钟；请求自带 `timeout` 时以请求为准 */
  timeoutMs?: number;
  onTimeout?: (request: HandoffRequest) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class HandoffQueue {
  readonly channel: HandoffGate;
  private pending: PendingHandoff | null = null;
  private resolver: ((decision: HandoffDecision) => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly defaultTimeout: number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  constructor(options: HandoffQueueOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.defaultTimeout = options.timeoutMs ?? DEFAULT_HANDOFF_TIMEOUT;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

    const base: HandoffGate = (request) =>
      new Promise<HandoffDecision>((resolve) => {
        this.pending = { request, createdAt: this.now(), step: 0 };
        this.resolver = resolve;
        request.onStep?.(0);
        this.emit();
      });

    this.channel = async (request) => {
      const timeout = request.timeout ?? this.defaultTimeout;
      let handle: unknown;
      const timedOut = new Promise<HandoffDecision>((resolve) => {
        handle = this.setTimer(() => {
          this.clearPending();
          options.onTimeout?.(request);
          resolve("timeout");
        }, timeout);
      });
      try {
        return await Promise.race([base(request), timedOut]);
      } finally {
        this.clearTimer(handle);
      }
    };
  }

  current(): PendingHandoff | null {
    return this.pending;
  }

  /** 用户点了按钮：返回 true 表示这条输入被当作接力回复消费掉了 */
  reply(done: boolean): boolean {
    if (!this.resolver) return false;
    const resolve = this.resolver;
    this.clearPending();
    resolve(done ? "done" : "cancelled");
    return true;
  }

  /** 分步指引：移动到下一步；已在最后一步 / 没有 steps 时返回 false */
  nextStep(): boolean {
    return this.moveStep(1);
  }

  /** 分步指引：从上一步回来；已在第一步 / 没有 steps 时返回 false */
  previousStep(): boolean {
    return this.moveStep(-1);
  }

  /**
   * 分步指引：按 delta 移动当前步骤。UI 只改「正在讲哪一步」，
   * 真正完成仍然要用户点「全部完成」并过 `expect`。
   */
  moveStep(delta: number): boolean {
    const pending = this.pending;
    const total = pending?.request.steps?.length ?? 0;
    if (!pending || total === 0) return false;
    const next = Math.max(0, Math.min(total - 1, pending.step + delta));
    if (next === pending.step) return false;
    this.pending = { ...pending, step: next };
    pending.request.onStep?.(next);
    this.emit();
    return true;
  }

  /** 放弃当前接力：按取消处理（不能让循环永远挂着） */
  clear(): void {
    if (this.resolver) {
      this.reply(false);
      return;
    }
    this.clearPending();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private clearPending(): void {
    this.pending = null;
    this.resolver = null;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export function createHandoffQueue(options?: HandoffQueueOptions): HandoffQueue {
  return new HandoffQueue(options);
}
