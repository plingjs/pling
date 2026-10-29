import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { mountAssistantDock, type AssistantDockApp } from "../src/app";

let host: HTMLDivElement;
let app: AssistantDockApp | null = null;

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

function setup(): AssistantDockApp {
  app = mountAssistantDock(host, {
    presence: false,
    onWarn: () => {},
    agent: { llm: createReplayLlm([]) },
  });
  app.pling.setActiveScopes(["todo", "todo_list"]);
  return app;
}

describe("V2-06 · the shared assistant dock", () => {
  it("declares the intended region, records, and controls", () => {
    const mounted = setup();
    const snapshot = mounted.pling.registry.snapshot();

    expect(snapshot.scopes.find((scope) => scope.id === "todo")).toMatchObject({
      label: "Tasks",
      role: "main",
    });
    expect(snapshot.records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);
    expect(snapshot.actions.map((action) => action.id)).toEqual(expect.arrayContaining([
      "composer_text",
      "toggle@t1",
      "toggle@t2",
      "toggle@t3",
    ]));
    expect(snapshot.actions.map((action) => action.id)).not.toContain("composer_submit");
  });

  it("adds a task through the existing input and submit handler", async () => {
    const mounted = setup();
    const executor = createExecutor({ registry: mounted.pling.registry, policy: createPolicy(async () => true) });

    await expect(executor.execute("composer_text", JSON.stringify({ text: "Write the weekly report" })))
      .resolves.toMatchObject({ result: { ok: true } });
    expect(host.querySelector<HTMLInputElement>("#new-task")?.value).toBe("Write the weekly report");
    expect(mounted.pling.registry.snapshot().actions.map((action) => action.id)).toContain("composer_submit");

    await expect(executor.execute("composer_submit", "{}")).resolves.toMatchObject({ result: { ok: true } });
    await mounted.vm.$nextTick();
    expect(Array.from(host.querySelectorAll(".task__text")).map((node) => node.textContent)).toContain("Write the weekly report");
    expect(host.querySelectorAll(".task")).toHaveLength(4);
  });

  it("toggles a record and keeps the directive binding current", async () => {
    const mounted = setup();
    const executor = createExecutor({ registry: mounted.pling.registry, policy: createPolicy(async () => true) });

    await expect(executor.execute("toggle@t2", "{}")).resolves.toMatchObject({ result: { ok: true } });
    await mounted.vm.$nextTick();
    expect(host.querySelectorAll(".task")[1]?.classList.contains("is-done")).toBe(true);
    expect(mounted.pling.registry.snapshot().records.find((record) => record.id === "t2")?.fields.done).toBe(true);
  });

  it("mounts one open dock and closes it with the controller", () => {
    const mounted = setup();

    expect(mounted.dock?.isOpen()).toBe(true);
    expect(document.querySelectorAll(".pling-dock__launcher")).toHaveLength(1);
    mounted.dock?.close();
    expect(mounted.dock?.isOpen()).toBe(false);
    expect((mounted.vm as unknown as { assistantOpen: boolean }).assistantOpen).toBe(false);
  });
});
