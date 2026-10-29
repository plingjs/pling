import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "../src/App";
import { copyFor, type DemoLocale } from "../src/copy";

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

async function mountApp(locale: DemoLocale = "en", llm = createReplayLlm([])) {
  const pling = createPling({
    presence: false,
    onWarn: () => {},
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: {
      config: {
        baseUrl: "/llm/v1",
        model: "test-model",
        limits: { maxTurns: 100 },
      },
      gate: () => false,
      llm,
    },
  });

  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <MemoryRouter initialEntries={["/tasks"]}>
          <App locale={locale} />
        </MemoryRouter>
      </PlingProvider>,
    );
  });

  return { llm, pling };
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

describe("R-13 · assistant surfaces and task entry points", () => {
  it("changes placement without mounting a second assistant", async () => {
    await mountApp();

    expect(document.querySelectorAll(".pling-dock")).toHaveLength(1);
    expect(document.querySelector(".pling-dock")!.getAttribute("data-layout")).toBe("dock");

    await click(document.querySelector('input[name="surface-layout"][value="sidebar"]'));
    await click(document.querySelector('input[name="surface-side"][value="left"]'));
    await click(document.querySelector('input[name="surface-launcher"][value="center"]'));

    const dock = document.querySelector(".pling-dock")!;
    expect(document.querySelectorAll(".pling-dock")).toHaveLength(1);
    expect(dock.getAttribute("data-layout")).toBe("sidebar");
    expect(dock.getAttribute("data-side")).toBe("left");
    expect(dock.getAttribute("data-launcher-placement")).toBe("center");
  });

  it("opens a collapsed dock and sends both human entrances into one history", async () => {
    const llm = createReplayLlm([
      { content: "Two tasks are open." },
      { content: "The launch checklist is first." },
    ]);
    await mountApp("en", llm);

    expect(document.querySelector(".pling-dock__panel")).toBeNull();
    await click(document.querySelector('[data-task-entry="summarize"]'));
    await waitFor(() => document.body.textContent?.includes("Two tasks are open.") ?? false);
    expect(document.querySelector(".pling-dock")!.classList).toContain("is-open");

    await click(document.querySelector('[data-task-entry="ask"]'));
    await waitFor(() => document.body.textContent?.includes("The launch checklist is first.") ?? false);

    expect(llm.received).toHaveLength(2);
    expect(llm.received[1]?.some((message) => message.content.includes("Summarize the open tasks")))
      .toBe(true);
    expect(llm.received[1]?.some((message) => message.content.includes("What is still open")))
      .toBe(true);
  });

  it("keeps human task buttons out of the model action list", async () => {
    const { pling } = await mountApp();
    const snapshot = pling.registry.snapshot();

    expect(document.querySelector('[data-task-entry="summarize"]')).not.toBeNull();
    expect(document.querySelector('[data-task-entry="ask"]')).not.toBeNull();
    expect(snapshot.actions.some((action) => action.id.includes("summarize"))).toBe(false);
    expect(snapshot.actions.some((action) => action.description.includes("What is still open")))
      .toBe(false);
  });

  it("localizes the surface controls and launcher", async () => {
    await mountApp("zh");
    const copy = copyFor("zh");

    expect(document.body.textContent).toContain(copy.surfaceHeading);
    expect(document.body.textContent).toContain(copy.openTasksTask);
    expect(document.querySelector(".pling-dock__launcher")!.textContent).toContain(copy.launcherText);
  });
});
