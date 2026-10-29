import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProtocol,
  createAgentLoop,
  createReplayLlm,
  renderPageContext,
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

describe("V3-09 · regions, visibility, and overlays", () => {
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

  it("keeps the manual edit flow intact and discards a cancelled change", async () => {
    const { wrapper } = mountApp();

    await wrapper.findAll(".tasks__edit")[1]!.trigger("click");
    await nextTick();

    expect(wrapper.find(".overlay").exists()).toBe(true);
    expect(wrapper.get("#edit-task-title").text()).toBe("Edit “Book the design review”");
    const input = wrapper.get("#edit-task-text");
    expect((input.element as HTMLInputElement).value).toBe("Book the design review");

    await input.setValue("Book the design review with Mina");
    await wrapper.get(".dialog__save").trigger("click");
    await nextTick();

    expect(wrapper.find(".overlay").exists()).toBe(false);
    expect(taskTexts(wrapper)[1]).toBe("Book the design review with Mina");

    await wrapper.findAll(".tasks__edit")[1]!.trigger("click");
    await nextTick();
    await wrapper.get("#edit-task-text").setValue("Temporary title");
    await wrapper.get(".dialog__cancel").trigger("click");
    await nextTick();

    expect(wrapper.find(".overlay").exists()).toBe(false);
    expect(taskTexts(wrapper)[1]).toBe("Book the design review with Mina");
  });

  it("projects a region tree and prefixes actions with their region path", async () => {
    const { pling, wrapper } = mountApp();
    await nextTick();

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

    expect(snapshot.actions.find((action) => action.id === "add_task")?.scopePath).toEqual([
      "Tasks",
      "Task composer",
    ]);
    expect(snapshot.actions.find((action) => action.id === "edit@t2")?.scopePath).toEqual([
      "Tasks",
      "Task list",
    ]);
    expect(snapshot.actions.find((action) => action.id === "show_all_tasks")?.scopePath).toEqual([
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

    wrapper.unmount();
  });

  it("opens a dialog region and makes covered actions unavailable with a reason", async () => {
    const { pling, warnings, wrapper } = mountApp();
    const executor = executorFor(pling);

    const opened = await executor.execute("edit@t2", "{}");
    expect(opened).toMatchObject({ result: { ok: true } });
    await nextTick();

    const snapshot = pling.registry.snapshot();
    const live = snapshot.actions.map((action) => action.id);
    expect(live).not.toContain("add_task");
    expect(live).not.toContain("toggle@t1");
    expect(live).not.toContain("show_all_tasks");
    expect(live).not.toContain("complete_open_tasks");
    expect(live).toEqual(expect.arrayContaining(["edit_note", "edit_save", "edit_cancel"]));

    expect(
      snapshot.unavailable.find((action) => action.id === "add_task")?.reason,
    ).toContain("inert");
    expect(
      snapshot.unavailable.find((action) => action.id === "toggle@t1")?.reason,
    ).toContain("inert");
    expect(
      snapshot.unavailable.find((action) => action.id === "complete_open_tasks")?.reason,
    ).toBe("Finish or cancel the open task editor before changing the task list.");

    const dialogScope = snapshot.scopes.find((scope) => scope.id === "edit_dialog");
    expect(dialogScope).toMatchObject({
      label: "Edit task",
      role: "dialog",
      parent: "todo",
      depth: 2,
      active: true,
    });
    expect(snapshot.actions.find((action) => action.id === "edit_save")?.scopePath).toEqual([
      "Tasks",
      "Edit task",
    ]);

    const context = renderPageContext(snapshot);
    expect(context).toContain('dialog "Edit task" (edit_dialog)');
    expect(context).toContain("## Actions that exist but are unavailable right now");
    expect(context).toContain("inert");
    expect(context).toContain("region: Tasks / Task composer");

    const blocked = await executor.execute("add_task", JSON.stringify({ text: "Should not appear" }));
    expect(blocked).toMatchObject({ error: { code: "ACTION_UNAVAILABLE" } });
    expect((blocked as { error: { message: string } }).error.message).toContain("inert");
    expect(taskTexts(wrapper)).not.toContain("Should not appear");
    expect(warnings).toEqual([]);

    wrapper.unmount();
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
    const answer = await loop.run("Rename the second task to “Book the design review with Mina”.");
    await nextTick();

    expect(answer).toContain("Renamed the task");
    expect(taskTexts(wrapper)[1]).toBe("Book the design review with Mina");
    expect(wrapper.find(".overlay").exists()).toBe(false);
    expect(warnings).toEqual([]);

    const secondTurn = llm.received[1]?.[0]?.content ?? "";
    expect(secondTurn).toContain('dialog "Edit task" (edit_dialog)');
    expect(secondTurn).toContain("## Actions that exist but are unavailable right now");
    expect(secondTurn).toContain("inert");
    expect(llm.toolsSeen[1]?.map((tool) => tool.function.name)).toEqual(
      expect.arrayContaining(["edit_note", "edit_save", "edit_cancel"]),
    );
  });

  it("localizes region labels, the editor, and the function-level tool guard", async () => {
    const { pling, wrapper } = mountApp(createReplayLlm([]), "zh");
    const executor = executorFor(pling);
    await nextTick();

    expect(wrapper.get("h1").text()).toBe("待办");
    expect(pling.registry.snapshot().scopes.find((scope) => scope.id === "task_list")).toMatchObject({
      label: "待办列表",
      description: "当前可见的待办，以及完成、编辑和删除操作。",
    });

    await executor.execute("edit@t1", "{}");
    await nextTick();

    expect(wrapper.get("#edit-task-title").text()).toBe("编辑“检查发布清单”");
    expect(wrapper.get(".dialog__cancel").text()).toBe("取消");
    expect(wrapper.get(".dialog__save").text()).toBe("保存修改");
    expect(
      pling.registry.snapshot().unavailable.find(
        (action) => action.id === "complete_open_tasks",
      )?.reason,
    ).toBe("请先完成或取消当前编辑弹窗，再修改待办列表。");
  });

  it("still folds row actions while exposing the dialog's own actions", async () => {
    const { pling, wrapper } = mountApp();
    const executor = executorFor(pling);

    const protocolBefore = buildProtocol(pling.registry.snapshot());
    expect(protocolBefore.templates.get("edit")).toMatchObject({
      template: "edit@",
      records: ["t1", "t2", "t3"],
    });
    expect(protocolBefore.tools.map((tool) => tool.function.name)).toContain("complete_open_tasks");

    await executor.execute("edit@t1", "{}");
    await nextTick();

    const protocolDuring = buildProtocol(pling.registry.snapshot());
    const names = protocolDuring.tools.map((tool) => tool.function.name);
    expect(names).toEqual(expect.arrayContaining(["edit_note", "edit_save", "edit_cancel"]));
    expect(names).not.toContain("edit");
    expect(names).not.toContain("add_task");
    expect(wrapper.find(".dialog").exists()).toBe(true);
  });
});
