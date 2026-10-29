import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { AgentDock, createPling } from "@plingjs/vue";
import App from "../src/App.vue";
import { copyFor, type DemoLocale } from "../src/copy";
import { routes } from "../src/router";

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

async function mountApp(llm = createReplayLlm([]), locale: DemoLocale = "en") {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push("/tasks");
  await router.isReady();
  const pling = createPling({
    diagnostics: false,
    presence: false,
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm },
  });
  const wrapper = mount(App, {
    attachTo: document.body,
    props: { locale },
    global: { plugins: [router, pling.plugin] },
  });
  cleanup.push(() => {
    wrapper.unmount();
    pling.destroy();
  });
  await nextTick();
  return { pling, router, wrapper };
}

describe("V3-13 · assistant surfaces and task entries", () => {
  it("changes the shell without mounting a second assistant", async () => {
    const { wrapper } = await mountApp();
    const dock = wrapper.findComponent(AgentDock);

    expect(dock.props("layout")).toBe("dock");
    expect(wrapper.findAllComponents(AgentDock)).toHaveLength(1);

    await wrapper.find('input[value="sidebar"]').setValue();
    expect(dock.props("layout")).toBe("sidebar");
    expect(dock.attributes("data-layout")).toBe("sidebar");
    expect(wrapper.findAllComponents(AgentDock)).toHaveLength(1);
  });

  it("passes sidebar placement through the public props", async () => {
    const { wrapper } = await mountApp();

    await wrapper.find('input[value="sidebar"]').setValue();
    await wrapper.find('input[value="left"]').setValue();
    await wrapper.find('input[value="center"]').setValue();
    const dock = wrapper.findComponent(AgentDock);

    expect(dock.props("side")).toBe("left");
    expect(dock.props("launcherPlacement")).toBe("center");
    expect(dock.props("launcherLabel")).toBe("Ask Pling");
    expect(dock.attributes("data-side")).toBe("left");
    expect(dock.attributes("data-launcher-placement")).toBe("center");
  });

  it("keeps human task buttons out of the agent action registry", async () => {
    const { pling, wrapper } = await mountApp();
    const snapshot = pling.registry.snapshot();

    expect(wrapper.find('[data-task-entry="summarize"]').exists()).toBe(true);
    expect(wrapper.find('[data-task-entry="ask"]').exists()).toBe(true);
    expect(snapshot.actions.some((action) => action.description.includes("Summarize open tasks"))).toBe(false);
    expect(snapshot.actions.some((action) => action.description.includes("What is still open"))).toBe(false);
  });

  it("sends v-task and pling.ask into the same conversation", async () => {
    const llm = createReplayLlm([
      { content: "Two tasks are open." },
      { content: "The launch checklist is first." },
    ]);
    const { wrapper } = await mountApp(llm);

    await wrapper.find('[data-task-entry="summarize"]').trigger("click");
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Two tasks are open.");
    });

    await wrapper.find('[data-task-entry="ask"]').trigger("click");
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("The launch checklist is first.");
    });

    expect(llm.received).toHaveLength(2);
    expect(llm.received[1]!.some((message) => message.role === "assistant" || message.role === "user")).toBe(true);
    expect(document.querySelectorAll("[data-pling-ui] .dock__surface")).toHaveLength(1);
  });

  it("localizes the surface controls and task entries", async () => {
    const { wrapper } = await mountApp(createReplayLlm([]), "zh");
    const copy = copyFor("zh");

    expect(wrapper.text()).toContain(copy.surfaceHeading);
    expect(wrapper.text()).toContain(copy.openTasksTask);
    expect(wrapper.findComponent(AgentDock).props("launcherLabel")).toBe(copy.launcherText);
  });
});
