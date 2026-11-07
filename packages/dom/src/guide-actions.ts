import { translate } from "@plingjs/ui";

/**
 * The compact action row used by guided tasks, shared by every adapter.
 *
 * This is deliberately smaller than a task card: the conversation carries the
 * explanation, while the row only carries the next legal actions. A suggestion
 * keeps the verb short and puts the long value in a one-line, ellipsised
 * preview; the full value stays in the title, the accessible name and the
 * conversation message above.
 *
 * The renderer is a visual contract only. It never writes a field, never
 * understands a task and never calls business code directly: the host receives
 * the opaque `command` it declared and decides what that means. That is why it
 * can live in the framework-neutral DOM layer and be mounted unchanged by
 * Vue, React and plain DOM.
 */
export type GuideActionKind = "primary" | "secondary" | "suggestion" | "skip";

export interface GuideActionItem {
  /** Stable id for tests and host bookkeeping. */
  id: string;
  /** Short action label, for example “自动填写” or “定位 · 课程名称”. */
  label: string;
  /** Business-owned command emitted on click. */
  command: string;
  kind?: GuideActionKind;
  /** Long recommendation shown as a single-line preview on suggestion chips. */
  preview?: string;
  /** Accessible name when the visible label omits the field name. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface GuideActionsOptions {
  items: readonly GuideActionItem[];
  /** Optional line above the row, for example “保存前再核对一次”. */
  hint?: string;
  /** Accessible name for the action group. */
  ariaLabel?: string;
  /** Locale for the framework-owned fallback labels. */
  locale?: string;
  onCommand(command: string): void;
}

export interface GuideActions {
  readonly element: HTMLElement;
  update(options: Partial<Omit<GuideActionsOptions, "onCommand">> & { onCommand?: GuideActionsOptions["onCommand"] }): void;
  destroy(): void;
}

const STYLE_ID = "pling-guide-actions-styles";

const GUIDE_ACTIONS_STYLES = `
.pling-guide-actions{display:grid;gap:7px;width:100%;padding:1px 0 2px;color:var(--pling-color-text,#17181c);font-family:var(--pling-font-family,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);text-align:left}
.pling-guide-actions *,.pling-guide-actions *::before,.pling-guide-actions *::after{box-sizing:border-box}
.pling-guide-actions__hint{margin:0;color:var(--pling-color-text-muted,#6d7280);font-size:11px;font-weight:650;line-height:1.4}
.pling-guide-actions__row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pling-guide-action{display:inline-flex;min-height:27px;max-width:100%;min-width:0;align-items:baseline;gap:6px;padding:0 10px;border:1px solid var(--pling-color-border,#d8dbe3);border-radius:7px;color:var(--pling-color-text,#17181c);background:var(--pling-color-surface,#fff);font:inherit;font-size:11.5px;font-weight:600;line-height:25px;text-align:left;cursor:pointer}
.pling-guide-action:hover:not(:disabled){border-color:#b9d9f3;background:#f6fbff}
.pling-guide-action:focus-visible{outline:2px solid var(--pling-color-primary,#2e9df7);outline-offset:1px}
.pling-guide-action.is-primary{border-color:#c7e4fb;color:var(--pling-color-primary-strong,#086aa8);background:var(--pling-color-primary-soft,#eaf6ff)}
.pling-guide-action.is-suggestion{max-width:min(100%,300px)}
.pling-guide-action__label{flex:none}
.pling-guide-action__preview{min-width:0;overflow:hidden;color:var(--pling-color-text-muted,#6d7280);font-weight:500;text-overflow:ellipsis;white-space:nowrap}
.pling-guide-action:disabled{cursor:default;opacity:.55}
@media (max-width:420px){.pling-guide-action{max-width:100%}}
`;

/** Inject the shared stylesheet once per document, not once per mounted row. */
function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = GUIDE_ACTIONS_STYLES;
  (doc.head ?? doc.documentElement).append(style);
}

/**
 * Chinese uses full-width punctuation; every other locale uses Latin
 * punctuation. This matters for the generated title and accessible name, which
 * must read naturally even when the host did not supply an explicit ariaLabel.
 */
function punctuation(locale: string | undefined): {
  title(label: string, value: string): string;
  colon: string;
} {
  const base = (locale ?? "en-US").trim().toLowerCase().split(/[-_]/)[0];
  return base === "zh"
    ? { title: (label, value) => `${label}「${value}」`, colon: "：" }
    : { title: (label, value) => `${label}: ${value}`, colon: ": " };
}

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

export function createGuideActions(options: GuideActionsOptions): GuideActions {
  let current = { ...options };
  let destroyed = false;

  const elementNode = element("div", "pling-guide-actions");
  elementNode.setAttribute("role", "group");

  const hint = element("p", "pling-guide-actions__hint");
  const row = element("div", "pling-guide-actions__row");
  elementNode.append(hint, row);

  function render(): void {
    if (destroyed) return;
    ensureStyles(elementNode.ownerDocument);
    const label = current.ariaLabel ?? translate(current.locale ?? "en-US", "guide.actions.label");
    elementNode.setAttribute("aria-label", label);
    hint.textContent = current.hint?.trim() ?? "";
    hint.hidden = !hint.textContent;
    row.replaceChildren();

    for (const item of current.items) {
      const button = element("button", "pling-guide-action");
      button.type = "button";
      button.dataset.command = item.command;
      button.dataset.actionId = item.id;
      button.disabled = Boolean(item.disabled);
      if (item.kind) button.classList.add(`is-${item.kind}`);

      button.append(element("span", "pling-guide-action__label", item.label));
      if (item.preview?.trim()) {
        const preview = item.preview.trim();
        button.append(element("span", "pling-guide-action__preview", preview));
        const marks = punctuation(current.locale);
        button.title = marks.title(item.label, preview);
        button.setAttribute("aria-label", item.ariaLabel ?? `${item.label}${marks.colon}${preview}`);
      } else if (item.ariaLabel) {
        button.setAttribute("aria-label", item.ariaLabel);
      }
      row.append(button);
    }
  }

  const onClick = (event: Event): void => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-command]");
    if (!target || target.hasAttribute("disabled")) return;
    const command = target.dataset.command;
    if (command) current.onCommand(command);
  };
  elementNode.addEventListener("click", onClick);
  render();

  return {
    element: elementNode,
    update(next) {
      current = { ...current, ...next };
      render();
    },
    destroy() {
      destroyed = true;
      elementNode.removeEventListener("click", onClick);
      elementNode.remove();
    },
  };
}
