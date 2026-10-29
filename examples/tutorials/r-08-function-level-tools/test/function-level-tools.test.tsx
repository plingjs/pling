import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildProtocol,
  createAgentLoop,
  createReplayLlm,
} from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling, PlingProvider } from "@plingjs/react";
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

type Locale = "en" | "zh";

async function mountApp(
  llm = createReplayLlm([]),
  locale: Locale = "en",
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
  if (!input) throw new Error("todo input is missing");
  await setControlValue(input, text);
}

async function choosePriority(value: string): Promise<void> {
  const select = document.querySelector<HTMLSelectElement>("#task-priority");
  if (!select) throw new Error("priority selector is missing");
  await setControlValue(select, value);
}

async function submitDraft(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>(".composer");
  if (!form) throw new Error("todo form is missing");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function click(selector: string): Promise<void> {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`element is missing: ${selector}`);
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function executorFor(pling: ReturnType<typeof createPling>) {
  return createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
    settle: async () => {
      await act(async () => {});
    },
  });
}

describe("R-08 · function-level tools", () => {
  it("keeps the manual Todo workflow unchanged", async () => {
    const { warnings } = await mountApp();

    await fillDraft("Prepare the launch notes");
    await choosePriority("later");
    await submitDraft();

    expect(taskTexts()[0]).toBe("Prepare the launch notes");
    expect(document.querySelector(".task .task__priority")?.textContent).toBe("Later");

    await click(".task__remove");
    expect(taskTexts()).toEqual([
      "Review the launch checklist",
      "Book the design review",
      "Send the customer follow-up",
    ]);
    expect(warnings).toEqual([]);
  });

  it("uses Chinese row data and action descriptions when locale is zh", async () => {
    const { pling } = await mountApp(createReplayLlm([]), "zh");

    expect(document.querySelector("h1")?.textContent).toBe("待办");
    expect(taskTexts()).toEqual(["检查发布清单", "预约设计评审", "跟进客户"]);
    expect(pling.registry.snapshot().records[0]).toMatchObject({
      id: "t1",
      fields: { text: "检查发布清单", status: "open", priority: "今天" },
    });
    expect(actionById(pling, "toggle@t1")?.description)
      .toBe("将“检查发布清单”标记为已完成。");
    expect(actionById(pling, "remove@t3")?.description)
      .toBe("删除“跟进客户”。此操作不可撤销。");
    expect(actionById(pling, "complete_open_tasks")?.description)
      .toBe("将所有未完成待办标记为已完成，并在一次操作中更新所有未完成记录。");
    await click(".pling-dock__launcher");
    expect(document.body.textContent).toContain("把所有未完成待办都标记为已完成");
  });

  it("exposes only declared record fields and folds repeated row actions", async () => {
    const { pling, warnings } = await mountApp();

    expect(pling.registry.snapshot().records).toEqual([
      {
        id: "t1",
        fields: { text: "Review the launch checklist", status: "open", priority: "Today" },
        scope: "todo",
        source: "declared",
      },
      {
        id: "t2",
        fields: { text: "Book the design review", status: "open", priority: "Soon" },
        scope: "todo",
        source: "declared",
      },
      {
        id: "t3",
        fields: { text: "Send the customer follow-up", status: "completed", priority: "Later" },
        scope: "todo",
        source: "declared",
      },
    ]);

    const protocol = buildProtocol(pling.registry.snapshot());
    expect(protocol.templates.get("toggle")).toMatchObject({
      template: "toggle@",
      records: ["t1", "t2", "t3"],
    });
    expect(protocol.templates.get("remove")).toMatchObject({
      template: "remove@",
      records: ["t1", "t2", "t3"],
    });
    expect(protocol.tools.find((tool) => tool.function.name === "toggle")?.function.parameters)
      .toMatchObject({
        properties: { record: { type: "string" } },
        required: ["record"],
      });
    expect(protocol.tools.map((tool) => tool.function.name)).not.toContain("toggle_t1");
    expect(warnings).toEqual([]);
  });

  it("registers a call primitive without a DOM target or record template", async () => {
    const { pling, warnings } = await mountApp();

    expect(actionById(pling, "complete_open_tasks")).toMatchObject({
      id: "complete_open_tasks",
      primitive: "call",
      description: "Mark every open task as completed. This changes all open records in one operation.",
      kind: "write",
      fidelity: "high",
      source: "declared",
    });

    const protocol = buildProtocol(pling.registry.snapshot());
    expect(protocol.tools.find((tool) => tool.function.name === "complete_open_tasks")?.function.parameters)
      .toMatchObject({ type: "object", properties: {} });
    expect(protocol.templates.has("complete_open_tasks")).toBe(false);
    expect(protocol.templates.get("toggle")).toMatchObject({
      template: "toggle@",
      records: ["t1", "t2", "t3"],
    });
    expect(warnings).toEqual([]);
  });

  it("runs one business function, verifies the outcome, and reports record changes", async () => {
    const { pling } = await mountApp();
    const executor = executorFor(pling);

    const response = await executor.execute("complete_open_tasks", "{}");
    await act(async () => {});

    expect(response).toMatchObject({
      result: {
        ok: true,
        action: { id: "complete_open_tasks" },
        expect: "No task remains open",
        data: { completed: 2 },
        changed: {
          observed: true,
          records: {
            added: [],
            removed: [],
            updated: [
              { id: "t1", fields: ["status"] },
              { id: "t2", fields: ["status"] },
            ],
            reordered: false,
          },
        },
      },
    });
    expect(pling.registry.snapshot().records.map((record) => record.fields.status))
      .toEqual(["completed", "completed", "completed"]);
    expect(document.querySelectorAll(".task.is-done")).toHaveLength(3);
  });

  it("reports the declared availability reason when every task is already done", async () => {
    const { pling } = await mountApp();
    const executor = executorFor(pling);

    await executor.execute("complete_open_tasks", "{}");
    await act(async () => {});
    const second = await executor.execute("complete_open_tasks", "{}");

    expect(second).toMatchObject({
      error: {
        code: "ACTION_UNAVAILABLE",
        message: expect.stringContaining(
          "There are no open tasks. Every task is already completed.",
        ),
      },
    });
    expect(pling.registry.snapshot().unavailable.find(
      (action) => action.id === "complete_open_tasks",
    )).toMatchObject({
      reason: "There are no open tasks. Every task is already completed.",
    });
  });

  it("lets a replay model invoke the function by its business identity", async () => {
    const llm = createReplayLlm([
      { calls: [{ tool: "complete_open_tasks", args: {} }] },
      { content: "Completed every open task." },
    ]);
    const { pling, warnings } = await mountApp(llm);
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      llm,
      settle: async () => {},
    });

    let answer = "";
    await act(async () => {
      answer = await loop.run("Mark every open task as completed.");
    });

    expect(answer).toContain("Completed every open task");
    expect(document.querySelectorAll(".task.is-done")).toHaveLength(3);
    expect(llm.toolsSeen[0]?.map((tool) => tool.function.name))
      .toContain("complete_open_tasks");
    expect(warnings).toEqual([]);
  });

  it("reports the field changed by a row toggle", async () => {
    const { pling } = await mountApp();
    const executor = executorFor(pling);

    let response!: Awaited<ReturnType<typeof executor.execute>>;
    await act(async () => {
      response = await executor.execute("toggle@t2", "{}");
    });

    expect(response).toMatchObject({
      result: {
        ok: true,
        action: { id: "toggle@t2" },
        changed: {
          observed: true,
          records: {
            added: [],
            removed: [],
            updated: [{ id: "t2", fields: ["status"] }],
            reordered: false,
          },
        },
      },
    });
    expect(pling.registry.snapshot().records[1]?.fields.status).toBe("completed");
    expect(document.querySelectorAll(".task")[1]?.classList.contains("is-done")).toBe(true);
  });

  it("reports a deleted row and the row actions that disappeared with it", async () => {
    const { pling } = await mountApp();
    const executor = executorFor(pling);

    let response!: Awaited<ReturnType<typeof executor.execute>>;
    await act(async () => {
      response = await executor.execute("remove@t3", "{}");
    });

    expect(response).toMatchObject({
      result: {
        ok: true,
        changed: {
          observed: true,
          records: {
            added: [],
            removed: ["t3"],
            updated: [],
            total: { from: 3, to: 2 },
          },
        },
      },
    });
    if (!("result" in response) || !response.result || typeof response.result !== "object") {
      throw new Error("expected a successful removal");
    }
    const result = response.result as {
      changed?: { actions?: { removed?: string[] } };
    };
    expect(result.changed?.actions?.removed)
      .toEqual(expect.arrayContaining(["toggle@t3", "remove@t3"]));
    expect(taskTexts()).toEqual([
      "Review the launch checklist",
      "Book the design review",
    ]);
  });

  it("reports the row added by the business action", async () => {
    const { pling } = await mountApp();
    const executor = executorFor(pling);

    const response = await executor.execute(
      "add_task",
      JSON.stringify({ text: "Draft the release note" }),
    );
    await act(async () => {});

    expect(response).toMatchObject({
      result: {
        ok: true,
        expect: "The new task is present in the list",
        changed: {
          observed: true,
          records: { added: ["t4"], removed: [], updated: [] },
        },
      },
    });
    expect(pling.registry.snapshot().records[0]).toMatchObject({
      id: "t4",
      fields: { text: "Draft the release note", status: "open", priority: "Soon" },
    });
  });

  it("lets a replay model address rows through the folded tools", async () => {
    const llm = createReplayLlm([
      {
        calls: [
          { tool: "toggle", args: { record: "t2" } },
          { tool: "remove", args: { record: "t3" } },
        ],
      },
      { content: "Updated the design-review task and deleted the follow-up." },
    ]);
    const { pling, warnings } = await mountApp(llm);
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      llm,
      settle: async () => {},
    });

    let answer = "";
    await act(async () => {
      answer = await loop.run(
        "Mark “Book the design review” as completed, then delete “Send the customer follow-up”.",
      );
    });

    expect(answer).toContain("Updated the design-review task");
    expect(taskTexts()).toEqual([
      "Review the launch checklist",
      "Book the design review",
    ]);
    expect(document.querySelectorAll(".task")[1]?.classList.contains("is-done")).toBe(true);
    expect(llm.toolsSeen[0]?.map((tool) => tool.function.name))
      .toEqual(expect.arrayContaining(["toggle", "remove"]));
    expect(warnings).toEqual([]);
  });
});
