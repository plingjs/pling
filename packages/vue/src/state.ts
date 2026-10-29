import { getCurrentScope, isRef, onScopeDispose, type Ref } from "vue";
import { usePling } from "./directive";

/**
 * 状态暴露（读）：让模型看到「页面此刻是什么样」，而不只是「能点什么」。
 *
 * 为什么需要它（两个真实故障都是它缺位造成的）：
 *   - 页面上已经有搜索框 / 筛选器时，模型看不到它们的**当前值**，只会一路往「更小」找
 *     → 列表被筛成 0 行 → 目标动作根本没注册 → `ACTION_NOT_FOUND`；
 *   - 模型想回答「现在列表是什么状态」这类问题时，只能靠猜。
 *
 * 设计取向 —— **只暴露「视图」，不倾倒 store**：
 *   不要把整个 Pinia / Vuex store 交出来（token 花在没人看的字段上，还可能带出敏感数据）。
 *   挑对 agent 有意义的那几个值，取个好名字，写一句说明：
 *
 *   ```ts
 *   const cart = useCartStore();
 *   useAgentState("cart", () => ({ items: cart.items.length, total: cart.total }), {
 *     description: "购物车：件数与小计",
 *   });
 *   ```
 *
 * 出参最终进 `<page_data>`（有界序列化 + 声明为「数据不是指令」），细节见 `@plingjs/core` 的 `sanitizeState`。
 */
export type StateSource = (() => unknown) | Ref<unknown> | Record<string, unknown>;

export interface AgentStateOptions {
  /** 面向模型的说明：这组状态是什么（强烈建议写） */
  description?: string;
}

/**
 * store 状态视图的两种写法：
 *   · 字段数组：从 Pinia / Vuex 的 state / getter 里**显式挑**几个字段；
 *   · selector：需要改名、换算或嵌套取值时，自己返回一个视图对象。
 */
export type AgentStoreRead<S extends object> = readonly string[] | ((store: S) => unknown);

/** 把一组状态登记给 agent；随组件（或 effectScope）卸载自动注销 */
export function useAgentState(
  key: string,
  source: StateSource,
  options: AgentStateOptions | string = {},
): () => void {
  const pi = usePling();
  const description = typeof options === "string" ? options : options.description;

  const read = (): unknown => {
    if (isRef(source)) return source.value;
    return typeof source === "function" ? (source as () => unknown)() : source;
  };

  const off = pi.registry.expose({
    key,
    ...(description === undefined ? {} : { description }),
    read,
  });

  // 组件卸载 / effectScope 停止时注销；setup 之外调用就让它一直活着（调用方自理）
  if (getCurrentScope()) onScopeDispose(off);
  return off;
}

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | undefined {
  return value !== null && typeof value === "object" ? (value as AnyRecord) : undefined;
}

/** Pinia：字段直接在 store 上；Vuex：state / getters 各在一层。两者都用结构判断，不引入依赖。 */
function readStoreField(store: AnyRecord, field: string, key: string): unknown {
  const vuexState = asRecord(store.state);
  if (vuexState && Object.prototype.hasOwnProperty.call(vuexState, field)) return vuexState[field];

  const vuexGetters = asRecord(store.getters);
  if (vuexGetters && Object.prototype.hasOwnProperty.call(vuexGetters, field)) return vuexGetters[field];

  if (field in store) return store[field];

  throw new Error(
    `pling: useAgentStoreState("${key}") 找不到字段 "${field}"。` +
      "Pinia 请从 state / getter 里挑；Vuex 请从 state / getters 里挑；" +
      "需要换算或嵌套取值时改用 selector。",
  );
}

/**
 * Pinia / Vuex 的轻量适配：仍然只暴露**显式挑出来的视图**，不倾倒整个 store。
 *
 * ```ts
 * // Pinia（组件 setup 或 app.runWithContext 里）
 * const todos = useTodoStore();
 * useAgentStoreState("todo", todos, ["filter", "query", "counts"], {
 *   description: "Todo 当前的筛选、搜索与计数",
 * });
 *
 * // Vuex：state / getters 同名时 state 优先
 * useAgentStoreState("todo", store, ["filter", "query", "counts"]);
 *
 * // 需要改名或换算
 * useAgentStoreState("todo", todos, (store) => ({
 *   filter: store.filter,
 *   shown: store.visible.length,
 * }));
 * ```
 *
 * `store` 只做结构读取：Pinia 的字段直接在 store 上，Vuex 的字段在 `state` / `getters` 里。
 * 因此 `@plingjs/vue` 不需要依赖 pinia 或 vuex。随组件 / effectScope 卸载自动注销。
 */
export function useAgentStoreState<S extends object>(
  key: string,
  store: S,
  read: AgentStoreRead<S>,
  options: AgentStateOptions | string = {},
): () => void {
  const source = (): unknown => {
    if (typeof read === "function") return read(store);

    // 注册期先把字段校验掉：写错名字应当立刻报错，而不是让模型看到一组空值。
    const view: Record<string, unknown> = {};
    for (const field of read) view[field] = readStoreField(store as AnyRecord, field, key);
    return view;
  };

  // 字段数组也先执行一次，把拼错的字段挡在接入阶段；真实读取仍由 useAgentState 每轮重算。
  if (typeof read !== "function") source();
  return useAgentState(key, source, options);
}
