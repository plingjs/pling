import { getCurrentInstance, isRef, onBeforeUnmount, unref } from "vue";
import { usePling } from "./context";

export interface AgentStateOptions {
  /** 面向模型的说明：这组状态是什么。 */
  description?: string;
}

export type StateSource = (() => unknown) | { value: unknown } | Record<string, unknown>;
type AnyRecord = Record<string, unknown>;
export type AgentStoreRead<S extends object> = readonly (keyof S & string)[] | ((store: S) => unknown);

function readSource(source: StateSource): unknown {
  if (typeof source === "function") return (source as () => unknown)();
  if (isRef(source)) return unref(source);
  return source;
}

function readStoreField(store: AnyRecord, field: string, key: string): unknown {
  const vuexState = store.state;
  if (vuexState && typeof vuexState === "object" && field in (vuexState as AnyRecord)) {
    return (vuexState as AnyRecord)[field];
  }
  const vuexGetters = store.getters;
  if (vuexGetters && typeof vuexGetters === "object" && field in (vuexGetters as AnyRecord)) {
    return (vuexGetters as AnyRecord)[field];
  }
  if (field in store) return store[field];
  throw new Error(
    `pling: useAgentStoreState("${key}") 找不到字段 "${field}"。` +
      "Pinia 请从 state / getter 里挑；Vuex 请从 state / getters 里挑；需要换算或嵌套取值时改用 selector。",
  );
}

/** 暴露只读状态视图；组件销毁时自动注销。 */
export function useAgentState(
  key: string,
  source: StateSource,
  options: AgentStateOptions | string = {},
): () => void {
  const pling = usePling();
  const off = pling.state(key, () => readSource(source), options);
  if (getCurrentInstance()) onBeforeUnmount(off);
  return off;
}

/** 从 Pinia / Vuex 兼容 store 中显式挑字段，仍然不倾倒整个 store。 */
export function useAgentStoreState<S extends object>(
  key: string,
  store: S,
  read: AgentStoreRead<S>,
  options: AgentStateOptions | string = {},
): () => void {
  const source = (): unknown => {
    if (typeof read === "function") return read(store);
    const view: Record<string, unknown> = {};
    for (const field of read) view[field] = readStoreField(store as AnyRecord, field, key);
    return view;
  };
  if (typeof read !== "function") source();
  return useAgentState(key, source, options);
}
