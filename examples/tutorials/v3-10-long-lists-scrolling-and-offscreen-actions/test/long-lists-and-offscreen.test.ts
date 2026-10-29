import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProtocol,
  createAgentLoop,
  createReplayLlm,
  renderPageContext,
  type SessionEvent,
} from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling } from "@plingjs/vue";
import App from "../src/App.vue";

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

type TestLocale = "en" | "zh";
type AppWrapper = ReturnType<typeof mountApp>["wrapper"];

function mountApp(llm = createReplayLlm([]), locale: TestLocale = "en") {
  const warnings: string[] = [];
  const pling = createPling({
    diagnostics: false,
    presence: false,
    onWarn: (message) => warnings.push(message),
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm },
  });
  const wrapper = mount(App, {
    attachTo: document.body,
    props: { locale },
    global: { plugins: [pling.plugin] },
  });
  cleanup.push(() => {
    wrapper.unmount();
    pling.destroy();
  });
  return { llm, pling, warnings, wrapper };
}

function executorFor(pling: ReturnType<typeof mountApp>["pling"]) {
  return createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
    settle: async () => {
      await nextTick();
    },
  });
}

function hideRowsFrom(
  pling: ReturnType<typeof mountApp>["pling"],
  wrapper: AppWrapper,
  firstHiddenIndex: number,
): void {
  for (const row of wrapper.findAll(".tasks li").slice(firstHiddenIndex)) {
    for (const selector of [".tasks__check input", ".tasks__edit", ".tasks__remove"]) {
      const element = row.get(selector).element;
      pling.scopes.setVisible(element, false);
    }
  }
}

describe("V3-10 · long lists, scrolling, and offscreen actions", () => {
  const taskTexts = (wrapper: AppWrapper) =>
    wrapper.findAll(".tasks__text").map((item) => item.text());

  it("keeps offscreen rows addressable and folds them into the same row actions", async () => {
    const { pling, wrapper } = mountApp();
    await nextTick();

    hideRowsFrom(pling, wrapper, 6);
    await nextTick();

    const snapshot = pling.registry.snapshot();
    expect(snapshot.recordIds).toHaveLength(24);
    expect(snapshot.recordIds).toContain("t24");
    expect(snapshot.actions.some((action) => action.id === "toggle@t24")).toBe(false);
    expect(
      snapshot.offscreenRecordActions.some((action) => action.id === "toggle@t24"),
    ).toBe(true);

    const listScope = snapshot.scopes.find((scope) => scope.id === "task_list");
    expect(listScope).toMatchObject({ hasMore: true });
    expect(listScope?.explore).toContain("pling_scroll_task_list");

    const protocol = buildProtocol(snapshot);
    const toggle = protocol.templates.get("toggle");
    expect(toggle?.records).toContain("t24");
    expect(toggle?.offscreen).toBe(18);

    const toggleTool = protocol.tools.find((tool) => tool.function.name === "toggle");
    expect(toggleTool?.function.description).toContain(
      "18 rows outside the viewport (auto-scroll before execution)",
    );
    const parameters = toggleTool?.function.parameters as
      | { properties?: Record<string, { description?: string }> }
      | undefined;
    const recordParam = parameters?.properties?.record;
    expect(recordParam?.description).toContain("scrolled into view");

    const context = renderPageContext(snapshot);
    expect(context).toContain("actions 18/72");
    expect(context).toContain("18 rows outside the viewport, auto-scroll on call");
    expect(context).toContain("pling_scroll_task_list");
  });

  it("reveals an offscreen target before executing the row action", async () => {
    const { pling, wrapper } = mountApp();
    await nextTick();

    hideRowsFrom(pling, wrapper, 6);
    await nextTick();

    const lastRow = wrapper.findAll(".tasks li")[23]!;
    const target = lastRow.get(".tasks__check input").element as HTMLInputElement;
    let scrolls = 0;
    target.scrollIntoView = () => {
      scrolls += 1;
      pling.scopes.setVisible(target, true);
    };

    const result = await executorFor(pling).execute("toggle@t24", "{}");
    await nextTick();

    expect(result).not.toHaveProperty("error");
    expect(scrolls).toBe(1);
    expect(lastRow.classes()).toContain("is-done");
  });

  it("offers a generated scroll action when the region contains more content", async () => {
    const { pling, wrapper } = mountApp();
    await nextTick();

    hideRowsFrom(pling, wrapper, 6);
    const list = wrapper.get(".tasks").element as HTMLElement;
    Object.defineProperty(list, "clientHeight", { configurable: true, value: 240 });
    let scrollCalls = 0;
    list.scrollBy = (() => {
      scrollCalls += 1;
    }) as typeof list.scrollBy;
    await nextTick();

    const snapshot = pling.registry.snapshot();
    const scrollAction = snapshot.actions.find(
      (action) => action.id === "pling_scroll_task_list",
    );
    expect(scrollAction?.description).toContain('Scroll inside the "Task list" region');
    expect(
      snapshot.scopes.find((scope) => scope.id === "task_list")?.explore,
    ).toContain("pling_scroll_task_list");

    const result = await executorFor(pling).execute(
      "pling_scroll_task_list",
      JSON.stringify({ direction: "next" }),
    );
    expect(result).not.toHaveProperty("error");
    expect(scrollCalls).toBe(1);
  });

  it("lets a replay model target the last row without a search or a manual scroll step", async () => {
    const { pling, wrapper } = mountApp();
    await nextTick();

    hideRowsFrom(pling, wrapper, 6);
    await nextTick();

    const lastRow = wrapper.findAll(".tasks li")[23]!;
    const target = lastRow.get(".tasks__check input").element as HTMLInputElement;
    let scrolls = 0;
    target.scrollIntoView = () => {
      scrolls += 1;
      pling.scopes.setVisible(target, true);
    };

    const toolName = buildProtocol(pling.registry.snapshot()).idToName.get("toggle@t24")!;
    const llm = createReplayLlm([
      { calls: [{ tool: toolName, args: { record: "t24" } }] },
      { content: "Marked the last task as completed." },
    ]);
    const ids: string[] = [];
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      llm,
      settle: async () => {
        await nextTick();
      },
      onEvent: (event: SessionEvent) => {
        if (event.type === "tool_call") ids.push(event.id);
      },
    });

    const answer = await loop.run("Mark the last task as completed.");
    await nextTick();

    expect(answer).toContain("Marked the last task");
    expect(ids).toEqual(["toggle@t24"]);
    expect(scrolls).toBe(1);
    expect(lastRow.classes()).toContain("is-done");
    expect(llm.toolsSeen[0]?.find((tool) => tool.function.name === toolName)?.function.description)
      .toContain("outside the viewport");
  });

  it("localizes the list and the long-list scenario", async () => {
    const { pling, wrapper } = mountApp(createReplayLlm([]), "zh");
    await nextTick();

    expect(wrapper.get("h1").text()).toBe("待办");
    expect(wrapper.get(".tasks").attributes("aria-label")).toBe("待办列表");
    expect(taskTexts(wrapper)).toHaveLength(24);
    expect(taskTexts(wrapper).at(-1)).toBe("确认发布文案终稿");
    expect(
      pling.registry.snapshot().scopes.find((scope) => scope.id === "task_list")?.description,
    ).toContain("可见范围之外");
  });
});
