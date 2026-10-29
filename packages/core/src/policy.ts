import { ActionError } from "./errors";
import { actionShapeOf } from "./ids";
import type { Approval, HandoffStep, Kind } from "./types";

export interface ConfirmRequest {
  id: string;
  /** 风险等级（面板 / 审计用；**决策不再看它**，看下面的 `approval`） */
  kind: Kind;
  /** 确认策略：由声明里的 `confirm` + `kind` 解析而来（`resolveApproval`） */
  approval: Approval;
  description: string;
  args: Record<string, unknown>;
  /**
   * 这是一条**复合动作**（S6a）时才有的：整条流程要执行的步骤 id（占位符原样带上）。
   *
   * 为什么单独放一个字段，而不是把步骤塞进 `args`：人看到的确认是
   * 「**一次业务操作**」，他要知道的是「这一下会走哪几步」。`args` 是模型给的调用参数，
   * 步骤是开发者写死的编排 —— 两者语义不同，混在一起会让确认面板分不清
   * 「模型填的值」和「框架要走的路」。
   */
  flow?: { steps: readonly string[] };
}

/** true = 批准本次；"always" = 始终允许（会话内）；false = 拒绝 */
export type Confirm = (request: ConfirmRequest) => Promise<boolean | "always">;

/**
 * 这次确认是否允许提供「本次会话内始终允许」。
 *
 * 只有 `ask` 会把快捷授权记入会话；`ask-always` 必须每次都问。
 * 把判断放在 core，避免各适配器按 `kind` 各猜一套。
 */
export function supportsAlwaysAllow(approval: Approval): boolean {
  return approval === "ask";
}

export interface Policy {
  /** 不通过则抛 ActionError（fail-closed） */
  check(request: ConfirmRequest): Promise<void>;
  /**
   * 会话内「始终允许」的集合。存的是**动作形状**（`approve@order:`）而不是具体 id：
   * 元素级 id 太细，按 id 记等于让用户点 42 次。
   */
  alwaysAllow: Set<string>;
}

/**
 * 执行侧（`createExecutor` / 循环）只需要「问一句」这一件事：
 * `alwaysAllow` 是 `createPolicy` 的实现细节，自定义策略不必养一个用不上的集合。
 */
export type ConfirmGate = Pick<Policy, "check">;

/** 人工接力的结果：完成 / 用户取消 / 等超时 */
export type HandoffDecision = "done" | "cancelled" | "timeout";

/** 一次人工接管请求（适配器把它渲染成「请你接管」） */
export interface HandoffRequest {
  id: string;
  description: string;
  /** 为什么需要人来做（原样显示给用户） */
  reason: string;
  args: Record<string, unknown>;
  kind: Kind;
  /** 等待上限（ms） */
  timeout: number;
  /** 分步指引（S17）；省略 = 单步接力 */
  steps?: readonly HandoffStep[];
  /**
   * 适配器切换步骤时通知执行器：把高亮移到当前步骤的目标。
   * 这是同一页面内的视觉协作，不属于会话协议。
   */
  onStep?(index: number): void;
}

/**
 * 人工接力通道。执行器在「动作需要人做」时调用它并**等待**，
 * 直到用户点「我已完成 / 取消」或超时。
 *
 * 和 {@link Confirm} 的区别：
 *   - `Confirm` 回答「允许 agent 做吗？」（批）
 *   - `HandoffGate` 回答「用户做完了吗？」（做）
 */
export type HandoffGate = (request: HandoffRequest) => Promise<HandoffDecision>;

/** 默认等待用户完成人工步骤的时间：5 分钟（验证码 / 本人复核通常够用） */
export const DEFAULT_HANDOFF_TIMEOUT = 300_000;

/**
 * 风险决策（对应参考实现的 PermissionManager）：
 *   none        → 放行
 *   ask         → 已「始终允许」（同形状）→ 放行；否则问用户
 *   ask-always  → 每次都问（不提供「始终允许」）
 * 无确认通道 → 一律拒绝。
 *
 * 这里的「要不要问」**不看 kind**：那是声明期的事（`confirm` 覆盖 + `kind` 兜底，
 * 在 registry/executor 里解析成 `approval`）。决策只看一个字段，规则就不会有两份。
 */
export function createPolicy(confirm: Confirm | null = null): Policy {
  const alwaysAllow = new Set<string>();

  return {
    alwaysAllow,
    async check(request) {
      const { id, approval } = request;
      const shape = actionShapeOf(id);
      if (approval === "none") return;
      if (approval === "ask" && (alwaysAllow.has(shape) || alwaysAllow.has(id))) return;

      if (!confirm) {
        throw new ActionError("PERMISSION_DENIED", `No confirmation channel is configured; denied by default: ${id}`);
      }

      const decision = await confirm(request);
      if (decision === true) return;
      if (decision === "always" && approval === "ask") {
        alwaysAllow.add(shape);
        return;
      }
      throw new ActionError("PERMISSION_DENIED", `The user denied the action: ${id}`);
    },
  };
}
