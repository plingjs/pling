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

const TASK_GUIDE_STYLES = `
.pling-guide { display: grid; gap: 14px; width: 100%; color: var(--pling-color-text, #172033); }
.pling-guide *, .pling-guide *::before, .pling-guide *::after { box-sizing: border-box; }
.pling-guide__welcome { display: flex; align-items: flex-start; gap: 10px; }
.pling-guide__avatar { display: grid; width: 26px; height: 26px; flex: 0 0 auto; place-items: center; border-radius: 8px; color: var(--pling-color-primary-strong, #0872b4); background: var(--pling-color-primary-soft, #e7f4ff); font-size: 12px; font-weight: 760; }
.pling-guide__bubble { max-width: 100%; padding: 10px 12px; border: 1px solid var(--pling-color-border, #e4edf6); border-radius: 4px 12px 12px; color: var(--pling-color-text-muted, #445166); background: var(--pling-color-surface, #fff); font-size: 13px; line-height: 1.6; box-shadow: 0 4px 14px rgb(27 57 88 / 4%); }
.pling-guide__welcome.has-avatar .pling-guide__bubble { max-width: calc(100% - 36px); }
.pling-guide__card { overflow: hidden; border: 1px solid var(--pling-guide-border, #cfe2f5); border-radius: 16px; background: var(--pling-color-surface, #fff); box-shadow: 0 14px 36px rgb(35 83 129 / 9%); }
.pling-guide__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px 14px; border-bottom: 1px solid #e8f0f7; background: linear-gradient(180deg, #fbfdff, #f7fbff); }
.pling-guide__title-row { display: flex; align-items: center; gap: 9px; }
.pling-guide__icon { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 9px; color: var(--pling-color-primary-strong, #0872b4); background: var(--pling-color-primary-soft, #e7f4ff); font-size: 13px; font-weight: 780; }
.pling-guide__title { margin: 0; font-size: 15px; line-height: 1.35; letter-spacing: -.01em; }
.pling-guide__subtitle { margin: 4px 0 0; color: var(--pling-color-text-muted, #728095); font-size: 12px; line-height: 1.45; }
.pling-guide__head-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; }
.pling-guide__state { flex: 0 0 auto; padding: 4px 9px; border-radius: 999px; color: var(--pling-color-primary-strong, #0872b4); background: #e9f5ff; font-size: 11px; font-weight: 700; }
.pling-guide__state.is-done { color: var(--pling-color-success, #17794e); background: var(--pling-color-success-soft, #eaf8f0); }
.pling-guide__cancel { min-height: 26px; padding: 0 8px; border: 1px solid transparent; border-radius: 7px; color: var(--pling-color-text-muted, #728095); background: transparent; font: inherit; font-size: 11px; cursor: pointer; }
.pling-guide__cancel:hover { border-color: var(--pling-color-border, #d8e5f1); color: var(--pling-color-text, #172033); background: #fff; }
.pling-guide__progress { height: 4px; background: #e8f1f9; }
.pling-guide__progress > span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #54b9ff, #2386d8); transition: width 260ms ease; }
.pling-guide__body { padding: 16px 18px 18px; }
.pling-guide__steps { display: grid; gap: 2px; margin: 0 0 16px; padding: 0; list-style: none; }
.pling-guide__step { position: relative; display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; min-height: 36px; align-items: center; gap: 9px; color: var(--pling-color-text-muted, #728095); font-size: 12.5px; line-height: 1.45; }
.pling-guide__step:not(:last-child)::before { position: absolute; top: 24px; bottom: -10px; left: 10px; width: 1px; background: #e0ebf5; content: ""; }
.pling-guide__dot { position: relative; z-index: 1; display: grid; width: 22px; height: 22px; place-items: center; border: 1px solid #d8e5f1; border-radius: 50%; color: #94a4b7; background: #fff; font-size: 10.5px; font-weight: 700; }
.pling-guide__step.is-current { color: var(--pling-color-text, #172033); font-weight: 660; }
.pling-guide__step.is-current .pling-guide__dot { border-color: #7ac2f8; color: var(--pling-color-primary-strong, #0872b4); background: #eaf6ff; box-shadow: 0 0 0 3px rgb(46 157 247 / 9%); }
.pling-guide__step.is-done { color: #6b7d90; }
.pling-guide__step.is-done .pling-guide__dot { border-color: #b5e4cb; color: var(--pling-color-success, #17794e); background: var(--pling-color-success-soft, #eaf8f0); }
.pling-guide__step small { color: var(--pling-color-text-subtle, #9aa7b8); font-size: 11px; font-weight: 500; }
.pling-guide__panel-title { margin: 0 0 5px; color: var(--pling-color-text, #172033); font-size: 14px; line-height: 1.4; font-weight: 690; }
.pling-guide__panel-copy { margin: 0 0 13px; color: var(--pling-color-text-muted, #728095); font-size: 12.5px; line-height: 1.6; }
.pling-guide__summary, .pling-guide__handoff { margin-top: 2px; padding: 12px 13px; border: 1px solid #dceaf6; border-radius: 11px; background: #f8fbff; font-size: 12px; line-height: 1.6; }
.pling-guide__summary > strong, .pling-guide__handoff > strong { display: block; color: var(--pling-color-text, #172033); }
.pling-guide__rows { display: grid; gap: 8px; margin: 10px 0 0; }
.pling-guide__row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; color: var(--pling-color-text-muted, #728095); }
.pling-guide__row-main { display: grid; flex: 1 1 auto; min-width: 0; gap: 2px; }
.pling-guide__row-value { display: flex; flex: 0 1 auto; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
.pling-guide__row b { color: var(--pling-color-text, #172033); font-weight: 630; text-align: right; }
.pling-guide__row.is-suggested b { color: var(--pling-color-primary-strong, #0872b4); font-weight: 620; }
.pling-guide__row.is-missing b { color: var(--pling-color-text-subtle, #8b9aae); font-weight: 560; }
.pling-guide__badge { padding: 2px 6px; border-radius: 999px; color: var(--pling-color-text-muted, #526277); background: #eef2f6; font-size: 10px; font-weight: 650; line-height: 1.4; white-space: nowrap; }
.pling-guide__badge.is-current { color: #17794e; background: #eaf8f0; }
.pling-guide__badge.is-suggested { color: #086aa8; background: #e9f5ff; }
.pling-guide__badge.is-missing { color: #8a651d; background: #fff6dd; }
.pling-guide__row-note { color: var(--pling-color-text-subtle, #8b9aae); font-size: 10.5px; line-height: 1.45; }
.pling-guide__row-action { min-height: 24px; padding: 0 7px; border: 1px solid #d8e5f1; border-radius: 6px; color: var(--pling-color-primary-strong, #0872b4); background: #fff; font: inherit; font-size: 10.5px; font-weight: 650; cursor: pointer; white-space: nowrap; }
.pling-guide__row-action:hover { border-color: #9dcff1; background: #f5fbff; }
.pling-guide__row-action:disabled { cursor: default; opacity: .55; }
.pling-guide__stars { color: var(--gold, #f4b43a); letter-spacing: .5px; }
.pling-guide__actions { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
.pling-guide__primary, .pling-guide__secondary { min-height: 36px; padding: 0 14px; border-radius: 9px; font-size: 12.5px; font-weight: 660; cursor: pointer; }
.pling-guide__primary { border: 1px solid #2e9df7; color: #fff; background: linear-gradient(180deg, #43aaf9, #278bda); box-shadow: 0 6px 14px rgb(46 157 247 / 18%); }
.pling-guide__primary:disabled { cursor: default; opacity: .62; }
.pling-guide__secondary { border: 1px solid #d9e5f0; color: var(--pling-color-text-muted, #445166); background: #fff; }
.pling-guide__error { margin: 10px 0 0; padding: 9px 10px; border-radius: 8px; color: var(--pling-color-danger, #b91c1c); background: var(--pling-color-danger-soft, #fee2e2); font-size: 12px; line-height: 1.5; }
.pling-guide__result { display: flex; align-items: flex-start; gap: 10px; padding: 13px 14px; border: 1px solid #cfe9da; border-radius: 11px; background: #f3fbf6; }
.pling-guide__check { display: grid; width: 26px; height: 26px; flex: 0 0 auto; place-items: center; border-radius: 50%; color: #fff; background: var(--pling-color-success, #28a66d); font-size: 13px; }
.pling-guide__result strong, .pling-guide__result span { display: block; }
.pling-guide__result strong { font-size: 13px; line-height: 1.4; }
.pling-guide__result span { margin-top: 3px; color: #648072; font-size: 12px; line-height: 1.55; }
.pling-guide__note { margin: 12px 2px 0; color: var(--pling-color-text-subtle, #8b9aae); font-size: 11px; line-height: 1.5; text-align: center; }
.pling-guide--rail { gap: 0; }
.pling-guide__rail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.pling-guide__rail-title { display: flex; min-width: 0; align-items: flex-start; gap: 9px; }
.pling-guide__rail-icon { display: grid; width: 24px; height: 24px; flex: 0 0 auto; place-items: center; border-radius: 7px; color: var(--pling-color-primary-strong, #0872b4); background: var(--pling-color-primary-soft, #e7f4ff); font-size: 12px; font-weight: 760; }
.pling-guide__rail-heading { margin: 0; color: var(--pling-color-text, #172033); font-size: 14px; line-height: 1.35; letter-spacing: -.01em; }
.pling-guide__rail-subtitle { margin: 2px 0 0; color: var(--pling-color-text-muted, #728095); font-size: 11px; line-height: 1.4; }
.pling-guide__rail-meta { display: flex; flex: 0 0 auto; align-items: center; gap: 5px; padding-top: 1px; }
.pling-guide__rail-state { padding: 3px 8px; border-radius: 999px; color: var(--pling-color-primary-strong, #0872b4); background: var(--pling-color-primary-soft, #e9f5ff); font-size: 11px; font-weight: 650; white-space: nowrap; }
.pling-guide__rail-state.is-done { color: var(--pling-color-success, #17794e); background: var(--pling-color-success-soft, #eaf8f0); }
.pling-guide__rail-cancel { display: grid; width: 22px; height: 22px; padding: 0; place-items: center; border: 1px solid transparent; border-radius: 6px; color: var(--pling-color-text-subtle, #8b9aae); background: transparent; font: inherit; font-size: 15px; line-height: 1; cursor: pointer; }
.pling-guide__rail-cancel:hover { border-color: var(--pling-color-border, #d8e5f1); color: var(--pling-color-text, #172033); background: #fff; }
.pling-guide__rail-cancel:disabled { cursor: default; opacity: .5; }
.pling-guide__rail-scroll { margin-top: 8px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.pling-guide__rail-scroll::-webkit-scrollbar { display: none; }
.pling-guide__rail-scroll.can-scroll-right { -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 18px), transparent); mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 18px), transparent); }
.pling-guide__rail-scroll.can-scroll-left { -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 100%); mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 100%); }
.pling-guide__rail-scroll.can-scroll-left.can-scroll-right { -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%); mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%); }
.pling-guide__rail { display: flex; width: max-content; align-items: flex-start; gap: 0; margin: 0; padding: 1px 1px 2px; list-style: none; }
.pling-guide__rail-item { display: flex; flex: 0 0 auto; align-items: center; }
.pling-guide__rail-node { display: flex; width: 68px; flex-direction: column; align-items: center; gap: 2px; padding: 0; border: 0; color: var(--pling-color-text-subtle, #8b9aae); background: none; font: inherit; cursor: pointer; }
.pling-guide__rail-node:hover .pling-guide__rail-dot { border-color: #9dcff1; color: var(--pling-color-primary-strong, #0872b4); }
.pling-guide__rail-dot { display: grid; width: 20px; height: 20px; place-items: center; border: 1px solid #d8e5f1; border-radius: 50%; color: #94a4b7; background: #fff; font-size: 10.5px; font-weight: 700; line-height: 1; transition: border-color 160ms ease, background 160ms ease, color 160ms ease; }
.pling-guide__rail-label { max-width: 68px; overflow: hidden; color: var(--pling-color-text-muted, #728095); font-size: 11px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.pling-guide__rail-flag { color: var(--pling-color-text-subtle, #9aa7b8); font-size: 11px; line-height: 1.3; }
.pling-guide__rail-item.is-filled .pling-guide__rail-dot { border-color: #b5e4cb; color: var(--pling-color-success, #17794e); background: var(--pling-color-success-soft, #eaf8f0); }
.pling-guide__rail-item.is-current .pling-guide__rail-dot { border-color: #69bdfb; color: var(--pling-color-primary-strong, #0872b4); background: #eaf6ff; box-shadow: 0 0 0 3px rgb(46 157 247 / 10%); }
.pling-guide__rail-item.is-current .pling-guide__rail-label { color: var(--pling-color-text, #172033); font-weight: 650; }
.pling-guide__rail-item.is-skipped .pling-guide__rail-dot { border-style: dashed; color: #a7b4c4; background: #fff; }
.pling-guide__rail-item.is-skipped .pling-guide__rail-label { color: var(--pling-color-text-subtle, #9aa7b8); }
.pling-guide__rail-item.is-suggested:not(.is-filled):not(.is-skipped) .pling-guide__rail-dot { border-style: dashed; border-color: #8bcfff; }
.pling-guide__rail-item.is-required .pling-guide__rail-flag { color: #8a651d; }
.pling-guide__rail-arrow { margin: 0 1px 20px; color: #c6d3e0; font-size: 13px; line-height: 1; }
.pling-guide__rail-node:disabled { cursor: default; }
.pling-guide__rail .pling-guide__error { margin-top: 8px; }
@media (max-width: 520px) { .pling-guide__actions { flex-wrap: wrap; } .pling-guide__primary, .pling-guide__secondary { flex: 1 1 auto; } }
`;

let stylesInstalled = false;

function installStyles(): void {
  if (stylesInstalled || typeof document === "undefined") return;
  stylesInstalled = true;
  if (document.querySelector("style[data-pling-task-guide]")) return;
  const style = document.createElement("style");
  style.dataset.plingTaskGuide = "true";
  style.textContent = TASK_GUIDE_STYLES;
  document.head.append(style);
}

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
  installStyles();
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
              <li class="${classes}" data-field="${escapeHtml(field.field)}">
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
      const node = element.querySelector<HTMLElement>(`.pling-guide__rail-item[data-field="${current}"]`);
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
    element.className = fields.length ? "pling-guide pling-guide--rail" : "pling-guide";
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

