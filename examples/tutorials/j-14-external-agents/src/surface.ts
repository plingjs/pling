import { createExecutor, createPolicy, type Confirm, type Registry } from "@plingjs/core";
import { defaultSettle } from "@plingjs/agent";
import { createSurface, type SurfaceExpose } from "@plingjs/surface";

export const EXTERNAL_SCOPE = ["todo.overview", "todo.add", "todo.clear_completed"] as const satisfies SurfaceExpose;

export function createTodoSurface(registry: Registry, confirm: Confirm, app: string) {
  const executor = createExecutor({
    registry,
    policy: createPolicy(confirm),
    settle: defaultSettle,
  });

  const surface = createSurface({
    registry,
    execute: (id, args) => executor.execute(id, args),
    app,
    expose: EXTERNAL_SCOPE,
    session: {
      agentId: "demo-external-agent",
      sessionId: "demo-session",
      userId: "demo-user",
      expiresAt: Date.now() + 60 * 60_000,
      scope: EXTERNAL_SCOPE,
    },
    recordLimit: 2,
  });

  return { executor, surface };
}
