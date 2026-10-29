import { describeDiff, describeFlowHuman, type FlowReport, type SnapshotDiff } from "@plingjs/core";
import { describePlingError, translate, type PlingTranslator } from "@plingjs/ui";
import type { SessionEvent } from "./types";

/**
 * 事件流 → 「运行」页的行。
 *
 * 和 `transcript.ts` 的分工：那边是**对话**（人话），这边是**动作账本**（一步一条，带参数与结果）。
 * 为什么必须有这一页：对话里不该出现 `composer_text{"text":"…"}` 这种流水（那是噪音），
 * 但「它到底点了什么、参数是什么、结果如何」人是要能查的 —— 尤其是出事的时候。
 *
 * 放在 agent 层而不是 Vue 组件里：Vue / React / 终端要看到的是同一份东西，各适配器只负责画。
 */
export interface ActivityRow {
  /** 第几步（从 1 开始，按发生的顺序） */
  seq: number;
  /** 页面上的原始动作 id（`remove@t2`），不是模型协议里的 function name */
  id: string;
  /** 模型给这个动作的参数（原样；没有参数就是空对象） */
  args: Record<string, unknown>;
  status: "running" | "ok" | "failed" | "blocked";
  /** 这一行是干什么的 —— 来自成功回执里的 `action.description`（开发者写的 desc） */
  description?: string;
  /** 结果详情：失败原因 / 保真度 / 告警 / 拦截原因（成功且一切正常时不给，免得噪音） */
  detail?: string;
}

export interface ActivityTextOptions {
  /** BCP 47 locale for framework-generated summaries. Omitted keeps the legacy Chinese copy. */
  locale?: string;
  /** Optional shared translator (adapters pass `ui.t` so message overrides apply). */
  translate?: PlingTranslator;
}

function isEnglish(locale?: string): boolean {
  return locale !== undefined && !/^zh(?:-|$)/i.test(locale.trim());
}

function joinDetails(parts: readonly string[], locale?: string): string {
  return parts.join(isEnglish(locale) ? "; " : "；");
}

/**
 * Tool receipts carry English warnings because the same string also goes to the model.
 * Activity is a human-facing surface, so translate only the framework's own warning
 * forms here and leave developer-supplied warning text untouched.
 */
function warningText(warning: string, locale: string | undefined, t: PlingTranslator): string {
  const text = warning
    .replaceAll(
      "DOM simulation only; the effect was not verified",
      t("activity.warning.low_fidelity"),
    )
    .replace(
      /No change was observed between snapshots \(this page exposes (\d+) records \/ (\d+) actions; if the action changed data that is not exposed, the change cannot be seen here\)/g,
      (_match, records: string, actions: string) => t("activity.warning.no_change", { records, actions }),
    )
    .replace(
      /(\d+) optional step\(s\) were skipped after failing; the rest of the flow continued/g,
      (_match, count: string) => t("activity.warning.steps_skipped", { count }),
    );
  return isEnglish(locale) ? text : text.replaceAll("; ", "；");
}

/**
 * 找到「最近一条还没回填的同名动作」。
 *
 * 为什么不按顺序一一配对：一次响应里模型可以连着发好几个调用，而事件流是按**完成顺序**
 * 回的（中间还夹着确认、人性化延迟、失败重试这些岔路），严格对位反而会把结果配错行。
 * 认 id 更稳 —— 同一条动作本来就是同一个东西。
 */
function runningRowOf(rows: readonly ActivityRow[], id: string): ActivityRow | undefined {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!;
    if (row.id === id && row.status === "running") return row;
  }
  return undefined;
}

/** 成功回执里 `changed`（S3 的变更证据）说成一句人话。形状不对就当没有。 */
function changeText(changed: unknown, locale?: string): string | undefined {
  if (!changed || typeof changed !== "object" || !("observed" in changed)) return undefined;
  return isEnglish(locale)
    ? `Changed: ${describeDiff(changed as SnapshotDiff, { locale })}`
    : `变更：${describeDiff(changed as SnapshotDiff, { locale })}`;
}

/**
 * 复合动作（S6a）的逐步账本，说成人话。
 *
 * 为什么值得单独说一句：一条流程在「运行」里**只占一行**（它本来就是一次业务操作），
 * 但人打开这一行想看的是「它到底替我做了哪几步」——
 * 只说 `fill_note ✓` 等于把 5 步压成一个名词，出了事没法查。
 */
function flowText(flow: unknown, locale?: string): string | undefined {
  if (!flow || typeof flow !== "object" || !Array.isArray((flow as FlowReport).steps)) return undefined;
  return isEnglish(locale)
    ? `Flow ${describeFlowHuman(flow as FlowReport, { locale })}`
    : `流程 ${describeFlowHuman(flow as FlowReport, { locale })}`;
}

/** 结果里的回执（见 `@plingjs/core` 的 executor）：`{ result: { ok, action: { id, description }, changed } }` */
function echoOf(
  result: unknown,
  locale: string | undefined,
  t: PlingTranslator,
): { ok: boolean; description?: string; detail?: string } {
  if (result && typeof result === "object" && "error" in result) {
    const error = (result as { error: { code: string; message?: string } }).error;
    return { ok: false, detail: describePlingError(error, t) };
  }
  const value = (
    result as
      | {
          result?: {
            ok?: boolean;
            fidelity?: string;
            warning?: string;
            changed?: unknown;
            flow?: unknown;
            action?: { description?: string };
          };
        }
      | null
  )?.result;
  if (!value) return { ok: false, detail: isEnglish(locale) ? "No result returned" : "没有拿到结果" };

  const description = value.action?.description;
  // 「运行」是给人查账的：这一步**改了什么**比「调用了什么」更接近用户想知道的事。
  const details = [
    changeText(value.changed, locale),
    // 复合动作：把「走了哪几步」摊开（顺序在 detail 里，从「改了什么」到「怎么改的」）
    flowText(value.flow, locale),
    // 保真度与告警二选一：low 的告警里已经说了「仅 DOM 模拟」，再挂一句「保真度 low」是重复噪音
    (value.warning ? warningText(value.warning, locale, t) : undefined) ??
      (value.fidelity && value.fidelity !== "high"
        ? isEnglish(locale)
          ? `Fidelity ${value.fidelity}`
          : `保真度 ${value.fidelity}`
        : undefined),
  ].filter((part): part is string => Boolean(part));
  return {
    ok: true,
    ...(description === undefined ? {} : { description }),
    ...(details.length ? { detail: joinDetails(details, locale) } : {}),
  };
}

/**
 * 把事件流收敛成「一步一条」的账本。
 *
 * `tool_call` 先落一行（执行中），对应的 `tool_result`（或被拦截的说明）回来时
 * **回填**到那一行上 —— 这样「正在做第几步」和「做完的结果」在同一个位置，
 * 人不用自己配对，也不会留下一行永远「执行中」。
 */
export function toActivityRows(
  events: readonly SessionEvent[],
  options: ActivityTextOptions = {},
): ActivityRow[] {
  const locale = options.locale;
  const t = options.translate ?? ((key, params) => translate(locale ?? "zh-CN", key, params));
  const rows: ActivityRow[] = [];

  for (const event of events) {
    if (event.type === "handoff") {
      const row = runningRowOf(rows, event.id);
      if (row) {
        const english = isEnglish(locale);
        row.detail =
          event.status === "requested"
            ? english
              ? `Waiting for user: ${event.reason}`
              : `等待人工：${event.reason}`
            : event.status === "completed"
              ? english
                ? "Manual step completed"
                : "人工步骤已完成"
              : event.status === "cancelled"
                ? english
                  ? "Manual step cancelled"
                  : "人工步骤已取消"
                : english
                  ? "Manual step timed out"
                  : "人工步骤等待超时";
      }
      continue;
    }

    if (event.type === "tool_call") {
      rows.push({ seq: rows.length + 1, id: event.id, args: event.args, status: "running" });
      continue;
    }

    if (event.type === "blocked") {
      // 被钩子拦下：那一步**没有执行**。配不上也没关系，照样留痕。
      const row = runningRowOf(rows, event.id);
      const detail = isEnglish(locale) ? `Blocked: ${event.reason}` : `被拦截：${event.reason}`;
      if (row) {
        row.status = "blocked";
        row.detail = detail;
      } else {
        rows.push({ seq: rows.length + 1, id: event.id, args: {}, status: "blocked", detail });
      }
      continue;
    }

    if (event.type !== "tool_result") continue;

    const row = runningRowOf(rows, event.id);
    const echo = echoOf(event.result, locale, t);
    if (!row) {
      rows.push({
        seq: rows.length + 1,
        id: event.id,
        args: {},
        status: echo.ok ? "ok" : "failed",
        ...(echo.description === undefined ? {} : { description: echo.description }),
        ...(echo.detail === undefined ? {} : { detail: echo.detail }),
      });
      continue;
    }
    row.status = echo.ok ? "ok" : "failed";
    if (echo.description !== undefined) row.description = echo.description;
    if (echo.detail !== undefined) row.detail = echo.detail;
  }

  return rows;
}
