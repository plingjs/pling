import type { ExecResult } from "@plingjs/core";

/**
 * 生命周期钩子 —— 业务方接管 agent 行为的**唯一**干净入口（插件扩展点）。
 *
 *   PreToolUse  动作执行**前**：可拦截（风控 / 合规 / 权限补充 / 二次校验）→ 返回 { blocked, reason }
 *   PostToolUse 动作执行**后**：可**返回一份新结果**（脱敏 / 统计 / 埋点 / 补充上下文）。
 *               返回值会交给下一个钩子，并最终回填给模型 / 事件流；
 *               `undefined` = 不改。
 *
 * 注册返回「移除函数」，插件卸载时调用 —— 没有这个返回值的钩子系统是内存泄漏源。
 */

export interface PreToolUsePayload {
  /** 页面声明里的原始 id */
  id: string;
  /** 给模型的工具名（id 的合法化形式） */
  tool: string;
  args: Record<string, unknown>;
  turn: number;
}

export interface PreToolUseResult {
  blocked?: boolean;
  reason?: string;
}

export interface PostToolUsePayload extends PreToolUsePayload {
  result: ExecResult;
}

export type PreToolUseHandler = (payload: PreToolUsePayload) => void | PreToolUseResult | Promise<void | PreToolUseResult>;
export type PostToolUseHandler = (
  payload: PostToolUsePayload,
) => void | ExecResult | Promise<void | ExecResult>;

export class HookRegistry {
  private readonly pre: PreToolUseHandler[] = [];
  private readonly post: PostToolUseHandler[] = [];

  addPreToolUse(handler: PreToolUseHandler): () => void {
    this.pre.push(handler);
    return () => remove(this.pre, handler);
  }

  addPostToolUse(handler: PostToolUseHandler): () => void {
    this.post.push(handler);
    return () => remove(this.post, handler);
  }

  /** 按注册顺序执行；任一返回 blocked 即中断（后续钩子不再跑） */
  async firePreToolUse(payload: PreToolUsePayload): Promise<{ blocked: boolean; reason?: string }> {
    for (const handler of this.pre) {
      const result = await handler(payload);
      if (result && result.blocked) return { blocked: true, reason: result.reason ?? "Blocked by a hook" };
    }
    return { blocked: false };
  }

  /**
   * 按注册顺序执行；钩子可以返回新结果来替换当前结果。
   *
   * 为什么必须把「替换」做成返回值而不是让钩子改 `payload.result`：
   * 后者只是改了一个局部对象的属性，循环手里的 `result` 变量不会变 ——
   * 文档说「可改写结果」，实际却静默丢失。这里把链式结果显式返回，
   * 下一个钩子和最终回执看到的都是最新那份。
   */
  async firePostToolUse(payload: PostToolUsePayload): Promise<ExecResult> {
    let result = payload.result;
    for (const handler of this.post) {
      const next = await handler({ ...payload, result });
      if (next !== undefined) result = next;
    }
    return result;
  }
}

function remove<T>(list: T[], item: T): void {
  const index = list.indexOf(item);
  if (index >= 0) list.splice(index, 1);
}
