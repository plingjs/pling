import { afterEach, describe, expect, it, vi } from "vitest";
import { createPling } from "../src";
import { allowAll } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Vanilla native primitives", () => {
  it("infers and executes click for checkbox controls", async () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    document.body.append(checkbox);
    const pling = createPling({ onWarn: () => {} });
    pling.tool(checkbox, { id: "toggle", desc: "Toggle the setting" });

    expect(pling.registry.snapshot().actions[0]).toMatchObject({
      id: "toggle",
      primitive: "click",
      fidelity: "high",
    });
    await allowAll(pling.registry).execute("toggle", "{}");
    expect(checkbox.checked).toBe(true);
    pling.destroy();
  });

  it("infers type for textarea and emits input plus change", async () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    const input = vi.fn();
    const change = vi.fn();
    textarea.addEventListener("input", input);
    textarea.addEventListener("change", change);
    const pling = createPling({ onWarn: () => {} });
    pling.tool(textarea, { id: "note", desc: "Write a note" });

    expect(pling.registry.snapshot().actions[0]?.primitive).toBe("type");
    await allowAll(pling.registry).execute("note", JSON.stringify({ text: "Call Alice" }));
    expect(textarea.value).toBe("Call Alice");
    expect(input).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledOnce();
    pling.destroy();
  });

  it("infers select and supports single and multiple values", async () => {
    const single = document.createElement("select");
    single.innerHTML = '<option value="a">A</option><option value="b">B</option>';
    const multiple = document.createElement("select");
    multiple.multiple = true;
    multiple.innerHTML = '<option value="a">A</option><option value="b">B</option><option value="c">C</option>';
    document.body.append(single, multiple);
    const pling = createPling({ onWarn: () => {} });
    pling.tool(single, { id: "single", desc: "Pick one" });
    pling.tool(multiple, { id: "multiple", desc: "Pick several" });

    const executor = allowAll(pling.registry);
    await executor.execute("single", JSON.stringify({ value: "b" }));
    await executor.execute("multiple", JSON.stringify({ value: ["a", "c"] }));
    expect(single.value).toBe("b");
    expect([...multiple.selectedOptions].map((option) => option.value)).toEqual(["a", "c"]);
    pling.destroy();
  });

  it("declares press explicitly and dispatches the requested keyboard sequence", async () => {
    const input = document.createElement("input");
    document.body.append(input);
    const keys: string[] = [];
    for (const type of ["keydown", "keypress", "keyup"]) {
      input.addEventListener(type, (event) => keys.push(`${type}:${(event as KeyboardEvent).key}`));
    }
    const pling = createPling({ onWarn: () => {} });
    pling.tool(input, { id: "escape", desc: "Dismiss the suggestion list", action: "press" });

    expect(pling.registry.snapshot().actions[0]).toMatchObject({ primitive: "press", fidelity: "high" });
    await allowAll(pling.registry).execute("escape", JSON.stringify({ key: "Escape" }));
    expect(keys).toEqual(["keydown:Escape", "keypress:Escape", "keyup:Escape"]);
    pling.destroy();
  });

  it("declares hover explicitly and dispatches pointer and mouse entry events", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "More";
    document.body.append(trigger);
    const events: string[] = [];
    for (const type of ["pointerover", "pointerenter", "mouseover", "mouseenter"]) {
      trigger.addEventListener(type, () => events.push(type));
    }
    const pling = createPling({ onWarn: () => {} });
    pling.tool(trigger, { id: "open_menu", desc: "Show the row menu", action: "hover" });

    expect(pling.registry.snapshot().actions[0]?.primitive).toBe("hover");
    await allowAll(pling.registry).execute("open_menu", "{}");
    expect(events).toEqual(["pointerover", "pointerenter", "mouseover", "mouseenter"]);
    pling.destroy();
  });
});

describe("Vanilla target resolution", () => {
  it("finds the single native control inside a wrapper and really clicks it", async () => {
    const wrapper = document.createElement("div");
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    wrapper.append(trigger);
    document.body.append(wrapper);
    const clicked = vi.fn();
    trigger.addEventListener("click", clicked);
    const warnings: string[] = [];
    const pling = createPling({ onWarn: (message) => warnings.push(message) });
    pling.tool(wrapper, { id: "open", desc: "Open the record" });

    expect(pling.registry.snapshot().actions[0]?.fidelity).toBe("auto");
    await allowAll(pling.registry).execute("open", "{}");
    expect(clicked).toHaveBeenCalledOnce();
    expect(warnings).toEqual([]);
    pling.destroy();
  });

  it("uses an explicit selector to disambiguate multiple candidates", async () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = '<button class="a">A</button><button class="b">B</button>';
    document.body.append(wrapper);
    const a = vi.fn();
    const b = vi.fn();
    wrapper.querySelector(".a")!.addEventListener("click", a);
    wrapper.querySelector(".b")!.addEventListener("click", b);
    const pling = createPling({ onWarn: () => {} });
    pling.tool(wrapper, { id: "pick_b", desc: "Choose B", target: "button.b" });

    expect(pling.registry.snapshot().actions[0]?.fidelity).toBe("high");
    await allowAll(pling.registry).execute("pick_b", "{}");
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
    pling.destroy();
  });

  it("explains ambiguous and opted-out targets instead of silently clicking the wrapper", () => {
    const ambiguousWrapper = document.createElement("div");
    ambiguousWrapper.innerHTML = "<button>A</button><button>B</button>";
    const optedOutWrapper = document.createElement("div");
    optedOutWrapper.innerHTML = "<button>C</button><button>D</button>";
    document.body.append(ambiguousWrapper, optedOutWrapper);
    const warnings: string[] = [];
    const pling = createPling({ onWarn: (message) => warnings.push(message) });
    pling.tool(ambiguousWrapper, { id: "ambiguous", desc: "Choose one" });
    pling.tool(optedOutWrapper, { id: "opted_out", desc: "Use the wrapper", autoTarget: false });

    expect(pling.registry.snapshot().actions).toMatchObject([
      { id: "ambiguous", fidelity: "low" },
      { id: "opted_out", fidelity: "low" },
    ]);
    expect(warnings.join("\n")).toContain("内层找到 2 个候选元素");
    expect(warnings.join("\n")).toContain("既不是原生可交互元素");
    pling.destroy();
  });
});
