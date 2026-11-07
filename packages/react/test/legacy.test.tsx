import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import {
  createPling,
  PlingAction,
  PlingProvider,
  PlingRecord,
  PlingScope,
  PlingState,
  PlingTool,
} from "../src/legacy";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  document.body.innerHTML = "";
  root = null;
  host = null;
});

describe("React legacy adapter", () => {
  it("registers scope, action, and record through render props", async () => {
    const pling = createPling({ onWarn: () => {} });
    const onClick = vi.fn();

    class App extends React.Component {
      render() {
        return (
          <PlingProvider pling={pling}>
            <PlingScope options={{ id: "todo", label: "Todo list" }}>
              {(scopeRef) => (
                <section ref={scopeRef}>
                  <PlingTool options={{ id: "add_task", desc: "Add a todo" }}>
                    {(toolRef) => <button ref={toolRef} onClick={onClick}>Add</button>}
                  </PlingTool>
                  <PlingRecord value={{ id: "row-1", fields: { title: "Buy milk" } }}>
                    {(rowRef) => <article ref={rowRef}>Buy milk</article>}
                  </PlingRecord>
                </section>
              )}
            </PlingScope>
          </PlingProvider>
        );
      }
    }

    await act(async () => root!.render(<App />));

    expect(pling.registry.snapshot().actions).toMatchObject([
      { id: "add_task", primitive: "click", description: "Add a todo" },
    ]);
    expect(pling.registry.snapshot().records).toHaveLength(1);

    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(vi.fn()) });
    const out = await act(async () => executor.execute("add_task", "{}"));
    expect(out).toMatchObject({ result: { ok: true } });
    expect(onClick).toHaveBeenCalledOnce();

    await act(async () => root?.unmount());
    root = null;
    expect(pling.registry.snapshot().actions).toHaveLength(0);
    expect(pling.registry.snapshot().records).toHaveLength(0);
  });

  it("exposes state and function actions without Hooks", async () => {
    const pling = createPling({ onWarn: () => {} });
    const complete = vi.fn((args: Record<string, unknown>) => ({ completed: args.id }));

    class App extends React.Component {
      render() {
        return (
          <PlingProvider pling={pling}>
            <PlingState name="summary" source={() => ({ remaining: 2 })} description="Remaining todos" />
            <PlingAction
              options={{
                id: "complete_task",
                desc: "Complete a todo",
                params: [{ name: "id", label: "Todo id" }],
                run: complete,
              }}
            />
          </PlingProvider>
        );
      }
    }

    await act(async () => root!.render(<App />));
    expect(pling.registry.snapshot().state).toEqual({ summary: { remaining: 2 } });

    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(vi.fn()) });
    const out = await executor.execute("complete_task", JSON.stringify({ id: "row-1" }));
    expect(out).toMatchObject({ result: { ok: true, data: { completed: "row-1" } } });
    expect(complete).toHaveBeenCalledWith({ id: "row-1" });
  });
});
