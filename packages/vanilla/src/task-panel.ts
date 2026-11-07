import type {
  TaskBinding,
  TaskChoice,
  TaskController,
  TaskField,
  TaskRunSnapshot,
  TaskStepSnapshot,
  TaskValue,
  TaskValues,
} from "@plingjs/agent";
import { translate, type MessageParams } from "@plingjs/ui";

export interface GuidedTaskPanelOptions {
  /** Locale for framework-owned labels. Task titles and field labels stay application-defined. */
  locale?: string;
  /** Optional translator, for example the shared `pling.ui.t` function. */
  t?: (key: string, params?: MessageParams) => string;
  /** Heading shown above the task list. */
  title?: string;
  /**
   * `panel` is the standalone task workspace. `card` is the compact form that
   * belongs in a conversation: same state machine and fields, tighter chrome.
   */
  variant?: "panel" | "card";
  /**
   * In card mode, show the task catalog while no run is active. Set `false`
   * when the page already exposes its own task entrances.
   */
  catalog?: boolean;
  /** Open this task immediately instead of showing the task list. */
  initialTask?: string;
  /** Called when an agent-mode task has produced its prompt. */
  onPrompt?: (prompt: string, snapshot: TaskRunSnapshot) => void;
  /** Called after a deterministic task finishes, fails, or is cancelled. */
  onComplete?: (snapshot: TaskRunSnapshot) => void;
}

export interface GuidedTaskPanel {
  readonly element: HTMLElement;
  open(taskId: string, values?: TaskValues, binding?: TaskBinding): void;
  close(): void;
  refresh(): void;
  /** Show or hide the task catalog without losing the current run. */
  setCatalog(visible: boolean): void;
  destroy(): void;
}

interface FieldBinding {
  field: TaskField;
  input?: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  selected?: HTMLElement;
  lookupStatus?: HTMLElement;
  lookupResults?: HTMLElement;
  lookupQuery?: string;
  lookupLabels: Map<string, string>;
  abort?: AbortController;
  timer?: ReturnType<typeof setTimeout>;
}

interface RenderedField {
  binding: FieldBinding;
  group: HTMLElement;
}

const ICONS: Record<TaskStepSnapshot["status"], string> = {
  pending: "○",
  running: "◌",
  ok: "✓",
  skipped: "–",
  failed: "×",
};

const TASK_PANEL_STYLES = `
.pling-task-panel {
  --pling-task-bg: var(--pling-color-surface, #fff);
  --pling-task-muted: var(--pling-color-surface-muted, #f8fafc);
  --pling-task-text: var(--pling-color-text, #0f172a);
  --pling-task-subtle: var(--pling-color-text-muted, #64748b);
  --pling-task-border: var(--pling-color-border, #e3e8f0);
  --pling-task-primary: var(--pling-color-primary, #2e9df7);
  --pling-task-primary-strong: var(--pling-color-primary-strong, #1677c8);
  --pling-task-success: var(--pling-color-success, #15803d);
  --pling-task-danger: var(--pling-color-danger, #b91c1c);
  --pling-task-warning: var(--pling-color-warning, #9a6700);
  color: var(--pling-task-text);
  background: var(--pling-task-bg);
  border: 1px solid var(--pling-task-border);
  border-radius: 16px;
  box-shadow: 0 18px 44px rgb(15 23 42 / 8%);
  font-family: var(--pling-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  overflow: hidden;
}
.pling-task-panel *, .pling-task-panel *::before, .pling-task-panel *::after { box-sizing: border-box; }
.pling-task-panel__head { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; padding: 22px 24px 16px; }
.pling-task-panel__eyebrow { margin: 0 0 5px; color: var(--pling-task-primary-strong); font-size: 11px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
.pling-task-panel__title { margin: 0; font-size: 20px; line-height: 1.25; letter-spacing: -.02em; }
.pling-task-panel__intro { margin: 6px 0 0; color: var(--pling-task-subtle); font-size: 13px; line-height: 1.55; }
.pling-task-panel__binding { margin: 10px 0 0; padding: 8px 10px; border-radius: 8px; background: var(--pling-task-muted); color: var(--pling-task-text); font-size: 12px; line-height: 1.5; }
.pling-task-panel__body { padding: 0 24px 24px; }
.pling-task-panel__list { display: grid; gap: 10px; }
.pling-task-card { width: 100%; padding: 15px 16px; border: 1px solid var(--pling-task-border); border-radius: 12px; background: var(--pling-task-bg); color: inherit; text-align: left; cursor: pointer; transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease; }
.pling-task-card:hover, .pling-task-card:focus-visible { border-color: var(--pling-task-primary); box-shadow: 0 8px 22px rgb(46 157 247 / 12%); outline: none; transform: translateY(-1px); }
.pling-task-card:disabled { cursor: default; opacity: 1; }
.pling-task-card:disabled:hover { border-color: var(--pling-task-border); box-shadow: none; transform: none; }
.pling-task-card__title { display: flex; gap: 8px; align-items: center; justify-content: space-between; margin: 0; font-size: 14px; font-weight: 700; }
.pling-task-card__desc { margin: 5px 0 0; color: var(--pling-task-subtle); font-size: 12.5px; line-height: 1.55; }
.pling-task-card__requirement { margin: 9px 0 0; color: var(--pling-task-warning); font-size: 11.5px; line-height: 1.5; }
.pling-task-card__examples { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 0; padding: 0; list-style: none; }
.pling-task-card__examples li { padding: 4px 8px; border-radius: 999px; background: var(--pling-task-muted); color: var(--pling-task-subtle); font-size: 11px; }
.pling-task-panel__empty { margin: 0; padding: 18px; border: 1px dashed var(--pling-task-border); border-radius: 12px; color: var(--pling-task-subtle); font-size: 13px; text-align: center; }
.pling-task-panel__back { padding: 0; border: 0; background: none; color: var(--pling-task-primary-strong); font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
.pling-task-panel__back:hover { text-decoration: underline; }
.pling-task-panel__fields { display: grid; gap: 14px; margin-top: 14px; }
.pling-task-field { display: grid; gap: 6px; }
.pling-task-field__label { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 12.5px; font-weight: 650; }
.pling-task-field__requirement { color: var(--pling-task-subtle); font-size: 10.5px; font-weight: 550; }
.pling-task-field__help { margin: 0; color: var(--pling-task-subtle); font-size: 11.5px; line-height: 1.45; }
.pling-task-field input[type="text"], .pling-task-field input[type="number"], .pling-task-field input[type="date"], .pling-task-field textarea, .pling-task-field select { width: 100%; min-height: 38px; padding: 8px 10px; border: 1px solid var(--pling-task-border); border-radius: 8px; background: var(--pling-task-bg); color: var(--pling-task-text); font: inherit; font-size: 13px; }
.pling-task-field textarea { min-height: 76px; resize: vertical; }
.pling-task-field input:focus, .pling-task-field textarea:focus, .pling-task-field select:focus { border-color: var(--pling-task-primary); outline: 3px solid var(--pling-task-primary-soft, #eaf6ff); }
.pling-task-field__check { display: flex; align-items: center; gap: 8px; min-height: 34px; font-size: 13px; }
.pling-task-field__check input { width: 16px; height: 16px; accent-color: var(--pling-task-primary); }
.pling-task-lookup { display: grid; gap: 7px; }
.pling-task-lookup__row { display: flex; gap: 7px; }
.pling-task-lookup__row input { flex: 1 1 auto; }
.pling-task-lookup__selected { display: flex; gap: 8px; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 8px; background: var(--pling-task-muted); color: var(--pling-task-text); font-size: 12.5px; }
.pling-task-lookup__selected strong { font-weight: 650; }
.pling-task-lookup__clear { padding: 0; border: 0; background: none; color: var(--pling-task-subtle); font: inherit; font-size: 11px; cursor: pointer; }
.pling-task-lookup__status { margin: 0; color: var(--pling-task-subtle); font-size: 11.5px; }
.pling-task-lookup__results { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.pling-task-choice { width: 100%; padding: 9px 10px; border: 1px solid var(--pling-task-border); border-radius: 8px; background: var(--pling-task-bg); color: inherit; text-align: left; cursor: pointer; }
.pling-task-choice:hover, .pling-task-choice:focus-visible { border-color: var(--pling-task-primary); background: var(--pling-task-primary-soft, #eaf6ff); outline: none; }
.pling-task-choice strong { display: block; font-size: 12.5px; }
.pling-task-choice span { display: block; margin-top: 2px; color: var(--pling-task-subtle); font-size: 11px; }
.pling-task-panel__steps { display: grid; gap: 0; margin: 18px 0 0; padding: 0; list-style: none; }
.pling-task-step { position: relative; display: grid; grid-template-columns: 26px 1fr; gap: 8px; padding-bottom: 15px; }
.pling-task-step:last-child { padding-bottom: 0; }
.pling-task-step::before { content: ""; position: absolute; top: 23px; bottom: 0; left: 11px; width: 1px; background: var(--pling-task-border); }
.pling-task-step:last-child::before { display: none; }
.pling-task-step__icon { display: grid; place-items: center; width: 23px; height: 23px; border: 1px solid var(--pling-task-border); border-radius: 50%; background: var(--pling-task-bg); color: var(--pling-task-subtle); font-size: 12px; font-weight: 750; }
.pling-task-step[data-status="running"] .pling-task-step__icon { border-color: var(--pling-task-primary); color: var(--pling-task-primary-strong); }
.pling-task-step[data-status="ok"] .pling-task-step__icon { border-color: var(--pling-task-success); color: var(--pling-task-success); }
.pling-task-step[data-status="failed"] .pling-task-step__icon { border-color: var(--pling-task-danger); color: var(--pling-task-danger); }
.pling-task-step[data-status="skipped"] .pling-task-step__icon { color: var(--pling-task-warning); }
.pling-task-step__label { margin: 2px 0 0; font-size: 12.5px; font-weight: 620; }
.pling-task-step__summary { margin: 2px 0 0; color: var(--pling-task-subtle); font-size: 11.5px; line-height: 1.45; }
.pling-task-step__error { margin: 4px 0 0; color: var(--pling-task-danger); font-size: 11.5px; line-height: 1.45; overflow-wrap: anywhere; }
.pling-task-panel__error { margin: 14px 0 0; padding: 10px 12px; border-radius: 9px; background: var(--pling-task-danger-soft, #fee2e2); color: var(--pling-task-danger); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.pling-task-panel__hint { margin: 12px 0 0; color: var(--pling-task-subtle); font-size: 11.5px; line-height: 1.5; }
.pling-task-panel__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.pling-task-panel__primary, .pling-task-panel__secondary { min-height: 36px; padding: 7px 14px; border-radius: 8px; font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer; }
.pling-task-panel__primary { border: 1px solid var(--pling-task-primary); background: var(--pling-task-primary); color: var(--pling-color-on-primary, #fff); }
.pling-task-panel__primary:hover:not(:disabled) { background: var(--pling-task-primary-strong); border-color: var(--pling-task-primary-strong); }
.pling-task-panel__secondary { border: 1px solid var(--pling-task-border); background: var(--pling-task-bg); color: var(--pling-task-text); }
.pling-task-panel__secondary:hover:not(:disabled) { border-color: var(--pling-task-primary); color: var(--pling-task-primary-strong); }
.pling-task-panel__primary:disabled, .pling-task-panel__secondary:disabled { cursor: not-allowed; opacity: .5; }
.pling-task-panel__primary:focus-visible, .pling-task-panel__secondary:focus-visible { outline: 3px solid var(--pling-task-primary-soft, #eaf6ff); outline-offset: 1px; }
.pling-task-panel__status { color: var(--pling-task-subtle); font-size: 11.5px; }

/* Conversation card: same task semantics, less furniture. It should read as
   one message among the transcript rather than a second app inside the dock. */
.pling-task-panel--card {
  border-radius: 14px;
  background: var(--pling-task-muted);
  box-shadow: none;
}
.pling-task-panel--card .pling-task-panel__head { padding: 14px 14px 10px; }
.pling-task-panel--card .pling-task-panel__eyebrow { margin-bottom: 3px; font-size: 9.5px; letter-spacing: .09em; }
.pling-task-panel--card .pling-task-panel__title { font-size: 14px; letter-spacing: -.01em; }
.pling-task-panel--card .pling-task-panel__intro { margin-top: 4px; font-size: 12px; line-height: 1.5; }
.pling-task-panel--card .pling-task-panel__body { padding: 0 12px 12px; }
.pling-task-panel--card .pling-task-panel__list { gap: 7px; }
.pling-task-panel--card .pling-task-card {
  padding: 11px 12px;
  border-radius: 10px;
  background: var(--pling-task-bg);
}
.pling-task-panel--card .pling-task-card__title { font-size: 12.5px; }
.pling-task-panel--card .pling-task-card__desc {
  display: -webkit-box;
  margin-top: 3px;
  overflow: hidden;
  font-size: 11.5px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.pling-task-panel--card .pling-task-card__examples { display: none; }
.pling-task-panel--card .pling-task-panel__back { margin-bottom: 8px; }
.pling-task-panel--card .pling-task-panel__fields { gap: 11px; margin-top: 10px; }
.pling-task-panel--card .pling-task-step__label { font-size: 12px; }
.pling-task-panel--card .pling-task-step__summary { font-size: 11px; }
.pling-task-panel--card .pling-task-panel__actions { margin-top: 13px; }
.pling-task-panel--card .pling-task-panel__primary,
.pling-task-panel--card .pling-task-panel__secondary { min-height: 32px; padding: 6px 11px; font-size: 12px; }
@media (max-width: 560px) {
  .pling-task-panel__head { padding: 18px 18px 12px; }
  .pling-task-panel__body { padding: 0 18px 18px; }
  .pling-task-panel--card .pling-task-panel__head { padding: 14px 14px 10px; }
  .pling-task-panel--card .pling-task-panel__body { padding: 0 12px 12px; }
}
`;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isLookup(field: TaskField): boolean {
  return Boolean(field.lookup);
}

function emptyValue(field: TaskField): TaskValue {
  return field.type === "boolean" ? false : undefined;
}

function statusLabel(t: (key: string, params?: MessageParams) => string, status: TaskStepSnapshot["status"]): string {
  return t(`tasks.step.${status}`);
}

function humanResult(result: unknown): string | undefined {
  if (typeof result === "string" && result.trim()) return result;
  if (typeof result === "number" || typeof result === "boolean") return String(result);
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    // Executor receipts wrap the business return value in `data`; older task
    // bridges may pass the business object directly. Both should read the same.
    if (record.data !== undefined) {
      const data = humanResult(record.data);
      if (data) return data;
    }
    for (const key of ["message", "summary", "label", "title"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return undefined;
}

function humanError(message: string): string {
  // Executor receipts start with the raw action id. The task panel is the
  // human-facing layer; keep the reason, drop the implementation detail.
  return message
    .replace(/^Action \S+ failed:\s*/i, "")
    .replace(/^Action \S+ ran, but\s*/i, "");
}

export function createTaskPanel(
  controller: TaskController,
  options: GuidedTaskPanelOptions = {},
): GuidedTaskPanel {
  const locale = options.locale ?? "en-US";
  const t = options.t ?? ((key: string, params?: MessageParams) => translate(locale, key, params));
  const variant = options.variant ?? "panel";
  let showCatalog = options.catalog ?? true;
  const root = element("section", "pling-task-panel");
  root.classList.toggle("pling-task-panel--card", variant === "card");
  root.dataset.variant = variant;
  root.dataset.testid = "pling-guided-tasks";
  root.setAttribute("aria-label", options.title ?? t("tasks.title"));
  const style = element("style");
  style.textContent = TASK_PANEL_STYLES;
  root.append(style);

  const head = element("header", "pling-task-panel__head");
  const heading = element("div");
  const eyebrow = element("p", "pling-task-panel__eyebrow", t("tasks.title"));
  const title = element("h2", "pling-task-panel__title", options.title ?? t("tasks.title"));
  heading.append(eyebrow, title);
  head.append(heading);

  const body = element("div", "pling-task-panel__body");
  const listView = element("div");
  const runView = element("div");
  runView.hidden = true;
  body.append(listView, runView);
  root.append(head, body);

  let snapshot: TaskRunSnapshot | null = null;
  let generation = 0;
  let formGeneration = -1;
  let destroyed = false;
  let localError = "";
  let busy = false;
  let activeSubtitle: HTMLElement | null = null;
  let runTitle: HTMLElement | null = null;
  let fieldsHost: HTMLElement | null = null;
  let stepsHost: HTMLElement | null = null;
  let noteHost: HTMLElement | null = null;
  let actionsHost: HTMLElement | null = null;
  let bindings = new Map<string, FieldBinding>();

  function setError(message: string): void {
    localError = message;
    render();
  }

  function renderTaskList(): void {
    if (variant === "card" && !showCatalog) {
      listView.replaceChildren();
      listView.hidden = true;
      runView.hidden = true;
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const definitions = controller.list();
    listView.replaceChildren();
    const intro = element("p", "pling-task-panel__intro", t("tasks.pick"));
    listView.append(intro);
    if (!definitions.length) {
      listView.append(element("p", "pling-task-panel__empty", t("tasks.empty")));
      return;
    }
    const list = element("div", "pling-task-panel__list");
    for (const definition of definitions) {
      const card = element("button", "pling-task-card");
      card.type = "button";
      card.disabled = definition.requiresRecord === true;
      card.setAttribute("aria-label", definition.title);
      const cardTitle = element("p", "pling-task-card__title", definition.title);
      const chevron = element("span");
      chevron.textContent = "→";
      chevron.setAttribute("aria-hidden", "true");
      cardTitle.append(chevron);
      card.append(cardTitle);
      if (definition.description) card.append(element("p", "pling-task-card__desc", definition.description));
      if (definition.requiresRecord) {
        card.append(element("p", "pling-task-card__requirement", t("tasks.recordRequired")));
      }
      if (definition.examples?.length) {
        const examples = element("ul", "pling-task-card__examples");
        for (const example of definition.examples) examples.append(element("li", undefined, example));
        card.append(examples);
      }
      if (!definition.requiresRecord) card.addEventListener("click", () => open(definition.id));
      list.append(card);
    }
    listView.append(list);
    listView.hidden = false;
    runView.hidden = true;
  }

  function createField(field: TaskField, values: TaskValues): RenderedField {
    const binding: FieldBinding = { field, lookupLabels: new Map() };
    const group = element("div", "pling-task-field");
    const labelRow = element("label", "pling-task-field__label");
    labelRow.htmlFor = `pling-task-${generation}-${field.name}`;
    labelRow.append(element("span", undefined, field.label));
    labelRow.append(
      element("span", "pling-task-field__requirement", field.optional ? t("tasks.optional") : t("tasks.required")),
    );
    group.append(labelRow);

    if (isLookup(field)) {
      const wrapper = element("div", "pling-task-lookup");
      const selected = element("div", "pling-task-lookup__selected");
      selected.hidden = true;
      const selectedText = element("strong");
      const clear = element("button", "pling-task-lookup__clear", t("tasks.clear"));
      clear.type = "button";
      selected.append(selectedText, clear);
      const row = element("div", "pling-task-lookup__row");
      const input = element("input");
      input.id = labelRow.htmlFor;
      input.type = "search";
      input.autocomplete = "off";
      const minChars = Math.max(1, field.minChars ?? 1);
      input.placeholder = field.placeholder ?? t("tasks.searchPlaceholder", { count: minChars });
      const search = element("button", "pling-task-panel__secondary", t("tasks.search"));
      search.type = "button";
      row.append(input, search);
      const lookupStatus = element("p", "pling-task-lookup__status");
      const lookupResults = element("ul", "pling-task-lookup__results");
      wrapper.append(selected, row, lookupStatus, lookupResults);
      group.append(wrapper);
      binding.input = input;
      binding.selected = selected;
      binding.lookupStatus = lookupStatus;
      binding.lookupResults = lookupResults;

      const clearSelection = (): void => {
        binding.lookupLabels.clear();
        controller.setValue(field.name, emptyValue(field));
      };
      clear.addEventListener("click", clearSelection);
      const searchNow = (): void => {
        void lookup(field, binding, input.value.trim());
      };
      search.addEventListener("click", searchNow);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          searchNow();
        }
      });
      input.addEventListener("input", () => {
        if (binding.timer) clearTimeout(binding.timer);
        const query = input.value.trim();
        if (query.length < minChars) {
          binding.lookupStatus!.textContent = t("tasks.searchPlaceholder", { count: minChars });
          binding.lookupResults!.replaceChildren();
          return;
        }
        binding.timer = setTimeout(searchNow, 220);
      });
      binding.lookupStatus.textContent = t("tasks.searchPlaceholder", { count: minChars });
      const current = values[field.name];
      if (current !== undefined && current !== null && current !== "") {
        selectedText.textContent = String(current);
        selected.hidden = false;
      }
      return { binding, group };
    }

    if (field.values?.length) {
      const select = element("select");
      select.id = labelRow.htmlFor;
      const placeholder = element("option", undefined, field.placeholder ?? "—");
      placeholder.value = "";
      select.append(placeholder);
      for (const choice of field.values) {
        const option = element("option", undefined, choice.label);
        option.value = choice.value;
        select.append(option);
      }
      const current = values[field.name];
      select.value = current === undefined || current === null ? "" : String(current);
      select.addEventListener("change", () => {
        controller.setValue(field.name, select.value === "" ? emptyValue(field) : select.value);
      });
      group.append(select);
      binding.input = select;
      return { binding, group };
    }

    if (field.type === "boolean") {
      const check = element("label", "pling-task-field__check");
      const input = element("input");
      input.id = labelRow.htmlFor;
      input.type = "checkbox";
      input.checked = values[field.name] === true;
      input.addEventListener("change", () => controller.setValue(field.name, input.checked));
      check.append(input, element("span", undefined, field.help ?? field.label));
      group.append(check);
      binding.input = input;
      return { binding, group };
    }

    const input = field.type === "textarea" ? element("textarea") : element("input");
    input.id = labelRow.htmlFor;
    if (field.type === "textarea") {
      (input as HTMLTextAreaElement).rows = 3;
      (input as HTMLTextAreaElement).value = String(values[field.name] ?? "");
    } else {
      const textInput = input as HTMLInputElement;
      textInput.type = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
      textInput.value = values[field.name] === undefined || values[field.name] === null ? "" : String(values[field.name]);
    }
    if (field.placeholder) input.placeholder = field.placeholder;
    input.addEventListener("input", () => {
      const raw = input.value;
      if (field.type === "number") {
        controller.setValue(field.name, raw.trim() === "" ? emptyValue(field) : Number(raw));
      } else {
        controller.setValue(field.name, raw.trim() === "" ? emptyValue(field) : raw);
      }
    });
    group.append(input);
    binding.input = input;
    return { binding, group };
  }

  function buildRunView(): void {
    if (!snapshot) return;
    const definition = controller.get(snapshot.taskId);
    runView.replaceChildren();
    bindings = new Map();

    const back = element("button", "pling-task-panel__back", `← ${t("tasks.back")}`);
    back.type = "button";
    back.addEventListener("click", close);
    runView.append(back);

    const headWrap = element("div");
    const titleRow = element("div");
    runTitle = element("h3", "pling-task-panel__title pling-task-panel__run-title", snapshot.title);
    titleRow.append(runTitle);
    activeSubtitle = element("p", "pling-task-panel__intro", definition?.description ?? "");
    activeSubtitle.hidden = !definition?.description;
    headWrap.append(titleRow, activeSubtitle);
    if (snapshot.binding?.record) {
      const label = snapshot.binding.record.label?.trim() || snapshot.binding.record.id;
      headWrap.append(element("p", "pling-task-panel__binding", t("tasks.boundRecord", { label })));
    }
    runView.append(headWrap);

    const form = element("form");
    form.noValidate = true;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void execute();
    });
    fieldsHost = element("div", "pling-task-panel__fields");
    const fieldList = definition?.fields ?? [];
    for (const field of fieldList) {
      const { binding, group } = createField(field, snapshot.values);
      bindings.set(field.name, binding);
      if (field.help && field.type !== "boolean") {
        const help = element("p", "pling-task-field__help", field.help);
        group.append(help);
      }
      fieldsHost.append(group);
    }
    form.append(fieldsHost);
    runView.append(form);

    stepsHost = element("ol", "pling-task-panel__steps");
    runView.append(stepsHost);
    noteHost = element("div");
    runView.append(noteHost);
    actionsHost = element("div", "pling-task-panel__actions");
    runView.append(actionsHost);
    formGeneration = generation;
    syncRunView();
  }

  async function lookup(field: TaskField, binding: FieldBinding, query: string): Promise<void> {
    if (!field.lookup || !binding.lookupStatus || !binding.lookupResults) return;
    const minChars = Math.max(1, field.minChars ?? 1);
    if (query.length < minChars) {
      binding.lookupStatus.textContent = t("tasks.searchPlaceholder", { count: minChars });
      binding.lookupResults.replaceChildren();
      return;
    }
    binding.abort?.abort();
    const abort = new AbortController();
    binding.abort = abort;
    binding.lookupStatus.textContent = t("tasks.searching");
    binding.lookupResults.replaceChildren();
    try {
      const choices = await field.lookup(query, { signal: abort.signal });
      if (abort.signal.aborted) return;
      binding.lookupQuery = query;
      binding.lookupStatus.textContent = choices.length ? t("tasks.chooseResult") : t("tasks.noResults");
      binding.lookupResults.replaceChildren();
      for (const choice of choices) {
        binding.lookupResults.append(choiceButton(field, binding, choice));
      }
    } catch (error) {
      if (abort.signal.aborted) return;
      binding.lookupStatus.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  function choiceButton(field: TaskField, binding: FieldBinding, choice: TaskChoice): HTMLElement {
    const item = element("li");
    const button = element("button", "pling-task-choice");
    button.type = "button";
    button.append(element("strong", undefined, choice.label));
    if (choice.description) button.append(element("span", undefined, choice.description));
    button.addEventListener("click", () => {
      binding.lookupLabels.set(choice.value, choice.label);
      if (binding.input) binding.input.value = choice.label;
      if (binding.selected) {
        binding.selected.hidden = false;
        const text = binding.selected.querySelector("strong");
        if (text) text.textContent = choice.label;
      }
      if (binding.lookupStatus) binding.lookupStatus.textContent = t("tasks.selected");
      binding.lookupResults?.replaceChildren();
      controller.setValue(field.name, choice.value);
    });
    item.append(button);
    return item;
  }

  function syncFields(): void {
    if (!snapshot) return;
    for (const [name, binding] of bindings) {
      const value = snapshot.values[name];
      if (binding.selected) {
        if (value === undefined || value === null || value === "") {
          binding.selected.hidden = true;
        } else {
          binding.selected.hidden = false;
          const text = binding.selected.querySelector("strong");
          if (text) text.textContent = binding.lookupLabels.get(String(value)) ?? String(value);
        }
      }
      const input = binding.input;
      if (!input || isLookup(binding.field) || binding.field.values?.length) continue;
      if (document.activeElement === input) continue;
      if (input instanceof HTMLInputElement && input.type === "checkbox") {
        input.checked = value === true;
      } else {
        input.value = value === undefined || value === null ? "" : String(value);
      }
    }
  }

  function syncSteps(): void {
    if (!stepsHost || !snapshot) return;
    stepsHost.replaceChildren();
    if (!snapshot.steps.length) {
      stepsHost.hidden = true;
      return;
    }
    stepsHost.hidden = false;
    for (const step of snapshot.steps) {
      const item = element("li", "pling-task-step");
      item.dataset.status = step.status;
      const icon = element("span", "pling-task-step__icon", ICONS[step.status]);
      icon.setAttribute("aria-label", statusLabel(t, step.status));
      const copy = element("div");
      const label = element("p", "pling-task-step__label", step.label);
      copy.append(label);
      if (step.summary) copy.append(element("p", "pling-task-step__summary", step.summary));
      if (step.error) copy.append(element("p", "pling-task-step__error", humanError(step.error.message)));
      else {
        const result = humanResult(step.result);
        if (result) copy.append(element("p", "pling-task-step__summary", result));
      }
      item.append(icon, copy);
      stepsHost.append(item);
    }
  }

  function syncActions(): void {
    if (!actionsHost || !snapshot) return;
    actionsHost.replaceChildren();
    noteHost?.replaceChildren();
    const definition = controller.get(snapshot.taskId);
    const mode = snapshot.mode;
    const status = snapshot.status;
    const ready = status === "ready" || status === "planned";
    const waitingConfirmation = status === "waiting" && snapshot.waitingFor === "confirmation";
    const running =
      status === "running" ||
      status === "verifying" ||
      (status === "waiting" && snapshot.waitingFor === "handoff");

    if (status === "collecting") {
      noteHost?.append(element("p", "pling-task-panel__hint", t("tasks.needFields")));
    } else if (mode === "agent" && ready) {
      noteHost?.append(element("p", "pling-task-panel__hint", t("tasks.agentReady")));
    } else if (status === "done") {
      noteHost?.append(element("p", "pling-task-panel__hint", t("tasks.done")));
    } else if (status === "cancelled") {
      noteHost?.append(element("p", "pling-task-panel__hint", t("tasks.cancelled")));
    } else if (status === "verifying") {
      noteHost?.append(element("p", "pling-task-panel__hint", t("tasks.verifying")));
    } else if (status === "waiting" && snapshot.waitingFor === "handoff") {
      noteHost?.append(element("p", "pling-task-panel__hint", t("tasks.waitingHandoff")));
    } else if (waitingConfirmation) {
      noteHost?.append(element("p", "pling-task-panel__hint", t("tasks.waitingConfirmation")));
    }

    if (snapshot.error) {
      noteHost?.append(
        element(
          "p",
          "pling-task-panel__error",
          `${t("tasks.error")} ${humanError(snapshot.error.message)}`,
        ),
      );
    } else if (localError) {
      noteHost?.append(element("p", "pling-task-panel__error", localError));
    }

    if (running) {
      const cancelButton = element("button", "pling-task-panel__secondary", t("tasks.cancel"));
      cancelButton.type = "button";
      cancelButton.addEventListener("click", () => controller.cancel());
      actionsHost.append(cancelButton);
    } else if (waitingConfirmation) {
      const confirmButton = element("button", "pling-task-panel__primary", t("tasks.confirm"));
      confirmButton.type = "button";
      confirmButton.addEventListener("click", () => {
        try {
          controller.confirm();
          void execute();
        } catch (error) {
          localError = error instanceof Error ? error.message : String(error);
          render();
        }
      });
      const cancelButton = element("button", "pling-task-panel__secondary", t("tasks.cancel"));
      cancelButton.type = "button";
      cancelButton.addEventListener("click", () => controller.cancel());
      actionsHost.append(confirmButton, cancelButton);
    } else if (status === "done" || status === "failed" || status === "cancelled") {
      const next = element("button", "pling-task-panel__primary", t("tasks.new"));
      next.type = "button";
      next.addEventListener("click", close);
      actionsHost.append(next);
    } else {
      const executeButton = element(
        "button",
        "pling-task-panel__primary",
        mode === "agent" ? t("tasks.send") : t("tasks.run"),
      );
      executeButton.type = "submit";
      executeButton.disabled = !ready || busy;
      executeButton.addEventListener("click", (event) => {
        event.preventDefault();
        void execute();
      });
      actionsHost.append(executeButton);
      const backButton = element("button", "pling-task-panel__secondary", t("tasks.back"));
      backButton.type = "button";
      backButton.addEventListener("click", close);
      actionsHost.append(backButton);
    }
  }

  function syncRunView(): void {
    if (!snapshot) return;
    if (runTitle) runTitle.textContent = snapshot.title;
    const definition = controller.get(snapshot.taskId);
    if (activeSubtitle) {
      activeSubtitle.textContent = definition?.description ?? "";
      activeSubtitle.hidden = !definition?.description;
    }
    syncFields();
    syncSteps();
    syncActions();
  }

  function render(): void {
    if (destroyed) return;
    if (!snapshot) {
      renderTaskList();
      return;
    }
    root.hidden = false;
    listView.hidden = true;
    runView.hidden = false;
    if (formGeneration !== generation) buildRunView();
    else syncRunView();
  }

  async function execute(): Promise<void> {
    if (!snapshot || busy) return;
    localError = "";
    busy = true;
    render();
    try {
      const final = await controller.run();
      if (final.mode === "agent" && final.status === "ready" && final.prompt) {
        options.onPrompt?.(final.prompt, final);
        root.dispatchEvent(
          new CustomEvent("pling-task-prompt", {
            bubbles: true,
            detail: { prompt: final.prompt, snapshot: final },
          }),
        );
      }
      if (final.status === "done" || final.status === "failed" || final.status === "cancelled") {
        options.onComplete?.(final);
        root.dispatchEvent(
          new CustomEvent("pling-task-complete", {
            bubbles: true,
            detail: { snapshot: final },
          }),
        );
      }
    } catch (error) {
      localError = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
      render();
    }
  }

  function open(taskId: string, values?: TaskValues, binding?: TaskBinding): void {
    if (destroyed) return;
    generation += 1;
    formGeneration = -1;
    localError = "";
    busy = false;
    snapshot = controller.start(taskId, values, binding);
    render();
  }

  function close(): void {
    if (destroyed) return;
    controller.cancel();
    controller.reset();
    snapshot = null;
    generation += 1;
    formGeneration = -1;
    bindings = new Map();
    localError = "";
    render();
  }

  const unsubscribe = controller.subscribe((next) => {
    snapshot = next;
    render();
  });

  if (options.initialTask) open(options.initialTask);
  else render();

  return {
    element: root,
    open,
    close,
    refresh: render,
    setCatalog(visible: boolean) {
      if (destroyed || showCatalog === visible) return;
      showCatalog = visible;
      render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      for (const binding of bindings.values()) {
        if (binding.timer) clearTimeout(binding.timer);
        binding.abort?.abort();
      }
      bindings.clear();
      root.replaceChildren();
    },
  };
}

/** Compact guided-task card for a chat message flow. */
export function createTaskCard(
  controller: TaskController,
  options: Omit<GuidedTaskPanelOptions, "variant"> = {},
): GuidedTaskPanel {
  return createTaskPanel(controller, { ...options, variant: "card" });
}

