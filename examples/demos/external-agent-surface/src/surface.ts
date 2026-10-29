import { createExecutor, createPolicy, type Confirm, type Registry } from "@plingjs/core";
import { defaultSettle } from "@plingjs/agent";
import { createSurface, type SurfaceExpose } from "@plingjs/surface";

export const EXTERNAL_SCOPE = [
  "todo.overview",
  "todo.add",
  "todo.update",
  "todo.toggle",
  "todo.delete",
  "todo.clear_completed",
] as const satisfies SurfaceExpose;

export function createTodoSurface(registry: Registry, confirm: Confirm) {
  const executor = createExecutor({
    registry,
    policy: createPolicy(confirm),
    settle: defaultSettle,
  });

  const surface = createSurface({
    registry,
    execute: (id, args) => executor.execute(id, args),
    app: "example-todo-external-surface",
    expose: EXTERNAL_SCOPE,
    session: {
      agentId: "demo-external-agent",
      sessionId: "demo-session",
      userId: "demo-user",
      expiresAt: Date.now() + 60 * 60_000,
      scope: EXTERNAL_SCOPE,
    },
    recordLimit: 8,
  });

  return { executor, surface };
}
