import { checkActionable } from "./dom";
import {
  DERIVED_ATTR,
  IGNORE_ATTR,
  explicitActionIds,
  isExplicit,
  labelOf,
} from "./derive";
import { composedElementParent, containsComposed, queryAllComposed } from "./projection";
import { UI_ATTR } from "./scope";

/** Actionable controls included in the developer coverage scan. */
export const COVERAGE_SELECTOR = [
  "button",
  "a[href]",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  "summary",
  '[contenteditable="true"]',
  ...[
    "button", "link", "checkbox", "radio", "switch", "tab", "menuitem", "menuitemcheckbox",
    "menuitemradio", "option", "combobox", "listbox", "slider", "spinbutton", "textbox", "searchbox",
  ].map((role) => `[role="${role}"]`),
].join(", ");

/** Marker used by adapters for controls that can be highlighted but not executed. */
export const GUIDE_TARGET_ATTR = "data-pling-guide-target";

export type CoverageStatus = "declared" | "derived" | "grouped" | "locatable" | "missing";

export interface CoverageTarget {
  /** Useful for finding the control in the component tree; not an execution selector. */
  element: string;
  label: string;
  status: CoverageStatus;
  /** Stable locate-only target id when `status` is `locatable`. */
  guideTargetId?: string;
  /** Action ids declared on this element or its nearest explicitly declared ancestor. */
  actions?: string[];
}

export interface CoverageReport {
  /** Recognized, actionable controls inside the application root. */
  total: number;
  /** Controls with a direct declaration. */
  declared: number;
  /** Actions produced by the optional L1 derivation mode. */
  derived: number;
  /** Controls under a declaration on an ancestor; verify the mapping manually. */
  grouped: number;
  /** Controls registered as locate-only targets; the user must complete them. */
  locatable: number;
  /** Recognized controls without a direct, derived, or ancestor declaration. */
  missing: number;
  /** `declared + derived + grouped + locatable`, divided by `total`; null when there are no controls. */
  coveragePercent: number | null;
  /** Candidate controls that need attention, including grouped declarations for review. */
  targets: CoverageTarget[];
}

function nearestDeclaredAncestor(el: Element, root: Element): Element | undefined {
  for (let parent = composedElementParent(el); parent; parent = composedElementParent(parent)) {
    if (!containsComposed(root, parent)) break;
    if (isExplicit(parent)) return parent;
    if (parent === root) break;
  }
  return undefined;
}

function isExcluded(el: Element, root: Element): boolean {
  for (let current: Element | null = el; current; current = composedElementParent(current)) {
    if (current.hasAttribute(IGNORE_ATTR) || current.hasAttribute(UI_ATTR)) return true;
    if (current === root) break;
  }
  return false;
}

function targetOf(el: Element, status: CoverageStatus, actions?: string[]): CoverageTarget {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const role = el.getAttribute("role");
  return {
    element: `${tag}${id}`,
    label: labelOf(el) || role || "Unnamed control",
    status,
    ...(actions?.length ? { actions } : {}),
  };
}

/**
 * Scan a mounted application for interactive controls and classify their Pling coverage.
 * The report is diagnostic only: it never registers actions or enters agent context.
 */
export function inspectCoverage(root: Element | null): CoverageReport {
  if (!root || !root.isConnected) {
    return { total: 0, declared: 0, derived: 0, grouped: 0, locatable: 0, missing: 0, coveragePercent: null, targets: [] };
  }

  const candidates = [
    ...(root.matches(COVERAGE_SELECTOR) ? [root] : []),
    ...queryAllComposed(root, COVERAGE_SELECTOR),
  ];
  let declared = 0;
  let derived = 0;
  let grouped = 0;
  let locatable = 0;
  let missing = 0;
  const targets: CoverageTarget[] = [];

  for (const el of candidates) {
    if (isExcluded(el, root)) continue;
    if (!checkActionable(el).available) continue;

    if (isExplicit(el)) {
      declared += 1;
      continue;
    }

    if (el.getAttribute(DERIVED_ATTR)) {
      derived += 1;
      continue;
    }

    if (el.hasAttribute(GUIDE_TARGET_ATTR)) {
      locatable += 1;
      targets.push({ ...targetOf(el, "locatable"), guideTargetId: el.getAttribute(GUIDE_TARGET_ATTR) ?? "" });
      continue;
    }

    const ancestor = nearestDeclaredAncestor(el, root);
    if (ancestor) {
      grouped += 1;
      targets.push(targetOf(el, "grouped", explicitActionIds(ancestor)));
      continue;
    }

    missing += 1;
    targets.push(targetOf(el, "missing"));
  }

  const total = declared + derived + grouped + locatable + missing;
  // Coverage means Pling has an explicit, reviewable treatment for the control.
  // A locate-only declaration is accounted separately and does not imply execution.
  const covered = declared + derived + grouped + locatable;
  return {
    total,
    declared,
    derived,
    grouped,
    locatable,
    missing,
    coveragePercent: total === 0 ? null : Math.round((covered / total) * 100),
    targets,
  };
}
