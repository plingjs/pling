import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExecutor, createPolicy, type FlowStep } from "@plingjs/core";
import { createPling, PlingProvider, usePlingState, usePlingTool } from "../src";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = "";
});

async function render(node: ReactNode): Promise<void> {
  await act(async () => root!.render(node));
}

describe("usePlingTool · steps", () => {
  it("registers a flow with ordered steps and no run implementation", async () => {
    const pling = createPling({ onWarn: () => {} });
    const steps: readonly FlowStep[] = [
      { action: "search_query", args: { text: "{{query}}" }, desc: "Fill the query" },
      { action: "go_search", desc: "Submit search" },
    ];

    function App() {
      const flow = usePlingTool<HTMLDivElement>({
        id: "search_and_go",
        desc: "Search for a term",
        params: [{ name: "query", label: "Query" }],
        steps,
      });
      return <div ref={flow}>Search flow</div>;
    }

    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    const view = pling.registry.snapshot().actions.find((action) => action.id === "search_and_go");

    expect(view).toMatchObject({ primitive: "flow", flowSteps: 2, fidelity: "high" });
    expect(pling.registry.get("search_and_go")?.steps).toEqual(steps);
    expect(pling.registry.get("search_and_go")?.run).toBeUndefined();
  });

  it("executes the steps through the same DOM actions available to the model", async () => {
    const pling = createPling({ onWarn: () => {} });
    const submitted = vi.fn();

    function App() {
      const [keyword, setKeyword] = useState("");
      const input = usePlingTool<HTMLInputElement>({
        id: "search_query",
        desc: "Fill in the search query",
        params: [{ name: "text", label: "Query" }],
      });
      const button = usePlingTool<HTMLButtonElement>({ id: "go_search", desc: "Submit search" });
      const flow = usePlingTool<HTMLDivElement>({
        id: "search_and_go",
        desc: "Fill in a query and submit search",
        params: [{ name: "text", label: "Query" }],
        steps: [
          { action: "search_query", args: { text: "{{text}}" }, desc: "Fill the query" },
          { action: "go_search", desc: "Submit search" },
        ],
      });
      usePlingState("search", () => ({ keyword, submitted: submitted.mock.calls.length }), {
        description: "Search query and number of submissions",
      });
      return (
        <div>
          <input ref={input} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <button ref={button} onClick={submitted}>Search</button>
          <div ref={flow}>Search flow</div>
        </div>
      );
    }

    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    const executor = createExecutor({
      registry: pling.registry,
      policy: createPolicy(async () => true),
    });

    let result!: Awaited<ReturnType<typeof executor.execute>>;
    await act(async () => {
      result = await executor.execute("search_and_go", JSON.stringify({ text: "cat food" }));
    });

    expect(result).toMatchObject({ result: { ok: true, flow: { completed: 2, total: 2 } } });
    expect(document.querySelector("input")?.value).toBe("cat food");
    expect(submitted).toHaveBeenCalledOnce();
  });

  it("re-registers when the step list changes", async () => {
    const pling = createPling({ onWarn: () => {} });

    function App() {
      const [count, setCount] = useState(1);
      const flow = usePlingTool<HTMLDivElement>({
        id: "changing_flow",
        desc: "A flow whose length changes",
        steps: Array.from({ length: count }, (_, index) => ({ action: `step_${index + 1}` })),
      });
      return (
        <div ref={flow}>
          <button data-add onClick={() => setCount(3)}>Three steps</button>
        </div>
      );
    }

    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    expect(pling.registry.get("changing_flow")?.steps).toHaveLength(1);

    await act(async () => (document.querySelector("[data-add]") as HTMLButtonElement).click());
    expect(pling.registry.get("changing_flow")?.steps).toHaveLength(3);
    expect(pling.registry.snapshot().actions.find((action) => action.id === "changing_flow")?.flowSteps)
      .toBe(3);
  });

  it("warns for empty steps and for steps combined with run", async () => {
    const warnings: string[] = [];
    const pling = createPling({ onWarn: (message) => warnings.push(message) });

    function App() {
      const empty = usePlingTool<HTMLSpanElement>({ id: "empty", desc: "Empty flow", steps: [] });
      const both = usePlingTool<HTMLSpanElement>({
        id: "both",
        desc: "Two implementations",
        steps: [{ action: "one" }],
        run: () => {},
      });
      return <div><span ref={empty}>Empty</span><span ref={both}>Both</span></div>;
    }

    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    expect(warnings.some((message) => message.includes("empty") && message.includes("steps 是空的")))
      .toBe(true);
    expect(warnings.some((message) => message.includes("both") && message.includes("同时写了 steps 和 run")))
      .toBe(true);
  });

  it("does not use a flow mount point's visibility as its permission or availability", async () => {
    const pling = createPling({ onWarn: () => {} });

    function App() {
      const flow = usePlingTool<HTMLDivElement>({
        id: "background_flow",
        desc: "A flow mounted in a hidden toolbar",
        steps: [{ action: "one" }],
      });
      return <div ref={flow} hidden>Flow</div>;
    }

    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    expect(pling.registry.snapshot().actions.some((action) => action.id === "background_flow"))
      .toBe(true);
  });
});
