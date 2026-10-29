import { createExecutor, createPolicy, type Confirm, type Executor, type Registry } from "@plingjs/core";
import { defaultSettle } from "@plingjs/agent";
import { createSurface, type AgentSurface, type SurfaceOptions } from "@plingjs/surface";

export interface CreatePlingSurfaceOptions extends Omit<SurfaceOptions, "registry" | "execute"> {
  /** Human confirmation channel for destructive or explicitly gated actions. */
  confirm?: Confirm | null;
  /** Wait for the page to settle before taking the after-snapshot. */
  settle?: () => Promise<void>;
}

export interface PlingSurfaceRuntime {
  surface: AgentSurface;
  executor: Executor;
}

/**
 * Build the standard page-side Runtime: existing registry + existing policy +
 * the Surface protocol projection. The caller still supplies an explicit
 * `expose` allowlist when opening the page to an external Agent.
 */
export function createPlingSurface(
  registry: Registry,
  options: CreatePlingSurfaceOptions,
): PlingSurfaceRuntime {
  const { confirm = null, settle = defaultSettle, ...surfaceOptions } = options;
  const executor = createExecutor({
    registry,
    policy: createPolicy(confirm),
    settle,
  });
  const surface = createSurface({
    registry,
    execute: (id, args) => executor.execute(id, args),
    ...surfaceOptions,
  });
  return { surface, executor };
}
