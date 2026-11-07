import { afterEach, describe, expect, it, vi } from "vitest";
import { checkActionable, performPrimitive } from "../src";

afterEach(() => {
  document.body.innerHTML = "";
});

function mount<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  document.body.append(element);
  return element;
}

describe("@plingjs/dom · shared form primitives", () => {
  it("writes an input and emits bubbling input + change events once each", () => {
    const input = mount("input");
    const inputEvent = vi.fn();
    const changeEvent = vi.fn();
    input.addEventListener("input", inputEvent);
    input.addEventListener("change", changeEvent);

    performPrimitive(input, "type", { text: "Milk" });

    expect(input.value).toBe("Milk");
    expect(input).toBe(document.activeElement);
    expect(inputEvent).toHaveBeenCalledOnce();
    expect(changeEvent).toHaveBeenCalledOnce();
    expect((inputEvent.mock.calls[0]![0] as Event).bubbles).toBe(true);
  });

  it("uses the same value contract for textarea", () => {
    const textarea = mount("textarea");
    performPrimitive(textarea, "type", { text: "Two lines\nof notes" });
    expect(textarea.value).toBe("Two lines\nof notes");
  });

  it("writes contenteditable text and sends composed input plus change", () => {
    const editor = mount("div");
    editor.setAttribute("contenteditable", "true");
    const inputEvent = vi.fn();
    const changeEvent = vi.fn();
    editor.addEventListener("input", inputEvent);
    editor.addEventListener("change", changeEvent);

    performPrimitive(editor, "type", { text: "Draft reply" });

    expect(editor.textContent).toBe("Draft reply");
    expect(inputEvent).toHaveBeenCalledOnce();
    expect(changeEvent).toHaveBeenCalledOnce();
    expect((inputEvent.mock.calls[0]![0] as Event).composed).toBe(true);
  });

  it("sets every selected value on a multiple select", () => {
    const select = mount("select");
    select.multiple = true;
    for (const value of ["red", "green", "blue"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    }
    const inputEvent = vi.fn();
    const changeEvent = vi.fn();
    select.addEventListener("input", inputEvent);
    select.addEventListener("change", changeEvent);

    performPrimitive(select, "select", { value: ["blue", "red"] });

    expect([...select.selectedOptions].map((option) => option.value)).toEqual(["red", "blue"]);
    expect(inputEvent).toHaveBeenCalledOnce();
    expect(changeEvent).toHaveBeenCalledOnce();
  });

  it("keeps a single select single-valued and emits change", () => {
    const select = mount("select");
    for (const value of ["open", "closed"]) {
      const option = document.createElement("option");
      option.value = value;
      select.append(option);
    }
    const changeEvent = vi.fn();
    select.addEventListener("change", changeEvent);

    performPrimitive(select, "select", { value: "closed" });

    expect(select.value).toBe("closed");
    expect(changeEvent).toHaveBeenCalledOnce();
  });

  it("submits the owning form when Enter is pressed in a text input", () => {
    const form = mount("form");
    const input = document.createElement("input");
    form.append(input);
    const submit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener("submit", submit);

    performPrimitive(input, "press", { key: "Enter" });

    expect(submit).toHaveBeenCalledOnce();
  });

  it("writes and submits inputs created in a same-origin iframe realm", () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error("iframe document unavailable");

    const form = frameDocument.createElement("form");
    const input = frameDocument.createElement("input");
    form.append(input);
    frameDocument.body.append(form);
    const submit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener("submit", submit);

    performPrimitive(input, "type", { text: "iframe notes" });
    performPrimitive(input, "press", { key: "Enter" });

    expect(input.value).toBe("iframe notes");
    expect(submit).toHaveBeenCalledOnce();
  });

  it("does not submit when a submit control or non-Enter key is used", () => {
    const form = mount("form");
    const submitInput = document.createElement("input");
    submitInput.type = "submit";
    const textInput = document.createElement("input");
    form.append(submitInput, textInput);
    const submit = vi.fn();
    form.addEventListener("submit", submit);

    performPrimitive(submitInput, "press", { key: "Enter" });
    performPrimitive(textInput, "press", { key: "Escape" });

    expect(submit).not.toHaveBeenCalled();
  });

  it("still explains native disabled state through the shared availability check", () => {
    const button = mount("button");
    button.disabled = true;
    expect(checkActionable(button)).toMatchObject({
      available: false,
      reasonKey: "availability.disabled",
    });
  });
});
