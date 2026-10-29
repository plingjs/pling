import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling } from "@plingjs/vue";
import App from "../src/App.vue";
import { addTask, createSeedTasks, toggleTask } from "../src/todo";

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

async function setup(locale: "en" | "zh" = "en") {
  const pling = createPling({
    diagnostics: false,
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm: createReplayLlm([]) },
  });
  const wrapper = mount(App, {
    attachTo: document.body,
    props: { locale },
    global: { plugins: [pling.plugin] },
  });
  cleanup = () => { wrapper.unmount(); pling.destroy(); };
  await nextTick();
  return { pling, wrapper };
}

function executorFor(pling: ReturnType<typeof createPling>) {
  return createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
    settle: async () => { await nextTick(); },
  });
}

describe("V3-22 · migrating an existing Vue app", () => {
  it("keeps the existing business functions usable without any framework context", () => {
    const tasks = createSeedTasks("en");
    const added = addTask(tasks, "Prepare the demo", "t4");
    const toggled = toggleTask(added!, "t1");

    expect(added?.[0]).toEqual({ id: "t4", text: "Prepare the demo", done: false });
    expect(toggled.find((task) => task.id === "t1")?.done).toBe(true);
    expect(tasks).toHaveLength(3);
  });

  it("adds only the selected integration points", async () => {
    const { pling } = await setup();
    const snapshot = pling.registry.snapshot();
    const ids = snapshot.actions.map((action) => action.id);

    expect(ids).toEqual(expect.arrayContaining(["draft_text", "submit_task", "toggle@t1", "toggle@t2", "toggle@t3"]));
    expect(ids).not.toContain("export_csv");
    expect(snapshot.state.todo_migration).toEqual({ total: 3, open: 2, completed: 1, visibleIds: ["t1", "t2", "t3"] });
    expect(snapshot.scopes.find((scope) => scope.id === "todo")?.label).toBe("Todo list");
    expect(pling.inspectCoverage().missing).toBe(0);
  });

  it("uses the same form and row handlers for manual and agent operations", async () => {
    const { pling, wrapper } = await setup();
    const executor = executorFor(pling);

    await wrapper.get(".composer input").setValue("Manual task");
    await wrapper.get(".composer").trigger("submit");
    await nextTick();
    expect(wrapper.findAll(".tasks li")[0]?.text()).toContain("Manual task");

    await executor.execute("draft_text", JSON.stringify({ text: "Prepare the demo" }));
    await executor.execute("submit_task", "{}");
    await executor.execute("toggle@t1", "{}");
    await nextTick();

    expect(wrapper.findAll(".tasks li")[0]?.text()).toContain("Prepare the demo");
    expect(wrapper.find(".tasks li.done")?.text()).toContain("Review the release checklist");
    expect(pling.registry.snapshot().state.todo_migration).toMatchObject({ total: 5, open: 3, completed: 2 });
  });

  it("keeps visible copy and capability descriptions in the selected language", async () => {
    const { pling, wrapper } = await setup("zh");

    expect(wrapper.get("h1").text()).toContain("不重写页面");
    expect(wrapper.findAll(".tasks li")[0]?.text()).toContain("检查发布清单");
    expect(pling.registry.snapshot().actions.find((action) => action.id === "draft_text")?.description).toContain("现有表单");
    expect(pling.registry.snapshot().stateViews[0]?.description).toContain("只读摘要");
  });
});
