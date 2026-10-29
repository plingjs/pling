import { ActionError } from "./errors";
import type { Expectation } from "./types";

/**
 * 复合动作（flow，S6a）· **对模型 1 个 tool，内部按顺序走 N 步**。
 *
 * 为什么需要它：现在多步流程是模型自己拼的。018 的「新增订单」= 5 轮模型往返，
 * 每一轮都可能跑偏，中途失败之后模型常常**从第一步重来**（前两步又做了一遍）。
 * 语义上那是**一次业务操作**，闸门上却问了 5 次，审计里也看不出「它刚才在录单」。
 *
 * 这一层把「顺序」从模型手里接过来：
 *
 * ```ts
 * useAgentFlow({
 *   id: "fill_order_note",
 *   desc: "把某个订单的备注改成指定内容（搜索 → 打开编辑弹窗 → 填备注 → 保存）",
 *   params: [{ name: "orderId", label: "订单号" }, { name: "note", label: "新的备注" }],
 *   steps: [
 *     { action: "search_query", args: { text: "{{orderId}}" }, desc: "搜索这个订单" },
 *     { action: "search_enter", args: { key: "Enter" } },
 *     { action: "edit@order:{{orderId}}", desc: "打开编辑弹窗" },
 *     { action: "dialog_note", args: { text: "{{note}}" }, desc: "填上备注" },
 *     { action: "dialog_save", desc: "保存并关闭弹窗" },
 *   ],
 * });
 * ```
 *
 * **步骤引用的是已注册的动作 id**（不是 DOM 选择器、不是新发明的语言）——
 * 于是权限、可用性、审计、探索动作那些机制一条都不需要重新实现，
 * 开发者写的步骤和模型自己点的东西**是同一批动作**。
 *
 * 有三件事是刻意的：
 *   1. **逐步解析**：第 N 步的 id 在执行到它的时候才去注册表里找。
 *      弹窗里的「保存」按钮在弹窗打开之前**根本不存在** —— 一次性校验写不出来。
 *   2. **每步之后落定 + 停一下**：DOM 更新、页面停下（S4b 的 settle）、人眼节奏（可选）。
 *   3. **一处证据**：整条流程取一次「前后 diff」，而不是每一步各取一份 ——
 *      用户关心的是「这次业务操作改了什么」。
 */
export interface FlowStep {
  /**
   * 要执行的**已注册动作 id**。可以带 `{{参数}}` 占位符（`edit@order:{{orderId}}`）。
   *
   * 找不到这个 id（此刻还没注册）→ 这一步失败，流程默认中断并如实说明做到了第几步。
   */
  action: string;
  /**
   * 这一步的参数。两种写法：
   *   · 对象：字符串值里的 `{{参数}}` 会被替换（`{ text: "{{note}}" }`）
   *   · 函数：拿整包参数自己算（`(p) => ({ text: String(p.note).trim() })`）—— 逃生口
   */
  args?: Record<string, unknown> | ((params: Record<string, unknown>) => Record<string, unknown>);
  /** 这一步的成功判据（S4a 的 `Expectation`，**覆盖**该动作自己声明的那个） */
  expect?: Expectation;
  /** 这一步的说明（人话）。会进逐步回执与「最近操作」，给人看 —— 模型不需要猜（它有 `changed`） */
  desc?: string;
  /** 可选步骤：失败不中断流程（默认失败即中断 —— 漏做一步比多问一句危险得多） */
  optional?: boolean;
  /**
   * 这一步失败后，是否允许框架自动重试（`pling_resume_flow` 从失败处继续）。
   *
   * 默认 `false`（fail-closed）。执行**之前**就失败的步骤（参数错 / 动作不存在 /
   * 不可用 / 权限拒绝）不受这条限制 —— 它们还没产生副作用。
   * 执行之后才失败的步骤（`EXECUTION_FAILED` / `EXPECTATION_FAILED`），
   * 只有显式写 `idempotent: true` 才允许自动重试。
   *
   * 典型可标 true 的：打开面板、选择日期、确认保存同一份内容（重复一次不会多出一条）。
   */
  idempotent?: boolean;
}

/** 一步的执行结果（进回执，也给「最近操作」用） */
export interface FlowStepReport {
  /** 第几步，从 1 开始 */
  index: number;
  /** 实际执行的 id（占位符已替换） */
  id: string;
  ok: boolean;
  desc?: string;
  /** 这一步确认过的期望（成立了才有） */
  expect?: string;
  /** 这一步是人工完成的（S5）：带上给人看的原因 */
  handoff?: string;
  /** 失败时的结构化说明：`ACTION_NOT_FOUND：未知动作: …` */
  error?: string;
  /** 可选步骤失败：跳过，不影响整体 */
  skipped?: boolean;
}

/** 一次流程执行的逐步账本 */
export interface FlowReport {
  steps: FlowStepReport[];
  /** 成功（含被跳过的可选步骤）几步 */
  completed: number;
  total: number;
}

/** 框架自动暴露的「继续一条失败流程」动作 id */
export const RESUME_FLOW_ACTION_ID = "pling_resume_flow";

/**
 * 失败回执里的续跑句柄（`STEP_FAILED.error.resume`）。
 *
 * 它只说明「可以继续」；真正的续跑必须调用 `pling_resume_flow`。
 * 句柄只在当前页面会话内有效 —— 刷新 / executor 销毁后自然消失。
 */
export interface FlowResumeInfo {
  /** 这次失败的业务操作句柄，填进 `pling_resume_flow` 的 `runId` */
  runId: string;
  /** 原流程的动作 id（`set_due_date`） */
  flowId: string;
  /** 失败的是第几步（从 1 开始） */
  failedAt: number;
  /** 原流程一共几步 */
  total: number;
  /** 从第几步开始继续（等于 `failedAt`；失败步骤会重试） */
  from: number;
  /** 还没完成的步骤（动作 id；带占位符的原样展示） */
  remaining: string[];
}

/**
 * 复合动作最多套几层。
 *
 * 步骤可以引用另一个复合动作（「录单」里用「选客户」这种小流程很自然），
 * 所以不能一刀切禁止；但要防住把自己写进自己的步骤里 —— 那种情况下
 * 深度上限会先到，报一条能看懂的错，而不是栈溢出。
 */
export const MAX_FLOW_DEPTH = 5;

/** 回执里最多列几步（超长的流程只报数，免得把上下文吃掉） */
export const MAX_FLOW_STEPS_IN_REPORT = 12;

const SLOT = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

/**
 * 把 `{{参数名}}` 换成调用时给的值。
 *
 * 找不到的参数**直接报错**，不替换成空字符串：`edit@order:{{orderId}}` 少传参数时
 * 应该当场说「缺 orderId」，而不是变成一个莫名其妙的 `edit@order:` 再去报「未知动作」——
 * 后者的错误信息会把模型引到完全错误的方向（它会以为页面变了）。
 */
export function renderTemplate(text: string, params: Record<string, unknown>, where = "parameter"): string {
  return text.replace(SLOT, (_all, name: string) => {
    const value = params[name];
    if (value === undefined || value === null || value === "") {
      const known = Object.keys(params);
      throw new ActionError(
        "INVALID_PARAMS",
        `${where} has no value for {{${name}}}. Parameters supplied by this call: ${known.length ? known.join(" / ") : "(none)"}`,
      );
    }
    return String(value);
  });
}

/** 把步骤参数算出来（对象里的字符串值走占位符替换；函数直接调用） */
export function resolveStepArgs(step: FlowStep, params: Record<string, unknown>): Record<string, unknown> {
  if (!step.args) return {};
  if (typeof step.args === "function") return step.args(params);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(step.args)) {
    out[key] = typeof value === "string" ? renderTemplate(value, params, `step ${step.action} parameter "${key}"`) : value;
  }
  return out;
}

/**
 * 一步的记号：`dialog_save✗` / `tip_banner（跳过）`。
 *
 * 「跳过」先判：被跳过的可选步骤 `ok` 是 false（它确实没做成），但那不是失败 ——
 * 写成 ✗ 的话，读账的人（模型尤其）会以为流程断在这一步了。
 */
function stepMark(step: FlowStepReport, locale?: string): string {
  const english = locale !== undefined && !/^zh(?:-|$)/i.test(locale.trim());
  const skipped = english ? "(skipped)" : "（跳过）";
  const manual = english ? "(manual)" : "（人工）";
  const mark = step.skipped ? skipped : step.ok ? "✓" : "✗";
  return `${step.id}${step.handoff ? manual : ""}${mark}`;
}

/** 逐步账本说成一句**给模型看的**话（错误信息用它）：id 才是它的坐标系 */
export function describeFlow(report: FlowReport): string {
  const shown = report.steps.slice(0, MAX_FLOW_STEPS_IN_REPORT).map((step) => stepMark(step, "en")).join(" / ");
  const more = report.steps.length > MAX_FLOW_STEPS_IN_REPORT ? " …" : "";
  return `${report.completed}/${report.total} steps: ${shown}${more}`;
}

/**
 * 逐步账本说成一句**给人看的**话（「运行」那一页用它）：优先用 `desc`。
 *
 * 两个说法共用同一个 `stepMark`：失败 / 跳过的记号不能在两个地方各写一遍
 * （它们迟早会不一致，而「跳过被写成失败」正是最容易误导人的那一种不一致）。
 */
export function describeFlowHuman(report: FlowReport, options: { locale?: string } = {}): string {
  const shown = report.steps
    .slice(0, MAX_FLOW_STEPS_IN_REPORT)
    .map((step) => stepMark({ ...step, id: step.desc ?? step.id }, options.locale))
    .join(" → ");
  const more = report.steps.length > MAX_FLOW_STEPS_IN_REPORT ? " …" : "";
  const english = options.locale !== undefined && !/^zh(?:-|$)/i.test(options.locale.trim());
  return english
    ? `${report.completed}/${report.total} steps: ${shown}${more}`
    : `${report.completed}/${report.total} 步：${shown}${more}`;
}
