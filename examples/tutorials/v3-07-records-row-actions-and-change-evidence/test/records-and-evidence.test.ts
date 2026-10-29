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

describe("V3-07 · records, row actions, and change evidence", () => {
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

  it("keeps the manual Todo workflow unchanged", async () => {
    const { wrapper } = mountApp();
    await wrapper.get("#new-task").setValue("Prepare the launch notes");
    await wrapper.get("#task-priority").setValue("later");
    await wrapper.get("form").trigger("submit");
    await nextTick();

    expect(taskTexts(wrapper)[0]).toBe("Prepare the launch notes");
    expect(wrapper.get(".tasks li .tasks__priority").text()).toBe("Later");
    expect((wrapper.get("#new-task").element as HTMLInputElement).value).toBe(
      "",
    );
  });

  it("uses Chinese UI copy, records, and row action descriptions when locale is zh", async () => {
    const { pling, wrapper } = mountApp(createReplayLlm([]), "zh");
    await nextTick();

    expect(wrapper.get("h1").text()).toBe("待办");
    expect(taskTexts(wrapper)).toEqual(["检查发布清单", "预约设计评审", "跟进客户"]);
    expect(wrapper.get(".tasks li .tasks__priority").text()).toBe("今天");
    expect(pling.registry.snapshot().records[0]).toMatchObject({
      id: "t1",
      fields: { text: "检查发布清单", status: "open", priority: "今天" },
    });
    expect(pling.registry.snapshot().actions.find((action) => action.id === "toggle@t1")?.description).toBe(
      "将“检查发布清单”标记为已完成。",
    );
    expect(pling.registry.snapshot().actions.find((action) => action.id === "remove@t3")?.description).toBe(
      "删除“跟进客户”。此操作不可撤销。",
    );
    expect(pling.registry.snapshot().actions.find((action) => action.id === "add_task")?.description).toBe(
      "使用提供的文本和新增区当前选中的优先级添加一条待办。",
    );
  });

  it("publishes row data and folds repeated row actions into record templates", async () => {
    const { pling, warnings, wrapper } = mountApp();
    await nextTick();

    expect(wrapper.findComponent(AgentDock).exists()).toBe(true);
    expect(pling.registry.snapshot().scopes.find((scope) => scope.id === "todo")).toMatchObject({
      label: "Tasks",
      description: "The task list, the composer, and the controls for finding and filtering tasks.",
      role: "main",
    });
    expect(pling.registry.snapshot().records).toEqual([
      {
        id: "t1",
        fields: {
          text: "Review the launch checklist",
          status: "open",
          priority: "Today",
        },
        scope: "todo",
        source: "declared",
      },
      {
        id: "t2",
        fields: {
          text: "Book the design review",
          status: "open",
          priority: "Soon",
        },
        scope: "todo",
        source: "declared",
      },
      {
        id: "t3",
        fields: {
          text: "Send the customer follow-up",
          status: "completed",
          priority: "Later",
        },
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

    const toggle = protocol.tools.find(
      (tool) => tool.function.name === "toggle",
    );
    expect(toggle?.function.parameters).toMatchObject({
      properties: { record: { type: "string" } },
      required: ["record"],
    });
    expect(protocol.tools.map((tool) => tool.function.name)).not.toContain(
      "toggle_t1",
    );
    expect(warnings).toEqual([]);
  });

  it("reports a row update after toggling a task", async () => {
    const { pling, wrapper } = mountApp();
    const executor = executorFor(pling);

    const response = await executor.execute("toggle@t2", "{}");
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

    expect(pling.registry.snapshot().records[1]?.fields.status).toBe(
      "completed",
    );
    expect(wrapper.findAll(".tasks li")[1]?.classes()).toContain("is-done");
  });

  it("reports a removed row and the actions that disappeared with it", async () => {
    const { pling, wrapper } = mountApp();
    const executor = executorFor(pling);

    const response = await executor.execute("remove@t3", "{}");
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
    if (!("result" in response)) {
      throw new Error(`expected a successful removal, got ${JSON.stringify(response)}`);
    }
    const result = response.result as { changed?: { actions?: { removed?: string[] } } };
    expect(result.changed?.actions?.removed).toEqual(expect.arrayContaining(["remove@t3", "toggle@t3"]));
    await nextTick();

    expect(taskTexts(wrapper)).toEqual([
      "Review the launch checklist",
      "Book the design review",
    ]);
  });

  it("reports an added row after add_task", async () => {
    const { pling } = mountApp();
    const executor = executorFor(pling);

    const response = await executor.execute(
      "add_task",
      JSON.stringify({ text: "Draft the release note" }),
    );
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
      fields: {
        text: "Draft the release note",
        status: "open",
        priority: "Soon",
      },
    });
  });

  it("lets a replay model select rows through folded tools", async () => {
    const llm = createReplayLlm([
      {
        calls: [
          { tool: "toggle", args: { record: "t2" } },
          { tool: "remove", args: { record: "t3" } },
        ],
      },
      { content: "Updated the design-review task and deleted the follow-up." },
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
    const answer = await loop.run(
      "Mark “Book the design review” as completed, then delete “Send the customer follow-up”.",
    );
    await nextTick();

    expect(answer).toContain("Updated the design-review task");
    expect(taskTexts(wrapper)).toEqual([
      "Review the launch checklist",
      "Book the design review",
    ]);
    expect(wrapper.findAll(".tasks li")[1]?.classes()).toContain("is-done");
    expect(warnings).toEqual([]);
    expect(
      llm.toolsSeen[0]?.map((tool) => tool.function.name),
    ).toEqual(expect.arrayContaining(["toggle", "remove"]));
  });
});
