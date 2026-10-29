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

function setup(): QuickstartApp {
  app = mountQuickstart(host, {
    presence: false,
    onWarn: () => {},
    agent: { llm: createReplayLlm([]) },
  });
  app.pling.setActiveScopes(["todo"]);
  return app;
}

describe("J-08 · assistant UI", () => {
  it("declares a region, task records, and only the intended controls", () => {
    const mounted = setup();
    const snapshot = mounted.pling.registry.snapshot();

    expect(snapshot.scopes.find((scope) => scope.id === "todo")).toMatchObject({
      label: "Tasks",
      description: "The task list and the form for adding a new task.",
      role: "main",
    });
    expect(snapshot.records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);
    expect(snapshot.records[0]?.fields).toMatchObject({ text: "Review the launch checklist", done: false });
    expect(snapshot.records[1]?.fields).toMatchObject({ text: "Book the design review", done: false });
    expect(snapshot.actions.map((action) => action.id)).toEqual(expect.arrayContaining([
      "composer_text",
      "toggle@t1",
      "toggle@t2",
      "toggle@t3",
    ]));
    expect(snapshot.actions.map((action) => action.id)).not.toContain("composer_submit");
  });

  it("adds a task through the existing input and submit event", async () => {
    const mounted = setup();
    const executor = createExecutor({ registry: mounted.pling.registry, policy: createPolicy(async () => true) });
    await expect(executor.execute("composer_text", JSON.stringify({ text: "Write the weekly report" })))
      .resolves.toMatchObject({ result: { ok: true } });
    expect(host.querySelector<HTMLInputElement>("[data-new-task]")?.value).toBe("Write the weekly report");
    expect(mounted.pling.registry.snapshot().actions.map((action) => action.id)).toContain("composer_submit");

    await expect(executor.execute("composer_submit", "{}")).resolves.toMatchObject({ result: { ok: true } });
    expect(Array.from(host.querySelectorAll(".task__text")).map((node) => node.textContent)).toContain("Write the weekly report");
    expect(host.querySelectorAll(".task")).toHaveLength(4);
    expect(mounted.tasks[0]).toMatchObject({ text: "Write the weekly report", done: false });
  });

  it("toggles one record and keeps the record fields live", async () => {
    const mounted = setup();
    const executor = createExecutor({ registry: mounted.pling.registry, policy: createPolicy(async () => true) });
    await expect(executor.execute("toggle@t2", "{}")).resolves.toMatchObject({ result: { ok: true } });

    expect(mounted.tasks.find((task) => task.id === "t2")?.done).toBe(true);
    expect(host.querySelectorAll(".task")[1]?.classList.contains("is-done")).toBe(true);
    expect(mounted.pling.registry.snapshot().records.find((record) => record.id === "t2")?.fields.done).toBe(true);
  });

  it("opens the single shared dock from page chrome", () => {
    const mounted = setup();
    const button = host.querySelector<HTMLButtonElement>("[data-assistant-open]");

    expect(document.querySelectorAll(".pling-dock__launcher")).toHaveLength(1);
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    button?.click();
    expect(mounted.dock.isOpen()).toBe(true);
    expect(button?.getAttribute("aria-expanded")).toBe("true");
  });
});
