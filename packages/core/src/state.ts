/**
 * 状态暴露的「有界序列化」。
 *
 * 为什么不能直接 `JSON.stringify(read())`：状态是**页面数据**，长度不受控。
 * 一个 42 行的订单列表、一段用户输入的富文本、一个第三方 SDK 的对象，
 * 都能一秒钟把上下文顶爆（token 花在没人看的字段上），还可能带出不该给模型看的东西。
 *
 * 规则（和动作列表同一个信条：**裁剪 + 明说**）：
 *   - 深度超限 → `"…"`；
 *   - 数组超长 → 保留前 N 项，末尾补一条「…（共 X 项，此处 N 项）」；
 *   - 对象字段过多 → 保留前 N 个，补一个 `"…"` 字段说明还剩几个；
 *   - 字符串过长 → 截断 + `"…"`；
 *   - 函数 / undefined / symbol 直接丢弃（它们本来也没法给模型）；
 *   - 读不出来的（getter 抛异常）由调用方兜住，绝不能因为状态把快照搞崩。
 *
 * 裁剪掉的东西**一定**留下说明 —— 模型看不到「还有」，就会以为「就这些」。
 */

import { isSensitive, renderSensitive, type TokenVault } from "./sensitivity";

export interface SanitizeContext {
  /**
   * token 模式的保险箱（S14）。没有它时 token 退化成「已隐藏」——
   * 宁可少给模型一个代号，也不能把真值直接写进快照。
   */
  vault?: TokenVault;
}

export interface StateLimits {
  /** 最大嵌套深度，默认 3 */
  maxDepth?: number;
  /** 数组最多保留几项，默认 5 */
  maxArray?: number;
  /** 对象最多保留几个字段，默认 12 */
  maxKeys?: number;
  /** 字符串最长多少字符，默认 200 */
  maxString?: number;
}

export const DEFAULT_STATE_LIMITS: Required<StateLimits> = {
  maxDepth: 3,
  maxArray: 5,
  maxKeys: 12,
  maxString: 200,
};

export function sanitizeState(value: unknown, limits: StateLimits = {}, ctx: SanitizeContext = {}): unknown {
  const { maxDepth, maxArray, maxKeys, maxString } = { ...DEFAULT_STATE_LIMITS, ...limits };

  const clip = (text: string): string => (text.length > maxString ? `${text.slice(0, maxString)}…` : text);

  function clean(input: unknown, depth: number): unknown {
    // 敏感值优先于一切：先换掉，再谈裁剪（否则截断后的字符串会绕过脱敏）
    if (isSensitive(input)) return renderSensitive(input, ctx.vault);
    if (input === null) return null;

    switch (typeof input) {
      case "string":
        return clip(input);
      case "number":
        // NaN / Infinity 不是合法 JSON：转成字符串，别让它把序列化搞坏
        return Number.isFinite(input) ? input : String(input);
      case "boolean":
        return input;
      case "bigint":
        return String(input);
      case "undefined":
      case "function":
      case "symbol":
        return undefined;
      default:
        break;
    }

    if (depth >= maxDepth) return "…";

    if (input instanceof Map) return clean([...input.entries()], depth);
    if (input instanceof Set) return clean([...input.values()], depth);

    if (Array.isArray(input)) {
      const shown = input.slice(0, maxArray).map((item) => clean(item, depth + 1));
      if (input.length > maxArray) shown.push(`… (${input.length} items total; showing ${maxArray})`);
      return shown.filter((item) => item !== undefined);
    }

    const source = input as Record<string, unknown>;
    // Date 之类的对象：有自己的 toJSON 就尊重它（否则会被当成空对象）
    if (typeof source.toJSON === "function") {
      try {
        return clean(source.toJSON(), depth + 1);
      } catch {
        return undefined;
      }
    }

    const out: Record<string, unknown> = {};
    const keys = Object.keys(source);
    let taken = 0;
    let skipped = 0;
    for (let index = 0; index < keys.length; index += 1) {
      // 只有「因为上限没显示」的才算未显示；值为函数 / undefined 的被丢弃不算
      if (taken >= maxKeys) {
        skipped = keys.length - index;
        break;
      }
      const key = keys[index]!;
      const cleaned = clean(source[key], depth + 1);
      if (cleaned === undefined) continue;
      out[key] = cleaned;
      taken += 1;
    }
    if (skipped > 0) out["…"] = `${skipped} more fields not shown`;
    return out;
  }

  return clean(value, 0);
}
