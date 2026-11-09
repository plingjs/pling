import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
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
import { PLING_UI_Z_INDEX, ensurePlingStyles, sameOriginUrl, type PlingAskOptions } from "@plingjs/dom";
import {
  describePlingDiagnostic,
  diagnosticMessageKey,
  quickTaskOf,
  type PlingUiController,
  type QuickTaskItem,
} from "@plingjs/ui";
import { AgentChat } from "./AgentChat";
import { AgentDebug } from "./AgentDebug";
import { usePling, usePlingUi } from "./context";
import { readViteEnv } from "./env";

export interface AgentDockProps {
  /** Extra class for the shell, typically for page-grid sizing. */
  className?: string;
  title?: string;
  /** Optional task card rendered inside the conversation, after its messages. */
  task?: ReactNode;
  placeholder?: string;
  emptyHint?: string;
  /** 推荐指令：点一下等于把这句话发出去。 */
  quick?: readonly QuickTaskItem[];
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
  /** `overlay` keeps the sidebar above the page; `fused` lets it occupy a grid column. */
  sidebarMode?: "overlay" | "fused";
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
  open(): void;
  close(): void;
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
  task,
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
  sidebarMode = "fused",
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
  const quickItems = quick.map(quickTaskOf);
  const registry = registryProp ?? pling.registry;
  const setup = pling.agent ?? {};
  const traceOption = debug !== undefined ? debug : setup.trace;
  const debugEnabled = Boolean(traceOption);
  const propsRef = useRef({ onSessionEvent, onOpenChange });
  propsRef.current = { onSessionEvent, onOpenChange };

  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<"chat" | "activity">("chat");
  const [debugOpen, setDebugOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
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
      taskCatalog: pling.task,
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
    ensurePlingStyles();
  }, []);

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
    setQuickMenuOpen(false);
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
    open: () => toggle(true),
    close: () => toggle(false),
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
    setQuickMenuOpen(false);
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
    ...(layout === "sidebar" && sidebarMode === "fused" ? ["pling-dock--fused"] : []),
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
      data-sidebar-mode={layout === "sidebar" ? sidebarMode : undefined}
      data-launcher-placement={layout === "sidebar" ? launcherPlacement : undefined}
      style={{ ...uiSnapshot.cssVars, zIndex: PLING_UI_Z_INDEX } as CSSProperties}
    >
      {open ? (
        <section
          className={`pling-dock__panel${ui.classNames.panel ? ` ${ui.classNames.panel}` : ""}`}
          aria-label={titleText}
        >
          {notReadyText ? <p className="pling-dock__warn">{notReadyText}</p> : null}

          <div className="pling-dock__nav">
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
            <div className="pling-dock__actions">
              {quickItems.length ? (
                <div className="pling-dock__action-wrap">
                  <button
                    type="button"
                    className={`pling-dock__ghost${quickMenuOpen ? " is-active" : ""}`}
                    aria-label={t("dock.pageActions")}
                    aria-expanded={quickMenuOpen}
                    title={t("dock.pageActions")}
                    onClick={() => setQuickMenuOpen((value) => !value)}
                  >
                    <svg className="pling-dock__icon" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M4 5.5h12M4 10h12M4 14.5h8" />
                    </svg>
                  </button>
                  {quickMenuOpen ? (
                    <div className="pling-dock__actions-menu" role="menu">
                      <header>
                        <strong>{t("dock.pageActions")}</strong>
                        <span>{t("dock.pageActionsHint")}</span>
                      </header>
                      {quickItems.map((task, index) => (
                        <button
                          key={`${task.prompt}:${index}`}
                          type="button"
                          role="menuitem"
                          disabled={running || task.disabled}
                          title={task.description}
                          onClick={() => {
                            setQuickMenuOpen(false);
                            void send(task.prompt);
                          }}
                        >
                          <span>{task.label}</span>
                          {task.description ? <small>{task.description}</small> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                className="pling-dock__ghost"
                aria-label={t("dock.clear")}
                title={t("dock.clear")}
                onClick={clear}
              >
                <svg className="pling-dock__icon" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M4 4.5h12v9H9l-4 3v-3H4z" />
                  <path d="M8 7.5l4 4M12 7.5l-4 4" />
                </svg>
              </button>
              {layout !== "inline" ? (
                <button
                  type="button"
                  className="pling-dock__ghost"
                  aria-label={t("dock.collapse")}
                  title={t("dock.collapse")}
                  onClick={() => toggle(false)}
                >
                  <svg className="pling-dock__icon" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M5 8l5 5 5-5" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          {running ? (
            <div className="pling-dock__running">
              <span className="pling-dock__running-dot" aria-hidden="true" />
              <span>{t("chat.running")}</span>
              <button
                type="button"
                className="stop pling-chat__stop"
                onClick={() => runtime.session.cancel()}
              >
                {t("chat.stop")}
              </button>
            </div>
          ) : null}

          {tab === "activity" ? (
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
          ) : (
            <AgentChat
              title={titleText}
              task={task}
              taskPlacement="pinned"
              placeholder={placeholderText}
              emptyHint={emptyHintText}
              ui={ui}
              className={ui.classNames.chat}
              showHeader={false}
              speakers
              multiline
              quick={quickItems}
              events={events}
              running={running}
              pending={pending}
              pendingHandoff={pendingHandoff}
              resume={resume}
              reveal={showText}
              onSend={(text) => void send(text)}
              onQuick={(text) => void send(text)}
              onResume={resumeTask}
              onDismissResume={dismissResume}
              onReply={(decision) => runtime.approvals.reply(decision)}
              onHandoff={(done) => runtime.handoffs.reply(done)}
              onHandoffStep={(delta) => runtime.handoffs.moveStep(delta)}
              onStop={() => runtime.session.cancel()}
            />
          )}

          {!gateActive ? (
            <footer className="pling-dock__status">
              <span className="pling-dock__gate" title={t("dock.gate.offTitle")}>
                {t("dock.gate.off")}
              </span>
            </footer>
          ) : null}
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

