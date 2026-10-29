import type { Registry } from "@plingjs/core";
import type { StateOptions, StateSource } from "./types";

function readSource(source: StateSource): unknown {
  return typeof source === "function" ? (source as () => unknown)() : source;
}

/** 暴露只读状态视图；读取函数每次快照重新执行。 */
export function exposeState(
  registry: Registry,
  key: string,
  source: StateSource,
  options: StateOptions | string = {},
): () => void {
  const description = typeof options === "string" ? options : options.description;
  return registry.expose({
    key,
    ...(description === undefined ? {} : { description }),
    read: () => readSource(source),
  });
}
