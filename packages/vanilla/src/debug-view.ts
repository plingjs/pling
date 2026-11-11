import type { Registry, Snapshot } from "@plingjs/core";
import type { AgentRuntime, AgentTraceCall } from "@plingjs/agent";
import { inspectCoverage, type CoverageReport } from "@plingjs/dom";
import { formatAvailabilityReason, type PlingUiController } from "@plingjs/ui";

export interface DebugInspector {
  readonly element: HTMLElement;
  render(runtime: AgentRuntime): void;
  destroy(): void;
}

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

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function duration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function section(title: string, open = false): HTMLDetailsElement {
  const element = make("details", "debug__section");
  element.open = open;
  element.append(make("summary", undefined, title));
  return element;
}

function subhead(title: string, detail?: string): HTMLElement {
  const row = make("div", "debug__subhead");
  row.append(make("strong", undefined, title));
  if (detail !== undefined) row.append(make("span", undefined, detail));
  return row;
}

function empty(text: string): HTMLElement {
  return make("p", "debug__empty", text);
}

function list(): HTMLUListElement {
  return make("ul", "debug__list");
}

export function createDebugInspector(options: {
  registry: Registry;
  ui: PlingUiController;
  root?: () => Element | null;
}): DebugInspector {
  const { registry, ui } = options;
  const t = ui.t;
  const element = make("section", "debug");
  element.dataset.testid = "pling-debug";
  for (const [name, value] of Object.entries(ui.cssVars)) element.style.setProperty(name, value);
  let coverage: CoverageReport | null = null;
  let destroyed = false;

  const refreshCoverage = (): void => {
    coverage = inspectCoverage(options.root?.() ?? globalThis.document?.body ?? null);
  };

  const renderPage = (snapshot: Snapshot): HTMLElement => {
    const box = section(t("debug.page"), true);
    if (snapshot.page) {
      const card = make("div", "debug__card");
      card.append(make("code", undefined, snapshot.page.title || snapshot.page.path || snapshot.page.name || ""));
      if (snapshot.page.path) card.append(make("p", undefined, snapshot.page.path));
      box.append(card);
    }

    box.append(
      subhead(
        t("debug.actions"),
        t("debug.actionsSummary", {
          visible: snapshot.actions.length,
          total: snapshot.total,
          unavailable: snapshot.unavailableTotal,
        }),
      ),
    );
    if (snapshot.actions.length) {
      const actions = list();
      for (const action of snapshot.actions) {
        const row = make("li");
        row.append(make("code", undefined, action.id));
        row.append(make("span", undefined, `${action.primitive} · ${action.kind}`));
        if (action.scopePath?.length) {
          row.append(make("span", "debug__muted", action.scopePath.join(" / ")));
        }
        row.append(make("span", "debug__desc", action.description));
        actions.append(row);
      }
      box.append(actions);
    } else {
      box.append(empty(t("debug.noActions")));
    }

    if (snapshot.unavailable.length) {
      box.append(subhead(t("debug.unavailable")));
      const unavailable = list();
      for (const action of snapshot.unavailable) {
        const row = make("li");
        row.append(make("code", undefined, action.id));
        row.append(make("span", "debug__muted", formatAvailabilityReason(action, t)));
        unavailable.append(row);
      }
      box.append(unavailable);
    }

    const activeScopes = snapshot.scopes.filter((scope) => scope.active).length;
    box.append(
      subhead(
        t("debug.scopes"),
        t("debug.scopesTotal", { visible: activeScopes, total: snapshot.scopes.length }),
      ),
    );
    if (snapshot.scopes.length) {
      const scopes = list();
      for (const scope of snapshot.scopes) {
        const row = make("li");
        row.append(make("code", undefined, scope.id));
        if (scope.label) row.append(make("span", undefined, scope.label));
        row.append(make("span", "debug__muted", `${scope.visible} / ${scope.total}`));
        scopes.append(row);
      }
      box.append(scopes);
    } else {
      box.append(empty(t("debug.noScopes")));
    }

    box.append(
      subhead(
        t("debug.records"),
        t("debug.recordsTotal", { shown: snapshot.records.length, total: snapshot.recordsTotal }),
      ),
    );
    if (snapshot.records.length) {
      const records = list();
      for (const record of snapshot.records) {
        const row = make("li");
        row.append(make("code", undefined, record.id));
        if (record.label) row.append(make("span", undefined, record.label));
        row.append(make("pre", undefined, pretty(record.fields)));
        records.append(row);
      }
      box.append(records);
    } else {
      box.append(empty(t("debug.noRecords")));
    }

    box.append(subhead(t("debug.state")));
    if (snapshot.stateViews.length) {
      const states = list();
      for (const item of snapshot.stateViews) {
        const row = make("li");
        row.append(make("code", undefined, item.key));
        if (item.description) row.append(make("span", "debug__desc", item.description));
        row.append(make("pre", undefined, pretty(item.value)));
        states.append(row);
      }
      box.append(states);
    } else {
      box.append(empty(t("debug.noState")));
    }

    box.append(subhead(t("debug.feedback")));
    if (snapshot.feedback.length) {
      const feedback = list();
      for (const item of snapshot.feedback) {
        const row = make("li");
        row.append(make("span", `debug__severity is-${item.severity}`, item.severity));
        row.append(make("span", undefined, item.message));
        if (item.scopePath?.length) {
          row.append(make("span", "debug__muted", item.scopePath.join(" / ")));
        }
        feedback.append(row);
      }
      box.append(feedback);
    } else {
      box.append(empty(t("debug.noFeedback")));
    }
    return box;
  };

  let expandedSeq = 0;
  let latestSeq = 0;

  const renderCall = (call: AgentTraceCall, runtime: AgentRuntime): HTMLElement => {
    const box = make("details", "debug__call");
    box.open = call.seq === expandedSeq;
    const summary = make("summary");
    summary.append(
      make("span", undefined, `#${call.seq}`),
      make("span", undefined, t("debug.turn", { turn: call.turn })),
      make("span", `debug__status is-${call.status}`, t(`debug.status.${call.status}`)),
      make("span", undefined, duration(call.durationMs)),
      make("span", undefined, `${call.contextTokens} tokens`),
    );
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      expandedSeq = expandedSeq === call.seq ? 0 : call.seq;
      render(runtime);
    });
    box.append(summary);
    if (call.seq !== expandedSeq) return box;

    const body = make("div");
    body.dataset.testid = `pling-call-body-${call.seq}`;
    if (call.error) {
      body.append(make("p", "debug__error", `${call.error.code}: ${call.error.message}`));
    }

    body.append(subhead(t("debug.request")));
    call.messages.forEach((message) => {
      const item = make("div", "debug__message");
      const label = [message.role, message.name, message.toolCallId].filter(Boolean).join(" · ");
      item.append(make("p", "debug__messageHead", label));
      if (message.content) item.append(make("pre", undefined, message.content));
      if (message.toolCalls?.length) {
        const calls = make("ul", "debug__toolCalls");
        for (const toolCall of message.toolCalls) {
          const row = make("li");
          row.append(make("code", undefined, toolCall.name));
          row.append(make("span", undefined, toolCall.arguments));
          calls.append(row);
        }
        item.append(calls);
      }
      body.append(item);
    });

    const tools = section(`${t("debug.tools")} (${call.tools.length})`);
    if (call.tools.length) {
      const toolsList = list();
      for (const tool of call.tools) {
        const row = make("li");
        row.append(make("code", undefined, tool.function.name));
        row.append(make("span", "debug__desc", tool.function.description));
        row.append(make("pre", "debug__schema", pretty(tool.function.parameters)));
        toolsList.append(row);
      }
      tools.append(toolsList);
    } else {
      tools.append(empty(t("debug.noTools")));
    }
    body.append(tools);

    if (call.response) {
      body.append(subhead(t("debug.response")));
      if (call.response.content) body.append(make("pre", undefined, call.response.content));
      if (call.response.toolCalls.length) {
        const calls = make("ul", "debug__toolCalls");
        for (const toolCall of call.response.toolCalls) {
          const row = make("li");
          row.append(make("code", undefined, toolCall.name));
          row.append(make("span", undefined, toolCall.arguments));
          calls.append(row);
        }
        body.append(calls);
      }
    }

    const snapshot = section(t("debug.callSnapshot"));
    snapshot.append(
      make("p", "debug__muted", t("debug.snapshotSummary", {
        actions: call.snapshot.actions.length,
        records: call.snapshot.records.length,
        state: call.snapshot.stateViews.length,
      })),
    );
    const actions = list();
    for (const action of call.snapshot.actions) {
      const row = make("li");
      row.append(make("code", undefined, action.id));
      row.append(make("span", "debug__desc", action.description));
      actions.append(row);
    }
    snapshot.append(actions);
    body.append(snapshot);
    box.append(body);
    return box;
  };

  function render(runtime: AgentRuntime): void {
    if (destroyed) return;
    refreshCoverage();
    const snapshot = registry.snapshot();
    const calls = runtime.trace?.calls ?? [];
    const nextLatest = calls[calls.length - 1]?.seq ?? 0;
    if (nextLatest !== latestSeq) {
      latestSeq = nextLatest;
      expandedSeq = nextLatest;
    }
    const head = make("header", "debug__head");
    const refresh = make("button", "debug__refresh", t("debug.refresh"));
    refresh.type = "button";
    refresh.addEventListener("click", () => render(runtime));
    head.append(
      make("span", "debug__title", t("debug.title")),
      make("span", "debug__readonly", t("debug.readonly")),
      refresh,
    );

    const callsBox = section(t("debug.calls"), true);
    if (!calls.length) callsBox.append(empty(t("debug.noCalls")));
    calls.forEach((call) => callsBox.append(renderCall(call, runtime)));

    const coverageBox = section(t("debug.coverage"));
    const report = coverage;
    coverageBox.append(
      make(
        "p",
        undefined,
        !report || report.coveragePercent === null
          ? t("panel.coverage.none")
          : `${report.coveragePercent}% · ${t("panel.coverage.summary", {
              declared: report.declared,
              derived: report.derived,
              grouped: report.grouped,
              locatable: report.locatable,
              missing: report.missing,
            })}`,
      ),
    );
    const missing = report?.targets.filter((target) => target.status === "missing") ?? [];
    if (missing.length) {
      const targetList = list();
      for (const target of missing) {
        const row = make("li");
        row.append(make("code", undefined, target.element));
        row.append(make("span", "debug__desc", target.label));
        targetList.append(row);
      }
      coverageBox.append(targetList);
    }

    const history = runtime.session.loop.history.summary;
    const nodes: HTMLElement[] = [
      head,
      make("p", "debug__note", t("debug.sensitiveNote")),
      renderPage(snapshot),
      callsBox,
      coverageBox,
    ];
    if (history) {
      const historyBox = section(t("debug.historySummary"));
      historyBox.append(make("pre", undefined, history));
      nodes.push(historyBox);
    }
    element.replaceChildren(...nodes);
  }

  return {
    element,
    render,
    destroy() {
      destroyed = true;
      element.remove();
    },
  };
}
