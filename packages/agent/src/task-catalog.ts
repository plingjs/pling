import {
  ActionError,
  type JsonSchema,
  type PageView,
  type Registry,
} from "@plingjs/core";
import type {
  TaskBinding,
  TaskController,
  TaskDefinition,
  TaskField,
  TaskRunSnapshot,
  TaskValues,
} from "./task";
import type {
  TaskGuideCommand,
  TaskGuideDefinition,
  TaskGuideField,
  TaskGuideState,
  GuidedTaskView,
} from "./task-guide";
import { guidedTaskViewOf } from "./task-guide";

/**
 * The page's guided-task catalog.
 *
 * A task becomes available from page context (route and/or active scope), or it
 * can be chosen by the assistant from the tasks that are available right now.
 * The catalog never invents workflows and never executes a business write:
 * `controller` remains the execution path, with the same permission gates as
 * any other action.
 */

export type GuidedTaskRoute = string | readonly string[] | ((page: PageView | undefined) => boolean);

export interface GuidedTaskRegistration {
  /** Defaults to `definition.id`. */
  id?: string;
  definition: TaskDefinition;
  /** Optional presentation half. A task may run headlessly without a guide. */
  guide?: TaskGuideDefinition;
  controller?: TaskController;
  /** Exact path or route name. Omit for every page. */
  route?: GuidedTaskRoute;
  /** Every listed scope must be active. Omit for no scope restriction. */
  scope?: string | readonly string[];
  /** Activate and start this task when its context matches. Defaults to false. */
  autoStart?: boolean;
  /**
   * Keep an explicitly started task active while its route or scope temporarily
   * stops matching. Use this for journeys that move between pages or close a
   * modal before the task is finished. `deactivate()` still ends it.
   */
  keepActive?: boolean;
  /** Initial values for an automatic or explicitly started run. */
  initialValues?: TaskValues | (() => TaskValues);
  binding?: TaskBinding | (() => TaskBinding);
  /** Read live page state for the renderer. */
  state?: () => TaskGuideState;
  onActivate?: (task: ActiveGuidedTask) => void | Promise<void>;
  onDeactivate?: (task: ActiveGuidedTask) => void;
  onCommand?: (command: TaskGuideCommand, task: ActiveGuidedTask) => void | Promise<void>;
}

export interface ActiveGuidedTask {
  id: string;
  definition: TaskDefinition;
  guide?: TaskGuideDefinition;
  controller?: TaskController;
  state: TaskGuideState;
  /** Who opened this run: the page context, a person, or the model choosing a registered task. */
  startedBy: "page" | "agent";
}

export interface GuidedTaskActivationOptions {
  /** Values the caller already knows. Unknown fields are rejected by the model action. */
  values?: TaskValues;
  /** @internal Set by `pling_start_task`; page code normally leaves this as `page`. */
  startedBy?: "page" | "agent";
}

export interface TaskCatalogOptions {
  /** Used for route changes and the narrow `pling_start_task` model action. */
  registry?: Registry;
  /** Scope lookup. Vue passes its namespaced registry so local ids work. */
  isScopeActive?: (scope: string) => boolean;
  /** Optional page identity override; defaults to `registry.getPage()`. */
  getPage?: () => PageView | undefined;
  /** Override the framework action id. */
  actionId?: string;
}

export interface TaskCatalog {
  /** Model action bound for this catalog. Stable for the lifetime of the catalog. */
  readonly actionId: string;
  /**
   * Model action that writes new values into the active task. It is bound with
   * the catalog but only available while a task is active.
   */
  readonly updateActionId: string;
  /** Model action that points the person at one field in the active guide. */
  readonly focusActionId: string;
  /** Model action that opens the active task's read-only review. */
  readonly reviewActionId: string;
  /** Model action that opens the confirmation step; it never writes. */
  readonly proposeSaveActionId: string;
  /** Model action that pauses or abandons the active task. */
  readonly cancelActionId: string;
  define(registration: GuidedTaskRegistration): () => void;
  get(id: string): GuidedTaskRegistration | undefined;
  list(): readonly GuidedTaskRegistration[];
  available(): readonly GuidedTaskRegistration[];
  active(): ActiveGuidedTask | null;
  activate(id: string, options?: GuidedTaskActivationOptions): ActiveGuidedTask;
  deactivate(): void;
  command(command: TaskGuideCommand): boolean;
  views(): readonly GuidedTaskView[];
  refresh(): void;
  subscribe(listener: () => void): () => void;
  destroy(): void;
}

const DEFAULT_ACTION_ID = "pling_start_task";
const DEFAULT_UPDATE_ACTION_ID = "pling_update_task";
const DEFAULT_FOCUS_ACTION_ID = "pling_focus_field";
const DEFAULT_REVIEW_ACTION_ID = "pling_review_task";
const DEFAULT_PROPOSE_SAVE_ACTION_ID = "pling_propose_save";
const DEFAULT_CANCEL_ACTION_ID = "pling_cancel_task";

function normalizedId(registration: GuidedTaskRegistration): string {
  const id = (registration.id ?? registration.definition.id).trim();
  if (!id) throw new Error("Guided task id must be non-empty");
  if (registration.definition.id !== id) {
    throw new Error(`Guided task definition id "${registration.definition.id}" must match registration id "${id}"`);
  }
  if (registration.guide && registration.guide.taskId !== id) {
    throw new Error(`Task guide "${registration.guide.taskId}" must belong to task "${id}"`);
  }
  return id;
}

function readValues(registration: GuidedTaskRegistration): TaskValues {
  return typeof registration.initialValues === "function"
    ? registration.initialValues()
    : (registration.initialValues ?? {});
}

function readBinding(registration: GuidedTaskRegistration): TaskBinding {
  return typeof registration.binding === "function" ? registration.binding() : (registration.binding ?? {});
}

function isTerminal(snapshot: TaskRunSnapshot | null | undefined): boolean {
  return snapshot?.status === "done" || snapshot?.status === "failed" || snapshot?.status === "cancelled";
}

function pageKeyOf(page: PageView | undefined): string {
  if (!page) return "";
  const path = page.path ?? "";
  const name = page.name ?? "";
  return path || name ? `${path}|${name}` : "";
}

export function createTaskCatalog(options: TaskCatalogOptions = {}): TaskCatalog {
  const registrations = new Map<string, GuidedTaskRegistration>();
  const listeners = new Set<() => void>();
  const offs = new Map<string, () => void>();
  const requestedActionId = (options.actionId ?? DEFAULT_ACTION_ID).trim() || DEFAULT_ACTION_ID;
  let activeId: string | null = null;
  let activeStartedBy: "page" | "agent" = "page";
  let activePageKey: string | null = null;
  let explicitId: string | null = null;
  let autoSuppressedFor: string | null = null;
  let recomputeQueued = false;
  let destroyed = false;

  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  const pageOf = (): PageView | undefined => {
    if (options.getPage) return options.getPage();
    return options.registry?.getPage();
  };

  const routeMatches = (route: GuidedTaskRoute | undefined, page: PageView | undefined): boolean => {
    if (route === undefined) return true;
    if (typeof route === "function") return route(page);
    const values = typeof route === "string" ? [route] : route;
    return values.some((value) => value === page?.path || value === page?.name);
  };

  const scopeMatches = (scope: string | readonly string[] | undefined): boolean => {
    if (scope === undefined) return true;
    const values = typeof scope === "string" ? [scope] : scope;
    if (values.length === 0) return true;
    const active = options.isScopeActive ?? ((id: string) => options.registry?.isScopeActive(id) ?? false);
    return values.every((id) => active(id));
  };

  const isAvailableNow = (registration: GuidedTaskRegistration): boolean =>
    routeMatches(registration.route, pageOf()) && scopeMatches(registration.scope);

  const available = (): readonly GuidedTaskRegistration[] =>
    [...registrations.values()].filter(isAvailableNow);

  const contextSignature = (): string => {
    const page = pageOf();
    const ids = available().map(normalizedId).sort().join(",");
    return `${page?.path ?? ""}|${page?.name ?? ""}|${ids}`;
  };

  const stateOf = (registration: GuidedTaskRegistration): TaskGuideState => {
    let state: TaskGuideState = {};
    try {
      state = registration.state?.() ?? {};
    } catch {
      state = {};
    }
    const snapshot = registration.controller?.snapshot() ?? null;
    return {
      ...state,
      snapshot: state.snapshot === undefined ? snapshot : state.snapshot,
    };
  };

  const activeTaskOf = (registration: GuidedTaskRegistration): ActiveGuidedTask => ({
    id: normalizedId(registration),
    definition: registration.definition,
    ...(registration.guide ? { guide: registration.guide } : {}),
    ...(registration.controller ? { controller: registration.controller } : {}),
    state: stateOf(registration),
    startedBy: activeStartedBy,
  });

  const validateValues = (registration: GuidedTaskRegistration, values: TaskValues | undefined): TaskValues => {
    const allowed = new Set((registration.definition.fields ?? []).map((field) => field.name));
    for (const key of Object.keys(values ?? {})) {
      if (!allowed.has(key)) {
        throw new ActionError("INVALID_ARGS", `Unknown field "${key}" for guided task "${normalizedId(registration)}".`);
      }
    }
    return values ?? {};
  };

  const validateAgentValues = (
    registration: GuidedTaskRegistration,
    values: TaskValues | undefined,
  ): TaskValues => {
    const fields = new Map(agentWritableFields(registration).map((field) => [field.name, field]));
    const current = registration.controller?.snapshot()?.values ?? {};
    for (const [key, value] of Object.entries(values ?? {})) {
      const field = fields.get(key);
      if (!field) {
        throw new ActionError(
          "INVALID_ARGS",
          `Field "${key}" cannot be written by the agent for guided task "${normalizedId(registration)}". Complete it in the page instead.`,
        );
      }
      if (value === undefined || value === null) continue;

      const expected = field.type === "number" ? "number" : field.type === "boolean" ? "boolean" : "string";
      if (typeof value !== expected || (expected === "number" && !Number.isFinite(value))) {
        throw new ActionError(
          "INVALID_ARGS",
          `${field.label} must be ${expected === "string" ? "text" : `a ${expected}`}. Got ${JSON.stringify(value)}.`,
        );
      }
      if (typeof value === "string" && !value.trim() && !field.optional) {
        throw new ActionError("INVALID_ARGS", `${field.label} must not be blank.`);
      }
      if (field.values?.length && !field.values.some((choice) => choice.value === value)) {
        throw new ActionError(
          "INVALID_ARGS",
          `${field.label} must be one of: ${field.values.map((choice) => `${choice.label} (${choice.value})`).join(", ")}.`,
        );
      }
      if (typeof value === "number") {
        if (field.min !== undefined && value < field.min) {
          throw new ActionError("INVALID_ARGS", `${field.label} must be at least ${field.min}.`);
        }
        if (field.max !== undefined && value > field.max) {
          throw new ActionError("INVALID_ARGS", `${field.label} must be at most ${field.max}.`);
        }
      }
      if (typeof value === "string") {
        const text = value.trim();
        if (field.minLength !== undefined && text.length < field.minLength) {
          throw new ActionError("INVALID_ARGS", `${field.label} must be at least ${field.minLength} characters.`);
        }
        if (field.maxLength !== undefined && text.length > field.maxLength) {
          throw new ActionError("INVALID_ARGS", `${field.label} must be at most ${field.maxLength} characters.`);
        }
        if (field.pattern) {
          let pattern: RegExp;
          try {
            pattern = new RegExp(field.pattern);
          } catch {
            throw new Error(`Task field "${field.name}" has an invalid pattern.`);
          }
          if (!pattern.test(text)) {
            throw new ActionError("INVALID_ARGS", `${field.label} does not match the required format.`);
          }
        }
      }
      const reason = field.validate?.(value, { ...current, ...values });
      if (reason) throw new ActionError("INVALID_ARGS", `${field.label}: ${reason}`);
    }
    return values ?? {};
  };

  const hasTaskValue = (value: unknown): boolean =>
    value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");

  const missingRequiredFields = (registration: GuidedTaskRegistration, values: TaskValues): string[] =>
    (registration.definition.fields ?? [])
      .filter((field) => !field.optional && !hasTaskValue(values[field.name]))
      .map((field) => field.name);

  const guideFieldsOf = (registration: GuidedTaskRegistration): readonly TaskGuideField[] => {
    const snapshot = registration.controller?.snapshot() ?? null;
    const configured = registration.guide?.fields;
    if (configured) {
      try {
        return typeof configured === "function" ? configured(snapshot) : configured;
      } catch {
        return [];
      }
    }
    const values = snapshot?.values ?? {};
    return (registration.definition.fields ?? []).map((field) => ({
      field: field.name,
      label: field.label,
      required: field.optional !== true,
      filled: hasTaskValue(values[field.name]),
    }));
  };

  const guideCommand = (
    registration: GuidedTaskRegistration,
    kind: "review" | "proposeSave" | "cancel",
  ): string => {
    const guide = registration.guide;
    const command =
      kind === "review"
        ? guide?.agent?.review?.trim()
        : kind === "proposeSave"
          ? guide?.agent?.proposeSave?.trim()
          : guide?.agent?.cancel?.trim() || guide?.cancel?.command?.trim();
    if (!command) {
      throw new ActionError(
        "ACTION_UNAVAILABLE",
        `This task does not declare a ${kind === "proposeSave" ? "save-confirmation" : kind} guide command.`,
      );
    }
    return command;
  };

  const focusCommand = (registration: GuidedTaskRegistration, field: TaskGuideField): string =>
    field.command?.trim() ||
    registration.guide?.agent?.focusField?.(field)?.trim() ||
    `focus-${field.field}`;

  const runRegistrationCommand = async (
    registration: GuidedTaskRegistration,
    command: string,
    label = command,
  ): Promise<boolean> => {
    if (!registration.onCommand) return false;
    const guideCommand: TaskGuideCommand = {
      action: { label, command },
      step: null,
      stepIndex: 0,
      done: false,
    };
    try {
      const result = registration.onCommand(guideCommand, activeTaskOf(registration));
      if (result && typeof (result as Promise<void>).then === "function") await result;
      emit();
      return true;
    } catch {
      return false;
    }
  };

  const start = (registration: GuidedTaskRegistration, values?: TaskValues): void => {
    const controller = registration.controller;
    if (!controller) return;
    const incoming = validateValues(registration, values);
    const current = controller.snapshot();
    if (current && current.taskId === registration.definition.id && !isTerminal(current)) {
      for (const [name, value] of Object.entries(incoming)) controller.setValue(name, value);
      return;
    }
    controller.start(registration.definition.id, { ...readValues(registration), ...incoming }, readBinding(registration));
  };

  const deactivateCurrent = (): void => {
    if (!activeId) return;
    const current = registrations.get(activeId);
    if (current) {
      try {
        current.onDeactivate?.(activeTaskOf(current));
      } catch {
        // Teardown hooks must not prevent the next task from opening.
      }
    }
    activeId = null;
    activePageKey = null;
  };

  const activateRegistration = (
    registration: GuidedTaskRegistration,
    explicit: boolean,
    options?: GuidedTaskActivationOptions,
  ): ActiveGuidedTask => {
    const id = normalizedId(registration);
    if (!isAvailableNow(registration)) {
      throw new ActionError("ACTION_UNAVAILABLE", `Guided task "${id}" is not available in the current page context.`);
    }
    // Validate before changing the active guide: a rejected model call must not
    // leave a half-open task behind.
    validateValues(registration, options?.values);
    if (activeId !== id) deactivateCurrent();
    activeId = id;
    activePageKey = pageKeyOf(pageOf()) || null;
    activeStartedBy = options?.startedBy ?? "page";
    explicitId = explicit ? id : null;
    autoSuppressedFor = null;
    start(registration, options?.values);
    const task = activeTaskOf(registration);
    try {
      const result = registration.onActivate?.(task);
      if (result && typeof (result as Promise<void>).catch === "function") void (result as Promise<void>).catch(() => undefined);
    } catch {
      // Activation already changed the visible task; a business hook failure should not hide it.
    }
    emit();
    return activeTaskOf(registration);
  };

  const recompute = (): void => {
    if (destroyed) return;
    const currentAvailable = available();
    const signature = contextSignature();
    if (autoSuppressedFor && autoSuppressedFor !== signature) autoSuppressedFor = null;
    const activeRegistration = activeId ? registrations.get(activeId) : undefined;
    const activeIsTerminal = Boolean(
      activeRegistration && isTerminal(activeRegistration.controller?.snapshot()),
    );
    const activeRouteMatches = Boolean(
      activeRegistration && routeMatches(activeRegistration.route, pageOf()),
    );
    const currentPageKey = pageKeyOf(pageOf());
    if (!activePageKey && currentPageKey) activePageKey = currentPageKey;
    const activePageStillSame = activePageKey !== null && activePageKey === currentPageKey;
    const activeStillAvailable = Boolean(
      activeRegistration &&
        currentAvailable.some((registration) => normalizedId(registration) === activeId),
    );
    // A user-started journey may leave the page or close the scope that opened
    // it. `keepActive` keeps the run and its guide alive until the person
    // cancels it, while `available()` still reflects where it can be started.
    if (explicitId) {
      const explicit = registrations.get(explicitId);
      if (explicit?.keepActive) {
        emit();
        return;
      }
    }
    if (explicitId && !currentAvailable.some((registration) => normalizedId(registration) === explicitId)) {
      explicitId = null;
      if (!(activeIsTerminal && activeRouteMatches && activePageStillSame)) deactivateCurrent();
    }

    // A finished run is a receipt, not an active collection step. Keep it
    // visible when its scope closes (for example, the modal that held the form)
    // unless the route changes or another auto-start task takes over.
    const anotherAutoStart = currentAvailable.some(
      (registration) =>
        registration.autoStart === true && normalizedId(registration) !== activeId,
    );
    if (
      activeIsTerminal &&
      activeRouteMatches &&
      activePageStillSame &&
      !activeStillAvailable &&
      !anotherAutoStart
    ) {
      return;
    }

    let next: GuidedTaskRegistration | undefined;
    if (explicitId) {
      next = currentAvailable.find((registration) => normalizedId(registration) === explicitId);
    } else if (activeId) {
      const current = currentAvailable.find((registration) => normalizedId(registration) === activeId);
      if (current?.autoStart) next = current;
    }
    if (!next && autoSuppressedFor !== signature) {
      next = currentAvailable.find((registration) => registration.autoStart === true);
    }

    if (!next) {
      if (activeId) {
        deactivateCurrent();
        emit();
      }
      return;
    }

    if (activeId === normalizedId(next)) {
      start(next);
      return;
    }
    activateRegistration(next, false, { startedBy: "page" });
  };

  const scheduleRecompute = (): void => {
    if (destroyed || recomputeQueued) return;
    recomputeQueued = true;
    queueMicrotask(() => {
      recomputeQueued = false;
      recompute();
    });
  };

  const fieldSchema = (field: TaskField): Record<string, unknown> => {
    const type =
      field.type === "number" ? "number" : field.type === "boolean" ? "boolean" : "string";
    const optional = field.optional === true ? " (optional)" : "";
    const choices = field.values?.length
      ? ` One of: ${field.values.map((choice) => `${choice.label} (${choice.value})`).join(", ")}.`
      : "";
    const lookup = field.lookup
      ? ` Use ${field.searchAction ?? `search_${field.name}`} first when the value is not known, then pass its returned value.`
      : "";
    const recommended =
      field.recommended !== undefined && field.recommended !== null && field.recommended !== ""
        ? ` Recommended when the user delegates the choice: ${String(field.recommended)}.`
        : "";
    return {
      type,
      description: `${field.label}${optional}.${field.help ? ` ${field.help}` : ""}${choices}${recommended}${lookup}`.trim(),
      ...(field.values?.length ? { enum: field.values.map((choice) => choice.value) } : {}),
      ...(field.min !== undefined ? { minimum: field.min } : {}),
      ...(field.max !== undefined ? { maximum: field.max } : {}),
      ...(field.minLength !== undefined ? { minLength: field.minLength } : {}),
      ...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {}),
      ...(field.pattern ? { pattern: field.pattern } : {}),
    };
  };

  const agentWritableFields = (registration: GuidedTaskRegistration): readonly TaskField[] =>
    (registration.definition.fields ?? []).filter((field) => field.agentWritable !== false);

  const valuesSchemaFor = (tasks: readonly GuidedTaskRegistration[]): Record<string, unknown> => {
    const properties: Record<string, Record<string, unknown>> = {};
    const owners = new Map<string, string[]>();
    for (const registration of tasks) {
      const title = registration.definition.title;
      for (const field of agentWritableFields(registration)) {
        const names = owners.get(field.name) ?? [];
        if (!names.includes(title)) names.push(title);
        owners.set(field.name, names);
        if (!properties[field.name]) properties[field.name] = fieldSchema(field);
      }
    }
    for (const [name, titles] of owners) {
      if (!properties[name]) continue;
      if (titles.length > 1) {
        const base = String(properties[name].description ?? "");
        properties[name].description = `${base} Used by: ${titles.join(", ")}.`;
      }
    }
    return {
      type: "object",
      description:
        "Only fields the user explicitly supplied, corrected or delegated. Never put a whole sentence into a field; never invent a value.",
      properties,
      additionalProperties: false,
    };
  };

  const startSchema = (): JsonSchema => {
    const tasks = available();
    const ids = tasks.map(normalizedId);
    return {
      type: "object",
      properties: {
        task: {
          type: "string",
          ...(ids.length ? { enum: ids } : {}),
          description: "A guided task id from the current page. Never invent an id.",
        },
        values: valuesSchemaFor(tasks),
      },
      required: ["task"],
    };
  };

  const updateSchema = (): JsonSchema => {
    const registration = activeId ? registrations.get(activeId) : undefined;
    const tasks = registration ? [registration] : [];
    const ids = tasks.map(normalizedId);
    const fields = registration ? agentWritableFields(registration) : [];
    return {
      type: "object",
      properties: {
        task: {
          type: "string",
          ...(ids.length ? { enum: ids } : {}),
          description: "The active guided task. It must match the task currently open in the page.",
        },
        values: valuesSchemaFor(tasks),
        clear: {
          type: "array",
          description: "Field names to clear. Use this when the user removes a value rather than replacing it.",
          items: {
            type: "string",
            ...(fields.length ? { enum: fields.map((field) => field.name) } : {}),
          },
        },
      },
      required: ["task"],
    };
  };

  const activeRegistration = (): GuidedTaskRegistration | undefined =>
    activeId ? registrations.get(activeId) : undefined;

  const activeTaskAvailable = (
    control: "focus" | "review" | "proposeSave" | "cancel",
  ): true | {
    available: false;
    reason: string;
    reasonKey: string;
  } => {
    const registration = activeRegistration();
    if (!registration) {
      return {
        available: false,
        reason: "No guided task is active. Start one first if the user's request matches a task.",
        reasonKey: "availability.noActiveTask",
      };
    }
    const snapshot = registration.controller?.snapshot();
    if (snapshot && isTerminal(snapshot)) {
      return {
        available: false,
        reason: "The active guided task is already complete.",
        reasonKey: "availability.taskComplete",
      };
    }
    if (!registration.onCommand) {
      return {
        available: false,
        reason: "This task does not expose an interactive guide command. Use its values or business actions instead.",
        reasonKey: "availability.noGuideCommand",
      };
    }
    if (control === "focus" && guideFieldsOf(registration).length === 0) {
      return {
        available: false,
        reason: "This task does not expose a field rail to point at.",
        reasonKey: "availability.noGuideFields",
      };
    }
    const command =
      control === "review"
        ? registration.guide?.agent?.review?.trim()
        : control === "proposeSave"
          ? registration.guide?.agent?.proposeSave?.trim()
          : control === "cancel"
            ? registration.guide?.agent?.cancel?.trim() || registration.guide?.cancel?.command?.trim()
            : undefined;
    if (control !== "focus" && !command) {
      return {
        available: false,
        reason: `This task does not declare a ${control === "proposeSave" ? "save-confirmation" : control} guide command.`,
        reasonKey: "availability.noGuideCommand",
      };
    }
    return true;
  };

  const taskOnlySchema = (): JsonSchema => {
    const registration = activeRegistration();
    const ids = registration ? [normalizedId(registration)] : [];
    return {
      type: "object",
      properties: {
        task: {
          type: "string",
          ...(ids.length ? { enum: ids } : {}),
          description: "The active guided task. It must match the task currently open in the page.",
        },
      },
      required: ["task"],
    };
  };

  const focusSchema = (): JsonSchema => {
    const registration = activeRegistration();
    const ids = registration ? [normalizedId(registration)] : [];
    const fields = registration ? guideFieldsOf(registration).map((field) => field.field) : [];
    return {
      type: "object",
      properties: {
        task: {
          type: "string",
          ...(ids.length ? { enum: ids } : {}),
          description: "The active guided task. It must match the task currently open in the page.",
        },
        field: {
          type: "string",
          ...(fields.length ? { enum: fields } : {}),
          description:
            "A field node in the active guide. Use the guide field name, not an arbitrary selector. This only points at the field; it does not write a value.",
        },
      },
      required: ["task", "field"],
    };
  };

  const requireActiveRegistration = (args: Record<string, unknown>): GuidedTaskRegistration => {
    const registration = activeRegistration();
    if (!registration) throw new ActionError("ACTION_UNAVAILABLE", "No guided task is active.");
    const id = String(args.task ?? "").trim();
    const activeTaskId = normalizedId(registration);
    if (!id) throw new ActionError("INVALID_ARGS", `Choose the active task: ${activeTaskId}`);
    if (id !== activeTaskId) {
      throw new ActionError("INVALID_ARGS", `The active task is "${activeTaskId}", not "${id}".`);
    }
    return registration;
  };

  let offStartAction: (() => void) | null = null;
  let offUpdateAction: (() => void) | null = null;
  let offFocusAction: (() => void) | null = null;
  let offReviewAction: (() => void) | null = null;
  let offProposeSaveAction: (() => void) | null = null;
  let offCancelAction: (() => void) | null = null;
  let actionId = requestedActionId;
  let updateActionId =
    requestedActionId === DEFAULT_ACTION_ID ? DEFAULT_UPDATE_ACTION_ID : `${requestedActionId}_update`;
  let focusActionId =
    requestedActionId === DEFAULT_ACTION_ID ? DEFAULT_FOCUS_ACTION_ID : `${requestedActionId}_focus`;
  let reviewActionId =
    requestedActionId === DEFAULT_ACTION_ID ? DEFAULT_REVIEW_ACTION_ID : `${requestedActionId}_review`;
  let proposeSaveActionId =
    requestedActionId === DEFAULT_ACTION_ID
      ? DEFAULT_PROPOSE_SAVE_ACTION_ID
      : `${requestedActionId}_propose_save`;
  let cancelActionId =
    requestedActionId === DEFAULT_ACTION_ID ? DEFAULT_CANCEL_ACTION_ID : `${requestedActionId}_cancel`;

  // The action appears only while this catalog has tasks. A page with no guided
  // tasks should not grow an always-unavailable tool, and multiple Pling
  // instances sharing one registry must not collide on the same id.
  const ensureAction = (): void => {
    if (!options.registry || offStartAction || registrations.size === 0) return;
    let candidate = requestedActionId;
    let suffix = 2;
    while (options.registry.get(candidate)) candidate = `${requestedActionId}_${suffix++}`;
    actionId = candidate;
    let updateCandidate = updateActionId;
    let updateSuffix = 2;
    while (options.registry.get(updateCandidate)) updateCandidate = `${updateActionId}_${updateSuffix++}`;
    updateActionId = updateCandidate;
    const reserved = new Set([actionId, updateActionId]);
    const claim = (base: string): string => {
      let next = base;
      let nextSuffix = 2;
      while (options.registry!.get(next) || reserved.has(next)) next = `${base}_${nextSuffix++}`;
      reserved.add(next);
      return next;
    };
    focusActionId = claim(focusActionId);
    reviewActionId = claim(reviewActionId);
    proposeSaveActionId = claim(proposeSaveActionId);
    cancelActionId = claim(cancelActionId);
    offStartAction = options.registry.bind({
      descriptor: {
        id: actionId,
        primitive: "call",
        description:
          "Open one guided task that is available on the current page. Use only an id listed in Available guided tasks. After it is active, use the separate update action to record new values.",
        label: "Start a guided task",
        summary: "Shows the task goal, constraints and working memory; it does not bypass any business action.",
        kind: "read",
        confirm: false,
        fidelity: "high",
        params: startSchema(),
        playbook: [
          "Choose a task only when the user's request matches its title or examples.",
          "If the task is already active, do not start it again; use the update action to record only the fields the user supplied or confirmed.",
          "A task guide is orientation, not permission: every business write still uses its declared action, and the guide remains the visible path while active.",
          "Ask when the target field is ambiguous. A whole sentence is never a field value.",
        ],
      },
      resolveParams: startSchema,
      isAvailable: () => {
        const count = available().length;
        return count > 0
          ? true
          : {
              available: false,
              reason: "No guided tasks are available in the current page context.",
              reasonKey: "availability.noGuidedTasks",
            };
      },
      run: async (args) => {
        const id = String(args.task ?? "").trim();
        const ids = available().map(normalizedId);
        if (!id) throw new ActionError("INVALID_ARGS", `Choose one of: ${ids.join(", ") || "(none)"}`);
        if (!ids.includes(id)) {
          throw new ActionError("INVALID_ARGS", `Unknown guided task "${id}". Choose one of: ${ids.join(", ") || "(none)"}`);
        }
        const rawValues = args.values;
        if (rawValues !== undefined && (typeof rawValues !== "object" || rawValues === null || Array.isArray(rawValues))) {
          throw new ActionError("INVALID_ARGS", "values must be an object whose keys are field names for the chosen task.");
        }
        const registration = registrations.get(id)!;
        const values = validateAgentValues(registration, (rawValues ?? {}) as TaskValues);
        const task = api.activate(id, { values, startedBy: "agent" });
        return { taskId: task.id, title: task.definition.title, active: true, startedBy: task.startedBy };
      },
    });

    offUpdateAction = options.registry.bind({
      descriptor: {
        id: updateActionId,
        primitive: "call",
        description:
          "Record values the user supplied, corrected or delegated into the active guided task. This updates the task's working memory and the page form; it does not run a business write.",
        label: "Update the active guided task",
        summary: "Writes only declared, agent-writable fields into the current task run.",
        kind: "read",
        confirm: false,
        fidelity: "high",
        params: updateSchema(),
        playbook: [
          "Use the active task id. Never invent a field or put an entire user sentence into a text field.",
          "If the user asks what to do, asks a question, or is just thinking aloud, answer first; do not write a field.",
          "If the user delegates a choice, use a declared recommendation or allowed value and say what you chose. Complete the delegated field even if other required fields are empty; report the remaining gaps afterwards.",
          "If the user corrects a value, update only that field. If the user removes a value, use clear.",
          "After writing, report only what changed and the next real gap. Do not walk a fixed field sequence.",
        ],
      },
      resolveParams: updateSchema,
      isAvailable: () => {
        if (!activeId) {
          return {
            available: false,
            reason: "No guided task is active. Start one first if the user's request matches a task.",
            reasonKey: "availability.noActiveTask",
          };
        }
        const snapshot = registrations.get(activeId)?.controller?.snapshot();
        if (snapshot && isTerminal(snapshot)) {
          return {
            available: false,
            reason: "The active guided task is already complete.",
            reasonKey: "availability.taskComplete",
          };
        }
        return true;
      },
      run: async (args) => {
        if (!activeId) throw new ActionError("ACTION_UNAVAILABLE", "No guided task is active.");
        const registration = registrations.get(activeId);
        if (!registration) throw new ActionError("ACTION_NOT_FOUND", "The active guided task is no longer registered.");
        const id = String(args.task ?? "").trim();
        if (!id) throw new ActionError("INVALID_ARGS", `Choose the active task: ${activeId}`);
        if (id !== activeId) {
          throw new ActionError("INVALID_ARGS", `The active task is "${activeId}", not "${id}".`);
        }
        const controller = registration.controller;
        if (!controller) throw new ActionError("ACTION_UNAVAILABLE", `Guided task "${id}" has no controller.`);
        const current = controller.snapshot();
        if (current && isTerminal(current)) {
          throw new ActionError("ACTION_UNAVAILABLE", `Guided task "${id}" is already complete.`);
        }
        const rawValues = args.values;
        if (rawValues !== undefined && (typeof rawValues !== "object" || rawValues === null || Array.isArray(rawValues))) {
          throw new ActionError("INVALID_ARGS", "values must be an object whose keys are field names for the active task.");
        }
        const rawClear = args.clear;
        if (rawClear !== undefined && (!Array.isArray(rawClear) || rawClear.some((name) => typeof name !== "string"))) {
          throw new ActionError("INVALID_ARGS", "clear must be an array of field names.");
        }
        const clear = (rawClear ?? []) as string[];
        const allowed = new Set(agentWritableFields(registration).map((field) => field.name));
        for (const name of clear) {
          if (!allowed.has(name)) {
            throw new ActionError("INVALID_ARGS", `Field "${name}" cannot be cleared by the agent.`);
          }
        }
        const values = validateAgentValues(registration, (rawValues ?? {}) as TaskValues);
        for (const name of clear) controller.setValue(name, undefined);
        for (const [name, value] of Object.entries(values)) controller.setValue(name, value);
        const snapshot = controller.snapshot();
        if (!snapshot) throw new ActionError("ACTION_UNAVAILABLE", `Guided task "${id}" is not running.`);
        return {
          taskId: id,
          status: snapshot.status,
          values: snapshot.values,
          missingRequiredFields: missingRequiredFields(registration, snapshot.values),
        };
      },
    });

    offFocusAction = options.registry.bind({
      descriptor: {
        id: focusActionId,
        primitive: "call",
        description:
          "Point the person at one field in the active guided task. This opens or scrolls the page field into view; it never writes a value.",
        label: "Focus a task field",
        summary: "Moves attention to a declared guide field without changing the task or the page value.",
        kind: "read",
        confirm: false,
        fidelity: "high",
        params: focusSchema(),
        playbook: [
          "Use this when the person needs to see or edit a field themselves, or when you are explaining where a value belongs.",
          "Use only a field listed in the active guide. Never invent a selector or a field name.",
          "Focusing is not writing. If the person also supplied a value, use the update action separately.",
        ],
      },
      resolveParams: focusSchema,
      isAvailable: () => activeTaskAvailable("focus"),
      run: async (args) => {
        const registration = requireActiveRegistration(args);
        const id = normalizedId(registration);
        const fieldName = String(args.field ?? "").trim();
        const fields = guideFieldsOf(registration);
        const field = fields.find((candidate) => candidate.field === fieldName);
        if (!field) {
          throw new ActionError(
            "INVALID_ARGS",
            `Unknown guide field "${fieldName}". Available: ${fields.map((candidate) => candidate.field).join(", ") || "(none)"}`,
          );
        }
        const command = focusCommand(registration, field);
        const handled = await runRegistrationCommand(registration, command, `Locate ${field.label}`);
        if (!handled) {
          throw new ActionError("ACTION_UNAVAILABLE", "This task does not expose a focus command for the guide field.");
        }
        const snapshot = registration.controller?.snapshot() ?? null;
        return {
          taskId: id,
          field: field.field,
          label: field.label,
          command,
          handled: true,
          status: snapshot?.status ?? "active",
          missingRequiredFields: snapshot ? missingRequiredFields(registration, snapshot.values) : [],
        };
      },
    });

    offReviewAction = options.registry.bind({
      descriptor: {
        id: reviewActionId,
        primitive: "call",
        description:
          "Open a read-only review of the active guided task. This does not write or save anything; the person can still edit or confirm.",
        label: "Review the active task",
        summary: "Shows the current values and gaps before any write.",
        kind: "read",
        confirm: false,
        fidelity: "high",
        params: taskOnlySchema(),
        playbook: [
          "Use this when the person asks to review, check, or see what is currently filled.",
          "A review is read-only. Do not claim that anything was saved.",
          "If required fields are missing, say which ones; do not turn the review into a save.",
        ],
      },
      resolveParams: taskOnlySchema,
      isAvailable: () => activeTaskAvailable("review"),
      run: async (args) => {
        const registration = requireActiveRegistration(args);
        const id = normalizedId(registration);
        const command = guideCommand(registration, "review");
        const handled = await runRegistrationCommand(registration, command, "Review task");
        if (!handled) {
          throw new ActionError("ACTION_UNAVAILABLE", "This task does not expose a review command.");
        }
        const snapshot = registration.controller?.snapshot() ?? null;
        return {
          taskId: id,
          command,
          handled: true,
          reviewed: true,
          status: snapshot?.status ?? "active",
          missingRequiredFields: snapshot ? missingRequiredFields(registration, snapshot.values) : [],
        };
      },
    });

    offProposeSaveAction = options.registry.bind({
      descriptor: {
        id: proposeSaveActionId,
        primitive: "call",
        description:
          "Open the confirmation step for the active guided task. This never writes: the person must confirm in the page before the business action runs.",
        label: "Propose saving the active task",
        summary: "Shows the confirmation UI; the write still needs an explicit human confirmation.",
        kind: "read",
        confirm: false,
        fidelity: "high",
        params: taskOnlySchema(),
        playbook: [
          "Use this only when the person asked to save, submit, finish, or explicitly agreed to proceed.",
          "Never claim the task was saved. The result only means the confirmation step is open.",
          "If required fields are missing, ask for them instead of proposing a save.",
          "If the person says not to save yet, do not call this action; answer and keep the task open.",
        ],
      },
      resolveParams: taskOnlySchema,
      isAvailable: () => activeTaskAvailable("proposeSave"),
      run: async (args) => {
        const registration = requireActiveRegistration(args);
        const id = normalizedId(registration);
        const snapshot = registration.controller?.snapshot() ?? null;
        if (!snapshot) throw new ActionError("ACTION_UNAVAILABLE", `Guided task "${id}" is not running.`);
        const missing = missingRequiredFields(registration, snapshot.values);
        if (missing.length) {
          return {
            taskId: id,
            handled: false,
            awaitingConfirmation: false,
            missingRequiredFields: missing,
            reason: "Required fields are still missing. Ask for them before proposing save.",
          };
        }
        const command = guideCommand(registration, "proposeSave");
        const handled = await runRegistrationCommand(registration, command, "Review before saving");
        if (!handled) {
          throw new ActionError("ACTION_UNAVAILABLE", "This task does not expose a save-confirmation command.");
        }
        return {
          taskId: id,
          command,
          handled: true,
          awaitingConfirmation: true,
          missingRequiredFields: [],
        };
      },
    });

    offCancelAction = options.registry.bind({
      descriptor: {
        id: cancelActionId,
        primitive: "call",
        description:
          "Pause or abandon the active guided task. This only closes the task run; it does not undo values already written to the page.",
        label: "Cancel the active task",
        summary: "Ends the task guide without running a business write.",
        kind: "read",
        confirm: false,
        fidelity: "high",
        params: taskOnlySchema(),
        playbook: [
          "Use this only when the person asks to cancel, stop, or abandon the task.",
          "Do not call it just because the person is asking a question or pausing to think.",
        ],
      },
      resolveParams: taskOnlySchema,
      isAvailable: () => activeTaskAvailable("cancel"),
      run: async (args) => {
        const registration = requireActiveRegistration(args);
        const id = normalizedId(registration);
        const command = guideCommand(registration, "cancel");
        const handled = await runRegistrationCommand(registration, command, "Cancel task");
        if (!handled || activeId === id) api.deactivate();
        return { taskId: id, command, cancelled: true, handled };
      },
    });
  };

  const releaseAction = (): void => {
    if (registrations.size > 0) return;
    offStartAction?.();
    offUpdateAction?.();
    offFocusAction?.();
    offReviewAction?.();
    offProposeSaveAction?.();
    offCancelAction?.();
    offStartAction = null;
    offUpdateAction = null;
    offFocusAction = null;
    offReviewAction = null;
    offProposeSaveAction = null;
    offCancelAction = null;
  };

  const offRegistry = options.registry?.onChange(scheduleRecompute) ?? (() => undefined);

  const api: TaskCatalog = {
    get actionId() {
      return actionId;
    },
    get updateActionId() {
      return updateActionId;
    },
    get focusActionId() {
      return focusActionId;
    },
    get reviewActionId() {
      return reviewActionId;
    },
    get proposeSaveActionId() {
      return proposeSaveActionId;
    },
    get cancelActionId() {
      return cancelActionId;
    },
    define(registration) {
      if (destroyed) throw new Error("Task catalog has been destroyed");
      const id = normalizedId(registration);
      if (registrations.has(id)) throw new Error(`Duplicate guided task id "${id}"`);
      const normalized: GuidedTaskRegistration = { ...registration, id };
      registrations.set(id, normalized);
      ensureAction();

      if (normalized.controller && !normalized.controller.get(id)) {
        const unregister = normalized.controller.register(normalized.definition);
        const unsubscribe = normalized.controller.subscribe(() => {
          // The guide's state() may read live page values, so a controller change
          // must invalidate the active view even when the page did not mutate it.
          if (activeId === id) emit();
        });
        offs.set(id, () => {
          unsubscribe();
          unregister();
        });
      }
      recompute();
      emit();
      return () => {
        if (registrations.get(id) !== normalized) return;
        registrations.delete(id);
        offs.get(id)?.();
        offs.delete(id);
        if (activeId === id) deactivateCurrent();
        if (explicitId === id) explicitId = null;
        releaseAction();
        recompute();
        emit();
      };
    },
    get(id) {
      return registrations.get(id);
    },
    list() {
      return [...registrations.values()];
    },
    available,
    active() {
      if (!activeId) return null;
      const registration = registrations.get(activeId);
      return registration ? activeTaskOf(registration) : null;
    },
    activate(id, options) {
      const registration = registrations.get(id);
      if (!registration) throw new ActionError("ACTION_NOT_FOUND", `Guided task "${id}" is not registered.`);
      return activateRegistration(registration, true, options);
    },
    deactivate() {
      explicitId = null;
      autoSuppressedFor = contextSignature();
      deactivateCurrent();
      recompute();
      emit();
    },
    command(command) {
      if (!activeId) return false;
      const id = activeId;
      const registration = registrations.get(id);
      if (!registration?.onCommand) return false;
      try {
        const result = registration.onCommand(command, activeTaskOf(registration));
        emit();
        if (result && typeof (result as Promise<void>).then === "function") {
          void (result as Promise<void>).then(
            () => {
              if (activeId === id) emit();
            },
            () => {
              if (activeId === id) emit();
            },
          );
        }
      } catch {
        return false;
      }
      return true;
    },
    views() {
      return available().map((registration) => guidedTaskViewOf(registration.definition, registration.guide));
    },
    refresh: emit,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      deactivateCurrent();
      for (const off of offs.values()) off();
      offs.clear();
      registrations.clear();
      offStartAction?.();
      offUpdateAction?.();
      offFocusAction?.();
      offReviewAction?.();
      offProposeSaveAction?.();
      offCancelAction?.();
      offStartAction = null;
      offUpdateAction = null;
      offFocusAction = null;
      offReviewAction = null;
      offProposeSaveAction = null;
      offCancelAction = null;
      offRegistry();
      listeners.clear();
    },
  };

  return api;
}
