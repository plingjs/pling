import { afterEach, describe, expect, it, vi } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createPling, type PageRouteLike } from "../src";
import { click, say, waitFor } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/");
  document.title = "";
  window.sessionStorage.clear();
});

function dockHost(options: Parameters<typeof createPling>[0] = {}) {
  const llm = createReplayLlm([{ content: "Done." }, { content: "Also done." }]);
  const pling = createPling({
    ...options,
    onWarn: () => {},
    ui: { locale: "en-US", ...options.ui },
    agent: {
      config: { baseUrl: "/llm/v1", model: "test-model" },
      gate: () => false,
      llm,
    },
  });
  const dock = pling.dock({ defaultOpen: true });
  return { pling, dock, llm };
}

describe("task entrances", () => {
  it("sends one prompt through the shared surface and never becomes an action", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Summarize";
    document.body.append(trigger);
    const { pling, llm } = dockHost();
    pling.declareTask(trigger, "Summarize today's orders");

    expect(pling.registry.snapshot().actions.map((action) => action.id)).not.toContain("Summarize");
    click(trigger);
    await waitFor(() => llm.received.length === 1);
    expect(llm.received[0]?.some((message) => message.role === "user" && message.content.includes("Summarize today's orders"))).toBe(true);
    expect(document.querySelector(".pling-chat")?.textContent).toContain("Done.");
    pling.destroy();
  });

  it("shares the exact same history between declareTask and ask()", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const { pling, llm } = dockHost();
    pling.declareTask(trigger, "First task");
    click(trigger);
    await waitFor(() => llm.received.length === 1);
    await pling.ask("Second task");
    expect(llm.received).toHaveLength(2);
    expect(llm.received[1]?.some((message) => message.content.includes("First task"))).toBe(true);
    expect(llm.received[1]?.some((message) => message.content.includes("Second task"))).toBe(true);
    pling.destroy();
  });

  it("keeps a disabled task entrance inert and removes its declaration on dispose", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const { pling, llm } = dockHost();
    const dispose = pling.declareTask(trigger, { prompt: "Must not run", disabled: true });
    click(trigger);
    await Promise.resolve();
    expect(llm.received).toHaveLength(0);
    dispose();
    click(trigger);
    await Promise.resolve();
    expect(llm.received).toHaveLength(0);
    pling.destroy();
  });

  it("fails explicitly when no surface is mounted", async () => {
    const pling = createPling({ onWarn: () => {} });
    await expect(pling.ask("orphan task")).rejects.toMatchObject({ code: "PLING_TASK_SURFACE_MISSING" });
    pling.destroy();
  });

  it("can route to a named surface and rejects an unknown id", async () => {
    const llm = createReplayLlm([{ content: "Named." }]);
    const pling = createPling({
      onWarn: () => {},
      agent: { config: { baseUrl: "/llm/v1", model: "test-model" }, gate: () => false, llm },
    });
    const dock = pling.dock({ defaultOpen: true, surfaceId: "copilot" });
    await pling.ask("Named task", { surface: "copilot" });
    expect(llm.received).toHaveLength(1);
    await expect(pling.ask("Unknown", { surface: "missing" })).rejects.toMatchObject({
      code: "PLING_TASK_SURFACE_UNKNOWN",
    });
    dock.destroy();
    pling.destroy();
  });
});

describe("feedback", () => {
  it("declares static, dynamic and multiple feedback without exposing actions", () => {
    const host = document.createElement("form");
    document.body.append(host);
    const pling = createPling({ onWarn: () => {} });
    let message = "Customer is required";
    pling.declareFeedback(host, [
      { id: "customer", message: () => message, field: "customer", severity: "error" },
      { id: "amount", message: "Amount must be greater than zero", field: "amount", severity: "warning" },
    ]);

    expect(pling.registry.snapshot().feedback.map((item) => [item.id, item.message, item.severity])).toEqual([
      ["customer", "Customer is required", "error"],
      ["amount", "Amount must be greater than zero", "warning"],
    ]);
    expect(pling.registry.snapshot().actions).toEqual([]);
    message = "Customer name is too long";
    expect(pling.registry.snapshot().feedback[0]?.message).toBe("Customer name is too long");
    pling.destroy();
  });

  it("automatically collects explicit ARIA feedback and ignores framework UI", () => {
    const root = document.createElement("main");
    root.innerHTML = `
      <p role="alert">Save failed</p>
      <p role="status">Saved</p>
      <p aria-live="assertive">Out of stock</p>
      <label for="customer">Customer</label>
      <input id="customer" aria-invalid="true" aria-errormessage="customer-error" />
      <p id="customer-error">Customer is required</p>
      <div data-pling-ui><p role="alert">Framework message</p></div>
    `;
    document.body.append(root);
    const pling = createPling({ onWarn: () => {} });
    pling.feedback.sync();
    expect(pling.registry.snapshot().feedback.map((item) => [item.message, item.severity, item.source])).toEqual(
      expect.arrayContaining([
        ["Save failed", "error", "aria"],
        ["Saved", "info", "aria"],
        ["Out of stock", "warning", "aria"],
        ["Customer is required", "error", "aria"],
      ]),
    );
    expect(pling.registry.snapshot().feedback.some((item) => item.message === "Framework message")).toBe(false);
    pling.destroy();
  });

  it("follows live DOM mutations and stops collecting after destroy", async () => {
    const pling = createPling({ onWarn: () => {} });
    const alert = document.createElement("p");
    alert.setAttribute("role", "alert");
    alert.textContent = "Upload failed";
    document.body.append(alert);
    pling.feedback.sync();
    expect(pling.registry.snapshot().feedback.map((item) => item.message)).toContain("Upload failed");
    alert.remove();
    pling.feedback.sync();
    expect(pling.registry.snapshot().feedback.map((item) => item.message)).not.toContain("Upload failed");
    pling.destroy();
  });

  it("keeps explicit feedback alive through refresh and removes it on dispose", () => {
    const host = document.createElement("p");
    document.body.append(host);
    const pling = createPling({ onWarn: () => {} });
    const off = pling.declareFeedback(host, "Cannot save");
    pling.feedback.sync();
    expect(pling.registry.snapshot().feedback.filter((item) => item.message === "Cannot save")).toHaveLength(1);
    off();
    expect(pling.registry.snapshot().feedback).toEqual([]);
    pling.destroy();
  });
});

describe("page identity", () => {
  it("reads path and title while hiding query values by default", () => {
    window.history.replaceState({}, "", "/orders?token=secret&q=abc");
    document.title = "Order list";
    const pling = createPling({ onWarn: () => {} });
    expect(pling.registry.snapshot().page).toEqual({ path: "/orders", title: "Order list" });
    expect(JSON.stringify(pling.registry.snapshot().page)).not.toContain("secret");
    pling.destroy();
  });

  it("only includes query keys explicitly allowed by the developer", () => {
    window.history.replaceState({}, "", "/orders?token=secret&q=abc");
    const pling = createPling({ page: { queryKeys: ["q"] }, onWarn: () => {} });
    expect(pling.registry.snapshot().page?.query).toEqual({ q: "abc" });
    expect(JSON.stringify(pling.registry.snapshot().page)).not.toContain("secret");
    pling.destroy();
  });

  it("tracks pushState, replaceState, hash and title changes", async () => {
    const pling = createPling({ page: { queryKeys: ["tab"] }, onWarn: () => {} });
    window.history.pushState({}, "", "/orders/SO-1?tab=items#details");
    document.title = "Order SO-1";
    await vi.waitFor(() => {
      expect(pling.registry.snapshot().page).toMatchObject({
        path: "/orders/SO-1",
        title: "Order SO-1",
        query: { tab: "items" },
        hash: "#details",
      });
    });
    window.history.replaceState({}, "", "/orders/SO-2#activity");
    await vi.waitFor(() => expect(pling.registry.snapshot().page?.path).toBe("/orders/SO-2"));
    pling.destroy();
    window.history.pushState({}, "", "/after-destroy");
    expect(pling.registry.snapshot().page).toBeUndefined();
  });

  it("accepts a router-like object for name, params and meta title", async () => {
    const route: { value: PageRouteLike } = {
      value: {
        path: "/orders",
        name: "orders",
        params: {},
        query: { page: "1", token: "secret" },
        hash: "",
        meta: { title: "Orders" },
      },
    };
    const hooks = new Set<() => void>();
    const router = {
      currentRoute: route,
      afterEach(hook: () => void) {
        hooks.add(hook);
        return () => hooks.delete(hook);
      },
    };
    const pling = createPling({ page: { router, queryKeys: ["page"] }, onWarn: () => {} });
    expect(pling.registry.snapshot().page).toEqual({
      path: "/orders",
      title: "Orders",
      name: "orders",
      query: { page: "1" },
    });

    route.value = {
      path: "/orders/SO-2",
      name: "order-detail",
      params: { id: "SO-2" },
      query: {},
      hash: "#detail",
      meta: { title: "Order detail" },
    };
    for (const hook of hooks) hook();
    await vi.waitFor(() => {
      expect(pling.registry.snapshot().page).toMatchObject({
        path: "/orders/SO-2",
        title: "Order detail",
        name: "order-detail",
        params: { id: "SO-2" },
        hash: "#detail",
      });
    });
    pling.destroy();
  });

  it("can be disabled completely", () => {
    window.history.replaceState({}, "", "/orders");
    const pling = createPling({ page: false, onWarn: () => {} });
    expect(pling.registry.snapshot().page).toBeUndefined();
    pling.destroy();
  });
});

describe("coverage", () => {
  it("reports declared, grouped and missing controls without mutating actions", () => {
    const root = document.createElement("main");
    root.id = "coverage-root";
    root.innerHTML = `
      <button id="declared">Save</button>
      <input id="search" aria-label="Search orders" />
      <button id="disabled" disabled>Disabled</button>
      <div role="button" id="aria-disabled" aria-disabled="true">Disabled by ARIA</div>
      <section id="group"><button id="grouped">Grouped</button></section>
      <div role="button" id="custom">Custom</div>
      <div data-pling-ignore><button id="ignored">Ignored</button></div>
      <div data-pling-ui><button id="internal">Internal</button></div>
    `;
    document.body.append(root);
    const pling = createPling({ onWarn: () => {} });
    pling.tool(root.querySelector("#declared")!, { id: "save", desc: "Save" });
    pling.tool(root.querySelector("#group")!, { id: "toolbar_action", desc: "Toolbar action" });
    const before = pling.registry.snapshot().actions.map((action) => action.id);
    const report = pling.inspectCoverage(root);
    expect(report).toMatchObject({
      total: 4,
      declared: 1,
      derived: 0,
      grouped: 1,
      missing: 2,
      coveragePercent: 50,
    });
    expect(report.targets).toEqual(
      expect.arrayContaining([
        { element: "input#search", label: "Search orders", status: "missing" },
        { element: "button#grouped", label: "Grouped", status: "grouped", actions: ["toolbar_action"] },
        { element: "div#custom", label: "Custom", status: "missing" },
      ]),
    );
    expect(pling.registry.snapshot().actions.map((action) => action.id)).toEqual(before);
    pling.destroy();
  });

  it("counts derived actions and avoids fake percentages on empty pages", () => {
    const root = document.createElement("main");
    root.innerHTML = `<button id="refresh">Refresh</button>`;
    document.body.append(root);
    const pling = createPling({ derive: { root, observe: false }, onWarn: () => {} });
    expect(pling.inspectCoverage(root)).toMatchObject({ total: 1, derived: 1, coveragePercent: 100 });
    pling.destroy();
    root.remove();

    const empty = createPling({ onWarn: () => {} });
    expect(empty.inspectCoverage()).toMatchObject({ total: 0, coveragePercent: null, targets: [] });
    empty.destroy();
  });

  it("emits a dev diagnostic without registering missing controls", async () => {
    const root = document.createElement("main");
    root.innerHTML = `<button id="save">Save</button><input aria-label="Search orders" />`;
    document.body.append(root);
    const warnings: string[] = [];
    const pling = createPling({ diagnostics: true, onWarn: (message) => warnings.push(message) });
    pling.tool(root.querySelector("#save")!, { id: "save", desc: "Save" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warnings.some((message) => message.includes("1/2") && message.includes("pling.tool()"))).toBe(true);
    expect(pling.registry.snapshot().actions.map((action) => action.id)).toEqual(["save"]);
    pling.destroy();
  });
});
