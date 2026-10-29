/**
 * 记录（record）的框架无关归一化。
 *
 * 记录回答的是「这一行长什么样」，与动作回答的「这一行能做什么」互补。
 * 归一化放在 core：Vue / React / 原生适配器必须对「主键、字段、说明」有同一套解释，
 * 否则同一个页面换个适配器，模型读到的数据就变了。
 */

/**
 * 一行数据，或「数据 + 主键 / 说明 / 字段」的完整写法。
 *
 * 这里刻意用 `object` 而不是 `Record<string, unknown>`：业务代码往往给行数据声明
 * 一个普通 `interface`（没有索引签名），那也应该能直接传进来。运行时仍会检查
 * 它是不是普通对象，数组 / 函数会在开发期告警。
 */
export type RecordValue =
  | object
  | {
      /** 这一行的业务数据 */
      data: object;
      /** 业务主键（默认取 `data.id`，其次 `data.key`） */
      id?: string | number;
      /** 面向模型的一句说明 */
      label?: string;
      /** 只暴露这几个字段（默认：`data` 去掉主键那一项） */
      fields?: Record<string, unknown>;
    };

/** 归一化之后的记录（还没有作用域） */
export interface NormalizedRecord {
  id: string;
  label?: string;
  fields: Record<string, unknown>;
}

/** 没有显式写 `id` 时，按这个顺序找主键 */
export const RECORD_ID_KEYS = ["id", "key"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 从数据里认出主键（字符串 / 有限数字；空串不算） */
function pickId(data: Record<string, unknown>): { key: string; id: string } | null {
  for (const key of RECORD_ID_KEYS) {
    const raw = data[key];
    if (typeof raw === "string" && raw.trim()) return { key, id: raw.trim() };
    if (typeof raw === "number" && Number.isFinite(raw)) return { key, id: String(raw) };
  }
  return null;
}

/** 去掉主键那一项之后的所有字段 */
function fieldsOf(data: Record<string, unknown>, skipKey: string | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    if (key === skipKey) continue;
    out[key] = data[key];
  }
  return out;
}

/**
 * 把声明值归一化。**不抛异常**：声明不出来就返回 `problem`，
 * 由适配器在开发期告警 —— 一行读不出来不该把整页渲染搞崩。
 */
export function normalizeRecordValue(value: RecordValue | null | undefined): {
  record: NormalizedRecord | null;
  problem?: string;
} {
  if (!isPlainObject(value)) {
    return { record: null, problem: "记录需要一个对象（一般是列表里的那一行）" };
  }

  const isFull = "data" in value && isPlainObject(value.data);
  const data = isFull ? (value.data as Record<string, unknown>) : value;
  const declaredId = isFull ? (value as { id?: string | number }).id : undefined;
  const label = isFull ? (value as { label?: string }).label : undefined;
  const declaredFields = isFull ? (value as { fields?: Record<string, unknown> }).fields : undefined;

  const picked = pickId(data);
  const id = declaredId === undefined || declaredId === null ? picked?.id : String(declaredId).trim();
  if (!id) {
    return {
      record: null,
      problem:
        "记录没有主键：模型要靠它引用这一行。给数据加 id（或 key），或用 { data, id } 指定主键",
    };
  }

  return {
    record: {
      id,
      ...(label === undefined ? {} : { label }),
      // 显式给了 fields 就用它；否则整行数据去掉主键那一项
      fields: declaredFields ?? fieldsOf(data, picked?.key ?? null),
    },
  };
}

/** 注册签名：只有这些变了才需要重新登记（字段内容是**实时读**的，不进签名） */
export function recordSignature(record: NormalizedRecord): string {
  return JSON.stringify([record.id, record.label]);
}
