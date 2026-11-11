import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlingPage, sensitive } from "../src";
import { createPling } from "../src";
import { allowAll, click } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Vanilla public contract", () => {
  it("exposes the same runtime capabilities as the framework adapters", () => {
    const pling = createPling({ onWarn: () => {} });
    expect(pling).toEqual(
      expect.objectContaining({
        ui: expect.any(Object),
        registry: expect.any(Object),
        scopes: expect.any(Object),
        task: expect.any(Object),
        feedback: expect.any(Object),
        page: expect.any(Object),
        ask: expect.any(Function),
        tool: expect.any(Function),
        action: expect.any(Function),
        record: expect.any(Function),
        scope: expect.any(Function),
        state: expect.any(Function),
        declareFeedback: expect.any(Function),
        declareTask: expect.any(Function),
        guideTarget: expect.any(Function),
        setActiveScopes: expect.any(Function),
        dock: expect.any(Function),
        surfaceGateway: expect.any(Function),
        inspectCoverage: expect.any(Function),
        derived: expect.any(Function),
        destroy: expect.any(Function),
      }),
    );
    expect(Object.keys(pling)).toEqual(expect.arrayContaining(["presence", "revealSensitive"]));
    pling.destroy();
  });

  it("keeps sensitive values tokenized in records and state", () => {
    const row = document.createElement("li");
    document.body.append(row);
    const pling = createPling({ onWarn: () => {} });
    pling.record(row, {
      id: "customer_1",
      data: {
        name: "Ada",
        phone: sensitive("13812341234"),
        idCard: sensitive("110101199001011234", "masked"),
      },
    });
    pling.state("account", () => ({ phone: sensitive("13700000000"), tier: "gold" }));

    const snapshot = pling.registry.snapshot();
    expect(snapshot.records[0]?.fields).toMatchObject({ name: "Ada", phone: "[hidden]", idCard: "110***********1234" });
    expect(snapshot.state.account).toMatchObject({ phone: "[hidden]", tier: "gold" });
    expect(JSON.stringify(snapshot)).not.toContain("13812341234");
    expect(JSON.stringify(snapshot)).not.toContain("13700000000");
    pling.destroy();
  });

  it("surfaces a failed expectation as EXPECTATION_FAILED after the action ran", async () => {
    const button = document.createElement("button");
    document.body.append(button);
    const run = vi.fn();
    const pling = createPling({ onWarn: () => {} });
    pling.tool(button, {
      id: "submit",
      desc: "Submit",
      run,
      expect: { desc: "Receipt appeared", check: () => false, timeout: 30 },
    });

    const output = await allowAll(pling.registry).execute("submit", "{}");
    expect(output).toMatchObject({ error: { code: "EXPECTATION_FAILED" } });
    expect((output as { error: { message: string } }).error.message).toContain("Receipt appeared");
    expect(run).toHaveBeenCalledOnce();
    pling.destroy();
  });

  it("paints presence by default and can disable it without changing execution", async () => {
    vi.useFakeTimers();
    const button = document.createElement("button");
    document.body.append(button);
    const pling = createPling({ onWarn: () => {} });
    pling.tool(button, { id: "save", desc: "Save" });
    await allowAll(pling.registry).execute("save", "{}");
    const ring = document.querySelector<HTMLElement>("[data-pling-presence]");
    expect(ring).not.toBeNull();
    expect(ring?.hasAttribute("data-pling-ui")).toBe(true);
    vi.advanceTimersByTime(800);
    expect(document.querySelector("[data-pling-presence]")).toBeNull();
    pling.destroy();

    const quiet = createPling({ onWarn: () => {}, presence: false });
    quiet.tool(button, { id: "save_quiet", desc: "Save" });
    await allowAll(quiet.registry).execute("save_quiet", "{}");
    expect(document.querySelector("[data-pling-presence]")).toBeNull();
    quiet.destroy();
  });

  it("declares guide targets without turning them into actions", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const pling = createPling({ onWarn: () => {} });
    const unbind = pling.guideTarget(input, "captcha", { label: "验证码", description: "由用户填写" });
    expect(pling.registry.snapshot().actions).toEqual([]);
    expect(pling.registry.snapshot().guideTargets).toMatchObject([
      { id: "captcha", label: "验证码", description: "由用户填写" },
    ]);
    unbind();
    expect(pling.registry.snapshot().guideTargets).toEqual([]);
    pling.destroy();
  });

  it("shares one registry between framework islands without letting one island destroy the page", () => {
    const page = createPlingPage();
    const first = createPling({ shared: page, namespace: "vue", onWarn: () => {} });
    const second = createPling({ shared: page, namespace: "vanilla", onWarn: () => {} });
    const button = document.createElement("button");
    document.body.append(button);
    first.action({ id: "save", desc: "Save from Vue", run: () => {} });
    second.action({ id: "save", desc: "Save from vanilla", run: () => {} });

    expect(page.registry.snapshot().actions.map((action) => action.id).sort()).toEqual(["vanilla/save", "vue/save"]);
    first.destroy();
    expect(page.registry.snapshot().actions.map((action) => action.id)).toEqual(["vanilla/save"]);
    second.destroy();
    page.destroy();
  });

  it("runs a parameterized action through the same executor", async () => {
    const pling = createPling({ onWarn: () => {} });
    const run = vi.fn();
    pling.action({
      id: "move",
      desc: "Move an item",
      params: [{ name: "position", label: "Position", type: "number" }],
      run,
    });
    await allowAll(pling.registry).execute("move", JSON.stringify({ position: "2" }));
    expect(run).toHaveBeenCalledWith({ position: 2 });
    pling.destroy();
  });

  it("clicking an explicit task entrance never registers another action", () => {
    const entrance = document.createElement("button");
    document.body.append(entrance);
    const pling = createPling({ onWarn: () => {} });
    const ask = vi.spyOn(pling.task, "ask").mockResolvedValue();
    pling.declareTask(entrance, "Review the queue");
    click(entrance);
    expect(ask).toHaveBeenCalledWith("Review the queue", { source: entrance });
    expect(pling.registry.snapshot().actions).toEqual([]);
    pling.destroy();
  });
});
