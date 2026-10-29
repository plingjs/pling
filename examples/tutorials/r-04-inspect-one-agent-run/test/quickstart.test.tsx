import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "../src/App";

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
  document.body.innerHTML = "";
  root = null;
  host = null;
});

async function mountApp(locale: "en" | "zh" = "en") {
  const warnings: string[] = [];
  const pling = createPling({
    presence: false,
    onWarn: (message) => warnings.push(message),
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm: createReplayLlm([]) },
  });
  const executor = createExecutor({ registry: pling.registry, policy: createPolicy(async () => true) });

  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <App locale={locale} />
      </PlingProvider>,
    );
  });

  return { executor, pling, warnings };
}

describe("R-04 · inherited quick-start behavior", () => {
  it("declares one region, task records, and only the three intended controls", async () => {
    const { pling, warnings } = await mountApp();
    const snapshot = pling.registry.snapshot();

    expect(snapshot.scopes.find((scope) => scope.id === "todo")).toMatchObject({
      label: "Tasks",
      description: "The task list and the form for adding a new task.",
      role: "main",
    });
    expect(snapshot.records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);
    expect(snapshot.records[0]?.fields).toEqual({ text: "Review the launch checklist", status: "open" });
    expect(snapshot.actions.map((action) => action.id)).toEqual(expect.arrayContaining([
      "composer_text",
      "toggle@t1",
      "toggle@t2",
      "toggle@t3",
    ]));
    expect(snapshot.actions.map((action) => action.id)).not.toContain("composer_submit");
    expect(warnings).toEqual([]);
  });

  it("adds a task through the input and submit controls used by a person", async () => {
    const { executor, pling } = await mountApp();

    await act(async () => {
      await expect(executor.execute("composer_text", JSON.stringify({ text: "Write the weekly report" })))
        .resolves.toMatchObject({ result: { ok: true } });
    });
    expect((document.querySelector("#new-task") as HTMLInputElement).value).toBe("Write the weekly report");
    expect(pling.registry.snapshot().actions.map((action) => action.id)).toContain("composer_submit");

    await act(async () => {
      await expect(executor.execute("composer_submit", "{}")).resolves.toMatchObject({ result: { ok: true } });
    });

    const texts = Array.from(document.querySelectorAll(".task__text")).map((node) => node.textContent);
    expect(texts).toContain("Write the weekly report");
    expect(document.querySelectorAll(".task")).toHaveLength(4);
  });

  it("marks one record without changing the other rows", async () => {
    const { executor, pling } = await mountApp();

    await act(async () => {
      await expect(executor.execute("toggle@t2", "{}")).resolves.toMatchObject({ result: { ok: true } });
    });

    expect(pling.registry.snapshot().records.find((record) => record.id === "t2")?.fields.status).toBe("completed");
    expect(pling.registry.snapshot().records.find((record) => record.id === "t1")?.fields.status).toBe("open");
  });

  it("reports a full list instead of advertising a submit that cannot run", async () => {
    const { executor, pling } = await mountApp();

    for (let index = 1; index <= 5; index += 1) {
      await act(async () => {
        await expect(executor.execute("composer_text", JSON.stringify({ text: `Task ${index}` })))
          .resolves.toMatchObject({ result: { ok: true } });
      });
      await act(async () => {
        await expect(executor.execute("composer_submit", "{}")).resolves.toMatchObject({ result: { ok: true } });
      });
    }

    await act(async () => {
      await expect(executor.execute("composer_text", JSON.stringify({ text: "One too many" })))
        .resolves.toMatchObject({ result: { ok: true } });
    });

    const snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).not.toContain("composer_submit");
    expect(snapshot.unavailable.find((action) => action.id === "composer_submit")?.reason)
      .toContain("The task list is full. Delete a task before adding another.");
  });
});
