import { useEffect, useLayoutEffect, useRef } from "react";
import type { Registry } from "@plingjs/core";
import { usePling, type PlingElement } from "./context";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * 只读状态视图：让模型看到「页面此刻是什么样」，而不只是「能点什么」。
 *
 * 为什么需要它：
 *   - 模型看不到搜索框 / 筛选器的当前值，就会一路往「更小」找，把列表筛成 0 行，
 *     目标动作根本没注册，最后只能报 `ACTION_NOT_FOUND`；
 *   - 回答「现在还剩几条待办」这类问题，只靠动作清单只能猜。
 *
 * 设计取向 —— **只暴露视图，不倾倒 store**：
 *   不要把整个 Redux / Zustand / Jotai store 交出来。挑对 agent 有意义的那几个值，
 *   取个好名字，写一句说明。写入一律走 `usePlingTool` / `useAgentTool`，
 *   这样才会经过权限与确认闸门。
 */
export interface PlingStateOptions {
  /** 面向模型的说明：这组状态是什么（强烈建议写）。 */
  description?: string;
}

/** 直接给值，或给一个每次快照都重新求值的读取函数（推荐后者）。 */
export type PlingStateSource = unknown | (() => unknown);

function readSource(source: PlingStateSource): unknown {
  return typeof source === "function" ? (source as () => unknown)() : source;
}

function exposeState(
  registry: Registry,
  key: string,
  read: () => unknown,
  description: string | undefined,
): () => void {
  return registry.expose({
    key,
    ...(description === undefined ? {} : { description }),
    read,
  });
}

/**
 * 把一组状态登记给 agent；随组件卸载自动注销。
 *
 * ```tsx
 * const [todos, setTodos] = useState<Todo[]>([]);
 * const [filter, setFilter] = useState("all");
 *
 * usePlingState("todo", () => ({
 *   filter,
 *   total: todos.length,
 *   remaining: todos.filter((todo) => !todo.done).length,
 * }), { description: "待办当前的筛选与计数" });
 * ```
 *
 * 读取函数每次快照都会重新执行，所以勾选 / 改名 / 筛选之后不需要重新注册。
 * 只允许**读**：要改状态，请用 `usePlingTool` / `useAgentTool` 声明动作。
 */
export function usePlingState(
  key: string,
  source: PlingStateSource,
  options: PlingStateOptions | string = {},
): () => void {
  const pling = usePling();
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const description = typeof options === "string" ? options : options.description;
  const offRef = useRef<(() => void) | null>(null);

  useIsomorphicLayoutEffect(() => {
    const off = exposeState(pling.registry, key, () => readSource(sourceRef.current), description);
    offRef.current = off;
    return () => {
      off();
      if (offRef.current === off) offRef.current = null;
    };
  }, [pling, key, description]);

  return () => {
    offRef.current?.();
    offRef.current = null;
  };
}

/**
 * 组件树之外（`main.tsx`）登记状态视图：老项目升级时，业务组件一行不改。
 *
 * ```ts
 * const pling = createPling();
 * exposePlingState(pling, "filters", () => ({
 *   status: store.getState().status,
 *   count: store.getState().visible.length,
 * }), { description: "列表当前的筛选与条数" });
 * ```
 *
 * 与 `usePlingState` 一样是只读的；返回注销函数，应用级声明通常活到页面结束。
 * 同 key 重复登记会抛 `DUPLICATE_STATE_KEY`，避免后注册者悄悄覆盖前一个视图。
 */
export function exposePlingState(
  pling: Pick<PlingElement, "registry">,
  key: string,
  source: PlingStateSource,
  options: PlingStateOptions | string = {},
): () => void {
  const description = typeof options === "string" ? options : options.description;
  return exposeState(pling.registry, key, () => readSource(source), description);
}
