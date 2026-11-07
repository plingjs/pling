import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskGuideDefinition } from "@plingjs/agent";
import { AgentTaskGuide, createPling } from "../src";

const mounted: Array<{ wrapper: ReturnType<typeof mount>; destroy: () => void }> = [];

const definition: TaskGuideDefinition = {
  taskId: "record.create",
  title: "Create a record",
  steps: [
    {
      id: "details",
      label: "Details",
      title: "Confirm the details",
      description: "The page remains the input surface.",
      rows: [{ label: "Name", value: "Yoga foundations" }],
      primary: { label: "Write to page", command: "apply-details" },
    },
    {
      id: "cover",
      label: "Cover",
      title: "Choose a cover",
      description: "This needs a person.",
      handoff: { title: "Human handoff", description: "Choose the file in the page." },
    },
  ],
  done: {
    title: "Record created",
    description: "Read back from the page.",
  },
};

afterEach(() => {
  while (mounted.length) {
    const item = mounted.pop();
    item?.wrapper.unmount();
    item?.destroy();
  }
});

describe("guided task guide · Vue", () => {
  it("mounts the neutral renderer and forwards commands", async () => {
    const pling = createPling({ onWarn: () => {} });
    const step = ref(1);
    const completed = ref(false);
    const onCommand = vi.fn();
    const Host = defineComponent({
      components: { AgentTaskGuide },
      setup: () => ({ definition, step, completed, onCommand }),
      template: `<AgentTaskGuide :definition="definition" :step="step" :completed="completed" @command="onCommand" />`,
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pling.plugin] } });
    mounted.push({ wrapper, destroy: () => pling.destroy() });
    await nextTick();

    expect(wrapper.find(".pling-guide").exists()).toBe(true);
    expect(wrapper.findAll("input, textarea, select")).toHaveLength(0);
    await wrapper.find(".pling-guide__primary").trigger("click");
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.objectContaining({ command: "apply-details" }),
    }));

    step.value = 2;
    await nextTick();
    expect(wrapper.text()).toContain("Human handoff");

    completed.value = true;
    await nextTick();
    expect(wrapper.find(".pling-guide__result").exists()).toBe(true);
  });
});
