import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTaskController, type TaskDefinition } from "@plingjs/agent";
import { AgentTaskCard, PlingProvider, createPling, type AgentTaskCardHandle } from "../src";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const task: TaskDefinition = {
  id: "teacher.create",
  title: "Add a teacher",
  description: "Create a teacher record.",
  fields: [{ name: "name", label: "Teacher name" }],
  steps: [{ label: "Create", action: "create_teacher" }],
};

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

describe("<AgentTaskCard> · React", () => {
  it("mounts the shared card and exposes the run controls imperatively", async () => {
    const controller = createTaskController({ invoke: async () => ({ ok: true }) });
    controller.register(task);
    const pling = createPling({ onWarn: () => {} });
    const card = { current: null as AgentTaskCardHandle | null };

    await act(async () => {
      root!.render(
        <PlingProvider pling={pling}>
          <AgentTaskCard ref={card} controller={controller} catalog={false} />
        </PlingProvider>,
      );
    });

    expect(document.querySelector<HTMLElement>(".pling-task-panel")?.hidden).toBe(true);
    await act(async () => card.current?.open("teacher.create"));
    expect(document.querySelector(".pling-task-panel__run-title")?.textContent).toBe("Add a teacher");

    await act(async () => card.current?.setCatalog(true));
    await act(async () => card.current?.close());
    expect(document.querySelector(".pling-task-card__title")?.textContent).toContain("Add a teacher");
  });
});
