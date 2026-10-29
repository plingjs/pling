import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { SURFACE_PROTOCOL, type SurfaceResponse } from "@plingjs/surface";
import { mountQuickstart, type QuickstartApp } from "../src/app";

let host: HTMLDivElement;
let app: QuickstartApp | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  app?.destroy();
  app = null;
  host.remove();
  document.body.innerHTML = "";
});

function setup(): QuickstartApp {
  app = mountQuickstart(host, {
    presence: false,
    onWarn: () => {},
    agent: { llm: createReplayLlm([]), config: { limits: { maxTurns: 100 } } },
  });
  app.pling.setActiveScopes(["todo"]);
  return app;
}

function request(method: "describe" | "invoke", extra: Record<string, unknown> = {}) {
  return { protocol: SURFACE_PROTOCOL, id: `test-${method}-${Math.random()}`, method, ...extra };
}

function responseError(response: SurfaceResponse): string | undefined {
  if (!response.ok) return response.error.code;
  if ("error" in response.result) return response.result.error.code;
  return undefined;
}

async function waitFor(read: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (read()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for the expected page state");
}

describe("J-14 · external capability surface", () => {
  it("publishes only three capabilities and a bounded record window", async () => {
    const mounted = setup();
    const response = await mounted.surface.handle(request("describe", { input: { limit: 2 } }));
    if (!response.ok || !("context" in response.result)) {
      throw new Error(response.ok ? "describe returned a non-description result" : response.error.message);
    }

    expect(response.result.protocol).toBe(SURFACE_PROTOCOL);
    expect(response.result.capabilities.map((capability) => capability.id)).toEqual([
      "todo.overview",
      "todo.add",
      "todo.clear_completed",
    ]);
    expect(response.result.context.records.map((record) => record.id)).toEqual(["t1", "t2"]);
    expect(response.result.context.recordWindow).toMatchObject({ offset: 0, limit: 2, returned: 2, next: 2 });
  });

  it("adds a task through the same executor and visible DOM handler", async () => {
    const mounted = setup();
    const response = await mounted.surface.handle(request("invoke", {
      capability: "todo.add",
      input: { text: "Confirm the deployment window" },
    }));

    expect(response).toMatchObject({ ok: true, result: { result: { ok: true } } });
    expect(mounted.tasks[0]).toMatchObject({ text: "Confirm the deployment window", done: false });
    expect(host.querySelector(".task__text")?.textContent).toBe("Confirm the deployment window");
  });

  it("fails closed before the executor when a page action is not exposed", async () => {
    const mounted = setup();
    const response = await mounted.surface.handle(request("invoke", {
      capability: "toggle@t1",
      input: {},
    }));

    expect(responseError(response)).toBe("CAPABILITY_NOT_EXPOSED");
    expect(mounted.tasks[0]?.done).toBe(false);
  });

  it("keeps destructive approval on the page and preserves the queue when denied", async () => {
    const mounted = setup();
    const pending = mounted.surface.handle(request("invoke", { capability: "todo.clear_completed" }));
    await waitFor(() => !host.querySelector<HTMLElement>("[data-approval]")!.hidden);

    host.querySelector<HTMLButtonElement>("[data-deny]")!.click();
    const denied = await pending;

    expect(responseError(denied)).toBe("PERMISSION_DENIED");
    expect(mounted.tasks.map((task) => task.id)).toEqual(["t1", "t2", "t3"]);
    expect(host.querySelectorAll(".task")).toHaveLength(3);
  });

  it("removes completed tasks only after the page approves", async () => {
    const mounted = setup();
    const pending = mounted.surface.handle(request("invoke", { capability: "todo.clear_completed" }));
    await waitFor(() => !host.querySelector<HTMLElement>("[data-approval]")!.hidden);

    host.querySelector<HTMLButtonElement>("[data-approve]")!.click();
    await expect(pending).resolves.toMatchObject({ ok: true, result: { result: { ok: true } } });

    expect(mounted.tasks.map((task) => task.id)).toEqual(["t1", "t2"]);
    expect(host.querySelectorAll(".task")).toHaveLength(2);
    expect(mounted.pling.registry.get("toggle@t3")).toBeUndefined();
  });
});
