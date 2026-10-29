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

function fieldsOf(mounted: QuickstartApp, id: string): Record<string, unknown> {
  return mounted.pling.registry.snapshot().records.find((record) => record.id === id)?.fields as Record<string, unknown>;
}

describe("J-09 · sensitive data and destructive actions", () => {
  it("projects a token, a mask, and a hidden value without leaking the originals", () => {
    const mounted = setup();
    const fields = fieldsOf(mounted, "t1");
    const snapshot = JSON.stringify(mounted.pling.registry.snapshot());

    expect(fields.phone).toMatch(/^\{\{p:[0-9a-z]+\}\}$/);
    expect(fields.account).toBe("AC-****-7788");
    expect(fields.internalNote).toBe("[hidden]");
    expect(snapshot).not.toContain("+1 415 555 0137");
    expect(snapshot).not.toContain("AC-1002-7788");
    expect(snapshot).not.toContain("Escalated by the account director");
  });

  it("restores a token only when the declared call action runs", async () => {
    const mounted = setup();
    const token = String(fieldsOf(mounted, "t2").phone);
    const executor = createExecutor({
      registry: mounted.pling.registry,
      policy: createPolicy(async () => true),
    });

    await expect(executor.execute("call@t2", JSON.stringify({ phone: token })))
      .resolves.toMatchObject({ result: { ok: true } });

    expect(mounted.lastCall).toBe("+1 415 555 0194");
    expect(host.querySelector("[data-call-status]")?.textContent).toContain("0194");
    expect(host.querySelector("[data-call-status]")?.textContent).not.toContain("+1 415 555 0194");
  });

  it("marks clearing completed tasks as a destructive, always-confirmed action", () => {
    const mounted = setup();
    const action = mounted.pling.registry.snapshot().actions.find((candidate) => candidate.id === "clear_completed");

    expect(action).toMatchObject({ kind: "danger", approval: "ask-always" });
  });

  it("does not remove tasks when confirmation is denied", async () => {
    const mounted = setup();
    const executor = createExecutor({
      registry: mounted.pling.registry,
      policy: createPolicy(async () => false),
    });

    const result = await executor.execute("clear_completed", "{}");

    expect("error" in result && result.error.code).toBe("PERMISSION_DENIED");
    expect(mounted.tasks.map((task) => task.id)).toEqual(["t1", "t2", "t3"]);
    expect(host.querySelectorAll(".task")).toHaveLength(3);
  });

  it("removes the completed row and both of its declarations after approval", async () => {
    const mounted = setup();
    const executor = createExecutor({
      registry: mounted.pling.registry,
      policy: createPolicy(async () => true),
    });

    await expect(executor.execute("clear_completed", "{}")).resolves.toMatchObject({ result: { ok: true } });

    expect(mounted.tasks.map((task) => task.id)).toEqual(["t1", "t2"]);
    expect(host.querySelectorAll(".task")).toHaveLength(2);
    expect(mounted.pling.registry.get("toggle@t3")).toBeUndefined();
    expect(mounted.pling.registry.get("call@t3")).toBeUndefined();
    expect(mounted.pling.registry.snapshot().records.map((record) => record.id)).toEqual(["t1", "t2"]);
  });
});
