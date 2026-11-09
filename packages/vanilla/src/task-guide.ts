import type {
  TaskGuideAction,
  TaskGuideCommand,
  TaskGuideDefinition,
  TaskGuideDone,
  TaskGuideField,
  TaskGuideFields,
  TaskGuideHandoff,
  TaskGuideLabels,
  TaskGuideRow,
  TaskGuideRowFormat,
  TaskGuideRowValue,
  TaskGuideRows,
  TaskGuideStep,
  TaskRunSnapshot,
} from "@plingjs/agent";
import { ensurePlingStyles } from "@plingjs/dom";

/**
 * DOM renderer for the framework-neutral task-guide contract.
 *
 * The presentation types live in `@plingjs/agent` so Vue, vanilla, and future
 * adapters share one contract. This file only turns that contract into DOM.
 */
export type {
  TaskGuideAction,
  TaskGuideCommand,
  TaskGuideDefinition,
  TaskGuideDone,
  TaskGuideField,
  TaskGuideFields,
  TaskGuideHandoff,
  TaskGuideLabels,
  TaskGuideRow,
  TaskGuideRowFormat,
  TaskGuideRowValue,
  TaskGuideRows,
  TaskGuideStep,
};

export interface CreateTaskGuideOptions {
  definition: TaskGuideDefinition;
  snapshot?: TaskRunSnapshot | null;
  step?: number;
  /** 1-based step number. */
  initialStep?: number;
  onCommand(command: TaskGuideCommand): void;
}

export interface GuidedTaskGuide {
  readonly element: HTMLElement;
  setSnapshot(snapshot: TaskRunSnapshot | null): void;
  /** 1-based step number. */
  setStep(step: number): void;
  setBusy(busy: boolean): void;
  setError(message: string): void;
  complete(): void;
  reset(): void;
  refresh(): void;
  destroy(): void;
}

const DEFAULT_LABELS: Required<TaskGuideLabels> = {
  running: "In progress",
  completed: "Completed",
  current: "Current",
  done: "Done",
  pending: "Not started",
  error: "Could not continue",
  required: "Required",
  optional: "Optional",
  skipped: "Skipped",
};

function escapeHtml(value: TaskGuideRowValue): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatValue(value: TaskGuideRowValue, format: TaskGuideRowFormat = "text"): string {
  if (format === "stars") {
    const score = Math.max(0, Math.min(5, Number(value) || 0));
    return `${"★".repeat(score)}${"☆".repeat(5 - score)}`;
  }
  if (format === "check") return value ? "✓" : "—";
  return escapeHtml(value);
}

function resolveText(value: string | ((snapshot: TaskRunSnapshot | null) => string), snapshot: TaskRunSnapshot | null): string {
  return typeof value === "function" ? value(snapshot) : value;
}

function resolveRows(rows: TaskGuideRows | undefined, snapshot: TaskRunSnapshot | null): readonly TaskGuideRow[] {
  if (!rows) return [];
  return typeof rows === "function" ? rows(snapshot) : rows;
}

function resolveFields(fields: TaskGuideFields | undefined, snapshot: TaskRunSnapshot | null): readonly TaskGuideField[] {
  if (!fields) return [];
  return typeof fields === "function" ? fields(snapshot) : fields;
}

function fieldAction(field: TaskGuideField): TaskGuideAction {
  return {
    label: field.label,
    command: field.command ?? `focus-${field.field}`,
  };
}

function formatSubtitle(template: string, step: number, total: number): string {
  return template.replaceAll("{step}", String(step)).replaceAll("{total}", String(total));
}

function rowStatusClass(status: TaskGuideRow["status"]): string {
  return status ? ` is-${status}` : "";
}

export function createTaskGuide(options: CreateTaskGuideOptions): GuidedTaskGuide {
  ensurePlingStyles();
  const definition = options.definition;
  const labels = { ...DEFAULT_LABELS, ...definition.labels };
  const element = document.createElement("div");
  element.className = "pling-guide";

  let step = Math.max(1, Math.min(definition.steps.length, options.step ?? options.initialStep ?? 1));
  let snapshot = options.snapshot ?? null;
  let busy = false;
  let error = "";
  let done = false;
  let lastCurrentField: string | null = null;
  let railScrollLeft = 0;

  function rowsMarkup(rows: readonly TaskGuideRow[], title?: TaskGuideStep["rowsTitle"]): string {
    if (!rows.length) return "";
    const resolvedTitle = typeof title === "function" ? title(snapshot) : title;
    return `
      <div class="pling-guide__summary">
        ${resolvedTitle ? `<strong>${escapeHtml(resolvedTitle)}</strong>` : ""}
        <div class="pling-guide__rows">
          ${rows.map((row) => `
            <div class="pling-guide__row${rowStatusClass(row.status)}">
              <div class="pling-guide__row-main">
                <span>${escapeHtml(row.label)}</span>
                ${row.note ? `<small class="pling-guide__row-note">${escapeHtml(row.note)}</small>` : ""}
              </div>
              <div class="pling-guide__row-value">
                ${row.badge ? `<span class="pling-guide__badge${rowStatusClass(row.status)}">${escapeHtml(row.badge)}</span>` : ""}
                <b class="${row.format === "stars" ? "pling-guide__stars" : ""}">${formatValue(row.value, row.format)}</b>
                ${row.action ? `<button class="pling-guide__row-action" type="button" data-guide-command="${escapeHtml(row.action.command)}"${busy ? " disabled" : ""}>${escapeHtml(row.action.label)}</button>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function stepsMarkup(): string {
    return definition.steps.map((item, index) => {
      const number = index + 1;
      const completed = done || number < step;
      const current = !done && number === step;
      const status = completed ? labels.done : current ? labels.current : labels.pending;
      return `
        <li class="pling-guide__step${completed ? " is-done" : ""}${current ? " is-current" : ""}">
          <span class="pling-guide__dot">${completed ? "✓" : number}</span>
          <span>${escapeHtml(item.label)}</span>
          <small>${status}</small>
        </li>
      `;
    }).join("");
  }

  function actionsMarkup(primary?: TaskGuideAction, secondary?: TaskGuideAction): string {
    if (!primary && !secondary) return "";
    return `
      <div class="pling-guide__actions">
        ${primary ? `<button class="pling-guide__primary" type="button" data-guide-command="${escapeHtml(primary.command)}"${busy ? " disabled" : ""}>${escapeHtml(busy && primary.busyLabel ? primary.busyLabel : primary.label)}</button>` : ""}
        ${secondary ? `<button class="pling-guide__secondary" type="button" data-guide-command="${escapeHtml(secondary.command)}"${busy ? " disabled" : ""}>${escapeHtml(secondary.label)}</button>` : ""}
      </div>
    `;
  }

  function railMarkup(fields: readonly TaskGuideField[]): string {
    const currentField = done ? null : fields.find((field) => !field.filled && !field.skipped)?.field ?? null;
    return `
      <div class="pling-guide__rail-head">
        <div class="pling-guide__rail-title">
          <span class="pling-guide__rail-icon" aria-hidden="true">✦</span>
          <div>
            <h3 class="pling-guide__rail-heading">${escapeHtml(definition.title)}</h3>
            <p class="pling-guide__rail-subtitle">${escapeHtml(definition.stepSubtitle
              ? formatSubtitle(definition.stepSubtitle, done ? definition.steps.length : step, definition.steps.length)
              : `${step} / ${definition.steps.length}`)}</p>
          </div>
        </div>
        <div class="pling-guide__rail-meta">
          <span class="pling-guide__rail-state${done ? " is-done" : ""}">${done ? labels.completed : labels.running}</span>
          ${definition.cancel && !done ? `<button class="pling-guide__rail-cancel" type="button" aria-label="${escapeHtml(definition.cancel.label)}" title="${escapeHtml(definition.cancel.label)}" data-guide-command="${escapeHtml(definition.cancel.command)}"${busy ? " disabled" : ""}>×</button>` : ""}
        </div>
      </div>
      <div class="pling-guide__rail-scroll">
        <ol class="pling-guide__rail" aria-label="${escapeHtml(definition.title)}">
          ${fields.map((field, index) => {
            const classes = [
              "pling-guide__rail-item",
              field.filled ? "is-filled" : "",
              field.field === currentField ? "is-current" : "",
              field.suggested ? "is-suggested" : "",
              field.required ? "is-required" : "",
              field.skipped || (done && !field.filled) ? "is-skipped" : "",
            ].filter(Boolean).join(" ");
            const flag = field.skipped ? (labels.skipped ?? labels.optional) : field.required ? labels.required : labels.optional;
            const dot = field.filled ? "✓" : field.skipped || (done && !field.required) ? "–" : index + 1;
            return `
              <li class="${classes}" data-guide-field="${escapeHtml(field.field)}">
                <button class="pling-guide__rail-node" type="button" title="${escapeHtml(`${field.label} · ${flag}`)}" data-guide-command="${escapeHtml(fieldAction(field).command)}"${done ? " disabled" : ""}>
                  <span class="pling-guide__rail-dot">${dot}</span>
                  <span class="pling-guide__rail-label">${escapeHtml(field.label)}</span>
                  <span class="pling-guide__rail-flag">${escapeHtml(flag)}</span>
                </button>
                ${index < fields.length - 1 ? '<span class="pling-guide__rail-arrow" aria-hidden="true">›</span>' : ""}
              </li>
            `;
          }).join("")}
        </ol>
      </div>
      ${done && definition.done?.actions?.length ? `
        <div class="pling-guide__rail-actions">
          ${definition.done.actions.map((action) => `<button class="pling-guide__secondary" type="button" data-guide-command="${escapeHtml(action.command)}">${escapeHtml(action.label)}</button>`).join("")}
        </div>
      ` : ""}
      ${error ? `<p class="pling-guide__error"><strong>${labels.error}:</strong> ${escapeHtml(error)}</p>` : ""}
    `;
  }

  function compactMarkup(fields: readonly TaskGuideField[]): string {
    const total = definition.steps.length;
    const subtitle = definition.stepSubtitle
      ? formatSubtitle(definition.stepSubtitle, done ? total : step, total)
      : total > 1
        ? `${step} / ${total}`
        : "";
    const heading = done && definition.done
      ? resolveText(definition.done.title, snapshot)
      : definition.title;
    const actions = done && definition.done?.actions?.length
      ? `<div class="pling-guide__compact-actions">${definition.done.actions.map((action) => `<button class="pling-guide__secondary" type="button" data-guide-command="${escapeHtml(action.command)}">${escapeHtml(action.label)}</button>`).join("")}</div>`
      : "";
    return `
      <div class="pling-guide__compact">
        <div class="pling-guide__compact-title">
          <span class="pling-guide__compact-icon" aria-hidden="true">${done ? "✓" : "✦"}</span>
          <div class="pling-guide__compact-copy">
            <strong class="pling-guide__compact-heading">${escapeHtml(heading)}</strong>
            ${subtitle ? `<span class="pling-guide__compact-subtitle">${escapeHtml(subtitle)}</span>` : ""}
          </div>
        </div>
        <div class="pling-guide__compact-actions">
          ${actions || `<span class="pling-guide__state${done ? " is-done" : ""}">${done ? labels.completed : labels.running}</span>`}
          ${definition.cancel && !done ? `<button class="pling-guide__cancel" type="button" data-guide-command="${escapeHtml(definition.cancel.command)}"${busy ? " disabled" : ""}>${escapeHtml(definition.cancel.label)}</button>` : ""}
        </div>
      </div>
      ${error ? `<p class="pling-guide__error"><strong>${labels.error}:</strong> ${escapeHtml(error)}</p>` : ""}
    `;
  }

  function syncRailScroll(fields: readonly TaskGuideField[]): void {
    if (!fields.length) {
      lastCurrentField = null;
      return;
    }
    const scroller = element.querySelector<HTMLElement>(".pling-guide__rail-scroll");
    if (!scroller) return;
    const current = done ? null : fields.find((field) => !field.filled)?.field ?? null;
    if (current && current !== lastCurrentField) {
      lastCurrentField = current;
      const node = element.querySelector<HTMLElement>(`.pling-guide__rail-item[data-guide-field="${current}"]`);
      if (node) {
        const left = node.offsetLeft - (scroller.clientWidth - node.clientWidth) / 2;
        railScrollLeft = Math.max(0, left);
      }
    }
    if (!current) lastCurrentField = null;
    const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollLeft = Math.min(railScrollLeft, max);
    updateRailEdges(scroller);
  }

  function updateRailEdges(scroller: HTMLElement | null = element.querySelector<HTMLElement>(".pling-guide__rail-scroll")): void {
    if (!scroller) return;
    const max = scroller.scrollWidth - scroller.clientWidth;
    scroller.classList.toggle("can-scroll-left", scroller.scrollLeft > 1);
    scroller.classList.toggle("can-scroll-right", scroller.scrollLeft < max - 1);
  }

  function render(): void {
    const total = definition.steps.length;
    const current = definition.steps[step - 1];
    const fields = resolveFields(definition.fields, snapshot);
    const subtitle = definition.stepSubtitle
      ? formatSubtitle(definition.stepSubtitle, done ? total : step, total)
      : `${step} / ${total}`;
    element.className = definition.compact
      ? "pling-guide pling-guide--compact"
      : fields.length
        ? "pling-guide pling-guide--rail"
        : "pling-guide";
    if (definition.compact) {
      element.innerHTML = compactMarkup(fields);
      return;
    }
    if (fields.length) {
      element.innerHTML = railMarkup(fields);
      const scroller = element.querySelector<HTMLElement>(".pling-guide__rail-scroll");
      scroller?.addEventListener("scroll", () => {
        railScrollLeft = scroller.scrollLeft;
        updateRailEdges(scroller);
      }, { passive: true });
      if (element.isConnected) syncRailScroll(fields);
      else setTimeout(() => {
        if (element.isConnected) syncRailScroll(fields);
      }, 0);
      return;
    }
    const body = done && definition.done
      ? `
        <div class="pling-guide__result">
          <span class="pling-guide__check">✓</span>
          <div>
            <strong>${escapeHtml(resolveText(definition.done.title, snapshot))}</strong>
            <span>${escapeHtml(resolveText(definition.done.description, snapshot))}</span>
          </div>
        </div>
        ${rowsMarkup(resolveRows(definition.done.rows, snapshot))}
        ${definition.done.actions?.length ? `
          <div class="pling-guide__actions">
            ${definition.done.actions.map((action) => `<button class="pling-guide__secondary" type="button" data-guide-command="${escapeHtml(action.command)}">${escapeHtml(action.label)}</button>`).join("")}
          </div>
        ` : ""}
      `
      : current
        ? `
          <p class="pling-guide__panel-title">${escapeHtml(current.title)}</p>
          <p class="pling-guide__panel-copy">${escapeHtml(current.description)}</p>
          ${current.handoff ? `
            <div class="pling-guide__handoff">
              <strong>${escapeHtml(current.handoff.title)}</strong>
              <span>${escapeHtml(current.handoff.description)}</span>
            </div>
          ` : ""}
          ${rowsMarkup(resolveRows(current.rows, snapshot), current.rowsTitle)}
          ${error ? `<p class="pling-guide__error"><strong>${labels.error}:</strong> ${escapeHtml(error)}</p>` : ""}
          ${actionsMarkup(current.primary, current.secondary)}
        `
        : "";

    element.innerHTML = `
      ${definition.welcome ? `
        <div class="pling-guide__welcome${definition.avatar ? " has-avatar" : ""}">
          ${definition.avatar ? `<span class="pling-guide__avatar">${escapeHtml(definition.avatar)}</span>` : ""}
          <div class="pling-guide__bubble">${escapeHtml(definition.welcome)}</div>
        </div>
      ` : ""}
      <section class="pling-guide__card" aria-live="polite">
        <div class="pling-guide__head">
          <div>
            <div class="pling-guide__title-row">
              <span class="pling-guide__icon">✦</span>
              <h3 class="pling-guide__title">${escapeHtml(definition.title)}</h3>
            </div>
            <p class="pling-guide__subtitle">${escapeHtml(subtitle)}</p>
          </div>
          <div class="pling-guide__head-actions">
            ${definition.cancel && !done ? `<button class="pling-guide__cancel" type="button" data-guide-command="${escapeHtml(definition.cancel.command)}"${busy ? " disabled" : ""}>${escapeHtml(definition.cancel.label)}</button>` : ""}
            <span class="pling-guide__state${done ? " is-done" : ""}">${done ? labels.completed : labels.running}</span>
          </div>
        </div>
        <div class="pling-guide__progress" aria-hidden="true"><span style="width: ${done ? 100 : Math.max(0, ((step - 1) / Math.max(1, total)) * 100)}%"></span></div>
        <div class="pling-guide__body">
          <ol class="pling-guide__steps">${stepsMarkup()}</ol>
          ${body}
        </div>
      </section>
      ${definition.footer ? `<p class="pling-guide__note">${escapeHtml(definition.footer)}</p>` : ""}
    `;
  }

  function onClick(event: Event): void {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-guide-command]");
    if (!button || button.disabled) return;
    const cancel = !done ? definition.cancel : undefined;
    const rowAction = !done
      ? resolveRows(definition.steps[step - 1]?.rows, snapshot)
          .map((row) => row.action)
          .find((item): item is TaskGuideAction => Boolean(item) && item!.command === button.dataset.guideCommand)
      : undefined;
    const railAction = resolveFields(definition.fields, snapshot)
      .map(fieldAction)
      .find((item) => item.command === button.dataset.guideCommand);
    const action = cancel && cancel.command === button.dataset.guideCommand
      ? cancel
      : railAction ?? rowAction ?? (done
      ? definition.done?.actions?.find((item) => item.command === button.dataset.guideCommand)
      : [definition.steps[step - 1]?.primary, definition.steps[step - 1]?.secondary].find(
          (item): item is TaskGuideAction => Boolean(item) && item!.command === button.dataset.guideCommand,
        ));
    if (!action) return;
    options.onCommand({
      action,
      step: done ? null : definition.steps[step - 1] ?? null,
      stepIndex: step,
      done,
    });
  }

  element.addEventListener("click", onClick);
  render();

  return {
    element,
    setSnapshot(next) {
      snapshot = next;
      render();
    },
    setStep(next) {
      step = Math.max(1, Math.min(definition.steps.length, Math.round(next) || 1));
      error = "";
      render();
    },
    setBusy(next) {
      busy = next;
      render();
    },
    setError(message) {
      error = message;
      render();
    },
    complete() {
      done = true;
      busy = false;
      error = "";
      render();
    },
    reset() {
      done = false;
      busy = false;
      error = "";
      step = 1;
      snapshot = null;
      lastCurrentField = null;
      railScrollLeft = 0;
      render();
    },
    refresh() {
      render();
    },
    destroy() {
      element.removeEventListener("click", onClick);
      element.remove();
    },
  };
}

