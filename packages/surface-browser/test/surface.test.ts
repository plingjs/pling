import { createRegistry } from "@plingjs/core";
import { SURFACE_PROTOCOL } from "@plingjs/surface";
import { describe, expect, it, vi } from "vitest";
import { createPlingSurface } from "../src";

function registryWithActions() {
  const registry = createRegistry();
  const add = vi.fn(async () => {});
  const remove = vi.fn(async () => {});
  for (const [id, kind, run] of [
    ["todo.add", "write", add],
    ["todo.delete", "danger", remove],
  ] as const) {
    registry.bind({
      descriptor: { id, primitive: "click", description: id, kind },
      isAvailable: () => true,
      run,
    });
  }
  return { registry, add, remove };
}

describe("createPlingSurface", () => {
  it("projects only the explicit allowlist and executes through the registry", async () => {
    const { registry, add } = registryWithActions();
    const { surface } = createPlingSurface(registry, {
      app: "todo",
      expose: ["todo.add"],
      confirm: async () => true,
      session: {
        agentId: "codex",
        sessionId: "as_1",
        userId: "u_1",
        expiresAt: Date.now() + 60_000,
        scope: ["todo.add"],
      },
    });

    expect(surface.describe().capabilities.map((capability) => capability.id)).toEqual(["todo.add"]);
    const result = await surface.handle({
      protocol: SURFACE_PROTOCOL,
      id: "r1",
      method: "invoke",
      capability: "todo.add",
    });
    expect(result).toMatchObject({ ok: true, id: "r1" });
    expect(add).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a destructive action has no confirmation channel", async () => {
    const { registry, remove } = registryWithActions();
    const { surface } = createPlingSurface(registry, {
      app: "todo",
      expose: ["todo.delete"],
      session: {
        agentId: "codex",
        sessionId: "as_1",
        userId: "u_1",
        expiresAt: Date.now() + 60_000,
        scope: ["todo.delete"],
      },
    });

    const result = await surface.handle({
      protocol: SURFACE_PROTOCOL,
      id: "r1",
      method: "invoke",
      capability: "todo.delete",
    });
    expect(result).toMatchObject({ ok: true, result: { error: { code: "PERMISSION_DENIED" } } });
    expect(remove).not.toHaveBeenCalled();
  });
});
