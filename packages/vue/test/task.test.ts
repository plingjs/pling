import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { AgentInline, createPling } from "../src";

const mounted: Array<{ wrapper: ReturnType<typeof mount>; destroy: () => void }> = [];

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function setup(template: string) {
  const llm = createReplayLlm([{ content: "Done." }, { content: "Also done." }]);
  const pi = createPling({
    onWarn: () => {},
    ui: { locale: "en-US" },
    agent: {
      config: { baseUrl: "/llm/v1", model: "test-model" },
      gate: () => false,
      llm,
    },
  });
  const Host = defineComponent({ template, components: { AgentInline } });
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  mounted.push({ wrapper, destroy: () => pi.destroy() });
  return { pi, llm, wrapper };
}

afterEach(() => {
  while (mounted.length) {
    const item = mounted.pop();
    item?.wrapper.unmount();
    item?.destroy();
  }
});

describe("task entrances", () => {
  it("v-task sends one prompt to the shared inline surface and never becomes an agent action", async () => {
    const { pi, llm, wrapper } = setup(`
      <div>
        <button id="report" v-task="'Summarize orders today'">Smart summary</button>
        <AgentInline />
      </div>
    `);
    await nextTick();

    expect(pi.registry.snapshot().actions.map((action) => action.id)).not.toContain("report");
    await wrapper.find("#report").trigger("click");
    await waitFor(() => llm.received.length === 1);

    expect(llm.received).toHaveLength(1);
    expect(llm.received[0]?.some((message) => message.role === "user" && message.content.includes("Summarize orders today"))).toBe(true);
    expect(wrapper.find(".dock__chat").text()).toContain("Done.");
  });

  it("pling.ask() and v-task share the same history", async () => {
    const { pi, llm, wrapper } = setup(`
      <div>
        <button id="first" v-task="'First task'">First</button>
        <AgentInline />
      </div>
    `);
    await nextTick();

    await wrapper.find("#first").trigger("click");
    await waitFor(() => llm.received.length === 1);
    await pi.ask("Second task");

    expect(llm.received).toHaveLength(2);
    expect(llm.received[1]?.some((message) => message.content.includes("First task"))).toBe(true);
    expect(llm.received[1]?.some((message) => message.content.includes("Second task"))).toBe(true);
  });

  it("disabled task entrances keep their layout but do not send", async () => {
    const disabled = ref(true);
    const Host = defineComponent({
      components: { AgentInline },
      setup: () => ({ disabled }),
      template: `
        <div>
          <button id="task" v-task="{ prompt: 'Should not run', disabled }">Task</button>
          <AgentInline />
        </div>
      `,
    });
    const llm = createReplayLlm([{ content: "unexpected" }]);
    const pi = createPling({
      onWarn: () => {},
      agent: { config: { baseUrl: "/llm/v1", model: "test-model" }, llm },
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    mounted.push({ wrapper, destroy: () => pi.destroy() });
    await nextTick();

    await wrapper.find("#task").trigger("click");
    await nextTick();
    expect(llm.received).toHaveLength(0);
  });

  it("fails explicitly when no surface is mounted", async () => {
    const pi = createPling({ onWarn: () => {} });
    await expect(pi.ask("orphan task")).rejects.toMatchObject({ code: "PLING_TASK_SURFACE_MISSING" });
    pi.destroy();
  });
});
