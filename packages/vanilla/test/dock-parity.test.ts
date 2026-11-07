import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReplayLlm, type AgentRuntime } from "@plingjs/agent";
import { MODEL_SETTINGS_STORAGE_KEY } from "../src/model-settings";
import { createPling, type VanillaPlingOptions } from "../src";
import { click, say, waitFor } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Vanilla dock placement parity", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("keeps a closed floating dock by default and labels its launcher", () => {
    const pling = createPling({ onWarn: () => {} });
    const dock = pling.dock({ launcherLabel: "Open copilot" });
    const root = dock.element;
    expect(root.dataset.layout).toBe("dock");
    expect(root.classList.contains("pling-dock--dock")).toBe(true);
    expect(dock.isOpen()).toBe(false);
    expect(root.querySelector(".pling-dock__panel")).toBeNull();
    expect(root.querySelector<HTMLElement>(".pling-dock__launcher")?.textContent).toContain("Open copilot");
    expect(root.querySelector<HTMLElement>(".pling-dock__launcher")?.title).toBe("Open copilot");
    dock.open();
    expect(dock.isOpen()).toBe(true);
    expect(root.querySelector(".pling-dock__panel")).not.toBeNull();
    dock.close();
    expect(root.querySelector(".pling-dock__panel")).toBeNull();
    pling.destroy();
  });

  it("supports a full-height sidebar with side and launcher placement", () => {
    const pling = createPling({ onWarn: () => {} });
    const dock = pling.dock({ layout: "sidebar", side: "left", launcherPlacement: "center", defaultOpen: true });
    const root = dock.element;
    expect(root.dataset).toMatchObject({
      layout: "sidebar",
      side: "left",
      launcherPlacement: "center",
    });
    expect(root.classList).toContain("pling-dock--sidebar");
    expect(root.classList).toContain("pling-dock--left");
    expect(root.classList).toContain("pling-dock--launcher-center");
    expect(root.querySelector(".pling-dock__panel")).not.toBeNull();
    expect(root.querySelector(".pling-dock__launcher")).not.toBeNull();
    pling.destroy();
  });

  it("supports an overlay or fused sidebar with the same dock runtime", () => {
    const pling = createPling({ onWarn: () => {} });
    const overlay = pling.dock({ layout: "sidebar", defaultOpen: true });
    expect(overlay.element.dataset.sidebarMode).toBe("overlay");
    expect(overlay.element.classList).not.toContain("pling-dock--fused");
    overlay.destroy();

    const fused = pling.dock({
      layout: "sidebar",
      sidebarMode: "fused",
      side: "left",
      defaultOpen: true,
    });
    expect(fused.element.dataset.sidebarMode).toBe("fused");
    expect(fused.element.classList).toContain("pling-dock--fused");
    expect(fused.element.classList).toContain("pling-dock--left");
    expect(fused.element.querySelector(".pling-dock__panel")).not.toBeNull();
    fused.destroy();
    pling.destroy();
  });

  it("keeps inline chat permanently visible, mounted in place, with no launcher or collapse control", () => {
    const mount = document.createElement("aside");
    document.body.append(mount);
    const pling = createPling({ onWarn: () => {} });
    const dock = pling.dock({ layout: "inline", mount });
    const root = dock.element;
    expect(root.parentElement).toBe(mount);
    expect(root.dataset.layout).toBe("inline");
    expect(dock.isOpen()).toBe(true);
    expect(root.querySelector(".pling-dock__panel")).not.toBeNull();
    expect(root.querySelector<HTMLElement>(".pling-dock__launcher")?.hidden).toBe(true);

    dock.close();
    expect(dock.isOpen()).toBe(true);
    expect(root.querySelector(".pling-dock__panel")).not.toBeNull();
    const close = root.querySelector<HTMLButtonElement>('.pling-dock__ghost[aria-label="Collapse"]');
    expect(close?.hidden).toBe(true);
    pling.destroy();
  });

  it("pling.ask() opens the dock and routes into its shared runtime", async () => {
    const llm = createReplayLlm([{ content: "Summary ready." }]);
    const pling = createPling({
      onWarn: () => {},
      agent: { config: { baseUrl: "/llm/v1", model: "test-model" }, gate: () => false, llm },
    });
    const dock = pling.dock();
    expect(dock.isOpen()).toBe(false);
    await pling.ask("Summarize the queue");
    expect(dock.isOpen()).toBe(true);
    expect(llm.received).toHaveLength(1);
    expect(document.querySelector(".pling-chat")?.textContent).toContain("Summary ready.");
    pling.destroy();
  });
});

describe("Vanilla dock structural parity", () => {
  it("keeps the Vue shell order, icon buttons, model status and run section", () => {
    const pling = createPling({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "app-model", stream: false },
        modelSettings: "readonly",
      },
    });
    const dock = pling.dock({ defaultOpen: true, quick: ["Summarize the page"] });
    const panel = dock.element.querySelector<HTMLElement>(".pling-dock__panel")!;
    const nav = panel.querySelector<HTMLElement>(".pling-dock__nav")!;
    const quick = panel.querySelector<HTMLElement>(".pling-dock__quick")!;
    const body = panel.querySelector<HTMLElement>(".pling-dock__body")!;
    const status = panel.querySelector<HTMLElement>(".pling-dock__status")!;

    expect(nav.querySelector<HTMLElement>(".pling-dock__tabs")?.getAttribute("role")).toBe("tablist");
    expect(nav.firstElementChild).toBe(nav.querySelector(".pling-dock__tabs"));
    expect(panel.firstElementChild?.classList.contains("pling-dock__warn")).toBe(true);
    expect(panel.children[1]).toBe(nav);
    expect([...panel.children].indexOf(nav)).toBeLessThan([...panel.children].indexOf(quick));
    expect([...panel.children].indexOf(quick)).toBeLessThan([...panel.children].indexOf(body));
    expect([...panel.children].indexOf(body)).toBeLessThan([...panel.children].indexOf(status));

    for (const label of ["Clear", "Collapse"]) {
      const control = panel.querySelector<HTMLButtonElement>(`.pling-dock__ghost[aria-label="${label}"]`);
      expect(control?.title).toBe(label);
      expect(control?.textContent).toBe("");
      expect(control?.querySelector("svg.pling-dock__icon")).not.toBeNull();
    }

    const launcher = dock.element.querySelector<HTMLButtonElement>(".pling-dock__launcher");
    expect(launcher?.getAttribute("aria-expanded")).toBe("true");

    const model = panel.querySelector<HTMLButtonElement>('[data-testid="pling-model-settings-toggle"]');
    expect(model?.getAttribute("aria-label")).toBe("Model settings");
    expect(model?.getAttribute("aria-expanded")).toBe("false");
    expect(model?.querySelector(".pling-dock__model-dot")).not.toBeNull();
    expect(model?.querySelector(".pling-dock__model-name")?.textContent).toBe("app-model");
    expect(model?.querySelector("svg.pling-dock__model-caret")).not.toBeNull();
    expect(panel.querySelector('[data-testid="pling-run-actions"] .pling-dock__run-head')).not.toBeNull();
    pling.destroy();
  });

  it("uses the same visual contract as the Vue dock", () => {
    const pling = createPling({ onWarn: () => {} });
    const dock = pling.dock({ defaultOpen: true, quick: ["Summarize the page"] });
    const styles = dock.element.querySelector("style")?.textContent ?? "";

    expect(dock.element.querySelector(".pling-chat")).not.toBeNull();
    expect(styles).toContain(
      ".pling-chat{display:flex;flex-direction:column;gap:8px;flex:1;height:100%;min-height:0;padding:12px;border:1px solid var(--pling-color-border,#ddd);border-radius:var(--pling-radius-md,8px);background:var(--pling-color-surface,#fff);color:var(--pling-color-text,#0f172a);font-size:13px;line-height:1.5;text-align:left}",
    );
    expect(styles).toContain(
      ".pling-dock__quick button{padding:3px 8px;border:1px solid var(--pling-color-border,#cbd5e1);border-radius:999px;background:var(--pling-color-surface-muted,#f8fafc);color:var(--pling-color-text-muted,#334155);font-size:12px;cursor:pointer}",
    );
    expect(styles).toContain(
      ".pling-chat__composer button{padding:6px 12px;border:0;border-radius:var(--pling-radius-sm,6px);background:var(--pling-color-primary,#2e9df7);color:var(--pling-color-on-primary,#fff);cursor:pointer}",
    );
    pling.destroy();
  });
});

describe("Vanilla dock model settings", () => {
  function openActivity(): void {
    const tab = [...document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")]
      .find((button) => button.textContent?.includes("Activity"));
    click(tab ?? null);
  }

  it("does not render a settings entry when model settings are off", () => {
    const pling = createPling({ onWarn: () => {} });
    pling.dock({ defaultOpen: true });
    openActivity();
    expect(document.querySelector('[data-testid="pling-model-settings-toggle"]')).toBeNull();
    pling.destroy();
  });

  it("shows a read-only managed endpoint without exposing the application key", () => {
    const pling = createPling({
      onWarn: () => {},
      agent: {
        config: {
          baseUrl: "https://gateway.example/v1",
          model: "managed-model",
          apiKey: "server-only-secret",
          stream: false,
        },
        modelSettings: "readonly",
      },
    });
    pling.dock({ defaultOpen: true });
    openActivity();
    click(document.querySelector('[data-testid="pling-model-settings-toggle"]'));
    const panel = document.querySelector('[data-testid="pling-model-settings"]');
    expect(panel?.textContent).toContain("Managed by this application");
    expect(panel?.textContent).toContain("https://gateway.example/v1");
    expect(panel?.textContent).toContain("managed-model");
    expect(panel?.querySelector("input")).toBeNull();
    expect(panel?.textContent).not.toContain("server-only-secret");
    pling.destroy();
  });

  it("saves a BYOK connection, replaces the runtime, and keeps the key in memory by default", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ content?: string }> };
      const question = body.messages?.at(-1)?.content;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: question === "second question" ? "second answer" : "first answer" } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const pling = createPling({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "app-model", stream: false },
        modelSettings: "byok",
        gate: () => false,
      },
    });
    const dock = pling.dock({ defaultOpen: true });
    const oldRuntime = dock.runtime;

    say("first question");
    await waitFor(() => document.querySelector(".pling-chat")?.textContent?.includes("first answer") ?? false);

    openActivity();
    click(document.querySelector('[data-testid="pling-model-settings-toggle"]'));
    const base = document.querySelector<HTMLInputElement>('[data-testid="pling-model-base-url"]')!;
    const model = document.querySelector<HTMLInputElement>('[data-testid="pling-model-name"]')!;
    const key = document.querySelector<HTMLInputElement>('[data-testid="pling-model-api-key"]')!;
    base.value = "https://example.test/v1";
    model.value = "own-model";
    key.value = "sk-test";
    document.querySelector<HTMLFormElement>(".model-settings__form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await waitFor(() => dock.runtime !== oldRuntime);
    const runtime = dock.runtime as AgentRuntime;
    expect(runtime.config).toMatchObject({ baseUrl: "https://example.test/v1", model: "own-model", apiKey: "sk-test" });
    expect(runtime.readiness.ready).toBe(true);
    expect(document.querySelector(".pling-chat")?.textContent).toContain("Model changed to own-model");
    expect(document.querySelector(".pling-chat")?.textContent).not.toContain("first question");
    expect(window.sessionStorage.getItem(MODEL_SETTINGS_STORAGE_KEY)).toBeNull();

    say("second question");
    await waitFor(() => document.querySelector(".pling-chat")?.textContent?.includes("second answer") ?? false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect(JSON.parse(String(request.body))).toMatchObject({ model: "own-model" });
    pling.destroy();
  });

  it("restores an explicitly persisted BYOK connection from sessionStorage", () => {
    window.sessionStorage.setItem(
      MODEL_SETTINGS_STORAGE_KEY,
      JSON.stringify({ baseUrl: "https://session.example/v1", model: "session-model", apiKey: "sk-session" }),
    );
    const pling = createPling({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "app-model", stream: false },
        modelSettings: { mode: "byok", persist: "session" },
      },
    });
    const dock = pling.dock({ defaultOpen: true });
    expect(dock.runtime.config).toMatchObject({
      baseUrl: "https://session.example/v1",
      model: "session-model",
      apiKey: "sk-session",
    });
    openActivity();
    click(document.querySelector('[data-testid="pling-model-settings-toggle"]'));
    expect(document.querySelector<HTMLInputElement>('[data-testid="pling-model-base-url"]')?.value).toBe(
      "https://session.example/v1",
    );
    expect(document.querySelector<HTMLInputElement>('[data-testid="pling-model-name"]')?.value).toBe("session-model");
    expect(document.querySelector<HTMLInputElement>('[data-testid="pling-model-api-key"]')?.value).toBe("sk-session");
    pling.destroy();
  });
});

describe("Vanilla dock debug inspector", () => {
  function setupDebug(
    enabled: boolean,
    options: VanillaPlingOptions = {},
    dockOptions: Parameters<ReturnType<typeof createPling>["dock"]>[0] = {},
  ) {
    const llm = createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "I saved it." }]);
    const pling = createPling({
      ...options,
      onWarn: () => {},
      ui: { locale: "en-US" },
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm,
        ...(options.agent ?? {}),
      },
    });
    const button = document.createElement("button");
    button.textContent = "Save";
    document.body.append(button);
    pling.tool(button, { id: "save", desc: "Save the draft" });
    const dock = pling.dock({ defaultOpen: true, debug: enabled, ...dockOptions });
    return { pling, dock, llm };
  }

  function openActivity(): void {
    const tab = [...document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")]
      .find((button) => button.textContent?.includes("Activity"));
    click(tab ?? null);
  }

  it("is absent unless tracing is enabled", () => {
    const { pling } = setupDebug(false);
    openActivity();
    expect(document.querySelector('[data-testid="pling-debug-toggle"]')).toBeNull();
    expect(document.querySelector('[data-testid="pling-debug"]')).toBeNull();
    pling.destroy();
  });

  it("keeps quick tasks in Chat and diagnostics in Activity", () => {
    const { pling } = setupDebug(true, {}, { quick: ["Do one thing"] });
    const quick = document.querySelector<HTMLElement>('.pling-dock__quick');
    const activity = document.querySelector<HTMLElement>('.pling-dock__activity-view');
    const debug = document.querySelector<HTMLElement>('[data-testid="pling-debug-toggle"]');
    expect(quick?.hidden).toBe(false);
    expect(activity?.hidden).toBe(true);
    expect(debug?.closest<HTMLElement>('.pling-dock__activity-view')?.hidden).toBe(true);
    openActivity();
    expect(document.querySelector<HTMLElement>('.pling-dock__quick')?.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.pling-dock__activity-view')?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('[data-testid="pling-debug-toggle"]')?.hidden).toBe(false);
    pling.destroy();
  });

  it("mounts only the latest request body and moves the mounted body when another call is expanded", async () => {
    const { pling } = setupDebug(true);
    say("Inspect this run");
    await waitFor(() => document.querySelector(".pling-chat")?.textContent?.includes("I saved it.") ?? false);
    openActivity();
    click(document.querySelector('[data-testid="pling-debug-toggle"]'));

    expect(document.querySelector('[data-testid="pling-call-body-1"]')).toBeNull();
    expect(document.querySelector('[data-testid="pling-call-body-2"]')?.textContent).toContain("Inspect this run");
    expect(document.querySelector('[data-testid="pling-call-body-2"]')?.textContent).toContain("I saved it.");

    const summaries = document.querySelectorAll<HTMLElement>(".debug__call > summary");
    click(summaries[0] ?? null);
    expect(document.querySelector('[data-testid="pling-call-body-1"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="pling-call-body-2"]')).toBeNull();

    click(document.querySelectorAll<HTMLElement>(".debug__call > summary")[1] ?? null);
    expect(document.querySelector('[data-testid="pling-call-body-1"]')).toBeNull();
    expect(document.querySelector('[data-testid="pling-call-body-2"]')).not.toBeNull();
    pling.destroy();
  });

  it("reports active scopes separately from each scope's visible and total actions", () => {
    const { pling } = setupDebug(true);
    const orders = document.createElement("section");
    const closed = document.createElement("section");
    const first = document.createElement("button");
    const second = document.createElement("button");
    first.textContent = "Approve";
    second.textContent = "Reject";
    orders.append(first, second);
    document.body.append(orders, closed);
    pling.scope(orders, { id: "orders", label: "Orders", role: "list" });
    pling.scope(closed, { id: "closed", label: "Closed orders", role: "list" });
    pling.tool(first, { id: "approve", desc: "Approve an order" });
    pling.tool(second, { id: "reject", desc: "Reject an order" });
    pling.scopes.setScopeInView("closed", false);
    pling.setActiveScopes(["orders"]);
    pling.scopes.setVisible(first, false);

    openActivity();
    click(document.querySelector('[data-testid="pling-debug-toggle"]'));
    const debug = document.querySelector('[data-testid="pling-debug"]');
    const scopesHead = [...debug?.querySelectorAll<HTMLElement>(".debug__subhead") ?? []]
      .find((head) => head.querySelector("strong")?.textContent === "Scopes");
    expect(scopesHead?.querySelector("span")?.textContent?.trim()).toBe("1 active · 2 known");
    expect(debug?.textContent).toContain("Orders");
    expect(debug?.textContent).toContain("1 / 2");
    pling.destroy();
  });

  it("shows the page projection and the exact request without execution controls", async () => {
    const { pling } = setupDebug(true);
    say("Inspect this run");
    await waitFor(() => document.querySelector(".pling-chat")?.textContent?.includes("I saved it.") ?? false);
    openActivity();
    click(document.querySelector('[data-testid="pling-debug-toggle"]'));
    await waitFor(() => Boolean(document.querySelector('[data-testid="pling-debug"]')));
    const debug = document.querySelector('[data-testid="pling-debug"]');
    expect(debug?.textContent).toContain("Read-only inspector");
    expect(debug?.textContent).toContain("save");
    expect(debug?.textContent).toContain("Request messages");
    expect(debug?.textContent).toContain("Inspect this run");
    expect(debug?.textContent).toContain("I saved it.");
    expect(debug?.querySelector('[aria-label="Run"]')).toBeNull();
    pling.destroy();
  });

  it("clears request traces together with the conversation", async () => {
    const { pling } = setupDebug(true);
    say("Inspect this run");
    await waitFor(() => document.querySelector(".pling-chat")?.textContent?.includes("I saved it.") ?? false);
    openActivity();
    click(document.querySelector('[data-testid="pling-debug-toggle"]'));
    expect(document.querySelector('[data-testid="pling-debug"]')?.textContent).toContain("Inspect this run");
    const clear = document.querySelector<HTMLButtonElement>('.pling-dock__ghost[aria-label="Clear"]');
    click(clear ?? null);
    await waitFor(() => document.querySelector('[data-testid="pling-debug"]')?.textContent?.includes("No model calls yet") ?? false);
    pling.destroy();
  });

  it("inspects the registry used by this conversation", () => {
    const { pling } = setupDebug(true);
    pling.registry.setPage({ title: "Custom runtime page", path: "/custom" });
    openActivity();
    click(document.querySelector('[data-testid="pling-debug-toggle"]'));
    const debug = document.querySelector('[data-testid="pling-debug"]');
    expect(debug?.textContent).toContain("Custom runtime page");
    expect(debug?.textContent).toContain("/custom");
    pling.destroy();
  });
});
