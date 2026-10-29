import { getCurrentScope, onScopeDispose } from "vue";
import {
  hasDynamicParams,
  schemaOf,
  type ActionDescriptor,
  type Expectation,
  type Kind,
  type ParamDeclaration,
} from "@plingjs/core";
import { usePling } from "./directive";

/**
 * 函数级动作（S15）：**没有对应 DOM 元素**、由开发者直接注入实现的工具。
 *
 * 为什么需要它：页面上的按钮能被 `v-tool` 登记，但企业里总有一些「没有按钮的活儿」——
 * 批量审批、导出当前筛选结果、同步到 CRM、刷新缓存。以前只能造一个隐藏按钮，
 * 或者干脆做不到；现在给实现就行：
 *
 * ```ts
 * useAgentTool({
 *   id: "approve_all_pending",
 *   desc: "批量通过当前所有待审批订单",
 *   kind: "write",
 *   available: () => pending.value.length > 0 || "当前没有待审批订单",
 *   run: () => approveAll(),
 * });
 * ```
 *
 * 它和 `v-tool` 共用同一条执行管线：参数校验、敏感值还原、确认闸门、
 * 事件审计、「运行」、失败回执全部一致。区别只有两点：
 *   - 没有元素：不参与视口 / 遮挡 / 可见性裁剪，永远在动作清单里；
 *   - 没有目标：存在感高亮自动跳过（没有东西可圈）。
 *
 * 注册随组件生命周期：在 `setup()` 里调用 → 卸载时自动注销；
 * 在组件外调用就一直有效（调用方自己负责收摊，或整个页面一起销毁）。
 */
export interface AgentToolOptions {
  /** 稳定 id（模型调用时使用），全局唯一 */
  id: string;
  /** 一句话说明：模型只靠它判断这个工具是干什么的（必填） */
  desc: string;
  /** 风险等级。省略按 `kind` 推导（fail-closed 视为 write） */
  kind?: Kind;
  /** 确认策略覆盖（同 `v-tool`） */
  confirm?: boolean | "always";
  /** 参数声明（写法与 `v-tool` 的 `params` 相同） */
  params?: ParamDeclaration;
  /**
   * 此刻能不能用。返回字符串 = 不可用的原因 —— 它会原样进模型的动作清单，
   * 所以写成「模型下一步该做什么」最有用（例：「当前没有待审批订单」）。
   */
  available?: () => boolean | string;
  /** 成功判据（S4）：run 之后等它成立；等不到就如实报 EXPECTATION_FAILED */
  expect?: Expectation;
  /** 真正要做的事。拿到的是**校验过、敏感值已还原**的参数 */
  run: (args: Record<string, unknown>) => unknown;
}

export function useAgentTool(options: AgentToolOptions): void {
  const pi = usePling();
  if (!options.desc?.trim()) {
    throw new Error(`useAgentTool「${options.id}」缺少 desc：模型只能靠说明判断它是干什么的`);
  }

  const params = schemaOf(options.params);
  const descriptor: ActionDescriptor = {
    id: options.id,
    primitive: "call",
    description: options.desc,
    kind: options.kind,
    confirm: options.confirm,
    // 实现是开发者注入的，不存在「DOM 模拟不准」的问题
    fidelity: "high",
    ...(params ? { params } : {}),
  };

  const unbind = pi.registry.bind({
    descriptor,
    ...(options.expect ? { expect: options.expect } : {}),
    ...(hasDynamicParams(options.params) ? { resolveParams: () => schemaOf(options.params)! } : {}),
    // 没有元素可检查：只看开发者声明的前置条件。
    isAvailable: () => {
      const declared = options.available?.();
      if (typeof declared === "string") return { available: false, reason: declared };
      if (declared === false) {
        return {
          available: false,
          reason: "This action's preconditions are not met",
          reasonKey: "availability.preconditions",
        };
      }
      return true;
    },
    run: async (args) => options.run(args),
  });

  if (getCurrentScope()) onScopeDispose(unbind);
}
