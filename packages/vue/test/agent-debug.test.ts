import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createRegistry } from "@plingjs/core";
import { createPling } from "../src/directive";
import AgentDock from "../src/components/AgentDock.vue";

const config = { baseUrl: "/llm/v1", model: "test-model" } as const;

function setup(
  debug: boolean | { maxCalls: number } = true,
  registry = createRegistry(),
  turns: unknown[] = [{ content: "I saved it." }],
) {
  const pi = createPling({
    onWarn: () => {},
    ui: { locale: "en-US" },
    agent: {
      config,
      gate: () => false,
      llm: createReplayLlm(turns as never),
    },
  });
  const Host = defineComponent({
    template: `
      <div>
        <button v-tool="{ id: 'save', desc: 'Save the current draft', run: onRun }">Save</button>
        <AgentDock default-open :debug="debug" :registry="registry" :quick="['Do one thing']" />
      </div>
    `,
    components: { AgentDock },
    setup: () => ({ debug, registry, onRun: () => {} }),
  });
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  return { pi, wrapper };
}

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("Timed out");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function openDebug(wrapper: ReturnType<typeof setup>["wrapper"]): Promise<void> {
  const activity = wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("Activity"))!;
  await activity.trigger("click");
  await wrapper.find('[data-testid="pling-debug-toggle"]').trigger("click");
  await nextTick();
}

describe("<AgentDock> read-only debug inspector", () => {
  it("is hidden unless enabled", async () => {
    const { wrapper } = setup(false);
    expect(wrapper.find('[data-testid="pling-debug-toggle"]').exists()).toBe(false);
    await wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("Activity"))!.trigger("click");
    expect(wrapper.find('[data-testid="pling-debug-toggle"]').exists()).toBe(false);
  });

  it("keeps the debug entry and quick tasks in their own tabs", async () => {
    const { wrapper } = setup(true);

    expect(wrapper.find('[data-testid="pling-debug-toggle"]').exists()).toBe(false);
    expect(wrapper.find(".dock__quick").exists()).toBe(true);

    await wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("Activity"))!.trigger("click");

    expect(wrapper.find('[data-testid="pling-debug-toggle"]').exists()).toBe(true);
    expect(wrapper.find(".dock__quick").exists()).toBe(false);
  });

  it("shows the current page projection and the exact model request in Activity", async () => {
    const { wrapper } = setup(true);

    await wrapper.find(".dock__chat .composer input").setValue("Inspect this run");
    await wrapper.find(".dock__chat form").trigger("submit");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("I saved it."));

    await openDebug(wrapper);

    const debug = wrapper.find('[data-testid="pling-debug"]');
    expect(debug.exists()).toBe(true);
    expect(debug.text()).toContain("Read-only inspector");
    expect(debug.text()).toContain("save");
    expect(debug.text()).toContain("Request messages");
    expect(debug.text()).toContain("Inspect this run");
    expect(debug.text()).toContain("I saved it.");
    expect(debug.find('[aria-label="Run"]').exists()).toBe(false);
  });

  it("clears request traces together with the conversation", async () => {
    const { wrapper } = setup(true);
    await wrapper.find(".dock__chat .composer input").setValue("Inspect this run");
    await wrapper.find(".dock__chat form").trigger("submit");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("I saved it."));
    await openDebug(wrapper);
    expect(wrapper.find('[data-testid="pling-debug"]').text()).toContain("Inspect this run");

    await wrapper.find('.dock__actions button[title="Clear"]').trigger("click");
    await nextTick();

    expect(wrapper.find('[data-testid="pling-debug"]').text()).toContain("No model calls yet");
  });

  it("projects the registry used by the conversation, not the global instance", async () => {
    const custom = createRegistry();
    custom.setPage({ title: "Custom runtime page", path: "/custom" });
    const { wrapper } = setup(true, custom);

    await openDebug(wrapper);

    const debug = wrapper.find('[data-testid="pling-debug"]');
    expect(debug.text()).toContain("Custom runtime page");
    expect(debug.text()).toContain("/custom");
  });

  it("keeps the run timeline and mounts only the expanded model request", async () => {
    const { wrapper } = setup(true, createRegistry(), [
      { calls: [{ tool: "save" }] },
      { content: "I saved it." },
    ]);

    await wrapper.find(".dock__chat .composer input").setValue("Inspect this run");
    await wrapper.find(".dock__chat form").trigger("submit");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("I saved it."));
    await openDebug(wrapper);

    expect(wrapper.find('[data-testid="pling-run-actions"]').text()).toContain("save");
    expect(wrapper.find('[data-testid="pling-call-body-1"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="pling-call-body-2"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pling-call-body-2"]').text()).toContain("Inspect this run");
    expect(wrapper.find('[data-testid="pling-call-body-2"]').text()).toContain("I saved it.");
  });
});
