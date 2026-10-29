import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildProtocol,
  createAgentLoop,
  createReplayLlm,
  renderPageContext,
  type SessionEvent,
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

async function hideRowsFrom(
  pling: ReturnType<typeof createPling>,
  firstHiddenIndex: number,
): Promise<void> {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(".task"));
  for (const row of rows.slice(firstHiddenIndex)) {
    for (const selector of [".task__check", ".task__edit", ".task__remove"]) {
      const element = row.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`row control is missing: ${selector}`);
      pling.scopes.setVisible(element, false);
    }
  }
  await act(async () => {});
}

describe("R-10 · long lists, scrolling, and offscreen actions", () => {
  it("keeps offscreen rows addressable and folds their actions", async () => {
    const { pling, warnings } = await mountApp();

    await hideRowsFrom(pling, 6);

    const snapshot = pling.registry.snapshot();
    expect(snapshot.recordIds).toHaveLength(24);
    expect(snapshot.recordIds).toContain("t24");
    expect(snapshot.actions.some((action) => action.id === "toggle@t24"))
      .toBe(false);
    expect(
      snapshot.offscreenRecordActions.some(
        (action) => action.id === "toggle@t24",
      ),
    ).toBe(true);

    const listScope = snapshot.scopes.find((scope) => scope.id === "task_list");
    expect(listScope).toMatchObject({ hasMore: true });
    expect(listScope?.explore).toContain("pling_scroll_task_list");

    const protocol = buildProtocol(snapshot);
    const toggle = protocol.templates.get("toggle");
    expect(toggle?.records).toContain("t24");
    expect(toggle?.offscreen).toBe(18);

    const toggleTool = protocol.tools.find(
      (tool) => tool.function.name === "toggle",
    );
    expect(toggleTool?.function.description).toContain(
      "18 rows outside the viewport (auto-scroll before execution)",
    );
    const parameters = toggleTool?.function.parameters as
      | { properties?: Record<string, { description?: string }> }
      | undefined;
    expect(parameters?.properties?.record?.description)
      .toContain("scrolled into view");

    const context = renderPageContext(snapshot);
    expect(context).toContain("actions 18/72");
    expect(context).toContain("18 rows outside the viewport, auto-scroll on call");
    expect(context).toContain("pling_scroll_task_list");
    expect(warnings).toEqual([]);
  });

  it("reveals an offscreen target before running its row action", async () => {
    const { pling, warnings } = await mountApp();
    await hideRowsFrom(pling, 6);

    const lastRow = document.querySelectorAll<HTMLElement>(".task")[23];
    const target = lastRow?.querySelector<HTMLButtonElement>(".task__check");
    if (!lastRow || !target) throw new Error("last task is missing");

    let scrolls = 0;
    target.scrollIntoView = () => {
      scrolls += 1;
      pling.scopes.setVisible(target, true);
    };

    const result = await execute(executorFor(pling), "toggle@t24");

    expect(result).not.toHaveProperty("error");
    expect(scrolls).toBe(1);
    expect(lastRow.classList.contains("is-done")).toBe(true);
    expect(warnings).toEqual([]);
  });

  it("offers a generated scroll action for the scrolling region", async () => {
    const { pling, warnings } = await mountApp();
    await hideRowsFrom(pling, 6);

    const list = document.querySelector<HTMLElement>(".tasks");
    if (!list) throw new Error("task list is missing");
    Object.defineProperty(list, "clientHeight", {
      configurable: true,
      value: 240,
    });
    let scrollCalls = 0;
    list.scrollBy = (() => {
      scrollCalls += 1;
    }) as typeof list.scrollBy;
    await act(async () => {});

    const snapshot = pling.registry.snapshot();
    const scrollAction = snapshot.actions.find(
      (action) => action.id === "pling_scroll_task_list",
    );
    expect(scrollAction?.description).toContain(
      'Scroll inside the "Task list" region',
    );
    expect(
      snapshot.scopes.find((scope) => scope.id === "task_list")?.explore,
    ).toContain("pling_scroll_task_list");

    const result = await execute(
      executorFor(pling),
      "pling_scroll_task_list",
      JSON.stringify({ direction: "next" }),
    );
    expect(result).not.toHaveProperty("error");
    expect(scrollCalls).toBe(1);
    expect(warnings).toEqual([]);
  });

  it("lets a replay model target the last row without a manual scroll step", async () => {
    const { pling, warnings } = await mountApp();
    await hideRowsFrom(pling, 6);

    const lastRow = document.querySelectorAll<HTMLElement>(".task")[23];
    const target = lastRow?.querySelector<HTMLButtonElement>(".task__check");
    if (!lastRow || !target) throw new Error("last task is missing");
    let scrolls = 0;
    target.scrollIntoView = () => {
      scrolls += 1;
      pling.scopes.setVisible(target, true);
    };

    const toolName = buildProtocol(pling.registry.snapshot())
      .idToName.get("toggle@t24");
    expect(toolName).toBeTruthy();
    const llm = createReplayLlm([
      { calls: [{ tool: toolName!, args: { record: "t24" } }] },
      { content: "Marked the last task as completed." },
    ]);
    const executedIds: string[] = [];
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      llm,
      settle: async () => {
        await act(async () => {});
      },
      onEvent: (event: SessionEvent) => {
        if (event.type === "tool_call") executedIds.push(event.id);
      },
    });

    let answer = "";
    await act(async () => {
      answer = await loop.run("Mark the last task as completed.");
    });

    expect(answer).toContain("Marked the last task");
    expect(executedIds).toEqual(["toggle@t24"]);
    expect(scrolls).toBe(1);
    expect(lastRow.classList.contains("is-done")).toBe(true);
    expect(
      llm.toolsSeen[0]?.find((tool) => tool.function.name === toolName)
        ?.function.description,
    ).toContain("outside the viewport");
    expect(warnings).toEqual([]);
  });

  it("keeps the portal editor and its interaction boundary", async () => {
    const { pling, warnings } = await mountApp();
    const executor = executorFor(pling);

    const opened = await execute(executor, "edit@t2");
    expect(opened).toMatchObject({ result: { ok: true } });
    expect(document.querySelector(".overlay")).not.toBeNull();
    expect(document.querySelector(".todo")?.hasAttribute("inert")).toBe(true);

    const snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).not.toContain("add_task");
    expect(snapshot.actions.map((action) => action.id)).not.toContain("toggle@t1");
    expect(
      snapshot.unavailable.find((action) => action.id === "toggle@t1")?.reason,
    ).toContain("inert");
    expect(
      snapshot.unavailable.find(
        (action) => action.id === "complete_open_tasks",
      )?.reason,
    ).toBe("Finish or cancel the open task editor before changing the task list.");

    await execute(executor, "edit_cancel");
    expect(document.querySelector(".overlay")).toBeNull();
    expect(actionById(pling, "add_task")).toBeTruthy();
    expect(warnings).toEqual([]);
  });

  it("localizes the long list and its actions", async () => {
    const { pling, warnings } = await mountApp(createReplayLlm([]), "zh");

    expect(document.querySelector("h1")?.textContent).toBe("待办");
    expect(document.querySelector(".tasks")?.getAttribute("aria-label"))
      .toBe("待办列表");
    expect(taskTexts()).toHaveLength(24);
    expect(taskTexts().at(-1)).toBe("确认发布文案终稿");
    expect(
      pling.registry.snapshot().scopes.find(
        (scope) => scope.id === "task_list",
      )?.description,
    ).toContain("可见范围之外");
    expect(warnings).toEqual([]);
  });
});
