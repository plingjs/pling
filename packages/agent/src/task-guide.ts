import type { TaskDefinition, TaskRunSnapshot } from "./task";

/**
 * Task guide：one task's presentation contract.
 *
 * A task definition answers "what must happen"; a guide answers "how should
 * the assistant explain it and hand control back to the person". The guide is
 * deliberately read-only: every write still goes through a registered action
 * or the task controller. DOM rendering lives in the adapter; this file only
 * owns the framework-neutral contract.
 */
export type TaskGuideRowValue = string | number | boolean | null | undefined;
export type TaskGuideRowFormat = "text" | "stars" | "check" | "number";
export type TaskGuideRowStatus = "current" | "suggested" | "missing";

export interface TaskGuideRow {
  label: string;
  value: TaskGuideRowValue;
  format?: TaskGuideRowFormat;
  /** Visual state for a value that is either present, suggested, or still missing. */
  status?: TaskGuideRowStatus;
  /** Short business-owned badge, for example “Suggested” or “Needs input”. */
  badge?: string;
  /** Optional provenance or helper text shown below the value. */
  note?: string;
  /** A row-level command, usually “Use suggestion” or “Locate field”. */
  action?: TaskGuideAction;
}

export interface TaskGuideAction {
  label: string;
  /** Business-owned command name. The renderer never interprets it. */
  command: string;
  /** Optional label while another command is running. */
  busyLabel?: string;
}

/**
 * One field in a compact task rail.
 *
 * The rail is a map of the values the person still has to decide, not another
 * form. Business code reports whether a value is already in the page; clicking
 * a node only emits `focus-<field>` unless it supplies an explicit command.
 */
export interface TaskGuideField {
  /** Field name used by the page and by the default `focus-<field>` command. */
  field: string;
  label: string;
  /** True when the task cannot complete without this value. */
  required?: boolean;
  /** The page already holds a value. */
  filled?: boolean;
  /** The person explicitly chose not to supply an optional value. */
  skipped?: boolean;
  /** A recommendation exists, but it has not been written to the page. */
  suggested?: boolean;
  /** Override the default `focus-<field>` command. */
  command?: string;
}

export type TaskGuideFields =
  | readonly TaskGuideField[]
  | ((snapshot: TaskRunSnapshot | null) => readonly TaskGuideField[]);

export interface TaskGuideHandoff {
  title: string;
  description: string;
}

export type TaskGuideRows =
  | readonly TaskGuideRow[]
  | ((snapshot: TaskRunSnapshot | null) => readonly TaskGuideRow[]);

export interface TaskGuideStep {
  id: string;
  /** Short label used in the step rail. */
  label: string;
  title: string;
  description: string;
  rowsTitle?: string | ((snapshot: TaskRunSnapshot | null) => string);
  rows?: TaskGuideRows;
  handoff?: TaskGuideHandoff;
  primary?: TaskGuideAction;
  secondary?: TaskGuideAction;
}

export interface TaskGuideDone {
  title: string | ((snapshot: TaskRunSnapshot | null) => string);
  description: string | ((snapshot: TaskRunSnapshot | null) => string);
  rows?: TaskGuideRows;
  actions?: readonly TaskGuideAction[];
}

export interface TaskGuideLabels {
  running?: string;
  completed?: string;
  current?: string;
  done?: string;
  pending?: string;
  error?: string;
  required?: string;
  optional?: string;
  skipped?: string;
}

export interface TaskGuideDefinition {
  taskId: string;
  title: string;
  /**
   * Render one compact status row instead of the full guide card or field rail.
   * `fields` can still be declared for agent focus and task working memory.
   */
  compact?: boolean;
  welcome?: string;
  footer?: string;
  /** Supports `{step}` and `{total}` placeholders. */
  stepSubtitle?: string;
  /** Optional text shown beside the welcome message. Omit it for a full-width message. */
  avatar?: string;
  /** Optional header action that lets the person leave the task. The renderer only emits the command. */
  cancel?: TaskGuideAction;
  labels?: TaskGuideLabels;
  /**
   * Model-callable UI commands for this guide.
   *
   * These commands only move the person's attention or open a review. They
   * never execute a business write; the page's confirmation button remains the
   * only path to `save`.
   */
  agent?: {
    /** Command for a guide field used by `pling_focus_field`. */
    focusField?: (field: TaskGuideField) => string;
    /**
     * Command used by `pling_review_task`.
     *
     * Omit it when the guide has no read-only review surface; the review tool
     * is then reported unavailable instead of invoking an unknown command.
     */
    review?: string;
    /**
     * Command used by `pling_propose_save` to open the confirmation surface.
     *
     * Omit it when there is no page-owned confirmation step. The action never
     * writes, even when this command is present.
     */
    proposeSave?: string;
    /** Command used by `pling_cancel_task`. Defaults to the visible `cancel` action. */
    cancel?: string;
  };
  /**
   * When present, the renderer shows a compact horizontal field rail instead of
   * the full step card. Copy, recommendations and per-field guidance belong in
   * the conversation; the rail only carries progress and field location.
   */
  fields?: TaskGuideFields;
  steps: readonly TaskGuideStep[];
  done?: TaskGuideDone;
}

export interface TaskGuideCommand {
  action: TaskGuideAction;
  step: TaskGuideStep | null;
  stepIndex: number;
  done: boolean;
}

/** Runtime state a host may expose while a guide is active. */
export interface TaskGuideState {
  snapshot?: TaskRunSnapshot | null;
  /** 1-based step number. Defaults to 1. */
  step?: number;
  busy?: boolean;
  error?: string;
  completed?: boolean;
}

/** A task can carry either or both halves; the guide may be an agent-only playbook. */
export type GuidedTaskDefinition = TaskDefinition;

export interface GuidedTaskView {
  id: string;
  title: string;
  description?: string;
  examples?: readonly string[];
  guideTitle?: string;
  stepTitles?: readonly string[];
}

export function guidedTaskViewOf(
  definition: TaskDefinition,
  guide?: TaskGuideDefinition | null,
): GuidedTaskView {
  return {
    id: definition.id,
    title: definition.title,
    ...(definition.description === undefined ? {} : { description: definition.description }),
    ...(definition.examples?.length ? { examples: [...definition.examples] } : {}),
    ...(guide ? { guideTitle: guide.title } : {}),
    ...(guide?.steps.length ? { stepTitles: guide.steps.map((step) => step.title) } : {}),
  };
}
