import { useEffect, useRef, useState, type ReactNode } from "react";
import { supportsAlwaysAllow } from "@plingjs/core";
import {
  toTranscriptLines,
  type PendingApproval,
  type PendingHandoff,
  type SessionEvent,
} from "@plingjs/agent";
import { createUiController, type PlingUiController } from "@plingjs/ui";
import { renderMarkdown } from "./markdown";

const STANDALONE_CHAT_UI = createUiController({ locale: "en-US" });

export interface AgentChatProps {
  title?: string;
  events?: readonly SessionEvent[];
  running?: boolean;
  pending?: PendingApproval | null;
  pendingHandoff?: PendingHandoff | null;
  placeholder?: string;
  emptyHint?: string;
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
}

/**
 * 纯展示的问答组件：事件流、发送、确认回复都由外部接线。
 *
 * 这套边界与 Vue 版一致 —— 循环在浏览器还是服务端，组件本身不关心。
 */
export function AgentChat({
  title,
  events = [],
  running = false,
  pending = null,
  pendingHandoff = null,
  placeholder,
  emptyHint,
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
}: AgentChatProps) {
  const t = ui?.t ?? STANDALONE_CHAT_UI.t;
  const titleText = title ?? t("chat.title");
  const placeholderText = placeholder ?? t("chat.placeholder");
  const emptyText = emptyHint ?? t("chat.empty");
  const [draft, setDraft] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const lines = toTranscriptLines(events, { tools, locale: ui?.locale ?? "en-US", translate: t });
  const shown = (text: string): string => (reveal ? reveal(text) : text);
  const handoffSteps = pendingHandoff?.request.steps ?? [];
  const handoffStep = pendingHandoff?.step ?? 0;
  const handoffLast = handoffStep >= handoffSteps.length - 1;

  useEffect(() => {
    const box = transcriptRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [events.length, running, pending, pendingHandoff]);

  function submit(): void {
    const text = draft.trim();
    if (!text || running) return;
    setDraft("");
    onSend?.(text);
  }

  return (
    <section className={`pling-chat${className ? ` ${className}` : ""}`} data-pling-ui>
      <style dangerouslySetInnerHTML={{ __html: CHAT_STYLES }} />
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

      <div className="pling-chat__transcript" ref={transcriptRef} aria-live="polite">
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
              <button type="button" className="is-reject" onClick={onDismissResume}>
                {t("chat.resume.dismiss")}
              </button>
            </div>
          </div>
        ) : null}
        {!lines.length ? <p className="pling-chat__empty">{emptyText}</p> : null}
        {lines.map((line, index) => {
          if (line.kind === "user") {
            return <p key={index} className="pling-chat__line is-user">{shown(line.text)}</p>;
          }
          if (line.kind === "final" || line.kind === "assistant") {
            return (
              <div
                key={index}
                className={`pling-chat__line is-${line.kind} is-markdown`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(shown(line.text)) }}
              />
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
        {running && !pending && !pendingHandoff ? (
          <p className="pling-chat__line is-executing">
            <span className="pling-chat__dot" aria-hidden="true" />
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
          <p className="pling-chat__reason">{pendingHandoff.request.reason}</p>
          {handoffSteps.length ? (
            <ol className="pling-chat__steps">
              {handoffSteps.map((step, index) => (
                <li
                  key={index}
                  className={index === handoffStep ? "is-current" : index < handoffStep ? "is-done" : undefined}
                >
                  <span className="pling-chat__num">{index + 1}</span>
                  <span>{shown(step.text)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="pling-chat__hint">
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
            <button type="button" className="is-reject" onClick={() => onHandoff?.(false)}>
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
            <span className="pling-chat__desc">{pending.request.description}</span>
          </div>
          <div className="pling-chat__answers">
            <button type="button" onClick={() => onReply?.(true)}>{t("chat.confirm.approve")}</button>
            {supportsAlwaysAllow(pending.request.approval) ? (
              <button type="button" onClick={() => onReply?.("always")}>{t("chat.confirm.always")}</button>
            ) : null}
            <button type="button" className="is-reject" onClick={() => onReply?.(false)}>
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
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholderText}
          disabled={running}
          aria-label={t("chat.inputLabel")}
        />
        <button type="submit" disabled={running || !draft.trim()}>{t("chat.send")}</button>
      </form>
    </section>
  );
}

const CHAT_STYLES = `
.pling-chat{display:flex;flex-direction:column;gap:8px;height:100%;min-height:0;padding:12px;border:1px solid var(--pling-color-border,#dbe7f5);border-radius:var(--pling-radius-md,10px);background:var(--pling-color-surface,#fff);color:var(--pling-color-text,#0f172a);font-size:13px;line-height:1.5;text-align:left}
.pling-chat__head{display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid var(--pling-color-border-muted,#eef2f7)}
.pling-chat__running{color:var(--pling-color-primary-strong,#0369a1);font-size:12px}
.pling-chat__stop{margin-left:auto;padding:2px 8px;border:1px solid var(--pling-color-border,#cbd5e1);border-radius:var(--pling-radius-sm,6px);background:var(--pling-color-surface,#fff);color:var(--pling-color-text-muted,#475569);cursor:pointer}
.pling-chat__transcript{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:6px;padding-right:2px}
.pling-chat__resume{display:flex;flex-direction:column;gap:6px;padding:9px 10px;border:1px solid var(--pling-color-primary,#7dd3fc);border-radius:var(--pling-radius-md,8px);background:var(--pling-color-primary-soft,#f0f9ff)}
.pling-chat__resume strong{color:var(--pling-color-primary-strong,#075985);font-size:12px}
.pling-chat__resume-hint{margin:0;color:var(--pling-color-primary-strong,#0369a1);font-size:12px;line-height:1.45}
.pling-chat__line{margin:0;padding:6px 8px;border-left:3px solid var(--pling-color-border,#dbe7f5);border-radius:var(--pling-radius-sm,6px);white-space:pre-wrap;word-break:break-word}
.pling-chat__line.is-user{border-color:var(--pling-color-primary,#7dd3fc);background:var(--pling-color-primary-soft,#f0f9ff)}
.pling-chat__line.is-assistant{border-color:var(--pling-color-primary,#c7d2fe)}
.pling-chat__line.is-final{border-color:var(--pling-color-success,#86efac);background:var(--pling-color-success-soft,#f0fdf4)}
.pling-chat__line.is-markdown{white-space:normal}
.pling-chat__line.is-notice{border-color:var(--pling-color-warning,#fde68a);background:var(--pling-color-warning-soft,#fffbeb);color:var(--pling-color-warning,#92400e);font-size:12px}
.pling-chat__line.is-error{border-color:var(--pling-color-danger,#fca5a5);background:var(--pling-color-danger-soft,#fef2f2);color:var(--pling-color-danger,#b91c1c)}
.pling-chat__line.is-blocked{border-color:var(--pling-color-warning,#fdba74);background:var(--pling-color-warning-soft,#fff7ed);color:var(--pling-color-warning,#9a3412)}
.pling-chat__line.is-call,.pling-chat__line.is-result{font-family:var(--pling-font-family-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px}
.pling-chat__line.is-result{border-color:var(--pling-color-danger,#fca5a5);color:var(--pling-color-danger,#b91c1c)}
.pling-chat__line.is-result.is-ok{border-color:var(--pling-color-success,#86efac);color:var(--pling-color-success,#15803d)}
.pling-chat__line.is-executing{display:flex;align-items:center;gap:6px;border-color:var(--pling-color-primary,#bae6fd);color:var(--pling-color-text-muted,#64748b);font-size:12px}
.pling-chat__dot{width:7px;height:7px;flex:none;border-radius:50%;background:var(--pling-color-primary,#2e9df7);animation:pling-chat-pulse 1s ease-in-out infinite}
.pling-chat__args{margin-left:6px;color:var(--pling-color-text-subtle,#94a3b8)}
.pling-chat__empty{margin:0;color:var(--pling-color-text-subtle,#94a3b8)}
.pling-chat__confirm,.pling-chat__handoff{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--pling-color-warning,#fde68a);border-radius:var(--pling-radius-md,8px);background:var(--pling-color-warning-soft,#fffbeb)}
.pling-chat__confirm.is-danger{border-color:var(--pling-color-danger,#fca5a5);background:var(--pling-color-danger-soft,#fef2f2)}
.pling-chat__handoff{border-color:var(--pling-color-primary,#93c5fd);background:var(--pling-color-primary-soft,#eff6ff)}
.pling-chat__ask{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pling-chat__ask code{padding:1px 5px;border-radius:4px;background:var(--pling-color-surface-muted,#f1f5f9);font-size:12px}
.pling-chat__desc,.pling-chat__reason{margin:0;color:var(--pling-color-text-muted,#475569);font-size:12px}
.pling-chat__reason{color:var(--pling-color-primary-strong,#1e3a8a)}
.pling-chat__steps{display:grid;gap:3px;margin:2px 0;padding:0;list-style:none}
.pling-chat__steps li{display:flex;align-items:baseline;gap:6px;color:var(--pling-color-text-muted,#64748b);font-size:12px}
.pling-chat__steps li.is-current{color:var(--pling-color-text,#0f172a);font-weight:600}
.pling-chat__steps li.is-done{color:var(--pling-color-success,#15803d);text-decoration:line-through}
.pling-chat__num{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;background:var(--pling-color-primary-soft,#dbeafe);color:var(--pling-color-primary-strong,#1d4ed8);font-size:10px;flex:none}
.pling-chat__hint{margin:0;color:var(--pling-color-text-muted,#64748b);font-size:12px}
.pling-chat__answers{display:flex;gap:6px;flex-wrap:wrap}
.pling-chat__answers button{padding:3px 9px;border:1px solid var(--pling-color-border,#cbd5e1);border-radius:var(--pling-radius-sm,6px);background:var(--pling-color-surface,#fff);color:var(--pling-color-text-muted,#334155);font-size:12px;cursor:pointer}
.pling-chat__answers button.is-reject{border-color:var(--pling-color-danger,#fca5a5);color:var(--pling-color-danger,#b91c1c)}
.pling-chat__composer{display:flex;gap:6px;padding-top:6px;border-top:1px solid var(--pling-color-border-muted,#eef2f7)}
.pling-chat__composer input{flex:1;min-width:0;padding:6px 8px;border:1px solid var(--pling-color-border,#cbd5e1);border-radius:var(--pling-radius-sm,7px);background:var(--pling-color-surface,#fff);color:var(--pling-color-text,#0f172a);font:inherit;outline:none}
.pling-chat__composer input:focus{border-color:var(--pling-color-primary,#2e9df7);box-shadow:0 0 0 3px rgb(46 157 247 / 15%)}
.pling-chat__composer button{padding:6px 12px;border:0;border-radius:var(--pling-radius-sm,7px);background:var(--pling-color-primary,#2e9df7);color:var(--pling-color-on-primary,#fff);font:inherit;cursor:pointer}
.pling-chat__composer button:disabled{opacity:.45;cursor:not-allowed}
.pling-chat__line.is-markdown p{margin:0 0 .55em}
.pling-chat__line.is-markdown p:last-child{margin-bottom:0}
.pling-chat__line.is-markdown h1,.pling-chat__line.is-markdown h2,.pling-chat__line.is-markdown h3{margin:.3em 0 .45em;line-height:1.3}
.pling-chat__line.is-markdown ul,.pling-chat__line.is-markdown ol{margin:.35em 0;padding-left:1.5em}
.pling-chat__line.is-markdown blockquote{margin:.5em 0;padding-left:.75em;border-left:3px solid var(--pling-color-border,#cbd5e1);color:var(--pling-color-text-muted,#475569)}
.pling-chat__line.is-markdown pre{overflow-x:auto;margin:.5em 0;padding:8px;border-radius:var(--pling-radius-sm,6px);background:var(--pling-color-surface-muted,#f1f5f9)}
.pling-chat__line.is-markdown code{padding:.08em .28em;border-radius:3px;background:var(--pling-color-surface-muted,#eef2f7);font-family:var(--pling-font-family-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:.94em}
.pling-chat__line.is-markdown pre code{padding:0;background:transparent;white-space:pre}
.pling-chat__line.is-markdown a{color:var(--pling-color-primary-strong,#0369a1);text-decoration:underline}
.pling-chat__line.is-markdown table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse}
.pling-chat__line.is-markdown th,.pling-chat__line.is-markdown td{padding:3px 6px;border:1px solid var(--pling-color-border,#dbe2ea);text-align:left}
@keyframes pling-chat-pulse{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.pling-chat__dot{animation:none}}
`;
