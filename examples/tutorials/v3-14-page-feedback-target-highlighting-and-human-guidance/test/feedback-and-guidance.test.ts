import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm, renderPageContext } from "@plingjs/agent";
import { createPling } from "@plingjs/vue";
import App from "../src/App.vue";
import PublishPanel from "../src/components/PublishPanel.vue";
import type { DemoLocale } from "../src/copy";
import { routes } from "../src/router";

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

async function mountApp(locale: DemoLocale = "en") {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push("/tasks");
  await router.isReady();
  const pling = createPling({
    diagnostics: false,
    presence: { effect: "spotlight" },
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm: createReplayLlm([]) },
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
  return { pling, wrapper, panel: wrapper.findComponent(PublishPanel) };
}

describe("V3-14 · feedback, highlighting, and human guidance", () => {
  it("turns a failed save into structured page feedback", async () => {
    const { pling, panel } = await mountApp();

    await panel.find(".release__secondary").trigger("click");

    const feedback = pling.registry.snapshot().feedback;
    expect(feedback).toEqual([
      expect.objectContaining({
        id: "release_feedback",
        field: "workspace_name",
        severity: "error",
        message: expect.stringContaining("workspace name"),
      }),
    ]);
  });

  it("puts the feedback into the model's page context", async () => {
    const { pling, panel } = await mountApp();

    await panel.find(".release__secondary").trigger("click");
    const context = renderPageContext(pling.registry.snapshot());

    expect(context).toContain("## Current page feedback");
    expect(context).toContain("workspace name");
    expect(context).toContain("field: workspace_name");
  });

  it("keeps the verification field human-only while exposing the publish handoff", async () => {
    const { pling } = await mountApp();
    const snapshot = pling.registry.snapshot();

    expect(snapshot.actions.some((action) => action.id === "verification_code")).toBe(false);
    expect(snapshot.actions.some((action) => action.id === "publish_changes")).toBe(true);
    expect(snapshot.actions.find((action) => action.id === "publish_changes")?.handoff).toEqual({
      reason: "The user must confirm the verification code before publishing.",
    });
  });

  it("clears feedback and records a successful publish", async () => {
    const { pling, panel, wrapper } = await mountApp();

    await panel.find('input[data-pling-field="verification_code"]').setValue("246810");
    await panel.find("[data-publish]").trigger("click");

    expect(pling.registry.snapshot().feedback).toEqual([]);
    expect(wrapper.find(".release__status").text()).toBe("Published");
    expect(panel.text()).toContain("Changes published.");
  });

  it("localizes feedback and the publish guidance", async () => {
    const { pling, panel } = await mountApp("zh");

    expect(panel.text()).toContain("发布检查");
    expect(panel.text()).toContain("验证码 246810");

    await panel.find(".release__secondary").trigger("click");
    expect(pling.registry.snapshot().feedback[0]?.message).toContain("工作区名称");
  });
});
