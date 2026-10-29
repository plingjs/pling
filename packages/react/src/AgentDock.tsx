import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  compactAt,
  createAgentRuntime,
  resolveAgentConfig,
  toActivityRows,
  type ActivityRow,
  type AgentConfigOverrides,
  type AgentRuntime,
  type AgentTraceOptions,
  type HookRegistry,
  type PendingApproval,
  type PendingHandoff,
  type SessionEvent,
} from "@plingjs/agent";
import type { Llm, Registry } from "@plingjs/core";
import { PLING_UI_Z_INDEX, sameOriginUrl, type PlingAskOptions } from "@plingjs/dom";
import { describePlingDiagnostic, diagnosticMessageKey, type PlingUiController } from "@plingjs/ui";
import { AgentChat } from "./AgentChat";
import { AgentDebug } from "./AgentDebug";
import { usePling, usePlingUi } from "./context";
import { readViteEnv } from "./env";

export interface AgentDockProps {
  /** Extra class for the shell, typically for page-grid sizing. */
  className?: string;
  title?: string;
  placeholder?: string;
  emptyHint?: string;
  /** 推荐指令：点一下等于把这句话发出去。 */
  quick?: readonly string[];
  defaultOpen?: boolean;
  /** 覆盖模型配置（只写想改的字段；其余从 `.env.local` 读）。 */
  config?: AgentConfigOverrides;
  /** 注入模型（测试 / 自己的薄 Node 层 / 无网络演示）。 */
  llm?: Llm;
  /** 工具生命周期钩子；不传就用 `createPling({ agent: { hooks } })` 的应用级那一份。 */
  hooks?: HookRegistry;
  /** 确认通道开关：返回 false 时所有动作直接执行。 */
  gate?: () => boolean;
  /** 注册表：一般不用传，默认用 Provider 里的那个。 */
  registry?: Registry;
  /** 在运行里开启只读检查器；默认关闭。传对象可限制保留的模型调用数。 */
  debug?: boolean | AgentTraceOptions;
  /** 会话事件（业务要审计 / 自己记日志时用）。 */
  onSessionEvent?: (event: SessionEvent) => void;
  onOpenChange?: (open: boolean) => void;
  /** 任务完成后的导航实现；默认 `window.location.replace`。一般只在测试 / 自定义宿主要传。 */
  navigate?: (href: string) => void;
  /** `dock` follows the page in a floating corner. `sidebar` uses a viewport edge. */
  layout?: "dock" | "sidebar" | "inline";
  /** Edge used by `layout="sidebar"`. Ignored by the default dock. */
  side?: "right" | "left";
  /** Where the collapsed sidebar launcher sits. */
  launcherPlacement?: "bottom" | "center";
  /** Custom copy for the collapsed launcher. Defaults to the localized "Ask Pling". */
  launcherLabel?: string;
  /** Stable id used by `pling.ask({ surface })`. Built-in docks default to `dock`. */
  surfaceId?: string;
}

export interface AgentDockHandle {
  send(prompt: string): Promise<void>;
  ask(prompt: string, options?: PlingAskOptions): Promise<void>;
}

/**
 * React 的悬浮问答入口：**一个标签接完**。
 *
 * 与 Vue 版共用同一套 agent 层：会话循环、确认、人工接力、事件流、
 * 运行页（`toActivityRows`）与限额读数都不在这里重写。
 * 适配器只负责 React 的状态与渲染。
 */
export const AgentDock = forwardRef<AgentDockHandle, AgentDockProps>(function AgentDock({
  className,
  title,
  placeholder,
  emptyHint,
  quick = [],
  defaultOpen = false,
  config,
  llm,
  hooks,
  gate,
  registry: registryProp,
  debug,
  onSessionEvent,
  onOpenChange,
  navigate,
  layout = "dock",
  side = "right",
  launcherPlacement = "bottom",
  launcherLabel,
  surfaceId = "dock",
}, ref) {
  const pling = usePling();
  const uiSnapshot = usePlingUi();
  const ui = pling.ui;
  const t = ui.t;
  const titleText = title ?? t("dock.assistant");
  const placeholderText = placeholder ?? t("chat.placeholder");
  const emptyHintText = emptyHint ?? t("chat.empty");
  const launcherOpenText = launcherLabel?.trim() || t("dock.launcher.open");
  const registry = registryProp ?? pling.registry;
  const setup = pling.agent ?? {};
  const traceOption = debug !== undefined ? debug : setup.trace;
  const debugEnabled = Boolean(traceOption);
  const propsRef = useRef({ onSessionEvent, onOpenChange });
  propsRef.current = { onSessionEvent, onOpenChange };

  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<"chat" | "activity">("chat");
  const [debugOpen, setDebugOpen] = useState(false);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [pendingHandoff, setPendingHandoff] = useState<PendingHandoff | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [, setTick] = useState(0);
  const navigateRef = useRef<(href: string) => void>((href) => window.location.replace(href));
  navigateRef.current = navigate ?? ((href) => window.location.replace(href));
  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);
  const sendRef = useRef<(text: string) => Promise<void>>(async () => undefined);

  function cancelReturn(): void {
    if (returnTimerRef.current === null) return;
    clearTimeout(returnTimerRef.current);
    returnTimerRef.current = null;
  }

  /** 返回目标由会话层一次性消费；这里只负责同源校验与延迟导航。 */
  function queueReturn(): void {
    if (!aliveRef.current) return;
    const target = runtimeRef.current?.continuity.claimReturn();
    if (!target) return;
    const href = sameOriginUrl(target.href);
    if (!href) return;
    cancelReturn();
    returnTimerRef.current = setTimeout(() => {
      returnTimerRef.current = null;
      if (!aliveRef.current) return;
      navigateRef.current(href);
    }, target.delayMs);
  }

  const resolvedRef = useRef<ReturnType<typeof resolveAgentConfig> | null>(null);
  if (!resolvedRef.current) {
    resolvedRef.current = resolveAgentConfig({
      env: readViteEnv(),
      config: { ...(setup.config ?? {}), ...(config ?? {}) },
    });
  }
  const resolved = resolvedRef.current;

  const runtimeRef = useRef<AgentRuntime | null>(null);
  if (!runtimeRef.current) {
    runtimeRef.current = createAgentRuntime({
      ...setup,
      ...(hooks ?? setup.hooks ? { hooks: hooks ?? setup.hooks } : {}),
      ...(traceOption ? { trace: traceOption } : {}),
      config: resolved,
      registry,
      responseLocale: setup.responseLocale ?? (() => ui.locale),
      ...(llm ?? setup.llm ? { llm: llm ?? setup.llm } : {}),
      ...(gate ?? setup.gate ? { gate: gate ?? setup.gate } : {}),
      onEvent: (event) => {
        setEvents((current) => [...current, event]);
        setTick((value) => value + 1);
        if (event.type === "final") queueReturn();
        setup.onEvent?.(event);
        propsRef.current.onSessionEvent?.(event);
      },
      onApproval: (request) => {
        setPending(request);
        setup.onApproval?.(request);
      },
      onHandoff: (request) => {
        setPendingHandoff(request);
        setup.onHandoff?.(request);
      },
    });
  }
  const runtime = runtimeRef.current;

  useEffect(() => {
    // 整页导航恢复出来的事件在会话里，不在本次 document 的 onEvent 回调里。
    if (runtime.continuity.restored) setEvents([...runtime.session.events()]);
    if (runtime.readiness.ready && runtime.continuity.claimAutoResume()) {
      setResumeDismissed(true);
      void send(RESUME_TEXT, false);
    }
  }, [runtime]);

  useEffect(() => {
    registry.setDefaultApproval(resolved.defaultApproval);
  }, [registry, resolved.defaultApproval]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      cancelReturn();
      runtime.session.cancel();
      runtime.approvals.clear();
      runtime.handoffs.clear();
    };
  }, [runtime]);

  const gateActive = (gate ?? setup.gate)?.() ?? true;
  const activityRows = toActivityRows(events, { locale: uiSnapshot.locale, translate: t });
  const notReadyText = notReady ? describePlingDiagnostic(runtime.readiness, t) : "";
  const failedCount = activityRows.filter((row) => row.status === "failed" || row.status === "blocked").length;
  const usedTokens = runtime.session.loop.history.totalTokens();
  const summary = describeUsage(runtime, usedTokens, t);
  const limitsHint = t("dock.limits.title", {
    model: runtime.model || t("dock.model.unconfigured"),
    context: runtime.limits.contextTokens,
    reserve: runtime.limits.reserveForOutput,
    compact: compactAt(runtime.limits),
    keep: runtime.limits.keepRecent,
    maxTurns: runtime.limits.maxTurns,
    retries: runtime.retry.maxRetries,
    min: runtime.retry.baseDelayMs,
    max: runtime.retry.maxDelayMs,
  });
  const showText = (text: string): string => (pling.revealSensitive ? registry.tokens.resolve(text) : text);
  const checkpoint = runtime.continuity.restored ? runtime.continuity.checkpoint : null;
  const resume =
    runtime.continuity.resume !== "off" && checkpoint && checkpoint.status === "active" && !resumeDismissed
      ? { ...(checkpoint.goal ? { goal: checkpoint.goal } : {}), interrupted: checkpoint.interrupted }
      : null;
  const RESUME_TEXT =
    "Continue the previous task. Inspect the current page before deciding the next step; if the previous page's action result is unknown, do not assume it succeeded.";

  function toggle(next?: boolean): void {
    const value = next ?? !open;
    setOpen(value);
    propsRef.current.onOpenChange?.(value);
  }

  function reveal(): void {
    if (open) return;
    setOpen(true);
    propsRef.current.onOpenChange?.(true);
  }

  async function send(text: string, revealSurface = true): Promise<void> {
    const value = text.trim();
    if (!value || running) return;
    if (revealSurface) reveal();
    setNotReady(false);
    if (!runtime.readiness.ready) {
      setNotReady(true);
      const messageKey = diagnosticMessageKey(runtime.readiness.code);
      setEvents((current) => [
        ...current,
        { type: "user", text: value },
        {
          type: "error",
          code: "NOT_CONFIGURED",
          message: runtime.readiness.hint,
          ...(messageKey ? { messageKey } : {}),
          ...(runtime.readiness.params ? { params: runtime.readiness.params } : {}),
        },
      ]);
      return;
    }

    setRunning(true);
    try {
      await runtime.session.send(value);
    } finally {
      setRunning(false);
    }
  }
  sendRef.current = send;

  useEffect(() => pling.task.register({
    id: surfaceId,
    ask: (prompt) => sendRef.current(prompt),
  }), [pling, surfaceId]);

  useImperativeHandle(ref, () => ({
    send: (prompt) => sendRef.current(prompt),
    ask: (prompt) => sendRef.current(prompt),
  }), []);

  function resumeTask(): void {
    setResumeDismissed(true);
    void send(RESUME_TEXT);
  }

  function dismissResume(): void {
    setResumeDismissed(true);
    clear();
  }

  function clear(): void {
    cancelReturn();
    setResumeDismissed(true);
    runtime.session.reset();
    runtime.approvals.clear();
    runtime.handoffs.clear();
    runtime.telemetry.clear();
    setEvents([]);
    setPending(null);
    setPendingHandoff(null);
    setNotReady(false);
    setTick(0);
  }

  const shellClass = [
    "pling-dock",
    `pling-dock--${layout}`,
    ...(layout === "sidebar" ? [`pling-dock--${side}`, `pling-dock--launcher-${launcherPlacement}`] : []),
    ...(open ? ["is-open"] : []),
    ...(ui.classNames.dock ? [ui.classNames.dock] : []),
    ...(className ? [className] : []),
  ].join(" ");

  return (
    <div
      className={shellClass}
      data-pling-ui
      data-layout={layout}
      data-side={layout === "sidebar" ? side : undefined}
      data-launcher-placement={layout === "sidebar" ? launcherPlacement : undefined}
      style={{ ...uiSnapshot.cssVars, zIndex: PLING_UI_Z_INDEX } as CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: DOCK_STYLES }} />
      {open ? (
        <section
          className={`pling-dock__panel${ui.classNames.panel ? ` ${ui.classNames.panel}` : ""}`}
          aria-label={titleText}
        >
          {notReadyText ? <p className="pling-dock__warn">{notReadyText}</p> : null}

          {quick.length && tab === "chat" ? (
            <div className="pling-dock__quick">
              {quick.map((task) => (
                <button key={task} type="button" disabled={running} onClick={() => void send(task)}>
                  {task}
                </button>
              ))}
            </div>
          ) : null}

          <header className="pling-dock__bar">
            {!gateActive ? (
              <span className="pling-dock__gate" title={t("dock.gate.offTitle")}>
                {t("dock.gate.off")}
              </span>
            ) : null}
            <button type="button" className="pling-dock__ghost" onClick={clear}>{t("dock.clear")}</button>
            {layout !== "inline" ? (
              <button type="button" className="pling-dock__ghost" onClick={() => toggle(false)}>
                {t("dock.collapse")}
              </button>
            ) : null}
          </header>

          <nav className="pling-dock__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "chat"}
              className={tab === "chat" ? "is-active" : undefined}
              onClick={() => setTab("chat")}
            >
              {t("dock.tab.chat")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "activity"}
              className={tab === "activity" ? "is-active" : undefined}
              onClick={() => setTab("activity")}
            >
              {t("dock.tab.activity")}
              {activityRows.length ? (
                <span className={`pling-dock__badge${failedCount ? " is-bad" : ""}`}>{activityRows.length}</span>
              ) : null}
            </button>
          </nav>

          {tab === "activity" ? (
            <>
              <div className="pling-dock__run">
                <div className="pling-dock__diagnostics">
                  <span className="pling-dock__model" title={limitsHint}>
                    {runtime.model || t("dock.model.unconfigured")}
                  </span>
                  <span className="pling-dock__usage">{summary}</span>
                </div>
                <div className="pling-dock__run-head">
                  <p className="pling-dock__run-label">{t("dock.run.actions")}</p>
                  {debugEnabled ? (
                    <button
                      type="button"
                      className={`pling-dock__run-toggle${debugOpen ? " is-active" : ""}`}
                      aria-expanded={debugOpen}
                      data-testid="pling-debug-toggle"
                      onClick={() => setDebugOpen((value) => !value)}
                    >
                      {t("debug.title")}
                    </button>
                  ) : null}
                </div>
                <ol className="pling-dock__activity">
                  {activityRows.map((row) => (
                    <li key={row.seq} className="pling-dock__row">
                      <p className="pling-dock__row-head">
                        <code>{row.id}</code>
                        <span className={`pling-dock__state is-${row.status}`}>{t(`dock.state.${row.status}`)}</span>
                        {row.description ? <span className="pling-dock__desc">{row.description}</span> : null}
                      </p>
                      {Object.keys(row.args).length ? (
                        <pre className="pling-dock__args">{showText(JSON.stringify(row.args))}</pre>
                      ) : null}
                      {row.detail ? <p className="pling-dock__detail">{showText(row.detail)}</p> : null}
                    </li>
                  ))}
                  {!activityRows.length ? (
                    <li className="pling-dock__empty">{t("dock.activity.empty")}</li>
                  ) : null}
                </ol>
                {debugEnabled && debugOpen && runtime.trace ? (
                  <AgentDebug runtime={runtime} registry={registry} />
                ) : null}
              </div>
            </>
          ) : (
            <AgentChat
              title={titleText}
              placeholder={placeholderText}
              emptyHint={emptyHintText}
              ui={ui}
              className={ui.classNames.chat}
              events={events}
              running={running}
              pending={pending}
              pendingHandoff={pendingHandoff}
              resume={resume}
              reveal={showText}
              onSend={(text) => void send(text)}
              onResume={resumeTask}
              onDismissResume={dismissResume}
              onReply={(decision) => runtime.approvals.reply(decision)}
              onHandoff={(done) => runtime.handoffs.reply(done)}
              onHandoffStep={(delta) => runtime.handoffs.moveStep(delta)}
              onStop={() => runtime.session.cancel()}
            />
          )}

        </section>
      ) : null}

      {layout !== "inline" ? (
        <button
          type="button"
          className={`pling-dock__launcher${open ? " is-open" : ""}${ui.classNames.launcher ? ` ${ui.classNames.launcher}` : ""}`}
          aria-expanded={open}
          title={open ? t("dock.launcher.close") : resume ? t("dock.launcher.resume") : launcherOpenText}
          onClick={() => toggle()}
        >
          {open
            ? t("dock.launcher.close")
            : resume
              ? t("dock.launcher.resume")
              : launcherOpenText}
          {running || (!open && resume) ? <span className="pling-dock__dot" aria-hidden="true" /> : null}
        </button>
      ) : null}
    </div>
  );
});

function describeUsage(runtime: AgentRuntime, usedTokens: number, t: PlingUiController["t"]): string {
  const data = runtime.telemetry.summary();
  const parts = [
    t("dock.summary.context", {
      used: usedTokens,
      total: runtime.limits.contextTokens,
      compact: compactAt(runtime.limits),
    }),
    t("dock.summary.turns", {
      used: runtime.session.loop.turnsUsed,
      max: runtime.limits.maxTurns,
    }),
  ];
  if (data.llmCalls) parts.push(t("dock.summary.calls", { count: data.llmCalls }));
  if (data.retries) parts.push(t("dock.summary.retries", { count: data.retries }));
  if (data.retryExhausted) parts.push(t("dock.summary.exhausted", { count: data.retryExhausted }));
  return parts.join(" · ");
}

const DOCK_STYLES = `
.pling-dock{position:fixed;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:flex-end;gap:10px;color:var(--pling-color-text,#0f172a);font-family:var(--pling-font-family,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif);font-size:13px;text-align:left}
.pling-dock__panel{display:flex;flex-direction:column;gap:6px;width:min(400px,calc(100vw - 48px));height:min(600px,calc(100vh - 120px));padding:12px;border:1px solid var(--pling-color-border,#dbe7f5);border-radius:var(--pling-radius-lg,14px);background:var(--pling-color-surface,#fff);box-shadow:var(--pling-shadow-panel,0 18px 48px rgb(15 23 42 / 18%))}
.pling-dock__panel .pling-chat{flex:1;min-height:0;padding:0;border:0;border-radius:0}
.pling-dock__warn{margin:0;padding:8px 10px;border:1px solid var(--pling-color-warning,#fdba74);border-radius:var(--pling-radius-md,8px);background:var(--pling-color-warning-soft,#fff7ed);color:var(--pling-color-warning,#9a3412);font-size:12px}
.pling-dock__quick{display:flex;flex-wrap:wrap;gap:6px}
.pling-dock__quick button{padding:3px 8px;border:1px solid var(--pling-color-primary-soft,#bae6fd);border-radius:999px;background:var(--pling-color-primary-soft,#f0f9ff);color:var(--pling-color-primary-strong,#0369a1);font:inherit;font-size:12px;cursor:pointer}
.pling-dock__quick button:disabled{opacity:.5;cursor:not-allowed}
.pling-dock__bar{display:flex;align-items:center;gap:6px}
.pling-dock__model{max-width:150px;overflow:hidden;padding:1px 6px;border-radius:999px;background:var(--pling-color-primary-soft,#eff6ff);color:var(--pling-color-primary-strong,#0369a1);font-size:11px;white-space:nowrap;text-overflow:ellipsis}
.pling-dock__gate{color:var(--pling-color-warning,#b45309);font-size:11px;white-space:nowrap}
.pling-dock__ghost{padding:2px 4px;border:0;background:none;color:var(--pling-color-text-muted,#64748b);font:inherit;font-size:12px;cursor:pointer}
.pling-dock__ghost:last-child{margin-left:auto}
.pling-dock__tabs{display:flex;gap:4px;margin:2px 0 6px;border-bottom:1px solid var(--pling-color-border-muted,#e2e8f0)}
.pling-dock__tabs button{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:0;border-bottom:2px solid transparent;background:none;color:var(--pling-color-text-muted,#64748b);font:inherit;font-size:12px;cursor:pointer}
.pling-dock__tabs button.is-active{border-bottom-color:var(--pling-color-primary,#2e9df7);color:var(--pling-color-primary-strong,#0369a1)}
.pling-dock__badge{padding:0 5px;border-radius:999px;background:var(--pling-color-primary-soft,#eff6ff);color:var(--pling-color-primary-strong,#0369a1);font-size:11px}
.pling-dock__badge.is-bad{background:var(--pling-color-danger-soft,#fee2e2);color:var(--pling-color-danger,#b91c1c)}
.pling-dock__run{display:flex;flex:1;min-height:0;flex-direction:column;gap:4px;overflow:auto}
.pling-dock__run-head{display:flex;flex:none;align-items:center;justify-content:space-between;gap:8px;padding:2px 4px}
.pling-dock__run-label{margin:0;color:var(--pling-color-text-subtle,#94a3b8);font-size:11px}
.pling-dock__run-toggle{padding:1px 6px;border:1px solid var(--pling-color-border,#e3e8f0);border-radius:6px;background:var(--pling-color-surface,#fff);color:var(--pling-color-text-muted,#64748b);font:inherit;font-size:11px;cursor:pointer}
.pling-dock__run-toggle.is-active{border-color:var(--pling-color-primary-soft,#bae6fd);background:var(--pling-color-primary-soft,#f0f9ff);color:var(--pling-color-primary-strong,#0369a1)}
.pling-dock__activity{flex:none;margin:0;padding:4px 4px 4px 22px;font-size:12px}
.pling-dock__diagnostics{display:flex;flex:none;align-items:center;flex-wrap:wrap;gap:4px 8px;padding:2px 4px 6px;border-bottom:1px solid var(--pling-color-border-muted,#f1f5f9)}
.pling-dock__diagnostics .pling-dock__usage{flex:1 1 180px;min-width:0;line-height:1.45}
.pling-dock__row{margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--pling-color-border-muted,#f1f5f9)}
.pling-dock__row:last-child{border-bottom:0}
.pling-dock__row-head{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin:0}
.pling-dock__activity code{color:var(--pling-color-text,#0f172a);word-break:break-all}
.pling-dock__state{flex:none;color:var(--pling-color-text-muted,#64748b)}
.pling-dock__state.is-running{color:var(--pling-color-primary-strong,#0369a1)}
.pling-dock__state.is-ok{color:var(--pling-color-success,#15803d)}
.pling-dock__state.is-failed,.pling-dock__state.is-blocked{color:var(--pling-color-danger,#b91c1c)}
.pling-dock__desc{color:var(--pling-color-text-muted,#64748b)}
.pling-dock__args{margin:2px 0 0;padding:4px 6px;border-radius:var(--pling-radius-sm,6px);background:var(--pling-color-surface-muted,#f8fafc);color:var(--pling-color-text-muted,#334155);font-family:var(--pling-font-family-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11px;white-space:pre-wrap;word-break:break-all}
.pling-dock__detail{margin:2px 0 0;color:var(--pling-color-text-subtle,#94a3b8)}
.pling-dock__activity .pling-dock__empty{margin-left:-16px;color:var(--pling-color-text-subtle,#94a3b8);line-height:1.6;list-style:none}
.pling-dock__usage{margin:0;color:var(--pling-color-text-subtle,#94a3b8);font-size:11px;font-variant-numeric:tabular-nums}
.pling-dock__launcher{position:relative;padding:10px 16px;border:0;border-radius:999px;background:var(--pling-color-primary,#2e9df7);color:var(--pling-color-on-primary,#fff);font:inherit;font-size:13px;box-shadow:var(--pling-shadow-launcher,0 10px 24px rgb(46 157 247 / 32%));cursor:pointer}
.pling-dock__launcher.is-open{background:var(--pling-color-text-muted,#475569);box-shadow:none}
.pling-dock__dot{position:absolute;top:6px;right:8px;width:7px;height:7px;border-radius:50%;background:var(--pling-color-warning,#fbbf24);animation:pling-dock-pulse 1s ease-in-out infinite}
.pling-dock--sidebar{top:0;bottom:0;height:100dvh;gap:0;pointer-events:none}
.pling-dock--sidebar>*{pointer-events:auto}
.pling-dock--sidebar.pling-dock--right{right:0;left:auto;align-items:flex-end}
.pling-dock--sidebar.pling-dock--left{right:auto;left:0;align-items:flex-start}
.pling-dock--sidebar .pling-dock__panel{width:var(--pling-sidebar-width,min(420px,100vw));height:100%;border-top:0;border-bottom:0;border-radius:0;box-shadow:var(--pling-shadow-sidebar,0 0 40px rgb(15 23 42 / 18%))}
.pling-dock--sidebar.pling-dock--right .pling-dock__panel{border-right:0}
.pling-dock--sidebar.pling-dock--left .pling-dock__panel{border-left:0}
.pling-dock--sidebar .pling-dock__launcher{position:absolute;top:auto;bottom:24px;padding:10px 16px;writing-mode:horizontal-tb}
.pling-dock--sidebar.pling-dock--right.pling-dock--launcher-bottom .pling-dock__launcher{right:16px}
.pling-dock--sidebar.pling-dock--left.pling-dock--launcher-bottom .pling-dock__launcher{left:16px}
.pling-dock--sidebar.pling-dock--launcher-center .pling-dock__launcher{top:50%;bottom:auto;transform:translateY(-50%);padding:14px 8px;writing-mode:vertical-rl}
.pling-dock--sidebar.pling-dock--right.pling-dock--launcher-center .pling-dock__launcher{right:0}
.pling-dock--sidebar.pling-dock--left.pling-dock--launcher-center .pling-dock__launcher{left:0}
.pling-dock--sidebar.is-open .pling-dock__launcher{display:none}
.pling-dock--inline{position:relative;right:auto;bottom:auto;width:100%;align-items:stretch;gap:0}
.pling-dock--inline .pling-dock__panel{width:100%;height:var(--pling-inline-height,min(640px,calc(100vh - 96px)))}
@media (max-width:720px){
  .pling-dock--sidebar{top:auto;bottom:12px;height:auto;width:auto}
  .pling-dock--sidebar.pling-dock--right{right:12px;left:auto}
  .pling-dock--sidebar.pling-dock--left{right:auto;left:12px}
  .pling-dock--sidebar .pling-dock__panel{width:min(400px,calc(100vw - 24px));height:min(640px,calc(100dvh - 72px));border:1px solid var(--pling-color-border,#e3e8f0);border-radius:var(--pling-radius-lg,12px);box-shadow:var(--pling-shadow-panel,0 18px 40px rgb(15 23 42 / 16%))}
  .pling-dock--sidebar .pling-dock__launcher{position:relative;top:auto;bottom:auto;left:auto;right:auto;transform:none;padding:10px 16px;writing-mode:horizontal-tb}
}
@keyframes pling-dock-pulse{50%{opacity:.3}}
@media (prefers-reduced-motion:reduce){.pling-dock__dot{animation:none}}
`;
