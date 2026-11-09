import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supportsAlwaysAllow } from "@plingjs/core";
import {
  toTranscriptLines,
  type PendingApproval,
  type PendingHandoff,
  type SessionEvent,
} from "@plingjs/agent";
import { ensurePlingStyles } from "@plingjs/dom";
import { createUiController, quickTaskOf, type PlingUiController, type QuickTaskItem } from "@plingjs/ui";
import { renderMarkdown } from "./markdown";

const STANDALONE_CHAT_UI = createUiController({ locale: "en-US" });

export interface AgentChatProps {
  title?: string;
  /** Optional task card rendered in the transcript or pinned under the header. */
  task?: ReactNode;
  taskPlacement?: "inline" | "pinned";
  events?: readonly SessionEvent[];
  running?: boolean;
  pending?: PendingApproval | null;
  pendingHandoff?: PendingHandoff | null;
  placeholder?: string;
  emptyHint?: string;
  /** Show the "me / Pling + time" labels above messages. */
  speakers?: boolean;
  /** Standalone panels keep their own title header; workspace docks hide it. */
  showHeader?: boolean;
  /** Two-line auto-growing composer, matching the dock layout. */
  multiline?: boolean;
  /** Suggested prompts, shown only while the transcript is empty. */
  quick?: readonly QuickTaskItem[];
  /** Shared framework UI controller. Defaults to the English catalog. */
  ui?: PlingUiController;
  /** Extra class for the outer chat surface. */
  className?: string;
  /** 把动作流水也画进对话；默认 false，详细账本看「运行」。 */
  tools?: boolean;
  /** 展示层改写（敏感值代号 → 真值）；只影响渲染。 */
  reveal?: (text: string) => string;
  /** MPA 恢复入口：有值时在对话顶部显示「继续上次任务」。 */
  resume?: { goal?: string; interrupted?: boolean } | null;
  /** 工具条插槽：外壳可放清空 / 收起等控件。 */
  actions?: ReactNode;
  footer?: ReactNode;
  onSend?: (text: string) => void;
  onReply?: (decision: boolean | "always") => void;
  onHandoff?: (done: boolean) => void;
  onHandoffStep?: (delta: number) => void;
  onResume?: () => void;
  onDismissResume?: () => void;
  onStop?: () => void;
  onQuick?: (text: string) => void;
}

/**
 * 纯展示的问答组件：事件流、发送、确认回复都由外部接线。
 *
 * 这套边界与 Vue 版一致 —— 循环在浏览器还是服务端，组件本身不关心。
 */
export function AgentChat({
  title,
  task,
  taskPlacement = "pinned",
  events = [],
  running = false,
  pending = null,
  pendingHandoff = null,
  placeholder,
  emptyHint,
  speakers = true,
  showHeader = true,
  multiline = true,
  quick = [],
  ui,
  className,
  tools = false,
  reveal,
  resume = null,
  actions,
  footer,
  onSend,
  onReply,
  onHandoff,
  onHandoffStep,
  onResume,
  onDismissResume,
  onStop,
  onQuick,
}: AgentChatProps) {
  const t = ui?.t ?? STANDALONE_CHAT_UI.t;
  const titleText = title ?? t("chat.title");
  const placeholderText = placeholder ?? t("chat.placeholder");
  const emptyText = emptyHint ?? t("chat.empty");
  const [draft, setDraft] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const lines = toTranscriptLines(events, { tools, locale: ui?.locale ?? "en-US", translate: t });
  const quickItems = quick.map(quickTaskOf);
  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(ui?.locale ?? "en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
    [ui?.locale],
  );
  const lineTimes = useMemo(
    () => lines.map(() => timeFormat.format(new Date())),
    [lines.length, timeFormat],
  );
  const shown = (text: string): string => (reveal ? reveal(text) : text);
  const handoffSteps = pendingHandoff?.request.steps ?? [];
  const handoffStep = pendingHandoff?.step ?? 0;
  const handoffLast = handoffStep >= handoffSteps.length - 1;

  useEffect(() => {
    ensurePlingStyles();
  }, []);

  useLayoutEffect(() => {
    const element = composerRef.current;
    if (!element) return;
    element.style.height = "auto";
    const height = Math.min(150, Math.max(44, element.scrollHeight));
    element.style.height = `${height}px`;
    element.style.overflowY = element.scrollHeight > 150 ? "auto" : "hidden";
  }, [draft, multiline]);

  useEffect(() => {
    const box = transcriptRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [events.length, running, pending, pendingHandoff]);

  useEffect(() => {
    ensurePlingStyles();
  }, []);

  useLayoutEffect(() => {
    const element = composerRef.current;
    if (!element) return;
    element.style.height = "auto";
    const height = Math.min(150, Math.max(44, element.scrollHeight));
    element.style.height = `${height}px`;
    element.style.overflowY = element.scrollHeight > 150 ? "auto" : "hidden";
  }, [draft, multiline]);

  useEffect(() => {
    const box = transcriptRef.current;
    if (!box || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      box.scrollTop = box.scrollHeight;
    });
    observer.observe(box, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  function submit(): void {
    const text = draft.trim();
    if (!text || running) return;
    setDraft("");
    onSend?.(text);
  }

  return (
    <section className={`pling-chat${className ? ` ${className}` : ""}`} data-pling-ui>
      {showHeader ? (
        <header className="pling-chat__head">
          <strong>{titleText}</strong>
          {actions}
          {running ? <span className="pling-chat__running">{t("chat.running")}</span> : null}
          {running && onStop ? (
            <button type="button" className="pling-chat__stop" onClick={onStop}>
              {t("chat.stop")}
            </button>
          ) : null}
        </header>
      ) : null}

      {taskPlacement === "pinned" && task ? (
        <div className="pling-chat__task-pinned">{task}</div>
      ) : null}

      <div
        className={`pling-chat__transcript${!lines.length && !task ? " is-empty" : ""}`}
        ref={transcriptRef}
        aria-live="polite"
      >
        {resume ? (
          <div className="pling-chat__resume">
            <strong>
              {resume.goal
                ? t("chat.resume.goal", { goal: shown(resume.goal) })
                : t("chat.resume.pending")}
            </strong>
            {resume.interrupted ? (
              <p className="pling-chat__resume-hint">{t("chat.resume.interrupted")}</p>
            ) : null}
            <p className="pling-chat__resume-hint">{t("chat.resume.record")}</p>
            <div className="pling-chat__answers">
              <button type="button" onClick={onResume}>{t("chat.resume.continue")}</button>
              <button type="button" className="reject" onClick={onDismissResume}>
                {t("chat.resume.dismiss")}
              </button>
            </div>
          </div>
        ) : null}
        {!lines.length && !(taskPlacement === "inline" && task) ? (
          <>
            <p className="pling-chat__empty">{emptyText}</p>
            {quickItems.length ? (
              <div className="pling-chat__quick pling-dock__quick">
                {quickItems.map((item, index) => (
                  <button
                    key={`${item.prompt}:${index}`}
                    type="button"
                    disabled={running || item.disabled}
                    title={item.description}
                    onClick={() => onQuick?.(item.prompt)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        {lines.map((line, index) => {
          if (line.kind === "user") {
            return (
              <div key={index} className="pling-chat__line is-user">
                {speakers ? (
                  <header className="pling-chat__line-head">
                    <span>{t("chat.me")}</span>
                    <time>{lineTimes[index]}</time>
                  </header>
                ) : null}
                <p className="pling-chat__line-body">{shown(line.text)}</p>
              </div>
            );
          }
          if (line.kind === "final" || line.kind === "assistant") {
            return (
              <div key={index} className={`pling-chat__line is-${line.kind}`}>
                {speakers ? (
                  <header className="pling-chat__line-head">
                    <strong>{t("chat.assistantName")}</strong>
                    <time>{lineTimes[index]}</time>
                  </header>
                ) : null}
                <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(shown(line.text)) }} />
              </div>
            );
          }
          if (line.kind === "notice") {
            return <p key={index} className="pling-chat__line is-notice">{shown(line.text)}</p>;
          }
          if (line.kind === "cancelled") {
            return <p key={index} className="pling-chat__line is-notice">{t("chat.cancelled")}</p>;
          }
          if (line.kind === "error") {
            return <p key={index} className="pling-chat__line is-error">{shown(line.text)}</p>;
          }
          if (line.kind === "blocked") {
            return <p key={index} className="pling-chat__line is-blocked">{shown(line.text)}</p>;
          }
          if (line.kind === "call") {
            return (
              <p key={index} className="pling-chat__line is-call">
                <code>{line.id}</code>
                <span className="pling-chat__args">{shown(line.args)}</span>
              </p>
            );
          }
          return (
            <p key={index} className={`pling-chat__line is-result${line.ok ? " is-ok" : ""}`}>
              <code>{line.id}</code>
              <span>{shown(line.detail)}</span>
            </p>
          );
        })}
        {taskPlacement === "inline" ? task : null}
        {running && !pending && !pendingHandoff ? (
          <p className="pling-chat__line is-executing">
            <span className="pling-chat__executing-dot" aria-hidden="true" />
            {t("chat.executing")}
          </p>
        ) : null}
      </div>

      {pendingHandoff ? (
        <div className="pling-chat__handoff">
          <div className="pling-chat__ask">
            <strong>
              {handoffSteps.length
                ? t("chat.handoff.step", { current: handoffStep + 1, total: handoffSteps.length })
                : t("chat.handoff.takeover")}
            </strong>
            <code>{pendingHandoff.request.id}</code>
          </div>
          <p className="pling-chat__handoff-reason">{pendingHandoff.request.reason}</p>
          {handoffSteps.length ? (
            <ol className="pling-chat__handoff-steps">
              {handoffSteps.map((step, index) => (
                <li
                  key={index}
                  className={index === handoffStep ? "is-current" : index < handoffStep ? "is-done" : undefined}
                >
                  <span className="pling-chat__handoff-num">{index + 1}</span>
                  <span>{shown(step.text)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="pling-chat__handoff-hint">
            {handoffSteps.length ? t("chat.handoff.follow") : t("chat.handoff.completeHint")}
          </p>
          <div className="pling-chat__answers">
            {handoffStep > 0 ? (
              <button type="button" onClick={() => onHandoffStep?.(-1)}>{t("chat.handoff.previous")}</button>
            ) : null}
            {handoffSteps.length && !handoffLast ? (
              <button type="button" onClick={() => onHandoffStep?.(1)}>{t("chat.handoff.next")}</button>
            ) : (
              <button type="button" onClick={() => onHandoff?.(true)}>{t("chat.handoff.done")}</button>
            )}
            <button type="button" className="reject" onClick={() => onHandoff?.(false)}>
              {t("chat.handoff.cancel")}
            </button>
          </div>
        </div>
      ) : pending ? (
        <div className={`pling-chat__confirm${pending.request.kind === "danger" ? " is-danger" : ""}`}>
          <div className="pling-chat__ask">
            <strong>
              {pending.request.kind === "danger" ? t("chat.confirm.danger") : t("chat.confirm.title")}
            </strong>
            <code>{pending.request.id}</code>
            <span className="pling-chat__confirm-desc">{pending.request.description}</span>
          </div>
          <div className="pling-chat__answers">
            <button type="button" onClick={() => onReply?.(true)}>{t("chat.confirm.approve")}</button>
            {supportsAlwaysAllow(pending.request.approval) ? (
              <button type="button" onClick={() => onReply?.("always")}>{t("chat.confirm.always")}</button>
            ) : null}
            <button type="button" className="reject" onClick={() => onReply?.(false)}>
              {t("chat.confirm.reject")}
            </button>
          </div>
        </div>
      ) : null}

      {footer}

      <form
        className="pling-chat__composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="pling-chat__composer-box">
          {multiline ? (
            <textarea
              ref={composerRef}
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                submit();
              }}
              placeholder={placeholderText}
              disabled={running}
              aria-label={t("chat.inputLabel")}
            />
          ) : (
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={placeholderText}
              disabled={running}
              aria-label={t("chat.inputLabel")}
            />
          )}
          <button
            className="pling-chat__send"
            type="submit"
            aria-label={t("chat.send")}
            title={t("chat.send")}
            disabled={running || !draft.trim()}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4.5 10h10M11 6.5l3.5 3.5-3.5 3.5" />
            </svg>
          </button>
        </div>
      </form>
    </section>
  );
}

