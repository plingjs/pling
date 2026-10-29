import type { ConfirmRequest } from "@plingjs/core";
import { createTimedApproval, type ApprovalChannel } from "./approval";

/**
 * 确认队列：把「等用户点按钮」这件事变成 UI 可以直接渲染的状态。
 *
 * 分工：
 *   - 队列（本文件，框架无关）：持有当前待确认的请求，提供 `reply()` 供按钮回调
 *   - 渲染（各适配器）：`@plingjs/vue` 的 `<AgentChat>` 只读 `current()`，把按钮事件转成 `reply()`
 *
 * 三个必须记住的点：
 *   1. 超时 → 拒绝（安全默认），并且要把待确认状态清掉，否则 UI 会一直挂着
 *   2. danger 不给「始终允许」（core 的 policy 已经拦一道，这里 UI 也不提供按钮）
 *   3. `reply()` 返回 false 表示「没有待确认的请求」——调用方据此判断这条输入是不是确认回复
 *      （对应 lesson13 里「系统消息不能被误判成用户批准」的教训）
 */
export interface PendingApproval {
  request: ConfirmRequest;
  createdAt: number;
}

export interface ApprovalQueueOptions {
  timeoutMs?: number;
  onTimeout?: (request: ConfirmRequest) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class ApprovalQueue {
  readonly channel: ApprovalChannel;
  private pending: PendingApproval | null = null;
  private resolver: ((decision: boolean | "always") => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;

  constructor(options: ApprovalQueueOptions = {}) {
    this.now = options.now ?? (() => Date.now());

    const base: ApprovalChannel = (request) =>
      new Promise<boolean | "always">((resolve) => {
        this.pending = { request, createdAt: this.now() };
        this.resolver = resolve;
        this.emit();
      });

    this.channel = createTimedApproval({
      channel: base,
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(options.setTimer === undefined ? {} : { setTimer: options.setTimer }),
      ...(options.clearTimer === undefined ? {} : { clearTimer: options.clearTimer }),
      onTimeout: (request) => {
        this.clearPending();
        options.onTimeout?.(request);
      },
    });
  }

  current(): PendingApproval | null {
    return this.pending;
  }

  /** 用户点了按钮：返回 true 表示这条输入被当作确认回复消费掉了 */
  reply(decision: boolean | "always"): boolean {
    if (!this.resolver) return false;
    const resolve = this.resolver;
    this.clearPending();
    resolve(decision);
    return true;
  }

  /**
   * 放弃当前待确认的请求：**按拒绝处理**，不能只是丢掉。
   * 丢掉会让等它的循环永远挂在那里（浏览器里表现为「运行中…」永远不结束）。
   */
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

export function createApprovalQueue(options?: ApprovalQueueOptions): ApprovalQueue {
  return new ApprovalQueue(options);
}
