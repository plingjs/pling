import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { AgentDock, AgentInline, createPling, PlingProvider } from "../src";

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

async function click(element: Element | null): Promise<void> {
  if (!element) throw new Error("element not found");
  await act(async () => (element as HTMLElement).click());
}

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("waitFor timed out");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function setup(llm = createReplayLlm([])) {
  return createPling({
    onWarn: () => {},
    ui: { locale: "en-US" },
    agent: {
      config: { baseUrl: "/llm/v1", model: "test-model" },
      gate: () => false,
      llm,
    },
  });
}

describe("React agent surfaces", () => {
  it("renders dock and sidebar placement through public props", async () => {
    const pling = setup();
    await render(
      <PlingProvider pling={pling}>
        <AgentDock
          layout="sidebar"
          side="left"
          launcherPlacement="center"
          launcherLabel="Open copilot"
          defaultOpen
        />
      </PlingProvider>,
    );

    const dock = document.querySelector(".pling-dock")!;
    expect(dock.classList).toContain("pling-dock--sidebar");
    expect(dock.classList).toContain("pling-dock--left");
    expect(dock.classList).toContain("pling-dock--launcher-center");
    expect(dock.getAttribute("data-layout")).toBe("sidebar");
    expect(dock.getAttribute("data-side")).toBe("left");
    expect(document.querySelector(".pling-dock__panel")).not.toBeNull();

    await click([...document.querySelectorAll<HTMLButtonElement>(".pling-dock__ghost")]
      .find((button) => button.textContent?.includes("Collapse")) ?? null);
    expect(document.querySelector<HTMLButtonElement>(".pling-dock__launcher")!.textContent)
      .toContain("Open copilot");
  });

  it("routes pling.ask into the mounted dock and expands it", async () => {
    const llm = createReplayLlm([{ content: "Two tasks are open." }]);
    const pling = setup(llm);
    await render(
      <PlingProvider pling={pling}>
        <AgentDock layout="sidebar" surfaceId="dock" />
      </PlingProvider>,
    );

    expect(document.querySelector(".pling-dock__panel")).toBeNull();
    await act(async () => pling.ask("Summarize open tasks"));
    await waitFor(() => document.body.textContent?.includes("Two tasks are open.") ?? false);

    expect(document.querySelector(".pling-dock")!.classList).toContain("is-open");
    expect(llm.received).toHaveLength(1);
    expect(llm.received[0]?.some((message) => message.content.includes("Summarize open tasks")))
      .toBe(true);
  });

  it("keeps human task buttons out of the action registry", async () => {
    const pling = setup(createReplayLlm([]));
    await render(
      <PlingProvider pling={pling}>
        <button
          data-task-entry="summary"
          onClick={() => void pling.ask("Summarize open tasks")}
        >
          Summarize open tasks
        </button>
        <AgentDock />
      </PlingProvider>,
    );

    expect(document.querySelector('[data-task-entry="summary"]')).not.toBeNull();
    expect(pling.registry.snapshot().actions.map((action) => action.id)).not.toContain("summary");
  });

  it("supports a conversation embedded in the page grid", async () => {
    const llm = createReplayLlm([{ content: "Inline reply." }]);
    const pling = setup(llm);
    await render(
      <PlingProvider pling={pling}>
        <AgentInline />
      </PlingProvider>,
    );

    expect(document.querySelector(".pling-dock")!.getAttribute("data-layout")).toBe("inline");
    expect(document.querySelector(".pling-dock__launcher")).toBeNull();
    expect(document.querySelector(".pling-dock__panel")).not.toBeNull();
    expect([...document.querySelectorAll(".pling-dock__ghost")]
      .some((button) => button.textContent?.includes("Collapse"))).toBe(false);

    await act(async () => pling.ask("Where am I?"));
    await waitFor(() => document.body.textContent?.includes("Inline reply.") ?? false);
    expect(llm.received).toHaveLength(1);
  });

  it("fails explicitly when no surface is mounted", async () => {
    const pling = setup();
    await expect(pling.ask("orphan task")).rejects.toMatchObject({
      code: "PLING_TASK_SURFACE_MISSING",
    });
  });
});
