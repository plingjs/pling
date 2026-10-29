import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { mountRecordsApp, type RecordsApp } from "../src/app";

let host: HTMLDivElement;
let app: RecordsApp | null = null;

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

function setup(): RecordsApp {
  app = mountRecordsApp(host, {
    presence: false,
    onWarn: () => {},
    agent: { llm: createReplayLlm([]) },
  });
  app.pling.setActiveScopes(["todo"]);
  return app;
}

describe("V2-05 · records and dialogs", () => {
  it("keeps record fields live and exposes only row-level actions", () => {
    const mounted = setup();
    const snapshot = mounted.pling.registry.snapshot();

    expect(snapshot.records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);
    expect(snapshot.actions.map((action) => action.id)).toEqual(expect.arrayContaining(["edit@t1", "edit@t3"]));
    expect(snapshot.actions.map((action) => action.id)).not.toContain("edit_save");
  });

  it("opens a dialog, edits one record, and unregisters the dialog actions", async () => {
    const mounted = setup();
    const executor = createExecutor({
      registry: mounted.pling.registry,
      policy: createPolicy(async () => true),
    });

    await expect(executor.execute("edit@t2", "{}")).resolves.toMatchObject({ result: { ok: true } });
    await mounted.vm.$nextTick();
    expect(host.querySelector<HTMLElement>('[role="dialog"]')).not.toBeNull();
    expect(mounted.pling.registry.snapshot().scopes.map((scope) => scope.id)).toContain("edit_dialog");

    await executor.execute("edit_text", JSON.stringify({ text: "Walk through the release notes" }));
    await mounted.vm.$nextTick();
    expect(host.querySelector<HTMLInputElement>(".dialog input")?.value).toBe("Walk through the release notes");

    await expect(executor.execute("edit_save", "{}")).resolves.toMatchObject({ result: { ok: true } });
    await mounted.vm.$nextTick();
    expect(mounted.tasks.find((task) => task.id === "t2")?.text).toBe("Walk through the release notes");
    expect(mounted.pling.registry.snapshot().records.find((record) => record.id === "t2")?.fields.text)
      .toBe("Walk through the release notes");
    expect(mounted.pling.registry.get("edit_save")).toBeUndefined();
    expect(host.querySelector(".backdrop")).toBeNull();
  });

  it("cancels without changing the record", async () => {
    const mounted = setup();
    const executor = createExecutor({
      registry: mounted.pling.registry,
      policy: createPolicy(async () => true),
    });

    await executor.execute("edit@t1", "{}");
    await mounted.vm.$nextTick();
    await executor.execute("edit_text", JSON.stringify({ text: "Do not save this" }));
    await mounted.vm.$nextTick();
    await expect(executor.execute("edit_cancel", "{}")).resolves.toMatchObject({ result: { ok: true } });
    await mounted.vm.$nextTick();

    expect(mounted.tasks[0]?.text).toBe("Review the launch checklist");
    expect(host.querySelector(".backdrop")).toBeNull();
    expect(mounted.pling.registry.get("edit_cancel")).toBeUndefined();
  });
});
