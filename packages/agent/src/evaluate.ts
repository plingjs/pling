import type { HookRegistry } from "./hooks";
import type { SessionEvent } from "./types";

/**
 * 评测：没有评测，优化无从谈起。
 *
 * 过程与结果两类断言：
 *   expectIncludes  —— 最终回答里必须有某个事实
 *   expectTools     —— 该调用到的动作必须被调用（任务真的做了）
 *   expectNotTools  —— **不该**被调用的动作一次都不能出现
 *                      （正好表达 pi 的两条信条：未声明不可操作、危险动作要被拦住）
 *   maxToolErrors   —— 不许靠一路报错撞到答案
 *   verify          —— 动作之后，真实业务状态 / 路由必须到位
 *
 * 每个用例之间必须 reset —— 评测语义是「用例之间无状态」，共享历史会让结果不可复现。
 */
export interface EvalCase {
  name?: string;
  input: string;
  expectIncludes?: readonly string[];
  /** 期望被调用到的动作 id（页面原始 id） */
  expectTools?: readonly string[];
  expectNotTools?: readonly string[];
  /**
   * 允许出现多少次工具错误，省略 = 不限制。
   *
   * 评测一条正常任务时通常应写 `0`：模型可以换路，但不该靠一路报错撞到正确答案。
   */
  maxToolErrors?: number;
  /**
   * 最终业务状态的检查。动作调用对了不等于事情做成了：
   * 这里读的是页面背后的真实数据 / 路由，而不是 agent 自己的说法。
   */
  verify?: () => boolean | Promise<boolean>;
}

/** 由宿主提供的读数；评测只透传，不假设一定运行在本地循环上 */
export interface EvalMetrics {
  /** 这一条任务用掉几轮模型往返 */
  turns?: number;
  [key: string]: number | undefined;
}

export interface EvalCaseResult {
  name: string;
  passed: boolean;
  answer: string;
  toolsUsed: string[];
  toolErrors: number;
  durationMs: number;
  /** 人话版的失败原因；通过了就是空数组 */
  failures: string[];
  metrics?: EvalMetrics;
  error?: string;
}

export interface EvalReport {
  results: EvalCaseResult[];
  passed: number;
  failed: number;
  total: number;
  passRate: number;
  durationMs: number;
}

export interface EvaluateOptions {
  run: (input: string) => Promise<string>;
  /** 借宿主的钩子注册表采集「调用了哪些动作」（跑完自动卸载） */
  hooks: HookRegistry;
  cases: readonly EvalCase[];
  /** 用例之间清理业务状态 / 历史；可以返回 Promise */
  reset?: () => void | Promise<void>;
  /** 每次 run 之后的读数（轮数、调用数等），随结果一起进报告 */
  measure?: () => EvalMetrics;
  /**
   * 会话事件源（通常是 `session.events`）。给了它，评测能看见未知动作 / 被拦截这类
   * 不会经过执行器钩子的失败；不给则退回到 PostToolUse 统计。
   */
  events?: () => readonly SessionEvent[];
}

export async function runEvaluation(options: EvaluateOptions): Promise<EvalReport> {
  const startedAt = Date.now();
  const called: string[] = [];
  const toolErrors: Array<{ id: string; code: string; message: string }> = [];
  const offPre = options.hooks.addPreToolUse(({ id }) => {
    called.push(id);
  });
  const offPost = options.hooks.addPostToolUse(({ id, result }) => {
    if (!("error" in result)) return;
    toolErrors.push({ id, code: result.error.code, message: result.error.message });
  });

  try {
    const results: EvalCaseResult[] = [];
    for (const testCase of options.cases) {
      const caseStartedAt = Date.now();
      await options.reset?.();
      const before = called.length;
      const errorsBefore = toolErrors.length;
      const eventsBefore = options.events?.().length ?? 0;

      let answer = "";
      let error: string | undefined;
      try {
        answer = await options.run(testCase.input);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }

      const toolsUsed = [...new Set(called.slice(before))];
      const caseErrors = options.events
        ? options.events().slice(eventsBefore).flatMap((event) =>
            event.type === "tool_result" && "error" in event.result
              ? [{ id: event.id, code: event.result.error.code, message: event.result.error.message }]
              : [],
          )
        : toolErrors.slice(errorsBefore);
      const failures: string[] = [];
      const passIncludes = (testCase.expectIncludes ?? []).every((keyword) => answer.includes(keyword));
      const passTools = (testCase.expectTools ?? []).every((id) => toolsUsed.includes(id));
      const passNotTools = !(testCase.expectNotTools ?? []).some((id) => toolsUsed.includes(id));
      if (error) failures.push(`执行失败：${error}`);
      if (!passIncludes) {
        const missing = (testCase.expectIncludes ?? []).filter((keyword) => !answer.includes(keyword));
        failures.push(`回答缺少：${missing.join("、")}（实际回答：${answer || "（空）"}）`);
      }
      if (!passTools) {
        const missing = (testCase.expectTools ?? []).filter((id) => !toolsUsed.includes(id));
        failures.push(`没有调用：${missing.join("、")}（实际：${toolsUsed.join(" → ") || "无动作"}）`);
      }
      if (!passNotTools) {
        const forbidden = (testCase.expectNotTools ?? []).filter((id) => toolsUsed.includes(id));
        failures.push(`不该调用：${forbidden.join("、")}`);
      }
      if (testCase.maxToolErrors !== undefined && caseErrors.length > testCase.maxToolErrors) {
        failures.push(
          `工具错误 ${caseErrors.length} 次，超过上限 ${testCase.maxToolErrors}：` +
            caseErrors.map((item) => `${item.id}=${item.code}`).join("、"),
        );
      }
      if (testCase.verify) {
        try {
          if (!(await testCase.verify())) failures.push("业务状态不符合预期（verify 返回 false）");
        } catch (caught) {
          failures.push(`业务状态检查抛错：${caught instanceof Error ? caught.message : String(caught)}`);
        }
      }

      const metrics = options.measure?.();

      results.push({
        name: testCase.name ?? testCase.input,
        passed: failures.length === 0,
        answer,
        toolsUsed,
        toolErrors: caseErrors.length,
        durationMs: Date.now() - caseStartedAt,
        failures,
        ...(metrics ? { metrics } : {}),
        ...(error ? { error } : {}),
      });
    }

    const passed = results.filter((result) => result.passed).length;
    return {
      results,
      passed,
      failed: results.length - passed,
      total: results.length,
      passRate: results.length ? Number((passed / results.length).toFixed(2)) : 0,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    offPre();
    offPost();
  }
}

export function formatReport(report: EvalReport): string {
  const lines: string[] = [];
  for (const result of report.results) {
    const metrics = result.metrics ? ` · ${formatMetrics(result.metrics)}` : "";
    lines.push(
      `${result.passed ? "✅" : "❌"} ${result.name}  [${result.toolsUsed.join(" → ") || "无动作"}]` +
        `${metrics} · ${result.durationMs}ms`,
    );
    for (const failure of result.failures) lines.push(`   · ${failure}`);
  }
  lines.push(
    `通过 ${report.passed}/${report.total}（${Math.round(report.passRate * 100)}%）` +
      `${report.failed ? `，失败 ${report.failed}` : ""} · ${report.durationMs}ms`,
  );
  return lines.join("\n");
}

function formatMetrics(metrics: EvalMetrics): string {
  return Object.entries(metrics)
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
}
