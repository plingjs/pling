import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
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

function setup(turns: Parameters<typeof createReplayLlm>[0] = []): QuickstartApp {
  const llm = createReplayLlm(turns);
  app = mountQuickstart(host, {
    presence: false,
    onWarn: () => {},
    agent: {
      llm,
      trace: { maxCalls: 8 },
      config: { limits: { maxTurns: 100 } },
    },
  });
  app.pling.setActiveScopes(["todo"]);
  return app;
}

describe("J-12 · testing and debugging vanilla capabilities", () => {
  it("asserts the declaration boundary without relying on model prose", () => {
    const mounted = setup();
    const snapshot = mounted.pling.registry.snapshot();

    expect(snapshot.scopes.find((scope) => scope.id === "todo")).toMatchObject({ role: "main" });
    expect(snapshot.records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);
    expect(snapshot.actions.map((action) => action.id)).toContain("composer_text");
    expect(snapshot.actions.map((action) => action.id)).not.toContain("composer_submit");
  });

  it("executes the same visible controls and checks the business result", async () => {
    const mounted = setup();
    const executor = createExecutor({
      registry: mounted.pling.registry,
      policy: createPolicy(async () => true),
    });

    await executor.execute("composer_text", JSON.stringify({ text: "Write the regression note" }));
    await expect(executor.execute("composer_submit", "{}")).resolves.toMatchObject({
      result: { ok: true },
    });

    expect(mounted.tasks[0]).toMatchObject({ text: "Write the regression note", done: false });
    expect(host.querySelectorAll(".task")).toHaveLength(4);
  });

  it("replays a multi-step agent turn and keeps the trace inspectable", async () => {
    const mounted = setup([
      { calls: [{ tool: "composer_text", args: { text: "Verify the trace" } }] },
      { calls: [{ tool: "composer_submit" }] },
      { content: "The task was added." },
    ]);

    await mounted.dock.runtime.session.send("Add a task named Verify the trace");

    expect(mounted.tasks[0]).toMatchObject({ text: "Verify the trace", done: false });
    const trace = mounted.dock.runtime.trace;
    expect(trace).not.toBeNull();
    expect(trace!.calls).toHaveLength(3);
    expect(trace!.calls[0]!.messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(trace!.calls[0]!.tools.map((tool) => tool.function.name)).toContain("composer_text");
    expect(trace!.calls[1]!.tools.map((tool) => tool.function.name)).toContain("composer_submit");
    expect(trace!.calls[2]!.response).toMatchObject({ content: "The task was added." });
  });

  it("records a failed model request instead of hiding it behind a generic chat error", async () => {
    app = mountQuickstart(host, {
      presence: false,
      onWarn: () => {},
      agent: {
        llm: async () => {
          throw new Error("gateway offline");
        },
        trace: true,
        config: { limits: { maxTurns: 100 } },
      },
    });

    await app.dock.runtime.session.send("Hello");

    expect(app.dock.runtime.trace?.calls[0]).toMatchObject({
      turn: 1,
      status: "error",
      error: { code: "LLM_FAILED", message: "gateway offline" },
    });
  });
});
