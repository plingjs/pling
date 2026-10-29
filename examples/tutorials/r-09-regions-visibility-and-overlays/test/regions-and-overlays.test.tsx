import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildProtocol,
  createAgentLoop,
  createReplayLlm,
  renderPageContext,
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

async function click(selector: string, index = 0): Promise<void> {
  const element = document.querySelectorAll<HTMLElement>(selector)[index];
  if (!element) throw new Error(`element is missing: ${selector}[${index}]`);
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

async function execute(
  executor: ReturnType<typeof executorFor>,
  id: string,
  args = "{}",
) {
  let response!: Awaited<ReturnType<typeof executor.execute>>;
  await act(async () => {
    response = await executor.execute(id, args);
  });
  return response;
}

describe("R-09 · regions, visibility, and overlays", () => {
  it("keeps the manual edit flow intact and discards a cancelled change", async () => {
    const { warnings } = await mountApp();

    await click(".task__edit", 1);
    expect(document.querySelector(".overlay")).not.toBeNull();
    expect(document.querySelector("#edit-task-title")?.textContent)
      .toBe("Edit “Book the design review”");

    const input = document.querySelector<HTMLInputElement>("#edit-task-text");
    if (!input) throw new Error("edit input is missing");
    expect(input.value).toBe("Book the design review");
    await setControlValue(input, "Book the design review with Mina");
    await click(".dialog__save");

    expect(document.querySelector(".overlay")).toBeNull();
    expect(taskTexts()[1]).toBe("Book the design review with Mina");

    await click(".task__edit", 1);
    const secondInput = document.querySelector<HTMLInputElement>("#edit-task-text");
    if (!secondInput) throw new Error("edit input is missing");
    await setControlValue(secondInput, "Temporary title");
    await click(".dialog__cancel");

    expect(document.querySelector(".overlay")).toBeNull();
    expect(taskTexts()[1]).toBe("Book the design review with Mina");
    expect(warnings).toEqual([]);
  });

  it("projects the region tree and prefixes actions with their region path", async () => {
    const { pling, warnings } = await mountApp();

    const snapshot = pling.registry.snapshot();
    expect(snapshot.scopes.map((scope) => scope.id)).toEqual([
      "todo",
      "composer",
      "task_list",
      "view_controls",
    ]);
    expect(snapshot.scopes.find((scope) => scope.id === "todo")).toMatchObject({
      label: "Tasks",
      description:
        "The task workspace: adding, editing, filtering, and reviewing tasks.",
      role: "main",
      depth: 1,
    });
    expect(snapshot.scopes.find((scope) => scope.id === "composer")).toMatchObject({
      label: "Task composer",
      role: "form",
      parent: "todo",
      depth: 2,
    });
    expect(snapshot.scopes.find((scope) => scope.id === "task_list")).toMatchObject({
      label: "Task list",
      role: "list",
      parent: "todo",
      depth: 2,
    });
    expect(snapshot.scopes.find((scope) => scope.id === "view_controls")).toMatchObject({
      label: "View controls",
      role: "toolbar",
      parent: "todo",
      depth: 2,
    });

    expect(snapshot.records[0]).toMatchObject({
      id: "t1",
      scope: "task_list",
      source: "declared",
    });
    expect(actionById(pling, "add_task")?.scopePath).toEqual([
      "Tasks",
      "Task composer",
    ]);
    expect(actionById(pling, "edit@t2")?.scopePath).toEqual([
      "Tasks",
      "Task list",
    ]);
    expect(actionById(pling, "show_all_tasks")?.scopePath).toEqual([
      "Tasks",
      "View controls",
    ]);
    expect(actionById(pling, "search_text")?.scopePath).toEqual([
      "Tasks",
      "View controls",
    ]);

    const context = renderPageContext(snapshot);
    expect(context).toContain('main "Tasks" (todo)');
    expect(context).toContain('  - form "Task composer" (composer)');
    expect(context).toContain('  - list "Task list" (task_list)');
    expect(context).toContain('  - toolbar "View controls" (view_controls)');
    expect(context).toContain("region:Tasks / Task composer");
    expect(context).toContain("region:Tasks / Task list");
    expect(warnings).toEqual([]);
  });

  it("places a portal dialog under todo and reports covered actions as unavailable", async () => {
    const { pling, warnings } = await mountApp();
    const executor = executorFor(pling);

    const opened = await execute(executor, "edit@t2");
    expect(opened).toMatchObject({ result: { ok: true } });

    const snapshot = pling.registry.snapshot();
    const live = snapshot.actions.map((action) => action.id);
    expect(live).not.toContain("add_task");
    expect(live).not.toContain("toggle@t1");
    expect(live).not.toContain("show_all_tasks");
    expect(live).not.toContain("complete_open_tasks");
    expect(live).toEqual(expect.arrayContaining(["edit_note", "edit_save", "edit_cancel"]));

    expect(snapshot.unavailable.find((action) => action.id === "add_task")?.reason)
      .toContain("inert");
    expect(snapshot.unavailable.find((action) => action.id === "toggle@t1")?.reason)
      .toContain("inert");
    expect(snapshot.unavailable.find((action) => action.id === "complete_open_tasks")?.reason)
      .toBe("Finish or cancel the open task editor before changing the task list.");

    expect(snapshot.scopes.find((scope) => scope.id === "edit_dialog")).toMatchObject({
      label: "Edit task",
      role: "dialog",
      parent: "todo",
      depth: 2,
      active: true,
    });
    expect(actionById(pling, "edit_save")?.scopePath).toEqual([
      "Tasks",
      "Edit task",
    ]);

    const context = renderPageContext(snapshot);
    expect(context).toContain('dialog "Edit task" (edit_dialog)');
    expect(context).toContain("## Actions that exist but are unavailable right now");
    expect(context).toContain("inert");
    expect(context).toContain("region: Tasks / Task list");

    const blocked = await execute(
      executor,
      "add_task",
      JSON.stringify({ text: "Should not appear" }),
    );
    expect(blocked).toMatchObject({ error: { code: "ACTION_UNAVAILABLE" } });
    expect((blocked as { error: { message: string } }).error.message).toContain("inert");
    expect(taskTexts()).not.toContain("Should not appear");
    expect(warnings).toEqual([]);
  });

  it("rechecks the function-level guard and recovers after the dialog closes", async () => {
    const { pling } = await mountApp();
    const executor = executorFor(pling);

    await execute(executor, "edit@t1");
    const blocked = await execute(executor, "complete_open_tasks");
    expect(blocked).toMatchObject({
      error: {
        code: "ACTION_UNAVAILABLE",
        message: expect.stringContaining("Finish or cancel the open task editor"),
      },
    });
    expect(document.querySelectorAll(".task.is-done")).toHaveLength(1);

    await execute(executor, "edit_cancel");
    const completed = await execute(executor, "complete_open_tasks");
    expect(completed).toMatchObject({
      result: {
        ok: true,
        data: { completed: 2 },
        expect: "No task remains open",
      },
    });
    expect(document.querySelectorAll(".task.is-done")).toHaveLength(3);
  });

  it("lets a replay model open the editor, change one task, and save it", async () => {
    const llm = createReplayLlm([
      { calls: [{ tool: "edit@t2" }] },
      {
        calls: [
          {
            tool: "edit_note",
            args: { text: "Book the design review with Mina" },
          },
          { tool: "edit_save" },
        ],
      },
      { content: "Renamed the task." },
    ]);
    const { pling, warnings } = await mountApp(llm);
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      llm,
      settle: async () => {
        await act(async () => {});
      },
    });

    let answer = "";
    await act(async () => {
      answer = await loop.run(
        "Rename the second task to “Book the design review with Mina”.",
      );
    });

    expect(answer).toContain("Renamed the task");
    expect(taskTexts()[1]).toBe("Book the design review with Mina");
    expect(document.querySelector(".overlay")).toBeNull();
    expect(warnings).toEqual([]);

    const secondTurn = llm.received[1]?.[0]?.content ?? "";
    expect(secondTurn).toContain('dialog "Edit task" (edit_dialog)');
    expect(secondTurn).toContain("## Actions that exist but are unavailable right now");
    expect(secondTurn).toContain("inert");
    expect(llm.toolsSeen[1]?.map((tool) => tool.function.name)).toEqual(
      expect.arrayContaining(["edit_note", "edit_save", "edit_cancel"]),
    );
  });

  it("localizes region labels, the editor, and the function-level reason", async () => {
    const { pling } = await mountApp(createReplayLlm([]), "zh");
    const executor = executorFor(pling);

    expect(document.querySelector("h1")?.textContent).toBe("待办");
    expect(pling.registry.snapshot().scopes.find((scope) => scope.id === "task_list"))
      .toMatchObject({
        label: "待办列表",
        description: "当前可见的待办，以及完成、编辑和删除操作。",
      });

    await execute(executor, "edit@t1");
    expect(document.querySelector("#edit-task-title")?.textContent)
      .toBe("编辑“检查发布清单”");
    expect(document.querySelector(".dialog__cancel")?.textContent).toBe("取消");
    expect(document.querySelector(".dialog__save")?.textContent).toBe("保存修改");
    expect(
      pling.registry.snapshot().unavailable.find(
        (action) => action.id === "complete_open_tasks",
      )?.reason,
    ).toBe("请先完成或取消当前编辑弹窗，再修改待办列表。");
  });

  it("folds row actions while the dialog is open and exposes its own operations", async () => {
    const { pling } = await mountApp();
    const executor = executorFor(pling);

    const protocolBefore = buildProtocol(pling.registry.snapshot());
    expect(protocolBefore.templates.get("edit")).toMatchObject({
      template: "edit@",
      records: ["t1", "t2", "t3"],
    });
    expect(protocolBefore.tools.map((tool) => tool.function.name))
      .toContain("complete_open_tasks");

    await execute(executor, "edit@t1");
    const protocolDuring = buildProtocol(pling.registry.snapshot());
    const names = protocolDuring.tools.map((tool) => tool.function.name);
    expect(names).toEqual(expect.arrayContaining(["edit_note", "edit_save", "edit_cancel"]));
    expect(names).not.toContain("edit");
    expect(names).not.toContain("add_task");
    expect(document.querySelector(".dialog")).not.toBeNull();
  });
});
