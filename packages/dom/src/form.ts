/**
 * Framework-agnostic form surface.
 *
 * A form is the most common place where a person and an agent already share a
 * contract: labelled fields, current values, choices and a save action. This
 * module reads that contract from the real DOM instead of asking the page to
 * maintain a second, agent-only schema.
 *
 * The surface is deliberately narrow:
 *   · it only sees elements marked with `data-field`;
 *   · it never clicks arbitrary selectors or evaluates code;
 *   · writes go through the same native events a person produces, so Vue /
 *     React controlled inputs and the page's own validation stay authoritative.
 */

export type FormFieldKind = "text" | "textarea" | "number" | "select" | "boolean" | "human";

export type FormFieldValue = string | number | boolean | string[] | null;

export interface FormFieldChoice {
  value: string;
  label: string;
}

export interface FormFieldView {
  /** Stable field name from `data-field`. */
  name: string;
  /** Human-facing label, derived from the page unless `data-label` overrides it. */
  label: string;
  kind: FormFieldKind;
  required: boolean;
  value: FormFieldValue;
  /** Present for native selects. */
  options?: FormFieldChoice[];
  min?: number;
  max?: number;
  /** Why the agent cannot write this field. Present only when `kind === "human"`. */
  humanReason?: string;
  /** Optional developer-authored note from `data-hint`. */
  hint?: string;
}

export interface FormSurfaceView {
  fields: FormFieldView[];
  /** Required field names that still have no value. */
  missing: string[];
  complete: boolean;
}

export interface FormSurfaceSkip {
  field: string;
  reason: string;
}

export interface FormSurfaceFillResult {
  applied: string[];
  skipped: FormSurfaceSkip[];
  view: FormSurfaceView;
}

export interface FormSurfaceOptions {
  /** The page or modal that contains `[data-field]` elements. */
  root: Element | (() => Element | null);
  /**
   * Called before a write or focus operation. Use it to open a modal or mount
   * a form that is currently detached, then wait for the framework to render.
   */
  beforeAccess?: () => void | Promise<void>;
  /** Flush framework updates after native input/change events. */
  settle?: () => void | Promise<void>;
  /** Called after a successful write, so the host can refresh a task guide. */
  onChange?: (result: FormSurfaceFillResult) => void;
  /**
   * Optional escape hatch for custom controls. Return `false` when the value
   * was not handled; the surface then reports a clear skip instead of guessing.
   */
  set?: (
    field: FormFieldView,
    value: FormFieldValue,
    element: HTMLElement,
  ) => boolean | void | Promise<boolean | void>;
  /** CSS class added while a field is highlighted. Defaults to `is-pointed`. */
  focusClass?: string;
  /** How long the focus highlight stays on. Defaults to 1800ms; `0` keeps it. */
  focusDuration?: number;
}

export interface FormSurface {
  /** Read the current form without opening or changing anything. */
  view(): FormSurfaceView;
  /** Current values keyed by `data-field` name. */
  read(): Record<string, FormFieldValue>;
  /**
   * Write fields through native events. Unknown fields, page-only fields and
   * invalid select options are returned in `skipped`; they never throw.
   */
  fill(values: Record<string, unknown>): Promise<FormSurfaceFillResult>;
  /** Highlight and focus one real field. Returns false when it is not mounted. */
  focus(name: string): Promise<boolean>;
  /** The field container, for advanced host integrations. */
  element(name: string): HTMLElement | null;
}

interface ResolvedField extends FormFieldView {
  fieldElement: HTMLElement;
  control: HTMLElement | null;
}

function rootElement(options: FormSurfaceOptions): Element | null {
  const root = typeof options.root === "function" ? options.root() : options.root;
  return root ?? null;
}

function isInput(el: Element | null): el is HTMLInputElement {
  return el?.localName === "input";
}

function isTextarea(el: Element | null): el is HTMLTextAreaElement {
  return el?.localName === "textarea";
}

function isSelect(el: Element | null): el is HTMLSelectElement {
  return el?.localName === "select";
}

function fieldElements(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-field]")];
}

function controlOf(field: HTMLElement): HTMLElement | null {
  return field.querySelector<HTMLElement>(
    '[data-form-control], input:not([type="hidden"]), textarea, select, [contenteditable="true"]',
  );
}

function cleanLabel(text: string): string {
  return text
    .replace(/\s*[?？]\s*$/u, "")
    .replace(/\s*(?:必填|required)\s*$/iu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function labelOf(field: HTMLElement, control: HTMLElement | null, name: string): string {
  const explicit =
    field.getAttribute("data-label") ??
    control?.getAttribute("data-label") ??
    control?.getAttribute("aria-label") ??
    field.getAttribute("aria-label");
  if (explicit?.trim()) return cleanLabel(explicit);
  const rendered = field.querySelector<HTMLElement>(".field-label")?.textContent;
  if (rendered?.trim()) return cleanLabel(rendered);
  const wrappingLabel = field.localName === "label" ? field : field.closest("label");
  const text = wrappingLabel?.textContent;
  if (text?.trim()) return cleanLabel(text);
  return name;
}

function requiredOf(field: HTMLElement, control: HTMLElement | null): boolean {
  const declared = field.getAttribute("data-required") ?? field.getAttribute("aria-required");
  if (declared !== null) return declared !== "false";
  if (control) {
    if ((control as HTMLInputElement).required === true) return true;
    if (control.getAttribute("aria-required") === "true") return true;
  }
  return false;
}

function kindOf(control: HTMLElement | null, field: HTMLElement): FormFieldKind {
  if (field.hasAttribute("data-human-only")) return "human";
  if (!control) return "human";
  if (isSelect(control)) return "select";
  if (isTextarea(control)) return "textarea";
  if (isInput(control)) {
    const type = control.type;
    if (type === "file") return "human";
    if (type === "number" || type === "range") return "number";
    if (type === "checkbox" || type === "radio") return "boolean";
  }
  if (control.hasAttribute("contenteditable")) return "text";
  return "text";
}

function optionsOf(control: HTMLElement | null): FormFieldChoice[] | undefined {
  if (!isSelect(control)) return undefined;
  return [...control.options].map((option) => ({
    value: option.value,
    label: option.textContent?.trim() || option.value,
  }));
}

function valueOf(control: HTMLElement | null, kind: FormFieldKind, field: HTMLElement): FormFieldValue {
  if (kind === "human") {
    // A page-only field can still report completion (`data-value="true"` after
    // an upload, for example) without exposing a writable control.
    return field.getAttribute("data-value") ?? null;
  }
  if (!control) return null;
  if (isSelect(control)) {
    if (control.multiple) return [...control.selectedOptions].map((option) => option.value);
    return control.value;
  }
  if (isInput(control)) {
    if (control.type === "checkbox" || control.type === "radio") return control.checked;
    if (control.type === "number" || control.type === "range") {
      return control.value === "" ? null : Number(control.value);
    }
    return control.value;
  }
  if (isTextarea(control)) return control.value;
  if (control.hasAttribute("contenteditable")) return control.textContent ?? "";
  return control.getAttribute("data-value");
}

function numberAttribute(element: HTMLElement, name: string): number | undefined {
  const raw = element.getAttribute(name);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function resolveFields(root: Element): ResolvedField[] {
  return fieldElements(root).map((fieldElement) => {
    const name = fieldElement.dataset.field?.trim();
    if (!name) throw new Error("pling form surface: [data-field] must have a non-empty name");
    const control = controlOf(fieldElement);
    const kind = kindOf(control, fieldElement);
    return {
      name,
      label: labelOf(fieldElement, control, name),
      kind,
      required: requiredOf(fieldElement, control),
      value: valueOf(control, kind, fieldElement),
      ...(optionsOf(control) ? { options: optionsOf(control) } : {}),
      ...(kind === "number"
        ? {
            min: numberAttribute(fieldElement, "data-min") ?? (control ? numberAttribute(control as HTMLElement, "min") : undefined),
            max: numberAttribute(fieldElement, "data-max") ?? (control ? numberAttribute(control as HTMLElement, "max") : undefined),
          }
        : {}),
      ...(kind === "human"
        ? { humanReason: "This field must be completed by the person in the page." }
        : {}),
      ...(fieldElement.getAttribute("data-hint")
        ? { hint: fieldElement.getAttribute("data-hint") ?? undefined }
        : {}),
      fieldElement,
      control,
    };
  });
}

function missingOf(fields: readonly FormFieldView[]): string[] {
  return fields
    .filter((field) => {
      if (!field.required) return false;
      if (Array.isArray(field.value)) return field.value.length === 0;
      if (typeof field.value === "boolean") return !field.value;
      return field.value === null || field.value === undefined || String(field.value).trim() === "";
    })
    .map((field) => field.name);
}

function viewOf(fields: readonly ResolvedField[]): FormSurfaceView {
  const publicFields = fields.map(({ fieldElement: _fieldElement, control: _control, ...field }) => field);
  const missing = missingOf(publicFields);
  return { fields: publicFields, missing, complete: missing.length === 0 };
}

/** Bypass React/Vue's instance value setter, then dispatch the events a person would. */
function setNativeValue(element: HTMLElement, value: string): void {
  const prototype = Object.getPrototypeOf(element) as object;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) descriptor.set.call(element, value);
  else (element as HTMLInputElement).value = value;
}

function dispatch(element: HTMLElement, type: "input" | "change"): void {
  const EventCtor = element.ownerDocument.defaultView?.Event ?? Event;
  element.dispatchEvent(new EventCtor(type, { bubbles: true }));
}

function writeNative(control: HTMLElement, field: FormFieldView, value: FormFieldValue): void {
  if (isSelect(control)) {
    if (control.multiple) {
      const selected = new Set(Array.isArray(value) ? value.map(String) : [String(value ?? "")]);
      for (const option of [...control.options]) option.selected = selected.has(option.value);
      dispatch(control, "input");
      dispatch(control, "change");
      return;
    }
    setNativeValue(control, String(value ?? ""));
    dispatch(control, "change");
    return;
  }
  if (isInput(control) && (control.type === "checkbox" || control.type === "radio")) {
    const next = Boolean(value);
    if (control.checked !== next) control.click();
    return;
  }
  if (isInput(control) || isTextarea(control)) {
    setNativeValue(control, String(value ?? ""));
    dispatch(control, "input");
    dispatch(control, "change");
    control.focus({ preventScroll: true });
    return;
  }
  if (control.hasAttribute("contenteditable")) {
    control.textContent = String(value ?? "");
    dispatch(control, "input");
    dispatch(control, "change");
    return;
  }
  throw new Error(`pling form surface: field "${field.name}" has no writable control`);
}

function normalizeValue(field: FormFieldView, raw: unknown): { value: FormFieldValue } | { reason: string } {
  if (field.kind === "number") {
    if (raw === "" || raw === null || raw === undefined) return { value: null };
    const value = Number(raw);
    if (!Number.isFinite(value)) return { reason: "Expected a number" };
    if (field.min !== undefined && value < field.min) return { reason: `Must be at least ${field.min}` };
    if (field.max !== undefined && value > field.max) return { reason: `Must be at most ${field.max}` };
    return { value };
  }
  if (field.kind === "boolean") return { value: Boolean(raw) };
  if (field.kind === "select") {
    if (Array.isArray(raw)) {
      const values = raw.map(String);
      const allowed = new Set((field.options ?? []).map((option) => option.value));
      const unknown = values.find((value) => !allowed.has(value));
      return unknown === undefined
        ? { value: values }
        : { reason: `"${unknown}" is not an option; choose from ${(field.options ?? []).map((option) => option.value).join(", ")}` };
    }
    const value = String(raw ?? "");
    const allowed = new Set((field.options ?? []).map((option) => option.value));
    if (!allowed.has(value)) {
      return {
        reason: `"${value}" is not an option; choose from ${(field.options ?? []).map((option) => option.value).join(", ")}`,
      };
    }
    return { value };
  }
  return { value: String(raw ?? "") };
}

export function createFormSurface(options: FormSurfaceOptions): FormSurface {
  const focusClass = options.focusClass ?? "is-pointed";
  const focusDuration = options.focusDuration ?? 1800;

  const resolve = (): { root: Element; fields: ResolvedField[] } | null => {
    const root = rootElement(options);
    return root ? { root, fields: resolveFields(root) } : null;
  };

  const view = (): FormSurfaceView => {
    const resolved = resolve();
    return resolved ? viewOf(resolved.fields) : { fields: [], missing: [], complete: false };
  };

  const read = (): Record<string, FormFieldValue> => {
    const fields = resolve()?.fields ?? [];
    return Object.fromEntries(fields.map((field) => [field.name, field.value]));
  };

  const element = (name: string): HTMLElement | null =>
    resolve()?.fields.find((field) => field.name === name)?.fieldElement ?? null;

  return {
    view,
    read,
    element,

    async fill(values) {
      await options.beforeAccess?.();
      const resolved = resolve();
      const applied: string[] = [];
      const skipped: FormSurfaceSkip[] = [];
      if (!resolved) {
        return {
          applied,
          skipped: Object.keys(values).map((field) => ({ field, reason: "The form is not mounted or visible." })),
          view: { fields: [], missing: [], complete: false },
        };
      }

      const byName = new Map(resolved.fields.map((field) => [field.name, field]));
      const available = [...byName.keys()];
      for (const [name, raw] of Object.entries(values)) {
        const field = byName.get(name);
        if (!field) {
          skipped.push({ field: name, reason: `Unknown field; available fields: ${available.join(", ")}` });
          continue;
        }
        if (field.kind === "human") {
          skipped.push({ field: name, reason: field.humanReason ?? "This field must be completed by the person." });
          continue;
        }
        const normalized = normalizeValue(field, raw);
        if ("reason" in normalized) {
          skipped.push({ field: name, reason: normalized.reason });
          continue;
        }
        if (field.control && ((field.control as HTMLInputElement).disabled || (field.control as HTMLInputElement).readOnly)) {
          skipped.push({ field: name, reason: "The control is disabled or read-only." });
          continue;
        }
        if (!field.control && options.set) {
          const handled = await options.set(field, normalized.value, field.fieldElement);
          if (handled === false) {
            skipped.push({ field: name, reason: "The custom control did not accept this value." });
            continue;
          }
          applied.push(name);
          continue;
        }
        if (!field.control) {
          skipped.push({ field: name, reason: "This custom field has no writable control; add data-form-control or a set callback." });
          continue;
        }
        writeNative(field.control, field, normalized.value);
        applied.push(name);
      }

      await options.settle?.();
      const next = resolve();
      const result: FormSurfaceFillResult = {
        applied,
        skipped,
        view: next ? viewOf(next.fields) : { fields: [], missing: [], complete: false },
      };
      options.onChange?.(result);
      return result;
    },

    async focus(name) {
      await options.beforeAccess?.();
      const resolved = resolve();
      const field = resolved?.fields.find((candidate) => candidate.name === name);
      if (!field) return false;
      const element = field.fieldElement;
      element.classList.remove(focusClass);
      void element.offsetWidth;
      element.classList.add(focusClass);
      field.control?.focus({ preventScroll: true });
      element.scrollIntoView?.({ behavior: "smooth", block: "center" });
      if (focusDuration > 0) {
        setTimeout(() => element.classList.remove(focusClass), focusDuration);
      }
      return true;
    },
  };
}
