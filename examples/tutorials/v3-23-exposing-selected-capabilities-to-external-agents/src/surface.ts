import { createExecutor, createPolicy, type Confirm, type Registry } from "@plingjs/core";
import { defaultSettle } from "@plingjs/agent";
import { createSurface, type SurfaceExpose } from "@plingjs/surface";

export const EXTERNAL_SCOPE = ["todo.overview", "todo.add", "todo.clear_completed"] as const satisfies SurfaceExpose;

export function createTodoSurface(
  registry: Registry,
  confirm: Confirm,
  sessionScope: SurfaceExpose = EXTERNAL_SCOPE,
) {
  const executor = createExecutor({
    registry,
    policy: createPolicy(confirm),
    settle: defaultSettle,
  });

  const surface = createSurface({
    registry,
    execute: (id, args) => executor.execute(id, args),
    app: "tutorial-todo-surface",
    expose: EXTERNAL_SCOPE,
    session: {
      agentId: "demo-external-agent",
      sessionId: "demo-session",
      userId: "demo-user",
      expiresAt: Date.now() + 60 * 60_000,
      scope: sessionScope,
    },
    recordLimit: 2,
  });

  return { executor, surface };
}
