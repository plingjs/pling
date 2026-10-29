import { ActionError } from "./errors";
import type { JsonSchema } from "./types";

/**
 * 参数的小写法 —— 让「带参数的动作」在声明里也只有几行。
 *
 * 为什么需要：原子动作（点一下、填一个值）不需要参数，但真实操作经常需要 ——
 * 「挪到第几位」「改成的数量是多少」「发给谁」。让开发者手写 JSON Schema 是另一种负担，
 * 所以给一个小写法；真要精细控制就直接写 schema（`params` 也接受 `JsonSchema`）。
 *
 * 三条约定（都是为了**少踩坑**，不是为了省字符）：
 *   1. **默认必填**：`optional: true` 才是可选。fail-closed —— 少给一个参数，
 *      宁可让模型收到一条「缺什么」的错误，也不要让它以为「没传就是默认」。
 *   2. **`label` 必填**：参数说明是模型唯一能依靠的东西（跟 `v-tool` 的 `desc` 同理）。
 *   3. **类型只做「规整 + 兜底」**：`"3"` 这种把数字写成字符串的毛病会被转成 `3`；
 *      真的转不了才报错，而且错误信息要**可行动**（模型据此自救）。
 *
 * S6b-1 起，参数还能说清「允许填什么」：静态 / 动态选项、数值范围、长度、正则。
 * 动态部分（`options` / 函数形式的 `min` / `max`）在**每次取快照与每次执行前**重新求值，
 * 所以「删掉一条订单之后，选项里就没有它了」不需要开发者手动刷新。
 */
export interface ParamChoice {
  value: string | number;
  /** 给人看的名字（模型也会看到）—— 例如订单号配上客户名 */
  label?: string;
}

/** 选项可以偷懒写成值本身 */
export type ParamOption = string | number | ParamChoice;

/** 动态边界：列表有多长、当前还剩几条，这类上限只能运行时算 */
export type ParamBound = number | (() => number);

export interface ToolParam {
  /** 参数名：模型调用时的键，也是 `run` 拿到的键 */
  name: string;
  /** 一句话说明（必填）：模型只有它可依靠 */
  label: string;
  /** 类型，默认 `string` */
  type?: "string" | "number" | "boolean";
  /** 可选（默认必填） */
  optional?: boolean;
  /** 静态封闭选择集：写了它，模型只能在这几个值里挑（也便于抓出「编了个值」） */
  values?: readonly (string | number)[];
  /** 动态封闭选择集：每次快照 / 执行前重新读（接口来的下拉项、当前列表里的订单号） */
  options?: () => readonly ParamOption[];
  /** 数字下界（函数形式用于「随当前数据变化」的下界） */
  min?: ParamBound;
  /** 数字上界 */
  max?: ParamBound;
  /** 字符串最短长度 */
  minLength?: number;
  /** 字符串最长长度 */
  maxLength?: number;
  /** 字符串格式（`/^SO-\d{4}$/` 或同样的源码字符串） */
  pattern?: RegExp | string;
  /** 语义格式：`date` 不只匹配形状，还要求是真实存在的日子（2026-13-40 会被拒） */
  format?: "date";
}

interface ResolvedChoices {
  choices: ParamChoice[];
  error?: string;
}

function choiceOf(option: ParamOption): ParamChoice {
  return typeof option === "object" ? option : { value: option };
}

function resolveChoices(param: ToolParam): ResolvedChoices {
  if (param.values && param.values.length > 0) return { choices: param.values.map((value) => ({ value })) };
  if (!param.options) return { choices: [] };
  try {
    return { choices: param.options().map(choiceOf) };
  } catch (error) {
    // 选项读不到时不能拖垮整份 schema：动作仍然可用，只是这一轮没有枚举
    return { choices: [], error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 动态选项的说明：值在 schema 的 `enum` 里，但**人的名字**只能写在 description。
 *
 * 只抄前 8 个到 description：文本清单会给每条动作乘一遍，
 * 全量抄 42 个订单号既贵又没必要（模型能读 enum）。前 8 个带上 label，
 * 足够让模型知道「SO-1001 是哪个客户」，剩下的按数量报。
 * 静态 `values` 没有 label 可写，保持老行为（说明就是 label）。
 */
function describeChoices(param: ToolParam, resolved: ResolvedChoices): string {
  if (resolved.error) return `${param.label} (option lookup failed: ${resolved.error})`;
  if (!param.options || resolved.choices.length === 0) return param.label;
  const shown = resolved.choices
    .slice(0, 8)
    .map((choice) => (choice.label ? `${choice.value} (${choice.label})` : String(choice.value)))
    .join(" / ");
  const more = resolved.choices.length > 8 ? ` … (${resolved.choices.length} total)` : "";
  return `${param.label} (${resolved.choices.length} options available: ${shown}${more})`;
}

function resolveBound(bound: ParamBound | undefined): number | undefined {
  if (bound === undefined) return undefined;
  const value = typeof bound === "function" ? bound() : bound;
  return Number.isFinite(value) ? value : undefined;
}

function patternSource(pattern: RegExp | string): string {
  return pattern instanceof RegExp ? pattern.source : pattern;
}

/** 声明式参数 → 给模型的 JSON Schema（动态部分在这里求值） */
export function toJsonSchema(params: readonly ToolParam[]): JsonSchema {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const param of params) {
    const type = param.type ?? "string";
    const choices = resolveChoices(param);
    const schema: Record<string, unknown> = {
      type,
      description: describeChoices(param, choices),
    };
    if (choices.choices.length > 0) schema.enum = choices.choices.map((choice) => choice.value);
    if (type === "number") {
      const minimum = resolveBound(param.min);
      const maximum = resolveBound(param.max);
      if (minimum !== undefined) schema.minimum = minimum;
      if (maximum !== undefined) schema.maximum = maximum;
    }
    if (type === "string") {
      if (param.minLength !== undefined) schema.minLength = param.minLength;
      if (param.maxLength !== undefined) schema.maxLength = param.maxLength;
      if (param.pattern !== undefined) schema.pattern = patternSource(param.pattern);
      if (param.format !== undefined) schema.format = param.format;
    }
    properties[param.name] = schema;
    if (!param.optional) required.push(param.name);
  }
  return { type: "object", properties, required };
}

/** 声明式参数与 JSON Schema 都接受（两条路最终走同一个校验） */
export type ParamDeclaration = readonly ToolParam[] | JsonSchema;

/** 动态参数（选项 / 函数边界）需要每次重新生成 schema */
export function hasDynamicParams(params: ParamDeclaration | undefined): boolean {
  if (!params || !Array.isArray(params)) return false;
  return params.some(
    (param) => Boolean(param.options) || typeof param.min === "function" || typeof param.max === "function",
  );
}

/** 解析成 JSON Schema（数组声明会求值；已经是 schema 就原样返回） */
export function schemaOf(params: ParamDeclaration | undefined): JsonSchema | undefined {
  if (!params) return undefined;
  return Array.isArray(params) ? toJsonSchema(params) : (params as JsonSchema);
}

function describeValue(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  return JSON.stringify(value) ?? String(value);
}

interface ParamRule {
  type?: string;
  enum?: unknown[];
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

/**
 * 按声明**校验并规整**参数（返回新对象，不原地改调用方的）。
 *
 * 只管**声明过**的参数：原语自带的键（`text` / `value` / `key`）不走这里 ——
 * 那些一直很宽松（模型给个数字也能用），收紧它们只会把原本能跑的场景弄坏。
 * 也没写声明就直接原样返回（老行为一个字都不变）。
 */
export function normalizeDeclaredArgs(
  schema: JsonSchema | undefined,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const properties = schema?.properties as Record<string, ParamRule> | undefined;
  if (!properties) return args;

  const required = new Set(schema?.required ?? []);
  const next = { ...args };

  for (const [name, rule] of Object.entries(properties)) {
    const value = next[name];
    const hint = rule.description ? ` (${rule.description})` : "";

    if (value === undefined || value === null) {
      if (required.has(name)) {
        throw new ActionError("INVALID_PARAMS", `Missing required parameter "${name}"${hint}`);
      }
      delete next[name];
      continue;
    }

    // 先规整再比枚举：`"3"` 与 `3` 是同一个值，不该因为写法不同被拒绝
    const coerced = coerce(name, rule.type ?? "string", value, hint);

    if (rule.enum && !rule.enum.includes(coerced)) {
      // 选项可能很多（上百个订单号）：列出前 8 个足够模型自救，剩下的它能在 schema 里读到
      const shown = rule.enum.slice(0, 8).join(" / ");
      const more = rule.enum.length > 8 ? ` … (${rule.enum.length} total)` : "";
      throw new ActionError(
        "INVALID_PARAMS",
        `Parameter "${name}" must be one of: ${shown}${more}; received ${describeValue(value)}`,
      );
    }

    if (typeof coerced === "number") {
      if (rule.minimum !== undefined && coerced < rule.minimum) {
        throw new ActionError(
          "INVALID_PARAMS",
          `Parameter "${name}" must be >= ${rule.minimum}${hint}; received ${describeValue(value)}`,
        );
      }
      if (rule.maximum !== undefined && coerced > rule.maximum) {
        throw new ActionError(
          "INVALID_PARAMS",
          `Parameter "${name}" must be <= ${rule.maximum}${hint}; received ${describeValue(value)}`,
        );
      }
    }

    if (typeof coerced === "string") {
      const length = [...coerced].length;
      if (rule.minLength !== undefined && length < rule.minLength) {
        throw new ActionError(
          "INVALID_PARAMS",
          `Parameter "${name}" must be at least ${rule.minLength} characters${hint}; received ${describeValue(value)} (${length} characters)`,
        );
      }
      if (rule.maxLength !== undefined && length > rule.maxLength) {
        throw new ActionError(
          "INVALID_PARAMS",
          `Parameter "${name}" must be at most ${rule.maxLength} characters${hint}; received ${describeValue(value)} (${length} characters)`,
        );
      }
      if (rule.pattern) {
        let pattern: RegExp | undefined;
        try {
          pattern = new RegExp(rule.pattern);
        } catch {
          // 声明写错正则不该让执行崩在「语法」上；schema 里仍然带着它，开发者能在开发期看到
          pattern = undefined;
        }
        if (pattern && !pattern.test(coerced)) {
          throw new ActionError(
            "INVALID_PARAMS",
            `Parameter "${name}" must match ${rule.pattern}${hint}; received ${describeValue(value)}`,
          );
        }
      }
      if (rule.format === "date" && !isRealDate(coerced)) {
        throw new ActionError(
          "INVALID_PARAMS",
          `Parameter "${name}" must be a real calendar date in YYYY-MM-DD format${hint}; received ${describeValue(value)}`,
        );
      }
    }

    next[name] = coerced;
  }

  return next;
}

/** `2026-02-30` / `2026-13-40` 这种形状对、日子不存在的输入 */
function isRealDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function coerce(name: string, type: string, value: unknown, hint: string): unknown {
  if (type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
    throw new ActionError("INVALID_PARAMS", `Parameter "${name}" must be a number${hint}; received ${describeValue(value)}`);
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new ActionError("INVALID_PARAMS", `Parameter "${name}" must be true or false${hint}; received ${describeValue(value)}`);
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  throw new ActionError("INVALID_PARAMS", `Parameter "${name}" must be a string${hint}; received ${describeValue(value)}`);
}
