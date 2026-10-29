import { ActionError } from "./errors";
import type { JsonSchema, Primitive } from "./types";

/** 每个原语的参数形状（喂给模型）。绑定的 params 可在此基础上补充。 */
export const PRIMITIVE_PARAMS: Record<Primitive, JsonSchema> = {
  click: { type: "object", properties: {}, required: [] },
  type: {
    type: "object",
    properties: { text: { type: "string", description: "Text to enter" } },
    required: ["text"],
  },
  select: {
    type: "object",
    properties: { value: { type: "string", description: "Option value to select" } },
    required: ["value"],
  },
  scroll: {
    type: "object",
    properties: {
      to: {
        type: "string",
        enum: ["top", "bottom", "element"],
        description: "Scroll target; defaults to element (scroll the element into view)",
      },
    },
    required: [],
  },
  navigate: { type: "object", properties: {}, required: [] },
  // 复合动作的参数**全部**来自声明（`params`）：它的步骤参数由声明里的占位符决定，
  // 框架不替它猜任何必填键。
  flow: { type: "object", properties: {}, required: [] },
  press: {
    type: "object",
    properties: { key: { type: "string", description: "Key name, such as Enter / Escape / Tab" } },
    required: ["key"],
  },
  // hover 没有参数：它表达的是「把指针移到这个元素上」。
  // 菜单要不要因此打开，是页面的逻辑；框架只负责把浏览器事件送到。
  hover: { type: "object", properties: {}, required: [] },
  // 函数级动作：参数全部来自声明（`params`），原语不附加任何形状。
  call: { type: "object", properties: {}, required: [] },
};

/** 合并原语基础形状 + 绑定额外约束 */
export function mergeParams(primitive: Primitive, extra?: JsonSchema): JsonSchema {
  const base = PRIMITIVE_PARAMS[primitive];
  if (!extra) return base;
  return {
    type: "object",
    properties: { ...base.properties, ...extra.properties },
    required: [...new Set([...(base.required ?? []), ...(extra.required ?? [])])],
  };
}

/** 按原语 schema 做最小校验（缺必填参数 → INVALID_PARAMS） */
export function validateArgs(primitive: Primitive, args: Record<string, unknown>): void {
  const schema = PRIMITIVE_PARAMS[primitive];
  for (const key of schema.required ?? []) {
    if (args[key] === undefined) {
      throw new ActionError("INVALID_PARAMS", `Missing required parameter: ${key}`);
    }
  }
}
