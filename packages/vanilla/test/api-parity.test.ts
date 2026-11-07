import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createTaskController } from "@plingjs/agent";
import { createPling } from "../src";
import { allowAll } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/");
  document.title = "";
});

function button(label = "保存"): HTMLButtonElement {
  const element = document.createElement("button");
  element.textContent = label;
  document.body.append(element);
  return element;
}

describe("Vanilla API parity: actions and accessibility", () => {
  it("declares a native action with the same descriptor shape as v-tool", async () => {
    const save = button();
    const onClick = vi.fn();
    save.addEventListener("click", onClick);
    const pling = createPling({ onWarn: () => {} });

    const unbind = pling.tool(save, {
      id: "save_order",
      desc: "Save the current order",
      kind: "write",
    });

    expect(pling.registry.snapshot().actions[0]).toMatchObject({
      id: "save_order",
      description: "Save the current order",
      primitive: "click",
      kind: "write",
      fidelity: "high",
      source: "declared",
    });

    const result = await allowAll(pling.registry).execute("save_order", "{}");
    expect(result).toMatchObject({ result: { ok: true } });
    expect(onClick).toHaveBeenCalledOnce();

    unbind();
    expect(pling.registry.snapshot().actions).toEqual([]);
    pling.destroy();
  });

  it("modelVisible: false hides an element action from the model but keeps it callable", async () => {
    const save = button();
    const pling = createPling({ onWarn: () => {} });
    pling.tool(save, {
      id: "save_order",
      desc: "Save the current order",
      modelVisible: false,
    });

    expect(pling.registry.snapshot().actions).toEqual([]);
    expect(pling.registry.get("save_order")).toBeTruthy();
    await pling.registry.get("save_order")!.run!({});

    pling.destroy();
  });

  it("supports nested scopes and DOM order exactly like the Vue directive", () => {
    const page = document.createElement("main");
    page.id = "page";
    const list = document.createElement("ul");
    const first = document.createElement("li");
    const second = document.createElement("li");
    list.append(first, second);
    page.append(list);
    document.body.append(page);

    const pling = createPling({ onWarn: () => {} });
    pling.scope(page, { id: "orders", label: "Orders", role: "main" });
    pling.scope(list, { id: "queue", label: "Queue", role: "list" });
    pling.record(first, { data: { id: "SO-1", customer: "Globex" }, label: "SO-1" });
    pling.record(second, { data: { id: "SO-2", customer: "ACME" }, label: "SO-2" });
    const open = document.createElement("button");
    first.append(open);
    pling.tool(open, {
      id: "open",
      desc: "Open order",
    });

    const snapshot = pling.registry.snapshot();
    expect(snapshot.scopes.find((scope) => scope.id === "queue")).toMatchObject({
      label: "Queue",
      parent: "orders",
      role: "list",
    });
    expect(snapshot.records.map((record) => record.id)).toEqual(["SO-1", "SO-2"]);
    expect(snapshot.records[1]).toMatchObject({ scope: "queue", fields: { customer: "ACME" } });
    expect(snapshot.actions[0]).toMatchObject({ id: "open", scope: "queue", scopePath: ["Orders", "Queue"] });
    pling.destroy();
  });

  it("keeps unavailable reasons visible and recalculates availability on every snapshot", () => {
    const submit = button("提交");
    submit.disabled = true;
    let canSubmit = false;
    const pling = createPling({ onWarn: () => {} });
    pling.tool(submit, {
      id: "submit",
      desc: "Submit the order",
      available: () => canSubmit || "Select an order first",
    });

    expect(pling.registry.snapshot().unavailable[0]).toMatchObject({
      id: "submit",
      reason: "Element is disabled (disabled)；Select an order first",
    });

    submit.disabled = false;
    expect(pling.registry.snapshot().unavailable[0]?.reason).toBe("Select an order first");
    canSubmit = true;
    expect(pling.registry.snapshot().actions.map((action) => action.id)).toEqual(["submit"]);
    pling.destroy();
  });

  it("passes the complete parameter object for params actions and coerces values", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const run = vi.fn();
    const pling = createPling({ onWarn: () => {} });
    pling.tool(host, {
      id: "move",
      desc: "Move a row",
      params: [
        { name: "row", label: "Row id" },
        { name: "position", label: "Position", type: "number" },
      ],
      run,
    });

    await allowAll(pling.registry).execute("move", JSON.stringify({ row: "SO-2", position: "3" }));
    expect(run).toHaveBeenCalledWith({ row: "SO-2", position: 3 });
    pling.destroy();
  });

  it("carries expect and awaits injected async implementations", async () => {
    const buttonElement = button("提交");
    let landed = false;
    const pling = createPling({ onWarn: () => {} });
    pling.tool(buttonElement, {
      id: "submit",
      desc: "Submit",
      expect: { desc: "Submission landed", check: () => landed, timeout: 100 },
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        landed = true;
      },
    });

    expect(pling.registry.get("submit")?.expect?.desc).toBe("Submission landed");
    expect(pling.registry.snapshot().actions[0]).not.toHaveProperty("expect");
    const result = await allowAll(pling.registry).execute("submit", "{}");
    expect(landed).toBe(true);
    expect(result).toMatchObject({ result: { expect: "Submission landed" } });
    pling.destroy();
  });

  it("wires handoff without executing the DOM action", async () => {
    const upload = button("上传");
    const onClick = vi.fn();
    upload.addEventListener("click", onClick);
    const pling = createPling({ onWarn: () => {} });
    pling.tool(upload, {
      id: "upload",
      desc: "Upload a file",
      handoff: { reason: "Choose a local file", steps: ["Open picker", "Choose file"] },
    });

    expect(pling.registry.get("upload")?.handoff).toMatchObject({
      reason: "Choose a local file",
      steps: [{ text: "Open picker" }, { text: "Choose file" }],
    });
    expect(onClick).not.toHaveBeenCalled();
    pling.destroy();
  });

  it("supports function actions with availability, dynamic params, return data and errors", async () => {
    const pling = createPling({ onWarn: () => {} });
    let ready = false;
    pling.action({
      id: "approve",
      desc: "Approve all selected orders",
      available: () => ready || "Select at least one order",
      params: [{ name: "reason", label: "Reason" }],
      run: (args) => ({ reason: args.reason }),
    });

    expect(pling.registry.snapshot().unavailable[0]).toMatchObject({ id: "approve", reason: "Select at least one order" });
    ready = true;
    const result = await allowAll(pling.registry).execute("approve", JSON.stringify({ reason: "Verified" }));
    expect(result).toMatchObject({ result: { ok: true, data: { reason: "Verified" } } });

    await expect(allowAll(pling.registry).execute("approve", "{}")).resolves.toMatchObject({
      error: { code: "INVALID_PARAMS" },
    });
    pling.destroy();
  });

  it("namespaces action, record, scope, state and feedback ids without mutating local syntax", () => {
    const root = document.createElement("section");
    const row = document.createElement("article");
    const act = document.createElement("button");
    row.append(act);
    root.append(row);
    document.body.append(root);

    const pling = createPling({ namespace: "todo", onWarn: () => {} });
    pling.scope(root, { id: "list" });
    pling.record(row, { data: { id: "t1", text: "Milk" } });
    pling.tool(act, { id: "remove", desc: "Remove" });
    pling.state("count", { total: 1 });
    pling.declareFeedback(row, "Cannot remove the last item");

    const snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).toContain("todo/remove");
    expect(snapshot.records[0]).toMatchObject({ id: "todo/t1", scope: "todo/list" });
    expect(snapshot.scopes[0]?.id).toBe("todo/list");
    expect(snapshot.state).toHaveProperty("todo/count");
    expect(snapshot.feedback[0]?.id).toContain("todo/feedback_");
    pling.destroy();
  });

  it("keeps disabled native controls out of the action list and explains why", () => {
    const disabled = button("Delete");
    disabled.disabled = true;
    const pling = createPling({ onWarn: () => {} });
    pling.tool(disabled, { id: "delete", desc: "Delete the row", kind: "danger" });
    const snapshot = pling.registry.snapshot();
    expect(snapshot.actions).toEqual([]);
    expect(snapshot.unavailable[0]).toMatchObject({ id: "delete", reasonKey: "availability.disabled" });
    pling.destroy();
  });

  it("rejects execution when an action is unavailable", async () => {
    const element = button("Approve");
    const pling = createPling({ onWarn: () => {} });
    pling.tool(element, { id: "approve", desc: "Approve", available: () => "Nothing selected" });
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(async () => true) });
    await expect(executor.execute("approve", "{}")).resolves.toMatchObject({
      error: { code: "ACTION_UNAVAILABLE", message: expect.stringContaining("Nothing selected") },
    });
    pling.destroy();
  });
});

describe("Vanilla guided task catalogue", () => {
  it("binds start/update actions and writes working memory through pling.task", async () => {
    const pling = createPling({ onWarn: () => {} });
    const controller = createTaskController({ invoke: async () => ({ ok: true, summary: "done" }) as never });
    const off = pling.task.define({
      definition: {
        id: "course.create",
        title: "Create a course",
        objective: "Create a publishable course",
        fields: [
          { name: "name", label: "Name", recommended: "Yoga foundations" },
          { name: "cover", label: "Cover", type: "boolean", agentWritable: false },
        ],
        steps: [{ id: "save", label: "Save", action: "create_course" }],
      },
      controller,
    });

    expect(pling.registry.get("pling_start_task")).toBeTruthy();
    const start = pling.registry.get("pling_start_task")!;
    await start.run!({ task: "course.create", values: { name: "Pregnancy yoga" } });
    expect(controller.snapshot()?.values.name).toBe("Pregnancy yoga");

    const update = pling.registry.get("pling_update_task")!;
    await update.run!({ task: "course.create", values: { name: "Prenatal yoga" } });
    expect(controller.snapshot()?.values.name).toBe("Prenatal yoga");
    await expect(update.run!({ task: "course.create", values: { cover: true } })).rejects.toMatchObject({
      code: "INVALID_ARGS",
    });

    off();
    expect(pling.registry.get("pling_start_task")).toBeUndefined();
    pling.destroy();
  });
});
