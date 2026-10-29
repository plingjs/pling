import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "../src/App";
import { addTask, createSeedTasks, toggleTask } from "../src/todo";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let cleanup: (() => void) | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  cleanup?.();
  document.body.innerHTML = "";
  root = null;
  cleanup = null;
});

async function setup(locale: "en" | "zh" = "en") {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const pling = createPling({
    presence: false,
    onWarn: () => {},
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm: createReplayLlm([]) },
  });
  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <App locale={locale} />
      </PlingProvider>,
    );
  });
  cleanup = () => pling.destroy();
  return { pling };
}

function executorFor(pling: ReturnType<typeof createPling>) {
  return createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
    settle: async () => { await act(async () => {}); },
  });
}

function taskTexts(): Array<string | null> {
  return Array.from(document.querySelectorAll(".tasks li"))
    .map((node) => node.textContent);
}

describe("R-22 · migrating an existing React app", () => {
  it("keeps the existing business functions usable without any framework context", () => {
    const tasks = createSeedTasks("en");
    const added = addTask(tasks, "Prepare the demo", "t4");
    const toggled = toggleTask(added!, "t1");

    expect(added?.[0]).toEqual({ id: "t4", text: "Prepare the demo", done: false });
    expect(toggled.find((task) => task.id === "t1")?.done).toBe(true);
    expect(tasks).toHaveLength(3);
  });

  it("adds only the selected integration points", async () => {
    const { pling } = await setup();
    const snapshot = pling.registry.snapshot();
    const ids = snapshot.actions.map((action) => action.id);

    expect(ids).toEqual(expect.arrayContaining([
      "draft_text",
      "submit_task",
      "toggle@t1",
      "toggle@t2",
      "toggle@t3",
    ]));
    expect(ids).not.toContain("export_csv");
    expect(snapshot.state.todo_migration).toEqual({
      total: 3,
      open: 2,
      completed: 1,
      visibleIds: ["t1", "t2", "t3"],
    });
    expect(snapshot.scopes.find((scope) => scope.id === "todo")?.label).toBe("Todo list");
    expect(pling.inspectCoverage(document.querySelector("main")).missing).toBe(0);
  });

  it("uses the same form and row handlers for manual and agent operations", async () => {
    const { pling } = await setup();
    const executor = executorFor(pling);
    const input = document.querySelector<HTMLInputElement>(".composer input");
    const form = document.querySelector<HTMLFormElement>(".composer");
    if (!input || !form) throw new Error("Todo form not found");

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, "Manual task");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(taskTexts()[0]).toContain("Manual task");

    await act(async () => {
      await executor.execute("draft_text", JSON.stringify({ text: "Prepare the demo" }));
    });
    await act(async () => {
      await executor.execute("submit_task", "{}");
    });
    await act(async () => {
      await executor.execute("toggle@t1", "{}");
    });

    expect(taskTexts()[0]).toContain("Prepare the demo");
    expect(document.querySelector(".tasks li.done")?.textContent).toContain("Review the release checklist");
    expect(pling.registry.snapshot().state.todo_migration).toMatchObject({ total: 5, open: 3, completed: 2 });
  });

  it("keeps visible copy and capability descriptions in the selected language", async () => {
    const { pling } = await setup("zh");

    expect(document.querySelector("h1")?.textContent).toContain("不重写页面");
    expect(taskTexts()[0]).toContain("检查发布清单");
    expect(pling.registry.snapshot().actions.find((action) => action.id === "draft_text")?.description)
      .toContain("现有表单");
    expect(pling.registry.snapshot().stateViews[0]?.description).toContain("只读摘要");
  });
});
