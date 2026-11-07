import type { Kind } from "@plingjs/core";

/**
 * Guided Tasks（S18）—— 面向人的任务，不是又一个 Agent 循环。
 *
 * 这一层解决的是「用户不会提问」与「一个业务操作要跨很多动作」之间的缝：
 *   · definition 描述用户要完成什么、需要哪些字段、会走哪几步；
 *   · run 保存一次任务的状态、字段值和逐步结果；
 *   · invoke 由宿主注入：可以接到现有 executor、Surface 或业务服务，
 *     但任务层不自己执行动作，也不复制权限/审批。
 *
 * 刻意不做：
 *   · 不把业务任务塞进 core；
 *   · 不内置通用 Planner；
 *   · 不替适配器决定怎么渲染任务面板。
 */

export type TaskValue = string | number | boolean | null | undefined;
export type TaskValues = Record<string, TaskValue>;

export type TaskFieldType = "text" | "textarea" | "number" | "boolean" | "date" | "select" | "lookup";

export interface TaskChoice {
  /** 动作/API 真正需要的引用，不建议是面向用户的教学 slug */
  value: string;
  /** 人看到的名称；也用于模型选候选 */
  label: string;
  /** 可选的补充说明，例如脱敏手机号、最近上课时间 */
  description?: string;
}

export interface TaskLookupContext {
  signal?: AbortSignal;
}

/** A record the page has already resolved before the task starts. */
export interface TaskRecordBinding {
  /** Stable reference accepted by the existing business actions. */
  id: string;
  /** Human-facing label for diagnostics and optional task UI. */
  label?: string;
}

/**
 * Context supplied by the host at `start()`.
 *
 * Bindings are page facts, not user input. They are deliberately separate from
 * `values`, so a record id never becomes an editable field or appears as a
 * prompt placeholder by accident.
 */
export interface TaskBinding {
  record?: TaskRecordBinding;
}

/** 大集合字段的异步搜索；小集合直接用 values 即可。 */
export type TaskLookup = (query: string, context: TaskLookupContext) => Promise<readonly TaskChoice[]> | readonly TaskChoice[];

export interface TaskField {
  name: string;
  label: string;
  type?: TaskFieldType;
  /** 默认必填；`optional: true` 才允许空值。 */
  optional?: boolean;
  placeholder?: string;
  help?: string;
  defaultValue?: TaskValue;
  /** 小型封闭选择集；大集合不要把它撑成几百项，改用 lookup。 */
  values?: readonly TaskChoice[];
  /**
   * A value the page is prepared to recommend when the person delegates the
   * choice (“你来选”, “随便填”). It is a suggestion, not an automatic write.
   */
  recommended?: TaskValue;
  /** 大集合的搜索选择器；UI 与 Agent 应共用同一份搜索实现。 */
  lookup?: TaskLookup;
  /** Minimum for a numeric field. Enforced before an Agent value reaches the run. */
  min?: number;
  /** Maximum for a numeric field. Enforced before an Agent value reaches the run. */
  max?: number;
  /** Minimum length for a text field. Enforced before an Agent value reaches the run. */
  minLength?: number;
  /** Maximum length for a text field. Enforced before an Agent value reaches the run. */
  maxLength?: number;
  /** Optional regular expression for a text field, as a string without delimiters. */
  pattern?: string;
  /**
   * Business-level check run before an Agent value is written to working memory.
   *
   * Return a short human-readable reason to reject the value, or nothing when
   * it is valid. This is not an intent parser: it validates a value the model
   * already proposed. Page code remains responsible for the same invariants on
   * direct user input.
   */
  validate?: (value: TaskValue, values: TaskValues) => string | null | undefined;
  /**
   * 由 `lookup` 自动暴露给 Agent 的只读搜索动作 id。
   *
   * 省略时使用 `search_<name>`。同一个搜索实现被多个任务复用时，应显式给出
   * 同一个 id，让注册器只登记一次。
   */
  searchAction?: string;
  /** lookup 至少输入几个字符；由 UI 与搜索动作共同遵守。 */
  minChars?: number;
  /**
   * Whether the model may write this field through the task update action.
   *
   * Defaults to true. Set it to false for values only the person can supply,
   * such as an uploaded file, a signature or a verified one-time code. The page
   * can still write the value through `controller.setValue()`.
   */
  agentWritable?: boolean;
}

export interface TaskStep {
  /** 稳定步骤 id；省略时用 1-based 序号。 */
  id?: string;
  /** 给人看的动作名，例如「检查时间段冲突」。 */
  label: string;
  /** 为什么做这一步；用于任务进度与解释当前操作。 */
  summary?: string;
  /** 已注册动作 id。任务层只传 id，不重新定义执行语义。 */
  action: string;
  /** 参数模板；函数形式可以读取字段值与启动时绑定的页面记录。 */
  args?:
    | Record<string, unknown>
    | ((values: TaskValues, binding: TaskBinding) => Record<string, unknown>);
  /** 可选步骤失败不阻断后续步骤。 */
  optional?: boolean;
  /** 这一步由用户亲自完成；任务先进入 `waiting`，执行器负责真正的接力与验证。 */
  handoff?: boolean | string;
}

export type TaskMode = "steps" | "agent";

export interface TaskDefinition {
  id: string;
  title: string;
  description?: string;
  /** What the person is trying to achieve. This is the task's goal, not a step list. */
  objective?: string;
  /** Boundaries the model must respect while helping with the task. */
  constraints?: readonly string[];
  /** Observable conditions that mean the task is genuinely complete. */
  successCriteria?: readonly string[];
  /**
   * The task can only start after the host selects a page record.
   *
   * The record itself is supplied through `start(id, values, binding)`, not
   * through a user-editable field. Generic task lists should present these
   * tasks as entry points that must be opened from a record row or detail page.
   */
  requiresRecord?: boolean;
  /** 首屏任务卡上的示例说法；点击后应填入表单，不应直接执行写操作。 */
  examples?: readonly string[];
  fields?: readonly TaskField[];
  /** 风险等级沿用动作层的 read/write/danger。 */
  risk?: Kind;
  /** 有 steps 时是确定性任务；没有 steps 时用 prompt 交给 Agent。 */
  steps?: readonly TaskStep[];
  /** Agent 模式的任务模板；可读取字段值。 */
  prompt?: string | ((values: TaskValues) => string);
  /** 任务级确认；具体权限仍由底层动作/执行器决定。 */
  confirm?: boolean | "always";
}

export type TaskRunStatus =
  | "collecting"
  | "ready"
  | "planned"
  | "running"
  | "waiting"
  | "verifying"
  | "done"
  | "failed"
  | "cancelled";
export type TaskWaitingFor = "confirmation" | "handoff";
export type TaskStepStatus = "pending" | "running" | "ok" | "skipped" | "failed";

export interface TaskRunError {
  code: string;
  message: string;
}

export interface TaskStepSnapshot {
  index: number;
  id: string;
  label: string;
  summary?: string;
  action: string;
  status: TaskStepStatus;
  optional: boolean;
  handoff?: boolean | string;
  error?: TaskRunError;
  result?: unknown;
}

export interface TaskRunSnapshot {
  taskId: string;
  title: string;
  mode: TaskMode;
  status: TaskRunStatus;
  fields: readonly TaskField[];
  values: TaskValues;
  /** Page context supplied when the run started, when non-empty. */
  binding?: TaskBinding;
  steps: readonly TaskStepSnapshot[];
  /** Agent 模式下由字段值生成的提示词；可交给 pling.ask()。 */
  prompt?: string;
  /** Why execution is paused. Omitted unless status is `waiting`. */
  waitingFor?: TaskWaitingFor;
  /** Present only when the task definition asks for a task-level confirmation. */
  confirmation?: { required: true; confirmed: boolean };
  error?: TaskRunError;
  startedAt?: number;
  finishedAt?: number;
}

export interface TaskRunContext {
  taskId: string;
  values: TaskValues;
  binding: TaskBinding;
  signal: AbortSignal;
  /** Report a long-running sub-state; stale or cancelled runs ignore it. */
  report(status: "running" | "waiting" | "verifying", waitingFor?: TaskWaitingFor): void;
}

/**
 * 宿主提供的动作执行桥。
 *
 * 返回值可以是 `void`、`{ ok: true }`，也可以是现有 `ExecResult`
 * （带 `error` 失败，或 `result.ok === false`）。这样任务层不依赖
 * `@plingjs/core` 的执行器实现，也不会形成第二套执行逻辑。
 */
export type TaskInvoke = (
  action: string,
  args: Record<string, unknown>,
  context: TaskRunContext,
) => unknown | Promise<unknown>;

export interface TaskControllerOptions {
  invoke: TaskInvoke;
  now?: () => number;
}

export interface TaskController {
  register(definition: TaskDefinition): () => void;
  get(id: string): TaskDefinition | undefined;
  list(): readonly TaskDefinition[];
  start(id: string, values?: TaskValues, binding?: TaskBinding): TaskRunSnapshot;
  setValue(name: string, value: TaskValue): TaskRunSnapshot;
  /** Freeze the current values into a plan without executing anything. */
  plan(): TaskRunSnapshot;
  /** Confirm a task whose definition requires task-level confirmation. */
  confirm(): TaskRunSnapshot;
  /** 确定性任务执行步骤；Agent 模式只返回带 prompt 的 ready 快照。 */
  run(): Promise<TaskRunSnapshot>;
  cancel(): TaskRunSnapshot;
  reset(): void;
  snapshot(): TaskRunSnapshot | null;
  subscribe(listener: (snapshot: TaskRunSnapshot) => void): () => void;
}

type InvocationOutcome = { ok: true; result?: unknown } | { ok: false; error: TaskRunError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 兼容 void / { ok } / ExecResult；失败必须显式，不能把未知返回当成失败。 */
function outcomeOf(value: unknown): InvocationOutcome {
  if (value === undefined) return { ok: true };
  if (!isRecord(value)) return { ok: true, result: value };
  if (isRecord(value.error)) {
    const error = value.error;
    return {
      ok: false,
      error: {
        code: typeof error.code === "string" ? error.code : "TASK_ACTION_FAILED",
        message: typeof error.message === "string" ? error.message : "动作执行失败",
      },
    };
  }
  const result = isRecord(value.result) ? value.result : undefined;
  if (result && result.ok === false) {
    const error = isRecord(result.error) ? result.error : undefined;
    return {
      ok: false,
      error: {
        code: typeof error?.code === "string" ? error.code : "TASK_ACTION_FAILED",
        message: typeof error?.message === "string" ? error.message : "动作执行失败",
      },
    };
  }
  if (value.ok === false) {
    return {
      ok: false,
      error: {
        code: typeof value.code === "string" ? value.code : "TASK_ACTION_FAILED",
        message: typeof value.message === "string" ? value.message : "动作执行失败",
      },
    };
  }
  return { ok: true, result };
}

function promptFor(definition: TaskDefinition, values: TaskValues): string {
  if (typeof definition.prompt === "function") return definition.prompt(values).trim();
  const template = definition.prompt?.trim();
  if (!template) {
    throw new Error(`Task "${definition.id}" is in agent mode but has no prompt`);
  }
  return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_all, name: string) => {
    const value = values[name];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Task "${definition.id}" prompt is missing field "${name}"`);
    }
    return String(value);
  });
}

function stepIdOf(step: TaskStep, index: number): string {
  return step.id?.trim() || `step_${index + 1}`;
}

function cloneValues(values: TaskValues): TaskValues {
  return { ...values };
}

function cloneBinding(binding: TaskBinding): TaskBinding {
  return binding.record ? { record: { ...binding.record } } : {};
}

function hasBinding(binding: TaskBinding): boolean {
  return binding.record !== undefined;
}

function missingFields(fields: readonly TaskField[], values: TaskValues): TaskField[] {
  return fields.filter((field) => {
    if (field.optional) return false;
    const value = values[field.name];
    return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
  });
}

function snapshotOf(run: TaskRun | null): TaskRunSnapshot | null {
  if (!run) return null;
  return {
    taskId: run.definition.id,
    title: run.definition.title,
    mode: run.mode,
    status: run.status,
    fields: run.definition.fields ?? [],
    values: cloneValues(run.values),
    ...(hasBinding(run.binding) ? { binding: cloneBinding(run.binding) } : {}),
    steps: run.steps.map((step) => ({ ...step, ...(step.error ? { error: { ...step.error } } : {}) })),
    ...(run.prompt === undefined ? {} : { prompt: run.prompt }),
    ...(run.waitingFor === undefined ? {} : { waitingFor: run.waitingFor }),
    ...(run.definition.confirm
      ? { confirmation: { required: true as const, confirmed: run.confirmed } }
      : {}),
    ...(run.error === undefined ? {} : { error: { ...run.error } }),
    ...(run.startedAt === undefined ? {} : { startedAt: run.startedAt }),
    ...(run.finishedAt === undefined ? {} : { finishedAt: run.finishedAt }),
  };
}

interface TaskRun {
  definition: TaskDefinition;
  mode: TaskMode;
  status: TaskRunStatus;
  values: TaskValues;
  binding: TaskBinding;
  steps: TaskStepSnapshot[];
  prompt?: string;
  waitingFor?: TaskWaitingFor;
  confirmed: boolean;
  error?: TaskRunError;
  startedAt?: number;
  finishedAt?: number;
  controller?: AbortController;
  token: number;
}

export function taskModeOf(definition: TaskDefinition): TaskMode {
  return definition.steps?.length ? "steps" : "agent";
}

export function createTaskController(options: TaskControllerOptions): TaskController {
  const now = options.now ?? (() => Date.now());
  const definitions = new Map<string, TaskDefinition>();
  const listeners = new Set<(snapshot: TaskRunSnapshot) => void>();
  let run: TaskRun | null = null;
  let runCounter = 0;

  const emit = (): void => {
    const snapshot = snapshotOf(run);
    if (!snapshot) return;
    for (const listener of listeners) listener(snapshot);
  };

  const updatePrompt = (): void => {
    if (!run || run.mode !== "agent") return;
    run.prompt = promptFor(run.definition, run.values);
  };

  const start = (id: string, values: TaskValues = {}, binding: TaskBinding = {}): TaskRunSnapshot => {
    const definition = definitions.get(id);
    if (!definition) throw new Error(`Unknown task "${id}"`);
    if (definition.requiresRecord && !binding.record?.id.trim()) {
      throw new Error(`Task "${definition.id}" requires a selected record`);
    }
    if (run) {
      run.token += 1;
      run.controller?.abort();
    }
    const fields = definition.fields ?? [];
    const initial: TaskValues = {};
    for (const field of fields) {
      if (field.defaultValue !== undefined) initial[field.name] = field.defaultValue;
    }
    for (const [key, value] of Object.entries(values)) initial[key] = value;
    const mode = taskModeOf(definition);
    if (mode === "agent" && !definition.prompt) {
      throw new Error(`Task "${definition.id}" is in agent mode but has no prompt`);
    }
    run = {
      definition,
      mode,
      status: missingFields(fields, initial).length > 0 ? "collecting" : "ready",
      values: initial,
      binding: cloneBinding(binding),
      steps: (definition.steps ?? []).map((step, index) => ({
        index: index + 1,
        id: stepIdOf(step, index),
        label: step.label,
        ...(step.summary === undefined ? {} : { summary: step.summary }),
        action: step.action,
        status: "pending",
        optional: step.optional === true,
        ...(step.handoff === undefined ? {} : { handoff: step.handoff }),
      })),
      confirmed: false,
      token: ++runCounter,
      startedAt: now(),
    };
    if (run.mode === "agent") updatePrompt();
    emit();
    return snapshotOf(run)!;
  };

  const setValue = (name: string, value: TaskValue): TaskRunSnapshot => {
    if (!run) throw new Error("No task has been started");
    if (run.status !== "collecting" && run.status !== "ready" && run.status !== "planned") {
      throw new Error(`Task "${run.definition.id}" is ${run.status}; fields can no longer be changed`);
    }
    if (!(run.definition.fields ?? []).some((field) => field.name === name)) {
      throw new Error(`Task "${run.definition.id}" has no field "${name}"`);
    }
    run.values = { ...run.values, [name]: value };
    run.status = missingFields(run.definition.fields ?? [], run.values).length > 0 ? "collecting" : "ready";
    run.error = undefined;
    if (run.mode === "agent") updatePrompt();
    emit();
    return snapshotOf(run)!;
  };

  const finish = (status: TaskRunStatus, error?: TaskRunError): TaskRunSnapshot => {
    if (!run) throw new Error("No task has been started");
    run.status = status;
    run.waitingFor = undefined;
    if (error) run.error = error;
    run.finishedAt = now();
    emit();
    return snapshotOf(run)!;
  };

  const runSteps = async (): Promise<TaskRunSnapshot> => {
    if (!run) throw new Error("No task has been started");
    const current = run;
    const missing = missingFields(current.definition.fields ?? [], current.values);
    if (missing.length > 0) {
      current.status = "collecting";
      current.error = {
        code: "TASK_FIELDS_REQUIRED",
        message: missing.map((field) => field.label).join("、"),
      };
      emit();
      return snapshotOf(current)!;
    }

    if (current.mode === "agent") {
      updatePrompt();
      if (current.definition.confirm && !current.confirmed) {
        current.status = "waiting";
        current.waitingFor = "confirmation";
        emit();
        return snapshotOf(current)!;
      }
      current.status = "ready";
      current.waitingFor = undefined;
      emit();
      return snapshotOf(current)!;
    }

    if (current.status === "waiting" && current.waitingFor === "confirmation") {
      return snapshotOf(current)!;
    }

    current.status = "planned";
    current.waitingFor = undefined;
    current.error = undefined;
    emit();

    if (current.definition.confirm && !current.confirmed) {
      current.status = "waiting";
      current.waitingFor = "confirmation";
      emit();
      return snapshotOf(current)!;
    }

    current.status = "running";
    current.error = undefined;
    const controller = new AbortController();
    current.controller = controller;
    const token = current.token;
    emit();

    const report = (status: "running" | "waiting" | "verifying", waitingFor?: TaskWaitingFor): void => {
      if (token !== current.token || controller.signal.aborted) return;
      current.status = status;
      current.waitingFor = status === "waiting" ? waitingFor ?? "handoff" : undefined;
      emit();
    };

    const steps = current.definition.steps ?? [];
    for (let index = 0; index < steps.length; index += 1) {
      if (token !== current.token || controller.signal.aborted) {
        return finish("cancelled");
      }
      const definitionStep = steps[index]!;
      const step = current.steps[index]!;
      current.status = definitionStep.handoff ? "waiting" : "running";
      current.waitingFor = definitionStep.handoff ? "handoff" : undefined;
      step.status = "running";
      step.error = undefined;
      emit();

      try {
        const args =
          typeof definitionStep.args === "function"
            ? definitionStep.args(current.values, cloneBinding(current.binding))
            : (definitionStep.args ?? {});
        const result = await options.invoke(definitionStep.action, args, {
          taskId: current.definition.id,
          values: cloneValues(current.values),
          binding: cloneBinding(current.binding),
          signal: controller.signal,
          report,
        });
        if (token !== current.token || controller.signal.aborted) {
          return finish("cancelled");
        }
        const outcome = outcomeOf(result);
        if (outcome.ok) {
          current.status = "verifying";
          current.waitingFor = undefined;
          step.status = "ok";
          if (outcome.result !== undefined) step.result = outcome.result;
        } else if (definitionStep.optional) {
          current.status = "running";
          current.waitingFor = undefined;
          step.status = "skipped";
          step.error = outcome.error;
        } else {
          step.status = "failed";
          step.error = outcome.error;
          emit();
          return finish("failed", outcome.error);
        }
        emit();
      } catch (error) {
        if (token !== current.token || controller.signal.aborted) {
          return finish("cancelled");
        }
        const failure: TaskRunError = {
          code: "TASK_STEP_FAILED",
          message: error instanceof Error ? error.message : String(error),
        };
        if (definitionStep.optional) {
          current.status = "running";
          current.waitingFor = undefined;
          step.status = "skipped";
          step.error = failure;
          emit();
        } else {
          step.status = "failed";
          step.error = failure;
          emit();
          return finish("failed", failure);
        }
      }
    }

    if (token !== current.token) return finish("cancelled");
    return finish("done");
  };

  const cancel = (): TaskRunSnapshot => {
    if (!run) throw new Error("No task has been started");
    if (run.status === "done" || run.status === "failed" || run.status === "cancelled") {
      return snapshotOf(run)!;
    }
    run.token += 1;
    run.controller?.abort();
    return finish("cancelled");
  };

  return {
    register(definition) {
      const id = definition.id.trim();
      if (!id) throw new Error("Task id must be non-empty");
      if (definitions.has(id)) throw new Error(`Duplicate task id "${id}"`);
      definitions.set(id, { ...definition, id });
      return () => {
        definitions.delete(id);
      };
    },
    get(id) {
      return definitions.get(id);
    },
    list() {
      return [...definitions.values()];
    },
    start,
    setValue,
    plan() {
      if (!run) throw new Error("No task has been started");
      const current = run;
      if (current.status === "done" || current.status === "failed" || current.status === "cancelled") {
        throw new Error(`Task "${current.definition.id}" is ${current.status}; start a new run`);
      }
      const missing = missingFields(current.definition.fields ?? [], current.values);
      if (missing.length > 0) {
        current.status = "collecting";
        current.waitingFor = undefined;
        current.error = {
          code: "TASK_FIELDS_REQUIRED",
          message: missing.map((field) => field.label).join("、"),
        };
        emit();
        return snapshotOf(current)!;
      }
      current.status = "planned";
      current.waitingFor = undefined;
      current.error = undefined;
      if (current.mode === "agent") updatePrompt();
      emit();
      return snapshotOf(current)!;
    },
    confirm() {
      if (!run) throw new Error("No task has been started");
      const current = run;
      if (!current.definition.confirm) return snapshotOf(current)!;
      if (current.status !== "waiting" || current.waitingFor !== "confirmation") {
        throw new Error(`Task "${current.definition.id}" is not waiting for confirmation`);
      }
      current.confirmed = true;
      current.status = current.mode === "agent" ? "ready" : "planned";
      current.waitingFor = undefined;
      emit();
      return snapshotOf(current)!;
    },
    run: runSteps,
    cancel,
    reset() {
      if (run) {
        run.token += 1;
        run.controller?.abort();
      }
      run = null;
    },
    snapshot() {
      return snapshotOf(run);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
