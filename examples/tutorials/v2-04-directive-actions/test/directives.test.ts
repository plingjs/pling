import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { mountDirectiveApp, type DirectiveApp } from "../src/app";

let host: HTMLDivElement;
let app: DirectiveApp | null = null;

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

function setup(): DirectiveApp {
  app = mountDirectiveApp(host, {
    presence: false,
    onWarn: () => {},
    agent: { llm: createReplayLlm([]) },
  });
  app.pling.setActiveScopes(["todo"]);
  return app;
}

describe("V2-04 · directive-based actions", () => {
  it("declares actions, scopes, and records through directives", () => {
    const mounted = setup();
    const snapshot = mounted.pling.registry.snapshot();

    expect(snapshot.scopes.map((scope) => scope.id)).toEqual(expect.arrayContaining(["todo", "todo_list"]));
    expect(snapshot.records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);
    expect(snapshot.actions.map((action) => action.id)).toEqual(expect.arrayContaining([
      "composer_text",
      "toggle@t1",
      "remove@t3",
    ]));
    expect(snapshot.actions.find((action) => action.id === "remove@t3")?.kind).toBe("danger");
  });

  it("uses the browser's original click handler", async () => {
    const mounted = setup();
    const executor = createExecutor({
      registry: mounted.pling.registry,
      policy: createPolicy(async () => true),
    });

    await expect(executor.execute("toggle@t2", "{}")).resolves.toMatchObject({ result: { ok: true } });
    expect(mounted.tasks.find((task) => task.id === "t2")?.done).toBe(true);
    expect(host.querySelectorAll(".task")[1]?.classList.contains("is-done")).toBe(true);
  });

  it("fills the input and submits through the same form a person uses", async () => {
    const mounted = setup();
    const executor = createExecutor({
      registry: mounted.pling.registry,
      policy: createPolicy(async () => true),
    });

    await executor.execute("composer_text", JSON.stringify({ text: "Prepare the agenda" }));
    expect(host.querySelector<HTMLInputElement>("#new-task")?.value).toBe("Prepare the agenda");
    await expect(executor.execute("composer_submit", "{}")).resolves.toMatchObject({ result: { ok: true } });

    expect(mounted.tasks[0]).toMatchObject({ text: "Prepare the agenda", done: false });
    expect(host.querySelectorAll(".task")).toHaveLength(4);
  });

  it("removes a row and unregisters its record and actions", async () => {
    const mounted = setup();
    const executor = createExecutor({
      registry: mounted.pling.registry,
      policy: createPolicy(async () => true),
    });

    await expect(executor.execute("remove@t1", "{}")).resolves.toMatchObject({ result: { ok: true } });
    expect(mounted.tasks.map((task) => task.id)).not.toContain("t1");
    expect(mounted.pling.registry.snapshot().records.map((record) => record.id)).not.toContain("t1");
    expect(mounted.pling.registry.get("toggle@t1")).toBeUndefined();
  });
});
