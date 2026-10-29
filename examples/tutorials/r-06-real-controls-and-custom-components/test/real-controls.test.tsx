import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentLoop, createReplayLlm } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling, PlingProvider, usePlingTool } from "@plingjs/react";
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

async function mountApp(
  llm = createReplayLlm([]),
  locale: "en" | "zh" = "en",
) {
  const warnings: string[] = [];
  const pling = createPling({
    presence: false,
    onWarn: (message) => warnings.push(message),
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: {
      config: {
        baseUrl: "/llm/v1",
        model: "test-model",
        limits: { maxTurns: 100 },
      },
      llm,
    },
  });

  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <App locale={locale} />
      </PlingProvider>,
    );
  });

  return { llm, pling, warnings };
}

function taskTexts(): Array<string | null> {
  return Array.from(document.querySelectorAll(".task__text"))
    .map((node) => node.textContent);
}

function actionById(pling: ReturnType<typeof createPling>, id: string) {
  return pling.registry.snapshot().actions.find((action) => action.id === id);
}

async function setControlValue(
  element: HTMLInputElement | HTMLSelectElement,
  value: string,
): Promise<void> {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")!.set!;
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event(
      element instanceof HTMLSelectElement ? "change" : "input",
      { bubbles: true },
    ));
  });
}

async function fillDraft(text: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#new-task");
  if (!input) throw new Error("待办输入框不存在");
  await setControlValue(input, text);
}

async function choosePriority(value: string): Promise<void> {
  const select = document.querySelector<HTMLSelectElement>("#task-priority");
  if (!select) throw new Error("优先级选择框不存在");
  await setControlValue(select, value);
}

async function submitDraft(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>(".composer");
  if (!form) throw new Error("待办表单不存在");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function fillSearch(text: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(".search-box input");
  if (!input) throw new Error("搜索框不存在");
  await setControlValue(input, text);
}

async function pressSearchEnter(): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(".search-box input");
  if (!input) throw new Error("搜索框不存在");
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }));
  });
}

describe("R-06 · real controls and custom components", () => {
  it("keeps the manual workflow, including the selected priority", async () => {
    const { warnings } = await mountApp();

    await fillDraft("Prepare the launch notes");
    await choosePriority("later");
    await submitDraft();

    expect(taskTexts()[0]).toBe("Prepare the launch notes");
    expect(document.querySelector(".task .task__priority")?.textContent).toBe("Later");
    expect(document.querySelector<HTMLInputElement>("#new-task")?.value).toBe("");
    expect(warnings).toEqual([]);
  });

  it("uses Chinese copy for the page and every declared action", async () => {
    const { pling } = await mountApp(createReplayLlm([]), "zh");

    expect(document.querySelector("h1")?.textContent).toBe("待办");
    expect(document.querySelector("#task-priority option")?.textContent).toBe("今天");
    expect(document.querySelector<HTMLInputElement>(".search-box input")?.placeholder)
      .toBe("搜索待办，然后按 Enter");
    expect(document.querySelector<HTMLButtonElement>("button[data-filter='all']")?.textContent)
      .toBe("全部");
    expect(actionById(pling, "add_task")).toMatchObject({
      description: "使用提供的文本和新增区当前选中的优先级添加一条待办。",
    });
    expect(actionById(pling, "select_priority")).toMatchObject({
      description: "选择下一条通过 add_task 添加的待办所使用的优先级。",
    });
    expect(actionById(pling, "search_enter")).toMatchObject({
      description: "在待办搜索框中按 Enter，应用已经输入的短语。",
    });
  });

  it("keeps the region, records, and row toggles from R-05", async () => {
    const { pling } = await mountApp();
    const snapshot = pling.registry.snapshot();

    expect(snapshot.scopes.find((scope) => scope.id === "todo")).toMatchObject({
      label: "Tasks",
      description: "The task list, the composer, and the controls for finding and filtering tasks.",
      role: "main",
    });
    expect(snapshot.records[0]).toMatchObject({
      id: "t1",
      fields: { text: "Review the launch checklist", status: "open", priority: "Today" },
    });
    expect(snapshot.actions.map((action) => action.id)).toEqual(expect.arrayContaining([
      "add_task",
      "toggle@t1",
      "toggle@t2",
      "toggle@t3",
    ]));
  });

  it("publishes native, automatic, and explicitly targeted controls", async () => {
    const { pling, warnings } = await mountApp();

    expect(actionById(pling, "add_task")).toMatchObject({
      primitive: "click",
      fidelity: "high",
    });
    expect(actionById(pling, "select_priority")).toMatchObject({
      primitive: "select",
      fidelity: "high",
      params: {
        properties: {
          value: { enum: ["today", "soon", "later"] },
        },
      },
    });
    expect(actionById(pling, "search_text")).toMatchObject({
      primitive: "type",
      fidelity: "auto",
    });
    expect(actionById(pling, "search_enter")).toMatchObject({
      primitive: "press",
      fidelity: "auto",
    });
    expect(actionById(pling, "show_open_tasks")).toMatchObject({
      primitive: "click",
      fidelity: "high",
    });
    expect(actionById(pling, "open_bulk_menu")).toMatchObject({
      primitive: "hover",
      fidelity: "high",
    });
    expect(actionById(pling, "clear_completed")).toBeUndefined();
    expect(warnings).toEqual([]);
  });

  it("selects a priority through the native select and rejects unknown values", async () => {
    const { pling } = await mountApp();
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(null) });

    await expect(executor.execute(
      "select_priority",
      JSON.stringify({ value: "someday" }),
    )).resolves.toMatchObject({ error: { code: "INVALID_PARAMS" } });

    await act(async () => {
      await expect(executor.execute(
        "select_priority",
        JSON.stringify({ value: "later" }),
      )).resolves.toMatchObject({ result: { ok: true } });
    });

    expect(document.querySelector<HTMLSelectElement>("#task-priority")?.value).toBe("later");
    await fillDraft("Use the selected priority");
    await submitDraft();
    expect(document.querySelector(".task .task__priority")?.textContent).toBe("Later");
  });

  it("keeps search unapplied until Enter reaches the custom component's input", async () => {
    const { pling } = await mountApp();
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(null) });

    await act(async () => {
      await executor.execute("search_text", JSON.stringify({ text: "customer" }));
    });
    expect(taskTexts()).toHaveLength(3);

    await act(async () => {
      await executor.execute("search_enter", JSON.stringify({ key: "Enter" }));
    });
    expect(taskTexts()).toEqual(["Send the customer follow-up"]);
  });

  it("uses an explicit target inside a multi-button component", async () => {
    const { pling } = await mountApp();
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(null) });

    await act(async () => {
      await executor.execute("show_open_tasks", "{}");
    });
    expect(taskTexts()).toEqual([
      "Review the launch checklist",
      "Book the design review",
    ]);

    await act(async () => {
      await executor.execute("show_completed_tasks", "{}");
    });
    expect(taskTexts()).toEqual(["Send the customer follow-up"]);
  });

  it("reveals a later action with hover, then executes the native button", async () => {
    const { pling } = await mountApp();
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(async () => true) });

    expect(actionById(pling, "clear_completed")).toBeUndefined();
    await act(async () => {
      await expect(executor.execute("open_bulk_menu", "{}"))
        .resolves.toMatchObject({ result: { ok: true } });
    });

    expect(actionById(pling, "clear_completed")).toMatchObject({
      primitive: "click",
      kind: "danger",
      fidelity: "high",
    });

    await act(async () => {
      await executor.execute("clear_completed", "{}");
    });
    expect(taskTexts()).toEqual([
      "Review the launch checklist",
      "Book the design review",
    ]);
  });

  it("runs the control sequence end to end through the agent loop", async () => {
    const llm = createReplayLlm([
      {
        calls: [
          { tool: "select_priority", args: { value: "later" } },
          { tool: "add_task", args: { text: "Draft the release note" } },
          { tool: "search_text", args: { text: "release" } },
          { tool: "search_enter", args: { key: "Enter" } },
        ],
      },
      { content: "Added the task and filtered the list." },
    ]);
    const { pling, warnings } = await mountApp(llm);
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(null),
      llm,
      settle: async () => {},
    });

    let answer = "";
    await act(async () => {
      answer = await loop.run(
        "Add “Draft the release note” with later priority, then search for release.",
      );
    });

    expect(answer).toContain("Added the task and filtered the list.");
    expect(taskTexts()).toEqual(["Draft the release note"]);
    expect(document.querySelector(".task .task__priority")?.textContent).toBe("Later");
    expect(warnings).toEqual([]);
    expect(llm.toolsSeen[0]?.map((tool) => tool.function.name)).toEqual(
      expect.arrayContaining([
        "select_priority",
        "add_task",
        "search_text",
        "search_enter",
      ]),
    );
  });

  it("does not infer a target when autoTarget is off", async () => {
    function Wrappers() {
      const [clicked, setClicked] = useState(0);
      const lowRef = usePlingTool<HTMLDivElement>({
        id: "low_wrapper",
        desc: "A wrapper whose inner button is not the action target.",
        autoTarget: false,
      });
      const declaredRef = usePlingTool<HTMLDivElement>({
        id: "declared_wrapper",
        desc: "A wrapper that handles the click itself.",
        autoTarget: false,
        fidelity: "high",
      });

      return (
        <div>
          <div ref={lowRef}><button type="button">Inner</button></div>
          <div ref={declaredRef} onClick={() => setClicked((count) => count + 1)}>
            <button type="button">Inner</button>
            <span data-clicked>{clicked}</span>
          </div>
        </div>
      );
    }

    const warnings: string[] = [];
    const pling = createPling({
      presence: false,
      onWarn: (message) => warnings.push(message),
      ui: { locale: "en-US" },
    });
    await act(async () => {
      root!.render(
        <PlingProvider pling={pling}>
          <Wrappers />
        </PlingProvider>,
      );
    });

    expect(actionById(pling, "low_wrapper")?.fidelity).toBe("low");
    expect(actionById(pling, "declared_wrapper")?.fidelity).toBe("high");
    expect(warnings.some((message) => message.includes("low_wrapper"))).toBe(true);
    expect(warnings.some((message) => message.includes("declared_wrapper"))).toBe(false);

    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(null) });
    await act(async () => {
      await executor.execute("declared_wrapper", "{}");
    });
    expect(document.querySelector("[data-clicked]")?.textContent).toBe("1");
  });
});
