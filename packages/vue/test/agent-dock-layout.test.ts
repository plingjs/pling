import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createPling } from "../src/directive";
import AgentDock from "../src/components/AgentDock.vue";
import dockSource from "../src/components/AgentDock.vue?raw";

const mounted: Array<{ wrapper: ReturnType<typeof mount>; destroy: () => void }> = [];

function setup(template: string) {
  const llm = createReplayLlm([{ content: "Done." }]);
  const pi = createPling({
    onWarn: () => {},
    ui: { locale: "en-US" },
    agent: {
      config: { baseUrl: "/llm/v1", model: "test-model" },
      gate: () => false,
      llm,
    },
  });
  const Host = defineComponent({ template, components: { AgentDock } });
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  mounted.push({ wrapper, destroy: () => pi.destroy() });
  return { llm, pi, wrapper };
}

afterEach(() => {
  while (mounted.length) {
    const item = mounted.pop();
    item?.wrapper.unmount();
    item?.destroy();
  }
});

describe("<AgentDock> placement", () => {
  it("keeps the floating dock as the default", () => {
    const { wrapper } = setup(`<AgentDock />`);
    const dock = wrapper.find(".dock");

    expect(dock.classes()).toContain("dock--dock");
    expect(dock.classes()).not.toContain("is-open");
    expect(dock.attributes("data-layout")).toBe("dock");
    expect(dock.attributes("data-side")).toBeUndefined();
  });

  it("renders an open, full-height sidebar on the selected edge", () => {
    const { wrapper } = setup(`<AgentDock layout="sidebar" side="left" :default-open="true" />`);
    const dock = wrapper.find(".dock");

    expect(dock.classes()).toEqual(expect.arrayContaining(["dock--sidebar", "dock--left", "is-open"]));
    expect(dock.attributes("data-layout")).toBe("sidebar");
    expect(dock.attributes("data-side")).toBe("left");
    expect(wrapper.find(".dock__panel").exists()).toBe(true);
    expect(wrapper.find(".dock__launcher").exists()).toBe(true);
  });

  it("collapses to an edge launcher and reopens without losing the conversation", async () => {
    const { llm, pi, wrapper } = setup(`<AgentDock layout="sidebar" :default-open="true" />`);
    await pi.ask("Remember this conversation");
    await vi.waitFor(() => expect(llm.received).toHaveLength(1));
    expect(wrapper.find(".dock__chat").text()).toContain("Done.");

    await wrapper.find(".dock__ghost:last-child").trigger("click");
    expect(wrapper.find(".dock__panel").exists()).toBe(false);
    expect(wrapper.find(".dock__launcher").text()).toBe("Ask Pling");

    await wrapper.find(".dock__launcher").trigger("click");
    await nextTick();
    expect(wrapper.find(".dock__panel").exists()).toBe(true);
    expect(wrapper.find(".dock__chat").text()).toContain("Done.");
  });

  it("keeps the collapsed sidebar launcher in a readable bottom corner by default", async () => {
    const { wrapper } = setup(`<AgentDock layout="sidebar" launcher-label="Open copilot" />`);
    const dock = wrapper.find(".dock");
    const launcher = wrapper.find(".dock__launcher");

    expect(dock.attributes("data-launcher-placement")).toBe("bottom");
    expect(dock.classes()).toContain("dock--launcher-bottom");
    expect(launcher.text()).toBe("Open copilot");
    expect(launcher.attributes("title")).toBe("Open copilot");

    await launcher.trigger("click");
    expect(launcher.text()).toBe("Close assistant");
  });

  it("can restore the legacy centered edge tab when a product wants it", () => {
    const { wrapper } = setup(`<AgentDock layout="sidebar" launcher-placement="center" />`);
    const dock = wrapper.find(".dock");

    expect(dock.attributes("data-launcher-placement")).toBe("center");
    expect(dock.classes()).toContain("dock--launcher-center");
  });

  it("a v-task entrance opens the sidebar and uses its shared runtime", async () => {
    const { llm, wrapper } = setup(`
      <div>
        <button id="task" v-task="'Summarize the queue'">Summarize</button>
        <AgentDock layout="sidebar" />
      </div>
    `);
    await nextTick();

    expect(wrapper.find(".dock__panel").exists()).toBe(false);
    await wrapper.find("#task").trigger("click");

    await vi.waitFor(() => expect(llm.received).toHaveLength(1));
    expect(wrapper.find(".dock").classes()).toContain("is-open");
    expect(wrapper.find(".dock__panel").exists()).toBe(true);
    expect(llm.received[0]?.some((message) => message.content.includes("Summarize the queue"))).toBe(true);
  });

  it("ships a mobile fallback and a CSS-only width override", () => {
    expect(dockSource).toContain("@media (max-width: 720px)");
    expect(dockSource).toContain("var(--pling-sidebar-width");
    expect(dockSource).toContain("height: min(640px, calc(100dvh - 72px))");
    expect(dockSource).toContain("bottom: 24px");
    expect(dockSource).toContain("writing-mode: horizontal-tb");
  });
});
