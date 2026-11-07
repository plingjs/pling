import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm, createTaskController, type TaskGuideDefinition } from "@plingjs/agent";
import { AgentInline, createPling } from "../src";

const mounted: Array<{ wrapper: ReturnType<typeof mount>; destroy: () => void }> = [];

const definition = {
  id: "course.create",
  title: "Create a course",
  examples: ["Create a yoga course"],
  fields: [{ name: "name", label: "Course name" }],
  steps: [{ label: "Write", action: "create_course" }],
};

const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "Create a course",
  steps: [
    {
      id: "details",
      label: "Details",
      title: "Confirm the details",
      description: "Use the page form.",
      primary: { label: "Fill", command: "fill" },
    },
  ],
  done: { title: "Created", description: "Read back from the page." },
};

function setup(template = `<AgentInline />`) {
  const pi = createPling({
    onWarn: () => {},
    agent: {
      config: { baseUrl: "/llm/v1", model: "test-model" },
      gate: () => false,
      llm: createReplayLlm([{ content: "ok" }]),
    },
  });
  const Host = defineComponent({ components: { AgentInline }, template });
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  mounted.push({ wrapper, destroy: () => pi.destroy() });
  return { pi, wrapper };
}

function register(pi: ReturnType<typeof createPling>) {
  const controller = createTaskController({ invoke: async () => ({ ok: true }) });
  pi.task.define({ definition, guide, controller, autoStart: true });
  return controller;
}

afterEach(() => {
  while (mounted.length) {
    const item = mounted.pop();
    item?.wrapper.unmount();
    item?.destroy();
  }
});

describe("guided task in the built-in assistant", () => {
  it("renders the active guide inside the conversation without page-owned chrome", async () => {
    const { pi, wrapper } = setup();
    const controller = register(pi);
    await nextTick();

    expect(wrapper.findAll(".pling-guide")).toHaveLength(1);
    expect(wrapper.find(".dock__chat").text()).toContain("Create a course");
    expect(wrapper.find(".dock__chat").text()).toContain("Confirm the details");
    expect(wrapper.findAll(".pling-guide input, .pling-guide textarea, .pling-guide select")).toHaveLength(0);

    await wrapper.find(".pling-guide__primary").trigger("click");
    expect(pi.task.active()?.id).toBe("course.create");
    controller.reset();
  });

  it("pins the active guide above the scrolling transcript when requested", async () => {
    const { pi, wrapper } = setup(`<AgentInline task-placement="pinned" />`);
    const controller = register(pi);
    await nextTick();

    expect(wrapper.find(".task-pinned .pling-guide").exists()).toBe(true);
    expect(wrapper.find(".transcript .pling-guide").exists()).toBe(false);
    expect(wrapper.find(".transcript.is-empty .empty").exists()).toBe(true);
    const pinned = wrapper.find(".task-pinned").element;
    const transcript = wrapper.find(".transcript").element;
    expect(pinned.compareDocumentPosition(transcript) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    controller.reset();
  });

  it("does not reserve an empty pinned area before a task is active", async () => {
    const { pi, wrapper } = setup(`<AgentInline task-placement="pinned" />`);
    await nextTick();

    expect(wrapper.find(".task-pinned").exists()).toBe(false);
    expect(wrapper.find(".transcript .empty").exists()).toBe(true);
    pi.destroy();
  });

  it("can hide the built-in task card while keeping the task active", async () => {
    const { pi, wrapper } = setup(`<AgentInline task-placement="none" />`);
    const controller = register(pi);
    await nextTick();

    expect(pi.task.active()?.id).toBe("course.create");
    expect(wrapper.find(".pling-guide").exists()).toBe(false);
    expect(wrapper.find(".transcript.is-empty .empty").exists()).toBe(true);
    controller.reset();
  });

  it("keeps a page-provided task slot visible without a guided task", async () => {
    const { pi, wrapper } = setup(`
      <AgentInline task-placement="pinned">
        <template #task><div class="page-task">Page-owned task</div></template>
      </AgentInline>
    `);
    await nextTick();

    expect(wrapper.find(".task-pinned .page-task").text()).toBe("Page-owned task");
    expect(wrapper.find(".transcript.is-empty .empty").exists()).toBe(true);
    pi.destroy();
  });

  it("hides the guide when its context is deactivated and does not auto-restart it", async () => {
    const { pi, wrapper } = setup();
    register(pi);
    await nextTick();
    expect(wrapper.find(".pling-guide").exists()).toBe(true);

    pi.task.deactivate();
    await nextTick();
    expect(wrapper.find(".pling-guide").exists()).toBe(false);

    pi.registry.setPage({ path: "/other", name: "other" });
    await nextTick();
    expect(wrapper.find(".pling-guide").exists()).toBe(false);
  });

  it("lets a page replace the default guide through the task slot", async () => {
    const { pi, wrapper } = setup(`
      <AgentInline>
        <template #task><div class="custom-task">Custom task UI</div></template>
      </AgentInline>
    `);
    register(pi);
    await nextTick();

    expect(wrapper.find(".custom-task").text()).toBe("Custom task UI");
    expect(wrapper.find(".pling-guide").exists()).toBe(false);
  });

  it("refreshes the active guide when the task controller changes", async () => {
    const controller = createTaskController({ invoke: async () => ({ ok: true }) });
    const liveGuide: TaskGuideDefinition = {
      ...guide,
      steps: [
        {
          ...guide.steps[0]!,
          rows: () => [{ label: "Live name", value: String(controller.snapshot()?.values.name ?? "not set") }],
        },
      ],
    };
    const { pi, wrapper } = setup();

    pi.task.define({ definition, guide: liveGuide, controller, autoStart: true });
    await nextTick();
    expect(wrapper.find(".pling-guide").text()).toContain("not set");

    controller.setValue("name", "Yoga foundations");
    await nextTick();

    expect(wrapper.find(".pling-guide").text()).toContain("Yoga foundations");
  });

  it("auto-starts only while the registered scope is active", async () => {
    const { pi, wrapper } = setup();
    const controller = createTaskController({ invoke: async () => ({ ok: true }) });
    const flushTaskContext = async () => {
      await nextTick();
      await nextTick();
    };

    pi.task.define({ definition, guide, controller, scope: "course-form", autoStart: true });
    await nextTick();
    expect(wrapper.find(".pling-guide").exists()).toBe(false);

    pi.registry.setActiveScopes(["course-form"]);
    await flushTaskContext();
    expect(pi.task.available().map((item) => item.id)).toEqual(["course.create"]);
    expect(pi.task.active()?.id).toBe("course.create");
    expect(wrapper.find(".pling-guide").exists()).toBe(true);

    pi.registry.setActiveScopes([]);
    await flushTaskContext();
    expect(wrapper.find(".pling-guide").exists()).toBe(false);
  });

  it("lets the model start an available task with values already given by the user", async () => {
    const { pi, wrapper } = setup();
    const controller = createTaskController({ invoke: async () => ({ ok: true }) });
    const liveGuide: TaskGuideDefinition = {
      ...guide,
      steps: [
        {
          ...guide.steps[0]!,
          rows: () => [{ label: "Live name", value: String(controller.snapshot()?.values.name ?? "not set") }],
        },
      ],
    };
    pi.task.define({ definition, guide: liveGuide, controller, autoStart: true });
    await nextTick();

    const action = pi.registry.get("pling_start_task");
    await action?.run?.({ task: "course.create", values: { name: "Yoga foundations" } });
    await nextTick();

    expect(pi.task.active()?.startedBy).toBe("agent");
    expect(wrapper.find(".pling-guide").text()).toContain("Yoga foundations");
  });
});
