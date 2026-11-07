import { afterEach, describe, expect, it, vi } from "vitest";
import { createPling } from "../src";
import { click } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function button(label: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.textContent = label;
  document.body.append(element);
  return element;
}

describe("Vanilla declaration lifecycle parity", () => {
  it("replaces a tool declaration instead of stacking a second binding", () => {
    const save = button("Save");
    const pling = createPling({ onWarn: () => {} });
    const first = pling.tool(save, { id: "save_draft", desc: "Save the draft" });
    const second = pling.tool(save, { id: "publish", desc: "Publish the draft" });

    expect(pling.registry.snapshot().actions.map((action) => action.id)).toEqual(["publish"]);
    first();
    expect(pling.registry.snapshot().actions.map((action) => action.id)).toEqual(["publish"]);
    second();
    expect(pling.registry.snapshot().actions).toEqual([]);
    pling.destroy();
  });

  it("replaces records, scopes and state exposed under the same anchor or key", () => {
    const root = document.createElement("section");
    const row = document.createElement("article");
    root.append(row);
    document.body.append(root);
    const pling = createPling({ onWarn: () => {} });

    const firstRecord = pling.record(row, { data: { id: "r1", text: "Old" } });
    const secondRecord = pling.record(row, { data: { id: "r2", text: "New" } });
    expect(pling.registry.snapshot().records.map((record) => record.id)).toEqual(["r2"]);
    firstRecord();
    expect(pling.registry.snapshot().records.map((record) => record.id)).toEqual(["r2"]);

    const firstScope = pling.scope(root, { id: "first" });
    const secondScope = pling.scope(root, { id: "second" });
    expect(pling.registry.snapshot().scopes.map((scope) => scope.id)).toEqual(["second"]);
    firstScope();
    expect(pling.registry.snapshot().scopes.map((scope) => scope.id)).toEqual(["second"]);

    const firstState = pling.state("metrics", { count: 1 });
    const secondState = pling.state("metrics", { count: 2 });
    expect(pling.registry.snapshot().state).toEqual({ metrics: { count: 2 } });
    firstState();
    expect(pling.registry.snapshot().state).toEqual({ metrics: { count: 2 } });

    secondRecord();
    secondScope();
    secondState();
    expect(pling.registry.snapshot()).toMatchObject({ recordsTotal: 0, scopes: [], state: {} });
    pling.destroy();
  });

  it("keeps feedback identity stable when the message changes", () => {
    const row = document.createElement("div");
    document.body.append(row);
    const pling = createPling({ onWarn: () => {} });
    const first = pling.declareFeedback(row, "Customer is required");
    const id = pling.registry.snapshot().feedback[0]?.id;
    const second = pling.declareFeedback(row, "Customer name is too long");

    expect(pling.registry.snapshot().feedback).toMatchObject([
      { id, message: "Customer name is too long" },
    ]);
    first();
    expect(pling.registry.snapshot().feedback).toMatchObject([
      { id, message: "Customer name is too long" },
    ]);
    second();
    expect(pling.registry.snapshot().feedback).toEqual([]);
    pling.destroy();
  });

  it("replaces task and guide-target declarations on the same element", () => {
    const taskButton = button("Run task");
    const guide = document.createElement("input");
    document.body.append(guide);
    const pling = createPling({ onWarn: () => {} });
    const ask = vi.spyOn(pling.task, "ask").mockResolvedValue();

    const firstTask = pling.declareTask(taskButton, "First task");
    const secondTask = pling.declareTask(taskButton, "Second task");
    firstTask();
    click(taskButton);
    expect(ask).toHaveBeenCalledOnce();
    expect(ask).toHaveBeenCalledWith("Second task", { source: taskButton });

    const firstGuide = pling.guideTarget(guide, "first");
    const secondGuide = pling.guideTarget(guide, "second");
    expect(pling.registry.markGuideTarget("first", "acting")).toBe(false);
    expect(pling.registry.markGuideTarget("second", "acting")).toBe(true);
    firstGuide();
    expect(pling.registry.markGuideTarget("second", "idle")).toBe(true);
    secondGuide();
    expect(pling.registry.markGuideTarget("second", "idle")).toBe(false);

    secondTask();
    click(taskButton);
    expect(ask).toHaveBeenCalledOnce();
    pling.destroy();
  });

  it("rejects every declaration after destroy and removes existing bindings", () => {
    const element = button("Save");
    const pling = createPling({ onWarn: () => {} });
    pling.tool(element, { id: "save", desc: "Save" });
    pling.record(element, { data: { id: "r1", value: 1 } });
    pling.scope(document.body, { id: "page" });
    pling.state("count", { total: 1 });
    pling.declareFeedback(element, "Invalid");
    pling.declareTask(element, "Task");
    pling.guideTarget(element, "target");
    pling.destroy();

    expect(pling.registry.snapshot()).toMatchObject({
      actions: [],
      recordsTotal: 0,
      scopes: [],
      state: {},
      feedback: [],
    });
    expect(() => pling.tool(element, { id: "again", desc: "Again" })).toThrow(/destroy/);
    expect(() => pling.action({ id: "again", desc: "Again", run: () => {} })).toThrow(/destroy/);
    expect(() => pling.record(element, { data: { id: "r2" } })).toThrow(/destroy/);
    expect(() => pling.scope(element, { id: "again" })).toThrow(/destroy/);
    expect(() => pling.state("again", {})).toThrow(/destroy/);
    expect(() => pling.declareFeedback(element, "Again")).toThrow(/destroy/);
    expect(() => pling.declareTask(element, "Again")).toThrow(/destroy/);
    expect(() => pling.guideTarget(element, "again")).toThrow(/destroy/);
    expect(() => pling.dock()).toThrow(/destroy/);
    expect(() =>
      pling.surfaceGateway({ app: "test", expose: [], mode: "public-demo" }),
    ).toThrow(/destroy/);
  });
});

describe("Vanilla native availability parity", () => {
  it.each([
    ["aria-disabled", (button: HTMLButtonElement) => button.setAttribute("aria-disabled", "true"), "availability.ariaDisabled"],
    ["hidden ancestor", (button: HTMLButtonElement) => { button.parentElement!.hidden = true; }, "availability.hidden"],
    ["inert ancestor", (button: HTMLButtonElement) => button.parentElement!.setAttribute("inert", ""), "availability.inert"],
    ["aria-hidden ancestor", (button: HTMLButtonElement) => button.parentElement!.setAttribute("aria-hidden", "true"), "availability.ariaHidden"],
    ["display none", (button: HTMLButtonElement) => { button.style.display = "none"; }, "availability.displayNone"],
    ["visibility hidden", (button: HTMLButtonElement) => { button.style.visibility = "hidden"; }, "availability.visibilityHidden"],
  ])("explains %s instead of hiding the failure", (_name, mutate, reasonKey) => {
    const host = document.createElement("div");
    const control = document.createElement("button");
    host.append(control);
    document.body.append(host);
    mutate(control);
    const pling = createPling({ onWarn: () => {} });
    pling.tool(control, { id: "action", desc: "Act" });

    expect(pling.registry.snapshot().actions).toEqual([]);
    expect(pling.registry.snapshot().unavailable[0]).toMatchObject({ id: "action", reasonKey });
    pling.destroy();
  });

  it("reports a real hit-test overlay before the model tries to click through it", () => {
    const control = button("Delete");
    const overlay = document.createElement("div");
    overlay.id = "modal-backdrop";
    document.body.append(overlay);
    vi.spyOn(control, "getBoundingClientRect").mockReturnValue({
      x: 10,
      y: 10,
      left: 10,
      top: 10,
      right: 30,
      bottom: 30,
      width: 20,
      height: 20,
      toJSON: () => ({}),
    });
    const pling = createPling({
      onWarn: () => {},
      scopes: { visibility: "geometry", hitTest: () => overlay },
    });
    pling.tool(control, { id: "delete", desc: "Delete", kind: "danger" });

    expect(pling.registry.snapshot().unavailable[0]).toMatchObject({
      id: "delete",
      reasonKey: "availability.covered",
    });
    pling.destroy();
  });

  it("moves an offscreen row action into the dedicated record-action bucket", () => {
    const list = document.createElement("ul");
    const row = document.createElement("li");
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    row.append(remove);
    list.append(row);
    document.body.append(list);
    const pling = createPling({ onWarn: () => {} });
    pling.scope(list, { id: "todos", role: "list" });
    pling.record(row, { data: { id: "t1", text: "Milk" } });
    pling.tool(remove, { id: "remove@t1", desc: "Remove the row" });
    pling.setActiveScopes(["todos"]);
    pling.scopes.setVisible(remove, false);

    const snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).not.toContain("remove@t1");
    expect(snapshot.offscreenRecordActions).toMatchObject([
      { id: "remove@t1", offscreen: true },
    ]);
    pling.destroy();
  });
});
