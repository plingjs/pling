import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProtocol,
  createAgentLoop,
  createReplayLlm,
} from "@plingjs/agent";
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

describe("V3-08 · function-level tools", () => {
  const taskTexts = (wrapper: ReturnType<typeof mountApp>["wrapper"]) =>
    wrapper.findAll(".tasks__text").map((item) => item.text());

  const executorFor = (pling: ReturnType<typeof mountApp>["pling"]) =>
    createExecutor({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      settle: async () => {
        await nextTick();
      },
    });

  it("keeps the manual Todo workflow and the previous page model intact", async () => {
    const { pling, wrapper } = mountApp();
    await wrapper.get("#new-task").setValue("Prepare the launch notes");
    await wrapper.get("#task-priority").setValue("later");
    await wrapper.get("form").trigger("submit");
    await nextTick();

    expect(taskTexts(wrapper)[0]).toBe("Prepare the launch notes");
    expect(wrapper.get(".tasks li .tasks__priority").text()).toBe("Later");
    expect((wrapper.get("#new-task").element as HTMLInputElement).value).toBe(
      "",
    );
    expect(
      pling.registry.snapshot().records.find((record) => record.id === "t4"),
    ).toMatchObject({
      fields: {
        text: "Prepare the launch notes",
        status: "open",
        priority: "Later",
      },
    });
  });

  it("localizes the function-level tool and all surrounding copy", async () => {
    const { pling, wrapper } = mountApp(createReplayLlm([]), "zh");
    await nextTick();

    expect(wrapper.get("h1").text()).toBe("待办");
    expect(taskTexts(wrapper)).toEqual(["检查发布清单", "预约设计评审", "跟进客户"]);
    expect(
      pling.registry.snapshot().actions.find(
        (action) => action.id === "complete_open_tasks",
      )?.description,
    ).toBe("将所有未完成待办标记为已完成，并在一次操作中更新所有未完成记录。");
    expect(wrapper.findComponent(AgentDock).props("quick")).toContain(
      "把所有未完成待办都标记为已完成",
    );
  });

  it("registers a call primitive without a DOM target or record template", async () => {
    const { pling, warnings, wrapper } = mountApp();
    await nextTick();

    expect(wrapper.findComponent(AgentDock).exists()).toBe(true);
    expect(
      pling.registry.snapshot().scopes.find((scope) => scope.id === "todo"),
    ).toMatchObject({
      label: "Tasks",
      description:
        "The task list, the composer, and the controls for finding and filtering tasks.",
      role: "main",
    });
    expect(
      pling.registry.snapshot().actions.find(
        (action) => action.id === "complete_open_tasks",
      ),
    ).toMatchObject({
      id: "complete_open_tasks",
      primitive: "call",
      description:
        "Mark every open task as completed. This changes all open records in one operation.",
      kind: "write",
      fidelity: "high",
      source: "declared",
    });

    const protocol = buildProtocol(pling.registry.snapshot());
    const completeOpen = protocol.tools.find(
      (tool) => tool.function.name === "complete_open_tasks",
    );
    expect(completeOpen?.function.parameters).toMatchObject({
      properties: {},
      type: "object",
    });
    expect(protocol.templates.has("complete_open_tasks")).toBe(false);
    expect(protocol.templates.get("toggle")).toMatchObject({
      template: "toggle@",
      records: ["t1", "t2", "t3"],
    });
    expect(warnings).toEqual([]);
  });

  it("runs one function, verifies the outcome, and reports record changes", async () => {
    const { pling, wrapper } = mountApp();
    const executor = executorFor(pling);

    const response = await executor.execute("complete_open_tasks", "{}");
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

    await nextTick();
    expect(pling.registry.snapshot().records.map((record) => record.fields.status)).toEqual([
      "completed",
      "completed",
      "completed",
    ]);
    expect(wrapper.findAll(".tasks li.is-done")).toHaveLength(3);
  });

  it("reports the declared reason when no open task remains", async () => {
    const { pling } = mountApp();
    const executor = executorFor(pling);

    await executor.execute("complete_open_tasks", "{}");
    const second = await executor.execute("complete_open_tasks", "{}");

    expect(second).toMatchObject({
      error: {
        code: "ACTION_UNAVAILABLE",
        message: expect.stringContaining(
          "There are no open tasks. Every task is already completed.",
        ),
      },
    });
    expect(
      pling.registry.snapshot().unavailable.find(
        (action) => action.id === "complete_open_tasks",
      ),
    ).toMatchObject({
      reason: "There are no open tasks. Every task is already completed.",
    });
  });

  it("lets a replay model invoke the function by its business identity", async () => {
    const llm = createReplayLlm([
      { calls: [{ tool: "complete_open_tasks", args: {} }] },
      { content: "Completed every open task." },
    ]);
    const { pling, warnings, wrapper } = mountApp(llm);
    await nextTick();

    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      llm,
      settle: async () => {
        await nextTick();
      },
    });
    const answer = await loop.run("Mark every open task as completed.");
    await nextTick();

    expect(answer).toContain("Completed every open task");
    expect(wrapper.findAll(".tasks li.is-done")).toHaveLength(3);
    expect(warnings).toEqual([]);
    expect(
      llm.toolsSeen[0]?.map((tool) => tool.function.name),
    ).toContain("complete_open_tasks");
  });
});
