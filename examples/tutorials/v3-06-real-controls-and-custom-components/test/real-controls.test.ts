import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createAgentLoop, createReplayLlm } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { AgentDock, createPling } from "@plingjs/vue";
import App from "../src/App.vue";

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

type TestLocale = "en" | "zh";

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

describe("V3-06 · real controls and custom components", () => {
  const taskTexts = (wrapper: ReturnType<typeof mountApp>["wrapper"]) =>
    wrapper.findAll(".tasks__text").map((item) => item.text());

  const actionById = (
    pling: ReturnType<typeof mountApp>["pling"],
    id: string,
  ) => pling.registry.snapshot().actions.find((action) => action.id === id);

  it("keeps the manual composer workflow, including native select and priority", async () => {
    const { wrapper } = mountApp();
    await wrapper.get("#new-task").setValue("Prepare the launch notes");
    await wrapper.get("#task-priority").setValue("later");
    await wrapper.get("form").trigger("submit");
    await nextTick();

    expect(taskTexts(wrapper)[0]).toBe("Prepare the launch notes");
    expect(wrapper.get(".tasks li .tasks__priority").text()).toBe("Later");
    expect((wrapper.get("#new-task").element as HTMLInputElement).value).toBe("");
  });

  it("uses Chinese UI copy and action descriptions when locale is zh", async () => {
    const { pling, wrapper } = mountApp(createReplayLlm([]), "zh");
    await nextTick();

    expect(wrapper.get("h1").text()).toBe("待办");
    expect(taskTexts(wrapper)).toEqual(["检查发布清单", "预约设计评审", "跟进客户"]);
    expect(wrapper.get("#task-priority option").text()).toBe("今天");
    expect(wrapper.get("input[type='search']").attributes("placeholder")).toBe(
      "搜索待办，然后按 Enter",
    );
    expect(wrapper.get("button[data-filter='all']").text()).toBe("全部");
    expect(actionById(pling, "add_task")?.description).toBe(
      "使用提供的文本和新增区当前选中的优先级添加一条待办。",
    );
    expect(actionById(pling, "select_priority")?.description).toBe(
      "选择下一条通过 add_task 添加的待办所使用的优先级。",
    );
    expect(actionById(pling, "search_enter")?.description).toBe(
      "在待办搜索框中按 Enter，应用已经输入的短语。",
    );
  });

  it("keeps the region, records, and row toggles from the previous chapter", async () => {
    const { pling } = mountApp();
    await nextTick();

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
    expect(snapshot.actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["add_task", "toggle@t1", "toggle@t2", "toggle@t3"]),
    );
  });

  it("publishes native, automatic, and explicitly targeted controls with different fidelity", async () => {
    const { pling, warnings, wrapper } = mountApp();
    await nextTick();

    expect(wrapper.findComponent(AgentDock).exists()).toBe(true);
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

  it("selects a priority through the native select primitive and rejects unknown values", async () => {
    const { pling, wrapper } = mountApp();
    const executor = createExecutor({
      registry: pling.registry,
      policy: createPolicy(null),
    });

    expect(
      await executor.execute(
        "select_priority",
        JSON.stringify({ value: "someday" }),
      ),
    ).toMatchObject({ error: { code: "INVALID_PARAMS" } });

    expect(
      await executor.execute(
        "select_priority",
        JSON.stringify({ value: "later" }),
      ),
    ).toMatchObject({ result: { ok: true } });
    await nextTick();

    expect(
      (wrapper.get("#task-priority").element as HTMLSelectElement).value,
    ).toBe("later");

    await wrapper.get("#new-task").setValue("Use the selected priority");
    await wrapper.get("form").trigger("submit");
    await nextTick();
    expect(wrapper.get(".tasks li .tasks__priority").text()).toBe("Later");
  });

  it("keeps search unapplied until Enter reaches the wrapper's unique input", async () => {
    const { pling, wrapper } = mountApp();
    const executor = createExecutor({
      registry: pling.registry,
      policy: createPolicy(null),
    });

    await executor.execute(
      "search_text",
      JSON.stringify({ text: "customer" }),
    );
    await nextTick();
    expect(taskTexts(wrapper)).toHaveLength(3);

    await executor.execute("search_enter", JSON.stringify({ key: "Enter" }));
    await nextTick();
    expect(taskTexts(wrapper)).toEqual(["Send the customer follow-up"]);
  });

  it("uses an explicit target to choose one button inside a multi-button component", async () => {
    const { pling, wrapper } = mountApp();
    const executor = createExecutor({
      registry: pling.registry,
      policy: createPolicy(null),
    });

    await executor.execute("show_open_tasks", "{}");
    await nextTick();
    expect(taskTexts(wrapper)).toEqual([
      "Review the launch checklist",
      "Book the design review",
    ]);

    await executor.execute("show_completed_tasks", "{}");
    await nextTick();
    expect(taskTexts(wrapper)).toEqual(["Send the customer follow-up"]);
  });

  it("reveals a later action with hover, then runs the native button", async () => {
    const { pling, wrapper } = mountApp();
    const executor = createExecutor({
      registry: pling.registry,
      policy: createPolicy(async () => true),
    });

    expect(actionById(pling, "clear_completed")).toBeUndefined();
    expect(await executor.execute("open_bulk_menu", "{}")).toMatchObject({
      result: { ok: true },
    });
    await nextTick();

    expect(actionById(pling, "clear_completed")).toMatchObject({
      primitive: "click",
      kind: "danger",
      fidelity: "high",
    });
    await executor.execute("clear_completed", "{}");
    await nextTick();

    expect(taskTexts(wrapper)).toEqual([
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
    const { pling, warnings, wrapper } = mountApp(llm);
    await nextTick();

    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(null),
      llm,
      settle: async () => {},
    });
    const answer = await loop.run(
      "Add “Draft the release note” with later priority, then search for release.",
    );
    await nextTick();

    expect(answer).toContain("Added the task and filtered the list.");
    expect(taskTexts(wrapper)).toEqual(["Draft the release note"]);
    expect(wrapper.get(".tasks li .tasks__priority").text()).toBe("Later");
    expect(warnings).toEqual([]);
    expect(
      llm.toolsSeen[0]?.map((tool) => tool.function.name),
    ).toEqual(
      expect.arrayContaining([
        "select_priority",
        "add_task",
        "search_text",
        "search_enter",
      ]),
    );
  });

  it("records autoTarget:false as low unless the developer makes an explicit fidelity claim", async () => {
    const warnings: string[] = [];
    const pling = createPling({
      diagnostics: false,
      presence: false,
      onWarn: (message) => warnings.push(message),
      ui: { locale: "en-US" },
    });
    const clicked = ref(0);
    const Host = defineComponent({
      setup: () => ({ clicked }),
      template: `
        <div>
          <div v-tool="{ id: 'low_wrapper', desc: 'A wrapper whose inner button is not the action target.', autoTarget: false }">
            <button type="button">Inner</button>
          </div>
          <div
            @click="clicked += 1"
            v-tool="{ id: 'declared_wrapper', desc: 'A wrapper that handles the click itself.', autoTarget: false, fidelity: 'high' }"
          >
            <button type="button">Inner</button>
          </div>
        </div>
      `,
    });
    const wrapper = mount(Host, {
      attachTo: document.body,
      global: { plugins: [pling.plugin] },
    });
    cleanup.push(() => {
      wrapper.unmount();
      pling.destroy();
    });

    const actions = pling.registry.snapshot().actions;
    expect(actions.find((action) => action.id === "low_wrapper")?.fidelity).toBe(
      "low",
    );
    expect(
      actions.find((action) => action.id === "declared_wrapper")?.fidelity,
    ).toBe("high");
    expect(
      warnings.some((message) => message.includes("low_wrapper")),
    ).toBe(true);
    expect(
      warnings.some((message) => message.includes("declared_wrapper")),
    ).toBe(false);

    const executor = createExecutor({
      registry: pling.registry,
      policy: createPolicy(null),
    });
    await executor.execute("declared_wrapper", "{}");
    expect(clicked.value).toBe(1);
  });
});
