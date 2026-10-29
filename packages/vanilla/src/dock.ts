import {
  compactAt,
  createAgentRuntime,
  resolveAgentConfig,
  toActivityRows,
  toTranscriptLines,
  type AgentRuntime,
  type ContinuityTaskSummary,
  type PendingApproval,
  type PendingHandoff,
  type SessionEvent,
} from "@plingjs/agent";
import { supportsAlwaysAllow } from "@plingjs/core";
import { PLING_UI_Z_INDEX, sameOriginUrl } from "@plingjs/dom";
import { describePlingDiagnostic, diagnosticMessageKey } from "@plingjs/ui";
import { readViteEnv } from "./env";
import { renderMarkdown } from "./markdown";
import { DOCK_STYLES } from "./dock-styles";
import type { VanillaDock, VanillaDockOptions, VanillaHost } from "./types";

const RESUME_INSTRUCTION =
  "Continue the previous task. Inspect the current page before deciding the next step; if the previous page's action result is unknown, do not assume it succeeded.";

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(
  text: string,
  className: string | undefined,
  onClick: () => void,
): HTMLButtonElement {
  const element = make("button", className, text);
  element.type = "button";
  element.addEventListener("click", onClick);
  return element;
}

/**
 * 原生 JS 的悬浮问答入口。
 *
 * 这里只负责 DOM 状态与渲染：会话循环、模型配置、确认 / 人工接力队列、
 * 事件流与运行页全部直接复用 `@plingjs/agent`，不另写一套执行逻辑。
 */
export function createDock(host: VanillaHost, options: VanillaDockOptions = {}): VanillaDock {
  const ui = host.ui;
  const t = ui.t;
  const setup = host.agent ?? {};
  const registry = options.registry ?? host.registry;
  const config = resolveAgentConfig({
    env: readViteEnv(),
    config: { ...(setup.config ?? {}), ...(options.config ?? {}) },
  });
  registry.setDefaultApproval(config.defaultApproval);

  let open = options.defaultOpen ?? false;
  let tab: "chat" | "activity" | "tasks" = "chat";
  let events: SessionEvent[] = [];
  let running = false;
  let pending: PendingApproval | null = null;
  let pendingHandoff: PendingHandoff | null = null;
  let taskRows: ContinuityTaskSummary[] = [];
  let taskBusy = false;
  let taskError = "";
  let taskSignature = "";
  let notReady = false;
  let destroyed = false;
  let resumeDismissed = false;
  let returnTimer: ReturnType<typeof setTimeout> | null = null;

  const root = make("div", "pling-dock");
  root.dataset.plingUi = "";
  root.style.zIndex = String(PLING_UI_Z_INDEX);
  const style = make("style");
  style.textContent = DOCK_STYLES;
  root.append(style);

  const panel = make("section", "pling-dock__panel");
  panel.className = `pling-dock__panel${ui.classNames.panel ? ` ${ui.classNames.panel}` : ""}`;
  panel.setAttribute("aria-label", t("dock.assistant"));

  const warn = make("p", "pling-dock__warn");
  warn.hidden = true;

  const quick = make("div", "pling-dock__quick");
  const quickButtons = (options.quick ?? []).map((task) =>
    button(task, undefined, () => void send(task)),
  );
  quick.append(...quickButtons);
  quick.hidden = !quickButtons.length;

  const bar = make("header", "pling-dock__bar");
  const gateHint = make("span", "pling-dock__gate", t("dock.gate.off"));
  gateHint.title = t("dock.gate.offTitle");
  const clearButton = button(t("dock.clear"), "pling-dock__ghost", () => clear());
  const closeButton = button(t("dock.collapse"), "pling-dock__ghost", () => setOpen(false));
  bar.append(gateHint, clearButton, closeButton);

  const tabs = make("nav", "pling-dock__tabs");
  tabs.setAttribute("role", "tablist");
  const chatTab = button(t("dock.tab.chat"), undefined, () => setTab("chat"));
  const activityTab = button(t("dock.tab.activity"), undefined, () => setTab("activity"));
  const tasksTab = button(t("dock.tab.tasks"), undefined, () => setTab("tasks"));
  chatTab.setAttribute("role", "tab");
  activityTab.setAttribute("role", "tab");
  tasksTab.setAttribute("role", "tab");
  const badge = make("span", "pling-dock__badge");
  activityTab.append(badge);
  tabs.append(chatTab, activityTab, tasksTab);

  const roleHint = make("p", "pling-dock__role");
  roleHint.hidden = true;

  const body = make("div", "pling-dock__body");

  const chat = make("section", "pling-chat pling-dock__view");
  const chatHead = make("header", "pling-chat__head");
  const chatTitle = make("strong", undefined, options.title ?? t("dock.assistant"));
  const runningHint = make("span", "pling-chat__running", t("chat.running"));
  const stopButton = button(t("chat.stop"), "pling-chat__stop", () => runtime.session.cancel());
  runningHint.hidden = true;
  stopButton.hidden = true;
  chatHead.append(chatTitle, runningHint, stopButton);

  const transcript = make("div", "pling-chat__transcript");
  transcript.setAttribute("aria-live", "polite");
  const pendingHost = make("div", "pling-chat__pending");

  const form = make("form", "pling-chat__composer");
  const input = make("input");
  input.placeholder = options.placeholder ?? t("chat.placeholder");
  input.setAttribute("aria-label", input.placeholder);
  const sendButton = make("button", undefined, t("chat.send"));
  sendButton.type = "submit";
  sendButton.disabled = true;
  form.append(input, sendButton);
  chat.append(chatHead, transcript, pendingHost, form);

  const activityView = make("section", "pling-dock__view pling-dock__activity-view");
  activityView.hidden = true;
  const diagnostics = make("div", "pling-dock__diagnostics");
  const model = make("span", "pling-dock__model");
  const usage = make("span", "pling-dock__usage");
  diagnostics.append(model, usage);
  const activityList = make("ol", "pling-dock__activity");
  activityView.append(diagnostics, activityList);

  const tasksView = make("section", "pling-dock__view pling-dock__tasks");
  tasksView.hidden = true;
  const tasksIntro = make("p", "pling-dock__tasks-intro");
  const tasksList = make("ul", "pling-dock__task-list");
  tasksView.append(tasksIntro, tasksList);

  body.append(chat, activityView, tasksView);
  panel.append(warn, quick, bar, tabs, roleHint, body);

  const launcher = button(t("dock.launcher.open"), "pling-dock__launcher", () => toggle());
  launcher.className = `pling-dock__launcher${ui.classNames.launcher ? ` ${ui.classNames.launcher}` : ""}`;
  chat.className = `pling-chat pling-dock__view${ui.classNames.chat ? ` ${ui.classNames.chat}` : ""}`;
  root.append(launcher);
  document.body.append(root);

  const runtime: AgentRuntime = createAgentRuntime({
    ...setup,
    ...(options.hooks ?? setup.hooks ? { hooks: options.hooks ?? setup.hooks } : {}),
    config,
    registry,
    responseLocale: setup.responseLocale ?? (() => ui.locale),
    ...(options.llm ?? setup.llm ? { llm: options.llm ?? setup.llm } : {}),
    ...(options.gate ?? setup.gate ? { gate: options.gate ?? setup.gate } : {}),
    onEvent(event) {
      // 新任务会让会话清空事件；用户消息到达时以会话为准，避免聊天里残留上一个任务的上下文。
      if (event.type === "user") events = [...runtime.session.events()];
      else events.push(event);
      if (event.type === "final") queueReturn();
      setup.onEvent?.(event);
      options.onSessionEvent?.(event);
      render();
    },
    onApproval(request) {
      pending = request;
      setup.onApproval?.(request);
      render();
    },
    onHandoff(request) {
      pendingHandoff = request;
      setup.onHandoff?.(request);
      render();
    },
  });
  // 整页导航恢复出来的事件在会话里，不在本次 document 的 onEvent 回调里。
  events = [...runtime.session.events()];

  const unsubscribeContinuity = runtime.continuity.subscribe(() => {
    if (!browserScope()) return;
    // follow / takeover / fork 会整体替换会话历史；订阅变化时以会话为准，
    // 否则浮窗会继续显示上一个标签页的事件流。
    events = [...runtime.session.events()];
    void refreshTasks();
    render();
  });
  const unsubscribeUi = ui.subscribe(() => {
    if (!destroyed) render();
  });
  void refreshTasks();

  function cancelReturn(): void {
    if (returnTimer === null) return;
    clearTimeout(returnTimer);
    returnTimer = null;
  }

  /**
   * 只有会话层确认「这是恢复中的任务、已经产生 final」时才会给出目标。
   * 返回地址再过一次同源校验，避免提示注入或配置失误把用户带出站。
   */
  function queueReturn(): void {
    const target = runtime.continuity.claimReturn();
    if (!target) return;
    const href = sameOriginUrl(target.href);
    if (!href) return;
    cancelReturn();
    returnTimer = setTimeout(() => {
      returnTimer = null;
      if (destroyed) return;
      (options.navigate ?? ((url: string) => window.location.replace(url)))(href);
    }, target.delayMs);
  }

  function shown(text: string): string {
    return host.revealSensitive ? registry.tokens.resolve(text) : text;
  }

  function setOpen(next: boolean): void {
    if (destroyed || open === next) return;
    open = next;
    render();
    options.onOpenChange?.(open);
    if (open) input.focus();
  }

  function toggle(): void {
    setOpen(!open);
  }

  function setTab(next: "chat" | "activity" | "tasks"): void {
    if (tab === next) return;
    tab = next;
    if (next === "tasks") void refreshTasks();
    render();
  }

  function browserScope(): boolean {
    return runtime.continuity.scope !== "tab";
  }

  function roleText(): string {
    const continuity = runtime.continuity;
    if (continuity.leaseLost) return t("dock.role.leaseLost");
    if (continuity.role === "owner") return t("dock.role.owner");
    if (continuity.role === "follower") {
      if (continuity.completed) return t("dock.role.followerDone");
      return t("dock.role.follower");
    }
    return t("dock.role.unbound");
  }

  async function refreshTasks(): Promise<void> {
    if (!browserScope()) return;
    try {
      taskRows = await runtime.continuity.tasks();
      taskError = "";
    } catch (error) {
      taskError = error instanceof Error ? error.message : String(error);
    }
    if (!destroyed) render();
  }

  async function runTaskAction(action: () => Promise<void>): Promise<void> {
    if (taskBusy) return;
    taskBusy = true;
    taskError = "";
    render();
    try {
      await action();
    } catch (error) {
      taskError = error instanceof Error ? error.message : String(error);
    } finally {
      taskBusy = false;
      await refreshTasks();
      render();
    }
  }

  function taskStateText(row: ContinuityTaskSummary, current: boolean): string {
    if (current && runtime.continuity.role === "owner") return t("dock.task.state.owner");
    if (current && runtime.continuity.role === "follower") return t("dock.task.state.follower");
    if (row.ownerActive) return t("dock.task.state.remote");
    if (row.status === "done") return t("dock.task.state.done");
    return t("dock.task.state.idle");
  }

  function renderTasks(): void {
    if (!browserScope()) return;
    const continuity = runtime.continuity;
    // 检查点会频繁更新；用稳定签名避免每一步都替换 DOM，否则用户/自动化正在点的按钮会被抽走。
    const signature = [
      continuity.role,
      continuity.leaseLost,
      continuity.sessionId ?? "",
      taskBusy,
      taskError,
      ...taskRows.map((row) =>
        [row.sessionId, row.status, row.goal ?? "", row.ownerActive].join(":"),
      ),
    ].join("|");
    if (signature === taskSignature) return;
    taskSignature = signature;
    tasksIntro.textContent = continuity.leaseLost
      ? t("dock.tasks.intro.leaseLost")
      : continuity.role === "owner"
        ? t("dock.tasks.intro.owner")
        : t("dock.tasks.intro.follower");

    const nodes: HTMLElement[] = [];
    if (taskError) nodes.push(make("li", "pling-dock__task-error", taskError));
    for (const row of taskRows) {
      const current = row.sessionId === continuity.sessionId;
      const ownerHere = current && continuity.role === "owner" && !continuity.leaseLost;
      const item = make("li", `pling-dock__task${current ? " is-current" : ""}`);
      const head = make("div", "pling-dock__task-head");
      head.append(
        make("strong", undefined, shown(row.goal || t("dock.task.untitled"))),
        make(
          "span",
          `pling-dock__tag${ownerHere ? " is-owner" : row.ownerActive ? " is-remote" : ""}`,
          taskStateText(row, current),
        ),
      );
      item.append(head);
      const meta = make("p", "pling-dock__meta");
      meta.textContent = t("dock.task.updated", {
        id: row.sessionId,
        time: new Date(row.updatedAt).toLocaleTimeString(ui.locale, {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      item.append(meta);

      if (!ownerHere) {
        const actions = make("div", "pling-dock__task-actions");
        if (!current) {
          actions.append(
            button(t("dock.task.follow"), undefined, () => {
              void runTaskAction(() => continuity.follow(row.sessionId));
            }),
          );
        }
        actions.append(
          button(t("dock.task.fork"), undefined, () => {
            void runTaskAction(async () => {
              await continuity.fork(row.sessionId);
              setTab("chat");
              input.focus();
            });
          }),
        );
        if (row.status !== "done") {
          actions.append(
            button(
              continuity.leaseLost ? t("dock.task.retake") : t("dock.task.takeover"),
              undefined,
              () => {
                void runTaskAction(() => continuity.takeover(row.sessionId));
              },
            ),
          );
        }
        if (taskBusy) {
          actions.querySelectorAll("button").forEach((item) => {
            item.disabled = true;
          });
        }
        item.append(actions);
      }
      nodes.push(item);
    }

    if (!nodes.length) {
      nodes.push(
        make(
          "li",
          "pling-dock__task-empty",
          t("dock.task.empty"),
        ),
      );
    }
    tasksList.replaceChildren(...nodes);
  }

  function renderLauncher(): void {
    launcher.classList.toggle("is-open", open);
    launcher.replaceChildren(
      document.createTextNode(
        open
          ? t("dock.launcher.close")
          : resumePending()
            ? t("dock.launcher.resume")
            : t("dock.launcher.open"),
      ),
    );
    if (running || (!open && resumePending())) {
      const dot = make("span", "pling-dock__dot");
      dot.setAttribute("aria-hidden", "true");
      launcher.append(dot);
    }
  }

  function resumePending(): boolean {
    // 跨标签页由「任务」区承载跟随 / 接管，不再弹整页导航式的「继续上次任务」。
    if (runtime.continuity.scope !== "tab") return false;
    if (runtime.continuity.resume === "off") return false;
    const checkpoint = runtime.continuity.restored ? runtime.continuity.checkpoint : null;
    return Boolean(checkpoint && checkpoint.status === "active" && !resumeDismissed);
  }

  function renderResume(): HTMLElement | null {
    if (!resumePending()) return null;
    const checkpoint = runtime.continuity.checkpoint!;
    const box = make("div", "pling-chat__resume");
    box.append(
      make(
        "strong",
        undefined,
        checkpoint.goal
          ? t("chat.resume.goal", { goal: checkpoint.goal })
          : t("chat.resume.pending"),
      ),
    );
    if (checkpoint.interrupted) {
      box.append(
        make(
          "p",
          "pling-chat__resume-hint",
          t("chat.resume.interrupted"),
        ),
      );
    }
    box.append(
      make("p", "pling-chat__resume-hint", t("chat.resume.record")),
    );
    const answers = make("div", "pling-chat__answers");
    answers.append(
      button(t("chat.resume.continue"), undefined, () => {
        resumeDismissed = true;
        render();
        void send(RESUME_INSTRUCTION);
      }),
      button(t("chat.resume.dismiss"), "is-reject", () => {
        resumeDismissed = true;
        clear();
      }),
    );
    box.append(answers);
    return box;
  }

  function renderTranscript(): void {
    const lines = toTranscriptLines(events, { tools: false, locale: ui.locale, translate: t });
    const nodes: HTMLElement[] = [];
    const resume = renderResume();
    if (resume) nodes.push(resume);
    if (!lines.length) {
      nodes.push(
        make(
          "p",
          "pling-chat__empty",
          options.emptyHint ?? t("chat.empty"),
        ),
      );
    }

    for (const line of lines) {
      if (line.kind === "user") {
        nodes.push(make("p", "pling-chat__line is-user", shown(line.text)));
        continue;
      }
      if (line.kind === "final" || line.kind === "assistant") {
        const bubble = make("div", `pling-chat__line is-${line.kind} is-markdown`);
        bubble.innerHTML = renderMarkdown(shown(line.text));
        nodes.push(bubble);
        continue;
      }
      if (line.kind === "notice") {
        nodes.push(make("p", "pling-chat__line is-notice", shown(line.text)));
        continue;
      }
      if (line.kind === "cancelled") {
        nodes.push(make("p", "pling-chat__line is-notice", t("chat.cancelled")));
        continue;
      }
      if (line.kind === "error") {
        nodes.push(make("p", "pling-chat__line is-error", shown(line.text)));
        continue;
      }
      if (line.kind === "blocked") {
        nodes.push(make("p", "pling-chat__line is-blocked", shown(line.text)));
        continue;
      }
      if (line.kind === "call" || line.kind === "result") {
        nodes.push(
          make(
            "p",
            `pling-chat__line is-${line.kind}${line.kind === "result" && line.ok ? " is-ok" : ""}`,
            line.kind === "call" ? `${line.id} ${shown(line.args)}` : `${line.id} ${shown(line.detail)}`,
          ),
        );
      }
    }

    if (running && !pending && !pendingHandoff) {
      const executing = make("p", "pling-chat__line is-executing");
      const dot = make("span", "pling-chat__dot");
      dot.setAttribute("aria-hidden", "true");
      executing.append(dot, document.createTextNode(t("chat.executing")));
      nodes.push(executing);
    }

    transcript.replaceChildren(...nodes);
    transcript.scrollTop = transcript.scrollHeight;
  }

  function renderPending(): void {
    pendingHost.replaceChildren();
    if (pendingHandoff) {
      const steps = pendingHandoff.request.steps ?? [];
      const step = pendingHandoff.step;
      const last = step >= steps.length - 1;
      const box = make("div", "pling-chat__handoff");
      const ask = make("div", "pling-chat__ask");
      ask.append(
        make(
          "strong",
          undefined,
          steps.length
            ? t("chat.handoff.step", { current: step + 1, total: steps.length })
            : t("chat.handoff.takeover"),
        ),
        make("code", undefined, pendingHandoff.request.id),
      );
      box.append(ask, make("p", "pling-chat__reason", shown(pendingHandoff.request.reason)));

      if (steps.length) {
        const list = make("ol", "pling-chat__steps");
        steps.forEach((item, index) => {
          const row = make(
            "li",
            index === step ? "is-current" : index < step ? "is-done" : undefined,
          );
          row.append(
            make("span", "pling-chat__num", String(index + 1)),
            make("span", undefined, shown(item.text)),
          );
          list.append(row);
        });
        box.append(list);
      }

      box.append(
        make(
          "p",
          "pling-chat__hint",
          steps.length
            ? t("chat.handoff.follow")
            : t("chat.handoff.completeHint"),
        ),
      );

      const answers = make("div", "pling-chat__answers");
      if (step > 0) {
        answers.append(button(t("chat.handoff.previous"), undefined, () => runtime.handoffs.moveStep(-1)));
      }
      if (steps.length && !last) {
        answers.append(button(t("chat.handoff.next"), undefined, () => runtime.handoffs.moveStep(1)));
      } else {
        answers.append(button(t("chat.handoff.done"), undefined, () => runtime.handoffs.reply(true)));
      }
      const cancel = button(t("chat.handoff.cancel"), "is-reject", () => runtime.handoffs.reply(false));
      answers.append(cancel);
      box.append(answers);
      pendingHost.append(box);
      return;
    }

    if (!pending) return;
    const danger = pending.request.kind === "danger";
    const box = make("div", `pling-chat__confirm${danger ? " is-danger" : ""}`);
    const ask = make("div", "pling-chat__ask");
    ask.append(
      make("strong", undefined, danger ? t("chat.confirm.danger") : t("chat.confirm.title")),
      make("code", undefined, pending.request.id),
      make("span", "pling-chat__desc", shown(pending.request.description)),
    );
    const answers = make("div", "pling-chat__answers");
    answers.append(button(t("chat.confirm.approve"), undefined, () => runtime.approvals.reply(true)));
    if (supportsAlwaysAllow(pending.request.approval)) {
      answers.append(button(t("chat.confirm.always"), undefined, () => runtime.approvals.reply("always")));
    }
    answers.append(button(t("chat.confirm.reject"), "is-reject", () => runtime.approvals.reply(false)));
    box.append(ask, answers);
    pendingHost.append(box);
  }

  function renderActivity(): void {
    const rows = toActivityRows(events, { locale: ui.locale, translate: t });
    const nodes: HTMLElement[] = rows.map((row) => {
      const item = make("li", "pling-dock__row");
      const head = make("p", "pling-dock__row-head");
      head.append(
        make("code", undefined, row.id),
        make("span", `pling-dock__state is-${row.status}`, t(`dock.state.${row.status}`)),
      );
      if (row.description) head.append(make("span", "pling-dock__desc", row.description));
      item.append(head);
      if (Object.keys(row.args).length) {
        item.append(make("pre", "pling-dock__args", shown(JSON.stringify(row.args))));
      }
      if (row.detail) item.append(make("p", "pling-dock__detail", shown(row.detail)));
      return item;
    });
    if (!nodes.length) {
      nodes.push(
        make(
          "li",
          "pling-dock__empty",
          t("dock.activity.empty"),
        ),
      );
    }
    activityList.replaceChildren(...nodes);
  }

  function describeUsage(): string {
    const data = runtime.telemetry.summary();
    const parts = [
      t("dock.summary.context", {
        used: runtime.session.loop.history.totalTokens(),
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

  function setButtonLabel(element: HTMLButtonElement, label: string): void {
    const first = element.firstChild;
    if (first && first.nodeType === Node.TEXT_NODE) first.textContent = label;
    else element.prepend(document.createTextNode(label));
  }

  function applyUi(): void {
    root.className = `pling-dock${ui.classNames.dock ? ` ${ui.classNames.dock}` : ""}`;
    panel.className = `pling-dock__panel${ui.classNames.panel ? ` ${ui.classNames.panel}` : ""}`;
    chat.className = `pling-chat pling-dock__view${ui.classNames.chat ? ` ${ui.classNames.chat}` : ""}`;
    launcher.className = `pling-dock__launcher${ui.classNames.launcher ? ` ${ui.classNames.launcher}` : ""}`;
    for (const [name, value] of Object.entries(ui.cssVars)) root.style.setProperty(name, value);

    panel.setAttribute("aria-label", options.title ?? t("dock.assistant"));
    chatTitle.textContent = options.title ?? t("dock.assistant");
    gateHint.textContent = t("dock.gate.off");
    gateHint.title = t("dock.gate.offTitle");
    clearButton.textContent = t("dock.clear");
    closeButton.textContent = t("dock.collapse");
    setButtonLabel(chatTab, t("dock.tab.chat"));
    setButtonLabel(activityTab, t("dock.tab.activity"));
    setButtonLabel(tasksTab, t("dock.tab.tasks"));
    runningHint.textContent = t("chat.running");
    stopButton.textContent = t("chat.stop");
    sendButton.textContent = t("chat.send");
    input.setAttribute("aria-label", t("chat.inputLabel"));
  }

  function render(): void {
    if (destroyed) return;
    applyUi();
    renderLauncher();
    if (!open) {
      panel.remove();
      return;
    }
    if (!panel.isConnected) root.insertBefore(panel, launcher);

    warn.hidden = !notReady;
    warn.textContent = describePlingDiagnostic(runtime.readiness, t);
    model.textContent = runtime.model || t("dock.model.unconfigured");
    const gateActive = (options.gate ?? setup.gate)?.() ?? true;
    gateHint.hidden = gateActive;
    model.title = t("dock.limits.title", {
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
    const readOnly = browserScope() && runtime.continuity.leaseLost;
    clearButton.disabled = running;
    quickButtons.forEach((item) => {
      item.disabled = running || readOnly;
    });

    tasksTab.hidden = !browserScope();
    if (!browserScope() && tab === "tasks") tab = "chat";
    chatTab.classList.toggle("is-active", tab === "chat");
    activityTab.classList.toggle("is-active", tab === "activity");
    tasksTab.classList.toggle("is-active", tab === "tasks");
    chatTab.setAttribute("aria-selected", String(tab === "chat"));
    activityTab.setAttribute("aria-selected", String(tab === "activity"));
    tasksTab.setAttribute("aria-selected", String(tab === "tasks"));

    const activityRows = toActivityRows(events, { locale: ui.locale, translate: t });
    const failedCount = activityRows.filter(
      (row) => row.status === "failed" || row.status === "blocked",
    ).length;
    badge.hidden = activityRows.length === 0;
    badge.textContent = String(activityRows.length);
    badge.classList.toggle("is-bad", failedCount > 0);

    chat.hidden = tab !== "chat";
    activityView.hidden = tab !== "activity";
    tasksView.hidden = tab !== "tasks";
    runningHint.hidden = !running;
    stopButton.hidden = !running;
    roleHint.hidden = !browserScope();
    roleHint.textContent = browserScope() ? roleText() : "";
    roleHint.classList.toggle("is-lost", browserScope() && runtime.continuity.leaseLost);
    roleHint.classList.toggle("is-readonly", browserScope() && runtime.continuity.role === "follower");
    input.placeholder =
      browserScope() &&
      runtime.continuity.role === "follower" &&
      !runtime.continuity.completed
        ? t("dock.placeholder.fork")
        : options.placeholder ?? t("chat.placeholder");
    input.disabled = running || readOnly;
    sendButton.disabled = running || readOnly || !input.value.trim();
    usage.textContent = describeUsage();

    renderTranscript();
    renderPending();
    renderActivity();
    renderTasks();
  }

  async function send(text: string): Promise<void> {
    const value = text.trim();
    if (destroyed || !value || running) return;
    notReady = false;
    input.value = "";
    if (!runtime.readiness.ready) {
      notReady = true;
      const messageKey = diagnosticMessageKey(runtime.readiness.code);
      events.push({ type: "user", text: value });
      events.push({
        type: "error",
        code: "NOT_CONFIGURED",
        message: runtime.readiness.hint,
        ...(messageKey ? { messageKey } : {}),
        ...(runtime.readiness.params ? { params: runtime.readiness.params } : {}),
      });
      render();
      return;
    }

    running = true;
    render();
    try {
      await runtime.session.send(value);
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code: unknown }).code)
          : "SEND_FAILED";
      const message = error instanceof Error ? error.message : String(error);
      events.push({ type: "error", code, message });
    } finally {
      running = false;
      render();
    }
  }

  function clear(): void {
    if (destroyed) return;
    cancelReturn();
    resumeDismissed = true;
    runtime.session.cancel();
    runtime.session.reset();
    runtime.approvals.clear();
    runtime.handoffs.clear();
    runtime.telemetry.clear();
    events = [];
    pending = null;
    pendingHandoff = null;
    notReady = false;
    input.value = "";
    render();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void send(input.value);
  });
  input.addEventListener("input", () => {
    sendButton.disabled = running || !input.value.trim();
  });

  render();

  if (runtime.readiness.ready && runtime.continuity.claimAutoResume()) {
    resumeDismissed = true;
    void send(RESUME_INSTRUCTION);
  }

  return {
    element: root,
    runtime,
    open() {
      setOpen(true);
    },
    close() {
      setOpen(false);
    },
    toggle,
    isOpen: () => open,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelReturn();
      unsubscribeUi();
      unsubscribeContinuity();
      runtime.session.cancel();
      runtime.approvals.clear();
      runtime.handoffs.clear();
      root.remove();
    },
  };
}
