import type { SessionEvent } from "./types";
import { describePlingError, translate, type PlingTranslator } from "@plingjs/ui";

/**
 * 事件流 → 展示行。
 *
 * 放在 agent 层而不是某个 UI 组件里：Vue / React / 终端 / IM 通道要看到的是同一份东西，
 * 各适配器只负责把它画出来。渲染细节（颜色、折叠）不属于这里。
 *
 * 流式是**在这里收口**的：面板只管把 `streaming` 的那一行画成「还在长」，
 * 不需要知道「增量要追加、收口要替换」这套规则 —— 换个 UI 也不用重写一遍。
 */
export type TranscriptLine =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; streaming?: boolean }
  | { kind: "final"; text: string }
  | { kind: "notice"; text: string }
  | { kind: "cancelled"; text: string }
  | { kind: "error"; text: string }
  /** 被钩子拦下的动作（不算「工具流水」，对话里也要看得见：那是「没执行」的说明） */
  | { kind: "blocked"; id: string; text: string }
  | { kind: "call"; id: string; tool: string; args: string }
  | { kind: "result"; id: string; ok: boolean; detail: string };

/**
 * `toTranscriptLines` 的选项。
 *
 * `tools`：要不要把**动作流水**（`call` / `result`）也画进来。
 * 对话窗口默认**不画**（模型的每次输入、每个 ok 都是噪音：用户要的是「它在动」的感觉），
 * 详细的动作、参数、结果看「运行」那一页（`toActivityRows`）。
 * 换一个 UI 想全看（终端 / 调试器）就传 `tools: true`。
 */
export interface TranscriptOptions {
  tools?: boolean;
  /** Locale for framework-generated lines; omitted keeps the legacy Chinese copy. */
  locale?: string;
  /** Optional shared translator (adapters pass `ui.t` so message overrides apply). */
  translate?: PlingTranslator;
}

function isEnglish(locale?: string): boolean {
  return locale !== undefined && !/^zh(?:-|$)/i.test(locale.trim());
}

export function toTranscriptLine(event: SessionEvent, options: TranscriptOptions = {}): TranscriptLine {
  const english = isEnglish(options.locale);
  const t = options.translate ?? ((key, params) => translate(options.locale ?? "zh-CN", key, params));
  switch (event.type) {
    case "user":
      return { kind: "user", text: event.text };
    case "assistant":
      return { kind: "assistant", text: event.text };
    case "assistant_delta":
      return { kind: "assistant", text: event.text, streaming: true };
    case "final":
      return { kind: "final", text: event.text };
    case "notice":
      return { kind: "notice", text: event.text };
    case "cancelled":
      return { kind: "cancelled", text: english ? "Cancelled" : "已取消" };
    case "error":
      return { kind: "error", text: describePlingError(event, t) };
    case "tool_call":
      return { kind: "call", id: event.id, tool: event.tool, args: JSON.stringify(event.args) };
    case "blocked":
      return {
        kind: "blocked",
        id: event.id,
        text: english ? `Blocked: ${event.reason}` : `被拦截：${event.reason}`,
      };
    case "handoff": {
      const text =
        event.status === "requested"
          ? english
            ? `Take over (${event.id}): ${event.reason}`
            : `请你接管（${event.id}）：${event.reason}`
          : event.status === "completed"
            ? english
              ? `Manual step completed: ${event.id}`
              : `人工步骤已完成：${event.id}`
            : event.status === "cancelled"
              ? english
                ? `Manual step cancelled: ${event.id}`
                : `人工步骤已取消：${event.id}`
              : english
                ? `Manual step timed out: ${event.id}`
                : `人工步骤等待超时：${event.id}`;
      return { kind: "notice", text };
    }
    case "tool_result": {
      const { result } = event;
      if ("error" in result) return { kind: "result", id: event.id, ok: false, detail: result.error.code };
      const fidelity = (result.result as { fidelity?: string } | null)?.fidelity;
      const warning = (result.result as { warning?: string } | null)?.warning;
      return {
        kind: "result",
        id: event.id,
        ok: true,
        detail:
          warning ??
          (fidelity && fidelity !== "high"
            ? english
              ? `ok (fidelity ${fidelity})`
              : `ok（保真度 ${fidelity}）`
            : "ok"),
      };
    }
  }
}

export function toTranscriptLines(events: readonly SessionEvent[], options: TranscriptOptions = {}): TranscriptLine[] {
  const tools = options.tools ?? true;
  const lines: TranscriptLine[] = [];

  for (const event of events) {
    const line = toTranscriptLine(event, options);
    if (!tools && (line.kind === "call" || line.kind === "result")) continue;
    const tail = lines[lines.length - 1];
    const streamingTail = tail && tail.kind === "assistant" && tail.streaming ? tail : null;

    // 增量：追加到正在长的那个气泡上，不新开一行
    if (line.kind === "assistant" && line.streaming) {
      if (streamingTail) {
        streamingTail.text += line.text;
        continue;
      }
      lines.push(line);
      continue;
    }

    // 收口：这一轮说完了（final，或带动作那轮的 assistant）。
    // 用它的权威文本**替换**流式拼出来的那行 —— 同一句话不显示两遍，
    // 顺带保证「流式中途重试」这种情况最终也会收敛成正确答案。
    if ((line.kind === "assistant" || line.kind === "final") && streamingTail) {
      lines[lines.length - 1] = line;
      continue;
    }

    // 取消 / 失败：这一轮不会再有下文了。已经吐出来的半句留着（用户看得见发生了什么），
    // 但要把「还在生成」的状态摘掉 —— 否则光标会一直闪下去。
    if ((line.kind === "cancelled" || line.kind === "error") && streamingTail) {
      streamingTail.streaming = false;
    }

    lines.push(line);
  }

  return lines;
}
