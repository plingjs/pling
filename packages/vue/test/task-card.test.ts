import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createTaskController, type TaskDefinition } from "@plingjs/agent";
import { AgentDock, AgentTaskCard, createPling } from "../src";

const mounted: Array<{ wrapper: ReturnType<typeof mount>; destroy: () => void }> = [];

const task: TaskDefinition = {
  id: "teacher.create",
  title: "Add a teacher",
  description: "Create a teacher record.",
  fields: [{ name: "name", label: "Teacher name" }],
  steps: [{ label: "Create", action: "create_teacher" }],
};

function setup(template: string, setupState: () => Record<string, unknown>) {
  const pi = createPling({ onWarn: () => {} });
  const Host = defineComponent({ components: { AgentDock, AgentTaskCard }, setup: setupState, template });
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  mounted.push({ wrapper, destroy: () => pi.destroy() });
  return wrapper;
}

afterEach(() => {
  while (mounted.length) {
    const item = mounted.pop();
    item?.wrapper.unmount();
    item?.destroy();
  }
});

describe("guided task card · Vue", () => {
  it("passes the task slot into the chat transcript", async () => {
    const wrapper = setup(
      `<AgentDock default-open><template #task><section class="task-card-fixture">Guided task</section></template></AgentDock>`,
      () => ({}),
    );
    await nextTick();

    expect(wrapper.find(".dock__chat .task-card-fixture").exists()).toBe(true);
    expect(wrapper.find(".dock__chat .task-card-fixture").text()).toBe("Guided task");
    expect(wrapper.find(".dock__chat .empty").exists()).toBe(false);
  });

  it("mounts the shared card and exposes open / setCatalog", async () => {
    const controller = createTaskController({ invoke: async () => ({ ok: true }) });
    controller.register(task);
    const wrapper = setup(
      `<AgentTaskCard ref="card" :controller="controller" :catalog="false" />`,
      () => ({ controller }),
    );
    await nextTick();

    expect((wrapper.find(".pling-task-panel").element as HTMLElement).hidden).toBe(true);
    (wrapper.vm as unknown as { $refs: { card: { open(id: string): void; setCatalog(value: boolean): void; close(): void } } }).$refs.card.open("teacher.create");
    await nextTick();
    expect(wrapper.find(".pling-task-panel__run-title").text()).toBe("Add a teacher");

    (wrapper.vm as unknown as { $refs: { card: { setCatalog(value: boolean): void; close(): void } } }).$refs.card.setCatalog(true);
    (wrapper.vm as unknown as { $refs: { card: { close(): void } } }).$refs.card.close();
    await nextTick();
    expect(wrapper.find(".pling-task-card__title").text()).toContain("Add a teacher");
  });

  it("rebuilds the card when the title changes", async () => {
    const controller = createTaskController({ invoke: async () => ({ ok: true }) });
    const title = ref("Timetable tasks");
    const wrapper = setup(
      `<AgentTaskCard :controller="controller" :title="title" />`,
      () => ({ controller, title }),
    );
    await nextTick();

    expect(wrapper.find(".pling-task-panel__title").text()).toBe("Timetable tasks");
    title.value = "Lesson tasks";
    await nextTick();
    expect(wrapper.find(".pling-task-panel__title").text()).toBe("Lesson tasks");
  });
});
