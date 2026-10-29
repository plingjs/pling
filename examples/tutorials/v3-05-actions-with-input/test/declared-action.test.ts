import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
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

describe("V3-05 · actions with input and verified results", () => {
  const taskTexts = (wrapper: ReturnType<typeof mountApp>["wrapper"]) =>
    wrapper.findAll(".tasks li .tasks__check span").map((item) => item.text());

  it("keeps the manual form workflow on the same addTask function", async () => {
    const { wrapper } = mountApp();
    await wrapper.get("input").setValue("Send the customer follow-up");
    await wrapper.get("form").trigger("submit");
    await nextTick();

    expect(taskTexts(wrapper)[0]).toBe("Send the customer follow-up");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("");
  });

  it("uses Chinese copy across the page and the add_task declaration when locale is zh", async () => {
    const { pling, wrapper } = mountApp(createReplayLlm([]), "zh");
    await nextTick();

    expect(wrapper.get("h1").text()).toBe("待办");
    expect(wrapper.get("input").attributes("placeholder")).toBe("需要完成什么？");
    expect(taskTexts(wrapper)).toEqual(["检查发布清单", "预约设计评审", "跟进客户"]);
    expect(pling.registry.snapshot().actions.find((action) => action.id === "add_task")).toMatchObject({
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

  it("publishes one action with a declared argument schema", async () => {
    const { pling, wrapper } = mountApp();
    await nextTick();

    expect(wrapper.findComponent(AgentDock).exists()).toBe(true);
    const action = pling.registry.snapshot().actions.find((item) => item.id === "add_task");

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
  });

  it("keeps the region, records, and row toggle introduced earlier", async () => {
    const { pling, wrapper } = mountApp();
    await nextTick();

    const snapshot = pling.registry.snapshot();
    expect(snapshot.scopes.find((scope) => scope.id === "todo")).toMatchObject({
      label: "Tasks",
      description: "The task list and the form for adding a new task.",
      role: "main",
    });
    expect(snapshot.records[0]).toMatchObject({
      id: "t1",
      fields: { text: "Review the launch checklist", status: "open" },
    });
    expect(snapshot.actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["add_task", "toggle@t1", "toggle@t2", "toggle@t3"]),
    );
    expect(wrapper.findAll(".tasks li")).toHaveLength(3);
  });

  it("validates arguments before the business operation", async () => {
    const { pling, wrapper } = mountApp();
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(null) });

    expect(await executor.execute("add_task", "{}")).toMatchObject({
      error: { code: "INVALID_PARAMS" },
    });
    expect(await executor.execute("add_task", JSON.stringify({ text: "   " }))).toMatchObject({
      error: { code: "INVALID_PARAMS" },
    });
    expect(wrapper.findAll(".tasks li")).toHaveLength(3);
  });

  it("executes with the supplied text and verifies the declared expectation", async () => {
    const { pling, wrapper } = mountApp();
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(null) });

    const output = await executor.execute(
      "add_task",
      JSON.stringify({ text: "Ship the release candidate" }),
    );
    await nextTick();

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
    expect(taskTexts(wrapper)).toContain(
      "Ship the release candidate",
    );
  });

  it("reports why the action is unavailable when the list is full", async () => {
    const { pling, wrapper } = mountApp();
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(null) });

    for (const text of ["One", "Two", "Three", "Four", "Five"]) {
      await executor.execute("add_task", JSON.stringify({ text }));
    }
    await nextTick();

    expect(await executor.execute("add_task", JSON.stringify({ text: "Six" }))).toMatchObject({
      error: {
        code: "ACTION_UNAVAILABLE",
        message: expect.stringContaining("The list is full (8 tasks)"),
      },
    });
    expect(wrapper.findAll(".tasks li")).toHaveLength(8);
  });

  it("runs end to end through the agent loop", async () => {
    const llm = createReplayLlm([
      { calls: [{ tool: "add_task", args: { text: "Send the customer follow-up" } }] },
      { content: "Added the customer follow-up." },
    ]);
    const { pling, warnings, wrapper } = mountApp(llm);
    await nextTick();

    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(null),
      llm,
      settle: async () => {},
    });
    const answer = await loop.run("Add “Send the customer follow-up” to my tasks.");
    await nextTick();

    expect(answer).toContain("Added the customer follow-up.");
    expect(taskTexts(wrapper)[0]).toBe("Send the customer follow-up");
    expect(warnings).toEqual([]);
    expect(llm.received[0]?.some((message) => message.content.includes("add_task"))).toBe(true);
    expect(llm.toolsSeen[0]?.some((tool) => tool.function.name === "add_task")).toBe(true);
  });
});
