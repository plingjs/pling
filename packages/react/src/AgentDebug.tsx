import { useEffect, useState, type CSSProperties, type SyntheticEvent } from "react";
import type { Registry, Snapshot } from "@plingjs/core";
import type { AgentRuntime, AgentTraceCall } from "@plingjs/agent";
import { formatAvailabilityReason } from "@plingjs/ui";
import { usePling, usePlingUi } from "./context";

export interface AgentDebugProps {
  runtime: AgentRuntime;
  registry: Registry;
}

/**
 * Read-only inspector for the runtime already driving this conversation.
 *
 * It never executes an action or creates a second runtime. The useful
 * debugging question is what this conversation saw and sent, not what a fresh
 * page would expose.
 */
export function AgentDebug({ runtime, registry }: AgentDebugProps) {
  const pling = usePling();
  const uiSnapshot = usePlingUi();
  const t = pling.ui.t;
  const [, setVersion] = useState(0);
  const [expandedSeq, setExpandedSeq] = useState(0);

  useEffect(() => {
    const offRegistry = registry.onChange(() => setVersion((value) => value + 1));
    const offTrace = runtime.trace?.subscribe(() => setVersion((value) => value + 1));
    return () => {
      offRegistry();
      offTrace?.();
    };
  }, [registry, runtime]);

  const snapshot: Snapshot = registry.snapshot();
  const calls: readonly AgentTraceCall[] = runtime.trace?.calls ?? [];
  const historySummary = runtime.session.loop.history.summary;
  const latestSeq = calls[calls.length - 1]?.seq ?? 0;

  useEffect(() => {
    setExpandedSeq(latestSeq);
  }, [latestSeq]);

  function toggleCall(seq: number, event: SyntheticEvent<HTMLDetailsElement>): void {
    const open = event.currentTarget.open;
    setExpandedSeq(open ? seq : expandedSeq === seq ? 0 : expandedSeq);
  }

  return (
    <section
      className="pling-debug"
      data-testid="pling-debug"
      data-pling-ui
      style={uiSnapshot.cssVars as CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: DEBUG_STYLES }} />
      <header className="pling-debug__head">
        <span className="pling-debug__title">{t("debug.title")}</span>
        <span className="pling-debug__readonly">{t("debug.readonly")}</span>
        <button
          type="button"
          className="pling-debug__refresh"
          onClick={() => setVersion((value) => value + 1)}
        >
          {t("debug.refresh")}
        </button>
      </header>
      <p className="pling-debug__note">{t("debug.sensitiveNote")}</p>

      <details className="pling-debug__section" open>
        <summary>{t("debug.page")}</summary>
        {snapshot.page ? (
          <div className="pling-debug__card">
            <code>{snapshot.page.title || snapshot.page.path || snapshot.page.name}</code>
            {snapshot.page.path ? <p>{snapshot.page.path}</p> : null}
          </div>
        ) : null}

        <Subhead
          title={t("debug.actions")}
          detail={t("debug.actionsSummary", {
            visible: snapshot.actions.length,
            total: snapshot.total,
            unavailable: snapshot.unavailableTotal,
          })}
        />
        {snapshot.actions.length ? (
          <ul className="pling-debug__list">
            {snapshot.actions.map((action) => (
              <li key={action.id}>
                <code>{action.id}</code>
                <span>{action.primitive} · {action.kind}</span>
                {action.scopePath?.length ? (
                  <span className="pling-debug__muted">{action.scopePath.join(" / ")}</span>
                ) : null}
                <span className="pling-debug__desc">{action.description}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pling-debug__empty">{t("debug.noActions")}</p>
        )}

        {snapshot.unavailable.length ? (
          <>
            <Subhead title={t("debug.unavailable")} />
            <ul className="pling-debug__list">
              {snapshot.unavailable.map((action) => (
                <li key={action.id}>
                  <code>{action.id}</code>
                  <span className="pling-debug__muted">{formatAvailabilityReason(action, t)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <Subhead
          title={t("debug.scopes")}
          detail={t("debug.scopesTotal", {
            visible: snapshot.scopes.filter((scope) => scope.active).length,
            total: snapshot.scopes.length,
          })}
        />
        {snapshot.scopes.length ? (
          <ul className="pling-debug__list">
            {snapshot.scopes.map((scope) => (
              <li key={scope.id}>
                <code>{scope.id}</code>
                <span>{scope.label || scope.role || ""}</span>
                <span className="pling-debug__muted">{scope.visible} / {scope.total}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pling-debug__empty">{t("debug.noScopes")}</p>
        )}

        <Subhead
          title={t("debug.records")}
          detail={t("debug.recordsTotal", {
            shown: snapshot.records.length,
            total: snapshot.recordsTotal,
          })}
        />
        {snapshot.records.length ? (
          <ul className="pling-debug__list">
            {snapshot.records.map((record) => (
              <li key={record.id}>
                <code>{record.id}</code>
                <span>{record.label || ""}</span>
                <pre>{pretty(record.fields)}</pre>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pling-debug__empty">{t("debug.noRecords")}</p>
        )}

        <Subhead title={t("debug.state")} />
        {snapshot.stateViews.length ? (
          <ul className="pling-debug__list">
            {snapshot.stateViews.map((item) => (
              <li key={item.key}>
                <code>{item.key}</code>
                {item.description ? <span className="pling-debug__desc">{item.description}</span> : null}
                <pre>{pretty(item.value)}</pre>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pling-debug__empty">{t("debug.noState")}</p>
        )}

        <Subhead title={t("debug.feedback")} />
        {snapshot.feedback.length ? (
          <ul className="pling-debug__list">
            {snapshot.feedback.map((item) => (
              <li key={item.id}>
                <span className={`pling-debug__severity is-${item.severity}`}>{item.severity}</span>
                <span>{item.message}</span>
                {item.scopePath?.length ? (
                  <span className="pling-debug__muted">{item.scopePath.join(" / ")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pling-debug__empty">{t("debug.noFeedback")}</p>
        )}
      </details>

      <details className="pling-debug__section" open>
        <summary>{t("debug.calls")}</summary>
        {calls.length ? null : <p className="pling-debug__empty">{t("debug.noCalls")}</p>}
        {calls.map((call) => (
          <details
            key={call.seq}
            className="pling-debug__call"
            open={call.seq === expandedSeq}
            onToggle={(event) => toggleCall(call.seq, event)}
          >
            <summary>
              <span>#{call.seq}</span>
              <span>{t("debug.turn", { turn: call.turn })}</span>
              <span className={`pling-debug__status is-${call.status}`}>
                {t(`debug.status.${call.status}`)}
              </span>
              <span>{duration(call.durationMs)}</span>
              <span>{call.contextTokens} tokens</span>
            </summary>

            {call.seq === expandedSeq ? (
              <div data-testid={`pling-call-body-${call.seq}`}>
                {call.error ? (
                  <p className="pling-debug__error">{call.error.code}: {call.error.message}</p>
                ) : null}

                <Subhead title={t("debug.request")} />
                {call.messages.map((message, index) => (
                  <div key={`${call.seq}:${index}`} className="pling-debug__message">
                    <p className="pling-debug__message-head">{messageLabel(message)}</p>
                    {message.content ? <pre>{message.content}</pre> : null}
                    {message.toolCalls?.length ? (
                      <ul className="pling-debug__tool-calls">
                        {message.toolCalls.map((toolCall) => (
                          <li key={toolCall.id}>
                            <code>{toolCall.name}</code>
                            <span>{toolCall.arguments}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}

                <details className="pling-debug__nested">
                  <summary>{t("debug.tools")} ({call.tools.length})</summary>
                  {call.tools.length ? (
                    <ul className="pling-debug__list">
                      {call.tools.map((tool) => (
                        <li key={tool.function.name}>
                          <code>{tool.function.name}</code>
                          <span className="pling-debug__desc">{tool.function.description}</span>
                          <pre className="pling-debug__schema">
                            {pretty(tool.function.parameters)}
                          </pre>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="pling-debug__empty">{t("debug.noTools")}</p>
                  )}
                </details>

                {call.response ? (
                  <>
                    <Subhead title={t("debug.response")} />
                    {call.response.content ? <pre>{call.response.content}</pre> : null}
                    {call.response.toolCalls.length ? (
                      <ul className="pling-debug__tool-calls">
                        {call.response.toolCalls.map((toolCall) => (
                          <li key={toolCall.id}>
                            <code>{toolCall.name}</code>
                            <span>{toolCall.arguments}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}

                <details className="pling-debug__nested">
                  <summary>{t("debug.callSnapshot")}</summary>
                  <p className="pling-debug__muted">
                    {t("debug.snapshotSummary", {
                      actions: call.snapshot.actions.length,
                      records: call.snapshot.records.length,
                      state: call.snapshot.stateViews.length,
                    })}
                  </p>
                  <ul className="pling-debug__list">
                    {call.snapshot.actions.map((action) => (
                      <li key={action.id}>
                        <code>{action.id}</code>
                        <span className="pling-debug__desc">{action.description}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ) : null}
          </details>
        ))}
      </details>

      {historySummary ? (
        <details className="pling-debug__section">
          <summary>{t("debug.historySummary")}</summary>
          <pre>{historySummary}</pre>
        </details>
      ) : null}
    </section>
  );
}

function Subhead({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="pling-debug__subhead">
      <strong>{title}</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function messageLabel(message: { role: string; name?: string; toolCallId?: string }): string {
  return [message.role, message.name, message.toolCallId].filter(Boolean).join(" · ");
}

function duration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

const DEBUG_STYLES = `
.pling-debug{display:flex;flex:none;flex-direction:column;gap:4px;padding:2px 2px 8px;color:var(--pling-color-text,#0f172a);font-size:11px}
.pling-debug__head{display:flex;align-items:center;gap:6px;padding:2px 0 4px}
.pling-debug__title{font-size:12px;font-weight:600}
.pling-debug__readonly{padding:1px 5px;border-radius:999px;background:var(--pling-color-surface-muted,#f8fafc);color:var(--pling-color-text-subtle,#94a3b8)}
.pling-debug__refresh{margin-left:auto;padding:2px 6px;border:1px solid var(--pling-color-border,#e3e8f0);border-radius:6px;background:var(--pling-color-surface,#fff);color:var(--pling-color-text-muted,#64748b);font:inherit;cursor:pointer}
.pling-debug__section,.pling-debug__call,.pling-debug__nested{border:1px solid var(--pling-color-border-muted,#f1f5f9);border-radius:7px;background:var(--pling-color-surface,#fff)}
.pling-debug__section>summary,.pling-debug__call>summary,.pling-debug__nested>summary{padding:5px 7px;color:var(--pling-color-text-muted,#475569);font-weight:600;cursor:pointer}
.pling-debug__section>summary{background:var(--pling-color-surface-muted,#f8fafc)}
.pling-debug__section>:not(summary),.pling-debug__call>:not(summary),.pling-debug__nested>:not(summary){margin-right:7px;margin-left:7px}
.pling-debug__section>:last-child,.pling-debug__call>:last-child,.pling-debug__nested>:last-child{margin-bottom:7px}
.pling-debug__call{margin:5px 7px}
.pling-debug__call>summary{display:flex;flex-wrap:wrap;gap:3px 7px;font-weight:400}
.pling-debug__call .pling-debug__status{font-weight:600}
.pling-debug__status.is-ok{color:var(--pling-color-success,#15803d)}
.pling-debug__status.is-error{color:var(--pling-color-danger,#b91c1c)}
.pling-debug__status.is-cancelled{color:var(--pling-color-warning,#b45309)}
.pling-debug__nested{margin-top:5px;margin-bottom:5px}
.pling-debug__subhead{display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-top:7px;color:var(--pling-color-text-muted,#475569)}
.pling-debug__subhead span{color:var(--pling-color-text-subtle,#94a3b8);text-align:right}
.pling-debug__list{margin:4px 0 6px;padding-left:16px}
.pling-debug__list li{margin:3px 0;line-height:1.45}
.pling-debug__list code,.pling-debug__card code{color:var(--pling-color-primary-strong,#1677c8);word-break:break-all}
.pling-debug__list li>span{margin-left:5px}
.pling-debug__desc{color:var(--pling-color-text-muted,#475569)}
.pling-debug__muted,.pling-debug__note{color:var(--pling-color-text-subtle,#94a3b8)}
.pling-debug__note{margin-top:6px;line-height:1.45}
.pling-debug__card{margin-top:6px;padding:5px 7px;border-radius:6px;background:var(--pling-color-surface-muted,#f8fafc)}
.pling-debug__card p{margin:2px 0 0;color:var(--pling-color-text-muted,#64748b)}
.pling-debug__message{margin:5px 0;padding:5px 6px;border-left:2px solid var(--pling-color-border,#cbd5e1);background:var(--pling-color-surface-muted,#f8fafc)}
.pling-debug__message-head{margin:0 0 3px;color:var(--pling-color-text-muted,#475569);font-family:var(--pling-font-family-mono,ui-monospace,monospace)}
.pling-debug pre{box-sizing:border-box;max-height:260px;margin:3px 0 0;padding:5px 6px;overflow:auto;border-radius:5px;background:var(--pling-color-surface-muted,#f8fafc);color:var(--pling-color-text-muted,#334155);font-family:var(--pling-font-family-mono,ui-monospace,monospace);font-size:10px;line-height:1.4;white-space:pre-wrap;word-break:break-word}
.pling-debug__tool-calls{margin:3px 0 0;padding-left:16px;font-family:var(--pling-font-family-mono,ui-monospace,monospace);font-size:10px}
.pling-debug__tool-calls li{word-break:break-all}
.pling-debug__tool-calls span{margin-left:5px;color:var(--pling-color-text-muted,#475569)}
.pling-debug__severity{padding:0 4px;border-radius:4px;background:var(--pling-color-surface-muted,#f1f5f9)}
.pling-debug__severity.is-error{background:var(--pling-color-danger-soft,#fee2e2);color:var(--pling-color-danger,#b91c1c)}
.pling-debug__severity.is-warning{background:var(--pling-color-warning-soft,#fff7ed);color:var(--pling-color-warning,#9a3412)}
.pling-debug__severity.is-success{background:var(--pling-color-success-soft,#f0fdf4);color:var(--pling-color-success,#15803d)}
.pling-debug__error{padding:5px 6px;border-radius:6px;background:var(--pling-color-danger-soft,#fee2e2);color:var(--pling-color-danger,#b91c1c);word-break:break-word}
.pling-debug__empty{color:var(--pling-color-text-subtle,#94a3b8);line-height:1.5}
`;
