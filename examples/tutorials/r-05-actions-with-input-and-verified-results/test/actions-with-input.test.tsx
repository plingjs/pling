import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentLoop, createReplayLlm } from "@plingjs/agent";
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

async function fillDraft(text: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#new-task");
  if (!input) throw new Error("待办输入框不存在");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submitDraft(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>(".composer");
  if (!form) throw new Error("待办表单不存在");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function click(element: Element | null): Promise<void> {
  if (!element) throw new Error("要点击的元素不存在");
  await act(async () => {
    (element as HTMLElement).click();
  });
}

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("等待超时");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function say(text: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(".pling-chat__composer input");
  const form = document.querySelector<HTMLFormElement>(".pling-chat__composer");
  if (!input || !form) throw new Error("聊天输入框不存在");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("R-05 · actions with input and verified results", () => {
  it("keeps the manual form workflow on the same addTask function", async () => {
    const { warnings } = await mountApp();

    await fillDraft("Send the customer follow-up");
    await submitDraft();

    expect(taskTexts()[0]).toBe("Send the customer follow-up");
    expect(document.querySelector<HTMLInputElement>("#new-task")?.value).toBe("");
    expect(warnings).toEqual([]);
  });

  it("publishes one business action with an argument schema", async () => {
    const { pling, warnings } = await mountApp();
    const snapshot = pling.registry.snapshot();
    const action = snapshot.actions.find((item) => item.id === "add_task");

    expect(action).toMatchObject({
      id: "add_task",
      kind: "write",
      description: "Add one task to the list using the supplied text.",
      params: {
        type: "object",
        properties: {
          text: {
            type: "string",
            minLength: 1,
            maxLength: 80,
            pattern: "\\S",
          },
        },
        required: ["text"],
      },
    });
    expect(snapshot.actions.map((item) => item.id)).toEqual(expect.arrayContaining([
      "add_task",
      "toggle@t1",
      "toggle@t2",
      "toggle@t3",
    ]));
    expect(snapshot.actions.map((item) => item.id)).not.toEqual(expect.arrayContaining([
      "composer_text",
      "composer_submit",
    ]));
    expect(warnings).toEqual([]);
  });

  it("keeps records and row actions working after the add path changes", async () => {
    const { pling } = await mountApp();
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(null) });
    const before = pling.registry.snapshot();

    expect(before.scopes.find((scope) => scope.id === "todo")).toMatchObject({
      label: "Tasks",
      description: "The task list and the form for adding a new task.",
      role: "main",
    });
    expect(before.records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);

    await act(async () => {
      await executor.execute("toggle@t2", "{}");
    });

    const after = pling.registry.snapshot();
    expect(after.records.find((record) => record.id === "t2")?.fields.status).toBe("completed");
    expect(after.records.find((record) => record.id === "t1")?.fields.status).toBe("open");
  });

  it("uses Chinese copy for the page and the declared action", async () => {
    const { pling } = await mountApp(createReplayLlm([]), "zh");
    const action = pling.registry.snapshot().actions.find((item) => item.id === "add_task");

    expect(document.querySelector("h1")?.textContent).toBe("待办");
    expect(document.querySelector<HTMLInputElement>("#new-task")?.placeholder)
      .toBe("需要完成什么？");
    expect(action).toMatchObject({
      description: "使用提供的文本向待办列表添加一条待办。",
      params: {
        properties: {
          text: {
            description: "待办内容，1–80 个字符，不能只包含空格",
          },
        },
      },
    });
  });

  it("validates arguments before the business operation", async () => {
    const { pling } = await mountApp();
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(null) });
    let empty: unknown;
    let spaces: unknown;

    await act(async () => {
      empty = await executor.execute("add_task", "{}");
      spaces = await executor.execute("add_task", JSON.stringify({ text: "   " }));
    });

    expect(empty).toMatchObject({ error: { code: "INVALID_PARAMS" } });
    expect(spaces).toMatchObject({ error: { code: "INVALID_PARAMS" } });
    expect(document.querySelectorAll(".task")).toHaveLength(3);
  });

  it("executes with the supplied text and verifies the declared result", async () => {
    const { pling } = await mountApp();
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(null) });
    const output = await executor.execute(
      "add_task",
      JSON.stringify({ text: "Ship the release candidate" }),
    );
    await act(async () => {});

    expect(output).toMatchObject({
      result: {
        ok: true,
        action: { id: "add_task" },
        expect: "The new task is present in the list",
        changed: {
          observed: true,
          records: { added: ["t4"] },
          actions: { added: ["toggle@t4"] },
        },
      },
    });
    expect(taskTexts()[0]).toBe("Ship the release candidate");
  });

  it("reports why the action is unavailable when the list is full", async () => {
    const { pling } = await mountApp();
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(null) });

    for (const text of ["One", "Two", "Three", "Four", "Five"]) {
      await executor.execute("add_task", JSON.stringify({ text }));
      await act(async () => {});
    }

    const output = await executor.execute("add_task", JSON.stringify({ text: "Six" }));
    await act(async () => {});

    expect(output).toMatchObject({
      error: {
        code: "ACTION_UNAVAILABLE",
        message: expect.stringContaining("The list is full (8 tasks)"),
      },
    });
    expect(document.querySelectorAll(".task")).toHaveLength(8);
  });

  it("runs end to end through the agent loop with one add_task call", async () => {
    const llm = createReplayLlm([
      { calls: [{ tool: "add_task", args: { text: "Send the customer follow-up" } }] },
      { content: "Added the customer follow-up." },
    ]);
    const { pling, warnings } = await mountApp(llm);
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(null),
      llm,
      settle: async () => {},
    });
    const answer = await loop.run("Add “Send the customer follow-up” to my tasks.");
    await act(async () => {});

    expect(answer).toContain("Added the customer follow-up.");
    expect(taskTexts()[0]).toBe("Send the customer follow-up");
    expect(warnings).toEqual([]);
    expect(llm.toolsSeen[0]?.map((tool) => tool.function.name)).toContain("add_task");
    expect(llm.toolsSeen[0]?.map((tool) => tool.function.name)).not.toContain("composer_text");
    expect(llm.received[0]?.some((message) => message.content.includes("add_task"))).toBe(true);
  });

  it("shows the single declared action in the inspector", async () => {
    const llm = createReplayLlm([
      { calls: [{ tool: "add_task", args: { text: "Reply to the customer" } }] },
      { content: "Added the task." },
    ]);
    await mountApp(llm);

    await click(document.querySelector(".pling-dock__launcher"));
    await say("Add “Reply to the customer” to my tasks.");
    await waitFor(() =>
      document.querySelector(".pling-chat")?.textContent?.includes("Added the task.") ?? false
    );
    await click(document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")[1] ?? null);
    await click(document.querySelector('[data-testid="pling-debug-toggle"]'));

    const inspector = document.querySelector('[data-testid="pling-debug"]');
    expect(inspector?.textContent).toContain("add_task");
    expect(inspector?.textContent).toContain('"minLength": 1');
    expect(inspector?.textContent).toContain('"maxLength": 80');
    expect(inspector?.textContent).toContain('"pattern": "\\\\S"');
    expect(inspector?.textContent).not.toContain("composer_text");
    expect(inspector?.textContent).not.toContain("composer_submit");
  });
});
