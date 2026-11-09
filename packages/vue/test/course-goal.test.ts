import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createReplayLlm } from "@plingjs/agent";
import { createPling } from "../src/directive";
import CourseCreatePage from "../../../examples/shared/course-create/CourseCreatePage.vue";
import { courseGoal } from "../../../examples/shared/course-create/task";

const mounted: Array<{ unmount: () => void; destroy: () => void }> = [];

afterEach(() => {
  while (mounted.length) {
    const item = mounted.pop();
    item?.unmount();
    item?.destroy();
  }
});

describe("goal-only course demo", () => {
  it("keeps the goal alive while the agent clicks the real create button and leaves the modal", async () => {
    Element.prototype.scrollIntoView = () => {};
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "zh-CN" },
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([{ content: "ok" }]),
      },
    });
    pi.task.goal(courseGoal("zh"));

    const wrapper = mount(CourseCreatePage, {
      props: { locale: "zh", taskPlacement: "inline" },
      attachTo: document.body,
      global: { plugins: [pi.plugin], stubs: { AgentInline: true } },
    });
    mounted.push({ unmount: () => wrapper.unmount(), destroy: () => pi.destroy() });
    await nextTick();

    const executor = createExecutor({
      registry: pi.registry,
      policy: createPolicy(async () => true),
      settle: async () => {
        await nextTick();
      },
    });

    expect(pi.task.available().map((task) => task.id)).toContain("course.create");
    expect(pi.task.active()).toBeNull();
    expect(wrapper.find(".course-modal").exists()).toBe(false);

    await executor.execute("pling_start_task", JSON.stringify({ task: "course.create" }));
    await nextTick();

    const active = pi.task.active()!;
    expect(active.goal).toBe(true);
    expect(active.startedBy).toBe("agent");
    expect(active.controller).toBeUndefined();
    expect(active.definition.fields).toBeUndefined();
    expect(active.state.snapshot?.status).toBe("running");
    // Starting the goal must not open the dialog for the agent.
    expect(wrapper.find(".course-modal").exists()).toBe(false);

    await executor.execute("new_course", "{}");
    await nextTick();
    expect(wrapper.find(".course-modal").exists()).toBe(true);
    expect(pi.registry.snapshot().actions.map((action) => action.id)).toContain("course_name");

    await executor.execute("close_course_form", "{}");
    await nextTick();
    expect(wrapper.find(".course-modal").exists()).toBe(false);
    expect(pi.task.active()?.id).toBe("course.create");

    await executor.execute("pling_complete_task", JSON.stringify({ task: "course.create" }));
    await nextTick();
    expect(pi.task.active()?.state.snapshot?.status).toBe("done");
    expect(pi.task.active()?.state.completed).toBe(true);
  });
});
