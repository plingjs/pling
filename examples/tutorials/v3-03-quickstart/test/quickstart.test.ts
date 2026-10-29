import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createAgentLoop, createReplayLlm } from "@plingjs/agent";
import { createPolicy } from "@plingjs/core";
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

describe("V3-03 · a complete Todo agent", () => {
  const taskTexts = (wrapper: ReturnType<typeof mountApp>["wrapper"]) =>
    wrapper.findAll(".tasks li .tasks__check span").map((item) => item.text());

  const loopFor = (pling: ReturnType<typeof mountApp>["pling"], llm: ReturnType<typeof createReplayLlm>) =>
    createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(null),
      llm,
      settle: async () => {
        await nextTick();
      },
    });

  it("keeps the manual form workflow on the normal business function", async () => {
    const { wrapper } = mountApp();
    await wrapper.get("#new-task").setValue("Prepare the demo");
    await wrapper.get("form").trigger("submit");
    await nextTick();

    expect(taskTexts(wrapper)[0]).toBe("Prepare the demo");
    expect((wrapper.get("#new-task").element as HTMLInputElement).value).toBe("");
  });

  it("exposes a named region, task records, and only the declared controls", async () => {
    const { pling, warnings, wrapper } = mountApp();
    await nextTick();

    expect(wrapper.findComponent(AgentDock).exists()).toBe(true);
    const snapshot = pling.registry.snapshot();

    expect(snapshot.scopes.find((scope) => scope.id === "todo")).toMatchObject({
      label: "Tasks",
      description: "The task list and the form for adding a new task.",
      role: "main",
    });
    expect(snapshot.records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);
    expect(snapshot.records[0]?.fields).toEqual({
      text: "Review the launch checklist",
      status: "open",
    });

    expect(snapshot.actions.map((action) => action.id)).toEqual(
      expect.arrayContaining([
        "composer_text",
        "toggle@t1",
        "toggle@t2",
        "toggle@t3",
      ]),
    );
    expect(snapshot.actions.map((action) => action.id)).not.toContain("composer_submit");
    expect(warnings).toEqual([]);
  });

  it("adds a task through the same input and submit path used by a person", async () => {
    const llm = createReplayLlm([
      { calls: [{ tool: "composer_text", args: { text: "Call the dentist" } }] },
      { calls: [{ tool: "composer_submit" }] },
      { content: "Added the task." },
    ]);
    const { pling, warnings, wrapper } = mountApp(llm);
    await nextTick();

    const answer = await loopFor(pling, llm).run("Add “Call the dentist” to my tasks.");
    await nextTick();

    expect(answer).toContain("Added the task.");
    expect(taskTexts(wrapper)[0]).toBe("Call the dentist");
    expect(llm.toolsSeen[0]?.map((tool) => tool.function.name)).toContain("composer_text");
    expect(llm.toolsSeen[1]?.map((tool) => tool.function.name)).toContain("composer_submit");
    expect(warnings).toEqual([]);
  });

  it("completes a task through the folded record action", async () => {
    const llm = createReplayLlm([
      { calls: [{ tool: "toggle", args: { record: "t2" } }] },
      { content: "Marked the design review as completed." },
    ]);
    const { pling, warnings, wrapper } = mountApp(llm);
    await nextTick();

    const answer = await loopFor(pling, llm).run("Mark “Book the design review” as completed.");
    await nextTick();

    expect(answer).toContain("Marked the design review as completed.");
    expect(wrapper.findAll(".tasks li")[1]?.classes()).toContain("is-done");
    expect(pling.registry.snapshot().records[1]?.fields.status).toBe("completed");
    expect(llm.toolsSeen[0]?.map((tool) => tool.function.name)).toContain("toggle");
    expect(warnings).toEqual([]);
  });

  it("uses Chinese copy, record fields, and action descriptions when locale is zh", async () => {
    const { pling, warnings, wrapper } = mountApp(createReplayLlm([]), "zh");
    await nextTick();

    expect(wrapper.get("h1").text()).toBe("待办");
    expect(taskTexts(wrapper)).toEqual(["检查发布清单", "预约设计评审", "跟进客户"]);
    expect(pling.registry.snapshot().actions.find((action) => action.id === "composer_text")?.description).toBe(
      "在这个输入框中填写一条新待办的内容。",
    );
    expect(pling.registry.snapshot().actions.find((action) => action.id === "toggle@t2")?.description).toBe(
      "将“预约设计评审”标记为已完成。",
    );
    expect(pling.registry.snapshot().records[1]?.fields).toEqual({
      text: "预约设计评审",
      status: "open",
    });
    expect(warnings).toEqual([]);
  });
});
