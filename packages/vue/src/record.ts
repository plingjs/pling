/**
 * `v-record`：把 `v-for` 的**一行**登记成「记录」（读得到的一等公民）。
 *
 * 两种写法（`PERCEPTION-01` §5 的 L1 / L2 思路，但**只有声明式，没有 DOM 兜底**）：
 *
 * ```vue
 * <!-- 傻瓜式：给这一行数据，id 取 data.id（或 data.key），其余字段就是可读字段 -->
 * <tr v-for="order in orders" :key="order.id" v-record="order">
 *
 * <!-- 灵活：主键不叫 id、只想暴露几个字段、或者要给模型一句说明 -->
 * <tr v-record="{ data: order, id: order.code, label: `订单 ${order.code}`,
 *                 fields: { 客户: order.customer, 金额: order.amount } }">
 * ```
 *
 * 为什么不做「自动从 DOM 文本里猜字段」（PERCEPTION-01 §6 分叉 1）：
 * 那是**读数据**，猜错了没有报错、只有幻觉（金额读成「¥3,200.00」、备注和状态串行），
 * 还可能把不该给模型看的东西读出去。动作不兜底是原则，数据更不该兜底。
 * 需要「零改动也能读」的场景，走 S2b：从行内动作的 id 形状里认出行的 **id**（不含字段）。
 */
import {
  normalizeRecordValue,
  recordSignature,
  RECORD_ID_KEYS,
  type NormalizedRecord,
  type RecordDeclaration,
  type RecordValue,
} from "@plingjs/core";
import { unref } from "vue";

export { RECORD_ID_KEYS, normalizeRecordValue, recordSignature, type NormalizedRecord, type RecordValue };

/**
 * 字段**实时读**：快照组装时才把值取出来。
 *
 * 两个理由：
 *   1. 一行的数据会变（勾选、改备注），登记一次就够了 —— 不必每渲染一次就注销重登记；
 *   2. Vue 的 `ref` 套在**普通对象**里不会被自动解包（只有顶层才会），直接读会把
 *      `{ __v_isRef: true, … }` 这种内部结构喂给模型 —— 这里顺手解掉。
 */
function liveFields(fields: Record<string, unknown>): () => Record<string, unknown> {
  return () => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(fields)) out[key] = unref(fields[key]);
    return out;
  };
}

/** 供适配器直接登记：把归一化结果补上动态作用域解析与实时字段读取 */
export function toDeclaration(
  record: NormalizedRecord,
  resolveScope: () => string | undefined,
  order?: () => number | undefined,
): RecordDeclaration {
  return {
    id: record.id,
    ...(record.label === undefined ? {} : { label: record.label }),
    fields: liveFields(record.fields),
    resolveScope,
    ...(order === undefined ? {} : { order }),
  };
}

/** 同一行、数据变了：只换字段读取，不动登记 */
export function rewireFields(declaration: RecordDeclaration, fields: Record<string, unknown>): void {
  declaration.fields = liveFields(fields);
}
