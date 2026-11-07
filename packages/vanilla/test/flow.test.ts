import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecutor, createPolicy, type FlowStep } from "@plingjs/core";
import { createPling } from "../src";
import { allowAll, click } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Vanilla flow actions", () => {
  it("registers steps as a flow and exposes the step count", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pling = createPling({ onWarn: () => {} });
    pling.tool(host, {
      id: "search_and_open",
      desc: "Search and open the first result",
      params: [{ name: "query", label: "Query" }],
      steps: [
        { action: "fill_query", args: { text: "{{query}}" } },
        { action: "open_result" },
      ] satisfies FlowStep[],
    });

    expect(pling.registry.snapshot().actions[0]).toMatchObject({
      id: "search_and_open",
      primitive: "flow",
      flowSteps: 2,
      fidelity: "high",
    });
    expect(pling.registry.get("search_and_open")?.steps).toHaveLength(2);
    expect(pling.registry.get("search_and_open")?.run).toBeUndefined();
    pling.destroy();
  });

  it("executes the exact DOM actions a user would trigger", async () => {
    const input = document.createElement("input");
    const go = document.createElement("button");
    const mount = document.createElement("div");
    input.id = "query";
    go.id = "go";
    go.textContent = "Search";
    mount.append(input, go);
    document.body.append(mount);
    const submitted = vi.fn();
    go.addEventListener("click", submitted);

    const pling = createPling({ onWarn: () => {} });
    pling.state("search", () => ({ value: input.value, submitted: submitted.mock.calls.length }));
    pling.tool(input, {
      id: "fill_query",
      desc: "Fill the query",
      params: [{ name: "text", label: "Text" }],
    });
    pling.tool(go, { id: "submit_search", desc: "Submit the search" });
    pling.tool(mount, {
      id: "search_and_submit",
      desc: "Search and submit",
      params: [{ name: "text", label: "Text" }],
      steps: [
        { action: "fill_query", args: { text: "{{text}}" } },
        { action: "submit_search" },
      ],
    });

    const result = await allowAll(pling.registry).execute(
      "search_and_submit",
      JSON.stringify({ text: "cat food" }),
    );
    expect(result).toMatchObject({ result: { ok: true, flow: { completed: 2, total: 2 } } });
    expect(input.value).toBe("cat food");
    expect(submitted).toHaveBeenCalledOnce();
    pling.destroy();
  });

  it("uses the strictest step approval and runs through the same confirmation gate", async () => {
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    document.body.append(remove);
    const pling = createPling({ onWarn: () => {} });
    pling.tool(remove, { id: "remove_row", desc: "Remove the row", kind: "danger" });
    const flowMount = document.createElement("span");
    document.body.append(flowMount);
    pling.tool(flowMount, { id: "cleanup", desc: "Clean up", steps: [{ action: "remove_row" }] });

    const asked: string[] = [];
    const executor = createExecutor({
      registry: pling.registry,
      policy: createPolicy(async (request) => {
        asked.push(request.kind);
        return true;
      }),
    });
    await executor.execute("cleanup", "{}");
    expect(asked).toEqual(["danger"]);
    click(remove);
    pling.destroy();
  });

  it("warns for empty steps and for steps plus run", () => {
    const first = document.createElement("span");
    const second = document.createElement("span");
    document.body.append(first, second);
    const warnings: string[] = [];
    const pling = createPling({ onWarn: (message) => warnings.push(message) });
    pling.tool(first, { id: "empty", desc: "Empty", steps: [] });
    pling.tool(second, { id: "both", desc: "Both", steps: [{ action: "x" }], run: () => {} });
    expect(warnings.some((message) => message.includes("steps 是空的"))).toBe(true);
    expect(warnings.some((message) => message.includes("同时写了 steps 和 run"))).toBe(true);
    pling.destroy();
  });

  it("does not use the flow mount point's visibility as a permission check", () => {
    const mount = document.createElement("span");
    mount.hidden = true;
    document.body.append(mount);
    const pling = createPling({ onWarn: () => {} });
    pling.tool(mount, { id: "flow", desc: "Flow", steps: [{ action: "x" }] });
    expect(pling.registry.snapshot().actions.map((action) => action.id)).toEqual(["flow"]);
    pling.destroy();
  });
});
