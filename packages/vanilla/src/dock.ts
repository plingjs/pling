import {
  compactAt,
  createAgentRuntime,
  resolveAgentConfig,
  toActivityRows,
  toTranscriptLines,
  type AgentRuntime,
  type ContinuityController,
  type ContinuityTaskSummary,
  type PendingApproval,
  type PendingHandoff,
  type SessionEvent,
} from "@plingjs/agent";
import { supportsAlwaysAllow } from "@plingjs/core";
import { PLING_UI_Z_INDEX, sameOriginUrl } from "@plingjs/dom";
import { describePlingDiagnostic, diagnosticMessageKey, quickTaskOf } from "@plingjs/ui";
import { readViteEnv } from "./env";
import { renderMarkdown } from "./markdown";
import { DOCK_STYLES } from "./dock-styles";
import { createDebugInspector, type DebugInspector } from "./debug-view";
import {
  applyUserModelSettings,
  clearUserModelSettings,
  readUserModelSettings,
  resolveModelSettings,
  validateUserModelSettings,
  writeUserModelSettings,
  type UserModelSettings,
} from "./model-settings";
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

function iconButton(
  label: string,
  className: string,
  paths: readonly string[],
  onClick: () => void,
  viewBox = "0 0 20 20",
): HTMLButtonElement {
  const element = button("", className, onClick);
  element.setAttribute("aria-label", label);
  element.title = label;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "pling-dock__icon");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  for (const definition of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", definition);
    svg.append(path);
  }
  element.append(svg);
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
  const baseConfig = resolveAgentConfig({
    env: readViteEnv(),
    config: { ...(setup.config ?? {}), ...(options.config ?? {}) },
  });
  registry.setDefaultApproval(baseConfig.defaultApproval);

  const layout = options.layout ?? "dock";
  const sidebarMode = options.sidebarMode ?? "overlay";
  const side = options.side ?? "right";
  const launcherPlacement = options.launcherPlacement ?? "bottom";
  let open = options.defaultOpen ?? layout === "inline";
  let tab: "chat" | "activity" | "tasks" = "chat";
  let events: SessionEvent[] = [];
  let running = false;
  let pending: PendingApproval | null = null;
  let pendingHandoff: PendingHandoff | null = null;
  let notReady = false;
  let destroyed = false;
  let resumeDismissed = false;
  let returnTimer: ReturnType<typeof setTimeout> | null = null;
  let debugOpen = false;
  let settingsOpen = false;
  let offTask: (() => void) | null = null;
  let debugView: DebugInspector | null = null;
  let settingsPanel: HTMLElement | null = null;
  let taskItems: ContinuityTaskSummary[] = [];
  let tasksLoading = false;
  let tasksError = "";
  let tasksRequest = 0;
  const traceOption = options.debug !== undefined ? options.debug : setup.trace;
  const debugEnabled = Boolean(traceOption);
  const modelSetting = resolveModelSettings(options.modelSettings ?? setup.modelSettings);
  const injectedLlm = options.llm ?? setup.llm;
  const modelSettingsMode = injectedLlm && modelSetting.mode === "byok" ? "off" : modelSetting.mode;
  const modelSettingsEnabled = modelSettingsMode !== "off";

  function modelStorage(): Storage | null {
    if (modelSetting.persist !== "session" || typeof window === "undefined") return null;
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  const settingsStorage = modelStorage();
  let userModelSettings = settingsStorage ? readUserModelSettings(settingsStorage) : null;

  const root = make("div", "pling-dock");
  root.dataset.plingUi = "";
  root.dataset.layout = layout;
  if (layout === "sidebar") {
    root.dataset.side = side;
    root.dataset.sidebarMode = sidebarMode;
    root.dataset.launcherPlacement = launcherPlacement;
  }
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
  const quickItems = (options.quick ?? []).map((item) => {
    const task = quickTaskOf(item);
    const element = button(task.label, undefined, () => void send(task.prompt));
    if (task.description) element.title = task.description;
    return { task, element };
  });
  quick.append(...quickItems.map((item) => item.element));
  quick.hidden = !quickItems.length;

  const gateHint = make("span", "pling-dock__gate", t("dock.gate.off"));
  gateHint.title = t("dock.gate.offTitle");
  const gateStatus = make("footer", "pling-dock__status");
  gateStatus.append(gateHint);
  gateStatus.hidden = true;

  const clearButton = iconButton(
    t("dock.clear"),
    "pling-dock__ghost",
    ["M4 4.5h12v9H9l-4 3v-3H4z", "M8 7.5l4 4M12 7.5l-4 4"],
    () => clear(),
  );
  const closeButton = iconButton(
    t("dock.collapse"),
    "pling-dock__ghost",
    ["M5 8l5 5 5-5"],
    () => setOpen(false),
  );

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
  const actions = make("div", "pling-dock__actions");
  actions.append(clearButton, closeButton);
  const nav = make("div", "pling-dock__nav");
  nav.append(tabs, actions);

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
  const chatObserver =
    typeof MutationObserver === "function"
      ? new MutationObserver(() => {
          if (!transcript.isConnected) return;
          transcript.scrollTop = transcript.scrollHeight;
        })
      : null;
  chatObserver?.observe(transcript, { childList: true, subtree: true, characterData: true });
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
  const model = modelSettingsEnabled
    ? button("", "pling-dock__model pling-dock__model-button", () => toggleSettings())
    : make("span", "pling-dock__model");
  const modelDot = make("span", "pling-dock__model-dot");
  modelDot.setAttribute("aria-hidden", "true");
  const modelName = make("span", "pling-dock__model-name");
  model.append(modelDot, modelName);
  if (modelSettingsEnabled) {
    const caret = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    caret.setAttribute("class", "pling-dock__model-caret");
    caret.setAttribute("viewBox", "0 0 12 12");
    caret.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M3 4.5l3 3 3-3");
    caret.append(path);
    model.append(caret);
    (model as HTMLButtonElement).dataset.testid = "pling-model-settings-toggle";
  }
  const usage = make("span", "pling-dock__usage");
  diagnostics.append(model, usage);
  const activityHead = make("div", "pling-dock__run-head");
  activityHead.append(make("p", "pling-dock__run-label", t("dock.run.actions")));
  let debugToggle: HTMLButtonElement | null = null;
  if (debugEnabled) {
    debugToggle = button(t("debug.title"), "pling-dock__run-toggle", () => toggleDebug());
    debugToggle.dataset.testid = "pling-debug-toggle";
    activityHead.append(debugToggle);
  }
  const activityList = make("ol", "pling-dock__activity");
  const settingsHost = make("div", "pling-dock__settings");
  const debugHost = make("div", "pling-dock__debug");
  const activityRun = make("section", "pling-dock__run-section");
  activityRun.dataset.testid = "pling-run-actions";
  activityRun.append(activityHead, activityList);
  activityView.append(diagnostics, settingsHost, activityRun, debugHost);

  const tasksView = make("section", "pling-dock__view pling-dock__tasks");
  tasksView.hidden = true;
  const tasksIntro = make("p", "pling-dock__tasks-intro");
  const tasksList = make("ul", "pling-dock__task-list");
  tasksView.append(tasksIntro, tasksList);

  body.append(chat, activityView, tasksView);
  panel.append(warn, nav, quick, roleHint, body, gateStatus);

  const launcher = button(t("dock.launcher.open"), "pling-dock__launcher", () => toggle());
  launcher.className = `pling-dock__launcher${ui.classNames.launcher ? ` ${ui.classNames.launcher}` : ""}`;
  chat.className = `pling-chat pling-dock__view${ui.classNames.chat ? ` ${ui.classNames.chat}` : ""}`;
  root.append(launcher);
  (options.mount ?? document.body).append(root);

  let runtime!: AgentRuntime;
  let runtimeToken = 0;
  let unsubscribeContinuity: (() => void) | null = null;
  let unsubscribeTrace: (() => void) | null = null;

  function buildRuntime(): AgentRuntime {
    const token = ++runtimeToken;
    return createAgentRuntime({
      ...setup,
      ...(options.hooks ?? setup.hooks ? { hooks: options.hooks ?? setup.hooks } : {}),
      config: applyUserModelSettings(baseConfig, userModelSettings),
      registry,
      taskCatalog: host.task,
      trace: traceOption,
      responseLocale: setup.responseLocale ?? (() => ui.locale),
      ...(options.llm ?? setup.llm ? { llm: options.llm ?? setup.llm } : {}),
      ...(options.gate ?? setup.gate ? { gate: options.gate ?? setup.gate } : {}),
      onEvent(event) {
        if (token !== runtimeToken) return;
        // A new task clears the session event list; mirror it so the transcript does not keep stale context.
        if (event.type === "user") events = [...runtime.session.events()];
        else events.push(event);
        if (event.type === "final") queueReturn();
        setup.onEvent?.(event);
        options.onSessionEvent?.(event);
        render();
      },
      onApproval(request) {
        if (token !== runtimeToken) return;
        pending = request;
        setup.onApproval?.(request);
        render();
      },
      onHandoff(request) {
        if (token !== runtimeToken) return;
        pendingHandoff = request;
        setup.onHandoff?.(request);
        render();
      },
    });
  }

  function subscribeRuntime(): void {
    unsubscribeContinuity?.();
    unsubscribeTrace?.();
    const current = runtime;
    const token = runtimeToken;
    unsubscribeContinuity = runtime.continuity.subscribe(() => {
      if (destroyed || current !== runtime || token !== runtimeToken || !browserScope()) return;
      events = [...current.session.events()];
      render();
      if (tab === "tasks") void refreshTasks();
    });
    unsubscribeTrace = runtime.trace?.subscribe(() => {
      if (!destroyed && current === runtime && token === runtimeToken) render();
    }) ?? null;
  }

  runtime = buildRuntime();
  events = [...runtime.session.events()];
  subscribeRuntime();
  const unsubscribeUi = ui.subscribe(() => {
    if (!destroyed) render();
  });

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
    if (layout === "inline") next = true;
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
    render();
    if (next === "tasks") void refreshTasks();
  }

  function toggleDebug(): void {
    if (!debugEnabled) return;
    debugOpen = !debugOpen;
    render();
  }

  function toggleSettings(): void {
    if (!modelSettingsEnabled) return;
    settingsOpen = !settingsOpen;
    render();
  }

  function replaceRuntime(notice?: string): void {
    cancelReturn();
    runtime.session.cancel();
    runtime.approvals.clear();
    runtime.handoffs.clear();
    const next = buildRuntime();
    // 新连接不能被上一轮任务的自动恢复悄悄接管；用户已经明确换了模型 / 端点。
    next.session.reset();
    runtime = next;
    subscribeRuntime();
    events = notice ? [{ type: "notice", text: notice }] : [];
    pending = null;
    pendingHandoff = null;
    notReady = false;
    resumeDismissed = true;
    running = false;
    input.value = "";
  }

  function renderModelSettings(): void {
    if (!settingsOpen || !modelSettingsEnabled) {
      settingsPanel = null;
      settingsHost.replaceChildren();
      return;
    }

    const section = make("section", "model-settings");
    section.dataset.testid = "pling-model-settings";
    const head = make("header", "model-settings__head");
    head.append(
      make("h3", undefined, t("modelSettings.title")),
      make(
        "span",
        undefined,
        modelSettingsMode === "readonly" ? t("modelSettings.readonly") : t("modelSettings.byok"),
      ),
    );
    section.append(head);

    if (modelSettingsMode === "readonly") {
      section.append(make("p", "model-settings__note", t("modelSettings.readonlyHint")));
      const facts = make("dl", "model-settings__facts");
      const addFact = (label: string, value: string): void => {
        facts.append(make("dt", undefined, label));
        const detail = make("dd");
        detail.append(make("code", undefined, value));
        facts.append(detail);
      };
      addFact(t("modelSettings.baseUrl"), runtime.config.baseUrl || t("dock.model.unconfigured"));
      addFact(t("modelSettings.model"), runtime.config.model || t("dock.model.unconfigured"));
      const keyFact = make("dd", undefined, t("modelSettings.managed"));
      facts.append(make("dt", undefined, t("modelSettings.apiKey")), keyFact);
      section.append(facts);
      settingsPanel = section;
      settingsHost.replaceChildren(section);
      return;
    }

    const form = make("form", "model-settings__form");
    const source = userModelSettings ?? runtime.config;
    const baseInput = make("input");
    baseInput.type = "text";
    baseInput.inputMode = "url";
    baseInput.autocomplete = "off";
    baseInput.spellcheck = false;
    baseInput.placeholder = "https://provider.example.com/v1";
    baseInput.dataset.testid = "pling-model-base-url";
    baseInput.value = source.baseUrl;
    const modelInput = make("input");
    modelInput.type = "text";
    modelInput.autocomplete = "off";
    modelInput.spellcheck = false;
    modelInput.placeholder = "model-name";
    modelInput.dataset.testid = "pling-model-name";
    modelInput.value = source.model;
    const keyInput = make("input");
    keyInput.type = "password";
    keyInput.autocomplete = "new-password";
    keyInput.spellcheck = false;
    keyInput.placeholder = source.apiKey ? t("modelSettings.apiKeyConfigured") : "sk-…";
    keyInput.dataset.testid = "pling-model-api-key";
    keyInput.value = userModelSettings?.apiKey ?? "";

    const addField = (labelText: string, control: HTMLInputElement): void => {
      const label = make("label");
      label.append(make("span", undefined, labelText), control);
      form.append(label);
    };
    addField(t("modelSettings.baseUrl"), baseInput);
    addField(t("modelSettings.model"), modelInput);
    addField(t("modelSettings.apiKey"), keyInput);

    const error = make("p", "model-settings__error");
    error.setAttribute("role", "alert");
    error.hidden = true;
    const runningHint = make("p", "model-settings__error", t("modelSettings.running"));
    runningHint.hidden = !running;

    const actions = make("div", "model-settings__actions");
    const save = button(t("modelSettings.save"), "model-settings__save", () => {
      if (running) return;
      const canInheritKey = source.baseUrl.trim() === baseInput.value.trim() && Boolean(source.apiKey);
      const next: UserModelSettings = {
        baseUrl: baseInput.value.trim(),
        model: modelInput.value.trim(),
        apiKey: keyInput.value.trim() || (canInheritKey ? source.apiKey.trim() : ""),
      };
      const problem = validateUserModelSettings(next);
      if (problem) {
        error.textContent = t(`modelSettings.error.${problem === "base_url" ? "baseUrl" : problem}`);
        error.hidden = false;
        return;
      }
      userModelSettings = next;
      if (modelSetting.persist === "session") writeUserModelSettings(next, settingsStorage);
      else clearUserModelSettings(settingsStorage);
      settingsOpen = false;
      replaceRuntime(t("modelSettings.saved", { model: next.model }));
      tab = "chat";
      render();
    });
    save.type = "submit";
    const reset = button(t("modelSettings.reset"), "model-settings__reset", () => {
      if (running) return;
      userModelSettings = null;
      clearUserModelSettings(settingsStorage);
      settingsOpen = false;
      replaceRuntime(t("modelSettings.resetDone"));
      tab = "chat";
      render();
    });
    reset.type = "button";
    actions.append(save, reset);
    form.append(error, runningHint, actions);
    form.append(
      make("p", "model-settings__note", t("modelSettings.securityHint")),
      make(
        "p",
        "model-settings__note",
        modelSetting.persist === "session"
          ? t("modelSettings.storage.session")
          : t("modelSettings.storage.memory"),
      ),
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      save.click();
    });
    for (const control of [baseInput, modelInput, keyInput]) {
      control.disabled = running;
      control.addEventListener("input", () => {
        error.hidden = true;
      });
    }
    save.disabled = running;
    reset.disabled = running;
    section.append(form);
    settingsPanel = section;
    settingsHost.replaceChildren(section);
  }

  function renderDebug(): void {
    if (!debugEnabled || !debugOpen || !runtime.trace) {
      debugHost.replaceChildren();
      return;
    }
    if (!debugView) {
      debugView = createDebugInspector({
        registry,
        ui,
        // Coverage describes the business page, not just the assistant shell.
        // A custom mount point (for example an inline workbench column) must not
        // shrink the scan to that column; this matches Vue's `pi.inspectCoverage()`.
        root: () => document.body,
      });
    }
    debugView.render(runtime);
    debugHost.replaceChildren(debugView.element);
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

  function tasksIntroText(): string {
    const continuity = runtime.continuity;
    if (continuity.leaseLost) return t("dock.tasks.intro.leaseLost");
    if (continuity.role === "follower") return t("dock.tasks.intro.follower");
    return t("dock.tasks.intro.owner");
  }

  function taskState(task: ContinuityTaskSummary): "owner" | "follower" | "done" | "remote" | "idle" {
    if (task.status === "done") return "done";
    const current = runtime.continuity.sessionId === task.sessionId;
    if (current) return runtime.continuity.role === "follower" ? "follower" : "owner";
    return task.ownerActive ? "remote" : "idle";
  }

  async function refreshTasks(): Promise<void> {
    const current = runtime;
    const token = runtimeToken;
    const request = ++tasksRequest;
    if (destroyed || !browserScope()) {
      taskItems = [];
      tasksError = "";
      tasksLoading = false;
      render();
      return;
    }
    tasksLoading = true;
    tasksError = "";
    render();
    try {
      const items = await current.continuity.tasks();
      if (destroyed || current !== runtime || token !== runtimeToken || request !== tasksRequest) return;
      taskItems = items;
    } catch (error) {
      if (destroyed || current !== runtime || token !== runtimeToken || request !== tasksRequest) return;
      taskItems = [];
      tasksError = error instanceof Error ? error.message : String(error);
    } finally {
      if (!destroyed && current === runtime && token === runtimeToken && request === tasksRequest) {
        tasksLoading = false;
        render();
      }
    }
  }

  async function taskAction(
    run: (continuity: ContinuityController) => Promise<void>,
    after?: () => void,
  ): Promise<void> {
    const current = runtime;
    const token = runtimeToken;
    tasksLoading = true;
    tasksError = "";
    render();
    try {
      await run(current.continuity);
      if (destroyed || current !== runtime || token !== runtimeToken) return;
      after?.();
      await refreshTasks();
    } catch (error) {
      if (destroyed || current !== runtime || token !== runtimeToken) return;
      tasksError = error instanceof Error ? error.message : String(error);
      tasksLoading = false;
      render();
    }
  }

  function renderLauncher(): void {
    launcher.hidden = layout === "inline";
    if (layout === "inline") return;
    launcher.classList.toggle("is-open", open);
    launcher.setAttribute("aria-expanded", String(open));
    const label = open
      ? t("dock.launcher.close")
      : resumePending()
        ? t("dock.launcher.resume")
        : options.launcherLabel?.trim() || t("dock.launcher.open");
    launcher.title = label;
    launcher.replaceChildren(document.createTextNode(label));
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
    const task = typeof options.task === "function" ? options.task() : options.task;
    if (!lines.length && !task) {
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

    if (task) nodes.push(task);

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

  function renderTasks(): void {
    tasksIntro.textContent = tasksIntroText();
    const nodes: HTMLElement[] = [];
    if (tasksError) {
      nodes.push(make("li", "pling-dock__task-error", tasksError));
    } else if (!taskItems.length) {
      nodes.push(make("li", "pling-dock__task-empty", t("dock.task.empty")));
    } else {
      for (const task of taskItems) {
        const state = taskState(task);
        const current = runtime.continuity.sessionId === task.sessionId;
        const item = make("li", `pling-dock__task${current ? " is-current" : ""}`);
        const head = make("div", "pling-dock__task-head");
        head.append(
          make("strong", undefined, task.goal?.trim() || t("dock.task.untitled")),
          make("span", `pling-dock__tag is-${state}`, t(`dock.task.state.${state}`)),
        );
        item.append(
          head,
          make(
            "p",
            "pling-dock__meta",
            t("dock.task.updated", {
              id: task.sessionId.slice(-8),
              time: new Date(task.updatedAt).toLocaleTimeString(ui.locale, {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }),
          ),
        );

        const actions = make("div", "pling-dock__task-actions");
        const disabled = tasksLoading || running;
        if (!current || state === "done") {
          const follow = button(t("dock.task.follow"), undefined, () => {
            void taskAction((continuity) => continuity.follow(task.sessionId));
          });
          follow.disabled = disabled;
          actions.append(follow);
        }
        if (task.status !== "done" && state !== "owner") {
          const takeover = button(
            runtime.continuity.leaseLost ? t("dock.task.retake") : t("dock.task.takeover"),
            undefined,
            () => {
              void taskAction(
                (continuity) => continuity.takeover(task.sessionId),
                () => setTab("chat"),
              );
            },
          );
          takeover.disabled = disabled;
          actions.append(takeover);
        }
        const fork = button(t("dock.task.fork"), undefined, () => {
          void taskAction(
            async (continuity) => {
              await continuity.fork(task.sessionId);
            },
            () => setTab("chat"),
          );
        });
        fork.disabled = disabled;
        actions.append(fork);
        item.append(actions);
        nodes.push(item);
      }
    }
    tasksList.replaceChildren(...nodes);
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
    root.className = `pling-dock pling-dock--${layout}${open ? " is-open" : ""}${layout === "sidebar" ? ` pling-dock--${side} pling-dock--launcher-${launcherPlacement}${sidebarMode === "fused" ? " pling-dock--fused" : ""}` : ""}${ui.classNames.dock ? ` ${ui.classNames.dock}` : ""}`;
    panel.className = `pling-dock__panel${ui.classNames.panel ? ` ${ui.classNames.panel}` : ""}`;
    chat.className = `pling-chat pling-dock__view${ui.classNames.chat ? ` ${ui.classNames.chat}` : ""}`;
    launcher.className = `pling-dock__launcher${ui.classNames.launcher ? ` ${ui.classNames.launcher}` : ""}`;
    for (const [name, value] of Object.entries(ui.cssVars)) root.style.setProperty(name, value);

    panel.setAttribute("aria-label", options.title ?? t("dock.assistant"));
    chatTitle.textContent = options.title ?? t("dock.assistant");
    gateHint.textContent = t("dock.gate.off");
    gateHint.title = t("dock.gate.offTitle");
    clearButton.setAttribute("aria-label", t("dock.clear"));
    clearButton.title = t("dock.clear");
    closeButton.setAttribute("aria-label", t("dock.collapse"));
    closeButton.title = t("dock.collapse");
    setButtonLabel(chatTab, t("dock.tab.chat"));
    setButtonLabel(activityTab, t("dock.tab.activity"));
    setButtonLabel(tasksTab, t("dock.tab.tasks"));
    if (debugToggle) debugToggle.textContent = t("debug.title");
    runningHint.textContent = t("chat.running");
    stopButton.textContent = t("chat.stop");
    sendButton.textContent = t("chat.send");
    input.setAttribute("aria-label", t("chat.inputLabel"));
  }

  function render(): void {
    if (destroyed) return;
    if (tab === "tasks" && !browserScope()) tab = "chat";
    applyUi();
    renderLauncher();
    if (!open && layout !== "inline") {
      panel.remove();
      return;
    }
    if (!panel.isConnected) root.insertBefore(panel, launcher);

    warn.hidden = !notReady;
    warn.textContent = describePlingDiagnostic(runtime.readiness, t);
    modelName.textContent = runtime.model || t("dock.model.unconfigured");
    const gateActive = (options.gate ?? setup.gate)?.() ?? true;
    gateStatus.hidden = gateActive;
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
    quickItems.forEach((item) => {
      item.element.disabled = running || readOnly || item.task.disabled === true;
    });

    chatTab.classList.toggle("is-active", tab === "chat");
    activityTab.classList.toggle("is-active", tab === "activity");
    tasksTab.classList.toggle("is-active", tab === "tasks");
    chatTab.setAttribute("aria-selected", String(tab === "chat"));
    activityTab.setAttribute("aria-selected", String(tab === "activity"));
    tasksTab.setAttribute("aria-selected", String(tab === "tasks"));
    tasksTab.hidden = !browserScope();

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
    quick.hidden = tab !== "chat" || quickItems.length === 0;
    runningHint.hidden = !running;
    stopButton.hidden = !running;
    closeButton.hidden = layout === "inline";
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
    model.classList.toggle("is-active", settingsOpen);
    if (model instanceof HTMLButtonElement) {
      model.setAttribute("aria-expanded", String(settingsOpen));
      model.setAttribute("aria-label", t("modelSettings.title"));
    }
    if (debugToggle) {
      debugToggle.classList.toggle("is-active", debugOpen);
      debugToggle.setAttribute("aria-expanded", String(debugOpen));
    }

    renderTranscript();
    renderPending();
    renderTasks();
    renderActivity();
    renderModelSettings();
    renderDebug();
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
    runtime.trace?.clear();
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

  offTask = host.task.register({
    id: options.surfaceId ?? "dock",
    ask: async (prompt) => {
      setOpen(true);
      await send(prompt);
    },
  });

  render();

  if (runtime.readiness.ready && runtime.continuity.claimAutoResume()) {
    resumeDismissed = true;
    void send(RESUME_INSTRUCTION);
  }

  return {
    element: root,
    get runtime() {
      return runtime;
    },
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
      offTask?.();
      offTask = null;
      unsubscribeUi();
      unsubscribeContinuity?.();
      unsubscribeTrace?.();
      chatObserver?.disconnect();
      debugView?.destroy();
      debugView = null;
      runtime.session.cancel();
      runtime.approvals.clear();
      runtime.handoffs.clear();
      root.remove();
    },
  };
}
