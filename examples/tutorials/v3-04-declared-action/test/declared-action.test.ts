import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
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

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("Timed out");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function openDock(wrapper: ReturnType<typeof mountApp>["wrapper"]): Promise<void> {
  await wrapper.get(".dock__launcher").trigger("click");
  await nextTick();
}

async function openInspector(wrapper: ReturnType<typeof mountApp>["wrapper"]): Promise<void> {
  const activity = wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("Activity"));
  expect(activity).toBeTruthy();
  await activity!.trigger("click");

  const toggle = wrapper.find('[data-testid="pling-debug-toggle"]');
  expect(toggle.exists()).toBe(true);
  await toggle.trigger("click");
  await nextTick();
}

describe("V3-04 · your first declared action", () => {
  it("keeps the page usable while the inspector is enabled", async () => {
    const { wrapper } = mountApp();
    await wrapper.get("#new-task").setValue("Prepare the demo");
    await wrapper.get("form").trigger("submit");
    await nextTick();

    expect(wrapper.findAll(".tasks li .tasks__check span")[0]?.text()).toBe("Prepare the demo");
  });

  it("enables the inspector with an explicit bounded trace", () => {
    const { wrapper } = mountApp();
    expect(wrapper.findComponent(AgentDock).props("debug")).toEqual({ maxCalls: 8 });
  });

  it("shows the page projection, tools, and assembled messages for one run", async () => {
    const llm = createReplayLlm([
      { calls: [{ tool: "toggle", args: { record: "t2" } }] },
      { content: "Marked the design review as completed." },
    ]);
    const { pling, warnings, wrapper } = mountApp(llm);
    await nextTick();

    await openDock(wrapper);
    await wrapper.get(".dock__chat .composer input").setValue("Mark “Book the design review” as completed.");
    await wrapper.get(".dock__chat form").trigger("submit");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("Marked the design review"));

    await openInspector(wrapper);

    const debug = wrapper.get('[data-testid="pling-debug"]');
    expect(debug.text()).toContain("Read-only inspector");
    expect(debug.text()).toContain("Page projection");
    expect(debug.text()).toContain("Records");
    expect(debug.text()).toContain("Model calls");
    expect(debug.text()).toContain("Request messages");
    expect(debug.text()).toContain("toggle");
    expect(debug.text()).toContain("Mark “Book the design review” as completed.");
    expect(debug.text()).toContain("Marked the design review as completed.");
    expect(wrapper.findAll(".tasks li")[1]?.classes()).toContain("is-done");
    expect(pling.registry.snapshot().records[1]?.fields.status).toBe("completed");
    expect(warnings).toEqual([]);
  });

  it("uses localized page copy while the request inspector stays available in Chinese", async () => {
    const { wrapper } = mountApp(createReplayLlm([]), "zh");
    await nextTick();

    expect(wrapper.get("h1").text()).toBe("待办");
    await openDock(wrapper);

    const activity = wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("运行"));
    expect(activity).toBeTruthy();
    await activity!.trigger("click");
    expect(wrapper.find('[data-testid="pling-debug-toggle"]').exists()).toBe(true);
  });
});
